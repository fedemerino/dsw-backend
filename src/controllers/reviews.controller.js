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
