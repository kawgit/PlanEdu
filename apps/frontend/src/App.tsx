import React, { useEffect, useState } from 'react';
import { Box } from '@mantine/core';
import Navigation from './components/Navigation';
import HomePage from './pages/HomePage';
import SignInPage from './pages/SignInPage';
import PreferencesPage from './pages/PreferencesPage';
import QuestionsPage from './pages/QuestionsPage';
import ClassSwiperPage from './pages/ClassSwiperPage';
import { fetchUserBookmarks, addBookmark as addBookmarkAPI, removeBookmark as removeBookmarkAPI } from './utils/auth';
import BookmarksPage from './pages/BookmarksPage';
import ScheduleBuilderPage from './pages/ScheduleBuilderPage';

export type TabName = 'home' | 'signin' | 'preferences' | 'questions' | 'swiper' | 'bookmarks' | 'schedule-builder';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabName>('signin');
  // Shared bookmarks state - loaded from database
  const [bookmarks, setBookmarks] = useState<Array<any>>([]);

  // Load bookmarks from database
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const bookmarksData = await fetchUserBookmarks();
        if (mounted) {
          setBookmarks(bookmarksData);
        }
      } catch (e) {
        // ignore - user may not be logged in
        if (mounted) {
          setBookmarks([]);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const addBookmark = async (course: any) => {
    try {
      await addBookmarkAPI(course.id);
      // Refresh bookmarks from database
      const updatedBookmarks = await fetchUserBookmarks();
      setBookmarks(updatedBookmarks);
    } catch (error) {
      console.error('Failed to add bookmark:', error);
    }
  };

  const removeBookmark = async (classId: number) => {
    try {
      await removeBookmarkAPI(classId);
      // Refresh bookmarks from database
      const updatedBookmarks = await fetchUserBookmarks();
      setBookmarks(updatedBookmarks);
    } catch (error) {
      console.error('Failed to remove bookmark:', error);
    }
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
        return <ClassSwiperPage addBookmark={addBookmark} />;
      case 'bookmarks':
        return <BookmarksPage setActiveTab={setActiveTab} bookmarks={bookmarks} removeBookmark={removeBookmark} />;
      case 'schedule-builder':
        return <ScheduleBuilderPage bookmarks={bookmarks} />;
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

