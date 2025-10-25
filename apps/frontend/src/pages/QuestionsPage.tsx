import React, { useState, useEffect } from 'react';
import { Title, Text, Paper, TextInput, Button, Group, Box, Stack, Loader, Select, ScrollArea, Badge } from '@mantine/core';
import { IconSend, IconRobot, IconUser, IconFilter, IconBook } from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  type: 'user' | 'ai';
  content: string;
}

interface ClassOffering {
  id: number;
  school: string;
  department: string;
  number: number;
  title: string;
  description: string;
}

const QuestionsPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Class data and filters
  const [filteredClasses, setFilteredClasses] = useState<ClassOffering[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('CAS');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('CS');
  const [keywordSearch, setKeywordSearch] = useState<string>('');
  const [schools, setSchools] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loadingClasses, setLoadingClasses] = useState<boolean>(false);
  
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

  // Load schools and departments on mount
  useEffect(() => {
    fetch(`${backendUrl}/api/schools`)
      .then(res => res.json())
      .then(data => setSchools(data))
      .catch(err => console.error('Error loading schools:', err));
    
    fetch(`${backendUrl}/api/departments?school=CAS`)
      .then(res => res.json())
      .then(data => setDepartments(data))
      .catch(err => console.error('Error loading departments:', err));
  }, [backendUrl]);

  // Fetch classes when filters change
  useEffect(() => {
    if (!selectedSchool && !selectedDepartment && !keywordSearch) {
      return;
    }

    setLoadingClasses(true);
    
    const params = new URLSearchParams();
    if (selectedSchool) params.append('school', selectedSchool);
    if (selectedDepartment) params.append('department', selectedDepartment);
    if (keywordSearch.trim()) params.append('keyword', keywordSearch.trim());
    
    fetch(`${backendUrl}/api/classes?${params}`)
      .then(res => res.json())
      .then(data => {
        setFilteredClasses(data);
        setLoadingClasses(false);
      })
      .catch(err => {
        console.error('Error loading classes:', err);
        setLoadingClasses(false);
      });
  }, [selectedSchool, selectedDepartment, keywordSearch, backendUrl]);

  // Update departments when school changes
  useEffect(() => {
    if (!selectedSchool) return;
    
    fetch(`${backendUrl}/api/departments?school=${selectedSchool}`)
      .then(res => res.json())
      .then(data => setDepartments(data))
      .catch(err => console.error('Error loading departments:', err));
  }, [selectedSchool, backendUrl]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    // Add user message
    const userMessage = inputValue;
    setMessages([...messages, { type: 'user', content: userMessage }]);
    setInputValue('');
    
    // Call Gemini API with context about filtered classes
    setIsLoading(true);
    
    try {
      const response = await fetch(`${backendUrl}/api/gemini/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage,
          classes: filteredClasses,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }
      
      const data = await response.json();
      
      setMessages(prev => [...prev, { 
        type: 'ai', 
        content: data.response 
      }]);
    } catch (error) {
      console.error('Error calling Gemini:', error);
      setMessages(prev => [...prev, { 
        type: 'ai', 
        content: 'Sorry, I encountered an error processing your question. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box style={{ height: '90vh', display: 'flex', backgroundColor: '#f8f9fa' }}>
      {/* Left Column - Class Filters and Search */}
      <Box style={{ width: '40%', borderRight: '2px solid #dee2e6', display: 'flex', flexDirection: 'column' }}>
        <Paper p="lg" radius={0} style={{ borderBottom: '1px solid #dee2e6' }}>
          <Group mb="md">
            <IconFilter size={24} color="#CC0000" />
            <Title order={3} c="bu-red">
              Class Filters
            </Title>
          </Group>
          
          <Stack gap="md">
            <Select
              label="School"
              placeholder="Select school"
              value={selectedSchool}
              onChange={(value) => setSelectedSchool(value || '')}
              data={schools.map(s => ({ value: s, label: s }))}
              searchable
              clearable
            />
            
            <Select
              label="Department"
              placeholder="Select department"
              value={selectedDepartment}
              onChange={(value) => setSelectedDepartment(value || '')}
              data={departments.map(d => ({ value: d, label: d }))}
              searchable
              clearable
            />
            
            <TextInput
              label="Keyword Search"
              placeholder="Search class titles, descriptions..."
              value={keywordSearch}
              onChange={(e) => setKeywordSearch(e.target.value)}
            />
            
            <Group justify="space-between" align="center">
              <Badge size="lg" color="bu-red" variant="light">
                {filteredClasses.length} classes found
              </Badge>
              {(selectedSchool || selectedDepartment || keywordSearch) && (
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => {
                    setSelectedSchool('CAS');
                    setSelectedDepartment('CS');
                    setKeywordSearch('');
                  }}
                >
                  Reset to CAS CS
                </Button>
              )}
            </Group>
          </Stack>
        </Paper>

        {/* Class List */}
        <ScrollArea style={{ flex: 1 }} p="md">
          <Stack gap="sm">
            {loadingClasses ? (
              <Box style={{ textAlign: 'center', padding: '2rem' }}>
                <Loader color="bu-red" size="md" />
                <Text c="dimmed" size="sm" mt="md">
                  Loading classes...
                </Text>
              </Box>
            ) : filteredClasses.length === 0 ? (
              <Text c="dimmed" ta="center" mt="xl">
                {selectedSchool || selectedDepartment || keywordSearch 
                  ? 'No classes match your filters'
                  : 'Select school and department to view classes'}
              </Text>
            ) : (
              filteredClasses.map((cls) => {
                const code = `${cls.school}-${cls.department}-${cls.number}`;
                return (
                  <Paper
                    key={cls.id}
                    p="md"
                    withBorder
                    radius="md"
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    styles={{
                      root: {
                        '&:hover': {
                          backgroundColor: '#fff',
                          transform: 'translateX(4px)',
                          borderColor: '#CC0000',
                        },
                      },
                    }}
                  >
                    <Group justify="space-between" mb="xs">
                      <Text fw={600} c="bu-red" size="sm">
                        {code}
                      </Text>
                      <Badge size="xs" variant="light">
                        {cls.school} {cls.department}
                      </Badge>
                    </Group>
                    <Text size="sm" fw={500} mb="xs">
                      {cls.title}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {cls.description}
                    </Text>
                  </Paper>
                );
              })
            )}
          </Stack>
        </ScrollArea>
      </Box>

      {/* Right Column - Gemini Chat */}
      <Box style={{ width: '60%', display: 'flex', flexDirection: 'column' }}>
        <Paper p="lg" radius={0} style={{ borderBottom: '1px solid #dee2e6' }}>
          <Group mb="xs">
            <IconRobot size={24} color="#CC0000" />
            <Title order={3} c="bu-red">
              Ask Gemini
            </Title>
          </Group>
          <Text size="sm" c="dimmed">
            Ask questions about the {filteredClasses.length} filtered classes
          </Text>
        </Paper>

        {/* Chat Messages */}
        <ScrollArea style={{ flex: 1 }} p="lg">
          <Stack gap="md">
            {messages.length === 0 && (
              <Box style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <IconBook size={64} color="#dee2e6" stroke={1.5} style={{ margin: '0 auto 1rem' }} />
                <Text c="dimmed" size="lg" fw={500} mb="xs">
                  Start a conversation
                </Text>
                <Text c="dimmed" size="sm">
                  Ask about course recommendations, requirements, or anything else about the filtered classes
                </Text>
              </Box>
            )}
            
            {messages.map((message, index) => (
              <Box
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
                  gap: '0.5rem',
                }}
              >
                {message.type === 'ai' && (
                  <Box
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: '#CC0000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconRobot size={18} color="white" />
                  </Box>
                )}
                
                <Paper
                  bg={message.type === 'user' ? 'bu-red' : 'white'}
                  c={message.type === 'user' ? 'white' : 'black'}
                  p="md"
                  radius="lg"
                  shadow="sm"
                  style={{
                    maxWidth: '70%',
                    transition: 'all 0.2s ease',
                  }}
                  styles={{
                    root: {
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      },
                    },
                  }}
                >
                  {message.type === 'ai' ? (
                    <Box
                      style={{
                        fontSize: '0.875rem',
                        lineHeight: 1.6,
                      }}
                      className="markdown-content"
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </Box>
                  ) : (
                    <Text size="sm">{message.content}</Text>
                  )}
                </Paper>

                {message.type === 'user' && (
                  <Box
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: '#868e96',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconUser size={18} color="white" />
                  </Box>
                )}
              </Box>
            ))}

            {isLoading && (
              <Box style={{ display: 'flex', justifyContent: 'flex-start', gap: '0.5rem' }}>
                <Box
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: '#CC0000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <IconRobot size={18} color="white" />
                </Box>
                <Paper bg="white" p="md" radius="lg" shadow="sm">
                  <Group gap="xs">
                    <Loader color="bu-red" size="sm" />
                    <Text size="sm" c="dimmed">Thinking...</Text>
                  </Group>
                </Paper>
              </Box>
            )}
          </Stack>
        </ScrollArea>

        {/* Input Bar */}
        <Paper p="lg" radius={0} style={{ borderTop: '1px solid #dee2e6' }}>
          <Group wrap="nowrap">
            <TextInput
              placeholder="Ask about these classes..."
              style={{ flexGrow: 1 }}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isLoading}
              size="md"
            />
            <Button
              color="bu-red"
              size="md"
              onClick={handleSend}
              disabled={isLoading || !inputValue.trim()}
              style={{
                transition: 'all 0.2s ease',
              }}
              styles={{
                root: {
                  '&:hover:not(:disabled)': {
                    transform: 'scale(1.05)',
                  },
                },
              }}
            >
              <IconSend size="1.2rem" />
            </Button>
          </Group>
        </Paper>
      </Box>
    </Box>
  );
};

export default QuestionsPage;
