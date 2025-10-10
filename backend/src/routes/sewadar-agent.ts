import { Router, Request, Response } from 'express';
import { databaseService } from '../services/database';
import logger from '../utils/logger';

const router = Router();

// Get sewadar basics by badge or ID
router.post('/basics', async (req: Request, res: Response) => {
  try {
    const { searchBadge, sewadarId } = req.body;
    if (!searchBadge && !sewadarId) {
      return res.status(400).json({
        success: false,
        error: 'searchBadge or sewadarId is required'
      });
    }
    // Use generic query since getSewadarBasics doesn't exist
    const query = sewadarId
      ? 'SELECT * FROM sewadars WHERE id = $1'
      : 'SELECT * FROM sewadars WHERE badge_number = $1';
    const params = [sewadarId || searchBadge];
    const result = await databaseService.query(query, params);
    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Sewadar basics error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Get sewadar attendance summary
router.post('/attendance-summary', async (req: Request, res: Response) => {
  try {
    const { searchBadge, startDate, endDate } = req.body;
    // Additional filters for future implementation: areaId, centreId, deptId
    if (!searchBadge) {
      return res.status(400).json({
        success: false,
        error: 'searchBadge is required'
      });
    }
    // Use generic query since getAttendanceSummary doesn't exist
    let query = `
      SELECT s.badge_number, s.first_name, s.last_name,
             COUNT(a.id) as total_days,
             COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
             COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_days
      FROM sewadars s
      LEFT JOIN attendance a ON s.id = a.sewadar_id
      WHERE s.badge_number = $1
    `;
    
    const params: any[] = [searchBadge];
    let paramIndex = 2;
    
    if (startDate) {
      query += ` AND a.date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      query += ` AND a.date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    query += ' GROUP BY s.id, s.badge_number, s.first_name, s.last_name';
    
    const result = await databaseService.query(query, params);
    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Sewadar attendance summary error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

export default router;