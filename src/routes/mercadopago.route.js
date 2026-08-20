import { Router } from 'express';
import { MercadoPagoService } from '../services/mercadopago.service.js';

const router = Router();
const mercadoPagoService = new MercadoPagoService();

router.post('/webhook', async (req, res) => {
  await mercadoPagoService.processWebhookRequest(req, res);
});

export default router;
