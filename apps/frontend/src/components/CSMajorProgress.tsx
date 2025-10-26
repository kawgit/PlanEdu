import React, { useEffect, useState } from 'react';
import { Card, Title, Text, Stack, Progress, Group, Badge, Box, Accordion, List, Loader, Alert } from '@mantine/core';
import { IconInfoCircle, IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';
import { isUserLoggedIn } from '../utils/auth';

interface GroupProgress {
  required: number;
  completed: number;
  courses: string[];
  completedCourses: string[];
  missingCourses: string[];
}

interface CSMajorCompletionResult {
  percentage: number;
  totalRequired: number;
  totalCompleted: number;
  groupA: GroupProgress;
  groupB: GroupProgress;
  groupC: GroupProgress;
  groupD: GroupProgress;
  calculusCompleted: boolean;
  validCourses: any[];
  invalidCourses: Array<{ course: any; reason: string }>;
  missingRequirements: string[];
}

interface CSMajorProgressProps {
  refreshTrigger?: number;
}

const CSMajorProgress: React.FC<CSMajorProgressProps> = ({ refreshTrigger }) => {
  const [progress, setProgress] = useState<CSMajorCompletionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isUserLoggedIn()) {
      setLoading(false);
      return;
    }

    loadProgress();
  }, [refreshTrigger]);

  const loadProgress = async () => {
    try {
      setLoading(true);
      setError(null);

      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const googleId = user.id;

      if (!googleId) {
        throw new Error('User not found');
      }

      const response = await fetch(
        `http://localhost:3001/api/user/cs-major-completion?googleId=${googleId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch CS major completion data');
      }

      const data = await response.json();
      setProgress(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load CS major progress');
      console.error('Error loading CS major progress:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderGroupProgress = (
    groupName: string,
    group: GroupProgress,
    description: string
  ) => {
    const percentage = group.required > 0 
      ? Math.round((Math.min(group.completed, group.required) / group.required) * 100)
      : 0;
    const isComplete = group.completed >= group.required;

    return (
      <Box>
        <Group justify="space-between" mb="xs">
          <Text fw={600} size="sm">
            {groupName}
          </Text>
          <Badge color={isComplete ? 'green' : 'blue'} variant="light">
            {Math.min(group.completed, group.required)} / {group.required}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed" mb="xs">
          {description}
        </Text>
        <Progress 
          value={percentage} 
          color={isComplete ? 'green' : 'bu-red'} 
          size="md" 
          mb="sm"
          animated={!isComplete}
        />
        {group.completedCourses.length > 0 && (
          <Box mb="xs">
            <Text size="xs" fw={600} c="green" mb={4}>
              Completed:
            </Text>
            <Group gap="xs">
              {group.completedCourses.map((course, idx) => (
                <Badge key={idx} color="green" variant="light" size="sm">
                  <Group gap={4}>
                    <IconCheck size={12} />
                    {course}
                  </Group>
                </Badge>
              ))}
            </Group>
          </Box>
        )}
        {group.missingCourses.length > 0 && !isComplete && (
          <Box>
            <Text size="xs" fw={600} c="dimmed" mb={4}>
              Still needed:
            </Text>
            <Group gap="xs">
              {group.missingCourses.map((course, idx) => (
                <Badge key={idx} color="gray" variant="outline" size="sm">
                  {course}
                </Badge>
              ))}
            </Group>
          </Box>
        )}
      </Box>
    );
  };

  if (!isUserLoggedIn()) {
    return null;
  }

  if (loading) {
    return (
      <Card shadow="md" p="lg" radius="md" withBorder>
        <Group>
          <Loader size="sm" />
          <Text c="dimmed">Loading CS major progress...</Text>
        </Group>
      </Card>
    );
  }

  if (error) {
    return (
      <Card shadow="md" p="lg" radius="md" withBorder>
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          {error}
        </Alert>
      </Card>
    );
  }

  if (!progress) {
    return null;
  }

  const progressColor = 
    progress.percentage >= 100 ? 'green' :
    progress.percentage >= 75 ? 'blue' :
    progress.percentage >= 50 ? 'yellow' :
    'red';

  return (
    <Card shadow="md" p="lg" radius="md" withBorder mb="xl">
      <Title order={4} mb="md">CS Major Progress</Title>
      
      {/* Overall Progress */}
      <Box mb="xl">
        <Group justify="space-between" mb="xs">
          <Text size="sm" c="dimmed">Overall Completion</Text>
          <Text size="xl" fw={700} c={progressColor}>
            {progress.percentage}%
          </Text>
        </Group>
        <Progress 
          value={progress.percentage} 
          color={progressColor} 
          size="xl" 
          mb="xs"
          animated={progress.percentage < 100}
        />
        <Text size="sm" c="dimmed">
          {progress.totalCompleted} of {progress.totalRequired} courses completed
        </Text>
      </Box>

      {/* Calculus Requirement */}
      <Box mb="xl">
        <Group gap="xs" mb="xs">
          {progress.calculusCompleted ? (
            <IconCheck size={20} color="green" />
          ) : (
            <IconX size={20} color="red" />
          )}
          <Text fw={600} size="sm">
            Calculus 1 Proficiency
          </Text>
          <Badge color={progress.calculusCompleted ? 'green' : 'red'} variant="light">
            {progress.calculusCompleted ? 'Completed' : 'Required'}
          </Badge>
        </Group>
        {!progress.calculusCompleted && (
          <Text size="xs" c="dimmed">
            Complete MA 123 or equivalent
          </Text>
        )}
      </Box>

      {/* Group Progress Details */}
      <Accordion variant="separated" mb="xl">
        <Accordion.Item value="groupA">
          <Accordion.Control>
            <Group justify="space-between">
              <Text fw={600}>Group A: Foundations</Text>
              <Badge 
                color={progress.groupA.completed >= progress.groupA.required ? 'green' : 'blue'}
                variant="light"
              >
                {progress.groupA.completed} / {progress.groupA.required}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            {renderGroupProgress(
              'Group A: Foundations',
              progress.groupA,
              'Take all 5 courses'
            )}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="groupB">
          <Accordion.Control>
            <Group justify="space-between">
              <Text fw={600}>Group B: Technical Preparation</Text>
              <Badge 
                color={progress.groupB.completed >= progress.groupB.required ? 'green' : 'blue'}
                variant="light"
              >
                {progress.groupB.completed} / {progress.groupB.required}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            {renderGroupProgress(
              'Group B: Technical Preparation',
              progress.groupB,
              'Take at least 2 of 3 courses'
            )}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="groupC">
          <Accordion.Control>
            <Group justify="space-between">
              <Text fw={600}>Group C: Essential CS Paradigms</Text>
              <Badge 
                color={progress.groupC.completed >= progress.groupC.required ? 'green' : 'blue'}
                variant="light"
              >
                {progress.groupC.completed} / {progress.groupC.required}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            {renderGroupProgress(
              'Group C: Essential CS Paradigms',
              progress.groupC,
              'Take at least 2 of 3 courses (special rules apply for CS350/CS351)'
            )}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="groupD">
          <Accordion.Control>
            <Group justify="space-between">
              <Text fw={600}>Group D: Advanced Topics</Text>
              <Badge color="blue" variant="light">
                {progress.groupD.completed} completed
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Text size="sm" mb="md" c="dimmed">
              CS 300+ level courses (excluding CS 320, 330, 332, 350). 
              Total of 15 courses needed across all groups.
            </Text>
            {progress.groupD.completedCourses.length > 0 ? (
              <Box>
                <Text size="xs" fw={600} c="green" mb={4}>
                  Completed Group D Courses:
                </Text>
                <Group gap="xs">
                  {progress.groupD.completedCourses.map((course, idx) => (
                    <Badge key={idx} color="green" variant="light" size="sm">
                      <Group gap={4}>
                        <IconCheck size={12} />
                        {course}
                      </Group>
                    </Badge>
                  ))}
                </Group>
              </Box>
            ) : (
              <Text size="sm" c="dimmed" fs="italic">
                No Group D courses completed yet
              </Text>
            )}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {/* Missing Requirements */}
      {progress.missingRequirements.length > 0 && (
        <Box>
          <Group gap="xs" mb="sm">
            <IconInfoCircle size={20} color="#CC0000" />
            <Text fw={600} size="sm">Missing Requirements</Text>
          </Group>
          <List size="sm" spacing="xs">
            {progress.missingRequirements.map((req, idx) => (
              <List.Item key={idx}>
                <Text size="sm" c="dimmed">{req}</Text>
              </List.Item>
            ))}
          </List>
        </Box>
      )}

      {/* Invalid Courses Warning */}
      {progress.invalidCourses.length > 0 && (
        <Alert 
          icon={<IconAlertCircle size={16} />} 
          title="Courses Not Counted" 
          color="yellow"
          mt="md"
        >
          <Text size="sm" mb="xs">
            The following courses do not count toward your CS major:
          </Text>
          <List size="xs">
            {progress.invalidCourses.map((item, idx) => (
              <List.Item key={idx}>
                <Text size="xs">
                  <strong>
                    {item.course.department} {item.course.number}
                  </strong>
                  {' - '}
                  {item.reason}
                </Text>
              </List.Item>
            ))}
          </List>
        </Alert>
      )}

      {/* Completion Message */}
      {progress.percentage >= 100 && progress.calculusCompleted && (
        <Alert 
          icon={<IconCheck size={16} />} 
          title="Congratulations!" 
          color="green"
          mt="md"
        >
          You have completed all requirements for the CS major! 🎉
        </Alert>
      )}
    </Card>
  );
};

export default CSMajorProgress;

