import React, { useState } from 'react';
import HomePage from './pages/HomePage';

export type TabName = 'home' | 'preferences' | 'questions' | 'swiper' | 'bookmarks';

const App: React.FC = () => {
  const [, setActiveTab] = useState<TabName>('home');

  return <HomePage setActiveTab={setActiveTab} />;
};

export default App;

