import { Router } from 'express';
import {
  createBooking,
  updateBooking,
  getUserBookingsCount,
  getUserBookings,
  cancelBooking,
  getHostBookings,
  getHostBookingStats,
} from '../controllers/bookings.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Get all bookings received for the authenticated host's listings
router.get('/host', authenticateToken, getHostBookings);
// Revenue/booking metrics for the authenticated host's own listings
router.get('/host/stats', authenticateToken, getHostBookingStats);
// Get bookings count for a user
router.get('/user/:userEmail/count', authenticateToken, getUserBookingsCount);
// Get all bookings for a user with full details
router.get('/user/:userEmail', authenticateToken, getUserBookings);
// Create a new booking
router.post('/', authenticateToken, createBooking);
// Update a pending booking's dates/guests
router.put('/:bookingId', authenticateToken, updateBooking);
// Cancel a booking
router.delete('/:bookingId', authenticateToken, cancelBooking);

export default router;
