import React from 'react';
import { Title, Button, Container, Box, Text, ActionIcon, Group } from '@mantine/core';
import { IconSettings, IconMessageCircle, IconCards, IconBookmark } from '@tabler/icons-react';
import { TabName } from '../App';

interface HomePageProps {
  setActiveTab: (tab: TabName) => void;
}

const HomePage: React.FC<HomePageProps> = ({ setActiveTab }) => {
  return (
    <Box
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Background Image */}
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'url("https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?q=80&w=2574")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: 0,
        }}
      />
      
      {/* Dark Overlay (Scrim) */}
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          zIndex: 1,
        }}
      />

      {/* Floating Navigation Icons */}
      <Box
        style={{
          position: 'fixed',
          top: '2rem',
          right: '2rem',
          zIndex: 100,
        }}
      >
        <Group gap="sm">
          <ActionIcon
            size="xl"
            radius="xl"
            variant="filled"
            color="rgba(255, 255, 255, 0.2)"
            onClick={() => setActiveTab('preferences')}
            style={{
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s ease',
            }}
            styles={{
              root: {
                '&:hover': {
                  transform: 'scale(1.1)',
                  backgroundColor: 'rgba(204, 0, 0, 0.9)',
                },
              },
            }}
          >
            <IconSettings size={24} color="white" />
          </ActionIcon>
          <ActionIcon
            size="xl"
            radius="xl"
            variant="filled"
            color="rgba(255, 255, 255, 0.2)"
            onClick={() => setActiveTab('questions')}
            style={{
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s ease',
            }}
            styles={{
              root: {
                '&:hover': {
                  transform: 'scale(1.1)',
                  backgroundColor: 'rgba(204, 0, 0, 0.9)',
                },
              },
            }}
          >
            <IconMessageCircle size={24} color="white" />
          </ActionIcon>
          <ActionIcon
            size="xl"
            radius="xl"
            variant="filled"
            color="rgba(255, 255, 255, 0.2)"
            onClick={() => setActiveTab('swiper')}
            style={{
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s ease',
            }}
            styles={{
              root: {
                '&:hover': {
                  transform: 'scale(1.1)',
                  backgroundColor: 'rgba(204, 0, 0, 0.9)',
                },
              },
            }}
          >
            <IconCards size={24} color="white" />
          </ActionIcon>
          <ActionIcon
            size="xl"
            radius="xl"
            variant="filled"
            color="rgba(255, 255, 255, 0.2)"
            onClick={() => setActiveTab('bookmarks')}
            style={{
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s ease',
            }}
            styles={{
              root: {
                '&:hover': {
                  transform: 'scale(1.1)',
                  backgroundColor: 'rgba(204, 0, 0, 0.9)',
                },
              },
            }}
          >
            <IconBookmark size={24} color="white" />
          </ActionIcon>
        </Group>
      </Box>

      {/* Content */}
      <Container
        style={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        {/* Hero Title */}
        <Title
          order={1}
          style={{
            fontSize: 'clamp(3rem, 8vw, 6rem)',
            fontWeight: 900,
            color: 'white',
            marginBottom: '1rem',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          Welcome to{' '}
          <Box component="span" c="bu-red">
            PlanEdu
          </Box>
        </Title>

        {/* Subtitle */}
        <Text
          size="xl"
          style={{
            fontSize: 'clamp(1.25rem, 3vw, 2rem)',
            fontWeight: 300,
            color: 'rgba(255, 255, 255, 0.9)',
            marginBottom: '3rem',
            maxWidth: '800px',
            margin: '0 auto 3rem',
          }}
        >
          Your AI-powered university planner
        </Text>

        {/* CTA Button with Glow */}
        <Button
          onClick={() => setActiveTab('preferences')}
          color="bu-red"
          size="xl"
          radius="xl"
          tt="uppercase"
          style={{
            fontSize: '1.125rem',
            padding: '1.5rem 3rem',
            height: 'auto',
            boxShadow: '0 0 40px rgba(204, 0, 0, 0.5), 0 4px 20px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.3s ease',
          }}
          styles={{
            root: {
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 0 60px rgba(204, 0, 0, 0.7), 0 6px 30px rgba(0, 0, 0, 0.4)',
              },
            },
          }}
        >
          Create 4-Year Plan
        </Button>
      </Container>
    </Box>
  );
};

export default HomePage;
