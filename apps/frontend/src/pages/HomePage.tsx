import React from 'react';
import { Title, Button, Container, Box, Text, Card, Grid, Group, Stack, Progress, Badge } from '@mantine/core';
import { IconRocket, IconCalendar, IconTarget, IconTrendingUp, IconArrowRight, IconBook, IconSchool, IconStar } from '@tabler/icons-react';
import { TabName } from '../App';

interface HomePageProps {
  setActiveTab: (tab: TabName) => void;
}

const HomePage: React.FC<HomePageProps> = ({ setActiveTab }) => {
  // Mock data - in real app this would come from API/state
  const userName = 'Student';
  const currentSemester = 'Fall 2024';
  const creditsCompleted = 32;
  const totalCredits = 128;
  const gpa = 3.67;

  const quickActions = [
    {
      icon: IconCalendar,
      title: 'Build Your Plan',
      description: 'Set up your preferences and generate your 4-year schedule',
      color: 'bu-red',
      action: () => setActiveTab('preferences'),
    },
    {
      icon: IconBook,
      title: 'Discover Classes',
      description: 'Swipe through courses to find your perfect matches',
      color: 'blue',
      action: () => setActiveTab('swiper'),
    },
    {
      icon: IconTarget,
      title: 'Ask Questions',
      description: 'Get AI-powered course recommendations and advice',
      color: 'grape',
      action: () => setActiveTab('questions'),
    },
  ];

  const upcomingClasses = [
    { code: 'CS 111', name: 'Intro to Computer Science', time: 'MWF 10:00 AM' },
    { code: 'WR 100', name: 'Writing Seminar', time: 'TR 2:00 PM' },
    { code: 'MA 123', name: 'Calculus I', time: 'MWF 11:00 AM' },
  ];

  return (
    <Box style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <Container size="lg" p="lg" pt="xl">
        {/* Welcome Header */}
        <Box mb="xl">
          <Group justify="space-between" align="flex-start" mb="md">
            <Box>
              <Text size="sm" c="dimmed" mb={4}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
              <Title order={1} size="h2" mb="xs">
                Welcome back, <Box component="span" c="bu-red">{userName}</Box>! 👋
              </Title>
              <Text c="dimmed">
                Here's an overview of your academic journey
              </Text>
            </Box>
            <Badge size="lg" variant="light" color="bu-red">
              {currentSemester}
            </Badge>
          </Group>
        </Box>

        {/* Stats Overview */}
        <Grid gutter="md" mb="xl">
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card
              shadow="sm"
              p="lg"
              radius="md"
              withBorder
              style={{ transition: 'all 0.3s ease' }}
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
                <Text size="sm" c="dimmed" fw={600}>
                  CREDITS
                </Text>
                <IconSchool size={20} color="#868e96" />
              </Group>
              <Text size="xl" fw={700} c="dark">
                {creditsCompleted}/{totalCredits}
              </Text>
              <Progress value={(creditsCompleted / totalCredits) * 100} color="bu-red" size="sm" mt="md" />
              <Text size="xs" c="dimmed" mt="xs">
                {Math.round((creditsCompleted / totalCredits) * 100)}% complete
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card
              shadow="sm"
              p="lg"
              radius="md"
              withBorder
              style={{ transition: 'all 0.3s ease' }}
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
                <Text size="sm" c="dimmed" fw={600}>
                  GPA
                </Text>
                <IconTrendingUp size={20} color="#868e96" />
              </Group>
              <Text size="xl" fw={700} c="dark">
                {gpa.toFixed(2)}
              </Text>
              <Progress value={(gpa / 4.0) * 100} color="green" size="sm" mt="md" />
              <Text size="xs" c="dimmed" mt="xs">
                Keep up the great work!
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card
              shadow="sm"
              p="lg"
              radius="md"
              withBorder
              style={{ transition: 'all 0.3s ease' }}
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
                <Text size="sm" c="dimmed" fw={600}>
                  HUB PROGRESS
                </Text>
                <IconTarget size={20} color="#868e96" />
              </Group>
              <Group align="flex-end" gap="xs" mb="md">
                <Text size="xl" fw={700} c="dark">
                  4
                </Text>
                <Text size="sm" c="dimmed" mb={2}>
                  / 6 completed
                </Text>
              </Group>
              <Progress value={66} color="blue" size="sm" />
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card
              shadow="sm"
              p="lg"
              radius="md"
              withBorder
              style={{ transition: 'all 0.3s ease' }}
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
                <Text size="sm" c="dimmed" fw={600}>
                  BOOKMARKED
                </Text>
                <IconStar size={20} color="#868e96" />
              </Group>
              <Text size="xl" fw={700} c="dark">
                12
              </Text>
              <Text size="xs" c="dimmed" mt="md">
                classes saved
              </Text>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Quick Actions */}
        <Title order={2} size="h3" mb="md">
          Quick Actions
        </Title>
        <Grid gutter="md" mb="xl">
          {quickActions.map((action, index) => (
            <Grid.Col key={index} span={{ base: 12, md: 4 }}>
              <Card
                shadow="sm"
                p="xl"
                radius="md"
                withBorder
                style={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                styles={{
                  root: {
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: '0 12px 32px rgba(204, 0, 0, 0.15)',
                      borderColor: '#CC0000',
                    },
                  },
                }}
                onClick={action.action}
              >
                <Stack gap="md">
                  <Box
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '12px',
                      backgroundColor: index === 0 ? '#CC0000' : index === 1 ? '#339AF0' : '#9775FA',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <action.icon size={28} color="white" stroke={1.5} />
                  </Box>
                  <Box>
                    <Group justify="space-between" align="center">
                      <Title order={3} size="h4">
                        {action.title}
                      </Title>
                      <IconArrowRight size={18} color="#868e96" />
                    </Group>
                    <Text size="sm" c="dimmed" mt="xs">
                      {action.description}
                    </Text>
                  </Box>
                </Stack>
              </Card>
            </Grid.Col>
          ))}
        </Grid>

        {/* Current Semester Classes */}
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card shadow="sm" p="lg" radius="md" withBorder>
              <Group justify="space-between" mb="md">
                <Title order={3} size="h4">
                  This Semester's Schedule
                </Title>
                <Button
                  variant="subtle"
                  color="bu-red"
                  size="xs"
                  rightSection={<IconArrowRight size={14} />}
                >
                  View Full Schedule
                </Button>
              </Group>
              <Stack gap="sm">
                {upcomingClasses.map((course, index) => (
                  <Card
                    key={index}
                    p="md"
                    radius="md"
                    style={{
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #e9ecef',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                    }}
                    styles={{
                      root: {
                        '&:hover': {
                          backgroundColor: '#fff',
                          borderColor: '#CC0000',
                          transform: 'translateX(4px)',
                        },
                      },
                    }}
                  >
                    <Group justify="space-between">
                      <Box>
                        <Text fw={600} c="bu-red" size="sm">
                          {course.code}
                        </Text>
                        <Text size="sm" c="dark">
                          {course.name}
                        </Text>
                      </Box>
                      <Text size="xs" c="dimmed">
                        {course.time}
                      </Text>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card shadow="sm" p="lg" radius="md" withBorder style={{ height: '100%' }}>
              <Stack gap="lg" align="center" justify="center" style={{ height: '100%' }}>
                <IconRocket size={64} color="#CC0000" stroke={1.5} />
                <Box ta="center">
                  <Title order={3} size="h4" mb="xs">
                    Ready to Plan?
                  </Title>
                  <Text size="sm" c="dimmed" mb="lg">
                    Let's build your perfect 4-year schedule together
                  </Text>
                  <Button
                    color="bu-red"
                    size="md"
                    radius="md"
                    fullWidth
                    onClick={() => setActiveTab('preferences')}
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
                    Start Planning
                  </Button>
                </Box>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </Container>
    </Box>
  );
};

export default HomePage;
