import React, { useEffect, useState } from 'react';
import { Card, Title, Text, Group, Badge, Box, Accordion, Loader, Alert, RingProgress, Center, Stack } from '@mantine/core';
import { IconInfoCircle, IconCheck, IconX, IconWorld } from '@tabler/icons-react';
import { isUserLoggedIn, getUserGoogleId } from '../utils/auth';

interface HubDetail {
  hubName: string;
  completed: boolean;
  satisfiedByClasses: Array<{
    department: string;
    number: number;
    title: string;
  }>;
}

interface HubCompletionResult {
  percentage: number;
  totalHubs: number;
  completedHubs: number;
  completedHubNames: string[];
  missingHubNames: string[];
  hubDetails: HubDetail[];
}

interface HubProgressProps {
  refreshTrigger?: number;
}

const HubProgress: React.FC<HubProgressProps> = ({ refreshTrigger }) => {
  const [progress, setProgress] = useState<HubCompletionResult | null>(null);
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
        `${backendUrl}/api/user/hub-completion?googleId=${googleId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch hub completion data');
      }

      const data = await response.json();
      setProgress(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load hub progress';
      setError(errorMessage);
      console.error('Error loading hub progress:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderHubDetail = (hub: HubDetail) => {
    return (
      <Box>
        <Group justify="space-between" mb="xs">
          <Group gap="xs">
            {hub.completed ? (
              <IconCheck size={18} color="green" />
            ) : (
              <IconX size={18} color="gray" />
            )}
            <Text fw={600} size="sm">
              {hub.hubName}
            </Text>
          </Group>
          <Badge color={hub.completed ? 'green' : 'gray'} variant="light">
            {hub.completed ? 'Complete' : 'Incomplete'}
          </Badge>
        </Group>
        {hub.completed && hub.satisfiedByClasses.length > 0 && (
          <Box ml="xl">
            <Text size="xs" c="dimmed" mb={4}>
              Satisfied by:
            </Text>
            <Stack gap={4}>
              {hub.satisfiedByClasses.map((cls, idx) => (
                <Text key={idx} size="xs" c="green">
                  • {cls.department} {cls.number}: {cls.title}
                </Text>
              ))}
            </Stack>
          </Box>
        )}
      </Box>
    );
  };

  if (!isUserLoggedIn()) {
    return (
      <Alert icon={<IconInfoCircle size={16} />} title="Hub Requirements" color="blue">
        Sign in to track your BU Hub requirement completion.
      </Alert>
    );
  }

  if (loading) {
    return (
      <Card shadow="md" p="lg" radius="md" withBorder>
        <Center p="xl">
          <Loader size="md" />
        </Center>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconInfoCircle size={16} />} title="Error" color="red">
        {error}
      </Alert>
    );
  }

  if (!progress) {
    return null;
  }

  const progressColor = progress.percentage >= 100 ? 'green' : 'bu-red';

  return (
    <Card shadow="md" p="lg" radius="md" withBorder>
      <Title order={4} mb="md" c="bu-red">
        <Group gap="xs">
          <IconWorld size={24} />
          BU Hub Requirements
        </Group>
      </Title>

      {/* Progress Ring */}
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
                <IconWorld size={40} color={progressColor === 'green' ? '#2f9e44' : '#CC0000'} />
                <Text size="xl" fw={700} c={progressColor} mt="xs">
                  {progress.percentage}%
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                  {progress.completedHubs} of {progress.totalHubs}
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                  hubs
                </Text>
              </Center>
            }
          />
        </Center>
        <Text size="sm" c="dimmed" ta="center" mt="md">
          {progress.percentage >= 100 
            ? '🎉 All Hub Requirements Completed!' 
            : progress.percentage >= 75
            ? 'Almost done with your hubs!'
            : progress.percentage >= 50
            ? 'You\'re halfway through!'
            : 'Keep taking diverse courses!'}
        </Text>
      </Box>

      {/* Summary Stats */}
      <Group justify="space-around" mb="xl" grow>
        <Box ta="center">
          <Text size="xl" fw={700} c="green">
            {progress.completedHubs}
          </Text>
          <Text size="xs" c="dimmed">Completed</Text>
        </Box>
        <Box ta="center">
          <Text size="xl" fw={700} c="gray">
            {progress.missingHubNames.length}
          </Text>
          <Text size="xs" c="dimmed">Remaining</Text>
        </Box>
      </Group>

      {/* Hub Details Accordion */}
      <Accordion variant="separated">
        {/* Completed Hubs */}
        {progress.completedHubs > 0 && (
          <Accordion.Item value="completed">
            <Accordion.Control>
              <Group justify="space-between">
                <Text fw={600}>Completed Hubs</Text>
                <Badge color="green" variant="light">
                  {progress.completedHubs}
                </Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
                {progress.hubDetails
                  .filter(hub => hub.completed)
                  .map((hub, idx) => (
                    <Box key={idx}>
                      {renderHubDetail(hub)}
                    </Box>
                  ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        )}

        {/* Missing Hubs */}
        {progress.missingHubNames.length > 0 && (
          <Accordion.Item value="missing">
            <Accordion.Control>
              <Group justify="space-between">
                <Text fw={600}>Remaining Hubs</Text>
                <Badge color="gray" variant="light">
                  {progress.missingHubNames.length}
                </Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
                {progress.hubDetails
                  .filter(hub => !hub.completed)
                  .map((hub, idx) => (
                    <Box key={idx}>
                      {renderHubDetail(hub)}
                    </Box>
                  ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        )}
      </Accordion>

      {/* Info */}
      <Box mt="lg" p="sm" bg="gray.0" style={{ borderRadius: '8px' }}>
        <Group gap="xs">
          <IconInfoCircle size={16} color="#228be6" />
          <Text size="xs" c="dimmed">
            Hub requirements are fulfilled by taking courses across different disciplines.
          </Text>
        </Group>
      </Box>
    </Card>
  );
};

export default HubProgress;

