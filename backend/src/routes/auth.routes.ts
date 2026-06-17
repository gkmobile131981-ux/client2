import { Router } from 'express';
import multer from 'multer';
import { authenticateToken, requireOwner } from '../middleware/auth';
import {
  registerOwner,
  login,
  createStaff,
  refresh,
  logout,
  getMe,
  getStaff,
  toggleStaffStatus,
  updateProfile,
  changePassword,
  resetStaffPassword,
  updateShop
} from '../controllers/auth.controller';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1 * 1024 * 1024 // 1MB logo limit
  }
});

// Public routes
router.post('/register-owner', registerOwner);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Protected routes
router.get('/me', authenticateToken, getMe);
router.post('/create-staff', authenticateToken, requireOwner, createStaff);
router.get('/staff', authenticateToken, requireOwner, getStaff);
router.put('/staff/:id', authenticateToken, requireOwner, toggleStaffStatus);

router.put('/update-profile', authenticateToken, updateProfile);
router.post('/change-password', authenticateToken, changePassword);
router.post('/reset-staff-password', authenticateToken, requireOwner, resetStaffPassword);
router.put('/shop', authenticateToken, requireOwner, upload.single('logo'), updateShop);

export default router;
