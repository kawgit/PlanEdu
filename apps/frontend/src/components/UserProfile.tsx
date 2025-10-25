import React, { useEffect, useState } from 'react';
import { getUserData, getUserGoogleId } from '../utils/auth';

interface UserProfileProps {
  showBookmarks?: boolean;
}

interface Bookmark {
  id: number;
  class_name: string;
  created_at: string;
}

const UserProfile: React.FC<UserProfileProps> = ({ showBookmarks = false }) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userData = getUserData();

  useEffect(() => {
    if (showBookmarks) {
      fetchUserBookmarks();
    }
  }, [showBookmarks]);

  const fetchUserBookmarks = async () => {
    const googleId = getUserGoogleId();
    if (!googleId) {
      setError('Not logged in');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/user/bookmarks?googleId=${googleId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch bookmarks');
      }

      const data = await response.json();
      setBookmarks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!userData) {
    return (
      <div className="p-4 bg-yellow-100 rounded">
        <p>Please log in to view your profile</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <div className="flex items-center gap-4 mb-4">
        {userData.picture && (
          <img 
            src={userData.picture} 
            alt={userData.name || 'User'} 
            className="w-16 h-16 rounded-full"
          />
        )}
        <div>
          <h2 className="text-xl font-bold">{userData.name}</h2>
          <p className="text-gray-600">{userData.email}</p>
          <p className="text-xs text-gray-400">ID: {userData.googleId}</p>
        </div>
      </div>

      {showBookmarks && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Your Bookmarks</h3>
          
          {loading && <p>Loading bookmarks...</p>}
          {error && <p className="text-red-500">{error}</p>}
          
          {!loading && !error && bookmarks.length === 0 && (
            <p className="text-gray-500">No bookmarks yet</p>
          )}
          
          {!loading && !error && bookmarks.length > 0 && (
            <ul className="space-y-2">
              {bookmarks.map((bookmark) => (
                <li key={bookmark.id} className="p-2 bg-gray-50 rounded">
                  <p className="font-medium">{bookmark.class_name}</p>
                  <p className="text-xs text-gray-500">
                    Added: {new Date(bookmark.created_at).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default UserProfile;

