import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Gets all users
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} The users
 */
export const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany();
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
    const { email, fullName, phoneNumber, avatarUrl } = req.body;
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
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    res.status(200).json({
      user,
    });
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
