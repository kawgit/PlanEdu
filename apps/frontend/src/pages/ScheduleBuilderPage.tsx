import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Title, 
  Text, 
  Card, 
  Stack, 
  Button, 
  Group, 
  Badge, 
  Textarea, 
  Grid, 
  Alert,
  Progress,
  Paper,
  Select,
  Loader,
  Table,
  Divider
} from '@mantine/core';
import { 
  IconRobot, 
  IconCalendar, 
  IconRefresh, 
  IconCheck,
  IconClock, 
  IconAlertCircle,
  IconSparkles,
  IconArrowRight,
  IconBook,
  IconSchool
} from '@tabler/icons-react';
import { getUserGoogleId } from '../utils/auth';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface BookmarkedClass {
  id: number;
  school: string;
  department: string;
  number: number;
  title: string;
  description?: string;
}

interface ScheduleCourse {
  sectionId: string;
  courseId: string;
  school: string;
  department: string;
  number: number;
  title: string;
  semester: string;
  days: string[];
  startTime: number;
  endTime: number;
  instructor: string;
  professorRating: number;
}

interface GeneratedSchedule {
  success: boolean;
  status: string;
  schedule: Record<string, ScheduleCourse[]>;
  allCourses: ScheduleCourse[];
  objectiveScores?: Record<string, number>;
  totalCourses: number;
  parsedConstraints: any[];
  message: string;
}

/**
 * Convert minutes since midnight to HH:MM format
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

const ScheduleBuilderPage: React.FC = () => {
  const [userPrompt, setUserPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSchedule, setGeneratedSchedule] = useState<GeneratedSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkedClass[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(true);
  const [maxCoursesPerSemester, setMaxCoursesPerSemester] = useState<string>('4');
  const [selectedSemester, setSelectedSemester] = useState<string>('all');

  // Fetch user's bookmarked courses on mount
  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        const googleId = getUserGoogleId();
        if (!googleId) {
          setError('Please log in to use the schedule builder');
          setLoadingBookmarks(false);
          return;
        }

        const response = await fetch(`${BACKEND_URL}/api/user/bookmarks?googleId=${googleId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch bookmarks');
        }
        
        const data = await response.json();
        setBookmarks(data);
        setLoadingBookmarks(false);
      } catch (err: any) {
        console.error('Error fetching bookmarks:', err);
        setError(err.message || 'Failed to load bookmarks');
        setLoadingBookmarks(false);
      }
    };

    fetchBookmarks();
  }, []);

  const handleGenerateSchedule = async () => {
    setIsGenerating(true);
    setError(null);
    setGeneratedSchedule(null);
    
    try {
      const googleId = getUserGoogleId();
      if (!googleId) {
        throw new Error('Please log in to generate a schedule');
      }

      console.log('Generating schedule...');
      console.log('User prompt:', userPrompt);
      console.log('Max courses per semester:', maxCoursesPerSemester);

      const response = await fetch(`${BACKEND_URL}/api/schedule/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          googleId,
          feedback: userPrompt.trim() || undefined,
          semester: selectedSemester === 'all' ? undefined : selectedSemester,
          maxCoursesPerSemester: parseInt(maxCoursesPerSemester),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || 'Failed to generate schedule');
      }

      const result = await response.json();
      console.log('Schedule result:', result);

      if (!result.success) {
        setError(result.message || 'Failed to generate a feasible schedule');
        if (result.suggestions) {
          setError(`${result.message}\n\nSuggestions:\n${result.suggestions.join('\n')}`);
        }
      } else {
        setGeneratedSchedule(result);
      }
    } catch (err: any) {
      console.error('Error generating schedule:', err);
      setError(err.message || 'An error occurred while generating the schedule');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    setGeneratedSchedule(null);
    setError(null);
  };

  if (loadingBookmarks) {
    return (
      <Container size="lg" p="lg">
        <Stack align="center" gap="md" style={{ paddingTop: '50px' }}>
          <Loader size="lg" color="bu-red" />
          <Text c="dimmed">Loading your bookmarks...</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl" p="lg">
      <Title order={2} mb="xs" c="bu-red">
        <Group gap="xs">
          <IconCalendar size={32} />
          AI Schedule Builder
        </Group>
      </Title>
      <Text c="dimmed" mb="xl" size="sm">
        Tell our AI what you want, and we'll build the perfect schedule. 
        {bookmarks.length > 0 ? ` We'll prioritize your ${bookmarks.length} bookmarked classes.` : ' Bookmark courses to give them priority.'}
      </Text>

      <Grid gutter="lg">
        {/* Left Column - Input and Controls */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="lg">
            {/* Bookmarks Summary */}
            <Card shadow="md" p="lg" radius="md" withBorder>
              <Group mb="md">
                <IconBook size={24} color="#CC0000" />
                <Title order={4}>Your Bookmarked Courses</Title>
              </Group>
              
              {bookmarks.length === 0 ? (
                <Alert color="blue" icon={<IconAlertCircle size={16} />}>
                  No bookmarked courses yet. You can still generate a schedule from all available courses, or visit the Class Swiper to bookmark preferred courses!
                </Alert>
              ) : (
                <>
                  <Text size="sm" c="dimmed" mb="sm">
                    {bookmarks.length} course{bookmarks.length !== 1 ? 's' : ''} ready to schedule
                  </Text>
                  <Paper p="xs" withBorder style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    <Stack gap="xs">
                      {bookmarks.slice(0, 5).map((course) => (
                        <Text key={course.id} size="xs">
                          <strong>{course.school}-{course.department}-{course.number}</strong>: {course.title}
                        </Text>
                      ))}
                      {bookmarks.length > 5 && (
                        <Text size="xs" c="dimmed" fs="italic">
                          ...and {bookmarks.length - 5} more
                        </Text>
                      )}
                    </Stack>
                  </Paper>
                </>
              )}
            </Card>

            {/* Settings */}
            <Card shadow="md" p="lg" radius="md" withBorder>
              <Title order={4} mb="md">Schedule Settings</Title>
              
              <Stack gap="md">
                <Select
                  label="Semester"
                  description="Choose a specific semester or plan for all"
                  value={selectedSemester}
                  onChange={(value) => setSelectedSemester(value || 'all')}
                  data={[
                    { value: 'all', label: 'All Semesters' },
                    { value: 'Fall2025', label: 'Fall 2025' },
                    { value: 'Spring2026', label: 'Spring 2026' },
                  ]}
                />

                <Select
                  label="Max Courses Per Semester"
                  description="Maximum number of courses per semester"
                  value={maxCoursesPerSemester}
                  onChange={(value) => setMaxCoursesPerSemester(value || '4')}
                  data={[
                    { value: '3', label: '3 courses' },
                    { value: '4', label: '4 courses' },
                    { value: '5', label: '5 courses' },
                    { value: '6', label: '6 courses' },
                  ]}
                />
              </Stack>
            </Card>

            {/* AI Prompt Input */}
            <Card shadow="md" p="lg" radius="md" withBorder>
              <Group mb="md">
                <IconRobot size={24} color="#CC0000" />
                <Title order={4}>Tell AI Your Preferences</Title>
              </Group>
              
              <Textarea
                placeholder="Describe your ideal schedule... (e.g., 'I want no Friday classes and prefer classes after 10 AM')"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                minRows={4}
                maxRows={6}
                mb="md"
              />
              
              <Button
                color="bu-red"
                size="md"
                fullWidth
                onClick={handleGenerateSchedule}
                loading={isGenerating}
                leftSection={<IconSparkles size={18} />}
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
                {isGenerating ? 'AI is thinking...' : 'Generate My Schedule'}
              </Button>
            </Card>
          </Stack>
        </Grid.Col>

        {/* Right Column - Generated Schedule */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          {/* Loading State */}
          {isGenerating && (
            <Card shadow="md" p="xl" radius="md" withBorder ta="center">
              <Stack gap="md" align="center">
                <IconRobot size={48} color="#CC0000" />
                <Title order={3}>AI is Building Your Schedule</Title>
                <Text c="dimmed" size="sm">
                  Analyzing {bookmarks.length} courses and your preferences...
                </Text>
                <Progress value={undefined} color="bu-red" size="md" style={{ width: '100%' }} />
                <Text size="xs" c="dimmed">
                  This may take a few seconds
                </Text>
              </Stack>
            </Card>
          )}

          {/* Error State */}
          {error && !isGenerating && (
            <Alert color="red" icon={<IconAlertCircle size={20} />} title="Error">
              <Text size="sm" style={{ whiteSpace: 'pre-line' }}>{error}</Text>
              {error.includes('solver') && (
                <Text size="xs" c="dimmed" mt="md">
                  Hint: Make sure the solver service is running at http://localhost:8000
                </Text>
              )}
            </Alert>
          )}

          {/* Generated Schedule */}
          {generatedSchedule && !isGenerating && (
            <Stack gap="lg">
              {/* Schedule Header */}
              <Card shadow="md" p="lg" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                  <Group>
                    <IconCalendar size={24} color="#CC0000" />
                    <Title order={3}>Your Generated Schedule</Title>
                  </Group>
                  <Badge color="green" variant="light" size="lg">
                    {generatedSchedule.status}
                  </Badge>
                </Group>
                
                <Group gap="md" mb="md">
                  <Badge color="blue" variant="light">
                    {generatedSchedule.totalCourses} Classes
                  </Badge>
                  {generatedSchedule.parsedConstraints.length > 0 && (
                    <Badge color="purple" variant="light">
                      {generatedSchedule.parsedConstraints.length} Constraints Applied
                    </Badge>
                  )}
                </Group>

                <Text size="sm" c="dimmed" mb="md">
                  {generatedSchedule.message}
                </Text>

                <Button
                  variant="light"
                  color="bu-red"
                  size="sm"
                  leftSection={<IconRefresh size={16} />}
                  onClick={handleRegenerate}
                >
                  Generate New Schedule
                </Button>
              </Card>

              {/* Schedule by Semester */}
              {Object.keys(generatedSchedule.schedule).length > 0 ? (
                Object.entries(generatedSchedule.schedule).map(([semester, courses]) => (
                  <Card key={semester} shadow="sm" p="lg" radius="md" withBorder>
                    <Group mb="md">
                      <IconSchool size={20} color="#CC0000" />
                      <Title order={4}>{semester}</Title>
                      <Badge color="blue" variant="light">
                        {courses.length} courses
                      </Badge>
                    </Group>

                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Course</Table.Th>
                          <Table.Th>Days</Table.Th>
                          <Table.Th>Time</Table.Th>
                          <Table.Th>Rating</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {courses.map((course, idx) => (
                          <Table.Tr key={idx}>
                            <Table.Td>
                              <Text size="sm" fw={600}>
                                {course.school}-{course.department}-{course.number}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {course.title}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs">
                                {course.days.join(', ')}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Group gap="xs">
                                <IconClock size={14} color="#868e96" />
                                <Text size="xs">
                                  {minutesToTime(course.startTime)} - {minutesToTime(course.endTime)}
                                </Text>
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Badge color="yellow" variant="light" size="sm">
                                ⭐ {course.professorRating.toFixed(1)}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Card>
                ))
              ) : (
                <Alert color="blue" icon={<IconAlertCircle size={16} />}>
                  No courses scheduled. Try adjusting your constraints or bookmarking more courses.
                </Alert>
              )}

              {/* Parsed Constraints */}
              {generatedSchedule.parsedConstraints.length > 0 && (
                <Card shadow="sm" p="lg" radius="md" withBorder>
                  <Group mb="md">
                    <IconSparkles size={20} color="#CC0000" />
                    <Title order={4}>Applied Constraints</Title>
                  </Group>
                  <Stack gap="sm">
                    {generatedSchedule.parsedConstraints.map((constraint, index) => (
                      <Group key={index} gap="sm" align="flex-start">
                        <IconArrowRight size={16} color="#CC0000" style={{ marginTop: '2px' }} />
                        <Text size="sm">
                          <strong>{constraint.kind}</strong> ({constraint.mode})
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </Card>
              )}

              {/* Objective Scores */}
              {generatedSchedule.objectiveScores && (
                <Card shadow="sm" p="lg" radius="md" withBorder>
                  <Title order={4} mb="md">Optimization Scores</Title>
                  <Stack gap="xs">
                    {Object.entries(generatedSchedule.objectiveScores).map(([tier, score]) => (
                      <Group key={tier} justify="space-between">
                        <Text size="sm" tt="capitalize">{tier}</Text>
                        <Badge color="grape" variant="light">
                          {score}
                        </Badge>
                      </Group>
                    ))}
                  </Stack>
                </Card>
              )}

              {/* Action Buttons */}
              <Group>
                <Button
                  color="bu-red"
                  size="md"
                  leftSection={<IconCheck size={18} />}
                  style={{ flex: 1 }}
                  onClick={() => alert('Schedule saved! (Feature coming soon)')}
                >
                  Save This Schedule
                </Button>
                <Button
                  variant="outline"
                  color="bu-red"
                  size="md"
                  leftSection={<IconRefresh size={18} />}
                  onClick={handleRegenerate}
                >
                  Try Again
                </Button>
              </Group>
            </Stack>
          )}

          {/* Initial State */}
          {!generatedSchedule && !isGenerating && !error && (
            <Card shadow="sm" p="xl" radius="md" withBorder ta="center">
              <Stack gap="md" align="center">
                <IconCalendar size={48} color="#868e96" />
                <Title order={3} c="dimmed">
                  Ready to Build Your Schedule?
                </Title>
                <Text c="dimmed" size="sm">
                  {bookmarks.length > 0 
                    ? `Enter your preferences above and let our AI create the perfect schedule, prioritizing your ${bookmarks.length} bookmarked classes.`
                    : 'Enter your preferences above and our AI will create a schedule from all available courses. Bookmark courses to give them priority!'
                  }
                </Text>
              </Stack>
            </Card>
          )}
        </Grid.Col>
      </Grid>
    </Container>
  );
};

export default ScheduleBuilderPage;
