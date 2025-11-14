import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import moment from 'moment';
import { PrismaClient } from '@prisma/client';
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signUpSchema,
} from '../schemas/auth.schema.js';
import { MailService } from '../services/mail.service.js';
const prisma = new PrismaClient();

/**
 * Generate an access token for a user
 * @param {Object} user - The user object (without password)
 * @returns {string} The access token
 */
const generateAccessToken = (user) => {
  // Remove password and other sensitive data before encoding in JWT
  const { password: _password, ...userPayload } = user;

  return jwt.sign(
    {
      ...userPayload,
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
      email: user.email,
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
    path: '/api/auth',
  });
};

/**
 * Sign up a new user
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const signUp = async (req, res) => {
  try {
    const { email, fullName, password, phoneNumber } = signUpSchema.parse(
      req.body
    );

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
        fullName,
        password: hashedPassword,
        phoneNumber,
        isAdmin: false,
        active: true,
      },
      select: {
        email: true,
        fullName: true,
        phoneNumber: true,
        isAdmin: true,
        active: true,
        createdAt: true,
      },
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userEmail: user.email,
        expiresAt: moment().add(7, 'days').toDate(),
      },
    });

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
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.active) {
      return res.status(401).json({
        error: 'Usuario no encontrado o inactivo',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userEmail: user.email,
        expiresAt: moment().add(7, 'days').toDate(),
      },
    });

    setRefreshTokenCookie(res, refreshToken);

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

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        userEmail: decoded.email,
        expiresAt: { gt: moment().toDate() },
      },
    });

    if (!storedToken) {
      return res.status(401).json({
        error: 'Invalid refresh token',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: decoded.email },
      select: {
        email: true,
        fullName: true,
        phoneNumber: true,
        isAdmin: true,
        active: true,
      },
    });

    if (!user || !user.active) {
      return res.status(401).json({
        error: 'User not found or inactive',
      });
    }

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
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.ENVIRONMENT === 'production',
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

export const forgotPassword = async (req, res) => {
  try {
    const { error, data } = forgotPasswordSchema.safeParse(req.body);
    if (error) {
      return res.status(400).json({
        error: error.message,
      });
    }
    const { email } = data;
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (!existingUser) {
      return res.status(200).json({
        message: 'If the email exists, a password reset link has been sent',
      });
    }

    await prisma.resetPasswordToken.deleteMany({
      where: { email },
    });

    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    await prisma.resetPasswordToken.create({
      data: {
        token,
        email,
        expiresAt: moment().add(1, 'hour').toDate(),
      },
    });
    const mailService = new MailService();
    await mailService.sendResetPasswordEmail(email, token);
    res.status(200).json({
      message: 'If the email exists, a password reset link has been sent',
    });
  } catch (error) {
    console.error('Request new password error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmNewPassword } =
      resetPasswordSchema.parse(req.body);

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        error: 'Passwords do not match',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (_jwtError) {
      return res.status(400).json({
        error: 'Invalid or expired token',
      });
    }

    const resetPasswordToken = await prisma.resetPasswordToken.findUnique({
      where: { token },
    });

    if (!resetPasswordToken) {
      return res.status(400).json({
        error: 'Invalid token',
      });
    }

    if (resetPasswordToken.email !== decoded.email) {
      return res.status(400).json({
        error: 'Token mismatch',
      });
    }

    if (resetPasswordToken.expiresAt < moment().toDate()) {
      return res.status(400).json({
        error: 'Token expired',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: resetPasswordToken.email },
    });

    if (!user) {
      return res.status(400).json({
        error: 'User not found',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { email: user.email },
      data: { password: hashedPassword },
    });

    // Eliminar el token usado y cualquier otro token del usuario
    await prisma.resetPasswordToken.deleteMany({
      where: { email: user.email },
    });

    res.status(200).json({
      message: 'Password reset successful',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};
