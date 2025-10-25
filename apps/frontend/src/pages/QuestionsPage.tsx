import React, { useState } from 'react';
import { Container, Title, Text, Paper, TextInput, Button, Group, Box, Stack, Loader } from '@mantine/core';
import { IconSend, IconRobot, IconUser } from '@tabler/icons-react';

interface Message {
  type: 'user' | 'ai';
  content: string;
}

const QuestionsPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { type: 'user', content: 'Recommend me a fun Hub class for creativity.' },
    { type: 'ai', content: 'I recommend CFA AR 101: Introduction to Studio Art! It fulfills the Creative Arts Hub and has great RMP ratings. Students love the hands-on approach and flexible project options.' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    // Add user message
    setMessages([...messages, { type: 'user', content: inputValue }]);
    setInputValue('');
    
    // Simulate AI response
    setIsLoading(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        type: 'ai', 
        content: 'This is a simulated response. In Phase 1, this will be connected to our AI backend to provide personalized course recommendations!' 
      }]);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <Container size="md" p="lg" style={{ display: 'flex', flexDirection: 'column', height: '85vh' }}>
      <Title order={2} mb="xs" c="bu-red">
        Course Questions
      </Title>
      <Text c="dimmed" mb="md" size="sm">
        Ask me anything about BU courses and planning
      </Text>

      {/* Chat history box */}
      <Paper 
        withBorder 
        shadow="sm"
        p="md" 
        style={{ 
          flexGrow: 1, 
          overflowY: 'auto',
          backgroundColor: '#f8f9fa',
        }}
      >
        <Stack gap="md">
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
                <Text size="sm">{message.content}</Text>
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

          {/* Loading indicator */}
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
      </Paper>

      {/* Input bar at the bottom */}
      <Group mt="md" wrap="nowrap">
        <TextInput
          placeholder="Ask about a class..."
          style={{ flexGrow: 1 }}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          disabled={isLoading}
        />
        <Button
          color="bu-red"
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
          <IconSend size="1rem" />
        </Button>
      </Group>
    </Container>
  );
};

export default QuestionsPage;
