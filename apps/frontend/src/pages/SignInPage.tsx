import React, { useState } from 'react';
import { Title, Text, Container, Paper, Stack, Box, Button, Grid, ThemeIcon, Group, Modal } from '@mantine/core';
import { CredentialResponse } from '@react-oauth/google';
import { IconSchool, IconRobot, IconCalendar, IconHeart, IconSparkles, IconChartBar, IconArrowRight, IconCheck } from '@tabler/icons-react';
import Login from '../components/Login';
import { TabName } from '../App';

interface SignInPageProps {
  setActiveTab: (tab: TabName) => void;
}

const SignInPage: React.FC<SignInPageProps> = ({ setActiveTab }) => {
  const [loginModalOpened, setLoginModalOpened] = useState(false);

  const handleLoginSuccess = (credentialResponse: CredentialResponse) => {
    console.log('Login successful!', credentialResponse);
    setLoginModalOpened(false);
    setActiveTab('questions');
  };

  const handleLoginError = () => {
    console.error('Login error!');
  };

  const features = [
    {
      icon: IconRobot,
      title: 'AI-Powered Planning',
      description: 'Our intelligent system analyzes your goals, prerequisites, and preferences to create the perfect 4-year plan.',
    },
    {
      icon: IconCalendar,
      title: 'Smart Scheduling',
      description: 'Automatically plan your semesters considering course availability, workload balance, and graduation requirements.',
    },
    {
      icon: IconHeart,
      title: 'Class Discovery',
      description: 'Swipe through classes Tinder-style! Find courses that match your interests with integrated RateMyProfessor ratings.',
    },
    {
      icon: IconChartBar,
      title: 'Track Progress',
      description: 'Monitor your academic journey, hub requirements, and major milestones all in one beautiful dashboard.',
    },
  ];

  return (
    <Box style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {/* Hero Section */}
      <Box
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #CC0000 0%, #8B0000 50%, #1a1a1a 100%)',
          overflow: 'hidden',
        }}
      >
        {/* Animated Background Elements */}
        <Box
          style={{
            position: 'absolute',
            top: '10%',
            right: '10%',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
            animation: 'float 6s ease-in-out infinite',
          }}
        />
        <Box
          style={{
            position: 'absolute',
            bottom: '20%',
            left: '5%',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
            animation: 'float 8s ease-in-out infinite',
            animationDelay: '2s',
          }}
        />

        <Container size="lg" style={{ position: 'relative', zIndex: 2 }}>
          <Grid gutter="xl" align="center">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="xl">
                {/* Logo Badge */}
                <Box
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '50px',
                    backdropFilter: 'blur(10px)',
                    width: 'fit-content',
                  }}
                >
                  <IconSparkles size={20} color="white" />
                  <Text size="sm" c="white" fw={600}>
                    For Boston University Students
                  </Text>
                </Box>

                {/* Hero Title */}
                <Title
                  order={1}
                  style={{
                    fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
                    fontWeight: 900,
                    color: 'white',
                    lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Plan Your Perfect{' '}
                  <Box
                    component="span"
                    style={{
                      background: 'linear-gradient(45deg, #FFD700, #FFA500)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    4-Year Journey
                  </Box>
                </Title>

                {/* Subtitle */}
                <Text
                  size="xl"
                  c="rgba(255, 255, 255, 0.9)"
                  style={{
                    fontSize: 'clamp(1.1rem, 2vw, 1.5rem)',
                    lineHeight: 1.6,
                  }}
                >
                  PlanEdu uses AI to help you discover classes, meet requirements, and graduate on time — 
                  all while exploring courses you'll actually love.
                </Text>

                {/* CTA Buttons */}
                <Group gap="md">
                  <Button
                    size="xl"
                    radius="xl"
                    onClick={() => setLoginModalOpened(true)}
                    style={{
                      background: 'white',
                      color: '#CC0000',
                      fontSize: '1.125rem',
                      padding: '1.5rem 2.5rem',
                      height: 'auto',
                      fontWeight: 700,
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                      transition: 'all 0.3s ease',
                    }}
                    styles={{
                      root: {
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
                        },
                      },
                    }}
                    rightSection={<IconArrowRight size={20} />}
                  >
                    Get Started Free
                  </Button>

                  <Button
                    size="xl"
                    radius="xl"
                    variant="outline"
                    onClick={() => {
                      document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{
                      color: 'white',
                      borderColor: 'white',
                      fontSize: '1.125rem',
                      padding: '1.5rem 2.5rem',
                      height: 'auto',
                      fontWeight: 600,
                      backdropFilter: 'blur(10px)',
                      transition: 'all 0.3s ease',
                    }}
                    styles={{
                      root: {
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          transform: 'translateY(-4px)',
                        },
                      },
                    }}
                  >
                    Learn More
                  </Button>
                </Group>

                {/* Trust Indicators */}
                <Group gap="xl" mt="md">
                  <Group gap="xs">
                    <IconCheck size={20} color="#4ADE80" stroke={3} />
                    <Text size="sm" c="rgba(255, 255, 255, 0.8)">
                      Free Forever
                    </Text>
                  </Group>
                  <Group gap="xs">
                    <IconCheck size={20} color="#4ADE80" stroke={3} />
                    <Text size="sm" c="rgba(255, 255, 255, 0.8)">
                      AI-Powered
                    </Text>
                  </Group>
                  <Group gap="xs">
                    <IconCheck size={20} color="#4ADE80" stroke={3} />
                    <Text size="sm" c="rgba(255, 255, 255, 0.8)">
                      BU Optimized
                    </Text>
                  </Group>
                </Group>
              </Stack>
            </Grid.Col>

            {/* Hero Image/Mockup */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Box
                style={{
                  position: 'relative',
                  padding: '2rem',
                }}
              >
                <Paper
                  shadow="2xl"
                  radius="xl"
                  p="xl"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    transform: 'rotate(-2deg)',
                    transition: 'all 0.3s ease',
                  }}
                  styles={{
                    root: {
                      '&:hover': {
                        transform: 'rotate(0deg) translateY(-8px)',
                      },
                    },
                  }}
                >
                  <Stack gap="lg">
                    <Group justify="space-between" align="center">
                      <Box
                        style={{
                          width: '60px',
                          height: '60px',
                          borderRadius: '16px',
                          backgroundColor: '#CC0000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconSchool size={32} color="white" />
                      </Box>
                      <Text fw={700} size="lg" c="dark">
                        Your Schedule
                      </Text>
                    </Group>

                    <Stack gap="sm">
                      {['CS 111 - Intro to CS', 'WR 100 - Writing Seminar', 'MA 123 - Calculus I', 'Hub - Social Inquiry'].map((course, i) => (
                        <Paper
                          key={i}
                          p="md"
                          radius="md"
                          style={{
                            backgroundColor: i === 0 ? '#CC0000' : '#f8f9fa',
                            color: i === 0 ? 'white' : '#1a1a1a',
                            border: i === 0 ? 'none' : '2px solid #e9ecef',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <Text fw={600} size="sm">
                            {course}
                          </Text>
                        </Paper>
                      ))}
                    </Stack>

                    <Button variant="light" color="bu-red" size="md" fullWidth>
                      View Full Plan
                    </Button>
                  </Stack>
                </Paper>
              </Box>
            </Grid.Col>
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box id="features" style={{ padding: '6rem 0', backgroundColor: 'white' }}>
        <Container size="lg">
          <Stack gap="xl" align="center" mb="4rem">
            <Title
              order={2}
              ta="center"
              style={{
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                fontWeight: 800,
                color: '#1a1a1a',
              }}
            >
              Everything You Need to <Box component="span" c="bu-red">Succeed</Box>
            </Title>
            <Text size="lg" c="dimmed" ta="center" maw={600}>
              PlanEdu combines smart AI, beautiful design, and BU-specific data 
              to make course planning effortless and even fun.
            </Text>
          </Stack>

          <Grid gutter="xl">
            {features.map((feature, index) => (
              <Grid.Col key={index} span={{ base: 12, sm: 6 }}>
                <Paper
                  shadow="sm"
                  p="xl"
                  radius="lg"
                  withBorder
                  style={{
                    height: '100%',
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
                >
                  <Stack gap="md">
                    <ThemeIcon
                      size={60}
                      radius="md"
                      variant="light"
                      color="bu-red"
                    >
                      <feature.icon size={32} stroke={1.5} />
                    </ThemeIcon>
                    <Title order={3} size="h4">
                      {feature.title}
                    </Title>
                    <Text c="dimmed" size="sm">
                      {feature.description}
                    </Text>
                  </Stack>
                </Paper>
              </Grid.Col>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Final CTA Section */}
      <Box
        style={{
          padding: '6rem 0',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        }}
      >
        <Container size="md">
          <Paper
            shadow="xl"
            p="3rem"
            radius="xl"
            style={{
              background: 'linear-gradient(135deg, #CC0000 0%, #8B0000 100%)',
              textAlign: 'center',
            }}
          >
            <Stack gap="xl" align="center">
              <Title
                order={2}
                c="white"
                style={{
                  fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
                  fontWeight: 800,
                }}
              >
                Ready to Plan Your Future?
              </Title>
              <Text size="lg" c="rgba(255, 255, 255, 0.9)" maw={500}>
                Join hundreds of BU students who are taking control of their academic journey
              </Text>
              <Button
                size="xl"
                radius="xl"
                onClick={() => setLoginModalOpened(true)}
                style={{
                  background: 'white',
                  color: '#CC0000',
                  fontSize: '1.125rem',
                  padding: '1.5rem 3rem',
                  height: 'auto',
                  fontWeight: 700,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                }}
                rightSection={<IconArrowRight size={20} />}
              >
                Start Planning Now
              </Button>
            </Stack>
          </Paper>
        </Container>
      </Box>

      {/* Login Modal */}
      <Modal
        opened={loginModalOpened}
        onClose={() => setLoginModalOpened(false)}
        title={
          <Group gap="sm">
            <Box
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#CC0000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconSchool size={24} color="white" />
            </Box>
            <Text fw={700} size="lg">
              Sign in to PlanEdu
            </Text>
          </Group>
        }
        centered
        size="md"
        radius="lg"
      >
        <Stack gap="lg" p="md">
          <Text c="dimmed" ta="center">
            Use your Google account to get started with PlanEdu
          </Text>
          <Box style={{ display: 'flex', justifyContent: 'center' }}>
            <Login onSuccess={handleLoginSuccess} onError={handleLoginError} />
          </Box>
          <Text size="xs" c="dimmed" ta="center">
            By signing in, you agree to create your personalized 4-year plan
          </Text>
        </Stack>
      </Modal>

      {/* Add floating animation keyframes */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
      `}</style>
    </Box>
  );
};

export default SignInPage;

