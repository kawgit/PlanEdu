import React from 'react';
import { Container, Title, Text, Card, Badge, Group, Stack, ActionIcon } from '@mantine/core';
import { IconBookmarkOff, IconExternalLink } from '@tabler/icons-react';

const BookmarksPage: React.FC = () => {
  // Example bookmarked classes (this would come from state/API in the real app)
  const bookmarkedClasses = [
    {
      code: 'CS 111',
      title: 'Intro to Computer Science',
      prereqs: 'None',
      rating: 4.5,
      credits: 4,
    },
    {
      code: 'WR 100',
      title: 'Writing Seminar',
      prereqs: 'None',
      rating: 4.2,
      credits: 4,
    },
    {
      code: 'MA 123',
      title: 'Calculus I',
      prereqs: 'High School Math',
      rating: 3.8,
      credits: 4,
    },
  ];

  return (
    <Container size="md" p="lg">
      <Title order={2} mb="xs" c="bu-red">
        Class Bookmarks
      </Title>
      <Text c="dimmed" mb="xl" size="sm">
        Your saved classes for planning your schedule
      </Text>

      <Stack gap="md">
        {bookmarkedClasses.map((course, index) => (
          <Card
            key={index}
            shadow="md"
            p="lg"
            radius="md"
            withBorder
            style={{
              transition: 'all 0.3s ease',
              cursor: 'pointer',
            }}
            styles={{
              root: {
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                },
              },
            }}
          >
            <Group justify="space-between" mb="xs">
              <Title order={4} c="bu-red">
                {course.code}
              </Title>
              <Group gap="xs">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  style={{
                    transition: 'all 0.2s ease',
                  }}
                  styles={{
                    root: {
                      '&:hover': {
                        transform: 'scale(1.15)',
                        backgroundColor: 'rgba(204, 0, 0, 0.1)',
                      },
                    },
                  }}
                >
                  <IconExternalLink size={18} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  style={{
                    transition: 'all 0.2s ease',
                  }}
                  styles={{
                    root: {
                      '&:hover': {
                        transform: 'scale(1.15)',
                        backgroundColor: 'rgba(204, 0, 0, 0.1)',
                      },
                    },
                  }}
                >
                  <IconBookmarkOff size={18} />
                </ActionIcon>
              </Group>
            </Group>

            <Text fw={600} mb="xs" size="lg">
              {course.title}
            </Text>

            <Group gap="md" mb="md">
              <Text size="sm" c="dimmed">
                Prereqs: {course.prereqs}
              </Text>
              <Text size="sm" c="dimmed">
                • {course.credits} credits
              </Text>
            </Group>

            <Group gap="xs">
              <Badge color="green" variant="light">
                RMP Rating: {course.rating}/5
              </Badge>
              <Badge color="blue" variant="light">
                Available
              </Badge>
            </Group>
          </Card>
        ))}
      </Stack>

      {bookmarkedClasses.length === 0 && (
        <Card shadow="sm" p="xl" radius="md" withBorder ta="center">
          <Text c="dimmed" size="lg">
            No bookmarked classes yet. Start swiping!
          </Text>
        </Card>
      )}
    </Container>
  );
};

export default BookmarksPage;
