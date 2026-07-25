import { reviewSchema } from '../../schemas/review.schema.js';

describe('reviewSchema', () => {
  it('accepts a valid review', () => {
    const result = reviewSchema.safeParse({
      rating: 5,
      comment: 'Great stay!',
      listingId: 'listing-1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a rating above 5', () => {
    const result = reviewSchema.safeParse({
      rating: 6,
      comment: 'Great stay!',
      listingId: 'listing-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a rating below 1', () => {
    const result = reviewSchema.safeParse({
      rating: 0,
      comment: 'Great stay!',
      listingId: 'listing-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty comment', () => {
    const result = reviewSchema.safeParse({
      rating: 3,
      comment: '',
      listingId: 'listing-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing listingId', () => {
    const result = reviewSchema.safeParse({ rating: 3, comment: 'ok' });
    expect(result.success).toBe(false);
  });
});
