import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { RgsError, rgsFail } from '../../wallet/rgs-response';

/**
 * BetConstruct expects HTTP 200 + { HasError, ErrorId, ErrorDescription }.
 * Nest 400/401/403 JSON makes their test tool say
 * "Partner endpoint did not respond correctly".
 */
@Catch(UnauthorizedException, ForbiddenException, BadRequestException)
export class RgsExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<{ url?: string }>();
    const url = req.url ?? '';

    const isWallet =
      /\/(wallet\/)?(Authentication|authenticate|GetBalance|get-balance|getBalance|WithdrawAndDeposit|withdraw-and-deposit|withdrawAndDeposit|Withdraw|withdraw|Deposit|deposit|Rollback|rollback)(\?|$)/i.test(
        url,
      );

    if (!isWallet) {
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const raw = exception.getResponse();
    let description = exception.message;
    if (typeof raw === 'string') {
      description = raw;
    } else if (typeof raw === 'object' && raw && 'message' in raw) {
      const msg = (raw as { message: string | string[] }).message;
      description = Array.isArray(msg) ? msg.join(', ') : String(msg);
    }

    const amountRelated = /amount|DepositAmount|WithdrawAmount/i.test(
      description,
    );
    const errorId = amountRelated
      ? RgsError.WRONG_AMOUNT
      : RgsError.GENERAL_ERROR;
    const errorDescription = amountRelated
      ? 'Wrong Transaction Amount'
      : description;

    res.status(200).json(
      rgsFail(errorId, errorDescription, {
        PlatformTransactionId: 0,
        PlayerId: 0,
        Token: '',
      }),
    );
  }
}
