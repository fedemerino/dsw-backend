import { PrismaClient } from '@prisma/client';
import { listingSchema } from '../schemas/listings.schema.js';
import { formatListing, prepareListingPayload } from '../utils/utils.js';

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

    const formatted = filtered.map((listing) => formatListing(listing));

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

export const getUserListings = async (req, res) => {
  try {
    const { email } = req.user;
    const listings = await prisma.listing.findMany({
      where: { userEmail: email },
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

      orderBy: { createdAt: 'desc' },
    });

    const formatted = listings.map((listing) =>
      formatListing(listing, {
        includeType: true,
        includeReviewsArray: true,
      })
    );
    res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching user listings:', error);
    res.status(500).json({ message: 'Error fetching user listings' });
  }
};

export const createListing = async (req, res) => {
  try {
    const { error, data } = listingSchema.safeParse(req.body);
    const { email } = req.user;
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const payload = prepareListingPayload(data, email, false);
    const listing = await prisma.listing.create({ data: payload });

    res.status(201).json(listing);
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ message: 'Error creating listing' });
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

    const formatted = listings.map((listing) =>
      formatListing(listing, {
        includeType: true,
        includePropertyType: false,
      })
    );

    res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching featured listings:', error);
    res.status(500).json({ message: 'Error fetching featured listings' });
  }
};

export const toggleFavorite = async (req, res) => {
  try {
    const { email: userEmail } = req.user;
    const { listingId } = req.body;

    // Use the compound unique index for findUnique
    const favorite = await prisma.favorite.findUnique({
      where: {
        userEmail_listingId: {
          userEmail,
          listingId,
        },
      },
    });

    if (favorite) {
      await prisma.favorite.delete({
        where: {
          userEmail_listingId: {
            userEmail,
            listingId,
          },
        },
      });
      res.status(200).json({ message: 'Favorite removed', isFavorite: false });
    } else {
      await prisma.favorite.create({
        data: { userEmail, listingId },
      });
      res.status(200).json({ message: 'Favorite added', isFavorite: true });
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ message: 'Error toggling favorite' });
  }
};

export const getFavoriteListings = async (req, res) => {
  try {
    const { email } = req.user;
    const favorites = await prisma.favorite.findMany({
      where: { userEmail: email },
      include: {
        listing: {
          include: {
            images: {
              select: { url: true, createdAt: true },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
            reviews: { select: { rating: true } },
            city: {
              select: {
                name: true,
                province: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const formatted = favorites.map((favorite) =>
      formatListing(favorite.listing)
    );

    res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ message: 'Error fetching favorites' });
  }
};

export const getListingBookings = async (req, res) => {
  const { id } = req.params;

  const bookings = await prisma.booking.findMany({
    where: {
      listingId: id,
      OR: [
        {
          status: 'CONFIRMED',
        },
        {
          status: 'PENDING',
        },
      ],
      endDate: {
        gte: new Date(),
      },
    },
  });
  res.status(200).json(bookings);
};

export const updateListing = async (req, res) => {
  try {
    const {
      params: { id },
      user: { email },
    } = req;
    const { error, data } = listingSchema.safeParse(req.body);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const listing = await prisma.listing.findUnique({
      where: { id },
    });
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (listing.userEmail !== email) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const payload = prepareListingPayload(data, email, true);
    const updatedListing = await prisma.listing.update({
      where: { id },
      data: payload,
    });

    res.status(200).json(updatedListing);
  } catch (error) {
    console.error('Error updating listing:', error);
    res.status(500).json({ message: 'Error updating listing' });
  }
};
