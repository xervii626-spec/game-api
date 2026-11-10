import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';
import { formatMoney, toDecimal } from '../common/utils/money.util';

/**
 * BetConstruct in-game UI follows Authenticate.Currency.
 * Wallet ledger stays USD; convert at RGS request/response boundary when
 * RGS_DISPLAY_CURRENCY=MMK.
 */
@Injectable()
export class RgsCurrencyService {
  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  /** Currency code exposed to RGS / game client */
  displayCurrency(): string {
    const raw = this.config.get<string>('rgsDisplayCurrency') ?? 'MMK';
    return raw.toUpperCase() === 'MMK' ? 'MMK' : 'USD';
  }

  usesMmk(): boolean {
    return this.displayCurrency() === 'MMK';
  }

  /** Accept player wallet currency or RGS display currency */
  accepts(dtoCurrency: string, playerCurrency: string): boolean {
    const d = (dtoCurrency ?? '').toUpperCase();
    const p = (playerCurrency ?? '').toUpperCase();
    return d === p || d === this.displayCurrency();
  }

  /** USD wallet balance → amount for RGS / game UI */
  async toRgsAmount(amountUsd: string | number): Promise<number> {
    if (!this.usesMmk()) {
      return Number(toDecimal(amountUsd).toFixed(4));
    }
    const rate = await this.settings.getMmkPerUsd();
    return Number(toDecimal(amountUsd).mul(toDecimal(rate)).toFixed(4));
  }

  /**
   * RGS bet/win amount → USD for wallet debit/credit.
   * If RGS still sends USD (matches player currency), no FX.
   */
  async toWalletUsd(
    amount: string | number,
    dtoCurrency: string,
    playerCurrency: string,
  ): Promise<string> {
    const d = (dtoCurrency ?? '').toUpperCase();
    const p = (playerCurrency ?? 'USD').toUpperCase();
    if (this.usesMmk() && d === 'MMK') {
      const rate = await this.settings.getMmkPerUsd();
      return this.settings.mmkToUsd(amount, rate);
    }
    if (d === p || d === 'USD') {
      return formatMoney(amount);
    }
    // Unexpected currency — still try format; caller should have validated
    return formatMoney(amount);
  }
}
