// Demo data: users, events, listings and the platform ledger accounts.
// Idempotent: does nothing if users already exist, so it is safe on every container start.
// Compiled with the app, so the Docker image runs it with plain node (dist/db/seed.js).
// No orders or ledger entries are seeded; those only come from real flows.
import { UserRole } from '../generated/prisma/enums';
import { ACCOUNTS } from '../constants/ledger';
import { prisma } from './prisma';

// N days from today at a given Vietnam local time (UTC+7), e.g. 19:30 for an evening show.
function daysFromNowAt(days: number, hour: number, minute: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour - 7, minute, 0, 0);
  return date;
}

async function main() {
  if ((await prisma.user.count()) > 0) {
    console.log('seed: data already present, skipping');
    return;
  }

  await prisma.$transaction(async (tx) => {
    const [alice, bob] = await Promise.all([
      tx.user.create({ data: { name: 'Alice Nguyen' } }),
      tx.user.create({ data: { name: 'Bob Tran' } }),
    ]);
    await tx.user.create({ data: { name: 'Chi Le' } });
    await tx.user.create({ data: { name: 'Admin', role: UserRole.ADMIN } });

    const indieNight = await tx.event.create({
      data: {
        name: 'Hà Nội Indie Night 2026',
        description:
          'An open-air night of indie music with leading artists. Tickets are resold by fans; your payment is held until the event takes place.',
        venue: 'Cung Điền kinh Mỹ Đình',
        city: 'Hà Nội',
        startsAt: daysFromNowAt(45, 19, 30),
      },
    });
    const jazzFestival = await tx.event.create({
      data: {
        name: 'Saigon Jazz Festival',
        description: 'Three hours of jazz at the Saigon Opera House.',
        venue: 'Nhà hát Thành phố',
        city: 'TP. Hồ Chí Minh',
        startsAt: daysFromNowAt(25, 20, 0),
      },
    });
    // Already under way, so it can be marked as taken place (escrow released) in a demo. An event
    // can only be completed once it has started, and only cancelled before.
    const acousticNight = await tx.event.create({
      data: {
        name: 'Đà Lạt Acoustic Night',
        description:
          'An acoustic evening by the lake, already under way: tickets are still sold at the door, and an admin can mark it as taken place.',
        venue: 'Quảng trường Lâm Viên',
        city: 'Đà Lạt',
        startsAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // started 2 hours ago
      },
    });

    const listing = (eventId: number, sellerId: number, unitPrice: number, quantity: number) => ({
      eventId,
      sellerId,
      unitPrice: BigInt(unitPrice),
      quantityTotal: quantity,
      quantityAvailable: quantity,
    });
    await tx.listing.createMany({
      data: [
        listing(indieNight.id, alice.id, 450_000, 4),
        listing(indieNight.id, bob.id, 520_000, 3),
        listing(indieNight.id, alice.id, 1_200_000, 2),
        listing(jazzFestival.id, bob.id, 800_000, 6),
        listing(jazzFestival.id, alice.id, 650_000, 2),
        listing(acousticNight.id, alice.id, 300_000, 5),
        listing(acousticNight.id, bob.id, 350_000, 3),
      ],
    });

    await tx.account.createMany({
      data: [ACCOUNTS.gatewayClearing, ACCOUNTS.feePending, ACCOUNTS.feeRevenue],
    });
  });

  console.log('seed: done');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
