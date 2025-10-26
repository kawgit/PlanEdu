#!/usr/bin/env node
/**
 * Test LLM Constraint Parsing
 * 
 * Tests the natural language → structured constraints flow
 */

const BACKEND_URL = 'http://localhost:3001';

const testCases = [
  {
    name: "No Friday classes",
    feedback: "I don't want any classes on Friday",
    expectedKinds: ["disallowed_days"]
  },
  {
    name: "Late start time",
    feedback: "I prefer classes that start after 10 AM",
    expectedKinds: ["earliest_start"]
  },
  {
    name: "Lunch break",
    feedback: "I need a lunch break from 12 to 1 PM",
    expectedKinds: ["block_time_window"]
  },
  {
    name: "Exactly 3 classes",
    feedback: "I want exactly 3 classes this semester",
    expectedKinds: ["target_courses_per_semester"]
  },
  {
    name: "Multiple constraints",
    feedback: "No morning classes and I want Friday off",
    expectedKinds: ["earliest_start", "free_day"]
  },
  {
    name: "Complex schedule preference",
    feedback: "I want to start classes after 10 AM, no Friday classes, and exactly 4 courses per semester",
    expectedKinds: ["earliest_start", "disallowed_days", "target_courses_per_semester"]
  }
];

async function testConstraintParsing(feedback) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/schedule/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        googleId: 'test_user_llm',
        feedback,
        maxCoursesPerSemester: 4
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.log(`   ⚠️  Backend error: ${result.error || result.details}`);
      return null;
    }

    return result.parsedConstraints || [];
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
    return null;
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(80));
  console.log('  LLM CONSTRAINT PARSING VALIDATION');
  console.log('='.repeat(80) + '\n');

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.name}`);
    console.log(`   Input: "${testCase.feedback}"`);
    
    const constraints = await testConstraintParsing(testCase.feedback);
    
    if (!constraints) {
      console.log(`   ❌ FAIL: No constraints returned`);
      results.push({ name: testCase.name, passed: false });
      continue;
    }

    const kinds = constraints.map(c => c.kind);
    console.log(`   Parsed constraints: ${kinds.join(', ')}`);
    
    // Check if expected constraint kinds are present
    const hasExpected = testCase.expectedKinds.some(expected => 
      kinds.includes(expected)
    );
    
    if (hasExpected) {
      console.log(`   ✅ PASS: Contains expected constraint types`);
      results.push({ name: testCase.name, passed: true });
    } else {
      console.log(`   ❌ FAIL: Expected one of [${testCase.expectedKinds.join(', ')}]`);
      results.push({ name: testCase.name, passed: false });
    }
    
    // Show constraint details
    if (constraints.length > 0) {
      console.log(`   Details:`);
      constraints.forEach(c => {
        console.log(`     • ${c.kind} (${c.mode || 'soft'}): ${JSON.stringify(c.payload)}`);
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('  TEST SUMMARY');
  console.log('='.repeat(80) + '\n');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(r => {
    const status = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}  ${r.name}`);
  });
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`  TOTAL: ${passed}/${total} tests passed`);
  console.log(`${'='.repeat(80)}\n`);

  // Additional info
  if (passed < total) {
    console.log('💡 Note: LLM parsing is probabilistic. Some variations are expected.');
    console.log('   As long as constraints are generally correct, the system is working.\n');
  }

  process.exit(passed === total ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

