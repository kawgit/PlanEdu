import React, { useState } from 'react';
import { Container, Title, Text, Card, Group, Badge, Button, Stack, Box, useMantineTheme } from '@mantine/core';
import { IconHeart, IconX, IconStar, IconClock, IconUsers } from '@tabler/icons-react';

interface ClassCard {
  code: string;
  title: string;
  description: string;
  credits: number;
  rating: number;
  enrollment: string;
  hubArea: string;
}

const ClassSwiperPage: React.FC = () => {
  const theme = useMantineTheme();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Example classes (this would come from an API in the real app)
  const classes: ClassCard[] = [
    {
      code: 'CFA AR 101',
      title: 'Introduction to Studio Art',
      description: 'Explore various media including drawing, painting, and sculpture. Perfect for beginners interested in creative expression.',
      credits: 4,
      rating: 4.5,
      enrollment: '18/25',
      hubArea: 'Creative Arts',
    },
    {
      code: 'CAS PS 101',
      title: 'Introduction to Psychology',
      description: 'Survey of major topics in psychology including cognition, development, social psychology, and mental health.',
      credits: 4,
      rating: 4.2,
      enrollment: '120/150',
      hubArea: 'Social Inquiry',
    },
    {
      code: 'CAS PH 100',
      title: 'Philosophical Problems',
      description: 'Introduction to fundamental questions in philosophy through classic and contemporary texts.',
      credits: 4,
      rating: 4.7,
      enrollment: '32/40',
      hubArea: 'Philosophical Inquiry',
    },
  ];

  const currentClass = classes[currentIndex];

  const handleSwipe = (liked: boolean) => {
    console.log(liked ? 'Liked' : 'Passed', currentClass.code);
    setCurrentIndex((prev) => (prev + 1) % classes.length);
  };

  return (
    <Container size="sm" p="lg" ta="center">
      <Title order={2} mb="xs" c="bu-red">
        Class Swiper
      </Title>
      <Text c="dimmed" mb="xl" size="sm">
        Swipe through classes to find your perfect match
      </Text>

      {/* Card Stack Preview */}
      <Box style={{ position: 'relative', height: '500px', marginBottom: '2rem' }}>
        {/* Background cards for depth */}
        <Card
          shadow="md"
          p="xl"
          radius="lg"
          withBorder
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%) scale(0.95)',
            width: '90%',
            maxWidth: '400px',
            opacity: 0.5,
            zIndex: 1,
          }}
        >
          <Box style={{ height: '350px' }} />
        </Card>

        <Card
          shadow="md"
          p="xl"
          radius="lg"
          withBorder
          style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%) scale(0.97)',
            width: '95%',
            maxWidth: '400px',
            opacity: 0.7,
            zIndex: 2,
          }}
        >
          <Box style={{ height: '350px' }} />
        </Card>

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
          styles={{
            root: {
              '&:hover': {
                transform: 'translateX(-50%) translateY(-8px)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
              },
            },
          }}
        >
          <Stack gap="md">
            {/* Header */}
            <Box>
              <Badge color="red" variant="light" mb="xs">
                {currentClass.hubArea}
              </Badge>
              <Title order={3} c="bu-red" mb="xs">
                {currentClass.code}
              </Title>
              <Text fw={600} size="lg" mb="md">
                {currentClass.title}
              </Text>
            </Box>

            {/* Description */}
            <Text size="sm" c="dimmed" style={{ textAlign: 'left' }}>
              {currentClass.description}
            </Text>

            {/* Stats */}
            <Group justify="space-between" mt="md">
              <Group gap="xs">
                <IconStar size={18} color={theme.colors['bu-red'][6]} />
                <Text size="sm" fw={500}>
                  {currentClass.rating}/5
                </Text>
              </Group>

              <Group gap="xs">
                <IconUsers size={18} color="#868e96" />
                <Text size="sm" c="dimmed">
                  {currentClass.enrollment}
                </Text>
              </Group>

              <Group gap="xs">
                <IconClock size={18} color="#868e96" />
                <Text size="sm" c="dimmed">
                  {currentClass.credits} credits
                </Text>
              </Group>
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
          style={{
            width: '140px',
            transition: 'all 0.3s ease',
          }}
          styles={{
            root: {
              '&:hover': {
                transform: 'scale(1.1)',
                backgroundColor: 'rgba(255, 0, 0, 0.05)',
              },
            },
          }}
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
          style={{
            width: '140px',
            transition: 'all 0.3s ease',
          }}
          styles={{
            root: {
              '&:hover': {
                transform: 'scale(1.1)',
                boxShadow: '0 8px 24px rgba(204, 0, 0, 0.4)',
              },
            },
          }}
        >
          Like
        </Button>
      </Group>

      <Text size="xs" c="dimmed" mt="xl">
        {currentIndex + 1} / {classes.length}
      </Text>
    </Container>
  );
};

export default ClassSwiperPage;

