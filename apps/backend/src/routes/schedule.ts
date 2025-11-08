/**
 * Schedule Generation Route
 * 
 * Handles the full flow of AI-powered schedule generation:
 * 1. Query database for course data, slots, and user context
 * 2. Parse user feedback into constraints using LLM
 * 3. Call Python CP-SAT solver
 * 4. Return optimized schedule
 */

import express from 'express';
import query, { sql } from '../db';
import { parseConstraints, sanitizeConstraints } from '../utils/constraintParser';

const router = express.Router();

// Solver service URL (from environment or default)
const SOLVER_URL = process.env.SOLVER_URL || 'http://localhost:8000';

/**
 * Helper: Convert HH:MM to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
}

/**
 * Helper: Parse days from day string (e.g., "MWF" -> ["Mon", "Wed", "Fri"])
 */
function parseDays(dayString: string): string[] {
  const dayMap: Record<string, string> = {
    'M': 'Mon',
    'T': 'Tue',
    'W': 'Wed',
    'R': 'Thu',
    'F': 'Fri'
  };
  
  const days: string[] = [];
  for (const char of dayString.toUpperCase()) {
    if (dayMap[char]) {
      days.push(dayMap[char]);
    }
  }
  return days;
}

/**
 * POST /api/schedule/generate
 * 
 * Generate an optimized schedule based on user preferences and constraints
 */
router.post('/generate', async (req, res) => {
  try {
    const { googleId, feedback, semester, coursesToSchedule, maxCoursesPerSemester } = req.body;

    if (!googleId) {
      return res.status(400).json({ error: 'googleId is required' });
    }

    console.log(`\n=== Schedule Generation Request ===`);
    console.log(`User: ${googleId}`);
    console.log(`Feedback: ${feedback || '(none)'}`);
    console.log(`Semester: ${semester || 'any'}`);

    // 1. Get user data
    const users = await query(sql`
      SELECT id, major, minor FROM "Users" WHERE google_id = ${googleId}
    `);

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`User ID: ${user.id}, Major: ${user.major || 'none'}`);

    // 2. Get user's bookmarked courses
    const bookmarks = await query(sql`
      SELECT c.id, c.school, c.department, c.number, c.title
      FROM "Bookmark" b
      JOIN "Course" c ON c.id = b."courseId"
      WHERE b."userId" = ${user.id}
    `);
    
    const bookmarkIds = bookmarks.map(b => `${b.school}${b.department}${b.number}`);
    console.log(`Bookmarked courses: ${bookmarkIds.length}`);

    // 3. Get user's completed courses (to filter out)
    const completed = await query(sql`
      SELECT c.school, c.department, c.number
      FROM "UserCompletedCourse" ucc
      JOIN "Course" c ON c.id = ucc."courseId"
      WHERE ucc."userId" = ${user.id}
    `);
    const completedCourseIds = completed.map(c => `${c.school}${c.department}${c.number}`);
    console.log(`Completed courses: ${completedCourseIds.length}`);

    // 4. Get ALL available courses (not just bookmarks)
    // We'll let the solver decide which courses to include based on constraints
    const allAvailableCourses = await query(sql`
      SELECT c.id, c.school, c.department, c.number, c.title
      FROM "Course" c
      WHERE c.id NOT IN (
        SELECT "courseId" FROM "UserCompletedCourse" WHERE "userId" = ${user.id}
      )
      ORDER BY c.school, c.department, c.number
      LIMIT 100
    `);
    console.log(`Available courses for scheduling: ${allAvailableCourses.length}`);

    // 5. Get course data with sections (slots)
    // For simplicity, we'll create dummy section data since we don't have a full sections table
    // In production, you'd query actual course sections from your database
    const relations: any[] = [];
    const conflicts: [string, string][] = [];
    const semesters = ['Fall2025', 'Spring2026'];
    const groups: Record<string, string[]> = {};
    const hubs: Record<string, any> = { requirements: {}, classes_by_tag: {} };

    // Build relations from ALL available courses (not just bookmarks)
    // This is a simplified version - in production you'd have actual section data
    for (const course of allAvailableCourses) {
      const courseId = `${course.school}${course.department}${course.number}`;
      
      // Create mock sections for each semester
      for (const sem of semesters) {
        // Section A - MWF morning
        const ridA = `${courseId}_${sem}_A`;
        relations.push({
          rid: ridA,
          class_id: courseId,
          semester: sem,
          days: ['Mon', 'Wed', 'Fri'],
          start: timeToMinutes('09:00'),
          end: timeToMinutes('10:00'),
          instructor_id: `prof_${course.id}_a`,
          professor_rating: 4.0 + Math.random()
        });

        // Section B - TR afternoon
        const ridB = `${courseId}_${sem}_B`;
        relations.push({
          rid: ridB,
          class_id: courseId,
          semester: sem,
          days: ['Tue', 'Thu'],
          start: timeToMinutes('14:00'),
          end: timeToMinutes('15:30'),
          instructor_id: `prof_${course.id}_b`,
          professor_rating: 3.5 + Math.random()
        });
      }
    }

    console.log(`Created ${relations.length} section relations`);

    // 6. Get Hub requirements for user's major
    if (user && user.major) {
      const hubReqs = await query<{ id: number; name: string | null }>(sql`
        SELECT hr.id, hr.name
        FROM "HubRequirement" hr
        LIMIT 5
      `);
      
      for (const hub of hubReqs) {
        if (hub && hub.name) {
          const hubName = hub.name;
          hubs.requirements[hubName] = 1; // Need 1 of each hub
          
          // Get classes that fulfill this hub
          const hubCourses = await query<{ school: string; department: string; number: string | number }>(sql`
            SELECT c.school, c.department, c.number
            FROM "CourseToHubRequirement" cthr
            JOIN "Course" c ON c.id = cthr."courseId"
            WHERE cthr."hubRequirementId" = ${hub.id}
            LIMIT 10
          `);
          
          hubs.classes_by_tag[hubName] = hubCourses.map(
            c => `${c.school}${c.department}${c.number}`
          );
        }
      }
    }

    // 7. Parse user feedback into constraints using LLM
    let userConstraints: any[] = [];
    if (feedback && feedback.trim().length > 0) {
      try {
        console.log(`\n--- Parsing constraints from feedback ---`);
        const parsedConstraints = await parseConstraints(feedback);
        userConstraints = sanitizeConstraints(parsedConstraints);
        console.log(`Parsed ${userConstraints.length} constraints:`, 
          userConstraints.map(c => c.kind));
      } catch (error: any) {
        console.error('Failed to parse constraints:', error.message);
        // Continue without constraints rather than failing
      }
    }

    // 8. Build solver request
    const solverRequest = {
      relations,
      conflicts,
      groups,
      hubs,
      semesters: semester ? [semester] : semesters,
      bookmarks: bookmarkIds,
      completed_courses: completedCourseIds,
      k: maxCoursesPerSemester || 4,
      constraints: userConstraints,
      time_limit_sec: 10,
      scale: 1000
    };

    console.log(`\n--- Calling solver ---`);
    console.log(`Total sections: ${relations.length}`);
    console.log(`Completed courses (filtered): ${completedCourseIds.length}`);
    console.log(`Bookmarked courses: ${bookmarkIds.length}`);
    console.log(`Constraints: ${userConstraints.length}`);
    console.log(`Max courses per semester: ${solverRequest.k}`);

    // 9. Call Python solver
    let solverResponse: any;
    try {
      const response = await fetch(`${SOLVER_URL}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(solverRequest)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Solver returned ${response.status}: ${errorText}`);
      }

      solverResponse = await response.json();
      console.log(`Solver status: ${solverResponse.status}`);
      
      if (solverResponse.status === 'INFEASIBLE') {
        return res.json({
          success: false,
          status: 'INFEASIBLE',
          message: 'No feasible schedule found. Try relaxing some constraints or selecting fewer courses.',
          suggestions: [
            'Reduce the number of required courses',
            'Make some hard constraints soft (preferences)',
            'Remove conflicting time restrictions'
          ]
        });
      }

    } catch (error: any) {
      console.error('Solver error:', error);
      return res.status(500).json({
        error: 'Failed to call solver service',
        details: error.message,
        hint: `Make sure solver is running at ${SOLVER_URL}`
      });
    }

    // 10. Enrich results with course details
    const chosenSections = solverResponse.chosen_sections || [];
    const chosenClasses = solverResponse.chosen_classes || [];
    
    console.log(`\n--- Solution ---`);
    console.log(`Chosen sections: ${chosenSections.length}`);
    console.log(`Chosen classes: ${chosenClasses.length}`);

    // Map sections back to course details
    const schedule: any[] = [];
    for (const rid of chosenSections) {
      const relation = relations.find(r => r.rid === rid);
      if (!relation) continue;

      // Get course details from all available courses or bookmarks
      let courseDetails = allAvailableCourses.find(c => 
        `${c.school}${c.department}${c.number}` === relation.class_id
      );
      
      if (!courseDetails) {
        courseDetails = bookmarks.find(b => 
          `${b.school}${b.department}${b.number}` === relation.class_id
        );
      }

      if (courseDetails && courseDetails.school && courseDetails.department && courseDetails.number && courseDetails.title) {
        schedule.push({
          sectionId: rid,
          courseId: relation.class_id,
          school: courseDetails.school,
          department: courseDetails.department,
          number: courseDetails.number,
          title: courseDetails.title,
          semester: relation.semester,
          days: relation.days,
          startTime: relation.start,
          endTime: relation.end,
          instructor: relation.instructor_id,
          professorRating: relation.professor_rating
        });
      }
    }

    // Group by semester
    const scheduleBySemester: Record<string, any[]> = {};
    for (const course of schedule) {
      if (!scheduleBySemester[course.semester]) {
        scheduleBySemester[course.semester] = [];
      }
      const semesterCourses = scheduleBySemester[course.semester];
      if (semesterCourses) {
        semesterCourses.push(course);
      }
    }

    // 11. Return results
    res.json({
      success: true,
      status: solverResponse.status,
      schedule: scheduleBySemester,
      allCourses: schedule,
      objectiveScores: solverResponse.objective_scores,
      totalCourses: chosenClasses.length,
      parsedConstraints: userConstraints,
      message: 'Schedule generated successfully!'
    });

  } catch (error: any) {
    console.error('Schedule generation error:', error);
    res.status(500).json({
      error: 'Failed to generate schedule',
      details: error.message
    });
  }
});

/**
 * GET /api/schedule/test
 * 
 * Test endpoint to verify solver connectivity
 */
router.get('/test', async (req, res) => {
  try {
    const response = await fetch(`${SOLVER_URL}/health`);
    const data = await response.json();
    res.json({
      solverConnected: response.ok,
      solverUrl: SOLVER_URL,
      solverHealth: data
    });
  } catch (error: any) {
    res.json({
      solverConnected: false,
      solverUrl: SOLVER_URL,
      error: error.message
    });
  }
});

export default router;

