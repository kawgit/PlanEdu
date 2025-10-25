import React, { useState } from 'react';
import Navigation from './components/Navigation';
import HomePage from './pages/HomePage';
import SignInPage from './pages/SignInPage';
import PreferencesPage from './pages/PreferencesPage';
import QuestionsPage from './pages/QuestionsPage';
import ClassSwiperPage from './pages/ClassSwiperPage';
import BookmarksPage from './pages/BookmarksPage';

export type TabName = 'home' | 'signin' | 'preferences' | 'questions' | 'swiper' | 'bookmarks';

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
        return <BookmarksPage />;
      default:
        return <SignInPage setActiveTab={setActiveTab} />;
    }
  };

  return (
    <>
      {activeTab !== 'signin' && (
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
      {renderPage()}
    </>
  );
};

export default App;

