import React from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';

interface LoginProps {
  onSuccess?: (credentialResponse: CredentialResponse) => void;
  onError?: () => void;
}

const Login: React.FC<LoginProps> = ({ onSuccess, onError }) => {
  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    console.log('Login Success:', credentialResponse);
    
    // Get the Google ID token
    const idToken = credentialResponse.credential;
    
    if (!idToken) {
      console.error('No ID token received');
      onError?.();
      return;
    }
    
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: idToken }),
      });
      
      if (!response.ok) {
        throw new Error('Authentication failed');
      }
      
      const data = await response.json();
      console.log('Backend response:', data);
      
      // Store the JWT token (if your backend returns one)
      if (data.token) {
        localStorage.setItem('authToken', data.token);
      }
      
      // Call the success callback if provided
      onSuccess?.({ ...credentialResponse, ...data });
    } catch (error) {
      console.error('Error sending token to backend:', error);
      onError?.();
    }
  };

  const handleError = () => {
    console.error('Login Failed');
    onError?.();
  };

  return (
    <div>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        useOneTap={false}
        theme="outline"
        size="large"
        text="signin_with"
        shape="rectangular"
      />
    </div>
  );
};

export default Login;

