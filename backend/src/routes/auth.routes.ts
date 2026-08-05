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
  deleteStaff,
  updateProfile,
  updateOwnerIdCard,
  changePassword,
  resetStaffPassword,
  updateShop,
  getAdminSessions,
  revokeAdminSession
} from '../controllers/auth.controller';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1 * 1024 * 1024 // 1MB logo limit
  }
});

const uploadPhotoCard = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB photo limit
  }
});

// Public routes
router.post('/register-owner', upload.single('logo'), registerOwner);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Protected routes
router.get('/me', authenticateToken, getMe);
router.post('/create-staff', authenticateToken, requireOwner, createStaff);
router.get('/staff', authenticateToken, requireOwner, getStaff);
router.put('/staff/:id', authenticateToken, requireOwner, toggleStaffStatus);
router.delete('/staff/:id', authenticateToken, requireOwner, deleteStaff);

router.put('/update-profile', authenticateToken, updateProfile);
router.put('/profile/id-card', authenticateToken, uploadPhotoCard.single('photo'), updateOwnerIdCard);
router.post('/change-password', authenticateToken, changePassword);
router.post('/reset-staff-password', authenticateToken, requireOwner, resetStaffPassword);
router.put('/shop', authenticateToken, requireOwner, upload.single('logo'), updateShop);

// Admin Security: 6 Active Sessions Management Routes
router.get('/admin-sessions', authenticateToken, requireOwner, getAdminSessions);
router.post('/revoke-session', authenticateToken, requireOwner, revokeAdminSession);

export default router;
