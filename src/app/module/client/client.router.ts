import { createContentRouter } from '../../utils/content.js';
import { ClientController } from './client.controller.js';
import { ClientValidation } from './client.validation.js';

export const ClientRouter = createContentRouter(ClientController, ClientValidation);
