import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  searchSubscriptions,
  getSubscriptionRecord,
  saveSubscriptionRecord
} from '../controllers/subscriptions.controller';

const router = Router();

// Require authentication for subscription operations
router.use(authenticateToken);

router.get('/search', searchSubscriptions);
router.get('/record', getSubscriptionRecord);
router.post('/save', saveSubscriptionRecord);

export default router;
