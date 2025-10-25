import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library';

const app = express();
const port = 3001;

// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Your frontend URL
  credentials: true,
}));
app.use(express.json());

// Existing API endpoint
app.get('/api', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});

// Google OAuth authentication endpoint
app.post('/auth/google', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    
    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Extract user information
    const userId = payload['sub'];
    const email = payload['email'];
    const name = payload['name'];
    const picture = payload['picture'];

    console.log('User authenticated:', { userId, email, name });

    // Here you would typically:
    // 1. Check if user exists in your database
    // 2. Create new user if doesn't exist
    // 3. Generate your own JWT token
    // 4. Return the token to the frontend

    // For now, just return the user info
    res.json({
      success: true,
      user: {
        id: userId,
        email,
        name,
        picture,
      },
      // In production, return your own JWT token here
      // token: generateYourJWT(userId),
    });
  } catch (error) {
    console.error('Error verifying Google token:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});