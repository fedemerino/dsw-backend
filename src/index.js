import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import usersRouter from './routes/users.route.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true, // Importante para cookies
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Para manejar cookies

// Routes
app.use('/api/users', usersRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
