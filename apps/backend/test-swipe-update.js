/**
 * Test script for swipe-based embedding update system
 * 
 * Tests:
 * 1. Recording a like interaction and updating embedding
 * 2. Recording a dislike interaction and updating embedding
 * 3. Batch processing multiple interactions
 * 4. Fetching swipe history
 * 
 * Prerequisites:
 * 1. Backend server running on http://localhost:3001
 * 2. Database with embeddings for users and courses
 * 3. numpy installed: pip install numpy
 * 
 * Run: node test-swipe-update.js
 */

const BASE_URL = 'http://localhost:3001';

// Test configuration - UPDATE THESE WITH YOUR DATA
const TEST_CONFIG = {
  googleId: 'test_user_123',  // Replace with actual Google ID
  testCourseId: 1,             // Replace with actual class ID that has embedding
  testCourseIdLike: 1,
  testCourseIdDislike: 2,
};

// Test 1: Like a course and update embedding
async function testLikeInteraction() {
  console.log('='.repeat(70));
  console.log('TEST 1: Like Course Interaction & Embedding Update');
  console.log('='.repeat(70));
  
  const interactionData = {
    googleId: TEST_CONFIG.googleId,
    classId: TEST_CONFIG.testCourseIdLike,
    liked: true
  };
  
  console.log('\nLiking course:', JSON.stringify(interactionData, null, 2));
  console.log('Sending request to POST /api/swipe/interact...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/api/swipe/interact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(interactionData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error);
      return false;
    }
    
    const result = await response.json();
    
    console.log('✅ Success!');
    console.log(`   Action: ${result.action}`);
    console.log(`   Course: ${result.course.code} - ${result.course.title}`);
    console.log(`   Bookmarked: ${result.bookmarked}`);
    console.log(`   Embedding updated: ${result.embedding_updated}`);
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test 2: Dislike a course and update embedding
async function testDislikeInteraction() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST 2: Dislike Course Interaction & Embedding Update');
  console.log('='.repeat(70));
  
  const interactionData = {
    googleId: TEST_CONFIG.googleId,
    classId: TEST_CONFIG.testCourseIdDislike,
    liked: false
  };
  
  console.log('\nDisliking course:', JSON.stringify(interactionData, null, 2));
  console.log('Sending request to POST /api/swipe/interact...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/api/swipe/interact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(interactionData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error);
      return false;
    }
    
    const result = await response.json();
    
    console.log('✅ Success!');
    console.log(`   Action: ${result.action}`);
    console.log(`   Course: ${result.course.code} - ${result.course.title}`);
    console.log(`   Bookmarked: ${result.bookmarked}`);
    console.log(`   Embedding updated: ${result.embedding_updated}`);
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test 3: Batch process multiple interactions
async function testBatchInteraction() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST 3: Batch Process Multiple Interactions');
  console.log('='.repeat(70));
  
  const batchData = {
    googleId: TEST_CONFIG.googleId,
    interactions: [
      { classId: 5, liked: true },
      { classId: 6, liked: false },
      { classId: 7, liked: true },
    ]
  };
  
  console.log(`\nProcessing ${batchData.interactions.length} interactions...`);
  console.log('Sending request to POST /api/swipe/batch-interact...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/api/swipe/batch-interact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batchData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error);
      return false;
    }
    
    const result = await response.json();
    
    console.log('✅ Batch processing complete!');
    console.log(`   Total processed: ${result.processed}`);
    console.log(`   Succeeded: ${result.succeeded}`);
    console.log(`   Failed: ${result.failed}`);
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test 4: Fetch swipe history
async function testSwipeHistory() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST 4: Fetch Swipe History');
  console.log('='.repeat(70));
  
  console.log(`\nFetching swipe history for user: ${TEST_CONFIG.googleId}`);
  console.log('Sending request to GET /api/swipe/history...\n');
  
  try {
    const response = await fetch(
      `${BASE_URL}/api/swipe/history?googleId=${TEST_CONFIG.googleId}`,
      { method: 'GET' }
    );
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error);
      return false;
    }
    
    const result = await response.json();
    
    console.log('✅ History retrieved!');
    console.log(`   Total likes: ${result.likes.length}`);
    console.log(`   Total dislikes: ${result.dislikes.length}`);
    
    if (result.likes.length > 0) {
      console.log('\n   Recent likes:');
      result.likes.slice(0, 3).forEach((like, i) => {
        console.log(`   ${i + 1}. ${like.school}${like.department} ${like.number}: ${like.title}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test Python script directly (command-line interface)
async function testPythonScriptDirectly() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST 5: Direct Python Script Test (Command Line)');
  console.log('='.repeat(70));
  
  const { spawn } = require('child_process');
  const path = require('path');
  
  console.log('\nRunning Python script directly...');
  
  const scriptPath = path.join(__dirname, '../../scripts/update_user_embedding.py');
  const args = [
    scriptPath,
    '--student_id', TEST_CONFIG.googleId,
    '--course_id', TEST_CONFIG.testCourseId.toString(),
    '--liked', 'True'
  ];
  
  console.log(`Command: python3 ${args.join(' ')}\n`);
  
  return new Promise((resolve) => {
    const pythonProcess = spawn('python3', args);
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      process.stderr.write(data);
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Python script completed successfully!');
        resolve(true);
      } else {
        console.log(`\n❌ Python script exited with code ${code}`);
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
  console.log('\n🚀 Starting Swipe-Based Embedding Update Tests\n');
  console.log('Configuration:');
  console.log(`  Google ID: ${TEST_CONFIG.googleId}`);
  console.log(`  Test Course ID (Like): ${TEST_CONFIG.testCourseIdLike}`);
  console.log(`  Test Course ID (Dislike): ${TEST_CONFIG.testCourseIdDislike}`);
  console.log('\n⚠️  Update TEST_CONFIG at the top of this file with your actual data!\n');
  
  const results = {
    test1: await testLikeInteraction(),
    test2: await testDislikeInteraction(),
    test3: await testBatchInteraction(),
    test4: await testSwipeHistory(),
    test5: await testPythonScriptDirectly()
  };
  
  console.log('\n' + '='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.values(results).length;
  
  console.log(`\nPassed: ${passed}/${total} tests`);
  console.log(`Test 1 (Like Interaction): ${results.test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 2 (Dislike Interaction): ${results.test2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 3 (Batch Interactions): ${results.test3 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 4 (Swipe History): ${results.test4 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 5 (Python Script Direct): ${results.test5 ? '✅ PASS' : '❌ FAIL'}`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n📚 How the embedding update works:');
  console.log('   Formula: user_vec_new = normalize(user_vec_old + α * direction * course_vec)');
  console.log('   - direction = +1 for likes, -1 for dislikes');
  console.log('   - α (learning rate) = 0.1');
  console.log('   - User vector moves TOWARD liked courses, AWAY from disliked courses');
  console.log('   - Result is normalized to unit length\n');
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error.message);
  console.error('\nMake sure:');
  console.error('1. Backend server is running: cd apps/backend && npm run dev');
  console.error('2. Database has user and course embeddings');
  console.error('3. numpy is installed: pip install numpy');
  console.error('4. Update TEST_CONFIG with valid IDs');
  process.exit(1);
});

runAllTests();

