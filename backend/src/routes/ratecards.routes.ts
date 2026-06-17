import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import {
  getRateCards,
  getRateCardById,
  lookupRateCard,
  createRateCard,
  updateRateCard,
  deleteRateCard,
  upsertRateCardServices,
} from '../controllers/ratecards.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.use(authenticateToken);

router.get('/', getRateCards);
router.get('/lookup', lookupRateCard);
router.get('/:id', getRateCardById);
router.post('/', upload.single('modelImage'), createRateCard);
router.put('/:id', upload.single('modelImage'), updateRateCard);
router.delete('/:id', deleteRateCard);
router.post('/:id/services', upsertRateCardServices);

export default router;
