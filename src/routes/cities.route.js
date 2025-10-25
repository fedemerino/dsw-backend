import { Router } from 'express';
import {
  getCities,
  getCitiesByProvinceId,
  getPopularCities,
} from '../controllers/cities.controller.js';

const router = Router();

router.get('/', getCities);
router.get('/popular', getPopularCities);
router.get('/province/:provinceId', getCitiesByProvinceId);


export default router;
