import { z } from 'zod';
import { USER_ROLES, type UserDto } from '@tc/shared';

export const UserSchema = z
  .object({
    id: z.number().int().meta({ example: 3 }),
    name: z.string().meta({ example: 'Chi Le' }),
    role: z.enum(USER_ROLES),
  })
  .meta({ id: 'User' }) satisfies z.ZodType<UserDto>;
