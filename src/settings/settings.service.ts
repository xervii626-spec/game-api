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

  async getDailyLoginBonusUsd(): Promise<string> {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: SETTING_DAILY_LOGIN_BONUS_USD },
    });
    const raw = row?.value ?? DEFAULT_DAILY_LOGIN_BONUS_USD;
    return formatMoney(toDecimal(raw));
  }

  async setDailyLoginBonusUsd(amount: string) {
    const value = formatMoney(toDecimal(amount));
    if (toDecimal(value).lte(0)) {
      throw new BadRequestException('Daily login bonus must be greater than 0');
    }
    await this.prisma.platformSetting.upsert({
      where: { key: SETTING_DAILY_LOGIN_BONUS_USD },
      create: { key: SETTING_DAILY_LOGIN_BONUS_USD, value },
      update: { value },
    });
    return {
      key: SETTING_DAILY_LOGIN_BONUS_USD,
      dailyLoginBonusUsd: value,
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
