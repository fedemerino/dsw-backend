import { Router } from 'express';
import {
  createListing,
  getAmenities,
  getFeaturedListings,
} from '../controllers/listings.controller.js';

const router = Router();

router.post('/', createListing);
router.get('/amenities', getAmenities);
router.get('/featured', getFeaturedListings);
router.get('/:id', getFeaturedListings);
export default router;
