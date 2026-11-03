import { z } from 'zod';
import { assetSchema, localizedTextSchema, sortFields } from '../../utils/validators.js';

const createTeam = z.strictObject({
  name: localizedTextSchema,
  role: localizedTextSchema,
  photo: assetSchema,
  ...sortFields,
});

export const TeamValidation = {
  create: createTeam,
  update: createTeam.partial(),
};
