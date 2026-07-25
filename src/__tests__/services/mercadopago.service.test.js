import crypto from 'crypto';
import { MercadoPagoService } from '../../services/mercadopago.service.js';

const mockPaymentGet = jest.fn();
const mockPaymentUpdate = jest.fn();
const mockBookingUpdate = jest.fn();
const mockPreferenceCreate = jest.fn();

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn().mockImplementation(() => ({})),
  Preference: jest
    .fn()
    .mockImplementation(() => ({ create: mockPreferenceCreate })),
  Payment: jest.fn().mockImplementation(() => ({ get: mockPaymentGet })),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    payment: { update: mockPaymentUpdate },
    booking: { update: mockBookingUpdate },
  })),
}));

describe('MercadoPagoService.validateWebhookSignature', () => {
  const originalSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  afterEach(() => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = originalSecret;
    jest.clearAllMocks();
  });

  it('returns true when no secret is configured', () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const service = new MercadoPagoService();
    const req = { headers: {}, body: {}, query: {} };

    expect(service.validateWebhookSignature(req)).toBe(true);
  });

  it('returns false when the signature or data id is missing', () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'secret';
    const service = new MercadoPagoService();
    const req = { headers: {}, body: {}, query: {} };

    expect(service.validateWebhookSignature(req)).toBe(false);
  });

  it('returns true for a correctly computed signature', () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'secret';
    const service = new MercadoPagoService();
    const dataId = '12345';
    const ts = '1700000000';
    const manifest = `id:${dataId};request-id:req-1;ts:${ts};`;
    const v1 = crypto
      .createHmac('sha256', 'secret')
      .update(manifest)
      .digest('hex');

    const req = {
      headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': 'req-1' },
      body: { data: { id: dataId } },
      query: {},
    };

    expect(service.validateWebhookSignature(req)).toBe(true);
  });

  it('returns false for a tampered signature', () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'secret';
    const service = new MercadoPagoService();
    const req = {
      headers: {
        'x-signature': 'ts=1700000000,v1=deadbeef',
        'x-request-id': 'req-1',
      },
      body: { data: { id: '12345' } },
      query: {},
    };

    expect(service.validateWebhookSignature(req)).toBe(false);
  });
});

describe('MercadoPagoService.createPreference', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const originalBackendUrl = process.env.BACKEND_URL;

  afterEach(() => {
    process.env.FRONTEND_URL = originalFrontendUrl;
    process.env.BACKEND_URL = originalBackendUrl;
    jest.clearAllMocks();
  });

  it('throws when FRONTEND_URL is not set', async () => {
    delete process.env.FRONTEND_URL;
    const service = new MercadoPagoService();

    await expect(
      service.createPreference({ items: [], paymentId: 'payment-1' })
    ).rejects.toThrow('FRONTEND_URL is not set');
  });

  it('throws when BACKEND_URL is not set', async () => {
    delete process.env.BACKEND_URL;
    const service = new MercadoPagoService();

    await expect(
      service.createPreference({ items: [], paymentId: 'payment-1' })
    ).rejects.toThrow('WEBHOOK_BASE_URL');
  });

  it('includes the payer info to improve the approval rate', async () => {
    mockPreferenceCreate.mockResolvedValue({
      id: 'pref-1',
      init_point: 'https://mp.test/pref-1',
    });
    const service = new MercadoPagoService();

    await service.createPreference({
      items: [{ title: 'Listing', quantity: 1, unit_price: 100 }],
      paymentId: 'payment-1',
      payerEmail: 'guest@example.com',
      payerFirstName: 'Jane',
      payerLastName: 'Doe',
    });

    expect(mockPreferenceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          payer: { email: 'guest@example.com', name: 'Jane', surname: 'Doe' },
        }),
      })
    );
  });

  it('omits the payer block when there is no payer email', async () => {
    mockPreferenceCreate.mockResolvedValue({
      id: 'pref-2',
      init_point: 'https://mp.test/pref-2',
    });
    const service = new MercadoPagoService();

    await service.createPreference({
      items: [{ title: 'Listing', quantity: 1, unit_price: 100 }],
      paymentId: 'payment-2',
    });

    const callBody = mockPreferenceCreate.mock.calls[0][0].body;
    expect(callBody.payer).toBeUndefined();
  });
});

describe('MercadoPagoService.processPaymentWebhook', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('confirms the booking when the payment is approved', async () => {
    mockPaymentGet.mockResolvedValue({
      id: 999,
      status: 'approved',
      external_reference: 'payment-1',
    });
    mockPaymentUpdate.mockResolvedValue({ bookingId: 'booking-1' });

    const service = new MercadoPagoService();
    const res = mockRes();

    await service.processPaymentWebhook('999', res);

    expect(mockPaymentUpdate).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: 'APPROVED', paymentId: '999' },
      select: { bookingId: true },
    });
    expect(mockBookingUpdate).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: 'CONFIRMED' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('cancels the booking when the payment is rejected', async () => {
    mockPaymentGet.mockResolvedValue({
      id: 998,
      status: 'rejected',
      external_reference: 'payment-2',
    });
    mockPaymentUpdate.mockResolvedValue({ bookingId: 'booking-2' });

    const service = new MercadoPagoService();
    const res = mockRes();

    await service.processPaymentWebhook('998', res);

    expect(mockBookingUpdate).toHaveBeenCalledWith({
      where: { id: 'booking-2' },
      data: { status: 'CANCELLED' },
    });
  });

  it('does nothing when the payment has no external_reference', async () => {
    mockPaymentGet.mockResolvedValue({ id: 1, status: 'approved' });

    const service = new MercadoPagoService();
    const res = mockRes();

    await service.processPaymentWebhook('1', res);

    expect(mockPaymentUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('MercadoPagoService.processWebhookRequest', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };
  const originalSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  afterEach(() => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = originalSecret;
    jest.clearAllMocks();
  });

  it('returns 401 when the signature is invalid', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'secret';
    const service = new MercadoPagoService();
    const req = { headers: {}, body: {}, query: {} };
    const res = mockRes();

    await service.processWebhookRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('acknowledges but ignores non-payment notifications', async () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const service = new MercadoPagoService();
    const req = { headers: {}, body: { type: 'merchant_order' }, query: {} };
    const res = mockRes();

    await service.processWebhookRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockPaymentGet).not.toHaveBeenCalled();
  });

  it('processes a valid payment notification', async () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    mockPaymentGet.mockResolvedValue({
      id: 1,
      status: 'approved',
      external_reference: 'payment-1',
    });
    mockPaymentUpdate.mockResolvedValue({ bookingId: 'booking-1' });

    const service = new MercadoPagoService();
    const req = {
      headers: {},
      body: { type: 'payment', data: { id: '1' } },
      query: {},
    };
    const res = mockRes();

    await service.processWebhookRequest(req, res);

    expect(mockPaymentUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('still responds 200 when processing throws', async () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    mockPaymentGet.mockResolvedValue({
      id: 1,
      status: 'approved',
      external_reference: 'payment-1',
    });
    mockPaymentUpdate.mockRejectedValue(new Error('DB down'));

    const service = new MercadoPagoService();
    const req = {
      headers: {},
      body: { type: 'payment', data: { id: '1' } },
      query: {},
    };
    const res = mockRes();

    await service.processWebhookRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
