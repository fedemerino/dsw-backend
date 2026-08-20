import { Router } from 'express';
import {
  signUp,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/signUp', signUp);
router.post('/login', login);
router.get('/refresh', refreshToken);
router.post('/logout', logout);
router.post('/forgotPassword', forgotPassword);
router.post('/resetPassword', resetPassword);
router.post('/verifyEmail', verifyEmail);
router.post('/resendVerificationEmail', resendVerificationEmail);

export default router;
