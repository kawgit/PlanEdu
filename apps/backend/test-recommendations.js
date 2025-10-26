/**
 * Test script for intelligent course recommendation system
 * 
 * Tests:
 * 1. Get personalized recommendations (hybrid scoring)
 * 2. Find similar courses
 * 3. Refresh recommendations after profile update
 * 4. Direct Python script test
 * 
 * Prerequisites:
 * 1. Backend server running on http://localhost:3001
 * 2. User has embedding computed
 * 3. Courses have embeddings
 * 4. numpy and psycopg installed
 * 
 * Run: node test-recommendations.js
 */

const BASE_URL = 'http://localhost:3001';

// Test configuration - UPDATE THESE
const TEST_CONFIG = {
  googleId: 'test_user_123',  // Replace with actual Google ID
  userId: 1,                   // Replace with actual user ID
  testCourseId: 1,            // Replace with actual course ID for similarity test
};

// Test 1: Get personalized recommendations
async function testPersonalizedRecommendations() {
  console.log('='.repeat(70));
  console.log('TEST 1: Get Personalized Course Recommendations');
  console.log('='.repeat(70));
  
  console.log(`\nFetching recommendations for user: ${TEST_CONFIG.googleId}`);
  console.log('Algorithm: 70% embedding similarity + 30% hub coverage\n');
  
  try {
    const response = await fetch(
      `${BASE_URL}/api/recommendations/personalized?googleId=${TEST_CONFIG.googleId}&limit=10`,
      { method: 'GET' }
    );
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error);
      return false;
    }
    
    const result = await response.json();
    
    console.log('✅ Success!');
    console.log(`   Total recommendations: ${result.count}`);
    console.log(`   User major: ${result.user.major}`);
    console.log(`   Algorithm: ${result.algorithm.description}`);
    
    console.log('\n📚 Top 5 Recommendations:');
    result.recommendations.slice(0, 5).forEach((rec, i) => {
      console.log(`\n   ${i + 1}. ${rec.code}: ${rec.title}`);
      console.log(`      Final Score: ${rec.final_score}`);
      console.log(`      - Similarity: ${rec.similarity} (${(rec.similarity * 0.7).toFixed(3)} weighted)`);
      console.log(`      - Hub Coverage: ${rec.hub_score} (${(rec.hub_score * 0.3).toFixed(3)} weighted)`);
      if (rec.fulfills_hubs.length > 0) {
        console.log(`      - Fulfills ${rec.fulfills_hubs.length} missing hub(s)`);
      }
      if (rec.studyAbroadLocations && rec.studyAbroadLocations.length > 0) {
        console.log(`      - Available abroad: ${rec.studyAbroadLocations.map(l => l.name).join(', ')}`);
      }
    });
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test 2: Find similar courses
async function testSimilarCourses() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST 2: Find Similar Courses');
  console.log('='.repeat(70));
  
  console.log(`\nFinding courses similar to course ID: ${TEST_CONFIG.testCourseId}\n`);
  
  try {
    const response = await fetch(
      `${BASE_URL}/api/recommendations/similar-to-course?courseId=${TEST_CONFIG.testCourseId}&limit=5`,
      { method: 'GET' }
    );
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error);
      return false;
    }
    
    const result = await response.json();
    
    console.log('✅ Success!');
    console.log(`   Target: ${result.target_course.code} - ${result.target_course.title}`);
    console.log(`\n   Similar courses:`);
    
    result.similar_courses.forEach((course, i) => {
      console.log(`   ${i + 1}. ${course.code}: ${course.title}`);
      console.log(`      Similarity: ${course.similarity_score} (${(course.similarity_score * 100).toFixed(1)}%)`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test 3: Refresh recommendations
async function testRefreshRecommendations() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST 3: Refresh Recommendations (Recompute Embedding + Get Recs)');
  console.log('='.repeat(70));
  
  console.log(`\nRefreshing recommendations for user: ${TEST_CONFIG.googleId}`);
  console.log('This will:');
  console.log('  1. Recompute user embedding from profile');
  console.log('  2. Generate fresh recommendations\n');
  
  try {
    const response = await fetch(
      `${BASE_URL}/api/recommendations/refresh`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleId: TEST_CONFIG.googleId })
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error);
      return false;
    }
    
    const result = await response.json();
    
    console.log('✅ Success!');
    console.log(`   Message: ${result.message}`);
    console.log(`   Fresh recommendations: ${result.count}`);
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test 4: Test Python script directly
async function testPythonScriptDirectly() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST 4: Direct Python Script Test (Command Line)');
  console.log('='.repeat(70));
  
  const { spawn } = require('child_process');
  const path = require('path');
  
  console.log('\nRunning Python recommendation script directly...');
  
  const scriptPath = path.join(__dirname, '../../scripts/recommend_courses.py');
  const inputData = JSON.stringify({ userId: TEST_CONFIG.userId });
  
  console.log(`Input: ${inputData}\n`);
  
  return new Promise((resolve) => {
    const pythonProcess = spawn('python3', [scriptPath]);
    
    let output = '';
    let errorOutput = '';
    
    // Send input via stdin
    pythonProcess.stdin.write(inputData);
    pythonProcess.stdin.end();
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      // Print stderr (progress messages)
      process.stderr.write(data);
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          console.log('\n✅ Python script completed successfully!');
          console.log(`   Recommendations: ${result.count}`);
          if (result.recommendations && result.recommendations.length > 0) {
            console.log(`   Top recommendation: ${result.recommendations[0].code} - ${result.recommendations[0].title}`);
            console.log(`   Score: ${result.recommendations[0].final_score}`);
          }
          resolve(true);
        } catch (e) {
          console.error('\n❌ Failed to parse output');
          console.log('Output:', output);
          resolve(false);
        }
      } else {
        console.log(`\n❌ Python script exited with code ${code}`);
        console.log('Output:', output);
        resolve(false);
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('❌ Failed to start Python script:', error.message);
      resolve(false);
    });
  });
}

// Run all tests
async function runAllTests() {
  console.log('\n🚀 Starting Course Recommendation System Tests\n');
  console.log('Configuration:');
  console.log(`  Google ID: ${TEST_CONFIG.googleId}`);
  console.log(`  User ID: ${TEST_CONFIG.userId}`);
  console.log(`  Test Course ID: ${TEST_CONFIG.testCourseId}`);
  console.log('\n⚠️  Update TEST_CONFIG at the top of this file with your actual data!\n');
  
  const results = {
    test1: await testPersonalizedRecommendations(),
    test2: await testSimilarCourses(),
    test3: await testRefreshRecommendations(),
    test4: await testPythonScriptDirectly()
  };
  
  console.log('\n' + '='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.values(results).length;
  
  console.log(`\nPassed: ${passed}/${total} tests`);
  console.log(`Test 1 (Personalized Recommendations): ${results.test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 2 (Similar Courses): ${results.test2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 3 (Refresh Recommendations): ${results.test3 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 4 (Python Script Direct): ${results.test4 ? '✅ PASS' : '❌ FAIL'}`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 How the recommendation system works:');
  console.log('   1. User embedding captures preferences (major, interests, courses)');
  console.log('   2. Course embeddings represent course content');
  console.log('   3. Cosine similarity measures preference match (70% weight)');
  console.log('   4. Hub coverage bonus for missing requirements (30% weight)');
  console.log('   5. Final score = 0.7 * similarity + 0.3 * hub_coverage');
  console.log('   6. Top 20 courses returned, sorted by final score\n');
  
  console.log('💡 Tips:');
  console.log('   - Higher similarity = course matches user interests');
  console.log('   - Higher hub_score = course fulfills missing requirements');
  console.log('   - Recommendations update after swipes (embedding changes)\n');
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error.message);
  console.error('\nMake sure:');
  console.error('1. Backend server is running: cd apps/backend && npm run dev');
  console.error('2. User has embedding: POST /api/user/compute-embedding');
  console.error('3. Courses have embeddings: python compute_course_embeddings.py');
  console.error('4. numpy installed: pip install numpy');
  console.error('5. Update TEST_CONFIG with valid IDs');
  process.exit(1);
});

runAllTests();

