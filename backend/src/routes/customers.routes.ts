import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import {
  getCustomers,
  createCustomer,
  getCustomerById,
  updateCustomer,
  deleteCustomer
} from '../controllers/customers.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Apply auth middleware to all customer endpoints
router.use(authenticateToken);

router.get('/', getCustomers);
router.post('/', upload.single('photo'), createCustomer);
router.get('/:id', getCustomerById);
router.put('/:id', upload.single('photo'), updateCustomer);
router.delete('/:id', deleteCustomer);

export default router;
