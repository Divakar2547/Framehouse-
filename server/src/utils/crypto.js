import crypto from 'crypto';

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function generateSlug(title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 50);

  const suffix = crypto.randomBytes(4).toString('hex');
  return `${base}-${suffix}`;
}

export function hashIp(ip) {
  return crypto.createHash('sha256').update(ip + 'ip-salt-privacy').digest('hex').substring(0, 16);
}
