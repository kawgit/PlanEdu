import React from 'react';
import { Container, Title, Text, Card, Badge, Group, Stack, ActionIcon, Button, Box, Alert } from '@mantine/core';
import { IconBookmarkOff, IconExternalLink, IconSparkles, IconInfoCircle } from '@tabler/icons-react';
import { TabName, BookmarkedCourse } from '../App';
import { isUserLoggedIn } from '../utils/auth';

interface BookmarksPageProps {
  setActiveTab?: (tab: TabName) => void;
  bookmarks?: BookmarkedCourse[];
  removeBookmark?: (courseId: number) => void;
}

const BookmarksPage: React.FC<BookmarksPageProps> = ({ setActiveTab, bookmarks = [], removeBookmark }) => {

  // Sort bookmarks by numeric course number ascending
  const sorted = [...bookmarks].sort((a, b) => {
    const aNum = typeof a.number === 'number' ? a.number : extractCourseNumber(String(a.number || ''));
    const bNum = typeof b.number === 'number' ? b.number : extractCourseNumber(String(b.number || ''));
    return aNum - bNum;
  });

  return (
    <Container size="md" p="lg">
      <Group justify="space-between" align="flex-start" mb="xl">
        <Box>
          <Title order={2} mb="xs" c="bu-red">
            Course Bookmarks
          </Title>
          <Text c="dimmed" size="sm">
            Your saved courses for planning your schedule
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
                {course.school}-{course.department}-{course.number}
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
                  onClick={() => removeBookmark && removeBookmark(course.id)}
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
                {course.description ? course.description.substring(0, 100) + '...' : 'No description available'}
              </Text>
            </Group>

            <Group gap="xs">
              <Badge color="blue" variant="light">
                {course.school} - {course.department}
              </Badge>
              <Badge color="green" variant="light">
                Bookmarked
              </Badge>
            </Group>
          </Card>
        ))}
      </Stack>

      {sorted.length === 0 && (
        <>
          {!isUserLoggedIn() && (
            <Alert icon={<IconInfoCircle size={16} />} title="Not Logged In" color="blue" mb="md">
              Please sign in to view and manage your bookmarked courses.
            </Alert>
          )}
          <Card shadow="sm" p="xl" radius="md" withBorder ta="center">
            <Text c="dimmed" size="lg">
              {isUserLoggedIn() 
                ? 'No bookmarked courses yet. Start swiping!' 
                : 'Sign in to bookmark courses and build your schedule'}
            </Text>
          </Card>
        </>
      )}
    </Container>
  );
};

export default BookmarksPage;

function extractCourseNumber(code: string) {
  const match = code.match(/(\d{2,4})/);
  if (!match) return 9999;
  return Number(match[0]);
}
