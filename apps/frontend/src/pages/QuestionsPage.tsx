import React, { useState, useEffect } from 'react';
import { Title, Text, Paper, TextInput, Button, Group, Box, Stack, Loader, Select, ScrollArea, Badge, ActionIcon } from '@mantine/core';
import { IconSend, IconRobot, IconUser, IconFilter, IconBook, IconBookmark, IconBookmarkFilled, IconTrash } from '@tabler/icons-react';
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

interface QuestionsPageProps {
  addBookmark?: (course: any) => void;
  removeBookmark?: (classId: number) => void;
  bookmarks?: Array<any>;
}

const QuestionsPage: React.FC<QuestionsPageProps> = ({ addBookmark, removeBookmark, bookmarks = [] }) => {
  // Load messages from localStorage on mount
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('questionsPageMessages');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load messages from localStorage:', e);
      return [];
    }
  });
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

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('questionsPageMessages', JSON.stringify(messages));
    } catch (e) {
      console.error('Failed to save messages to localStorage:', e);
    }
  }, [messages]);

  // Helper function to check if a class is bookmarked
  const isBookmarked = (classId: number) => {
    return bookmarks.some(bookmark => bookmark.id === classId);
  };

  // Handle bookmark toggle
  const handleBookmarkToggle = (course: ClassOffering) => {
    const bookmarked = isBookmarked(course.id);
    
    if (bookmarked && removeBookmark) {
      // Remove bookmark if already bookmarked
      removeBookmark(course.id);
    } else if (!bookmarked && addBookmark) {
      // Add bookmark if not bookmarked
      addBookmark(course);
    }
  };

  // Clear conversation history
  const handleClearConversation = () => {
    if (messages.length > 0 && window.confirm('Are you sure you want to clear the conversation history?')) {
      setMessages([]);
      localStorage.removeItem('questionsPageMessages');
    }
  };

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
    
    // Add empty AI message that will be updated with streaming content
    const aiMessageIndex = messages.length + 1;
    setMessages(prev => [...prev, { type: 'ai', content: '' }]);
    
    // Call Gemini API with streaming
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

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                setIsLoading(false);
                break;
              }
              
              try {
                const parsed = JSON.parse(data);
                accumulatedText += parsed.text;
                
                // Update the AI message with accumulated text
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[aiMessageIndex] = {
                    type: 'ai',
                    content: accumulatedText
                  };
                  return newMessages;
                });
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error calling Gemini:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[aiMessageIndex] = {
          type: 'ai',
          content: 'Sorry, I encountered an error processing your question. Please try again.'
        };
        return newMessages;
      });
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
                      <Group gap="xs">
                        <Badge size="xs" variant="light">
                          {cls.school} {cls.department}
                        </Badge>
                        {addBookmark && (
                          <ActionIcon
                            variant="subtle"
                            color={isBookmarked(cls.id) ? "red" : "gray"}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBookmarkToggle(cls);
                            }}
                            style={{
                              transition: 'all 0.2s ease',
                            }}
                            styles={{
                              root: {
                                '&:hover': {
                                  transform: 'scale(1.15)',
                                  backgroundColor: isBookmarked(cls.id) 
                                    ? 'rgba(204, 0, 0, 0.1)' 
                                    : 'rgba(204, 0, 0, 0.05)',
                                },
                              },
                            }}
                          >
                            {isBookmarked(cls.id) ? (
                              <IconBookmarkFilled size={16} />
                            ) : (
                              <IconBookmark size={16} />
                            )}
                          </ActionIcon>
                        )}
                      </Group>
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
          <Group justify="space-between" align="flex-start" mb="xs">
            <Group>
              <IconRobot size={24} color="#CC0000" />
              <Title order={3} c="bu-red">
                Ask Gemini
              </Title>
            </Group>
            <Group gap="xs">
              {bookmarks.length > 0 && (
                <Badge color="bu-red" variant="light" size="sm">
                  {bookmarks.length} bookmarked
                </Badge>
              )}
              {messages.length > 0 && (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  onClick={handleClearConversation}
                  title="Clear conversation"
                  style={{
                    transition: 'all 0.2s ease',
                  }}
                  styles={{
                    root: {
                      '&:hover': {
                        transform: 'scale(1.1)',
                        backgroundColor: 'rgba(204, 0, 0, 0.1)',
                        color: '#CC0000',
                      },
                    },
                  }}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              )}
            </Group>
          </Group>
          <Text size="sm" c="dimmed">
            Ask questions about the {filteredClasses.length} filtered classes
            {addBookmark && (
              <Text component="span" size="xs" c="dimmed" ml="xs">
                • Click the bookmark icon on any class to save it
              </Text>
            )}
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
                      className="ai-markdown-content"
                      style={{
                        fontSize: '0.875rem',
                        lineHeight: 1.6,
                      }}
                    >
                      <style>{`
                        .ai-markdown-content p {
                          margin: 0 0 0.75em 0;
                        }
                        .ai-markdown-content p:last-child {
                          margin-bottom: 0;
                        }
                        .ai-markdown-content ul,
                        .ai-markdown-content ol {
                          margin: 0.5em 0;
                          padding-left: 1.5em;
                        }
                        .ai-markdown-content li {
                          margin: 0.25em 0;
                        }
                        .ai-markdown-content h1,
                        .ai-markdown-content h2,
                        .ai-markdown-content h3,
                        .ai-markdown-content h4,
                        .ai-markdown-content h5,
                        .ai-markdown-content h6 {
                          margin: 1em 0 0.5em 0;
                          font-weight: 600;
                        }
                        .ai-markdown-content h1:first-child,
                        .ai-markdown-content h2:first-child,
                        .ai-markdown-content h3:first-child,
                        .ai-markdown-content h4:first-child,
                        .ai-markdown-content h5:first-child,
                        .ai-markdown-content h6:first-child {
                          margin-top: 0;
                        }
                        .ai-markdown-content code {
                          background-color: #f5f5f5;
                          padding: 0.125em 0.25em;
                          border-radius: 3px;
                          font-size: 0.9em;
                        }
                        .ai-markdown-content pre {
                          background-color: #f5f5f5;
                          padding: 0.75em;
                          border-radius: 6px;
                          overflow: auto;
                          margin: 0.5em 0;
                        }
                        .ai-markdown-content pre code {
                          background-color: transparent;
                          padding: 0;
                        }
                        .ai-markdown-content blockquote {
                          border-left: 3px solid #CC0000;
                          padding-left: 1em;
                          margin: 0.5em 0;
                          color: #666;
                        }
                      `}</style>
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
