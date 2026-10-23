import { RgsError, RgsErrorId } from '../common/constants/rgs-errors';

export type RgsBaseResponse = {
  HasError: boolean;
  ErrorId: number;
  ErrorDescription: string;
};

export function rgsOk<T extends Record<string, unknown>>(
  data: T,
): T & RgsBaseResponse {
  return {
    ...data,
    HasError: false,
    ErrorId: 0,
    ErrorDescription: '',
  };
}

export function rgsFail(
  errorId: RgsErrorId,
  description: string,
  extra: Record<string, unknown> = {},
): RgsBaseResponse & Record<string, unknown> {
  return {
    ...extra,
    HasError: true,
    ErrorId: errorId,
    ErrorDescription: description,
  };
}

export { RgsError };
