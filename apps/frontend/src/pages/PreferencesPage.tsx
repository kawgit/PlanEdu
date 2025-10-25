import React from 'react';
import { Container, Title, Text, List } from '@mantine/core';

const PreferencesPage: React.FC = () => {
  return (
    <Container>
      <Title order={2} mb="md">
        My Preferences
      </Title>
      <Text c="dimmed">
        This is where the user will build their profile.
      </Text>

      <Title order={4} mt="xl">Phase 1 Inputs:</Title>
      <List mt="sm">
        <List.Item>Major</List.Item>
        <List.Item>Incoming Credits (AP/Transfer)</List.Item>
        <List.Item>Semester to Graduate</List.Item>
      </List>

      <Title order={4} mt="xl">Phase 2 Inputs:</Title>
      <List mt="sm">
        <List.Item>Interests (for Hubs / electives)</List.Item>
        <List.Item>Study Abroad desires</List.Item>
        <List.Item>Preferred course load</List.Item>
      </List>
    </Container>
  );
};

export default PreferencesPage;