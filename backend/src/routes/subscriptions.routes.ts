import { Router } from 'express';
import { authenticateToken, requireOwner } from '../middleware/auth';
import {
  searchSubscriptions,
  getSubscriptionRecord,
  saveSubscriptionRecord,
  getSubscriptionSummary,
  sendSubscriptionBill,
  listSubscriptionMembers,
  createSubscriptionMember,
  updateSubscriptionMember,
  deleteSubscriptionMember,
  getShopSubscriptionHistory
} from '../controllers/subscriptions.controller';

const router = Router();

// Require authentication and Owner role for subscription operations
router.use(authenticateToken);
router.use(requireOwner);

router.get('/search', searchSubscriptions);
router.get('/record', getSubscriptionRecord);
router.get('/summary', getSubscriptionSummary);
router.post('/save', saveSubscriptionRecord);
router.post('/send-bill', sendSubscriptionBill);

// Member & Shop Management Routes (Admin Restricted)
router.get('/members', listSubscriptionMembers);
router.post('/members', createSubscriptionMember);
router.put('/members/:id', updateSubscriptionMember);
router.delete('/members/:id', deleteSubscriptionMember);

// Detailed Shop Subscription History Audit Route
router.get('/shop-history', getShopSubscriptionHistory);

export default router;

