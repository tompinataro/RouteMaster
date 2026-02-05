import express from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config';

export type UserRole = 'admin' | 'tech';
export type JwtUser = { id: number; email: string; name: string; role?: UserRole; mustChangePassword?: boolean };
export type AuthMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => void;

export function signToken(user: JwtUser) {
  return jwt.sign({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role || 'tech',
    mustChangePassword: user.mustChangePassword || false,
  }, JWT_SECRET, { expiresIn: '12h' });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}

export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.header('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ ok: false, error: 'missing token' });
  try {
    const payload: any = jwt.verify(token, JWT_SECRET);
    req.user = { id: Number(payload.sub), email: payload.email, name: payload.name, role: payload.role, mustChangePassword: !!payload.mustChangePassword };
    return next();
  } catch (err: any) {
    return res.status(401).json({ ok: false, error: 'invalid token' });
  }
}

export function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.user) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'forbidden' });
  return next();
}
