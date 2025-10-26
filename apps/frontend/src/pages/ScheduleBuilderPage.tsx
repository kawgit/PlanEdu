import React, { useState } from 'react';
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
  Paper
} from '@mantine/core';
import { 
  IconRobot, 
  IconCalendar, 
  IconRefresh, 
  IconCheck,
  IconClock, 
  IconUsers,
  IconAlertCircle,
  IconSparkles,
  IconArrowRight
} from '@tabler/icons-react';

interface BookmarkedClass {
  id: number;
  school: string;
  department: string;
  number: number;
  title: string;
  description?: string;
  time?: string;
  professor?: string;
}

interface GeneratedSchedule {
  semester: string;
  classes: BookmarkedClass[];
  totalCredits: number;
  conflicts: string[];
  recommendations: string[];
}

interface ScheduleBuilderPageProps {
  bookmarks?: BookmarkedClass[];
}

const ScheduleBuilderPage: React.FC<ScheduleBuilderPageProps> = ({ bookmarks = [] }) => {
  const [userPrompt, setUserPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSchedule, setGeneratedSchedule] = useState<GeneratedSchedule | null>(null);

  const handleGenerateSchedule = async () => {
    if (!userPrompt.trim()) return;
    
    setIsGenerating(true);
    
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Mock AI-generated schedule based on user prompt and bookmarked classes
    const mockSchedule: GeneratedSchedule = {
      semester: 'Fall 2024',
      classes: bookmarks.slice(0, 4), // Take first 4 classes
      totalCredits: 15,
      conflicts: [
        'Some classes may have overlapping time slots',
        'Consider checking class schedules for conflicts'
      ],
      recommendations: [
        'Great balance of courses from your bookmarks',
        'Consider adding a Hub course to fulfill general education requirements',
        'Check prerequisites for advanced courses',
        'Total credit load (15) is optimal for first semester'
      ]
    };
    
    setGeneratedSchedule(mockSchedule);
    setIsGenerating(false);
  };

  return (
    <Container size="lg" p="lg">
      <Title order={2} mb="xs" c="bu-red">
        AI Schedule Builder
      </Title>
      <Text c="dimmed" mb="xl" size="sm">
        Tell our AI what you want, and we'll build the perfect schedule from your bookmarked classes
      </Text>

      <Grid gutter="lg">
        {/* Left Column - Input and Controls */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="lg">
            {/* AI Prompt Input */}
            <Card shadow="md" p="lg" radius="md" withBorder>
              <Group mb="md">
                <IconRobot size={24} color="#CC0000" />
                <Title order={3}>Tell AI What You Want</Title>
              </Group>
              
              <Textarea
                placeholder="Describe your ideal schedule... (e.g., 'I want a balanced first semester with 15 credits, no Friday classes, and include my favorite psychology course')"
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
                disabled={!userPrompt.trim()}
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
          {isGenerating && (
            <Card shadow="md" p="xl" radius="md" withBorder ta="center">
              <Stack gap="md" align="center">
                <IconRobot size={48} color="#CC0000" />
                <Title order={3}>AI is Building Your Schedule</Title>
                <Text c="dimmed" size="sm">
                  Analyzing your preferences and bookmarked classes...
                </Text>
                <Progress value={75} color="bu-red" size="md" style={{ width: '100%' }} />
              </Stack>
            </Card>
          )}

          {generatedSchedule && !isGenerating && (
            <Stack gap="lg">
              {/* Generated Schedule Header */}
              <Card shadow="md" p="lg" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                  <Group>
                    <IconCalendar size={24} color="#CC0000" />
                    <Title order={3}>Your Generated Schedule</Title>
                  </Group>
                  <Badge color="green" variant="light">
                    {generatedSchedule.semester}
                  </Badge>
                </Group>
                
                <Group gap="md" mb="md">
                  <Badge color="blue" variant="light">
                    {generatedSchedule.totalCredits} Credits
                  </Badge>
                  <Badge color="grape" variant="light">
                    {generatedSchedule.classes.length} Classes
                  </Badge>
                </Group>

                <Button
                  variant="light"
                  color="bu-red"
                  size="sm"
                  leftSection={<IconRefresh size={16} />}
                  onClick={() => setGeneratedSchedule(null)}
                >
                  Generate New Schedule
                </Button>
              </Card>

              {/* Schedule Classes */}
              <Card shadow="sm" p="lg" radius="md" withBorder>
                <Title order={4} mb="md">Classes</Title>
                <Stack gap="sm">
                  {generatedSchedule.classes.map((course, index) => (
                    <Paper
                      key={index}
                      p="md"
                      radius="md"
                      style={{
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #e9ecef',
                      }}
                    >
                      <Group justify="space-between" mb="xs">
                        <Text fw={600} c="bu-red" size="sm">
                          {course.school}-{course.department}-{course.number}
                        </Text>
                        <Badge color="blue" variant="light" size="sm">
                          {course.school}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dark" mb="xs">
                        {course.title}
                      </Text>
                      <Group gap="md">
                        {course.time && (
                          <Group gap="xs">
                            <IconClock size={14} color="#868e96" />
                            <Text size="xs" c="dimmed">
                              {course.time}
                            </Text>
                          </Group>
                        )}
                        {course.professor && (
                          <Group gap="xs">
                            <IconUsers size={14} color="#868e96" />
                            <Text size="xs" c="dimmed">
                              {course.professor}
                            </Text>
                          </Group>
                        )}
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </Card>

              {/* Conflicts */}
              {generatedSchedule.conflicts.length > 0 && (
                <Card shadow="sm" p="lg" radius="md" withBorder>
                  <Group mb="md">
                    <IconAlertCircle size={20} color="orange" />
                    <Title order={4}>Schedule Conflicts</Title>
                  </Group>
                  <Stack gap="sm">
                    {generatedSchedule.conflicts.map((conflict, index) => (
                      <Alert
                        key={index}
                        color="orange"
                        variant="light"
                        icon={<IconAlertCircle size={16} />}
                      >
                        <Text size="sm">{conflict}</Text>
                      </Alert>
                    ))}
                  </Stack>
                </Card>
              )}

              {/* AI Recommendations */}
              <Card shadow="sm" p="lg" radius="md" withBorder>
                <Group mb="md">
                  <IconSparkles size={20} color="#CC0000" />
                  <Title order={4}>AI Recommendations</Title>
                </Group>
                <Stack gap="sm">
                  {generatedSchedule.recommendations.map((rec, index) => (
                    <Group key={index} gap="sm" align="flex-start">
                      <IconArrowRight size={16} color="#CC0000" style={{ marginTop: '2px' }} />
                      <Text size="sm">{rec}</Text>
                    </Group>
                  ))}
                </Stack>
              </Card>

              {/* Action Buttons */}
              <Group>
                <Button
                  color="bu-red"
                  size="md"
                  leftSection={<IconCheck size={18} />}
                  style={{ flex: 1 }}
                >
                  Accept This Schedule
                </Button>
                <Button
                  variant="outline"
                  color="bu-red"
                  size="md"
                  leftSection={<IconRefresh size={18} />}
                >
                  Regenerate
                </Button>
              </Group>
            </Stack>
          )}

          {!generatedSchedule && !isGenerating && (
            <Card shadow="sm" p="xl" radius="md" withBorder ta="center">
              <Stack gap="md" align="center">
                <IconCalendar size={48} color="#868e96" />
                <Title order={3} c="dimmed">
                  Ready to Build Your Schedule?
                </Title>
                <Text c="dimmed" size="sm">
                  Enter your preferences above and let our AI create the perfect schedule from your bookmarked classes.
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
