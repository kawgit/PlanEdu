import React from 'react';
import { Group, Button } from '@mantine/core';
import { TabName } from '../App';

interface NavigationProps {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  return (
    <Group justify="center" p="md" style={{ borderBottom: '1px solid #e0e0e0' }}>
      <Button
        variant={activeTab === 'home' ? 'filled' : 'subtle'}
        color="bu-red"
        onClick={() => setActiveTab('home')}
      >
        Home
      </Button>
      <Button
        variant={activeTab === 'preferences' ? 'filled' : 'subtle'}
        color="bu-red"
        onClick={() => setActiveTab('preferences')}
      >
        Preferences
      </Button>
      <Button
        variant={activeTab === 'questions' ? 'filled' : 'subtle'}
        color="bu-red"
        onClick={() => setActiveTab('questions')}
      >
        Questions
      </Button>
      <Button
        variant={activeTab === 'swiper' ? 'filled' : 'subtle'}
        color="bu-red"
        onClick={() => setActiveTab('swiper')}
      >
        Class Swiper
      </Button>
      <Button
        variant={activeTab === 'bookmarks' ? 'filled' : 'subtle'}
        color="bu-red"
        onClick={() => setActiveTab('bookmarks')}
      >
        Bookmarks
      </Button>
    </Group>
  );
};

export default Navigation;

