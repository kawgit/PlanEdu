import React, { useEffect, useState } from 'react';
import { Container, Title, Text, Card, Group, Badge, Button, Stack, Box, Loader } from '@mantine/core';
import { IconBookmark, IconX, IconClock, IconInfoCircle } from '@tabler/icons-react';
import { getUserGoogleId } from '../utils/auth';
import { BookmarkedClass } from '../App';
import { notifications } from '@mantine/notifications';

interface ClassCard {
  id: number;
  school: string;
  department: string;
  number: number;
  title: string;
  description: string;
  hub_areas?: string[];
  typical_credits?: number;
  score?: number;
}

interface ClassSwiperPageProps {
  addBookmark?: (course: BookmarkedClass) => void;
}

const ClassSwiperPage: React.FC<ClassSwiperPageProps> = ({ addBookmark }) => {
  const [classes, setClasses] = useState<ClassCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swipeCount, setSwipeCount] = useState(0);
  interface UserPreferences {
    major?: string;
    minor?: string;
    interests?: string;
  }
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);

  useEffect(() => {
    fetchUserPreferences();
    fetchRecommendedClasses();
  }, []);

  const fetchUserPreferences = async () => {
    try {
      const googleId = getUserGoogleId();
      if (!googleId) return;

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/user?googleId=${googleId}`);
      
      if (response.ok) {
        const userData = await response.json();
        setUserPreferences(userData);
      }
    } catch (error) {
      console.error('Error fetching user preferences:', error);
    }
  };

  const fetchRecommendedClasses = async () => {
    try {
      setLoading(true);
      const googleId = getUserGoogleId();
      
      if (!googleId) {
        throw new Error('Not authenticated');
      }

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(
        `${backendUrl}/api/recommendations?googleId=${googleId}&limit=30`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }

      const data = await response.json();
      setClasses(data);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Error fetching classes:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load course recommendations',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const currentClass = classes[currentIndex];

  const handleSwipe = async (bookmarked: boolean) => {
    if (!currentClass) return;

    try {
      const googleId = getUserGoogleId();
      
      if (!googleId) {
        throw new Error('Not authenticated');
      }

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      
      // Save interaction to backend
      await fetch(`${backendUrl}/api/user/interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleId,
          classId: currentClass.id,
          interactionType: bookmarked ? 'bookmark' : 'discard',
        }),
      });

      if (bookmarked && addBookmark) {
        // Transform to match expected bookmark format
        const courseCode = `${currentClass.school} ${currentClass.department} ${currentClass.number}`;
        addBookmark(currentClass);
        
        notifications.show({
          title: 'Course Bookmarked!',
          message: `${courseCode} - ${currentClass.title}`,
          color: 'green',
        });
      } else if (!bookmarked) {
        // Just move to the next card - no need to track discards
        // Optionally show a subtle notification
        notifications.show({
          title: 'Skipped',
          message: 'Moving to next course',
          color: 'gray',
          autoClose: 1500,
        });
      }

      setSwipeCount(prev => prev + 1);
      
      // Move to next card
      if (currentIndex < classes.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // Fetch more recommendations when running out
        await fetchRecommendedClasses();
      }
    } catch (error) {
      console.error('Error saving swipe:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to save your choice',
        color: 'red',
      });
    }
  };

  if (loading) {
    return (
      <Container size="sm" p="lg" ta="center">
        <Loader size="lg" />
        <Text mt="md">Loading personalized recommendations...</Text>
      </Container>
    );
  }

  if (!currentClass || classes.length === 0) {
    return (
      <Container size="sm" p="lg" ta="center">
        <Title order={2} c="bu-red">No More Courses</Title>
        <Text mt="md">
          {!userPreferences || (!userPreferences.major && !userPreferences.minor && !userPreferences.interests)
            ? "Set your preferences to get personalized recommendations!"
            : "You've seen all available recommendations!"}
        </Text>
        <Button onClick={fetchRecommendedClasses} mt="lg" color="bu-red">
          Refresh Recommendations
        </Button>
      </Container>
    );
  }

  const courseCode = `${currentClass.school} ${currentClass.department} ${currentClass.number}`;
  const hubArea = currentClass.hub_areas?.[0] || 'General Education';
  const credits = currentClass.typical_credits || 4;

  return (
    <Box
      style={{
        height: 'calc(100vh - 80px)', // Full viewport height minus navigation bar
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden', // Prevent page-level scrolling
      }}
    >
      <Container 
        size="sm" 
        p="lg" 
        ta="center"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Header section */}
        <Box style={{ flexShrink: 0 }}>
          <Title order={2} mb="xs" c="bu-red">
            Course Recommendations
          </Title>
          <Text c="dimmed" mb="md" size="sm">
            Personalized based on your preferences
          </Text>
          
          {/* Show active preference filters */}
          {userPreferences && (userPreferences.major || userPreferences.minor || userPreferences.interests) && (
            <Group justify="center" gap="xs" mb="lg">
              {userPreferences.major && (
                <Badge variant="light" color="blue" leftSection={<IconInfoCircle size={14} />}>
                  Major: {userPreferences.major}
                </Badge>
              )}
              {userPreferences.minor && (
                <Badge variant="light" color="green">
                  Minor: {userPreferences.minor}
                </Badge>
              )}
              {userPreferences.interests && (
                <Badge variant="light" color="violet">
                  Interest: {userPreferences.interests}
                </Badge>
              )}
            </Group>
          )}
        </Box>

        {/* Card Stack Preview - grows to fill available space */}
        <Box style={{ flex: 1, position: 'relative', minHeight: 0, marginBottom: '1rem', zIndex: 1, overflow: 'hidden' }}>
          <Box style={{ position: 'relative', height: '100%', maxHeight: '500px', margin: '0 auto', overflow: 'hidden' }}>
            {/* Background cards for depth */}
            {[0.5, 0.7].map((opacity, idx) => (
              <Card
                key={idx}
                shadow="md"
                p="xl"
                radius="lg"
                withBorder
                style={{
                  position: 'absolute',
                  top: `${(idx + 1) * 10}px`,
                  left: '50%',
                  transform: `translateX(-50%) scale(${0.95 + idx * 0.02})`,
                  width: `${90 + idx * 5}%`,
                  maxWidth: '400px',
                  maxHeight: '500px',
                  opacity,
                  zIndex: idx + 1,
                  overflow: 'hidden',
                }}
              >
                <Box style={{ height: '350px' }} />
              </Card>
            ))}

            {/* Main card */}
            <Card
              shadow="xl"
              p="xl"
              radius="lg"
              withBorder
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '100%',
                maxWidth: '400px',
                maxHeight: '500px',
                zIndex: 3,
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <Stack gap="md" style={{ height: '100%', overflow: 'hidden' }}>
                {/* Header */}
                <Box style={{ flexShrink: 0 }}>
                  <Badge color="red" variant="light" mb="xs">
                    {hubArea}
                  </Badge>
                  <Title order={3} c="bu-red" mb="xs">
                    {courseCode}
                  </Title>
                  <Text fw={600} size="lg" mb="md">
                    {currentClass.title}
                  </Text>
                </Box>

                {/* Description - scrollable if needed */}
                <Box style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                  <Text size="sm" c="dimmed" style={{ textAlign: 'left' }}>
                    {currentClass.description || 'No description available.'}
                  </Text>
                </Box>

                {/* Stats */}
                <Group justify="space-between" mt="md" style={{ flexShrink: 0 }}>
                  <Group gap="xs">
                    <IconClock size={18} color="#868e96" />
                    <Text size="sm" c="dimmed">
                      {credits} credits
                    </Text>
                  </Group>
                  {currentClass.score && (
                    <Badge variant="light" color="green">
                      {Math.min(100, Math.round(currentClass.score))}% Match
                    </Badge>
                  )}
                </Group>
              </Stack>
            </Card>
          </Box>
        </Box>

        {/* Bottom section - buttons and status */}
        <Box style={{ flexShrink: 0, position: 'relative', zIndex: 10, paddingTop: '1rem', background: 'transparent' }}>
          {/* Swipe Buttons */}
          <Group justify="center" gap="xl" mb="md" style={{ position: 'relative', zIndex: 11 }}>
            <Button
              variant="outline"
              color="gray"
              size="xl"
              radius="xl"
              leftSection={<IconX size={24} />}
              onClick={() => handleSwipe(false)}
              style={{ 
                width: '180px', 
                minHeight: '60px',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.3s ease',
                opacity: 1,
                backgroundColor: 'white'
              }}
            >
              Discard
            </Button>

            <Button
              variant="filled"
              color="bu-red"
              size="xl"
              radius="xl"
              leftSection={<IconBookmark size={24} />}
              onClick={() => handleSwipe(true)}
              style={{ 
                width: '180px',
                minHeight: '60px',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.3s ease',
                opacity: 1
              }}
            >
              Bookmark
            </Button>
          </Group>

          <Text size="xs" c="dimmed" style={{ opacity: 1, position: 'relative', zIndex: 11 }}>
            {currentIndex + 1} / {classes.length} • {swipeCount} swipes today
          </Text>
        </Box>
      </Container>
    </Box>
  );
};

export default ClassSwiperPage;
