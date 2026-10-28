import type { RequestHandler } from 'express';
import type { MyListingDto, Page } from '@tc/shared';
import { toPage } from '../../lib/pagination';
import { requireCurrentUser } from '../../middlewares/current-user';
import { toMyListingDto } from './listings.mapper';
import { CreateListingBodySchema, ListingIdParamsSchema, MyListingsQuerySchema } from './listings.schema';
import { createListing, listSellerListings, withdrawListing } from './listings.service';

export const postListing: RequestHandler = async (req, res) => {
  const input = CreateListingBodySchema.parse(req.body);
  res.status(201).json(toMyListingDto(await createListing(requireCurrentUser(req), input)));
};

export const postWithdrawListing: RequestHandler = async (req, res) => {
  const { id } = ListingIdParamsSchema.parse(req.params);
  res.json(toMyListingDto(await withdrawListing(requireCurrentUser(req).id, id)));
};

export const getMyListings: RequestHandler = async (req, res) => {
  const { limit, cursor } = MyListingsQuerySchema.parse(req.query);
  const listings = await listSellerListings(requireCurrentUser(req).id, { limit, afterId: cursor?.id });
  const page = toPage(listings, limit, toMyListingDto, (listing) => ({ id: listing.id }));
  res.json(page satisfies Page<MyListingDto>);
};
