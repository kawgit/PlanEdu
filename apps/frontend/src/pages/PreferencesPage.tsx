import React, { useState, useEffect } from 'react';
import { Container, Title, Text, Card, Stack, Select, NumberInput, Button, Group } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconSchool, IconCalendar, IconTarget } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { saveUserPreferences, fetchUserFromDB } from '../utils/auth';

const PreferencesPage: React.FC = () => {
  const [major, setMajor] = useState<string | null>(null);
  const [minor, setMinor] = useState<string | null>(null);
  const [incomingCredits, setIncomingCredits] = useState<number | string>('');
  const [expectedGraduation, setExpectedGraduation] = useState<Date | null>(null);
  const [interests, setInterests] = useState<string | null>(null);
  const [studyAbroadInterest, setStudyAbroadInterest] = useState<string | null>(null);
  const [preferredCourseLoad, setPreferredCourseLoad] = useState<string | null>('5 courses');
  const [loading, setLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Load existing preferences when component mounts
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const userData = await fetchUserFromDB();
        if (userData) {
          setMajor(userData.major || null);
          setMinor(userData.minor || null);
          setIncomingCredits(userData.incoming_credits || '');
          setExpectedGraduation(userData.target_graduation ? new Date(userData.target_graduation) : null);
          setInterests(userData.interests || null);
          setStudyAbroadInterest(userData.study_abroad_interest || null);
          setPreferredCourseLoad(userData.preferred_course_load || '5 courses');
        }
      } catch (error) {
        console.error('Failed to load preferences:', error);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadPreferences();
  }, []);

  const handleSavePreferences = async () => {
    setLoading(true);
    try {
      await saveUserPreferences({
        major: major || undefined,
        minor: minor || undefined,
        target_graduation: expectedGraduation ? expectedGraduation.toISOString() : undefined,
        incoming_credits: incomingCredits ? Number(incomingCredits) : undefined,
        interests: interests || undefined,
        study_abroad_interest: studyAbroadInterest || undefined,
        preferred_course_load: preferredCourseLoad || undefined,
      });

      notifications.show({
        title: 'Success!',
        message: 'Your preferences have been saved',
        color: 'green',
      });
    } catch (error) {
      console.error('Failed to save preferences:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to save preferences. Please try again.',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingData) {
    return (
      <Container size="md" p="lg">
        <Text>Loading preferences...</Text>
      </Container>
    );
  }

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
              value={major}
              onChange={setMajor}
              withAsterisk
            />

            <Select
              label="Minor"
              placeholder="Select your minor (optional)"
              data={[
                'Computer Science',
                'Business Administration',
                'Biology',
                'Psychology',
                'Engineering',
                'Communications',
                'Mathematics',
                'Statistics',
                'Economics',
                'Philosophy',
                'History',
                'English',
              ]}
              value={minor}
              onChange={setMinor}
              clearable
            />

            <NumberInput
              label="Incoming Credits"
              placeholder="AP/Transfer credits"
              description="Total credits you're entering with"
              min={0}
              max={128}
              value={incomingCredits}
              onChange={setIncomingCredits}
            />

            <DateInput
              label="Expected Graduation"
              placeholder="Select graduation date"
              description="Select your expected graduation date"
              value={expectedGraduation}
              onChange={(value) => {
                if (typeof value === 'string') {
                  setExpectedGraduation(value ? new Date(value) : null);
                } else {
                  setExpectedGraduation(value);
                }
              }}
              valueFormat="MMMM YYYY"
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
              value={interests}
              onChange={setInterests}
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
              value={studyAbroadInterest}
              onChange={setStudyAbroadInterest}
            />

            <Select
              label="Preferred Course Load"
              placeholder="Classes per semester"
              data={['4 courses', '5 courses', '6 courses']}
              value={preferredCourseLoad}
              onChange={setPreferredCourseLoad}
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
          onClick={handleSavePreferences}
          loading={loading}
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