import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validate } from '@middlewares/validate.middleware.js';
import { authMiddleware } from '@middlewares/auth.middleware.js';
import { LoginSchema, RegisterSchema, RefreshSchema } from './auth.schema.js';

export const authRoutes: Router = Router();

authRoutes.post('/register', validate(RegisterSchema), authController.register);
authRoutes.post('/login', validate(LoginSchema), authController.login);
authRoutes.post('/refresh', validate(RefreshSchema), authController.refresh);
authRoutes.post('/logout', authMiddleware, authController.logout);
authRoutes.get('/me', authMiddleware, authController.me);
