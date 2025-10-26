import React, { useEffect, useState } from 'react';
import { Container, Title, Text, Card, Group, Badge, Button, Stack, Box, Loader } from '@mantine/core';
import { IconHeart, IconX, IconClock } from '@tabler/icons-react';
import { getUserGoogleId } from '../utils/auth';
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
  addBookmark?: (course: any) => void;
}

const ClassSwiperPage: React.FC<ClassSwiperPageProps> = ({ addBookmark }) => {
  const [classes, setClasses] = useState<ClassCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swipeCount, setSwipeCount] = useState(0);

  useEffect(() => {
    fetchRecommendedClasses();
  }, []);

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

  const handleSwipe = async (liked: boolean) => {
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
          interactionType: liked ? 'like' : 'pass',
        }),
      });

      if (liked && addBookmark) {
        // Transform to match expected bookmark format
        const courseCode = `${currentClass.school} ${currentClass.department} ${currentClass.number}`;
        addBookmark({
          code: courseCode,
          title: currentClass.title,
          description: currentClass.description,
          credits: currentClass.typical_credits || 4,
        });
        
        notifications.show({
          title: 'Course Liked!',
          message: `${courseCode} added to bookmarks`,
          color: 'green',
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
        <Text mt="md">You've seen all available recommendations!</Text>
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
    <Container size="sm" p="lg" ta="center">
      <Title order={2} mb="xs" c="bu-red">
        Class Swiper
      </Title>
      <Text c="dimmed" mb="xl" size="sm">
        Swipe through personalized course recommendations
      </Text>

      {/* Card Stack Preview */}
      <Box style={{ position: 'relative', height: '500px', marginBottom: '2rem' }}>
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
              opacity,
              zIndex: idx + 1,
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
            zIndex: 3,
            transition: 'all 0.3s ease',
          }}
        >
          <Stack gap="md">
            {/* Header */}
            <Box>
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

            {/* Description */}
            <Text size="sm" c="dimmed" style={{ textAlign: 'left', minHeight: '100px' }}>
              {currentClass.description || 'No description available.'}
            </Text>

            {/* Stats */}
            <Group justify="space-between" mt="md">
              <Group gap="xs">
                <IconClock size={18} color="#868e96" />
                <Text size="sm" c="dimmed">
                  {credits} credits
                </Text>
              </Group>
              {currentClass.score && (
                <Badge variant="light" color="green">
                  {Math.round(currentClass.score)}% Match
                </Badge>
              )}
            </Group>
          </Stack>
        </Card>
      </Box>

      {/* Swipe Buttons */}
      <Group justify="center" gap="xl">
        <Button
          variant="outline"
          color="red"
          size="xl"
          radius="xl"
          leftSection={<IconX size={24} />}
          onClick={() => handleSwipe(false)}
          style={{ width: '140px', transition: 'all 0.3s ease' }}
        >
          Pass
        </Button>

        <Button
          variant="filled"
          color="bu-red"
          size="xl"
          radius="xl"
          leftSection={<IconHeart size={24} />}
          onClick={() => handleSwipe(true)}
          style={{ width: '140px', transition: 'all 0.3s ease' }}
        >
          Like
        </Button>
      </Group>

      <Text size="xs" c="dimmed" mt="xl">
        {currentIndex + 1} / {classes.length} • {swipeCount} swipes today
      </Text>
    </Container>
  );
};

export default ClassSwiperPage;

