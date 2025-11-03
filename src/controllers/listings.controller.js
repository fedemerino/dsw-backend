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
    const {
      propertyType,
      priceFrom,
      priceTo,
      ratingFrom,
      amenities,
      limit,
      search,
    } = req.query;

    const take = Math.min(parseInt(limit || '20', 10) || 20, 100);

    const where = {};

    if (propertyType && typeof propertyType === 'string') {
      where.propertyType = { equals: propertyType };
    }

    const priceFilter = {};
    if (priceFrom !== undefined && priceFrom !== '') {
      priceFilter.gte = Number(priceFrom);
    }
    if (priceTo !== undefined && priceTo !== '') {
      priceFilter.lte = Number(priceTo);
    }
    if (Object.keys(priceFilter).length > 0) {
      where.pricePerNight = priceFilter;
    }

    const amenityIds = amenities ? amenities.split(',') : [];

    if (amenityIds.length > 0) {
      where.AND = [
        ...(where.AND || []),
        ...amenityIds.map((id) => ({ amenities: { some: { amenityId: id } } })),
      ];
    }

    const term = typeof search === 'string' ? search.trim() : '';
    if (term) {
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { city: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }
    console.log(JSON.stringify(where, null, 2));
    const listings = await prisma.listing.findMany({
      where,
      include: {
        reviews: { select: { rating: true } },
        images: {
          select: { url: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        city: {
          select: {
            name: true,
            province: { select: { name: true } },
          },
        },
      },
      take,
      orderBy: { createdAt: 'desc' },
    });

    const minRating = Number(ratingFrom);

    const filtered =
      Number.isFinite(minRating) && minRating > 0
        ? listings.filter((l) => {
            const ratings = l.reviews?.map((r) => r.rating) || [];
            const avg = ratings.length
              ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
              : 0;
            return avg >= minRating;
          })
        : listings;

    const formatted = filtered.map((listing) => {
      const image = listing.images?.[0]?.url || '/default-listing.jpg';
      const ratings = listing.reviews?.map((r) => r.rating) || [];
      const avg = ratings.length
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : 0;
      const location = listing.city
        ? `${listing.city.name}${listing.city.province ? `, ${listing.city.province.name}` : ''}`
        : 'Unknown';
      return {
        id: listing.id,
        title: listing.title,
        location,
        image,
        price: listing.pricePerNight,
        rating: Number(avg.toFixed(1)),
        reviews: ratings.length,
        beds: listing.beds,
        baths: listing.bathrooms,
        propertyType: listing.propertyType,
      };
    });

    res.status(200).json(formatted);
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
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        images: true,
        city: {
          select: {
            name: true,
            province: {
              select: { name: true },
            },
          },
        },
        reviews: {
          select: {
            rating: true,
            comment: true,
            createdAt: true,
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
        amenities: {
          select: {
            amenityId: true,
            amenity: {
              select: {
                name: true,
              },
            },
          },
        },
        listingPaymentMethods: {
          select: {
            paymentMethodId: true,
            paymentMethod: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
    const response = {
      ...listing,
      amenities: listing.amenities.map((a) => ({
        id: a.amenityId,
        name: a.amenity.name,
      })),
      location: `${listing.city.name}, ${listing.city.province.name}`,
      paymentMethods: listing.listingPaymentMethods.map((p) => ({
        id: p.paymentMethodId,
        name: p.paymentMethod.name,
      })),
      rating:
        listing.reviews.length > 0
          ? listing.reviews.reduce((sum, r) => sum + r.rating, 0) /
            listing.reviews.length
          : 0,
    };
    res.status(200).json(response);
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

export const addToFavorites = async (req, res) => {
  try {
    const { userId, listingId } = req.body;
    const favorite = await prisma.favorite.create({
      data: { userId, listingId },
    });
    res.status(201).json(favorite);
  } catch (error) {
    console.error('Error adding to favorites:', error);
    res.status(500).json({ message: 'Error adding to favorites' });
  }
};
