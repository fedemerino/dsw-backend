import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import {
  createReview,
  getReviewById,
  deleteReview,
} from '../controllers/reviews.controller.js';

const router = Router();

router.post('/', authenticateToken, createReview);
router.get('/:id', getReviewById);
router.delete('/:id', authenticateToken, deleteReview);

export default router;
