import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionsService } from '../sessions/sessions.service';
import { LaunchGameDto } from './dto/launch-game.dto';

@Injectable()
export class LaunchService {
  constructor(
    private readonly sessions: SessionsService,
    private readonly config: ConfigService,
  ) {}

  health() {
    return { module: 'launch', status: 'ok' };
  }

  async launch(playerId: number, dto: LaunchGameDto) {
    const partnerId = this.config.get<number>('operatorId') ?? 0;
    const base =
      this.config.get<string>('rgsLaunchBaseUrl') ??
      'https://games.bcrgslaunchgame.com/authorization.php';

    const language = dto.language ?? 'en';
    const deviceTypeId = dto.deviceTypeId ?? 1;

    let token: string | undefined;
    if (dto.openType === 'real') {
      const session = await this.sessions.create(playerId);
      token = session.token;
    }

    const params = new URLSearchParams();
    params.set('partnerId', String(partnerId));
    params.set('gameId', String(dto.gameId));
    params.set('openType', dto.openType);
    params.set('language', language);
    params.set('devicetypeid', String(deviceTypeId));
    if (token) params.set('token', token);
    if (dto.exitUrl) params.set('exitURL', dto.exitUrl);
    if (dto.depositUrl) params.set('deposit_url', dto.depositUrl);

    const launchUrl = `${base}?${params.toString()}`;

    return {
      gameId: dto.gameId,
      openType: dto.openType,
      partnerId,
      token: token ?? null,
      launchUrl,
    };
  }
}
