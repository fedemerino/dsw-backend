import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../app.js';

const mockPreferenceCounter = { value: 0 };

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn().mockImplementation(() => ({})),
  Preference: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockImplementation(() => {
      mockPreferenceCounter.value += 1;
      const id = `test-preference-id-${mockPreferenceCounter.value}`;
      return Promise.resolve({
        id,
        init_point: `https://mercadopago.test/checkout/${id}`,
      });
    }),
  })),
  Payment: jest.fn().mockImplementation(() => ({ get: jest.fn() })),
}));

const prisma = new PrismaClient();
const suffix = Date.now();

const hostEmail = `host-${suffix}@example.com`;
const guestEmail = `guest-${suffix}@example.com`;
const password = 'password123';

let provinceId;
let cityId;
let amenityId;
let listingId;
let hostToken;
let guestToken;
let bookingId;

async function signUpVerifyAndLogin(email, fullName) {
  await request(app).post('/api/auth/signUp').send({
    email,
    fullName,
    password,
    confirmPassword: password,
  });

  const verificationToken = await prisma.emailVerificationToken.findFirst({
    where: { email },
  });
  await request(app)
    .post('/api/auth/verifyEmail')
    .send({ token: verificationToken.token });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return loginRes.body.accessToken;
}

beforeAll(async () => {
  const province = await prisma.province.create({
    data: { name: `Test Province ${suffix}` },
  });
  provinceId = province.id;

  const city = await prisma.city.create({
    data: { name: `Test City ${suffix}`, provinceId },
  });
  cityId = city.id;

  const amenity = await prisma.amenity.create({
    data: { name: `Test Amenity ${suffix}` },
  });
  amenityId = amenity.id;

  hostToken = await signUpVerifyAndLogin(hostEmail, 'Host User');
  guestToken = await signUpVerifyAndLogin(guestEmail, 'Guest User');
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { listingId } });
  if (listingId) await prisma.listing.deleteMany({ where: { id: listingId } });
  if (amenityId) await prisma.amenity.deleteMany({ where: { id: amenityId } });
  if (cityId) await prisma.city.deleteMany({ where: { id: cityId } });
  if (provinceId)
    await prisma.province.deleteMany({ where: { id: provinceId } });
  await prisma.user.deleteMany({
    where: { email: { in: [hostEmail, guestEmail] } },
  });
  await prisma.$disconnect();
});

describe('Listings + Bookings flow (integration)', () => {
  it('lets the host create a listing', async () => {
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        title: 'Integration test loft',
        description: 'A place created by an integration test',
        address: '123 Test St',
        pricePerNight: 50,
        propertyType: 'APARTMENT',
        rooms: 1,
        bathrooms: 1,
        beds: 1,
        maxGuests: 2,
        cityId,
        images: ['https://img.test/1.jpg', 'https://img.test/2.jpg'],
        amenities: [amenityId],
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    listingId = res.body.id;
  });

  it('lets the guest book the listing and returns a MercadoPago init point', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        listingId,
        startDate: '2027-01-10',
        endDate: '2027-01-15',
        guests: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.booking.status).toBe('PENDING');
    expect(res.body.initPoint).toMatch(
      /^https:\/\/mercadopago\.test\/checkout\/test-preference-id-\d+$/
    );
    bookingId = res.body.booking.id;
  });

  it('rejects an overlapping booking for the same dates', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        listingId,
        startDate: '2027-01-12',
        endDate: '2027-01-18',
        guests: 1,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not available/i);
  });

  it('lets the guest cancel their own booking', async () => {
    const res = await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${guestToken}`);

    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('CANCELLED');
  });

  it('lets the host cancel a booking on their own listing when a reason is given', async () => {
    const rebook = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        listingId,
        startDate: '2027-02-01',
        endDate: '2027-02-05',
        guests: 1,
      });

    const res = await request(app)
      .delete(`/api/bookings/${rebook.body.booking.id}`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ reason: 'Surgió un imprevisto con la propiedad' });

    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('CANCELLED');
    expect(res.body.booking.cancellationReason).toBe(
      'Surgió un imprevisto con la propiedad'
    );
  });

  it('rejects a host cancellation without a reason', async () => {
    const rebook = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        listingId,
        startDate: '2027-03-01',
        endDate: '2027-03-05',
        guests: 1,
      });

    const res = await request(app)
      .delete(`/api/bookings/${rebook.body.booking.id}`)
      .set('Authorization', `Bearer ${hostToken}`);

    expect(res.status).toBe(400);
  });

  it('prevents an unrelated user from cancelling someone else’s booking', async () => {
    const strangerEmail = `stranger-${suffix}@example.com`;
    const strangerToken = await signUpVerifyAndLogin(
      strangerEmail,
      'Stranger User'
    );

    const rebook = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        listingId,
        startDate: '2027-04-01',
        endDate: '2027-04-05',
        guests: 1,
      });

    const res = await request(app)
      .delete(`/api/bookings/${rebook.body.booking.id}`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .send({ reason: 'no debería poder' });

    expect(res.status).toBe(403);

    await prisma.user.deleteMany({ where: { email: strangerEmail } });
  });
});
