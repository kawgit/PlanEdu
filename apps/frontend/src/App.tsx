import React, { useState } from 'react';
import { AppShell, Tabs, Box } from '@mantine/core';
import { 
  IconHome, 
  IconSettings, 
  IconStack2, 
  IconBookmark, 
  IconQuestionMark 
} from '@tabler/icons-react';

// Import your page components
import HomePage from './pages/HomePage';
import PreferencesPage from './pages/PreferencesPage';
import ClassSwiperPage from './pages/ClassSwiperPage';
import BookmarksPage from './pages/BookmarksPage';
import QuestionsPage from './pages/QuestionsPage';

// Define the valid tab names for type safety
export type TabName = 'home' | 'preferences' | 'swiper' | 'bookmarks' | 'questions';

function App() {
  const [activeTab, setActiveTab] = useState<TabName>('home');

  // Helper to render the correct page content
  const renderPage = () => {
    switch (activeTab) {
      case 'home':
        return <HomePage setActiveTab={setActiveTab} />;
      case 'preferences':
        return <PreferencesPage />;
      case 'swiper':
        return <ClassSwiperPage />;
      case 'bookmarks':
        return <BookmarksPage />;
      case 'questions':
        return <QuestionsPage />;
      default:
        return <HomePage setActiveTab={setActiveTab} />;
    }
  };

  return (
    <AppShell
      // This footer holds your navigation tabs
      footer={
        <Tabs
          value={activeTab}
          onTabChange={(value) => setActiveTab(value as TabName)}
          // Use 'bu-red' (or your primaryColor) as the active color
          color="bu-red" 
        >
          <Tabs.List grow position="center">
            <Tabs.Tab value="home" icon={<IconHome size="1rem" />}>Home</Tabs.Tab>
            <Tabs.Tab value="preferences" icon={<IconSettings size="1rem" />}>Preferences</Tabs.Tab>
            <Tabs.Tab value="swiper" icon={<IconStack2 size="1rem" />}>Swiper</Tabs.Tab>
            <Tabs.Tab value="bookmarks" icon={<IconBookmark size="1rem" />}>Bookmarks</Tabs.Tab>
            <Tabs.Tab value="questions" icon={<IconQuestionMark size="1rem" />}>Questions</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      }
    >
      {/* The main page content is rendered here */}
      <Box p="md">
        {renderPage()}
      </Box>
    </AppShell>
  );
}

export default App;