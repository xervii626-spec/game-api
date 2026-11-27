import {
  BadRequestException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { formatMoney, toDecimal } from '../common/utils/money.util';

export const SETTING_MMK_PER_USD = 'mmk_per_usd';
export const SETTING_TELEGRAM_REGISTER_URL = 'telegram_register_url';
export const SETTING_DAILY_LOGIN_BONUS_USD = 'daily_login_bonus_usd';
export const SETTING_DAILY_LOGIN_BONUS_USD_PENDING =
  'daily_login_bonus_usd_pending';
export const SETTING_DAILY_LOGIN_BONUS_PENDING_FROM =
  'daily_login_bonus_pending_from';
export const SETTING_BIG_WIN_THRESHOLD_MMK = 'big_win_threshold_mmk';
const DEFAULT_DAILY_LOGIN_BONUS_USD = '1.0000';
const DEFAULT_BIG_WIN_THRESHOLD_MMK = '100000';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const existing = await this.prisma.platformSetting.findUnique({
      where: { key: SETTING_MMK_PER_USD },
    });
    if (!existing) {
      const fallback = String(this.config.get('mmkPerUsd') ?? '4500');
      await this.prisma.platformSetting.create({
        data: { key: SETTING_MMK_PER_USD, value: fallback },
      });
    }

    const tg = await this.prisma.platformSetting.findUnique({
      where: { key: SETTING_TELEGRAM_REGISTER_URL },
    });
    if (!tg) {
      const fromEnv = String(
        this.config.get('telegramRegisterUrl') ?? '',
      ).trim();
      await this.prisma.platformSetting.create({
        data: { key: SETTING_TELEGRAM_REGISTER_URL, value: fromEnv },
      });
    }

    const daily = await this.prisma.platformSetting.findUnique({
      where: { key: SETTING_DAILY_LOGIN_BONUS_USD },
    });
    if (!daily) {
      await this.prisma.platformSetting.create({
        data: {
          key: SETTING_DAILY_LOGIN_BONUS_USD,
          value: DEFAULT_DAILY_LOGIN_BONUS_USD,
        },
      });
    }

    const bigWin = await this.prisma.platformSetting.findUnique({
      where: { key: SETTING_BIG_WIN_THRESHOLD_MMK },
    });
    if (!bigWin) {
      await this.prisma.platformSetting.create({
        data: {
          key: SETTING_BIG_WIN_THRESHOLD_MMK,
          value: DEFAULT_BIG_WIN_THRESHOLD_MMK,
        },
      });
    }
  }

  /** MMK amount for 1 USD */
  async getMmkPerUsd(): Promise<string> {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: SETTING_MMK_PER_USD },
    });
    const raw = row?.value ?? String(this.config.get('mmkPerUsd') ?? '4500');
    return formatMoney(toDecimal(raw));
  }

  async setMmkPerUsd(rate: string) {
    const value = formatMoney(toDecimal(rate));
    if (toDecimal(value).lte(0)) {
      throw new Error('Rate must be positive');
    }
    await this.prisma.platformSetting.upsert({
      where: { key: SETTING_MMK_PER_USD },
      create: { key: SETTING_MMK_PER_USD, value },
      update: { value },
    });
    return { key: SETTING_MMK_PER_USD, mmkPerUsd: value };
  }

  /** MMK → USD (wallet currency) */
  mmkToUsd(amountMmk: string | number, rate: string | number): string {
    return formatMoney(toDecimal(amountMmk).div(toDecimal(rate)));
  }

  /** USD → MMK (display) */
  usdToMmk(amountUsd: string | number, rate: string | number): string {
    return toDecimal(amountUsd).mul(toDecimal(rate)).toFixed(2);
  }

  async getTelegramRegisterUrl(): Promise<string> {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: SETTING_TELEGRAM_REGISTER_URL },
    });
    return (row?.value ?? '').trim();
  }

  async setTelegramRegisterUrl(url: string) {
    const value = url.trim();
    if (!/^https:\/\/(t\.me|telegram\.me)\//i.test(value)) {
      throw new BadRequestException(
        'URL must be an https://t.me/… or https://telegram.me/… link',
      );
    }
    await this.prisma.platformSetting.upsert({
      where: { key: SETTING_TELEGRAM_REGISTER_URL },
      create: { key: SETTING_TELEGRAM_REGISTER_URL, value },
      update: { value },
    });
    return {
      key: SETTING_TELEGRAM_REGISTER_URL,
      telegramRegisterUrl: value,
    };
  }

  /** Public bundle for login / marketing screens (no secrets). */
  async getPublicSettings() {
    return {
      telegramRegisterUrl: await this.getTelegramRegisterUrl(),
      bigWinThresholdMmk: await this.getBigWinThresholdMmk(),
    };
  }

  /** Asia/Yangon calendar YYYY-MM-DD */
  yangonDateKey(d = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Yangon',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  /** Next Yangon calendar day after `fromKey` (YYYY-MM-DD). */
  nextYangonDateKey(fromKey: string): string {
    const [y, m, d] = fromKey.split('-').map(Number);
    const utc = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
    utc.setUTCDate(utc.getUTCDate() + 1);
    return utc.toISOString().slice(0, 10);
  }

  /**
   * Active amount for claims today.
   * If a pending amount's from-date ≤ today (Yangon), promote it first.
   */
  async getDailyLoginBonusUsd(): Promise<string> {
    await this.promoteDailyLoginBonusIfDue();
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: SETTING_DAILY_LOGIN_BONUS_USD },
    });
    const raw = row?.value ?? DEFAULT_DAILY_LOGIN_BONUS_USD;
    return formatMoney(toDecimal(raw));
  }

  async getDailyLoginBonusAdmin() {
    await this.promoteDailyLoginBonusIfDue();
    const [active, pending, pendingFrom] = await Promise.all([
      this.prisma.platformSetting.findUnique({
        where: { key: SETTING_DAILY_LOGIN_BONUS_USD },
      }),
      this.prisma.platformSetting.findUnique({
        where: { key: SETTING_DAILY_LOGIN_BONUS_USD_PENDING },
      }),
      this.prisma.platformSetting.findUnique({
        where: { key: SETTING_DAILY_LOGIN_BONUS_PENDING_FROM },
      }),
    ]);
    const dailyLoginBonusUsd = formatMoney(
      toDecimal(active?.value ?? DEFAULT_DAILY_LOGIN_BONUS_USD),
    );
    const pendingUsd = pending?.value
      ? formatMoney(toDecimal(pending.value))
      : null;
    return {
      dailyLoginBonusUsd,
      pendingDailyLoginBonusUsd: pendingUsd,
      pendingFrom: pendingFrom?.value ?? null,
      appliesNextYangonDay: Boolean(pendingUsd && pendingFrom?.value),
      timezone: 'Asia/Yangon',
    };
  }

  private async promoteDailyLoginBonusIfDue() {
    const today = this.yangonDateKey();
    const [pending, pendingFrom] = await Promise.all([
      this.prisma.platformSetting.findUnique({
        where: { key: SETTING_DAILY_LOGIN_BONUS_USD_PENDING },
      }),
      this.prisma.platformSetting.findUnique({
        where: { key: SETTING_DAILY_LOGIN_BONUS_PENDING_FROM },
      }),
    ]);
    if (!pending?.value || !pendingFrom?.value) return;
    if (pendingFrom.value > today) return;

    const value = formatMoney(toDecimal(pending.value));
    await this.prisma.$transaction([
      this.prisma.platformSetting.upsert({
        where: { key: SETTING_DAILY_LOGIN_BONUS_USD },
        create: { key: SETTING_DAILY_LOGIN_BONUS_USD, value },
        update: { value },
      }),
      this.prisma.platformSetting.deleteMany({
        where: {
          key: {
            in: [
              SETTING_DAILY_LOGIN_BONUS_USD_PENDING,
              SETTING_DAILY_LOGIN_BONUS_PENDING_FROM,
            ],
          },
        },
      }),
    ]);
  }

  /** Schedule amount for next Yangon day (does not change today's claims). */
  async setDailyLoginBonusUsd(amount: string) {
    const value = formatMoney(toDecimal(amount));
    if (toDecimal(value).lte(0)) {
      throw new BadRequestException('Daily login bonus must be greater than 0');
    }
    const today = this.yangonDateKey();
    const pendingFrom = this.nextYangonDateKey(today);

    await this.prisma.$transaction([
      this.prisma.platformSetting.upsert({
        where: { key: SETTING_DAILY_LOGIN_BONUS_USD_PENDING },
        create: { key: SETTING_DAILY_LOGIN_BONUS_USD_PENDING, value },
        update: { value },
      }),
      this.prisma.platformSetting.upsert({
        where: { key: SETTING_DAILY_LOGIN_BONUS_PENDING_FROM },
        create: {
          key: SETTING_DAILY_LOGIN_BONUS_PENDING_FROM,
          value: pendingFrom,
        },
        update: { value: pendingFrom },
      }),
    ]);

    const active = await this.getDailyLoginBonusUsd();
    return {
      key: SETTING_DAILY_LOGIN_BONUS_USD_PENDING,
      dailyLoginBonusUsd: active,
      pendingDailyLoginBonusUsd: value,
      pendingFrom,
      appliesNextYangonDay: true,
      timezone: 'Asia/Yangon',
    };
  }

  async getBigWinThresholdMmk(): Promise<string> {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: SETTING_BIG_WIN_THRESHOLD_MMK },
    });
    const raw = row?.value ?? DEFAULT_BIG_WIN_THRESHOLD_MMK;
    return toDecimal(raw).toFixed(2);
  }

  async setBigWinThresholdMmk(amount: string) {
    const value = toDecimal(amount).toFixed(2);
    if (toDecimal(value).lte(0)) {
      throw new BadRequestException('Big win threshold must be greater than 0');
    }
    await this.prisma.platformSetting.upsert({
      where: { key: SETTING_BIG_WIN_THRESHOLD_MMK },
      create: { key: SETTING_BIG_WIN_THRESHOLD_MMK, value },
      update: { value },
    });
    return {
      key: SETTING_BIG_WIN_THRESHOLD_MMK,
      bigWinThresholdMmk: value,
    };
  }
}
