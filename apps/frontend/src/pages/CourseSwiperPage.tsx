import React, { useEffect, useState, useRef } from 'react';
import { Container, Title, Text, Card, Group, Badge, Button, Stack, Box, Loader, ActionIcon, Modal } from '@mantine/core';
import { IconBookmark, IconX, IconClock, IconInfoCircle } from '@tabler/icons-react';
import { getUserGoogleId } from '../utils/auth';
import { BookmarkedCourse } from '../App';
import { track } from '../utils/analytics';
import { notifications } from '@mantine/notifications';

interface CourseCard {
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

interface CourseSwiperPageProps {
  addBookmark?: (course: BookmarkedCourse) => void;
}

const CourseSwiperPage: React.FC<CourseSwiperPageProps> = ({ addBookmark }) => {
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swipeCount, setSwipeCount] = useState(0);

  const [userPreferences, setUserPreferences] = useState<{ major?: string; minor?: string; interests?: string } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try { return localStorage.getItem('seenOnboarding') !== '1'; } catch { return true; }
  });
  const [helpOpen, setHelpOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const leftOverlayRef = useRef<HTMLDivElement | null>(null);
  const rightOverlayRef = useRef<HTMLDivElement | null>(null);
  const pointerState = useRef({ dragging: false, startX: 0, startY: 0, translateX: 0, translateY: 0 });

  // fetch user preferences
  useEffect(() => {
    (async () => {
      try {
        const googleId = getUserGoogleId();
        if (!googleId) return;
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const r = await fetch(`${backendUrl}/api/user?googleId=${googleId}`);
        if (r.ok) setUserPreferences(await r.json());
      } catch {}
    })();
  }, []);

  const fetchRecommendedCourses = async () => {
    try {
      setLoading(true);
      const googleId = getUserGoogleId();
      if (!googleId) throw new Error('Not authenticated');
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/recommendations?googleId=${googleId}&limit=30`);
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      const data = await response.json();
      setCourses(data || []);
      setCurrentIndex(0);
    } catch (err) {
      console.error('Error fetching courses:', err);
      notifications.show({ title: 'Error', message: 'Failed to load course recommendations', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendedCourses();

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowRight') {
        e.preventDefault();
        commitSwipe(true);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        commitSwipe(false);
      } else if (e.code === 'Enter') {
        e.preventDefault();
        openDetails();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentCourse = courses[currentIndex];

  const canonicalScore = currentCourse ? (currentCourse.score ?? (currentCourse as any)._recommendation_score ?? (currentCourse as any).final_score ?? null) : null;

  // optimistic commit wrapper used by buttons/keys/swipes
  const commitSwipe = (bookmarked: boolean) => {
    // handle visual count and immediate UI
    setSwipeCount(s => s + 1);
    const last = currentIndex >= courses.length - 1;
    if (!last) {
      setCurrentIndex(i => i + 1);
      // ensure next card renders centered
      setTimeout(() => { if (cardRef.current) cardRef.current.style.transform = 'translateX(-50%)'; }, 16);
    } else fetchRecommendedCourses().catch(() => {});

    // optimistic bookmark
    if (bookmarked && addBookmark && currentCourse) {
      try { addBookmark(currentCourse); } catch {}
      const courseCode = `${currentCourse.school} ${currentCourse.department} ${currentCourse.number}`;
      notifications.show({ title: 'Course Bookmarked!', message: `${courseCode} - ${currentCourse.title}`, color: 'green' });
    } else if (!bookmarked && currentCourse) {
      try { track('skip', { courseId: currentCourse.id }); } catch {}
      notifications.show({ title: 'Skipped', message: 'Moving to next course', color: 'gray', autoClose: 1500 });
    }

    // background persistence
    (async () => {
      try {
        if (!currentCourse) return;
        const googleId = getUserGoogleId();
        if (!googleId) throw new Error('Not authenticated');
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        await fetch(`${backendUrl}/api/user/interaction`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ googleId, courseId: currentCourse.id, interactionType: bookmarked ? 'bookmark' : 'discard' })
        });
      } catch (err) {
        console.error('Failed to persist swipe', err);
        try { track('error', { action: 'swipe', message: (err as Error).message }); } catch {}
      }
    })();
  };

  // wrapper for pointer and keyboard flows so naming is clear
  const handleSwipe = (bookmarked: boolean) => commitSwipe(bookmarked);

  const openDetails = () => {
    if (!currentCourse) return;
    setDetailsOpen(true);
    try { track('open_details', { courseId: currentCourse.id }); } catch {}
  };

  // pointer handlers for drag (keeps card centered baseline)
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    let lastDx = 0;

    const onPointerDown = (e: PointerEvent) => {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      pointerState.current.dragging = true;
      pointerState.current.startX = e.clientX;
      pointerState.current.startY = e.clientY;
      card.style.transition = 'none';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerState.current.dragging) return;
      const dx = e.clientX - pointerState.current.startX;
      const dy = e.clientY - pointerState.current.startY;
      lastDx = dx;
      const rotate = Math.max(-12, Math.min(12, dx / 20));
      // keep baseline centered: translateX(calc(-50% + dx))
      card.style.transform = `translateX(calc(-50% + ${dx}px)) translateY(${dy}px) rotate(${rotate}deg)`;

      // scale overlays slightly (always visible)
      const scale = 1 + Math.min(0.28, Math.abs(dx) / 360);
      if (dx > 0) {
        if (rightOverlayRef.current) rightOverlayRef.current.style.transform = `translateY(-50%) scale(${scale})`;
        if (leftOverlayRef.current) leftOverlayRef.current.style.transform = `translateY(-50%) scale(1)`;
      } else if (dx < 0) {
        if (leftOverlayRef.current) leftOverlayRef.current.style.transform = `translateY(-50%) scale(${scale})`;
        if (rightOverlayRef.current) rightOverlayRef.current.style.transform = `translateY(-50%) scale(1)`;
      } else {
        if (leftOverlayRef.current) leftOverlayRef.current.style.transform = `translateY(-50%) scale(1)`;
        if (rightOverlayRef.current) rightOverlayRef.current.style.transform = `translateY(-50%) scale(1)`;
      }
    };

  const onPointerUp = () => {
      if (!pointerState.current.dragging) return;
      pointerState.current.dragging = false;
      card.style.transition = 'all 220ms ease';
      const threshold = 110;
      if (lastDx > threshold) {
        card.style.transform = `translateX(1200px) rotate(10deg)`;
        commitSwipe(true);
      } else if (lastDx < -threshold) {
        card.style.transform = `translateX(-1200px) rotate(-10deg)`;
        commitSwipe(false);
      } else {
        // snap back
    // restore centered baseline
    card.style.transform = 'translateX(-50%)';
        if (leftOverlayRef.current) leftOverlayRef.current.style.transform = `translateY(-50%) scale(1)`;
        if (rightOverlayRef.current) rightOverlayRef.current.style.transform = `translateY(-50%) scale(1)`;
      }

      // reset overlay scale after a short delay
      setTimeout(() => {
        if (leftOverlayRef.current) leftOverlayRef.current.style.transform = `translateY(-50%) scale(1)`;
        if (rightOverlayRef.current) rightOverlayRef.current.style.transform = `translateY(-50%) scale(1)`;
    if (cardRef.current) { cardRef.current.style.transition = ''; cardRef.current.style.transform = 'translateX(-50%)'; }
      }, 260);
    };

    card.addEventListener('pointerdown', onPointerDown as EventListener);
    window.addEventListener('pointermove', onPointerMove as EventListener);
    window.addEventListener('pointerup', onPointerUp as EventListener);

    return () => {
      card.removeEventListener('pointerdown', onPointerDown as EventListener);
      window.removeEventListener('pointermove', onPointerMove as EventListener);
      window.removeEventListener('pointerup', onPointerUp as EventListener);
    };
  }, [currentIndex, courses]);

  if (loading) return (
    <Container size="sm" p="lg" ta="center">
      <Loader size="lg" />
      <Text mt="md">Loading personalized recommendations...</Text>
    </Container>
  );

  if (!currentCourse) return (
    <Container size="sm" p="lg" ta="center">
      <Title order={2} c="bu-red">No More Courses</Title>
      <Text mt="md">{!userPreferences ? 'Set your preferences to get personalized recommendations!' : "You've seen all available recommendations!"}</Text>
      <Button onClick={fetchRecommendedCourses} mt="lg" color="bu-red">Refresh Recommendations</Button>
    </Container>
  );

  const courseCode = `${currentCourse.school} ${currentCourse.department} ${currentCourse.number}`;
  const hubArea = currentCourse.hub_areas?.[0] || 'General Education';
  const credits = currentCourse.typical_credits || 4;

  return (
    <Box style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Container size="sm" p="lg" ta="center" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <Box style={{ flexShrink: 0 }}>
          <Title order={2} mb="xs" c="bu-red">Course Recommendations</Title>
          <Text c="dimmed" mb="md" size="sm">Personalized based on your preferences</Text>

          {userPreferences && (userPreferences.major || userPreferences.minor || userPreferences.interests) && (
            <Group justify="center" gap="xs" mb="lg">
              {userPreferences.major && <Badge variant="light" color="blue" leftSection={<IconInfoCircle size={14} />}>Major: {userPreferences.major}</Badge>}
              {userPreferences.minor && <Badge variant="light" color="green">Minor: {userPreferences.minor}</Badge>}
              {userPreferences.interests && <Badge variant="light" color="violet">Interest: {userPreferences.interests}</Badge>}
            </Group>
          )}
        </Box>

        {/* overlays (fixed far left/right) */}
        <div ref={leftOverlayRef} style={{ position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%) scale(1)', zIndex: 9999, pointerEvents: 'none', transition: 'transform 180ms ease' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.88), rgba(240,248,255,0.72))', backdropFilter: 'blur(10px)', padding: '10px 16px', borderRadius: 20, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', color: '#071236', fontWeight: 800, fontSize: 14, letterSpacing: 0.4, textAlign: 'center', transform: 'skewX(-4deg)' }}>
            <span style={{ display: 'inline-block', transform: 'skewX(4deg)', padding: '2px 4px', borderRadius: 10 }}>Swipe left to reject</span>
          </div>
        </div>

        <div ref={rightOverlayRef} style={{ position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%) scale(1)', zIndex: 9999, pointerEvents: 'none', transition: 'transform 180ms ease' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.94), rgba(245,255,250,0.8))', backdropFilter: 'blur(12px)', padding: '10px 18px', borderRadius: 22, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', color: '#071236', fontWeight: 800, fontSize: 13, letterSpacing: 0.3, textAlign: 'center', transform: 'skewX(-4deg)' }}>
            <span style={{ display: 'inline-block', transform: 'skewX(4deg)', padding: '2px 6px', borderRadius: 10 }}>Swipe right to bookmark</span>
          </div>
        </div>

        <Box style={{ flex: 1, position: 'relative', minHeight: 0, marginBottom: '1rem', zIndex: 1, overflow: 'hidden' }}>
          <Box style={{ position: 'relative', height: '100%', maxHeight: 520, margin: '0 auto', overflow: 'hidden' }}>
            <Card ref={cardRef as any} shadow="sm" p="md" radius="lg" withBorder style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 420, maxHeight: 520, zIndex: 3, transition: 'all 200ms ease', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Stack gap="md" style={{ height: '100%', overflow: 'hidden' }}>
                <Box style={{ flexShrink: 0 }}>
                  <Text size="xs" c="dimmed" mb="xs">{hubArea}</Text>
                  <Title order={3} c="bu-red" mb="xs">{courseCode}</Title>
                  <Text fw={600} size="lg" mb="md">{currentCourse.title}</Text>
                  <Box style={{ position: 'absolute', right: 12, top: 12 }}>
                    <ActionIcon size="sm" onClick={() => setHelpOpen(true)} aria-label="Help"><IconInfoCircle size={18} /></ActionIcon>
                  </Box>
                </Box>

                <Box style={{ flex: 1, minHeight: 0 }}>
                  <Text size="sm" c="dimmed" style={{ textAlign: 'left', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{currentCourse.description || 'No description available.'}</Text>
                </Box>

                <Group justify="space-between" mt="md" style={{ flexShrink: 0 }}>
                  <Group gap="xs"><IconClock size={18} color="#868e96" /><Text size="sm" c="dimmed">{credits} credits</Text></Group>
                  {canonicalScore !== null && <Badge variant="light" color="green">{Math.min(100, Math.round(canonicalScore))}% Match</Badge>}
                </Group>
              </Stack>
            </Card>
          </Box>
        </Box>

        <Box style={{ flexShrink: 0, position: 'relative', zIndex: 10, paddingTop: '1rem', background: 'transparent' }}>
          <Group justify="center" gap="md" mb="md" style={{ position: 'relative', zIndex: 11, padding: '12px 0' }}>
            <ActionIcon variant="transparent" color="gray" size="xl" onClick={() => handleSwipe(false)} aria-label="Discard course" title="Discard" style={{ width: 56, height: 56 }}><IconX size={24} /></ActionIcon>
            <Button variant="filled" color="bu-red" size="xl" radius="xl" leftSection={<IconBookmark size={20} />} onClick={() => handleSwipe(true)} aria-label="Bookmark course" style={{ minWidth: 180, minHeight: 56, display: 'flex', alignItems: 'center' }}>Bookmark</Button>
          </Group>

          <Modal opened={showOnboarding} onClose={() => { setShowOnboarding(false); try { localStorage.setItem('seenOnboarding', '1'); } catch {} }} title="Welcome">
            <Text>Swipe to discover, tap Bookmark to save — recommendations are personalized for you.</Text>
            <Button mt="md" fullWidth onClick={() => { setShowOnboarding(false); try { localStorage.setItem('seenOnboarding', '1'); } catch {} }}>Got it</Button>
          </Modal>

          <Modal opened={helpOpen} onClose={() => setHelpOpen(false)} title="Tips">
            <Stack>
              <Text size="sm">• Tap Bookmark to save a course.</Text>
              <Text size="sm">• Use Space or Arrow → to bookmark, Arrow ← to discard.</Text>
              <Text size="sm">• Open course details with Enter.</Text>
            </Stack>
          </Modal>

          <Modal opened={detailsOpen} onClose={() => setDetailsOpen(false)} title={currentCourse ? `${currentCourse.school}-${currentCourse.department}-${currentCourse.number}` : 'Details'} size="lg">
            {currentCourse ? (
              <Stack>
                <Text fw={700}>{currentCourse.title}</Text>
                <Text size="sm" c="dimmed">{currentCourse.description}</Text>
                <Button color="bu-red" onClick={() => { handleSwipe(true); setDetailsOpen(false); }}>Bookmark</Button>
              </Stack>
            ) : null}
          </Modal>

          <Text size="xs" c="dimmed" style={{ opacity: 1, position: 'relative', zIndex: 11 }}>{currentIndex + 1} / {courses.length} • {swipeCount} swipes today</Text>
        </Box>
      </Container>
    </Box>
  );
};

export default CourseSwiperPage;
