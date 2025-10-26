/**
 * CS Major Completion Calculator
 * 
 * Requirements:
 * - Total: 15 courses required
 * - All courses must have grade C or higher
 * - Group A (Foundations): All 5 courses + Calculus 1 proficiency
 * - Group B (Technical Preparation): At least 2 of 3
 * - Group C (Essential CS Paradigms): At least 2 of 3 (with special CS350/CS351 rules)
 * - Group D (Advanced Topics): Remaining courses to reach 15 total
 */

/**
 * Math and CS Major Completion Calculator
 * 
 * Requirements:
 * - Lower Division: 8 specific requirements
 * - Upper Division: 5 specific requirements
 * - Special rules for CS 131/MA 293 and MA 581 double-counting
 */

export interface CompletedCourse {
  school: string;
  department: string;
  number: number;
  grade: string | null;
  title?: string;
  description?: string;
}

export interface MajorCompletionResult {
  percentage: number;
  totalRequired: number;
  totalCompleted: number;
  groupA: GroupProgress;
  groupB: GroupProgress;
  groupC: GroupProgress;
  groupD: GroupProgress;
  calculusCompleted: boolean;
  validCourses: CompletedCourse[];
  invalidCourses: Array<{ course: CompletedCourse; reason: string }>;
  missingRequirements: string[];
}

export interface GroupProgress {
  required: number;
  completed: number;
  courses: string[];
  completedCourses: string[];
  missingCourses: string[];
}

// Define course groups
const GROUP_A_COURSES = ['CS 111', 'CS 112', 'CS 131', 'CS 210', 'CS 330'];
const GROUP_B_COURSES = ['CS 132', 'CS 235', 'CS 237'];
const GROUP_C_COURSES = ['CS 320', 'CS 332', 'CS 350', 'CS 351'];
const CALCULUS_COURSES = ['MA 123', 'MA 124', 'MA 127']; // Various calculus courses

// Courses that should NOT count toward Group D
const GROUP_D_EXCLUSIONS = ['CS 320', 'CS 330', 'CS 332', 'CS 350'];

/**
 * Convert course to standard format (e.g., "CS 111")
 */
function formatCourse(course: CompletedCourse): string {
  return `${course.department} ${course.number}`;
}

/**
 * Check if a grade is C or higher
 */
function isPassingGrade(grade: string | null): boolean {
  // Handle null, undefined, or empty string
  if (grade === null || grade === undefined || grade === '') {
    return true;
  }
  
  const upperGrade = grade.toUpperCase().trim();

  
  const passingGrades = [
    'A', 'A-', 
    'B+', 'B', 'B-', 
    'C+', 'C',
    'P', // Pass for pass/fail courses
  ];
  
  return passingGrades.includes(upperGrade);
}

/**
 * Check if course is from CS department (CAS school)
 */
function isCSCourse(course: CompletedCourse): boolean {
  return course.school === 'CAS' && course.department === 'CS';
}

/**
 * Check if course is from Metropolitan College (should not count)
 */
function isMetropolitanCollege(course: CompletedCourse): boolean {
  return course.school === 'MET';
}

/**
 * Calculate CS major completion percentage
 */
export function calculateCSMajorCompletion(
  completedCourses: CompletedCourse[]
): MajorCompletionResult {
  const validCourses: CompletedCourse[] = [];
  const invalidCourses: Array<{ course: CompletedCourse; reason: string }> = [];
  
  // Filter courses
  for (const course of completedCourses) {
    const courseCode = formatCourse(course);
    
    // Debug logging
    if (!course.grade || course.grade.toUpperCase() === 'N/A' || course.grade.toUpperCase() === 'NA') {
      console.log(`Course: ${courseCode}, Grade: "${course.grade}", isPassing: ${isPassingGrade(course.grade)}`);
    }
    
    // Check if Metropolitan College
    if (isMetropolitanCollege(course)) {
      invalidCourses.push({
        course,
        reason: 'Metropolitan College courses do not count toward CS major'
      });
      continue;
    }
    
    // Check if passing grade
    if (!isPassingGrade(course.grade)) {
      invalidCourses.push({
        course,
        reason: `Grade ${course.grade || 'N/A'} is below C minimum requirement`
      });
      continue;
    }
    
    validCourses.push(course);
  }
  
  // Check Calculus completion
  const calculusCompleted = validCourses.some(course => 
    CALCULUS_COURSES.includes(formatCourse(course))
  );
  
  // Initialize group progress
  const groupA: GroupProgress = {
    required: 5,
    completed: 0,
    courses: GROUP_A_COURSES,
    completedCourses: [],
    missingCourses: []
  };
  
  const groupB: GroupProgress = {
    required: 2,
    completed: 0,
    courses: GROUP_B_COURSES,
    completedCourses: [],
    missingCourses: []
  };
  
  const groupC: GroupProgress = {
    required: 2,
    completed: 0,
    courses: GROUP_C_COURSES,
    completedCourses: [],
    missingCourses: []
  };
  
  const groupD: GroupProgress = {
    required: 6, // Will be adjusted based on overflow from other groups
    completed: 0,
    courses: ['CS 300+ level courses'],
    completedCourses: [],
    missingCourses: []
  };
  
  // Track which courses have been counted
  const countedCourses = new Set<string>();
  
  // Process Group A courses
  for (const course of validCourses) {
    const courseCode = formatCourse(course);
    if (GROUP_A_COURSES.includes(courseCode)) {
      groupA.completed++;
      groupA.completedCourses.push(courseCode);
      countedCourses.add(courseCode);
    }
  }
  groupA.missingCourses = GROUP_A_COURSES.filter(
    c => !groupA.completedCourses.includes(c)
  );
  
  // Process Group B courses
  for (const course of validCourses) {
    const courseCode = formatCourse(course);
    if (GROUP_B_COURSES.includes(courseCode)) {
      groupB.completed++;
      groupB.completedCourses.push(courseCode);
      countedCourses.add(courseCode);
    }
  }
  groupB.missingCourses = GROUP_B_COURSES.filter(
    c => !groupB.completedCourses.includes(c)
  );
  
  // Process Group C courses with special CS350/CS351 rules
  const hasCS350 = validCourses.some(c => formatCourse(c) === 'CS 350');
  const hasCS351 = validCourses.some(c => formatCourse(c) === 'CS 351');
  const hasCS320 = validCourses.some(c => formatCourse(c) === 'CS 320');
  const hasCS332 = validCourses.some(c => formatCourse(c) === 'CS 332');
  
  // Apply special rules for CS350/CS351
  let cs350OrCs351CountedForGroupC = 0;
  
  for (const course of validCourses) {
    const courseCode = formatCourse(course);
    
    if (GROUP_C_COURSES.includes(courseCode)) {
      // If we have both CS350 and CS351, only one can count for Group C
      if ((courseCode === 'CS 350' || courseCode === 'CS 351') && hasCS350 && hasCS351) {
        if (cs350OrCs351CountedForGroupC === 0) {
          // First one counts for Group C
          groupC.completed++;
          groupC.completedCourses.push(courseCode);
          countedCourses.add(courseCode);
          cs350OrCs351CountedForGroupC++;
        } else {
          // Second one goes to Group D
          // Will be handled in Group D processing
        }
      } else {
        groupC.completed++;
        groupC.completedCourses.push(courseCode);
        countedCourses.add(courseCode);
      }
    }
  }
  
  // Verify Group C requirement: Must have CS320 or CS332 in addition to CS350/CS351
  const groupCValid = groupC.completed >= 2 && (
    !(groupC.completedCourses.includes('CS 350') || groupC.completedCourses.includes('CS 351')) ||
    (hasCS320 || hasCS332)
  );
  
  groupC.missingCourses = GROUP_C_COURSES.filter(
    c => !groupC.completedCourses.includes(c)
  );
  
  // Process Group D courses (CS 300+ level, excluding certain courses)
  for (const course of validCourses) {
    const courseCode = formatCourse(course);
    
    // Skip if already counted in another group
    if (countedCourses.has(courseCode)) {
      // Exception: if CS350 and CS351 both exist, second one goes to Group D
      if ((courseCode === 'CS 350' || courseCode === 'CS 351') && hasCS350 && hasCS351) {
        if (!groupC.completedCourses.includes(courseCode)) {
          groupD.completed++;
          groupD.completedCourses.push(courseCode);
        }
      }
      continue;
    }
    
    // Must be CS course, 300+ level, not excluded
    if (
      isCSCourse(course) &&
      course.number >= 300 &&
      !GROUP_D_EXCLUSIONS.includes(courseCode)
    ) {
      groupD.completed++;
      groupD.completedCourses.push(courseCode);
      countedCourses.add(courseCode);
    }
  }
  
  // Calculate total courses completed toward major
  const totalCompleted = Math.min(
    groupA.completed + 
    Math.min(groupB.completed, groupB.required) + 
    Math.min(groupC.completed, groupC.required) + 
    groupD.completed,
    15 // Cap at 15
  );
  
  // Calculate percentage
  const totalRequired = 15;
  const percentage = Math.round((totalCompleted / totalRequired) * 100);
  
  // Determine missing requirements
  const missingRequirements: string[] = [];
  
  if (!calculusCompleted) {
    missingRequirements.push('Calculus 1 proficiency (MA 123 or equivalent)');
  }
  
  if (groupA.completed < groupA.required) {
    missingRequirements.push(
      `${groupA.required - groupA.completed} more Group A course(s): ${groupA.missingCourses.join(', ')}`
    );
  }
  
  if (groupB.completed < groupB.required) {
    missingRequirements.push(
      `${groupB.required - groupB.completed} more Group B course(s) from: ${groupB.missingCourses.join(', ')}`
    );
  }
  
  if (groupC.completed < groupC.required) {
    missingRequirements.push(
      `${groupC.required - groupC.completed} more Group C course(s) from: ${groupC.missingCourses.join(', ')}`
    );
  }
  
  if (!groupCValid && groupC.completed >= 2) {
    missingRequirements.push(
      'Must complete CS 320 or CS 332 in addition to CS 350/CS 351 for Group C'
    );
  }
  
  const coursesForGroupD = groupA.completed + 
    Math.min(groupB.completed, groupB.required) + 
    Math.min(groupC.completed, groupC.required);
  const groupDNeeded = totalRequired - coursesForGroupD;
  
  if (groupD.completed < groupDNeeded) {
    missingRequirements.push(
      `${groupDNeeded - groupD.completed} more Group D course(s) (CS 300+ level, excluding CS 320, 330, 332, 350)`
    );
  }
  
  return {
    percentage,
    totalRequired,
    totalCompleted,
    groupA,
    groupB,
    groupC,
    groupD,
    calculusCompleted,
    validCourses,
    invalidCourses,
    missingRequirements
  };
}

// Math and CS Major Interfaces
export interface MathCSMajorCompletionResult {
  percentage: number;
  totalRequired: number;
  totalCompleted: number;
  lowerDivision: LowerDivisionProgress;
  upperDivision: UpperDivisionProgress;
  validCourses: CompletedCourse[];
  invalidCourses: Array<{ course: CompletedCourse; reason: string }>;
  missingRequirements: string[];
  specialRules: SpecialRulesStatus;
}

export interface LowerDivisionProgress {
  required: number;
  completed: number;
  requirements: Array<{
    name: string;
    description: string;
    completed: boolean;
    courses: string[];
    completedCourses: string[];
  }>;
}

export interface UpperDivisionProgress {
  required: number;
  completed: number;
  requirements: Array<{
    name: string;
    description: string;
    completed: boolean;
    courses: string[];
    completedCourses: string[];
  }>;
}

export interface SpecialRulesStatus {
  cs131Used: boolean;
  ma293Used: boolean;
  ma581Used: boolean;
  ma581DoubleCounted: boolean;
  warnings: string[];
}

// Math and CS Major Course Requirements
const LOWER_DIVISION_REQUIREMENTS = [
  {
    name: 'Intro CS Sequence',
    description: '(CS 111 AND CS 112) OR equivalent',
    courses: ['CS 111', 'CS 112']
  },
  {
    name: 'Computer Systems',
    description: 'CS 210',
    courses: ['CS 210']
  },
  {
    name: 'Calculus I & II',
    description: '(MA 123 AND MA 124) OR MA 127 OR MA 129 OR equivalent',
    courses: ['MA 123', 'MA 124', 'MA 127', 'MA 129']
  },
  {
    name: 'Multivariate Calculus',
    description: '(Take 1 of) MA 225 OR MA 230',
    courses: ['MA 225', 'MA 230']
  },
  {
    name: 'Linear Algebra',
    description: '(Take 1 of) MA 242 OR MA 442',
    courses: ['MA 242', 'MA 442']
  },
  {
    name: 'Discrete Math',
    description: '(Take 1 of) MA 293 OR CS 131',
    courses: ['MA 293', 'CS 131']
  },
  {
    name: 'Abstract Algebra',
    description: 'MA 294',
    courses: ['MA 294']
  },
  {
    name: 'Probability',
    description: '(Take 1 of) MA 581 OR CS 237',
    courses: ['MA 581', 'CS 237']
  }
];

const UPPER_DIVISION_REQUIREMENTS = [
  {
    name: 'Algorithms',
    description: 'CS 330',
    courses: ['CS 330']
  },
  {
    name: 'Core CS Paradigms',
    description: '(Take 2 of) CS 320, CS 332, CS 350',
    courses: ['CS 320', 'CS 332', 'CS 350']
  },
  {
    name: 'Advanced CS',
    description: '2 additional CS courses at level 400 or above',
    courses: ['CS 400+']
  },
  {
    name: 'MA Sequence',
    description: '(Take 1 two-course sequence from the following list)',
    courses: ['MA 531', 'MA 532', 'MA 541', 'MA 542', 'MA 555', 'MA 556', 'MA 569', 'MA 570', 'MA 581', 'MA 582', 'MA 583']
  },
  {
    name: 'Advanced MA',
    description: '2 additional MA courses at level 200 or above',
    courses: ['MA 200+']
  }
];

const MA_SEQUENCE_OPTIONS = [
  ['MA 531', 'MA 532'],
  ['MA 541', 'MA 542'],
  ['MA 555', 'MA 556'],
  ['MA 569', 'MA 570'],
  ['MA 581', 'MA 582', 'MA 583'] // Any two of these three
];

/**
 * Calculate Math and CS major completion percentage
 */
export function calculateMathCSMajorCompletion(
  completedCourses: CompletedCourse[]
): MathCSMajorCompletionResult {
  const validCourses: CompletedCourse[] = [];
  const invalidCourses: Array<{ course: CompletedCourse; reason: string }> = [];
  
  // Filter courses
  console.log('\n=== Processing courses for Math and CS Major ===');
  for (const course of completedCourses) {
    const courseCode = formatCourse(course);
    
    console.log(`Checking: ${courseCode}, grade: "${course.grade}" (type: ${typeof course.grade}), isPassing: ${isPassingGrade(course.grade)}`);
    
    // Check if Metropolitan College
    if (isMetropolitanCollege(course)) {
      invalidCourses.push({
        course,
        reason: 'Metropolitan College courses do not count toward Math and CS major'
      });
      console.log(`  → Rejected: Metropolitan College`);
      continue;
    }
    
    // Check if passing grade
    if (!isPassingGrade(course.grade)) {
      invalidCourses.push({
        course,
        reason: `Grade ${course.grade || 'N/A'} is below C minimum requirement`
      });
      console.log(`  → Rejected: Grade too low`);
      continue;
    }
    
    validCourses.push(course);
    console.log(`  → Accepted`);
  }
  console.log(`\nValid courses (${validCourses.length}):`, validCourses.map(c => formatCourse(c)));
  console.log(`Invalid courses (${invalidCourses.length}):`, invalidCourses.map(ic => `${formatCourse(ic.course)}: ${ic.reason}`));
  console.log('==================================================\n');
  
  // Track which courses have been counted
  const countedCourses = new Set<string>();
  
  // Track MA sequence courses to prevent them from being used for Advanced MA
  const maSequenceCourses = new Set<string>();
  
  // Initialize progress tracking
  const lowerDivision: LowerDivisionProgress = {
    required: LOWER_DIVISION_REQUIREMENTS.length,
    completed: 0,
    requirements: LOWER_DIVISION_REQUIREMENTS.map(req => ({
      ...req,
      completed: false,
      completedCourses: []
    }))
  };
  
  const upperDivision: UpperDivisionProgress = {
    required: UPPER_DIVISION_REQUIREMENTS.length,
    completed: 0,
    requirements: UPPER_DIVISION_REQUIREMENTS.map(req => ({
      ...req,
      completed: false,
      completedCourses: []
    }))
  };
  
  const specialRules: SpecialRulesStatus = {
    cs131Used: false,
    ma293Used: false,
    ma581Used: false,
    ma581DoubleCounted: false,
    warnings: []
  };
  
  // Process Lower Division Requirements
  for (let i = 0; i < lowerDivision.requirements.length; i++) {
    const req = lowerDivision.requirements[i];
    if (!req) continue;
    
    if (req.name === 'Intro CS Sequence') {
      // Must have both CS 111 AND CS 112
      const hasCS111 = validCourses.some(c => formatCourse(c) === 'CS 111');
      const hasCS112 = validCourses.some(c => formatCourse(c) === 'CS 112');
      
      if (hasCS111 && hasCS112) {
        req.completed = true;
        req.completedCourses = ['CS 111', 'CS 112'];
        lowerDivision.completed++;
        countedCourses.add('CS 111');
        countedCourses.add('CS 112');
      }
    } else if (req.name === 'Calculus I & II') {
      // Must have (MA 123 AND MA 124) OR MA 127 OR MA 129
      const hasMA123 = validCourses.some(c => formatCourse(c) === 'MA 123');
      const hasMA124 = validCourses.some(c => formatCourse(c) === 'MA 124');
      const hasMA127 = validCourses.some(c => formatCourse(c) === 'MA 127');
      const hasMA129 = validCourses.some(c => formatCourse(c) === 'MA 129');
      
      if ((hasMA123 && hasMA124) || hasMA127 || hasMA129) {
        req.completed = true;
        if (hasMA123 && hasMA124) {
          req.completedCourses = ['MA 123', 'MA 124'];
          countedCourses.add('MA 123');
          countedCourses.add('MA 124');
        } else if (hasMA127) {
          req.completedCourses = ['MA 127'];
          countedCourses.add('MA 127');
        } else if (hasMA129) {
          req.completedCourses = ['MA 129'];
          countedCourses.add('MA 129');
        }
        lowerDivision.completed++;
      }
    } else if (req.name === 'Multivariate Calculus') {
      // Must have MA 225 OR MA 230
      const hasMA225 = validCourses.some(c => formatCourse(c) === 'MA 225');
      const hasMA230 = validCourses.some(c => formatCourse(c) === 'MA 230');
      
      if (hasMA225 || hasMA230) {
        req.completed = true;
        if (hasMA225) {
          req.completedCourses = ['MA 225'];
          countedCourses.add('MA 225');
        } else {
          req.completedCourses = ['MA 230'];
          countedCourses.add('MA 230');
        }
        lowerDivision.completed++;
      }
    } else if (req.name === 'Linear Algebra') {
      // Must have MA 242 OR MA 442
      const hasMA242 = validCourses.some(c => formatCourse(c) === 'MA 242');
      const hasMA442 = validCourses.some(c => formatCourse(c) === 'MA 442');
      
      if (hasMA242 || hasMA442) {
        req.completed = true;
        if (hasMA242) {
          req.completedCourses = ['MA 242'];
          countedCourses.add('MA 242');
        } else {
          req.completedCourses = ['MA 442'];
          countedCourses.add('MA 442');
        }
        lowerDivision.completed++;
      }
    } else if (req.name === 'Discrete Math') {
      // Must have MA 293 OR CS 131
      const hasMA293 = validCourses.some(c => formatCourse(c) === 'MA 293');
      const hasCS131 = validCourses.some(c => formatCourse(c) === 'CS 131');
      
      if (hasMA293 || hasCS131) {
        req.completed = true;
        if (hasMA293) {
          req.completedCourses = ['MA 293'];
          countedCourses.add('MA 293');
          specialRules.ma293Used = true;
        } else {
          req.completedCourses = ['CS 131'];
          countedCourses.add('CS 131');
          specialRules.cs131Used = true;
        }
        lowerDivision.completed++;
      }
    } else if (req.name === 'Probability') {
      // Must have MA 581 OR CS 237
      const hasMA581 = validCourses.some(c => formatCourse(c) === 'MA 581');
      const hasCS237 = validCourses.some(c => formatCourse(c) === 'CS 237');
      
      if (hasMA581 || hasCS237) {
        req.completed = true;
        if (hasMA581) {
          req.completedCourses = ['MA 581'];
          // Don't add MA 581 to countedCourses - it can double-count for MA Sequence
          specialRules.ma581Used = true;
        } else {
          req.completedCourses = ['CS 237'];
          countedCourses.add('CS 237');
        }
        lowerDivision.completed++;
      }
    } else {
      // Single course requirements (Computer Systems, Abstract Algebra)
      const courseCode = req.courses[0];
      if (!courseCode) continue;
      
      const hasCourse = validCourses.some(c => formatCourse(c) === courseCode);
      
      if (hasCourse) {
        req.completed = true;
        req.completedCourses = [courseCode];
        countedCourses.add(courseCode);
        lowerDivision.completed++;
      }
    }
  }
  
  // Process Upper Division Requirements
  for (let i = 0; i < upperDivision.requirements.length; i++) {
    const req = upperDivision.requirements[i];
    if (!req) continue;
    
    if (req.name === 'Algorithms') {
      // Must have CS 330
      const hasCS330 = validCourses.some(c => formatCourse(c) === 'CS 330');
      
      if (hasCS330) {
        req.completed = true;
        req.completedCourses = ['CS 330'];
        countedCourses.add('CS 330');
        upperDivision.completed++;
      }
    } else if (req.name === 'Core CS Paradigms') {
      // Must have 2 of CS 320, CS 332, CS 350
      const hasCS320 = validCourses.some(c => formatCourse(c) === 'CS 320');
      const hasCS332 = validCourses.some(c => formatCourse(c) === 'CS 332');
      const hasCS350 = validCourses.some(c => formatCourse(c) === 'CS 350');
      
      const completedParadigms = [];
      if (hasCS320) completedParadigms.push('CS 320');
      if (hasCS332) completedParadigms.push('CS 332');
      if (hasCS350) completedParadigms.push('CS 350');
      
      if (completedParadigms.length >= 2) {
        req.completed = true;
        req.completedCourses = completedParadigms.slice(0, 2); // Take first 2
        completedParadigms.slice(0, 2).forEach(course => countedCourses.add(course));
        upperDivision.completed++;
      }
    } else if (req.name === 'Advanced CS') {
      // 2 additional CS courses at level 400 or above
      const advancedCSCourses = validCourses.filter(c => 
        c.department === 'CS' && 
        c.number >= 400 && 
        !countedCourses.has(formatCourse(c))
      );
      
      // Debug logging
      console.log('Advanced CS requirement check:');
      console.log('  All valid CS courses:', validCourses.filter(c => c.department === 'CS').map(c => formatCourse(c)));
      console.log('  Advanced CS courses (>= 400):', validCourses
        .filter(c => c.department === 'CS' && c.number >= 400)
        .map(c => `${formatCourse(c)} (number: ${c.number}, type: ${typeof c.number})`));
      console.log('  Counted courses:', Array.from(countedCourses));
      console.log('  After filtering out counted:', advancedCSCourses.map(c => formatCourse(c)));
      
      if (advancedCSCourses.length >= 2) {
        req.completed = true;
        req.completedCourses = advancedCSCourses.slice(0, 2).map(c => formatCourse(c));
        advancedCSCourses.slice(0, 2).forEach(c => countedCourses.add(formatCourse(c)));
        upperDivision.completed++;
      } else if (advancedCSCourses.length === 1) {
        // Partially complete - show progress
        req.completedCourses = advancedCSCourses.map(c => formatCourse(c));
        advancedCSCourses.forEach(c => countedCourses.add(formatCourse(c)));
        console.log(`  Partially complete: 1 of 2 advanced CS courses`);
      } else {
        console.log(`  Not enough advanced CS courses: only ${advancedCSCourses.length} found (need 2)`);
      }
    } else if (req.name === 'MA Sequence') {
      // Must have one complete sequence from the options
      let sequenceCompleted = false;
      
      for (const sequence of MA_SEQUENCE_OPTIONS) {
        if (sequence.length === 2) {
          // Two-course sequences
          const hasFirst = validCourses.some(c => formatCourse(c) === sequence[0]);
          const hasSecond = validCourses.some(c => formatCourse(c) === sequence[1]);
          
          if (hasFirst && hasSecond) {
            req.completed = true;
            req.completedCourses = sequence;
            sequence.forEach(course => countedCourses.add(course));
            upperDivision.completed++;
            sequenceCompleted = true;
            break;
          }
        } else {
          // Three-course sequence (any two of MA 581, MA 582, MA 583)
          // MA 581 can double-count if it was used for Lower Division Probability
          const hasMA581 = validCourses.some(c => formatCourse(c) === 'MA 581');
          const hasMA582 = validCourses.some(c => formatCourse(c) === 'MA 582');
          const hasMA583 = validCourses.some(c => formatCourse(c) === 'MA 583');
          
          const completedCourses = [];
          if (hasMA581) completedCourses.push('MA 581');
          if (hasMA582) completedCourses.push('MA 582');
          if (hasMA583) completedCourses.push('MA 583');
          
          if (completedCourses.length >= 2) {
            req.completed = true;
            req.completedCourses = completedCourses.slice(0, 2);
            // Track MA sequence courses separately
            completedCourses.slice(0, 2).forEach(course => {
              maSequenceCourses.add(course);
              // MA 581 can be double-counted, so we don't add it to countedCourses here
              // Only add MA 582 and MA 583 if they're used
              if (course !== 'MA 581') {
                countedCourses.add(course);
              }
            });
            upperDivision.completed++;
            sequenceCompleted = true;
            break;
          } else if (completedCourses.length === 1) {
            // Partially complete - show progress
            req.completedCourses = completedCourses;
            completedCourses.forEach(course => {
              maSequenceCourses.add(course);
              // Don't add to countedCourses if it's MA 581 (can double-count)
              if (course !== 'MA 581') {
                countedCourses.add(course);
              }
            });
            console.log(`  MA Sequence partially complete: 1 of 2 courses`);
            sequenceCompleted = true; // Don't break, continue to check other sequences
          }
        }
      }
    } else if (req.name === 'Advanced MA') {
      // 2 additional MA courses at level 200 or above
      // Don't count MA 581, MA 582, MA 583 if they're used in MA Sequence
      const advancedMACourses = validCourses.filter(c => {
        const courseCode = formatCourse(c);
        return c.department === 'MA' && 
               c.number >= 200 && 
               !countedCourses.has(courseCode) &&
               !maSequenceCourses.has(courseCode);
      });
      
      if (advancedMACourses.length >= 2) {
        req.completed = true;
        req.completedCourses = advancedMACourses.slice(0, 2).map(c => formatCourse(c));
        advancedMACourses.slice(0, 2).forEach(c => countedCourses.add(formatCourse(c)));
        upperDivision.completed++;
      } else if (advancedMACourses.length === 1) {
        // Partially complete - show progress
        req.completedCourses = advancedMACourses.map(c => formatCourse(c));
        advancedMACourses.forEach(c => countedCourses.add(formatCourse(c)));
        console.log(`  Partially complete: 1 of 2 advanced MA courses`);
      }
    }
  }
  
  // Apply Special Rules
  if (specialRules.cs131Used && specialRules.ma293Used) {
    specialRules.warnings.push('CS 131/MA 293 Exclusion Rule: If CS 131 is used for Lower Division requirement #6, then MA 293 cannot be used to help satisfy Upper Division requirement #5');
  }
  
  if (specialRules.ma581Used) {
    // Check if MA 581 is also used in MA Sequence
    const maSequenceReq = upperDivision.requirements.find(req => req.name === 'MA Sequence');
    if (maSequenceReq && maSequenceReq.completedCourses.includes('MA 581')) {
      specialRules.ma581DoubleCounted = true;
    }
  }
  
  // Calculate total completion
  const totalCompleted = lowerDivision.completed + upperDivision.completed;
  const totalRequired = lowerDivision.required + upperDivision.required;
  const percentage = Math.round((totalCompleted / totalRequired) * 100);
  
  // Determine missing requirements
  const missingRequirements: string[] = [];
  
  // Lower Division missing requirements
  lowerDivision.requirements.forEach(req => {
    if (!req.completed) {
      missingRequirements.push(`${req.name}: ${req.description}`);
    }
  });
  
  // Upper Division missing requirements
  upperDivision.requirements.forEach(req => {
    if (!req.completed) {
      missingRequirements.push(`${req.name}: ${req.description}`);
    }
  });
  
  return {
    percentage,
    totalRequired,
    totalCompleted,
    lowerDivision,
    upperDivision,
    validCourses,
    invalidCourses,
    missingRequirements,
    specialRules
  };
}

