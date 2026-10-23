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
});
