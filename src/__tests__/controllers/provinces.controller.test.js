import { PrismaClient } from '@prisma/client';
import { getProvinces } from '../../controllers/provinces.controller.js';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    province: { findMany: jest.fn() },
  })),
}));

const prismaInstance = PrismaClient.mock.results[0].value;
const mockFindMany = prismaInstance.province.findMany;

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('getProvinces', () => {
  it('returns provinces ordered by name', async () => {
    mockFindMany.mockResolvedValue([{ id: '1', name: 'Buenos Aires' }]);
    const res = mockRes();

    await getProvinces({}, res);

    expect(mockFindMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id: '1', name: 'Buenos Aires' }]);
  });

  it('returns 500 on a database error', async () => {
    mockFindMany.mockRejectedValue(new Error('db down'));
    const res = mockRes();

    await getProvinces({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
