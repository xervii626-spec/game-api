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
    };
  }
}
