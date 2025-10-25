import { Router } from 'express';
import { getPaymentMethods } from '../controllers/paymentMethods.controller.js';

const router = Router();

router.get('/', getPaymentMethods);

export default router;