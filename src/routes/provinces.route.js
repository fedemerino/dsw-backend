import { Router } from 'express';
import { getProvinces } from '../controllers/provinces.controller.js';

const router = Router();

router.get('/', getProvinces);

export default router;