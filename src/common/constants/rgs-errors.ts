/** BetConstruct Partner API error codes */
export const RgsError = {
  WRONG_PLAYER_ID: 8,
  NOT_ENOUGH_BALANCE: 21,
  PLAYER_BLOCKED: 29,
  INVALID_TOKEN: 102,
  TRANSACTION_NOT_FOUND: 107,
  WRONG_AMOUNT: 109,
  TRANSACTION_ALREADY_COMPLETE: 110,
  DEPOSIT_ALREADY_RECEIVED: 111,
  INVALID_BONUS_DEF_ID: 125,
  GENERAL_ERROR: 130,
} as const;

export type RgsErrorId = (typeof RgsError)[keyof typeof RgsError];
