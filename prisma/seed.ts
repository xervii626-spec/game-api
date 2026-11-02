/**
 * Test seed — players + wallets + sample ledger/payments
 *
 * Default password for ALL seeded players: Test1234
 * Admin (if missing): admin / admin123456
 *
 * Run: npx prisma db seed
 */
import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PLAYER_PASSWORD = 'Test1234';

type SeedPlayer = {
  username: string;
  nickname: string;
  currency: string;
  country: string;
  gender: boolean | null;
  isBlocked: boolean;
  realBalance: string;
  bonusMoney?: string;
  bonusWin?: string;
  frozenMoney?: string;
};

const PLAYERS: SeedPlayer[] = [
  {
    username: 'player01',
    nickname: 'Lucky One',
    currency: 'USD',
    country: 'MM',
    gender: true,
    isBlocked: false,
    realBalance: '100.0000',
    bonusMoney: '5.0000',
  },
  {
    username: 'player02',
    nickname: 'Gold Ace',
    currency: 'USD',
    country: 'MM',
    gender: false,
    isBlocked: false,
    realBalance: '250.5000',
  },
  {
    username: 'player03',
    nickname: 'Slot King',
    currency: 'USD',
    country: 'TH',
    gender: true,
    isBlocked: false,
    realBalance: '50.0000',
    bonusWin: '10.2500',
  },
  {
    username: 'demo_user',
    nickname: 'Demo Player',
    currency: 'USD',
    country: 'MM',
    gender: null,
    isBlocked: false,
    realBalance: '1000.0000',
  },
  {
    username: 'broke_user',
    nickname: 'Empty Pocket',
    currency: 'USD',
    country: 'MM',
    gender: true,
    isBlocked: false,
    realBalance: '0.0000',
  },
  {
    username: 'blocked_user',
    nickname: 'Blocked Guy',
    currency: 'USD',
    country: 'MM',
    gender: false,
    isBlocked: true,
    realBalance: '75.0000',
  },
];

async function ensureAdmin() {
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? 'admin123456';
  const displayName = process.env.ADMIN_DISPLAY_NAME ?? 'Super Admin';

  let admin = await prisma.adminUser.findUnique({ where: { username } });
  if (!admin) {
    admin = await prisma.adminUser.create({
      data: {
        username,
        displayName,
        role: 'admin',
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    console.log(`Admin created: ${username} / ${password}`);
  } else {
    console.log(`Admin exists: ${username}`);
  }
  return admin;
}

async function ensureFxRate() {
  await prisma.platformSetting.upsert({
    where: { key: 'mmk_per_usd' },
    create: { key: 'mmk_per_usd', value: process.env.MMK_PER_USD ?? '4500' },
    update: {},
  });
  console.log('FX rate mmk_per_usd ready');
}

async function seedPlayers(adminId: number) {
  const passwordHash = await bcrypt.hash(PLAYER_PASSWORD, 10);

  for (const p of PLAYERS) {
    const existing = await prisma.player.findUnique({
      where: { username: p.username },
    });

    if (existing) {
      await prisma.wallet.upsert({
        where: { playerId: existing.id },
        create: {
          playerId: existing.id,
          realBalance: new Prisma.Decimal(p.realBalance),
          bonusMoney: new Prisma.Decimal(p.bonusMoney ?? '0'),
          bonusWin: new Prisma.Decimal(p.bonusWin ?? '0'),
          frozenMoney: new Prisma.Decimal(p.frozenMoney ?? '0'),
        },
        update: {
          realBalance: new Prisma.Decimal(p.realBalance),
          bonusMoney: new Prisma.Decimal(p.bonusMoney ?? '0'),
          bonusWin: new Prisma.Decimal(p.bonusWin ?? '0'),
          frozenMoney: new Prisma.Decimal(p.frozenMoney ?? '0'),
        },
      });
      await prisma.player.update({
        where: { id: existing.id },
        data: {
          nickname: p.nickname,
          passwordHash,
          currency: p.currency,
          country: p.country,
          gender: p.gender,
          isBlocked: p.isBlocked,
        },
      });
      console.log(`Updated player: ${p.username} (balance ${p.realBalance} USD)`);
      continue;
    }

    const player = await prisma.player.create({
      data: {
        username: p.username,
        nickname: p.nickname,
        passwordHash,
        currency: p.currency,
        country: p.country,
        gender: p.gender,
        isBlocked: p.isBlocked,
        wallet: {
          create: {
            realBalance: new Prisma.Decimal(p.realBalance),
            bonusMoney: new Prisma.Decimal(p.bonusMoney ?? '0'),
            bonusWin: new Prisma.Decimal(p.bonusWin ?? '0'),
            frozenMoney: new Prisma.Decimal(p.frozenMoney ?? '0'),
          },
        },
      },
    });

    // Seed opening ledger when balance > 0
    if (Number(p.realBalance) > 0) {
      await prisma.walletLedger.create({
        data: {
          playerId: player.id,
          adminId,
          type: 'admin_credit',
          amount: new Prisma.Decimal(p.realBalance),
          balanceAfter: new Prisma.Decimal(p.realBalance),
          currency: p.currency,
          note: 'seed opening balance',
        },
      });
    }

    console.log(`Created player: ${p.username} (balance ${p.realBalance} USD)`);
  }
}

async function seedSamplePayments(adminId: number) {
  const player01 = await prisma.player.findUnique({
    where: { username: 'player01' },
  });
  if (!player01) return;

  const existing = await prisma.paymentRequest.count({
    where: { playerId: player01.id, playerNote: 'seed-sample' },
  });
  if (existing > 0) {
    console.log('Sample payments already seeded');
    return;
  }

  const rate = '4500.0000';

  await prisma.paymentRequest.create({
    data: {
      playerId: player01.id,
      type: 'deposit',
      status: 'pending',
      amountMmk: new Prisma.Decimal('45000.00'),
      amountUsd: new Prisma.Decimal('10.0000'),
      rateUsed: new Prisma.Decimal(rate),
      method: 'kbz',
      reference: 'SEED-KBZ-001',
      playerNote: 'seed-sample',
    },
  });

  await prisma.paymentRequest.create({
    data: {
      playerId: player01.id,
      type: 'deposit',
      status: 'approved',
      amountMmk: new Prisma.Decimal('90000.00'),
      amountUsd: new Prisma.Decimal('20.0000'),
      rateUsed: new Prisma.Decimal(rate),
      method: 'wave',
      reference: 'SEED-WAVE-001',
      playerNote: 'seed-sample',
      adminId,
      adminNote: 'seed approved',
      reviewedAt: new Date(),
    },
  });

  console.log('Sample payment requests seeded for player01');
}

async function seedSampleRgsTx() {
  const player02 = await prisma.player.findUnique({
    where: { username: 'player02' },
  });
  if (!player02) return;

  const exists = await prisma.transaction.findFirst({
    where: { rgsTransactionId: BigInt(900000001) },
  });
  if (exists) {
    console.log('Sample RGS transactions already seeded');
    return;
  }

  await prisma.transaction.createMany({
    data: [
      {
        playerId: player02.id,
        rgsTransactionId: BigInt(900000001),
        typeId: 1,
        direction: 'withdraw',
        amount: new Prisma.Decimal('5.0000'),
        currency: 'USD',
        gameId: 101,
        status: 'completed',
      },
      {
        playerId: player02.id,
        rgsTransactionId: BigInt(900000002),
        rgsRelatedTransactionId: BigInt(900000001),
        typeId: 2,
        direction: 'deposit',
        amount: new Prisma.Decimal('12.5000'),
        currency: 'USD',
        gameId: 101,
        status: 'completed',
      },
    ],
  });

  console.log('Sample RGS transactions seeded for player02');
}

async function main() {
  console.log('--- Seeding Shwe Dunn test data ---');
  const admin = await ensureAdmin();
  await ensureFxRate();
  await seedPlayers(admin.id);
  await seedSamplePayments(admin.id);
  await seedSampleRgsTx();
  console.log('--- Seed complete ---');
  console.log('');
  console.log('Player login password (all):', PLAYER_PASSWORD);
  console.log('Accounts:');
  for (const p of PLAYERS) {
    console.log(
      `  ${p.username.padEnd(14)} balance=${p.realBalance} USD  blocked=${p.isBlocked}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
