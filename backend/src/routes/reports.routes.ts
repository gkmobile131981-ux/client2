import { Router } from 'express';
import { authenticateToken, requireOwner } from '../middleware/auth';
import {
  getDashboardData,
  getRepairsReport,
  getStaffPerformanceReport,
  getAgingReport,
  getAuditLogs
} from '../controllers/reports.controller';

const router = Router();

// Apply auth middleware to all analytical routes
router.use(authenticateToken);

router.get('/dashboard', getDashboardData);
router.get('/reports/repairs', getRepairsReport);
router.get('/reports/staff-performance', requireOwner, getStaffPerformanceReport);
router.get('/reports/aging', getAgingReport);
router.get('/audit', requireOwner, getAuditLogs);

export default router;
