import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import {
  createReview,
  getReviewById,
  updateReview,
  deleteReview,
} from '../controllers/reviews.controller.js';

const router = Router();

router.post('/', authenticateToken, createReview);
router.get('/:id', getReviewById);
router.put('/:id', authenticateToken, updateReview);
router.delete('/:id', authenticateToken, deleteReview);

export default router;
