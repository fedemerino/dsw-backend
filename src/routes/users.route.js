import { Router } from 'express';
import {
  signup,
  login,
  refreshToken,
  logout,
} from '../controllers/users.controller.js';

const router = Router();

// Auth routes
router.post('/sign-up', signup);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

export default router;
