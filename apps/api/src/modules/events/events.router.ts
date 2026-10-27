import { Router } from 'express';
import { getEvent, getEvents } from './events.controller';

export const eventsRouter = Router();

eventsRouter.get('/events', getEvents);
eventsRouter.get('/events/:id', getEvent);
