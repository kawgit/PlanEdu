import React, { useEffect, useState } from 'react';
import { Box } from '@mantine/core';
import Navigation from './components/Navigation';
import SignInPage from './pages/SignInPage';
import QuestionsPage from './pages/QuestionsPage';
import CourseSwiperPage from './pages/CourseSwiperPage';
import { fetchUserBookmarks, addBookmark as addBookmarkAPI, removeBookmark as removeBookmarkAPI, isUserLoggedIn } from './utils/auth';
import BookmarksPage from './pages/BookmarksPage';
import ScheduleBuilderPage from './pages/ScheduleBuilderPage';
import ProfilePage from './pages/ProfilePage';

export type TabName = 'signin' | 'questions' | 'swiper' | 'bookmarks' | 'schedule-builder' | 'profile';
export interface BookmarkedCourse {
  id: number;
  school: string;
  department: string;
  number: number;
  title: string;
  description?: string;
}

const App: React.FC = () => {
  // Check if user is logged in and restore last active tab
  const [activeTab, setActiveTab] = useState<TabName>(() => {
    if (!isUserLoggedIn()) {
      return 'signin';
    }
    // Try to restore last active tab from localStorage
    try {
      const savedTab = localStorage.getItem('activeTab') as TabName;
      if (savedTab && savedTab !== 'signin') {
        return savedTab;
      }
    } catch (e) {
      console.error('Failed to load active tab from localStorage:', e);
    }
    return 'questions';
  });
  // Shared bookmarks state - loaded from database
  const [bookmarks, setBookmarks] = useState<BookmarkedCourse[]>([]);

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    if (activeTab !== 'signin') {
      try {
        localStorage.setItem('activeTab', activeTab);
      } catch (e) {
        console.error('Failed to save active tab to localStorage:', e);
      }
    }
  }, [activeTab]);

  // Load bookmarks from database
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const bookmarksData = await fetchUserBookmarks();
        if (mounted) {
          setBookmarks(bookmarksData);
        }
      } catch {
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

  const addBookmark = async (course: BookmarkedCourse) => {
    // Optimistic add: append locally first, avoid duplicates
    setBookmarks(prev => {
      if (prev.some(b => b.id === course.id)) {
        return prev;
      }
      return [...prev, course];
    });

    try {
      await addBookmarkAPI(course.id);
      // keep optimistic state; optionally refresh if you want canonical data
    } catch (error) {
      console.error('Failed to add bookmark:', error);
      // Revert optimistic update if API call fails
      setBookmarks(prev => prev.filter(b => b.id !== course.id));
    }
  };

  const removeBookmark = async (courseId: number) => {
    // Optimistic removal: remove locally first, revert on error
    const previous = bookmarks;
    setBookmarks(prev => prev.filter(b => b.id !== courseId));
    try {
      await removeBookmarkAPI(courseId);
    } catch (error) {
      console.error('Failed to remove bookmark:', error);
      // revert
      setBookmarks(previous);
    }
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'signin':
        return <SignInPage setActiveTab={setActiveTab} />;
      case 'questions':
        return <QuestionsPage addBookmark={addBookmark} removeBookmark={removeBookmark} bookmarks={bookmarks} />;
      case 'swiper':
        return <CourseSwiperPage addBookmark={addBookmark} />;
      case 'bookmarks':
        return <BookmarksPage setActiveTab={setActiveTab} bookmarks={bookmarks} removeBookmark={removeBookmark} />;
      case 'schedule-builder':
        return <ScheduleBuilderPage />;
      case 'profile':
        return <ProfilePage />;
      default:
        return <SignInPage setActiveTab={setActiveTab} />;
    }
  };

  return (
    <>
      <Box
        style={{
          paddingBottom: activeTab !== 'signin' ? '80px' : '0',
          minHeight: '100vh',
        }}
      >
        {renderPage()}
      </Box>
      {activeTab !== 'signin' && (
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
    </>
  );
};

export default App;

