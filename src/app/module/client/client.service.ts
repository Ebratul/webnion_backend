import type { ClientLogo as ClientLogoRow } from '../../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { createContentService } from '../../utils/content.js';
import type { PublicClient } from './client.interface.js';

export const ClientService = createContentService<ClientLogoRow, PublicClient>(prisma.clientLogo, (row, locale) => ({
  id: row.id,
  name: row.name,
  logo: row.logo,
  url: row.url,
}));
