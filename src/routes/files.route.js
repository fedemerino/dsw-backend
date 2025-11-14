import { Router } from 'express';
import { generateImageUploadUrl } from '../controllers/files.controller.js';

const router = Router();

router.get('/imageUploadUrl', generateImageUploadUrl);

export default router;
