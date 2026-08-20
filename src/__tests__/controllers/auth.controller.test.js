import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import {
  signUp,
  login,
  refreshToken as refreshTokenHandler,
  logout,
  forgotPassword,
  resetPassword,
} from '../../controllers/auth.controller.js';

const mockSendResetPasswordEmail = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    resetPasswordToken: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  })),
}));

jest.mock('../../services/mail.service.js', () => ({
  MailService: jest.fn().mockImplementation(() => ({
    sendResetPasswordEmail: mockSendResetPasswordEmail,
  })),
}));

// auth.controller.js does `const prisma = new PrismaClient()` at module top level, which (per
// ESM evaluation order) runs before any of this file's own top-level code — so we can't hand it
// mock fns via closures declared below the import. Grab the actual instance it constructed instead.
const prismaInstance = PrismaClient.mock.results[0].value;
const mockUserFindUnique = prismaInstance.user.findUnique;
const mockUserCreate = prismaInstance.user.create;
const mockUserUpdate = prismaInstance.user.update;
const mockRefreshTokenCreate = prismaInstance.refreshToken.create;
const mockRefreshTokenFindFirst = prismaInstance.refreshToken.findFirst;
const mockRefreshTokenDeleteMany = prismaInstance.refreshToken.deleteMany;
const mockResetTokenDeleteMany = prismaInstance.resetPasswordToken.deleteMany;
const mockResetTokenCreate = prismaInstance.resetPasswordToken.create;
const mockResetTokenFindUnique = prismaInstance.resetPasswordToken.findUnique;

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('signUp', () => {
  const body = {
    email: 'new@example.com',
    fullName: 'New User',
    password: 'password123',
    confirmPassword: 'password123',
  };

  it('creates a new user and returns tokens', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue({
      email: body.email,
      fullName: body.fullName,
      roles: [{ role: 'USER' }],
    });
    mockRefreshTokenCreate.mockResolvedValue({});

    const req = { body };
    const res = mockRes();

    await signUp(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.cookie).toHaveBeenCalledWith(
      'refreshToken',
      expect.any(String),
      expect.any(Object)
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'User created successfully' })
    );
  });

  it('rejects when the user already exists', async () => {
    mockUserFindUnique.mockResolvedValue({ email: body.email });

    const req = { body };
    const res = mockRes();

    await signUp(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'User already exists' });
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it('returns 500 on invalid input', async () => {
    const req = { body: { email: 'not-an-email' } };
    const res = mockRes();

    await signUp(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('login', () => {
  it('logs in with valid credentials', async () => {
    const hashed = await bcrypt.hash('password123', 4);
    mockUserFindUnique.mockResolvedValue({
      email: 'user@example.com',
      fullName: 'User',
      active: true,
      roles: [{ role: 'USER' }],
      password: hashed,
    });
    mockRefreshTokenCreate.mockResolvedValue({});

    const req = {
      body: { email: 'user@example.com', password: 'password123' },
    };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.user.password).toBeUndefined();
    expect(payload.accessToken).toBeDefined();
  });

  it('rejects when the user does not exist', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const req = {
      body: { email: 'ghost@example.com', password: 'password123' },
    };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects an inactive user', async () => {
    mockUserFindUnique.mockResolvedValue({
      email: 'x@example.com',
      active: false,
    });

    const req = { body: { email: 'x@example.com', password: 'password123' } };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects a blocked user', async () => {
    const hashed = await bcrypt.hash('password123', 4);
    mockUserFindUnique.mockResolvedValue({
      email: 'blocked@example.com',
      active: true,
      blocked: true,
      roles: [{ role: 'USER' }],
      password: hashed,
    });

    const req = {
      body: { email: 'blocked@example.com', password: 'password123' },
    };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'This account has been blocked by an administrator',
    });
  });

  it('rejects an invalid password', async () => {
    const hashed = await bcrypt.hash('correct-password', 4);
    mockUserFindUnique.mockResolvedValue({
      email: 'user@example.com',
      active: true,
      roles: [],
      password: hashed,
    });

    const req = {
      body: { email: 'user@example.com', password: 'wrong-password' },
    };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
  });

  it('returns 500 on a database error', async () => {
    mockUserFindUnique.mockRejectedValue(new Error('db down'));
    const req = {
      body: { email: 'user@example.com', password: 'password123' },
    };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('refreshToken', () => {
  it('rejects when no refresh token cookie is present', async () => {
    const req = { cookies: {} };
    const res = mockRes();

    await refreshTokenHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects an expired refresh token', async () => {
    const token = jwt.sign(
      { email: 'user@example.com', type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: -10 }
    );
    const req = { cookies: { refreshToken: token } };
    const res = mockRes();

    await refreshTokenHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Refresh token expired' });
  });

  it('rejects when the user is no longer active', async () => {
    const token = jwt.sign(
      { email: 'user@example.com', type: 'refresh' },
      process.env.JWT_REFRESH_SECRET
    );
    mockRefreshTokenFindFirst.mockResolvedValue({ token });
    mockUserFindUnique.mockResolvedValue({
      email: 'user@example.com',
      active: false,
    });

    const req = { cookies: { refreshToken: token } };
    const res = mockRes();

    await refreshTokenHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'User not found or inactive',
    });
  });

  it('rejects a blocked user', async () => {
    const token = jwt.sign(
      { email: 'user@example.com', type: 'refresh' },
      process.env.JWT_REFRESH_SECRET
    );
    mockRefreshTokenFindFirst.mockResolvedValue({ token });
    mockUserFindUnique.mockResolvedValue({
      email: 'user@example.com',
      active: true,
      blocked: true,
    });

    const req = { cookies: { refreshToken: token } };
    const res = mockRes();

    await refreshTokenHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects an invalid refresh token', async () => {
    const req = { cookies: { refreshToken: 'not-a-real-token' } };
    const res = mockRes();

    await refreshTokenHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid refresh token' });
  });

  it('rejects a refresh token not found in the database', async () => {
    const token = jwt.sign(
      { email: 'user@example.com', type: 'refresh' },
      process.env.JWT_REFRESH_SECRET
    );
    mockRefreshTokenFindFirst.mockResolvedValue(null);

    const req = { cookies: { refreshToken: token } };
    const res = mockRes();

    await refreshTokenHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid refresh token' });
  });

  it('issues a new access token for a valid refresh token', async () => {
    const token = jwt.sign(
      { email: 'user@example.com', type: 'refresh' },
      process.env.JWT_REFRESH_SECRET
    );
    mockRefreshTokenFindFirst.mockResolvedValue({ token });
    mockUserFindUnique.mockResolvedValue({
      email: 'user@example.com',
      active: true,
      roles: [{ role: 'USER' }],
    });

    const req = { cookies: { refreshToken: token } };
    const res = mockRes();

    await refreshTokenHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].accessToken).toBeDefined();
  });

  it('returns 500 on an unexpected database error', async () => {
    const token = jwt.sign(
      { email: 'user@example.com', type: 'refresh' },
      process.env.JWT_REFRESH_SECRET
    );
    mockRefreshTokenFindFirst.mockRejectedValue(new Error('db down'));

    const req = { cookies: { refreshToken: token } };
    const res = mockRes();

    await refreshTokenHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('logout', () => {
  it('deletes the stored refresh token and clears the cookie', async () => {
    mockRefreshTokenDeleteMany.mockResolvedValue({});
    const req = { cookies: { refreshToken: 'abc' } };
    const res = mockRes();

    await logout(req, res);

    expect(mockRefreshTokenDeleteMany).toHaveBeenCalledWith({
      where: { token: 'abc' },
    });
    expect(res.clearCookie).toHaveBeenCalledWith(
      'refreshToken',
      expect.objectContaining({ path: '/api/auth' })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('succeeds even without a refresh token cookie', async () => {
    const req = { cookies: {} };
    const res = mockRes();

    await logout(req, res);

    expect(mockRefreshTokenDeleteMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 500 on an unexpected database error', async () => {
    mockRefreshTokenDeleteMany.mockRejectedValue(new Error('db down'));
    const req = { cookies: { refreshToken: 'abc' } };
    const res = mockRes();

    await logout(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('forgotPassword', () => {
  it('does nothing but responds 200 when the user does not exist', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const req = { body: { email: 'ghost@example.com' } };
    const res = mockRes();

    await forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockSendResetPasswordEmail).not.toHaveBeenCalled();
  });

  it('creates a reset token and sends the email for an existing user', async () => {
    mockUserFindUnique.mockResolvedValue({ email: 'user@example.com' });
    mockResetTokenDeleteMany.mockResolvedValue({});
    mockResetTokenCreate.mockResolvedValue({});

    const req = { body: { email: 'user@example.com' } };
    const res = mockRes();

    await forgotPassword(req, res);

    expect(mockResetTokenCreate).toHaveBeenCalled();
    expect(mockSendResetPasswordEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.any(String)
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects an invalid email', async () => {
    const req = { body: { email: 'not-an-email' } };
    const res = mockRes();

    await forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on an unexpected database error', async () => {
    mockUserFindUnique.mockRejectedValue(new Error('db down'));
    const req = { body: { email: 'user@example.com' } };
    const res = mockRes();

    await forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('resetPassword', () => {
  it('rejects mismatched passwords', async () => {
    const req = {
      body: {
        token: 'abc',
        newPassword: 'password123',
        confirmNewPassword: 'different123',
      },
    };
    const res = mockRes();

    await resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Passwords do not match' });
  });

  it('rejects an invalid or expired JWT', async () => {
    const req = {
      body: {
        token: 'not-a-jwt',
        newPassword: 'password123',
        confirmNewPassword: 'password123',
      },
    };
    const res = mockRes();

    await resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid or expired token',
    });
  });

  it('rejects when the reset token is not in the database', async () => {
    const token = jwt.sign(
      { email: 'user@example.com' },
      process.env.JWT_SECRET
    );
    mockResetTokenFindUnique.mockResolvedValue(null);

    const req = {
      body: {
        token,
        newPassword: 'password123',
        confirmNewPassword: 'password123',
      },
    };
    const res = mockRes();

    await resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
  });

  it('rejects a token whose email does not match the stored record', async () => {
    const token = jwt.sign(
      { email: 'user@example.com' },
      process.env.JWT_SECRET
    );
    mockResetTokenFindUnique.mockResolvedValue({
      email: 'someone-else@example.com',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    const req = {
      body: {
        token,
        newPassword: 'password123',
        confirmNewPassword: 'password123',
      },
    };
    const res = mockRes();

    await resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token mismatch' });
  });

  it('rejects an expired reset token', async () => {
    const token = jwt.sign(
      { email: 'user@example.com' },
      process.env.JWT_SECRET
    );
    mockResetTokenFindUnique.mockResolvedValue({
      email: 'user@example.com',
      expiresAt: new Date(Date.now() - 1000),
    });

    const req = {
      body: {
        token,
        newPassword: 'password123',
        confirmNewPassword: 'password123',
      },
    };
    const res = mockRes();

    await resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
  });

  it('resets the password for a valid token', async () => {
    const token = jwt.sign(
      { email: 'user@example.com' },
      process.env.JWT_SECRET
    );
    mockResetTokenFindUnique.mockResolvedValue({
      email: 'user@example.com',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });
    mockUserFindUnique.mockResolvedValue({ email: 'user@example.com' });
    mockUserUpdate.mockResolvedValue({});
    mockResetTokenDeleteMany.mockResolvedValue({});

    const req = {
      body: {
        token,
        newPassword: 'password123',
        confirmNewPassword: 'password123',
      },
    };
    const res = mockRes();

    await resetPassword(req, res);

    expect(mockUserUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Password reset successful',
    });
  });

  it('rejects when the user no longer exists', async () => {
    const token = jwt.sign(
      { email: 'ghost@example.com' },
      process.env.JWT_SECRET
    );
    mockResetTokenFindUnique.mockResolvedValue({
      email: 'ghost@example.com',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });
    mockUserFindUnique.mockResolvedValue(null);

    const req = {
      body: {
        token,
        newPassword: 'password123',
        confirmNewPassword: 'password123',
      },
    };
    const res = mockRes();

    await resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
  });

  it('returns 500 on an unexpected database error', async () => {
    const token = jwt.sign(
      { email: 'user@example.com' },
      process.env.JWT_SECRET
    );
    mockResetTokenFindUnique.mockRejectedValue(new Error('db down'));

    const req = {
      body: {
        token,
        newPassword: 'password123',
        confirmNewPassword: 'password123',
      },
    };
    const res = mockRes();

    await resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
