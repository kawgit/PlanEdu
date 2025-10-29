import React, { useEffect, useState } from 'react';
import { Card, Title, Text, Group, Badge, Box, Accordion, List, Loader, Alert, RingProgress, Center } from '@mantine/core';
import { IconInfoCircle, IconCheck, IconAlertCircle, IconTrophy, IconMath } from '@tabler/icons-react';
import { isUserLoggedIn, getUserGoogleId } from '../utils/auth';

interface CompletedCourse {
  school: string;
  department: string;
  number: number;
  grade: string | null;
  title?: string;
  description?: string;
}

interface RequirementProgress {
  name: string;
  description: string;
  completed: boolean;
  courses: string[];
  completedCourses: string[];
}

interface LowerDivisionProgress {
  required: number;
  completed: number;
  requirements: RequirementProgress[];
}

interface UpperDivisionProgress {
  required: number;
  completed: number;
  requirements: RequirementProgress[];
}

interface SpecialRulesStatus {
  cs131Used: boolean;
  ma293Used: boolean;
  ma581Used: boolean;
  ma581DoubleCounted: boolean;
  warnings: string[];
}

interface MathCSMajorCompletionResult {
  percentage: number;
  totalRequired: number;
  totalCompleted: number;
  lowerDivision: LowerDivisionProgress;
  upperDivision: UpperDivisionProgress;
  validCourses: CompletedCourse[];
  invalidCourses: Array<{ course: CompletedCourse; reason: string }>;
  missingRequirements: string[];
  specialRules: SpecialRulesStatus;
}

interface MathCSMajorProgressProps {
  refreshTrigger?: number;
}

const MathCSMajorProgress: React.FC<MathCSMajorProgressProps> = ({ refreshTrigger }) => {
  const [progress, setProgress] = useState<MathCSMajorCompletionResult | null>(null);
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

      const googleId = getUserGoogleId();

      if (!googleId) {
        throw new Error('User not found');
      }

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(
        `${backendUrl}/api/user/math-cs-major-completion?googleId=${googleId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch Math and CS major completion data');
      }

      const data = await response.json();
      setProgress(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load Math and CS major progress';
      setError(errorMessage);
      console.error('Error loading Math and CS major progress:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderRequirementProgress = (
    requirement: RequirementProgress
  ) => {
    const isComplete = requirement.completed;
    const hasPartialProgress = !isComplete && requirement.completedCourses.length > 0;

    return (
      <Box mb="md">
        <Group justify="space-between" mb="xs">
          <Text fw={600} size="sm">
            {requirement.name}
          </Text>
          <Badge 
            color={isComplete ? 'green' : hasPartialProgress ? 'yellow' : 'blue'} 
            variant="light"
          >
            {isComplete ? 'Completed' : hasPartialProgress ? `In Progress (${requirement.completedCourses.length}/2)` : 'Required'}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed" mb="xs">
          {requirement.description}
        </Text>
        {requirement.completedCourses.length > 0 && (
          <Box mb="xs">
            <Text size="xs" fw={600} c={hasPartialProgress ? 'yellow.9' : 'green'} mb={4}>
              {hasPartialProgress ? 'In Progress:' : 'Completed:'}
            </Text>
            <Group gap="xs">
              {requirement.completedCourses.map((course, idx) => (
                <Badge key={idx} color={hasPartialProgress ? 'yellow' : 'green'} variant="light" size="sm">
                  <Group gap={4}>
                    <IconCheck size={12} />
                    {course}
                  </Group>
                </Badge>
              ))}
            </Group>
          </Box>
        )}
        {!isComplete && (
          <Box>
            <Text size="xs" fw={600} c="dimmed" mb={4}>
              {hasPartialProgress ? 'Still needed:' : 'Required courses:'}
            </Text>
            <Group gap="xs">
              {requirement.courses.map((course, idx) => (
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
          <Text c="dimmed">Loading Math and CS major progress...</Text>
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
    <Card shadow="md" p="lg" radius="md" withBorder mb="xl" style={{ height: '100%' }}>
      <Title order={4} mb="md">
        <Group gap="xs">
          <IconMath size={24} />
          Math and CS Major Progress
        </Group>
      </Title>
      
      {/* Overall Progress - Dial Display */}
      <Box mb="xl">
        <Center>
          <RingProgress
            size={220}
            thickness={20}
            roundCaps
            sections={[
              { 
                value: progress.percentage, 
                color: progressColor,
                tooltip: `${progress.percentage}% complete`
              }
            ]}
            label={
              <Center style={{ flexDirection: 'column' }}>
                <IconTrophy size={40} color={progressColor === 'green' ? '#2f9e44' : '#CC0000'} />
                <Text size="xl" fw={700} c={progressColor} mt="xs">
                  {progress.percentage}%
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                  {progress.totalCompleted} of {progress.totalRequired}
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                  requirements
                </Text>
              </Center>
            }
          />
        </Center>
        <Text size="sm" c="dimmed" ta="center" mt="md">
          {progress.percentage >= 100 
            ? '🎉 Major Requirements Completed!' 
            : progress.percentage >= 75
            ? 'Almost there! Keep going!'
            : progress.percentage >= 50
            ? 'You\'re halfway through!'
            : 'Just getting started!'}
        </Text>
      </Box>

      {/* Lower Division Requirements */}
      <Accordion variant="separated" mb="xl">
        <Accordion.Item value="lowerDivision">
          <Accordion.Control>
            <Group justify="space-between">
              <Text fw={600}>Lower Division Requirements</Text>
              <Badge 
                color={progress.lowerDivision.completed >= progress.lowerDivision.required ? 'green' : 'blue'}
                variant="light"
              >
                {progress.lowerDivision.completed} / {progress.lowerDivision.required}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Text size="sm" mb="md" c="dimmed">
              8 specific requirements that must be met
            </Text>
            {progress.lowerDivision.requirements.map((req, idx) => (
              <Box key={idx} mb="md">
                {renderRequirementProgress(req)}
              </Box>
            ))}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="upperDivision">
          <Accordion.Control>
            <Group justify="space-between">
              <Text fw={600}>Upper Division Requirements</Text>
              <Badge 
                color={progress.upperDivision.completed >= progress.upperDivision.required ? 'green' : 'blue'}
                variant="light"
              >
                {progress.upperDivision.completed} / {progress.upperDivision.required}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Text size="sm" mb="md" c="dimmed">
              5 specific requirements that must be met
            </Text>
            {progress.upperDivision.requirements.map((req, idx) => (
              <Box key={idx} mb="md">
                {renderRequirementProgress(req)}
              </Box>
            ))}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {/* Special Rules */}
      {progress.specialRules.warnings.length > 0 && (
        <Alert 
          icon={<IconInfoCircle size={16} />} 
          title="Special Rules" 
          color="yellow"
          mb="md"
        >
          <List size="sm">
            {progress.specialRules.warnings.map((warning, idx) => (
              <List.Item key={idx}>
                <Text size="sm">{warning}</Text>
              </List.Item>
            ))}
          </List>
        </Alert>
      )}

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
            The following courses do not count toward your Math and CS major:
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
      {progress.percentage >= 100 && (
        <Alert 
          icon={<IconCheck size={16} />} 
          title="Congratulations!" 
          color="green"
          mt="md"
        >
          You have completed all requirements for the Math and CS major! 🎉
        </Alert>
      )}
    </Card>
  );
};

export default MathCSMajorProgress;
