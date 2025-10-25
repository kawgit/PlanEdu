import React from 'react';
import { Title, Button, Container, Box } from '@mantine/core';
import { TabName } from '../App';

interface HomePageProps {
  setActiveTab: (tab: TabName) => void;
}

const HomePage: React.FC<HomePageProps> = ({ setActiveTab }) => {
  return (
    <Container fluid p="lg">
      {/* Top Header Section */}
      <Title order={1} mb="xl">
        Welcome to <Box component="span" c="bu-red">PlanEdu</Box>
      </Title>

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
