import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import usersRouter from './routes/users.route.js';
import listingsRouter from './routes/listings.route.js';
import authRouter from './routes/auth.route.js';
import provincesRouter from './routes/provinces.route.js';
import citiesRouter from './routes/cities.route.js';
import paymentMethodsRouter from './routes/paymentMethods.route.js';
import amenitiesRouter from './routes/amenities.route.js';
import bookingsRouter from './routes/bookings.route.js';
import filesRouter from './routes/files.route.js';
import reviewsRouter from './routes/reviews.route.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/provinces', provincesRouter);
app.use('/api/cities', citiesRouter);
app.use('/api/paymentMethods', paymentMethodsRouter);
app.use('/api/amenities', amenitiesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/files', filesRouter);
app.use('/api/reviews', reviewsRouter);
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
