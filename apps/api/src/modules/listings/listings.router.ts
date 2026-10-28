import { Router } from 'express';
import { currentUser } from '../../middlewares/current-user';
import { getMyListings, postListing, postWithdrawListing } from './listings.controller';

export const listingsRouter = Router();

listingsRouter.post('/listings', currentUser, postListing);
listingsRouter.post('/listings/:id/withdraw', currentUser, postWithdrawListing);
listingsRouter.get('/me/listings', currentUser, getMyListings);
