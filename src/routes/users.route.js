import { Router } from 'express';
import { updateUser, getUserByEmail, getUsers, deleteUser } from '../controllers/users.controller.js';

const router = Router();

router.get('/', getUsers);
router.get('/:email', getUserByEmail);
router.put('/update', updateUser);
router.delete('/:email', deleteUser);

export default router;
