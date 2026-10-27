import type { UserDto } from '@tc/shared';
import type { User } from '../../generated/prisma/client';

export function toUserDto(user: User): UserDto {
  return { id: user.id, name: user.name, role: user.role };
}
