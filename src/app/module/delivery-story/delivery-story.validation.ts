import { z } from 'zod';
import { assetSchema, localizedTextSchema, sortFields } from '../../utils/validators.js';

const createDeliveryStory = z.strictObject({
  title: localizedTextSchema,
  caption: localizedTextSchema,
  image: assetSchema,
  ...sortFields,
});

export const DeliveryStoryValidation = {
  create: createDeliveryStory,
  update: createDeliveryStory.partial(),
};
