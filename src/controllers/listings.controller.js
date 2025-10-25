import { PrismaClient } from '@prisma/client';
import { listingSchema } from '../schemas/listings.schema.js';

const prisma = new PrismaClient();

/**
 * Gets all listings
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} The listings
 */
export const getListings = async (req, res) => {
  try {
    const listings = await prisma.listing.findMany();
    res.status(200).json(listings);
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ message: 'Error fetching listings' });
  }
};

/**
 * Gets a listing by id
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} The listing
 */
export const getListingById = async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await prisma.listing.findUnique({ where: { id } });
    res.status(200).json(listing);
  } catch (error) {
    console.error('Error fetching listing by id:', error);
    res.status(500).json({ message: 'Error fetching listing by id' });
  }
};

export const getListingsByCityId = async (req, res) => {
  try {
    const { cityId } = req.params;
    const listings = await prisma.listing.findMany({ where: { cityId } });
    res.status(200).json(listings);
  } catch (error) {
    console.error('Error fetching listings by city id:', error);
    res.status(500).json({ message: 'Error fetching listings by city id' });
  }
};

export const getListingsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const listings = await prisma.listing.findMany({ where: { userId } });
    res.status(200).json(listings);
  } catch (error) {
    console.error('Error fetching listings by user id:', error);
    res.status(500).json({ message: 'Error fetching listings by user id' });
  }
};

export const createListing = async (req, res) => {
  try {
    const { error, data } = listingSchema.safeParse(req.body);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const amenitiesConnect = (data.amenities || []).map((amenityId) => ({
      amenityId,
    }));
    const paymentMethodsConnect = (data.listingPaymentMethods || []).map(
      (paymentMethodId) => ({ paymentMethodId })
    );

    const payload = {
      title: data.title,
      description: data.description,
      address: data.address,
      pricePerNight: data.pricePerNight,
      propertyType: data.propertyType,
      rooms: data.rooms,
      bathrooms: data.bathrooms,
      beds: data.beds,
      petFriendly: data.petFriendly ?? false,
      maxGuests: data.maxGuests,
      cityId: data.cityId,
      type: data.type,
      userEmail: data.userEmail,
      amenities:
        amenitiesConnect.length > 0
          ? {
              create: amenitiesConnect.map((a) => ({
                amenity: { connect: { id: a.amenityId } },
              })),
            }
          : undefined,
      listingPaymentMethods:
        paymentMethodsConnect.length > 0
          ? {
              create: paymentMethodsConnect.map((p) => ({
                paymentMethod: { connect: { id: p.paymentMethodId } },
              })),
            }
          : undefined,
    };

    const listing = await prisma.listing.create({ data: payload });

    res.status(201).json(listing);
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ message: 'Error creating listing' });
  }
};

export const getAmenities = async (req, res) => {
  try {
    const amenities = await prisma.amenity.findMany();
    res.status(200).json(amenities);
  } catch (error) {
    console.error('Error fetching amenities:', error);
    res.status(500).json({ message: 'Error fetching amenities' });
  }
};

export const getFeaturedListings = async (req, res) => {
  try {
    const listings = await prisma.listing.findMany({
      where: { featured: true },
      select: {
        id: true,
        title: true,
        pricePerNight: true,
        beds: true,
        bathrooms: true,
        propertyType: true,
        city: {
          select: {
            name: true,
            province: {
              select: { name: true },
            },
          },
        },
        images: {
          select: { url: true, createdAt: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        reviews: { select: { rating: true } },
      },
      take: 6,
      orderBy: { createdAt: 'desc' },
    });

    const formatted = listings.map((listing) => {
      const image = listing.images?.[0]?.url || '/default-listing.jpg';
      const ratings = listing.reviews?.map((r) => r.rating) || [];
      const rating = ratings.length
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : 0;
      const reviews = ratings.length;
      const location = listing.city
        ? `${listing.city.name}${listing.city.province ? `, ${listing.city.province.name}` : ''}`
        : 'Unknown';
      return {
        id: listing.id,
        title: listing.title,
        location,
        image,
        price: listing.pricePerNight,
        rating: Number(rating.toFixed(1)),
        reviews,
        beds: listing.beds,
        baths: listing.bathrooms,
        type: listing.type,
      };
    });

    res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching featured listings:', error);
    res.status(500).json({ message: 'Error fetching featured listings' });
  }
};
