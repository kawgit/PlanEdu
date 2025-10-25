import React from 'react';
import { Container, Title, Text, Card, Stack, Select, NumberInput, Button, Group } from '@mantine/core';
import { IconSchool, IconCalendar, IconTarget } from '@tabler/icons-react';

const PreferencesPage: React.FC = () => {
  return (
    <Container size="md" p="lg">
      <Title order={2} mb="xs" c="bu-red">
        My Preferences
      </Title>
      <Text c="dimmed" mb="xl" size="sm">
        Build your academic profile to get personalized recommendations
      </Text>

      <Stack gap="lg">
        {/* Phase 1: Core Requirements */}
        <Card
          shadow="md"
          p="lg"
          radius="md"
          withBorder
          style={{
            transition: 'all 0.3s ease',
          }}
          styles={{
            root: {
              '&:hover': {
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
              },
            },
          }}
        >
          <Group mb="md">
            <IconSchool size={24} color="#CC0000" />
            <Title order={3}>Core Requirements</Title>
          </Group>

          <Stack gap="md">
            <Select
              label="Major"
              placeholder="Select your major"
              data={[
                'Computer Science',
                'Business Administration',
                'Biology',
                'Psychology',
                'Engineering',
                'Communications',
              ]}
              withAsterisk
            />

            <NumberInput
              label="Incoming Credits"
              placeholder="AP/Transfer credits"
              description="Total credits you're entering with"
              min={0}
              max={128}
            />

            <Select
              label="Expected Graduation"
              placeholder="Select semester"
              data={[
                'Spring 2026',
                'Fall 2026',
                'Spring 2027',
                'Fall 2027',
                'Spring 2028',
                'Fall 2028',
              ]}
              withAsterisk
            />
          </Stack>
        </Card>

        {/* Phase 2: Preferences */}
        <Card
          shadow="md"
          p="lg"
          radius="md"
          withBorder
          style={{
            transition: 'all 0.3s ease',
          }}
          styles={{
            root: {
              '&:hover': {
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
              },
            },
          }}
        >
          <Group mb="md">
            <IconTarget size={24} color="#CC0000" />
            <Title order={3}>Academic Preferences</Title>
          </Group>

          <Stack gap="md">
            <Select
              label="Interests"
              placeholder="Select your primary interest"
              description="Helps us recommend Hub courses and electives"
              data={[
                'Creative Arts',
                'Social Sciences',
                'Natural Sciences',
                'Technology & Innovation',
                'Global Studies',
                'Health & Wellness',
              ]}
            />

            <Select
              label="Study Abroad Interest"
              placeholder="Select your preference"
              data={[
                'Very Interested',
                'Somewhat Interested',
                'Not Interested',
                'Already Planned',
              ]}
            />

            <Select
              label="Preferred Course Load"
              placeholder="Classes per semester"
              data={['4 courses', '5 courses', '6 courses']}
              defaultValue="5 courses"
            />
          </Stack>
        </Card>

        {/* Future Planning */}
        <Card
          shadow="md"
          p="lg"
          radius="md"
          withBorder
          style={{
            transition: 'all 0.3s ease',
          }}
          styles={{
            root: {
              '&:hover': {
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
              },
            },
          }}
        >
          <Group mb="md">
            <IconCalendar size={24} color="#CC0000" />
            <Title order={3}>Timeline Planning</Title>
          </Group>

          <Text c="dimmed" size="sm" mb="md">
            Coming in Phase 2: Advanced scheduling preferences including summer courses, 
            internship semesters, and more granular timeline control.
          </Text>
        </Card>

        {/* Save Button */}
        <Button
          color="bu-red"
          size="lg"
          fullWidth
          style={{
            transition: 'all 0.3s ease',
          }}
          styles={{
            root: {
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 16px rgba(204, 0, 0, 0.3)',
              },
            },
          }}
        >
          Save Preferences
        </Button>
      </Stack>
    </Container>
  );
};

export default PreferencesPage;