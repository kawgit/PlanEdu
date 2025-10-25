import React from 'react';
// 1. Import 'useMantineTheme' instead of 'createStyles'
import { Container, Title, Text, Paper, useMantineTheme } from '@mantine/core';

const ClassSwiperPage: React.FC = () => {
  // 2. Call the hook to get the theme object
  const theme = useMantineTheme();

  return (
    <Container ta="center">
      <Title order={2} mb="md">
        Class Swiper (HUBSWIPE)
      </Title>
      <Text c="dimmed">
        This is where the Tinder-style card swiper for classes will go. (Phase 3)
      </Text>

      <Paper
        withBorder
        shadow="xl"
        p="xl"
        mt="xl"
        // 3. Use the 'style' prop and the theme object directly
        style={{
          height: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: 350,
          margin: '2rem auto',
          borderStyle: 'dashed',
          borderColor: theme.colors['bu-red'][6],
        }}
      >
        {/* 4. Use the 'style' prop for the text as well */}
        <Text
          style={{
            color: theme.colors['bu-red'][6],
            fontWeight: 500,
          }}
        >
          Class Card Stack
        </Text>
      </Paper>
    </Container>
  );
};

export default ClassSwiperPage;

