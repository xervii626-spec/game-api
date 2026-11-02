export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  operatorId: Number(process.env.OPERATOR_ID ?? 0),
  sharedKey: process.env.SHARED_KEY ?? '',
  rgsIpWhitelist: (process.env.RGS_IP_WHITELIST ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3003',
  jwtSecret: process.env.JWT_SECRET ?? 'dev_jwt_secret_change_me',
  jwtExpiresHours: Number(process.env.JWT_EXPIRES_HOURS ?? 168),
  rgsLaunchBaseUrl:
    process.env.RGS_LAUNCH_BASE_URL ??
    'https://games.bcrgslaunchgame.com/authorization.php',
  cmsGamesUrl:
    process.env.CMS_GAMES_URL ??
    'https://www.cmsbetconstruct.com/casino/getGames',
  cmsOptionsUrl:
    process.env.CMS_OPTIONS_URL ??
    'https://www.cmsbetconstruct.com/casino/getOptions',
  gamesCacheTtlSec: Number(process.env.GAMES_CACHE_TTL_SEC ?? 300),
  adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin123456',
  adminDisplayName: process.env.ADMIN_DISPLAY_NAME ?? 'Super Admin',
  /** MMK per 1 USD — used to seed platform_settings if missing */
  mmkPerUsd: process.env.MMK_PER_USD ?? '4500',
});


