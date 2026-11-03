import { createContentController } from '../../utils/content.js';
import { ClientService } from './client.service.js';

export const ClientController = createContentController(ClientService, 'Client logos');
