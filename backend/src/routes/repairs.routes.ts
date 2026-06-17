import { Router } from 'express';
import multer from 'multer';
import { authenticateToken, requireOwner } from '../middleware/auth';
import {
  getAllRepairs,
  getRepairById,
  createRepair,
  updateRepairStatus,
  updateRepair,
  deleteRepair,
  deliverRepair,
  getRepairReceipt
} from '../controllers/repairs.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Apply auth middleware to all repair endpoints
router.use(authenticateToken);

router.get('/', getAllRepairs);

router.post(
  '/',
  upload.fields([
    { name: 'frontPhoto', maxCount: 1 },
    { name: 'backPhoto', maxCount: 1 }
  ]),
  createRepair
);

router.get('/:id', getRepairById);
router.post('/:id/deliver', deliverRepair);
router.get('/:id/receipt', getRepairReceipt);
router.put('/:id/status', updateRepairStatus);
router.put('/:id', requireOwner, updateRepair);
router.delete('/:id', requireOwner, deleteRepair);

export default router;

