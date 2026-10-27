import type { RequestHandler } from 'express';
import { requireCurrentUser } from '../../middlewares/current-user';
import { toUserDto } from './users.mapper';
import { listUsers } from './users.service';

export const getUsers: RequestHandler = async (_req, res) => {
  const users = await listUsers();
  res.json(users.map(toUserDto));
};

export const getMe: RequestHandler = (req, res) => {
  res.json(toUserDto(requireCurrentUser(req)));
};
