process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.BACKEND_URL = 'http://localhost:3000';
process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-access-token';
process.env.MERCADOPAGO_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-api-key';
process.env.CLOUDINARY_API_SECRET = 'test-api-secret';
process.env.GOOGLE_APP_USER = 'test@example.com';
process.env.GOOGLE_APP_PASSWORD = 'test-app-password';
process.env.EMAIL_FROM = 'test@example.com';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/bookings_test?schema=public';
