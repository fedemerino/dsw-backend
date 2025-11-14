import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { createReview } from '../controllers/reviews.controller.js';

const router = Router();

router.post('/', authenticateToken, createReview);

export default router;
