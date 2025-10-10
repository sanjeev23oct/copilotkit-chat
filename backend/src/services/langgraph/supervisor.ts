/* databaseService import removed: not used in supervisor agent */
import axios from 'axios';

type QueryIntent = 'sewadar' | 'postgres' | 'unknown';

function detectIntent(query: string): QueryIntent {
  const sewadarKeywords = [
    'sewadar', 'badge', 'attendance', 'department', 'centre', 'area', 'eligibility'
  ];
  if (sewadarKeywords.some(k => query.toLowerCase().includes(k))) {
    return 'sewadar';
  }
  // Add more logic for other agents if needed
  return 'unknown';
}

export async function supervisorAgent(userQuery: string, context: any = {}) {
  const intent = detectIntent(userQuery);

  if (intent === 'sewadar') {
    // Route to sewadar-agent endpoints
    if (/attendance|summary/.test(userQuery.toLowerCase())) {
      // Example: attendance summary
      const { searchBadge, startDate, endDate, areaId, centreId, deptId } = context;
      const res = await axios.post(
        'http://localhost:3010/api/sewadar-agent/attendance-summary',
        { searchBadge, startDate, endDate, areaId, centreId, deptId }
      );
      return res.data;
    } else {
      // Example: sewadar basics
      const { searchBadge, sewadarId } = context;
      const res = await axios.post(
        'http://localhost:3010/api/sewadar-agent/basics',
        { searchBadge, sewadarId }
      );
      return res.data;
    }
  }

  // Route to other agents (e.g., Postgres)
  if (intent === 'postgres') {
    // Implement routing to postgres-agent if needed
    // Example:
    // const res = await axios.post('http://localhost:3010/api/postgres-agent/nl-query', { query: userQuery });
    // return res.data;
    return { success: false, error: 'Postgres agent routing not implemented.' };
  }

  return { success: false, error: 'Query intent not recognized.' };
}