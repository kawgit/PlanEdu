/**
 * Test script for user embedding system
 * Tests both stateless and database-stored embedding endpoints
 * 
 * Prerequisites:
 * 1. Backend server running on http://localhost:3001
 * 2. Database with pgvector extension enabled
 * 3. Migration applied: migrations/add_user_embedding.sql
 * 4. OPENAI_API_KEY in .env file
 * 
 * Run: node test-user-embedding.js
 */

const BASE_URL = 'http://localhost:3001';

// Test user data
const testGoogleId = 'test_user_123'; // Replace with actual Google ID from your database

// Test 1: Generate embedding without storing (stateless)
async function testStatelessEmbedding() {
  console.log('='.repeat(60));
  console.log('TEST 1: Stateless Embedding Generation');
  console.log('='.repeat(60));
  
  const userData = {
    major: "Computer Science",
    interests: ["Artificial Intelligence", "Systems", "Theory"],
    courses_taken: ["CASCS111", "CASCS112", "CASCS210", "CASMA123"]
  };

  console.log('\nInput data:', JSON.stringify(userData, null, 2));
  console.log('\nSending request to POST /api/user-embedding...\n');

  try {
    const response = await fetch(`${BASE_URL}/api/user-embedding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error);
      return false;
    }

    const result = await response.json();
    
    console.log('✅ Success!');
    console.log(`   Model: ${result.model}`);
    console.log(`   Dimension: ${result.dimension}`);
    console.log(`   Profile text: "${result.profile_text}"`);
    console.log(`   First 5 embedding values: [${result.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}, ...]`);
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test 2: Compute and store user embedding in database
async function testComputeAndStoreEmbedding() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Compute and Store User Embedding');
  console.log('='.repeat(60));
  
  console.log(`\nComputing embedding for user: ${testGoogleId}`);
  console.log('Sending request to POST /api/user/compute-embedding...\n');

  try {
    const response = await fetch(`${BASE_URL}/api/user/compute-embedding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleId: testGoogleId })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error);
      return false;
    }

    const result = await response.json();
    
    console.log('✅ Embedding computed and stored!');
    console.log(`   Model: ${result.model}`);
    console.log(`   Dimension: ${result.dimension}`);
    console.log(`   Profile: "${result.profile_text}"`);
    console.log(`   Updated at: ${result.updated_at}`);
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test 3: Retrieve stored user embedding
async function testRetrieveEmbedding() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Retrieve Stored Embedding');
  console.log('='.repeat(60));
  
  console.log(`\nFetching embedding for user: ${testGoogleId}`);
  console.log('Sending request to GET /api/user/embedding...\n');

  try {
    const response = await fetch(`${BASE_URL}/api/user/embedding?googleId=${testGoogleId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error);
      return false;
    }

    const result = await response.json();
    
    console.log('✅ Embedding retrieved!');
    console.log(`   Dimension: ${result.dimension}`);
    console.log(`   Updated at: ${result.updated_at}`);
    console.log(`   User major: ${result.user.major}`);
    console.log(`   User interests: ${result.user.interests}`);
    console.log(`   First 5 embedding values: [${result.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}, ...]`);
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test 4: Find similar users
async function testFindSimilarUsers() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: Find Similar Users');
  console.log('='.repeat(60));
  
  console.log(`\nFinding users similar to: ${testGoogleId}`);
  console.log('Sending request to GET /api/user/similar-users...\n');

  try {
    const response = await fetch(`${BASE_URL}/api/user/similar-users?googleId=${testGoogleId}&limit=5`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error);
      return false;
    }

    const result = await response.json();
    
    console.log('✅ Similar users found!');
    console.log(`   Current user major: ${result.user_major}`);
    console.log(`   Found ${result.similar_users.length} similar users:`);
    
    result.similar_users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.major || 'No major'} (Similarity: ${(user.similarity_score * 100).toFixed(1)}%)`);
      if (user.interests) {
        console.log(`      Interests: ${user.interests}`);
      }
    });
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n🚀 Starting User Embedding System Tests\n');
  
  const results = {
    test1: await testStatelessEmbedding(),
    test2: await testComputeAndStoreEmbedding(),
    test3: await testRetrieveEmbedding(),
    test4: await testFindSimilarUsers()
  };
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.values(results).length;
  
  console.log(`\nPassed: ${passed}/${total} tests`);
  console.log(`Test 1 (Stateless Embedding): ${results.test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 2 (Compute & Store): ${results.test2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 3 (Retrieve Embedding): ${results.test3 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 4 (Similar Users): ${results.test4 ? '✅ PASS' : '❌ FAIL'}`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\nNote: To run these tests with your own data:');
  console.log('1. Update testGoogleId with a valid Google ID from your Users table');
  console.log('2. Ensure the user has a major, interests, or completed courses');
  console.log('3. Run the migration: migrations/add_user_embedding.sql');
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error.message);
  console.error('\nMake sure:');
  console.error('1. Backend server is running: cd apps/backend && npm run dev');
  console.error('2. Database is running and migration is applied');
  console.error('3. OPENAI_API_KEY is set in .env file');
  process.exit(1);
});

runAllTests();

