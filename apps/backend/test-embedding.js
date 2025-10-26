/**
 * Test script for the user embedding endpoint
 * Run with: node test-embedding.js
 * 
 * Make sure the backend server is running on http://localhost:3001
 */

const testUserEmbedding = async () => {
  try {
    const userData = {
      major: "Computer Science",
      interests: ["Machine Learning", "Web Development", "Data Science"],
      courses_taken: ["CASCS 111", "CASCS 112", "CASCS 132", "CASMA 123", "CASMA 124"]
    };

    console.log('Testing /api/user-embedding endpoint...');
    console.log('Input data:', JSON.stringify(userData, null, 2));
    console.log('\nSending request...\n');

    const response = await fetch('http://localhost:3001/api/user-embedding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error:', error);
      process.exit(1);
    }

    const result = await response.json();
    
    console.log('✓ Success!');
    console.log(`✓ Generated embedding with ${result.embedding.length} dimensions`);
    console.log(`✓ First 10 values: [${result.embedding.slice(0, 10).map(v => v.toFixed(4)).join(', ')}, ...]`);
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. Backend server is running: cd apps/backend && npm run dev');
    console.error('2. OPENAI_API_KEY is set in your .env file');
    process.exit(1);
  }
};

testUserEmbedding();

