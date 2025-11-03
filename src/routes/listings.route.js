import { Router } from 'express';
import {
  addToFavorites,
  createListing,
  getAmenities,
  getFeaturedListings,
  getListingById,
  getListings,
} from '../controllers/listings.controller.js';

const router = Router();

router.get('/', getListings);
router.post('/', createListing);
router.post('/favorites', addToFavorites);
router.get('/amenities', getAmenities);
router.get('/featured', getFeaturedListings);
router.get('/:id', getListingById);
export default router;
