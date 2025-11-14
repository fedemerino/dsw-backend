import { Router } from 'express';
import {
  signUp,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/signUp', signUp);
router.post('/login', login);
router.get('/refresh', refreshToken);
router.post('/logout', logout);
router.post('/forgotPassword', forgotPassword);
router.post('/resetPassword', resetPassword);

export default router;