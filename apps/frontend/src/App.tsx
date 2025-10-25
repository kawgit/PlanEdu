import React, { useState } from 'react';
import { Box } from '@mantine/core';
import Navigation from './components/Navigation';
import HomePage from './pages/HomePage';
import SignInPage from './pages/SignInPage';
import PreferencesPage from './pages/PreferencesPage';
import QuestionsPage from './pages/QuestionsPage';
import ClassSwiperPage from './pages/ClassSwiperPage';
import BookmarksPage from './pages/BookmarksPage';
import ScheduleBuilderPage from './pages/ScheduleBuilderPage';

export type TabName = 'home' | 'signin' | 'preferences' | 'questions' | 'swiper' | 'bookmarks' | 'schedule-builder';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabName>('signin');

  const renderPage = () => {
    switch (activeTab) {
      case 'signin':
        return <SignInPage setActiveTab={setActiveTab} />;
      case 'home':
        return <HomePage setActiveTab={setActiveTab} />;
      case 'preferences':
        return <PreferencesPage />;
      case 'questions':
        return <QuestionsPage />;
      case 'swiper':
        return <ClassSwiperPage />;
      case 'bookmarks':
        return <BookmarksPage setActiveTab={setActiveTab} />;
      case 'schedule-builder':
        return <ScheduleBuilderPage />;
      default:
        return <SignInPage setActiveTab={setActiveTab} />;
    }
  };

  return (
    <>
      <Box
        style={{
          paddingBottom: activeTab !== 'signin' && activeTab !== 'home' ? '80px' : '0',
          minHeight: '100vh',
        }}
      >
        {renderPage()}
      </Box>
      {activeTab !== 'signin' && activeTab !== 'home' && (
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
    </>
  );
};

export default App;

