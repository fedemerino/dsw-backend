import { Router } from 'express';
import {
  updateUser,
  getUserByEmail,
  getUsers,
  deleteUser,
  blockUser,
  unblockUser,
} from '../controllers/users.controller.js';
import {
  authenticateToken,
  requireAdmin,
} from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticateToken, requireAdmin, getUsers);
router.get('/:email', authenticateToken, getUserByEmail);
router.put('/update', authenticateToken, updateUser);
router.patch('/:email/block', authenticateToken, requireAdmin, blockUser);
router.patch('/:email/unblock', authenticateToken, requireAdmin, unblockUser);
router.delete('/:email', authenticateToken, requireAdmin, deleteUser);
export default router;
