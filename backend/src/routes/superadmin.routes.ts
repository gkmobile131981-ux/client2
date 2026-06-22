import { Router } from 'express';
import { getSuperAdminDashboard, toggleShopStatus } from '../controllers/superadmin.controller';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth';

const router = Router();

// Apply auth middleware globally on superadmin routes
router.use(authenticateToken);
router.use(requireSuperAdmin);

router.get('/dashboard', getSuperAdminDashboard);
router.post('/shops/:id/toggle', toggleShopStatus);

export default router;
