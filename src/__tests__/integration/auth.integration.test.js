import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../app.js';

const prisma = new PrismaClient();

const testEmail = `auth-integration-${Date.now()}@example.com`;
const testPassword = 'password123';

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: testEmail } });
  await prisma.$disconnect();
});

describe('Auth flow (integration)', () => {
  it('signs up a new user without logging them in, and sends a verification email', async () => {
    const res = await request(app).post('/api/auth/signUp').send({
      email: testEmail,
      fullName: 'Integration Test User',
      password: testPassword,
      confirmPassword: testPassword,
    });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.roles).toEqual([
      { userEmail: testEmail, role: 'USER' },
    ]);

    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user.emailVerified).toBe(false);
  });

  it('rejects a duplicate sign up', async () => {
    const res = await request(app).post('/api/auth/signUp').send({
      email: testEmail,
      fullName: 'Integration Test User',
      password: testPassword,
      confirmPassword: testPassword,
    });

    expect(res.status).toBe(400);
  });

  it('rejects login before the email is verified', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('verifies the email with the real token and then allows login', async () => {
    const verificationToken = await prisma.emailVerificationToken.findFirst({
      where: { email: testEmail },
    });
    expect(verificationToken).toBeDefined();

    const verifyRes = await request(app)
      .post('/api/auth/verifyEmail')
      .send({ token: verificationToken.token });

    expect(verifyRes.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user.emailVerified).toBe(true);
  });

  it('logs in with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('allows access to a protected route with a valid access token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    const res = await request(app)
      .get(`/api/users/${testEmail}`)
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmail);
  });

  it('rejects access to a protected route without a token', async () => {
    const res = await request(app).get(`/api/users/${testEmail}`);

    expect(res.status).toBe(401);
  });
});
