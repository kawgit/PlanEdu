/**
 * Utility functions for managing user authentication data
 */

export interface UserData {
  googleId: string;
  email: string;
  name: string | null;
  picture: string | null;
}

/**
 * Get the current user's Google sub ID from localStorage
 */
export const getUserGoogleId = (): string | null => {
  return localStorage.getItem('userGoogleId');
};

/**
 * Get all user data from localStorage
 */
export const getUserData = (): UserData | null => {
  const googleId = localStorage.getItem('userGoogleId');
  const email = localStorage.getItem('userEmail');
  const name = localStorage.getItem('userName');
  const picture = localStorage.getItem('userPicture');

  if (!googleId || !email) {
    return null;
  }

  return {
    googleId,
    email,
    name: name || '',
    picture: picture || '',
  };
};

/**
 * Check if user is logged in
 */
export const isUserLoggedIn = (): boolean => {
  return !!getUserGoogleId();
};

/**
 * Clear user data from localStorage (logout)
 */
export const clearUserData = (): void => {
  localStorage.removeItem('userGoogleId');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userName');
  localStorage.removeItem('userPicture');
  localStorage.removeItem('authToken');
};

/**
 * Fetch user data from database
 */
export const fetchUserFromDB = async () => {
  const googleId = getUserGoogleId();
  
  if (!googleId) {
    throw new Error('User not logged in');
  }

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  const response = await fetch(`${backendUrl}/api/user?googleId=${googleId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user data');
  }

  return response.json();
};

/**
 * Save user preferences (major, minor, target_graduation)
 */
export const saveUserPreferences = async (preferences: {
  major?: string;
  minor?: string;
  target_graduation?: string;
}) => {
  const googleId = getUserGoogleId();
  
  if (!googleId) {
    throw new Error('User not logged in');
  }

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  const response = await fetch(`${backendUrl}/api/user/preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      googleId,
      ...preferences,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save preferences');
  }

  return response.json();
};

