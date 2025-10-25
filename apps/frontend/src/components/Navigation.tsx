import React from 'react';
import { Box, UnstyledButton, Text, useMantineTheme } from '@mantine/core';
import { IconHome, IconSettings, IconMessageCircle, IconCards, IconBookmark } from '@tabler/icons-react';
import { TabName } from '../App';

interface NavigationProps {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick }) => {
  const theme = useMantineTheme();
  const buRed = theme.colors['bu-red'][6];

  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        flex: 1,
        padding: '0.75rem 0.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        transform: active ? 'scale(1.05)' : 'scale(1)',
      }}
      styles={{
        root: {
          '&:hover': {
            transform: 'scale(1.08)',
            backgroundColor: 'rgba(204, 0, 0, 0.05)',
          },
        },
      }}
    >
      <Box
        style={{
          color: active ? buRed : '#868e96',
          transition: 'color 0.2s ease',
          marginBottom: '0.25rem',
        }}
      >
        {icon}
      </Box>
      <Text
        size="xs"
        fw={active ? 600 : 400}
        style={{
          color: active ? buRed : '#868e96',
          transition: 'all 0.2s ease',
        }}
      >
        {label}
      </Text>
    </UnstyledButton>
  );
};

const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  return (
    <Box
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderTop: '1px solid #e9ecef',
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)',
        zIndex: 100,
      }}
    >
      <Box
        style={{
          display: 'flex',
          maxWidth: '600px',
          margin: '0 auto',
        }}
      >
        <NavItem
          icon={<IconHome size={24} stroke={1.5} />}
          label="Home"
          active={activeTab === 'home'}
          onClick={() => setActiveTab('home')}
        />
        <NavItem
          icon={<IconSettings size={24} stroke={1.5} />}
          label="Preferences"
          active={activeTab === 'preferences'}
          onClick={() => setActiveTab('preferences')}
        />
        <NavItem
          icon={<IconMessageCircle size={24} stroke={1.5} />}
          label="Questions"
          active={activeTab === 'questions'}
          onClick={() => setActiveTab('questions')}
        />
        <NavItem
          icon={<IconCards size={24} stroke={1.5} />}
          label="Swiper"
          active={activeTab === 'swiper'}
          onClick={() => setActiveTab('swiper')}
        />
        <NavItem
          icon={<IconBookmark size={24} stroke={1.5} />}
          label="Bookmarks"
          active={activeTab === 'bookmarks'}
          onClick={() => setActiveTab('bookmarks')}
        />
      </Box>
    </Box>
  );
};

export default Navigation;

