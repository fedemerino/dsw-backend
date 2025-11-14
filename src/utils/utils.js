/**
 * Formats a listing object for API response
 * @param {Object} listing - The listing object from Prisma
 * @param {Object} options - Optional configuration
 * @param {boolean} options.includeType - Include the type field
 * @param {boolean} options.includePropertyType - Include the propertyType field
 * @param {boolean} options.includeReviewsArray - Include full reviews array instead of count
 * @returns {Object} Formatted listing object
 */
export const formatListing = (listing, options = {}) => {
  const {
    includeType = false,
    includePropertyType = true,
    includeReviewsArray = false,
  } = options;

  const image = listing.images?.[0]?.url || '/default-listing.jpg';
  const ratings = listing.reviews?.map((r) => r.rating) || [];
  const avg = ratings.length
    ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
    : 0;
  const location = listing.city
    ? `${listing.city.name}${listing.city.province ? `, ${listing.city.province.name}` : ''}`
    : 'Unknown';

  const formatted = {
    id: listing.id,
    title: listing.title,
    location,
    image,
    price: listing.pricePerNight,
    rating: Number(avg.toFixed(1)),
    reviews: includeReviewsArray ? listing.reviews : ratings.length,
    beds: listing.beds,
    baths: listing.bathrooms,
  };

  if (includePropertyType && listing.propertyType) {
    formatted.propertyType = listing.propertyType;
  }

  if (includeType && listing.type) {
    formatted.type = listing.type;
  }

  return formatted;
};

/**
 * Prepares the payload for creating or updating a listing
 * @param {Object} data - The validated listing data
 * @param {string} userEmail - The email of the user creating/updating the listing
 * @param {boolean} isUpdate - Whether this is for an update operation
 * @returns {Object} The prepared payload for Prisma
 */
export const prepareListingPayload = (data, userEmail, isUpdate = false) => {
  const amenitiesConnect = (data.amenities || []).map((amenityId) => ({
    amenityId,
  }));
  const paymentMethodsConnect = (data.listingPaymentMethods || []).map(
    (paymentMethodId) => ({ paymentMethodId })
  );

  const imagesConnect = (data.images || []).map((imageUrl) => ({
    url: imageUrl,
  }));

  const basePayload = {
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
  };

  if (!isUpdate) {
    // For create, add userEmail and use 'create' for relations
    basePayload.userEmail = userEmail;
    basePayload.amenities = {
      create: amenitiesConnect.map((a) => ({
        amenity: { connect: { id: a.amenityId } },
      })),
    };
    basePayload.listingPaymentMethods = {
      create: paymentMethodsConnect.map((p) => ({
        paymentMethod: { connect: { id: p.paymentMethodId } },
      })),
    };
    basePayload.images = {
      create: imagesConnect,
    };
  } else {
    // For update, delete existing relations and create new ones
    basePayload.amenities = {
      deleteMany: {}, // Delete all existing amenities
      create: amenitiesConnect.map((a) => ({
        amenity: { connect: { id: a.amenityId } },
      })),
    };
    basePayload.listingPaymentMethods = {
      deleteMany: {}, // Delete all existing payment methods
      create: paymentMethodsConnect.map((p) => ({
        paymentMethod: { connect: { id: p.paymentMethodId } },
      })),
    };
    basePayload.images = {
      deleteMany: {}, // Delete all existing images
      create: imagesConnect, // Create new ones
    };
  }

  return basePayload;
};
