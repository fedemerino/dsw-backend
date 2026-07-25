import express from 'express';
import request from 'supertest';
import { MercadoPagoService } from '../../services/mercadopago.service.js';
import mercadoPagoRouter from '../../routes/mercadopago.route.js';

jest.mock('../../services/mercadopago.service.js', () => ({
  MercadoPagoService: jest.fn().mockImplementation(() => ({
    processWebhookRequest: jest.fn((req, res) =>
      res.status(200).json({ ok: true })
    ),
  })),
}));

const app = express();
app.use(express.json());
app.use('/api/mercadopago', mercadoPagoRouter);

afterEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/mercadopago/webhook', () => {
  it('delegates to MercadoPagoService.processWebhookRequest', async () => {
    const res = await request(app)
      .post('/api/mercadopago/webhook')
      .send({ type: 'payment', data: { id: '123' } });

    expect(res.status).toBe(200);
    expect(MercadoPagoService).toHaveBeenCalled();
    const instance = MercadoPagoService.mock.results[0].value;
    expect(instance.processWebhookRequest).toHaveBeenCalled();
  });
});
