import { Router } from 'express';
import { getAmenities } from '../controllers/amenities.controller.js';

const router = Router();

router.get('/', getAmenities);

export default router;
