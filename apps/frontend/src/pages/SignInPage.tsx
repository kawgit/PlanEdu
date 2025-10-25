import React from 'react';
import { Title, Text, Container, Paper, Stack, Box } from '@mantine/core';
import { CredentialResponse } from '@react-oauth/google';
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
    <Container size="xs" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
      <Paper shadow="md" p="xl" radius="md" withBorder style={{ width: '100%' }}>
        <Stack gap="xl">
          {/* Header */}
          <Stack gap="xs" align="center">
            <Title order={1} ta="center">
              Welcome to <Box component="span" c="bu-red">PlanEdu</Box>
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              Your AI-powered university planner
            </Text>
          </Stack>

          {/* Sign In Section */}
          <Stack gap="md" align="center">
            <Text size="md" fw={500}>
              Sign in to get started
            </Text>
            <Login onSuccess={handleLoginSuccess} onError={handleLoginError} />
          </Stack>

          {/* Footer Text */}
          <Text size="xs" c="dimmed" ta="center">
            By signing in, you agree to create your personalized 4-year plan
          </Text>
        </Stack>
      </Paper>
    </Container>
  );
};

export default SignInPage;

