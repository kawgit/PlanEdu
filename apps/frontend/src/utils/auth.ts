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
 * Save user preferences (major, minor, target_graduation, incoming_credits, interests, study_abroad_interest, preferred_course_load)
 */
export const saveUserPreferences = async (preferences: {
  major?: string;
  minor?: string;
  target_graduation?: string;
  incoming_credits?: number;
  interests?: string;
  study_abroad_interest?: string;
  preferred_course_load?: string;
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

/**
 * Fetch user's bookmarked classes from database
 */
export const fetchUserBookmarks = async () => {
  const googleId = getUserGoogleId();
  
  if (!googleId) {
    throw new Error('User not logged in');
  }

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  const response = await fetch(`${backendUrl}/api/user/bookmarks?googleId=${googleId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch bookmarks');
  }

  return response.json();
};

/**
 * Add a class to user's bookmarks
 */
export const addBookmark = async (classId: number) => {
  const googleId = getUserGoogleId();
  
  if (!googleId) {
    throw new Error('User not logged in');
  }

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  const response = await fetch(`${backendUrl}/api/user/bookmark`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      googleId,
      classId,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to add bookmark');
  }

  return response.json();
};

/**
 * Remove a class from user's bookmarks
 */
export const removeBookmark = async (classId: number) => {
  const googleId = getUserGoogleId();
  
  if (!googleId) {
    throw new Error('User not logged in');
  }

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  const response = await fetch(`${backendUrl}/api/user/bookmark`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      googleId,
      classId,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to remove bookmark');
  }

  return response.json();
};

/**
 * Completed Courses Types
 */
export interface CompletedCourse {
  id: number;
  userId: number;
  courseCode: string;
  courseTitle: string;
  grade?: string;
  credits?: number;
  semesterTaken?: string;
  courseType: 'AP' | 'BU' | 'Transfer' | 'Other';
  createdAt: string;
}

/**
 * Upload transcript and extract courses
 */
export const uploadTranscript = async (file: File) => {
  const googleId = getUserGoogleId();
  
  if (!googleId) {
    throw new Error('User not logged in');
  }

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  
  const formData = new FormData();
  formData.append('transcript', file);
  formData.append('googleId', googleId);

  const response = await fetch(`${backendUrl}/api/transcript/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload transcript');
  }

  return response.json();
};

/**
 * Get user's completed courses
 */
export const fetchCompletedCourses = async (courseType?: 'AP' | 'BU' | 'Transfer' | 'Other') => {
  const googleId = getUserGoogleId();
  
  if (!googleId) {
    throw new Error('User not logged in');
  }

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  const url = courseType 
    ? `${backendUrl}/api/user/completed-courses?googleId=${googleId}&courseType=${courseType}`
    : `${backendUrl}/api/user/completed-courses?googleId=${googleId}`;
    
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch completed courses');
  }

  return response.json();
};

/**
 * Add a completed course manually
 */
export const addCompletedCourse = async (course: {
  courseCode: string;
  courseTitle: string;
  grade?: string;
  credits?: number;
  semesterTaken?: string;
  courseType: 'AP' | 'BU' | 'Transfer' | 'Other';
}) => {
  const googleId = getUserGoogleId();
  
  if (!googleId) {
    throw new Error('User not logged in');
  }

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  const response = await fetch(`${backendUrl}/api/user/completed-course`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      googleId,
      ...course,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to add completed course');
  }

  return response.json();
};

/**
 * Delete a completed course
 */
export const deleteCompletedCourse = async (courseId: number) => {
  const googleId = getUserGoogleId();
  
  if (!googleId) {
    throw new Error('User not logged in');
  }

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  const response = await fetch(`${backendUrl}/api/user/completed-course`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      googleId,
      courseId,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to delete completed course');
  }

  return response.json();
};

