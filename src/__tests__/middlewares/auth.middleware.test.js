import jwt from 'jsonwebtoken';
import {
  authenticateToken,
  requireAdmin,
} from '../../middlewares/auth.middleware.js';

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('authenticateToken', () => {
  it('returns 401 when no authorization header is present', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is invalid', () => {
    const req = { headers: { authorization: 'Bearer not-a-real-token' } };
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with TOKEN_EXPIRED code when the token is expired', () => {
    const expiredToken = jwt.sign(
      { email: 'user@example.com', type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: -10 }
    );
    const req = { headers: { authorization: `Bearer ${expiredToken}` } };
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the token type is not access', () => {
    const refreshToken = jwt.sign(
      { email: 'user@example.com', type: 'refresh' },
      process.env.JWT_SECRET
    );
    const req = { headers: { authorization: `Bearer ${refreshToken}` } };
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token type' });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches the decoded user and calls next for a valid token', () => {
    const token = jwt.sign(
      { email: 'user@example.com', roles: [{ role: 'USER' }], type: 'access' },
      process.env.JWT_SECRET
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({
      email: 'user@example.com',
      roles: [{ role: 'USER' }],
    });
    expect(req.user.type).toBeUndefined();
  });
});

describe('requireAdmin', () => {
  it('returns 403 when the user has no ADMIN role', () => {
    const req = { user: { roles: [{ role: 'USER' }] } };
    const res = mockRes();
    const next = jest.fn();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when the user has the ADMIN role', () => {
    const req = { user: { roles: [{ role: 'USER' }, { role: 'ADMIN' }] } };
    const res = mockRes();
    const next = jest.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
