import { prisma } from '../../db/prisma';

export function listUsers() {
  return prisma.user.findMany({ orderBy: { id: 'asc' } });
}

export function findUserById(id: number) {
  return prisma.user.findUnique({ where: { id } });
}
