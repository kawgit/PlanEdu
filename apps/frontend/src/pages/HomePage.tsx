import React from 'react';
import { Title, Button, Group, Container, Box } from '@mantine/core';
import { TabName } from '../App';
import Login from '../components/Login';
import { CredentialResponse } from '@react-oauth/google';

interface HomePageProps {
  setActiveTab: (tab: TabName) => void;
}

const HomePage: React.FC<HomePageProps> = ({ setActiveTab }) => {
  const handleLoginSuccess = (credentialResponse: CredentialResponse) => {
    console.log('Login successful!', credentialResponse);
    // You can add additional logic here, like redirecting to another page
    // or updating the UI to show the logged-in state
  };

  const handleLoginError = () => {
    console.error('Login error!');
    // Handle login error (e.g., show error message to user)
  };

  return (
    <Container fluid p="lg">
      {/* Top Header Section */}
      <Group justify="space-between" mb="xl">
        <Title order={1}>
          Welcome to <Box component="span" c="bu-red">PlanEdu</Box>
        </Title>
        
        <Group gap="md">
          <Login onSuccess={handleLoginSuccess} onError={handleLoginError} />
        </Group>
      </Group>

      {/* Main Content Area (Centered Button) */}
      <Container style={{ textAlign: 'center', marginTop: '15vh' }}>
        <Title order={2} fw={300} mb="xl">
          Your AI-powered university planner.
        </Title>
        
        <Button
          onClick={() => setActiveTab('preferences')}
          color="bu-red"
          size="xl"
          radius="xl"
          tt="uppercase"
        >
          Create 4-Year-Plan
        </Button>
      </Container>
    </Container>
  );
};

export default HomePage;
