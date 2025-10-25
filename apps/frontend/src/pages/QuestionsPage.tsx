import React from 'react';
import { Container, Title, Text, Paper, TextInput, Button, Group, Box } from '@mantine/core';
// This line is correct. Run 'npm install @tabler/icons-react' and restart your editor if it's red.
import { IconSend } from '@tabler/icons-react';

const QuestionsPage: React.FC = () => {
  return (
    <Container style={{ display: 'flex', flexDirection: 'column', height: '80vh' }}>
      <Title order={2} mb="md">
        Course Questions
      </Title>
      <Text c="dimmed">
        This is where the ChatGPT-style interface will live. (Phase 1)
      </Text>

      {/* Chat history box */}
      <Paper 
        withBorder 
        p="md" 
        mt="md" 
        style={{ flexGrow: 1, overflowY: 'auto' }}
      >
        {/* Example chat bubble */}
        <Box style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Paper bg="bu-red" c="white" p="sm" radius="lg">
            "Recommend me a fun Hub class for creativity."
          </Paper>
        </Box>
      </Paper>

      {/* Input bar at the bottom */}
      {/* === THIS IS THE CORRECTED LINE === */}
      {/* 'noWrap' is now 'wrap="nowrap"' */}
      <Group mt="md" wrap="nowrap">
        <TextInput
          placeholder="Ask about a class..."
          style={{ flexGrow: 1 }}
        />
        <Button color="bu-red">
          <IconSend size="1rem" />
        </Button>
      </Group>
    </Container>
  );
};

export default QuestionsPage;
