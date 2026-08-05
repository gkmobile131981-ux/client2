import { Router } from 'express';
import { getSuperAdminDashboard, toggleShopStatus, resetShopOwnerPassword, getStorageMetricsHandler, deleteStorageFileHandler } from '../controllers/superadmin.controller';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth';

const router = Router();

// Apply auth middleware globally on superadmin routes
router.use(authenticateToken);
router.use(requireSuperAdmin);

router.get('/dashboard', getSuperAdminDashboard);
router.post('/shops/:id/toggle', toggleShopStatus);
router.post('/shops/:id/reset-password', resetShopOwnerPassword);
router.get('/storage-metrics', getStorageMetricsHandler);
router.delete('/storage-file', deleteStorageFileHandler);

export default router;
