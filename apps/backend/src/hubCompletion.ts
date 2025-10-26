import sql from './db';

export interface HubCompletionResult {
  percentage: number;
  totalHubs: number;
  completedHubs: number;
  completedHubNames: string[];
  missingHubNames: string[];
  hubDetails: HubDetail[];
}

export interface HubDetail {
  hubName: string;
  completed: boolean;
  satisfiedByClasses: Array<{
    department: string;
    number: number;
    title: string;
  }>;
}

/**
 * Calculate hub completion percentage for a user
 * @param userId - The user's ID
 * @returns Hub completion statistics
 */
export async function calculateHubCompletion(
  userId: number
): Promise<HubCompletionResult> {
  try {
    // 1. Get all hub requirements from the database
    const allHubs = await sql`
      SELECT id, name 
      FROM "HubRequirement"
      ORDER BY name
    `;

    // 2. Get user's completed classes and their hub satisfactions
    const completedHubsData = await sql`
      SELECT DISTINCT 
        hr.id as hub_id,
        hr.name as hub_name,
        c.department,
        c.number,
        c.title
      FROM "UserCompletedClass" ucc
      JOIN "Class" c ON ucc."classId" = c.id
      JOIN "ClassToHubRequirement" cthr ON c.id = cthr."classId"
      JOIN "HubRequirement" hr ON cthr."hubRequirementId" = hr.id
      WHERE ucc."userId" = ${userId}
      ORDER BY hr.name, c.department, c.number
    `;

    // 3. Process the data to group classes by hub
    const hubMap = new Map<number, {
      name: string;
      classes: Array<{ department: string; number: number; title: string }>;
    }>();

    // Initialize all hubs
    for (const hub of allHubs) {
      hubMap.set(hub.id, {
        name: hub.name,
        classes: []
      });
    }

    // Add completed classes to their respective hubs
    for (const row of completedHubsData) {
      const hubData = hubMap.get(row.hub_id);
      if (hubData) {
        hubData.classes.push({
          department: row.department,
          number: row.number,
          title: row.title
        });
      }
    }

    // 4. Build the result
    const hubDetails: HubDetail[] = [];
    const completedHubNames: string[] = [];
    const missingHubNames: string[] = [];

    for (const [hubId, hubData] of hubMap.entries()) {
      const completed = hubData.classes.length > 0;
      
      hubDetails.push({
        hubName: hubData.name,
        completed,
        satisfiedByClasses: hubData.classes
      });

      if (completed) {
        completedHubNames.push(hubData.name);
      } else {
        missingHubNames.push(hubData.name);
      }
    }

    const totalHubs = allHubs.length;
    const completedHubs = completedHubNames.length;
    const percentage = totalHubs > 0 
      ? Math.round((completedHubs / totalHubs) * 100) 
      : 0;

    return {
      percentage,
      totalHubs,
      completedHubs,
      completedHubNames,
      missingHubNames,
      hubDetails
    };

  } catch (error) {
    console.error('Error calculating hub completion:', error);
    throw new Error('Failed to calculate hub completion');
  }
}

/**
 * Get a simple hub completion percentage for a user
 * @param userId - The user's ID
 * @returns Percentage of hubs completed (0-100)
 */
export async function getHubCompletionPercentage(userId: number): Promise<number> {
  const result = await calculateHubCompletion(userId);
  return result.percentage;
}

