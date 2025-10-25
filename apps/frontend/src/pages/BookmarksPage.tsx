import React from 'react';
import { Container, Title, Text, Card, Badge, Group, Stack, ActionIcon, Button, Box } from '@mantine/core';
import { IconBookmarkOff, IconExternalLink, IconSparkles } from '@tabler/icons-react';
import { TabName } from '../App';

interface BookmarksPageProps {
  setActiveTab?: (tab: TabName) => void;
  bookmarks?: Array<any>;
  removeBookmark?: (code: string) => void;
}

const BookmarksPage: React.FC<BookmarksPageProps> = ({ setActiveTab, bookmarks = [], removeBookmark }) => {

  // Sort bookmarks by numeric class number ascending
  const sorted = [...bookmarks].sort((a, b) => extractClassNumber(a.code) - extractClassNumber(b.code));

  return (
    <Container size="md" p="lg">
      <Group justify="space-between" align="flex-start" mb="xl">
        <Box>
          <Title order={2} mb="xs" c="bu-red">
            Class Bookmarks
          </Title>
          <Text c="dimmed" size="sm">
            Your saved classes for planning your schedule
          </Text>
        </Box>
  {setActiveTab && sorted.length > 0 && (
          <Button
            color="bu-red"
            size="md"
            leftSection={<IconSparkles size={18} />}
            onClick={() => setActiveTab('schedule-builder')}
            style={{ transition: 'all 0.3s ease' }}
            styles={{
              root: {
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 16px rgba(204, 0, 0, 0.3)',
                },
              },
            }}
          >
            Build Schedule with AI
          </Button>
        )}
      </Group>

      <Stack gap="md">
  {sorted.map((course, index) => (
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
                  <IconBookmarkOff size={18} onClick={() => removeBookmark && removeBookmark(course.code)} />
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

      {sorted.length === 0 && (
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

function extractClassNumber(code: string) {
  const match = code.match(/(\d{2,4})/);
  if (!match) return 9999;
  return Number(match[0]);
}
