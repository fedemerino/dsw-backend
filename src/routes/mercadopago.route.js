import { Router } from 'express';
import { MercadoPagoService } from '../services/mercadopago.service.js';

const router = Router();

router.post('/webhook', async (req, res) => {
  const mercadoPagoService = new MercadoPagoService();
  await mercadoPagoService.processWebhookRequest(req, res);
});

export default router;
