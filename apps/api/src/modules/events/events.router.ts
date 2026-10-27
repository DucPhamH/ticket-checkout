import { Router } from 'express';
import { getEvents } from './events.controller';

export const eventsRouter = Router();

eventsRouter.get('/events', getEvents);
