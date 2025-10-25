import React from 'react';
import { Title, Text, Container, Paper, Stack, Box } from '@mantine/core';
import { CredentialResponse } from '@react-oauth/google';
import { IconSchool } from '@tabler/icons-react';
import Login from '../components/Login';
import { TabName } from '../App';

interface SignInPageProps {
  setActiveTab: (tab: TabName) => void;
}

const SignInPage: React.FC<SignInPageProps> = ({ setActiveTab }) => {
  const handleLoginSuccess = (credentialResponse: CredentialResponse) => {
    console.log('Login successful!', credentialResponse);
    // After successful login, redirect to home page
    setActiveTab('home');
  };

  const handleLoginError = () => {
    console.error('Login error!');
    // Handle login error (e.g., show error message to user)
  };

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative elements */}
      <Box
        style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
          filter: 'blur(40px)',
        }}
      />
      <Box
        style={{
          position: 'absolute',
          bottom: '-100px',
          left: '-100px',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
          filter: 'blur(40px)',
        }}
      />

      <Container size="xs" style={{ position: 'relative', zIndex: 2 }}>
        <Paper
          shadow="xl"
          p="xl"
          radius="lg"
          withBorder
          style={{
            width: '100%',
            transition: 'all 0.3s ease',
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
          }}
          styles={{
            root: {
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
              },
            },
          }}
        >
          <Stack gap="xl">
            {/* Logo/Icon */}
            <Box
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <Box
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '20px',
                  backgroundColor: '#CC0000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(204, 0, 0, 0.3)',
                }}
              >
                <IconSchool size={48} color="white" stroke={1.5} />
              </Box>
            </Box>

            {/* Header */}
            <Stack gap="xs" align="center">
              <Title
                order={1}
                ta="center"
                style={{
                  fontSize: 'clamp(1.75rem, 5vw, 2.5rem)',
                  fontWeight: 700,
                }}
              >
                Welcome to <Box component="span" c="bu-red">PlanEdu</Box>
              </Title>
              <Text c="dimmed" size="md" ta="center">
                Your AI-powered university planner
              </Text>
            </Stack>

            {/* Sign In Section */}
            <Stack gap="md" align="center">
              <Text size="md" fw={500} c="dark">
                Sign in to get started
              </Text>
              <Box>
                <Login onSuccess={handleLoginSuccess} onError={handleLoginError} />
              </Box>
            </Stack>

            {/* Footer Text */}
            <Text size="xs" c="dimmed" ta="center" mt="md">
              By signing in, you agree to create your personalized 4-year plan
            </Text>
          </Stack>
        </Paper>

        {/* Additional Info Card */}
        <Paper
          shadow="md"
          p="md"
          radius="md"
          mt="lg"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            textAlign: 'center',
          }}
        >
          <Text size="sm" c="dimmed">
            🎓 Plan your courses • 📚 Discover classes • ✨ Powered by AI
          </Text>
        </Paper>
      </Container>
    </Box>
  );
};

export default SignInPage;

