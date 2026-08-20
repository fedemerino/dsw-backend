import { PrismaClient } from '@prisma/client';
import { reviewSchema } from '../schemas/review.schema.js';

const prisma = new PrismaClient();

export const createReview = async (req, res) => {
  try {
    const { error, data } = reviewSchema.safeParse(req.body);
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    const { email } = req.user;

    const completedBooking = await prisma.booking.findFirst({
      where: {
        userEmail: email,
        listingId: data.listingId,
        status: 'CONFIRMED',
        endDate: { lt: new Date() },
      },
    });
    if (!completedBooking) {
      return res.status(403).json({
        error: 'You can only review listings where you have completed a stay',
      });
    }

    const existingReview = await prisma.review.findUnique({
      where: {
        userEmail_listingId: {
          userEmail: email,
          listingId: data.listingId,
        },
      },
    });
    if (!existingReview) {
      const review = await prisma.review.create({
        data: {
          rating: data.rating,
          comment: data.comment,
          listingId: data.listingId,
          userEmail: email,
        },
      });
      return res.status(201).json(review);
    }
    const updatedReview = await prisma.review.update({
      where: { id: existingReview.id },
      data: {
        rating: data.rating,
        comment: data.comment,
      },
    });
    return res.status(200).json(updatedReview);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ message: 'Error creating review' });
  }
};

/**
 * Gets a single review by id
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const getReviewById = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        user: { select: { fullName: true } },
      },
    });
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    return res.status(200).json(review);
  } catch (error) {
    console.error('Error fetching review:', error);
    res.status(500).json({ message: 'Error fetching review' });
  }
};

/**
 * Updates a review (only the author can update it)
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.user;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    if (review.userEmail !== email) {
      return res
        .status(403)
        .json({ error: 'You can only update your own reviews' });
    }

    const { error, data } = reviewSchema
      .pick({ rating: true, comment: true })
      .safeParse(req.body);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: { rating: data.rating, comment: data.comment },
    });
    return res.status(200).json(updatedReview);
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ message: 'Error updating review' });
  }
};

/**
 * Deletes a review (only the author can delete it)
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.user;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    if (review.userEmail !== email) {
      return res
        .status(403)
        .json({ error: 'You can only delete your own reviews' });
    }

    await prisma.review.delete({ where: { id } });
    return res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ message: 'Error deleting review' });
  }
};
