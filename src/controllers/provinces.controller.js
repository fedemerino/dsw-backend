import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Gets all provinces
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} The provinces
 */
export const getProvinces = async (req, res) => {
  try {
    const provinces = await prisma.province.findMany({
      orderBy: { name: 'asc' },
    });
    res.status(200).json(provinces);
  } catch (error) {
    console.error('Get provinces error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};
