import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Access token required',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify that it is an access token
    if (decoded.type !== 'access') {
      return res.status(401).json({
        error: 'Invalid token type',
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
    });
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({
      error: 'Access denied. Admin permissions required.',
    });
  }
  next();
};
