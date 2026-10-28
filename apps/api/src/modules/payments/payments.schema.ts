import { z } from 'zod';
import { SUPPORTED_LOCALES } from '@tc/shared';

export const ReturnParamsSchema = z.object({
  // Anything unexpected falls back to Vietnamese rather than failing the buyer's redirect.
  locale: z.enum(SUPPORTED_LOCALES).catch('vi').meta({ description: 'Language of the page to return to' }),
});
