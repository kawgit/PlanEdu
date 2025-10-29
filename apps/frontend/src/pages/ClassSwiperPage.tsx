import React, { useEffect, useState } from 'react';
import { Container, Title, Text, Card, Group, Badge, Button, Stack, Box, Loader, ActionIcon, Modal } from '@mantine/core';
import { IconBookmark, IconX, IconClock, IconInfoCircle } from '@tabler/icons-react';
import { getUserGoogleId } from '../utils/auth';
import { BookmarkedClass } from '../App';
import { track } from '../utils/analytics';
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
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      return localStorage.getItem('seenOnboarding') !== '1';
    } catch { return true; }
  });
  const [helpOpen, setHelpOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchUserPreferences();
    fetchRecommendedClasses();
    // keyboard shortcuts
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleSwipe(true);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSwipe(false);
      } else if (e.code === 'Enter') {
        e.preventDefault();
        openDetails();
      }
    };

    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
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
  const canonicalScore = currentClass
    ? (currentClass.score ?? (currentClass as any)._recommendation_score ?? (currentClass as any).final_score ?? null)
    : null;

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
        try { track('skip', { courseId: currentClass.id }); } catch {}
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
      try { track('error', { action: 'swipe', message: (error as Error).message }); } catch {}
      notifications.show({
        title: 'Error',
        message: 'Failed to save your choice',
        color: 'red',
      });
    }
  };

  const openDetails = () => {
    if (!currentClass) return;
    setDetailsOpen(true);
    try { track('open_details', { courseId: currentClass.id }); } catch {}
  };

  // Basic touch swipe for mobile (left/right)
  useEffect(() => {
    let startX: number | null = null;
    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
    const onTouchEnd = (e: TouchEvent) => {
      if (startX === null) return;
      const endX = (e.changedTouches && e.changedTouches[0].clientX) || 0;
      const dx = endX - startX;
      // swipe right = skip, swipe left = bookmark (comfortable mapping)
      if (Math.abs(dx) > 50) {
        if (dx > 0) handleSwipe(false);
        else handleSwipe(true);
      }
      startX = null;
    };

    const el = document.querySelector('body');
    el?.addEventListener('touchstart', onTouchStart, { passive: true });
    el?.addEventListener('touchend', onTouchEnd);

    return () => {
      el?.removeEventListener('touchstart', onTouchStart as EventListener);
      el?.removeEventListener('touchend', onTouchEnd as EventListener);
    };
  }, [currentIndex, classes]);

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
        background: 'transparent'
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
              {/* Main card (minimal) */}
        <Card
                shadow="sm"
                p="md"
                radius="lg"
                withBorder
                style={{
                  position: 'absolute',
                  top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '420px',
                  maxHeight: '500px',
                  zIndex: 3,
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
              <Stack gap="md" style={{ height: '100%', overflow: 'hidden' }}>
                {/* Header */}
                <Box style={{ flexShrink: 0 }}>
                  <Text size="xs" c="dimmed" mb="xs">{hubArea}</Text>
                  <Title order={3} c="bu-red" mb="xs">
                    {courseCode}
                  </Title>
                  <Text fw={600} size="lg" mb="md">
                    {currentClass.title}
                  </Text>
                  <Box style={{ position: 'absolute', right: 12, top: 12 }}>
                    <ActionIcon size="sm" onClick={() => setHelpOpen(true)} aria-label="Help">
                      <IconInfoCircle size={18} />
                    </ActionIcon>
                  </Box>
                </Box>

                {/* Description - scrollable if needed */}
                <Box style={{ flex: 1, minHeight: 0 }}>
                  <Text
                    size="sm"
                    c="dimmed"
                    style={{
                      textAlign: 'left',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
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
                  {canonicalScore !== null && (
                    <Badge variant="light" color="green">
                      {Math.min(100, Math.round(canonicalScore))}% Match
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
          <Group justify="center" gap="md" mb="md" style={{ position: 'relative', zIndex: 11, padding: '12px 0' }}>
            <ActionIcon
              variant="transparent"
              color="gray"
              size="xl"
              onClick={() => handleSwipe(false)}
              aria-label="Discard course"
              title="Discard"
              style={{ width: 56, height: 56 }}
            >
              <IconX size={24} />
            </ActionIcon>

            <Button
              variant="filled"
              color="bu-red"
              size="xl"
              radius="xl"
              leftSection={<IconBookmark size={20} />}
              onClick={() => handleSwipe(true)}
              aria-label="Bookmark course"
              style={{ 
                minWidth: 180,
                minHeight: 56,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              Bookmark
            </Button>
          </Group>

          <Modal opened={showOnboarding} onClose={() => { setShowOnboarding(false); try { localStorage.setItem('seenOnboarding', '1'); } catch {} }} title="Welcome">
            <Text>Swipe to discover, tap Bookmark to save — recommendations are personalized for you.</Text>
            <Button mt="md" fullWidth onClick={() => { setShowOnboarding(false); try { localStorage.setItem('seenOnboarding', '1'); } catch {} }}>Got it</Button>
          </Modal>

          <Modal opened={helpOpen} onClose={() => setHelpOpen(false)} title="Tips">
            <Stack>
              <Text size="sm">• Tap Bookmark to save a class.</Text>
              <Text size="sm">• Use Space to bookmark, Arrow → to skip.</Text>
              <Text size="sm">• Open course details with Enter.</Text>
            </Stack>
          </Modal>

          <Modal opened={detailsOpen} onClose={() => setDetailsOpen(false)} title={currentClass ? `${currentClass.school}-${currentClass.department}-${currentClass.number}` : 'Details'} size="lg">
            {currentClass ? (
              <Stack>
                <Text fw={700}>{currentClass.title}</Text>
                <Text size="sm" c="dimmed">{currentClass.description}</Text>
                <Button color="bu-red" onClick={() => { handleSwipe(true); setDetailsOpen(false); }}>Bookmark</Button>
              </Stack>
            ) : null}
          </Modal>

          <Text size="xs" c="dimmed" style={{ opacity: 1, position: 'relative', zIndex: 11 }}>
            {currentIndex + 1} / {classes.length} • {swipeCount} swipes today
          </Text>
        </Box>
      </Container>
    </Box>
  );
};

export default ClassSwiperPage;
