import React from 'react';
import { Container, Title, Text, Card, Badge } from '@mantine/core';

const BookmarksPage: React.FC = () => {
  return (
    <Container>
      <Title order={2} mb="md">
        Class Bookmarks
      </Title>
      <Text c="dimmed" mb="xl">
        This tab will display all the user's favorited classes. (Phase 1)
      </Text>

      {/* Example of a class widget */}
      <Card shadow="sm" p="lg" radius="md" withBorder>
        
        {/* === THIS IS THE CORRECTED LINE === */}
        <Title order={4} c="bu-red">CS 111</Title>
        
        <Text fw={500} mb="xs">Intro to Computer Science</Text>
        
        <Text size="sm" c="dimmed">Prereqs: None</Text>
        
        <Badge color="green" variant="light" mt="md">
          RMP Rating: 4.5/5
        </Badge>
      </Card>
    </Container>
  );
};

export default BookmarksPage;
