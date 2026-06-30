import { Router } from 'express';
import { contactsController } from './contacts.controller.js';
import { validate } from '@middlewares/validate.middleware.js';
import { authMiddleware, requireRole } from '@middlewares/auth.middleware.js';
import { requireTenant } from '@middlewares/tenant-context.middleware.js';
import {
  ContactIdParamSchema,
  CreateContactSchema,
  ImportContactsSchema,
  UpdateContactSchema,
  ValidatePhonesSchema,
} from './contacts.schema.js';

export const contactsRoutes: Router = Router();

contactsRoutes.use(authMiddleware, requireTenant);

contactsRoutes.get('/', contactsController.list);
contactsRoutes.get('/export', contactsController.exportCsv);
contactsRoutes.post(
  '/',
  requireRole('OWNER', 'ADMIN', 'AGENT'),
  validate(CreateContactSchema),
  contactsController.create,
);
contactsRoutes.post(
  '/import',
  requireRole('OWNER', 'ADMIN'),
  validate(ImportContactsSchema),
  contactsController.importCsv,
);
contactsRoutes.post(
  '/validate-phones',
  requireRole('OWNER', 'ADMIN'),
  validate(ValidatePhonesSchema),
  contactsController.validatePhones,
);
contactsRoutes.get('/:id', validate(ContactIdParamSchema, 'params'), contactsController.get);
contactsRoutes.patch(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'AGENT'),
  validate(ContactIdParamSchema, 'params'),
  validate(UpdateContactSchema),
  contactsController.update,
);
contactsRoutes.delete(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  validate(ContactIdParamSchema, 'params'),
  contactsController.remove,
);
