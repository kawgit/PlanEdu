import React from 'react';
import { Title, Button, Group, Container, Box } from '@mantine/core';

// === FIX: Correcting path back to '../' ===
import { DarkModeToggle } from '../DarkModeToggle';
// This import needs to find App.tsx in src/components/
import { TabName } from '../App';

// This interface is the crucial part that was missing or incorrect.
// It tells TypeScript that HomePage *expects* to receive 'setActiveTab'.
interface HomePageProps {
  setActiveTab: (tab: TabName) => void;
}

const HomePage: React.FC<HomePageProps> = ({ setActiveTab }) => {
  return (
    <Container fluid p="lg">
      {/* Top Header Section */}
      <Group justify="space-between" mb="xl">
        <Title order={1}>
          Welcome to <Box component="span" c="bu-red">PlanEdu</Box>
        </Title>
        
        <Group gap="md">
          <Button 
            variant="outline" 
            color="bu-red" 
            radius="xl"
            onClick={() => alert('Create Account Clicked!')} // Placeholder action
          >
            Create Account
          </Button>
          <DarkModeToggle />
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

