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
import { tagsController } from '@modules/tags/tags.controller.js';
import { AttachTagSchema, ContactTagParamsSchema } from '@modules/tags/tags.schema.js';

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

// ── Tags de um contato (T-043) — anexar/remover. Tenant-scoped no service. ──
contactsRoutes.post(
  '/:id/tags',
  requireRole('OWNER', 'ADMIN', 'AGENT'),
  validate(ContactIdParamSchema, 'params'),
  validate(AttachTagSchema),
  tagsController.attachToContact,
);
contactsRoutes.delete(
  '/:id/tags/:tagId',
  requireRole('OWNER', 'ADMIN', 'AGENT'),
  validate(ContactTagParamsSchema, 'params'),
  tagsController.detachFromContact,
);
