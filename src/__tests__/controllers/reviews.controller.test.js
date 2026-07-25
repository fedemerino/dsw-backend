import { PrismaClient } from '@prisma/client';
import {
  createReview,
  getReviewById,
  deleteReview,
} from '../../controllers/reviews.controller.js';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    booking: { findFirst: jest.fn() },
    review: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  })),
}));

const prismaInstance = PrismaClient.mock.results[0].value;
const mockBookingFindFirst = prismaInstance.booking.findFirst;
const mockReviewFindUnique = prismaInstance.review.findUnique;
const mockReviewCreate = prismaInstance.review.create;
const mockReviewUpdate = prismaInstance.review.update;
const mockReviewDelete = prismaInstance.review.delete;

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('createReview', () => {
  const validBody = {
    rating: 5,
    comment: 'Great stay',
    listingId: 'listing-1',
  };

  it('rejects invalid input', async () => {
    const req = { body: { rating: 10 }, user: { email: 'user@example.com' } };
    const res = mockRes();

    await createReview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects when the user has no completed booking for the listing', async () => {
    mockBookingFindFirst.mockResolvedValue(null);
    const req = { body: validBody, user: { email: 'user@example.com' } };
    const res = mockRes();

    await createReview(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('creates a new review when none exists yet', async () => {
    mockBookingFindFirst.mockResolvedValue({ id: 'booking-1' });
    mockReviewFindUnique.mockResolvedValue(null);
    mockReviewCreate.mockResolvedValue({ id: 'review-1', ...validBody });

    const req = { body: validBody, user: { email: 'user@example.com' } };
    const res = mockRes();

    await createReview(req, res);

    expect(mockReviewCreate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('updates an existing review instead of creating a duplicate', async () => {
    mockBookingFindFirst.mockResolvedValue({ id: 'booking-1' });
    mockReviewFindUnique.mockResolvedValue({ id: 'review-1' });
    mockReviewUpdate.mockResolvedValue({ id: 'review-1', ...validBody });

    const req = { body: validBody, user: { email: 'user@example.com' } };
    const res = mockRes();

    await createReview(req, res);

    expect(mockReviewCreate).not.toHaveBeenCalled();
    expect(mockReviewUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 500 on a database error', async () => {
    mockBookingFindFirst.mockRejectedValue(new Error('db down'));
    const req = { body: validBody, user: { email: 'user@example.com' } };
    const res = mockRes();

    await createReview(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getReviewById', () => {
  it('returns a review', async () => {
    mockReviewFindUnique.mockResolvedValue({ id: 'review-1', rating: 5 });
    const req = { params: { id: 'review-1' } };
    const res = mockRes();

    await getReviewById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 404 when not found', async () => {
    mockReviewFindUnique.mockResolvedValue(null);
    const req = { params: { id: 'ghost' } };
    const res = mockRes();

    await getReviewById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on a database error', async () => {
    mockReviewFindUnique.mockRejectedValue(new Error('db down'));
    const req = { params: { id: 'review-1' } };
    const res = mockRes();

    await getReviewById(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('deleteReview', () => {
  it('deletes a review owned by the requester', async () => {
    mockReviewFindUnique.mockResolvedValue({
      id: 'review-1',
      userEmail: 'user@example.com',
    });
    mockReviewDelete.mockResolvedValue({});

    const req = {
      params: { id: 'review-1' },
      user: { email: 'user@example.com' },
    };
    const res = mockRes();

    await deleteReview(req, res);

    expect(mockReviewDelete).toHaveBeenCalledWith({
      where: { id: 'review-1' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects deleting someone else’s review', async () => {
    mockReviewFindUnique.mockResolvedValue({
      id: 'review-1',
      userEmail: 'other@example.com',
    });

    const req = {
      params: { id: 'review-1' },
      user: { email: 'user@example.com' },
    };
    const res = mockRes();

    await deleteReview(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockReviewDelete).not.toHaveBeenCalled();
  });

  it('returns 404 when the review does not exist', async () => {
    mockReviewFindUnique.mockResolvedValue(null);

    const req = {
      params: { id: 'ghost' },
      user: { email: 'user@example.com' },
    };
    const res = mockRes();

    await deleteReview(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on a database error', async () => {
    mockReviewFindUnique.mockRejectedValue(new Error('db down'));
    const req = {
      params: { id: 'review-1' },
      user: { email: 'user@example.com' },
    };
    const res = mockRes();

    await deleteReview(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
