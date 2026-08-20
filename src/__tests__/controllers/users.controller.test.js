import { PrismaClient } from '@prisma/client';
import {
  getUsers,
  updateUser,
  getUserByEmail,
  deleteUser,
  blockUser,
  unblockUser,
} from '../../controllers/users.controller.js';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  })),
}));

const prismaInstance = PrismaClient.mock.results[0].value;
const mockFindMany = prismaInstance.user.findMany;
const mockFindUnique = prismaInstance.user.findUnique;
const mockUpdate = prismaInstance.user.update;

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('getUsers', () => {
  it('returns the list of users', async () => {
    mockFindMany.mockResolvedValue([{ email: 'a@example.com' }]);
    const res = mockRes();

    await getUsers({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ email: 'a@example.com' }]);
  });

  it('returns 500 on a database error', async () => {
    mockFindMany.mockRejectedValue(new Error('db down'));
    const res = mockRes();

    await getUsers({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('updateUser', () => {
  it('lets a user update their own profile', async () => {
    mockFindUnique.mockResolvedValue({ email: 'user@example.com' });
    mockUpdate.mockResolvedValue({
      email: 'user@example.com',
      fullName: 'New Name',
    });

    const req = {
      body: { email: 'user@example.com', fullName: 'New Name' },
      user: { email: 'user@example.com', roles: [{ role: 'USER' }] },
    };
    const res = mockRes();

    await updateUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('lets an admin update someone else’s profile', async () => {
    mockFindUnique.mockResolvedValue({ email: 'other@example.com' });
    mockUpdate.mockResolvedValue({ email: 'other@example.com' });

    const req = {
      body: { email: 'other@example.com', fullName: 'New Name' },
      user: { email: 'admin@example.com', roles: [{ role: 'ADMIN' }] },
    };
    const res = mockRes();

    await updateUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects updating someone else’s profile without admin', async () => {
    const req = {
      body: { email: 'other@example.com', fullName: 'New Name' },
      user: { email: 'user@example.com', roles: [{ role: 'USER' }] },
    };
    const res = mockRes();

    await updateUser(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when the user does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const req = {
      body: { email: 'user@example.com', fullName: 'New Name' },
      user: { email: 'user@example.com', roles: [] },
    };
    const res = mockRes();

    await updateUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on a database error', async () => {
    mockFindUnique.mockRejectedValue(new Error('db down'));
    const req = {
      body: { email: 'user@example.com', fullName: 'New Name' },
      user: { email: 'user@example.com', roles: [] },
    };
    const res = mockRes();

    await updateUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getUserByEmail', () => {
  it('returns a user by email', async () => {
    mockFindUnique.mockResolvedValue({ email: 'user@example.com' });
    const req = { params: { email: 'user@example.com' } };
    const res = mockRes();

    await getUserByEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      user: { email: 'user@example.com' },
    });
  });

  it('returns 404 when not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const req = { params: { email: 'ghost@example.com' } };
    const res = mockRes();

    await getUserByEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on a database error', async () => {
    mockFindUnique.mockRejectedValue(new Error('db down'));
    const req = { params: { email: 'user@example.com' } };
    const res = mockRes();

    await getUserByEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('deleteUser', () => {
  it('deactivates an existing user', async () => {
    mockFindUnique.mockResolvedValue({ email: 'user@example.com' });
    mockUpdate.mockResolvedValue({});

    const req = { params: { email: 'user@example.com' } };
    const res = mockRes();

    await deleteUser(req, res);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
      data: { active: false },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 404 when the user does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const req = { params: { email: 'ghost@example.com' } };
    const res = mockRes();

    await deleteUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 500 on a database error', async () => {
    mockFindUnique.mockRejectedValue(new Error('db down'));
    const req = { params: { email: 'user@example.com' } };
    const res = mockRes();

    await deleteUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('blockUser', () => {
  it('lets an admin block another user', async () => {
    mockFindUnique.mockResolvedValue({ email: 'user@example.com' });
    mockUpdate.mockResolvedValue({
      email: 'user@example.com',
      blocked: true,
    });

    const req = {
      params: { email: 'user@example.com' },
      user: { email: 'admin@example.com', roles: [{ role: 'ADMIN' }] },
    };
    const res = mockRes();

    await blockUser(req, res);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'user@example.com' },
        data: { blocked: true },
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects an admin trying to block themselves', async () => {
    const req = {
      params: { email: 'admin@example.com' },
      user: { email: 'admin@example.com', roles: [{ role: 'ADMIN' }] },
    };
    const res = mockRes();

    await blockUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when the user does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const req = {
      params: { email: 'ghost@example.com' },
      user: { email: 'admin@example.com', roles: [{ role: 'ADMIN' }] },
    };
    const res = mockRes();

    await blockUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on a database error', async () => {
    mockFindUnique.mockRejectedValue(new Error('db down'));
    const req = {
      params: { email: 'user@example.com' },
      user: { email: 'admin@example.com', roles: [{ role: 'ADMIN' }] },
    };
    const res = mockRes();

    await blockUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('unblockUser', () => {
  it('lets an admin unblock a user', async () => {
    mockFindUnique.mockResolvedValue({ email: 'user@example.com' });
    mockUpdate.mockResolvedValue({
      email: 'user@example.com',
      blocked: false,
    });

    const req = {
      params: { email: 'user@example.com' },
      user: { email: 'admin@example.com', roles: [{ role: 'ADMIN' }] },
    };
    const res = mockRes();

    await unblockUser(req, res);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'user@example.com' },
        data: { blocked: false },
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 404 when the user does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const req = {
      params: { email: 'ghost@example.com' },
      user: { email: 'admin@example.com', roles: [{ role: 'ADMIN' }] },
    };
    const res = mockRes();

    await unblockUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on a database error', async () => {
    mockFindUnique.mockRejectedValue(new Error('db down'));
    const req = {
      params: { email: 'user@example.com' },
      user: { email: 'admin@example.com', roles: [{ role: 'ADMIN' }] },
    };
    const res = mockRes();

    await unblockUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
