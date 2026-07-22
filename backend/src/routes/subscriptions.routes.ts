import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  searchSubscriptions,
  getSubscriptionRecord,
  saveSubscriptionRecord,
  getSubscriptionSummary,
  sendSubscriptionBill
} from '../controllers/subscriptions.controller';

const router = Router();

// Require authentication for subscription operations
router.use(authenticateToken);

router.get('/search', searchSubscriptions);
router.get('/record', getSubscriptionRecord);
router.get('/summary', getSubscriptionSummary);
router.post('/save', saveSubscriptionRecord);
router.post('/send-bill', sendSubscriptionBill);

export default router;

