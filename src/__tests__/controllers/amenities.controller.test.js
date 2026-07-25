import { PrismaClient } from '@prisma/client';
import { getAmenities } from '../../controllers/amenities.controller.js';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    amenity: { findMany: jest.fn() },
  })),
}));

const prismaInstance = PrismaClient.mock.results[0].value;
const mockFindMany = prismaInstance.amenity.findMany;

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('getAmenities', () => {
  it('returns all amenities', async () => {
    mockFindMany.mockResolvedValue([{ id: '1', name: 'WiFi' }]);
    const res = mockRes();

    await getAmenities({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id: '1', name: 'WiFi' }]);
  });

  it('returns 500 on a database error', async () => {
    mockFindMany.mockRejectedValue(new Error('db down'));
    const res = mockRes();

    await getAmenities({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
