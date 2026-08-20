import { PrismaClient } from '@prisma/client';
import { citiesQuerySchema } from '../schemas/cities.schema.js';

const prisma = new PrismaClient();

/**
 * Gets all cities
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} The cities
 */
export const getCities = async (req, res) => {
  const { error, data } = citiesQuerySchema.safeParse(req.query);
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  const { search, limit } = data;
  try {
    const cities = await prisma.city.findMany({
      where: {
        name: {
          contains: search,
          mode: 'insensitive',
        },
      },
      include: {
        province: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
      take: limit ?? 25,
    });
    const formatted = cities.map((city) => ({
      id: city.id,
      name: city.name,
      province: city.province?.name || null,
    }));
    res.status(200).json(formatted);
  } catch (error) {
    console.error('Get cities error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};
/**
 * Gets all cities by province id
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} The cities
 */
export const getCitiesByProvinceId = async (req, res) => {
  try {
    const { provinceId } = req.params;
    const { error, data } = citiesQuerySchema.safeParse(req.query);
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    const { search, limit } = data;
    const take = limit ?? 20;

    const where = {
      provinceId,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const cities = await prisma.city.findMany({
      where,
      take,
      orderBy: { name: 'asc' },
    });
    res.status(200).json(cities);
  } catch (error) {
    console.error('Get cities by province id error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

/**
 * Gets all cities with listing count
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} The cities with listing count
 */
export const getPopularCities = async (req, res) => {
  try {
    const cities = await prisma.city.findMany({
      take: 4,
      include: {
        _count: {
          select: { listings: true },
        },
        province: true,
      },
      orderBy: {
        listings: { _count: 'desc' },
      },
    });
    const formatted = cities.map((city) => ({
      id: city.id,
      name: city.name,
      province: city.province?.name || null,
      listingsCount: city._count.listings,
      imageUrl: city.imageUrl || '/default.jpg',
    }));
    res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching cities with listing count:', error);
    res.status(500).json({ message: 'Error fetching cities' });
  }
};
