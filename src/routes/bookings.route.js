import { Router } from 'express';
import {
  createBooking,
  getUserBookingsCount,
  getUserBookings,
  cancelBooking,
} from '../controllers/bookings.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Get bookings count for a user
router.get('/user/:userEmail/count', getUserBookingsCount);
// Get all bookings for a user with full details
router.get('/user/:userEmail', getUserBookings);
// Create a new booking
router.post('/', authenticateToken, createBooking);
// Cancel a booking
router.delete('/:bookingId', authenticateToken, cancelBooking);

export default router;