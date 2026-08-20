import { PrismaClient } from '@prisma/client';
import { updateUserSchema } from '../schemas/users.schema.js';

const prisma = new PrismaClient();

/**
 * Gets all users
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} The users
 */
export const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        email: true,
        fullName: true,
        phoneNumber: true,
        avatarUrl: true,
        active: true,
        blocked: true,
        createdAt: true,
        roles: true,
      },
    });
    res.status(200).json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

/**
 * Updates a user
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} The updated user
 */
export const updateUser = async (req, res) => {
  try {
    const { error, data } = updateUserSchema.safeParse(req.body);
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    const { email, fullName, phoneNumber, avatarUrl } = data;

    const isAdmin = req.user.roles?.some((r) => r.role === 'ADMIN');
    if (req.user.email !== email && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: { fullName, phoneNumber, avatarUrl },
      select: {
        email: true,
        fullName: true,
        phoneNumber: true,
        avatarUrl: true,
        active: true,
        roles: true,
      },
    });

    res.status(200).json({
      user: updatedUser,
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

/**
 * Gets a user by email
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} The user
 */
export const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        email: true,
        fullName: true,
        phoneNumber: true,
        avatarUrl: true,
        active: true,
        createdAt: true,
        roles: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error('Get user by email error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

/**
 * Performs a logical delete on a user
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} The deactivated user
 */
export const deleteUser = async (req, res) => {
  try {
    const { email } = req.params;
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }
    await prisma.user.update({
      where: { email },
      data: { active: false },
    });
    res.status(200).json({
      message: 'User deactivated successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

/**
 * Blocks a user (admin only). Reversible, distinct from the logical delete
 * performed by deleteUser: a blocked user keeps their account/data but
 * cannot log in until an admin unblocks them.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} The blocked user
 */
export const blockUser = async (req, res) => {
  try {
    const { email } = req.params;

    if (req.user.email === email) {
      return res.status(400).json({ error: 'You cannot block yourself' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: { blocked: true },
      select: {
        email: true,
        fullName: true,
        active: true,
        blocked: true,
      },
    });

    res.status(200).json({
      user: updatedUser,
      message: 'User blocked successfully',
    });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

/**
 * Unblocks a previously blocked user (admin only).
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} The unblocked user
 */
export const unblockUser = async (req, res) => {
  try {
    const { email } = req.params;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: { blocked: false },
      select: {
        email: true,
        fullName: true,
        active: true,
        blocked: true,
      },
    });

    res.status(200).json({
      user: updatedUser,
      message: 'User unblocked successfully',
    });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};
