import { Router } from 'express';
import {
  updateUser,
  getUserByEmail,
  getUsers,
  deleteUser,
} from '../controllers/users.controller.js';
import {
  authenticateToken,
  requireAdmin,
} from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticateToken, requireAdmin, getUsers);
router.get('/:email', authenticateToken, getUserByEmail);
router.put('/update', authenticateToken, updateUser);
router.delete('/:email', authenticateToken, requireAdmin, deleteUser);
export default router;
