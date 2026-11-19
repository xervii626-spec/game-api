import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMasterAgentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  displayName!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password!: string;
}
