import { Router } from 'express';
import { currentUser } from '../../middlewares/current-user';
import { getMe, getUsers } from './users.controller';

export const usersRouter = Router();

usersRouter.get('/users', getUsers);
usersRouter.get('/me', currentUser, getMe);
