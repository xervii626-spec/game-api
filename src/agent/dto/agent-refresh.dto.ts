import { IsString, MinLength } from 'class-validator';

export class AgentRefreshDto {
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}
