import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import moment from 'moment';
import { PrismaClient } from '@prisma/client';
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signUpSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from '../schemas/auth.schema.js';
import { MailService } from '../services/mail.service.js';

const prisma = new PrismaClient();

/**
 * Generate a verification token for an email, store it and send the
 * confirmation mail. Reused by signUp and resendVerificationEmail.
 * @param {string} email
 */
const createAndSendVerificationEmail = async (email) => {
  await prisma.emailVerificationToken.deleteMany({ where: { email } });

  const token = jwt.sign({ email }, process.env.JWT_SECRET, {
    expiresIn: '24h',
  });
  await prisma.emailVerificationToken.create({
    data: {
      token,
      email,
      expiresAt: moment().add(24, 'hours').toDate(),
    },
  });

  const mailService = new MailService();
  await mailService.sendVerificationEmail(email, token);
};

/**
 * Generate an access token for a user
 * @param {Object} user - The user object (without password)
 * @returns {string} The access token
 */
const generateAccessToken = (user) => {
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
      jti: crypto.randomUUID(),
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
        active: true,
        roles: {
          create: {
            role: 'USER',
          },
        },
      },
      select: {
        email: true,
        fullName: true,
        phoneNumber: true,
        active: true,
        createdAt: true,
        roles: true,
      },
    });

    await createAndSendVerificationEmail(user.email);

    res.status(201).json({
      user,
      message: 'Cuenta creada. Revisá tu email para confirmarla.',
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
      select: {
        email: true,
        fullName: true,
        phoneNumber: true,
        active: true,
        blocked: true,
        emailVerified: true,
        roles: true,
        password: true,
      },
    });

    if (!user || !user.active) {
      return res.status(401).json({
        error: 'User not found or inactive',
      });
    }

    if (user.blocked) {
      return res.status(403).json({
        error: 'This account has been blocked by an administrator',
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Debés confirmar tu email antes de iniciar sesión',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
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
      error: 'Internal server error',
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
        active: true,
        blocked: true,
        emailVerified: true,
        roles: true,
      },
    });

    if (!user || !user.active || user.blocked || !user.emailVerified) {
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
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
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

export const verifyEmail = async (req, res) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body);

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (_jwtError) {
      return res.status(400).json({
        error: 'Invalid or expired token',
      });
    }

    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return res.status(400).json({
        error: 'Invalid token',
      });
    }

    if (verificationToken.email !== decoded.email) {
      return res.status(400).json({
        error: 'Token mismatch',
      });
    }

    if (verificationToken.expiresAt < moment().toDate()) {
      return res.status(400).json({
        error: 'Token expired',
      });
    }

    await prisma.user.update({
      where: { email: verificationToken.email },
      data: { emailVerified: true },
    });

    await prisma.emailVerificationToken.deleteMany({
      where: { email: verificationToken.email },
    });

    res.status(200).json({
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

export const resendVerificationEmail = async (req, res) => {
  try {
    const { error, data } = resendVerificationSchema.safeParse(req.body);
    if (error) {
      return res.status(400).json({
        error: error.message,
      });
    }
    const { email } = data;

    const genericResponse = {
      message:
        'If the account exists and is not verified, an email has been sent',
    };

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!existingUser || existingUser.emailVerified) {
      return res.status(200).json(genericResponse);
    }

    await createAndSendVerificationEmail(email);

    res.status(200).json(genericResponse);
  } catch (error) {
    console.error('Resend verification email error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};
