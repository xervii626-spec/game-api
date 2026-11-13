/**
 * Refuse to boot production with weak/missing secrets.
 * Call once from main.ts before listen.
 */
export function assertProductionEnvSafe() {
  if ((process.env.NODE_ENV ?? 'development') !== 'production') return;

  const missing: string[] = [];
  const jwt = process.env.JWT_SECRET?.trim() ?? '';
  if (!jwt || jwt === 'dev_jwt_secret_change_me' || jwt.length < 32) {
    missing.push('JWT_SECRET (strong, ≥32 chars)');
  }

  const shared = process.env.SHARED_KEY?.trim() ?? '';
  if (!shared || shared === 'change_me_shared_key') {
    missing.push('SHARED_KEY (RGS shared secret)');
  }

  const whitelist = (process.env.RGS_IP_WHITELIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (whitelist.length === 0) {
    missing.push('RGS_IP_WHITELIST (comma-separated IPs)');
  }

  const adminPass = process.env.ADMIN_PASSWORD?.trim() ?? '';
  if (!adminPass || adminPass === 'admin123456' || adminPass.length < 10) {
    missing.push('ADMIN_PASSWORD (strong, ≥10 chars, not default)');
  }

  if (missing.length) {
    throw new Error(
      `Production boot blocked — set: ${missing.join('; ')}`,
    );
  }
}
