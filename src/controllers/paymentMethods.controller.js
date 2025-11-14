import { PrismaClient } from '@prisma/client';

/**
 * Gets all payment methods
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} The payment methods
 */
export const getPaymentMethods = async (req, res) => {
  try {
    const prisma = new PrismaClient();
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
    res.status(200).json(paymentMethods);
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};
