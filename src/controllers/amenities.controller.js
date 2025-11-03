import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAmenities = async (req, res) => {
  try {
    const amenities = await prisma.amenity.findMany();
    res.status(200).json(amenities);
  } catch (error) {
    console.error('Error fetching amenities:', error);
    res.status(500).json({ message: 'Error fetching amenities' });
  }
};
