import { PrismaClient } from '@prisma/client';
import {
  getCities,
  getCitiesByProvinceId,
  getPopularCities,
} from '../../controllers/cities.controller.js';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    city: { findMany: jest.fn() },
  })),
}));

const prismaInstance = PrismaClient.mock.results[0].value;
const mockFindMany = prismaInstance.city.findMany;

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('getCities', () => {
  it('formats cities with their province name', async () => {
    mockFindMany.mockResolvedValue([
      { id: '1', name: 'Rosario', province: { name: 'Santa Fe' } },
      { id: '2', name: 'Sin provincia', province: null },
    ]);
    const req = { query: {} };
    const res = mockRes();

    await getCities(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      { id: '1', name: 'Rosario', province: 'Santa Fe' },
      { id: '2', name: 'Sin provincia', province: null },
    ]);
  });

  it('defaults to a limit of 25 when none is given', async () => {
    mockFindMany.mockResolvedValue([]);
    const req = { query: {} };
    const res = mockRes();

    await getCities(req, res);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 })
    );
  });

  it('rejects a limit greater than 100', async () => {
    const req = { query: { limit: '500' } };
    const res = mockRes();

    await getCities(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('returns 500 on a database error', async () => {
    mockFindMany.mockRejectedValue(new Error('db down'));
    const req = { query: {} };
    const res = mockRes();

    await getCities(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getCitiesByProvinceId', () => {
  it('filters by province id and search term', async () => {
    mockFindMany.mockResolvedValue([{ id: '1', name: 'Rosario' }]);
    const req = { params: { provinceId: 'prov-1' }, query: { search: 'Ros' } };
    const res = mockRes();

    await getCitiesByProvinceId(req, res);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provinceId: 'prov-1',
          name: { contains: 'Ros', mode: 'insensitive' },
        },
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 500 on a database error', async () => {
    mockFindMany.mockRejectedValue(new Error('db down'));
    const req = { params: { provinceId: 'prov-1' }, query: {} };
    const res = mockRes();

    await getCitiesByProvinceId(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getPopularCities', () => {
  it('formats cities with listing counts', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: '1',
        name: 'Rosario',
        province: { name: 'Santa Fe' },
        _count: { listings: 5 },
        imageUrl: null,
      },
    ]);
    const res = mockRes();

    await getPopularCities({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      {
        id: '1',
        name: 'Rosario',
        province: 'Santa Fe',
        listingsCount: 5,
        imageUrl: '/default.jpg',
      },
    ]);
  });

  it('returns 500 on a database error', async () => {
    mockFindMany.mockRejectedValue(new Error('db down'));
    const res = mockRes();

    await getPopularCities({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
