import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

export class MercadoPagoService {
  constructor() {
    this.client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
    });
    this.prisma = new PrismaClient();
  }

  /**
   * Creates a new preference for a payment
   * @param {Object} options
   * @param {Object[]} options.items - Items to pay (title, description, quantity, unit_price)
   * @param {string} options.paymentId - Our DB Payment id (used as external_reference for webhook)
   * @param {string} options.payerEmail - Buyer's email (improves approval rate)
   * @param {string} options.payerFirstName - Buyer's first name (improves approval rate)
   * @param {string} options.payerLastName - Buyer's last name (improves approval rate)
   * @returns {Promise<Object>} The preference created (id, init_point, ...)
   */
  async createPreference({
    items,
    paymentId,
    payerEmail,
    payerFirstName,
    payerLastName,
  }) {
    const frontendUrl = process.env.FRONTEND_URL?.trim();
    if (!frontendUrl) {
      throw new Error(
        'FRONTEND_URL is not set. Add it to your .env (e.g. FRONTEND_URL=http://localhost:5173)'
      );
    }

    const webhookBaseUrl = process.env.BACKEND_URL?.trim();
    if (!webhookBaseUrl) {
      throw new Error(
        'WEBHOOK_BASE_URL (or BACKEND_URL) is not set. Add it to your .env (e.g. WEBHOOK_BASE_URL=https://xxxx.ngrok-free.app)'
      );
    }

    const preference = new Preference(this.client);
    const response = await preference.create({
      body: {
        items,
        external_reference: paymentId,
        statement_descriptor: 'RESERVAR',
        ...(frontendUrl.startsWith('https://') && { auto_return: 'approved' }),
        back_urls: {
          success: `${frontendUrl}/payments/success`,
          failure: `${frontendUrl}/payments/failure`,
          pending: `${frontendUrl}/payments/pending`,
        },
        notification_url: `${webhookBaseUrl}/api/mercadopago/webhook`,
        payment_methods: {
          installments: 1,
        },
        ...(payerEmail && {
          payer: {
            email: payerEmail,
            name: payerFirstName,
            surname: payerLastName,
          },
        }),
      },
    });
    return response;
  }

  /**
   * Validates x-signature from Mercado Pago (optional; set MERCADOPAGO_WEBHOOK_SECRET)
   */
  validateWebhookSignature(req) {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!secret) return true;

    const xSignature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];
    const dataId = req.body?.data?.id ?? req.query['data.id'];
    if (!xSignature || !dataId) return false;

    const parts = xSignature.split(',');
    let ts, v1;
    for (const part of parts) {
      const [key, value] = part.split('=').map((s) => s.trim());
      if (key === 'ts') ts = value;
      else if (key === 'v1') v1 = value;
    }
    if (!ts || !v1) return false;

    const manifest = `id:${dataId};request-id:${xRequestId || ''};ts:${ts};`;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');
    return expected === v1;
  }

  /**
   * Handles webhook request: validates, fetches payment from MP, updates our Payment.
   * Always responds with 200 so MP stops retrying (doc requires 200 within 22s).
   */
  async processWebhookRequest(req, res) {
    try {
      if (!this.validateWebhookSignature(req)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const type = req.body?.type ?? req.query?.type;
      const dataId = req.body?.data?.id ?? req.query?.['data.id'];

      if (type !== 'payment' || !dataId) {
        return res.status(200).json({ ok: true });
      }

      await this.processPaymentWebhook(dataId, res);
    } catch (err) {
      console.error('Webhook error:', err);
      res.status(200).json({ ok: true });
    }
  }

  /**
   * Fetches payment from MP by id, maps status, updates our Payment by external_reference.
   */
  async processPaymentWebhook(mpPaymentId, res) {
    const paymentClient = new Payment(this.client);
    const raw = await paymentClient.get({ id: mpPaymentId }).catch(() => null);
    const mpPayment = raw?.body ?? raw;
    if (!mpPayment || !mpPayment.external_reference) {
      return res.status(200).json({ ok: true });
    }

    const dbPaymentId = mpPayment.external_reference;
    const statusMap = {
      approved: 'APPROVED',
      rejected: 'REJECTED',
      refunded: 'REFUNDED',
      cancelled: 'REJECTED',
    };
    const status = statusMap[mpPayment.status] ?? 'PENDING';

    const updated = await this.prisma.payment.update({
      where: { id: dbPaymentId },
      data: {
        status,
        paymentId: String(mpPayment.id),
      },
      select: { bookingId: true },
    });

    if (updated?.bookingId) {
      if (status === 'APPROVED') {
        await this.prisma.booking.update({
          where: { id: updated.bookingId },
          data: { status: 'CONFIRMED' },
        });
      } else if (status === 'REJECTED') {
        await this.prisma.booking.update({
          where: { id: updated.bookingId },
          data: { status: 'CANCELLED' },
        });
      }
    }

    return res.status(200).json({ ok: true });
  }
}
