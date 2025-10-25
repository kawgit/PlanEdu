import React, { useEffect, useState } from 'react';
import { Box } from '@mantine/core';
import Navigation from './components/Navigation';
import HomePage from './pages/HomePage';
import SignInPage from './pages/SignInPage';
import PreferencesPage from './pages/PreferencesPage';
import QuestionsPage from './pages/QuestionsPage';
import ClassSwiperPage from './pages/ClassSwiperPage';
import { fetchUserFromDB } from './utils/auth';
import BookmarksPage from './pages/BookmarksPage';
import ScheduleBuilderPage from './pages/ScheduleBuilderPage';

export type TabName = 'home' | 'signin' | 'preferences' | 'questions' | 'swiper' | 'bookmarks' | 'schedule-builder';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabName>('signin');
  // Shared bookmarks state (simple local state - can be replaced with context or persisted storage)
  const [bookmarks, setBookmarks] = useState<Array<any>>(() => {
    try {
      const raw = localStorage.getItem('bookmarks');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  const [userPreferences, setUserPreferences] = useState<any>({});

  // load saved user preferences when app mounts
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchUserFromDB();
        if (mounted && data) {
          // data may include preference fields used by PreferencesPage
          setUserPreferences({
            interests: data.interests || null,
            major: data.major || null,
            preferred_course_load: data.preferred_course_load || null,
          });
        }
      } catch (e) {
        // ignore - user may not be logged in
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    } catch (e) {
      // ignore
    }
  }, [bookmarks]);

  const addBookmark = (course: any) => {
    setBookmarks((prev) => {
      // avoid duplicates based on code
      if (prev.find((c) => c.code === course.code)) return prev;
      return [...prev, course];
    });
  };

  const removeBookmark = (code: string) => {
    setBookmarks((prev) => prev.filter((c) => c.code !== code));
  };

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
        return <ClassSwiperPage addBookmark={addBookmark} preferences={userPreferences} />;
      case 'bookmarks':
        return <BookmarksPage setActiveTab={setActiveTab} bookmarks={bookmarks} removeBookmark={removeBookmark} />;
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

