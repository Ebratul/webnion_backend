import type { TeamMember as TeamMemberRow } from '../../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { createContentService } from '../../utils/content.js';
import { pickText } from '../../utils/localize.js';
import type { PublicTeam } from './team.interface.js';

export const TeamService = createContentService<TeamMemberRow, PublicTeam>(prisma.teamMember, (row, locale) => ({
  id: row.id,
  name: pickText(row.name, locale),
  role: pickText(row.role, locale),
  photo: row.photo,
}));
