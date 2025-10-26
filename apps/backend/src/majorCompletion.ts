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

