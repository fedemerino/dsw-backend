import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import moment from 'moment';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generate an access token for a user
 * @param {Object} user - The user object
 * @returns {string} The access token
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user.email,
      isAdmin: user.isAdmin,
      type: 'access',
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

/**
 * Generate a refresh token for a user
 * @param {Object} user - The user object
 * @returns {string} The refresh token
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      userId: user.email,
      type: 'refresh',
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Set a refresh token cookie
 * @param {Object} res - The response object
 * @param {string} refreshToken - The refresh token
 */
const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS in production
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth/refresh',
  });
};

/**
 * Sign up a new user
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const signup = async (req, res) => {
  try {
    const { email, firstName, lastName, password } = req.body;
    console.log(req.body);
    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({
        error: 'All fields are required',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters',
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        password: hashedPassword,
      },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        isAdmin: true,
        avatar: true,
        active: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userEmail: user.email,
        expiresAt: moment().add(7, 'days').toDate(),
      },
    });

    // Set cookie with refresh token
    setRefreshTokenCookie(res, refreshToken);

    res.status(201).json({
      user,
      accessToken,
      message: 'User created successfully',
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validations
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.active) {
      return res.status(401).json({
        error: 'User not found or inactive',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userEmail: user.email,
        expiresAt: moment().add(7, 'days').toDate(),
      },
    });

    // Set cookie with refresh token
    setRefreshTokenCookie(res, refreshToken);

    // Don't send password in the response
    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({
      user: userWithoutPassword,
      accessToken,
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token not provided',
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Verify that it exists in the database
    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        userEmail: decoded.userId,
        expiresAt: { gt: moment().toDate() },
      },
    });

    if (!storedToken) {
      return res.status(401).json({
        error: 'Invalid refresh token',
      });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: decoded.userId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        isAdmin: true,
        active: true,
      },
    });

    if (!user || !user.active) {
      return res.status(401).json({
        error: 'User not found or inactive',
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user);

    res.status(200).json({
      accessToken: newAccessToken,
      user,
    });
  } catch (error) {
    console.error('Refresh token error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid refresh token',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Refresh token expired',
      });
    }

    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (refreshToken) {
      // Invalidate refresh token in the database
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    // Clear cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
    });

    res.status(200).json({
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};
