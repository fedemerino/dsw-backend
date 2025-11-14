import { Router } from 'express';
import {
  toggleFavorite,
  createListing,
  getFeaturedListings,
  getListingById,
  getListings,
  getFavoriteListings,
  getListingBookings,
  getUserListings,
  updateListing,
} from '../controllers/listings.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', getListings);
router.post('/', authenticateToken, createListing);
router.post('/favorites', authenticateToken, toggleFavorite);
router.get('/favorites', authenticateToken, getFavoriteListings);
router.get('/featured', getFeaturedListings);
router.get('/myListings', authenticateToken, getUserListings);
router.get('/:id', getListingById);
router.get('/bookings/:id', getListingBookings);
router.put('/:id', authenticateToken, updateListing);

export default router;
