import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const JWT_REFRESH = process.env.JWT_REFRESH_SECRET || 'fallback-refresh';

export const authController = {
  async register(req: Request, res: Response) {
    try {
      const { email, password, name, teamName } = req.body;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(400).json({ error: 'Email already registered' });

      const hashedPassword = await bcrypt.hash(password, 12);
      const team = await prisma.team.create({
        data: { name: teamName || `${name}'s Team`, slug: `team-${Date.now()}` },
      });
      const user = await prisma.user.create({
        data: { email, name, password_hash: hashedPassword, role: 'admin', team_id: team.id },
      });

      const accessToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH, { expiresIn: '7d' });

      res.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, team_id: user.team_id },
        accessToken, refreshToken,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  },

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const user = await prisma.user.findUnique({ where: { email }, include: { team: true } });
      if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      await prisma.user.update({ where: { id: user.id }, data: { last_active: new Date() } });

      const accessToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH, { expiresIn: '7d' });

      res.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, team_id: user.team_id },
        accessToken, refreshToken,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  },

  async refresh(req: Request, res: Response) {
    try {
      const { refresh_token } = req.body;
      const decoded = jwt.verify(refresh_token, JWT_REFRESH) as any;
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) return res.status(401).json({ error: 'Invalid token' });
      const accessToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
      res.json({ accessToken });
    } catch (e) { res.status(401).json({ error: 'Invalid refresh token' }); }
  },

  async me(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const user = await prisma.user.findUnique({ where: { id: decoded.userId }, include: { team: true } });
      if (!user) return res.status(401).json({ error: 'User not found' });
      res.json({ id: user.id, email: user.email, name: user.name, role: user.role, team_id: user.team_id, team: user.team });
    } catch (e) { res.status(401).json({ error: 'Invalid token' }); }
  },
};
