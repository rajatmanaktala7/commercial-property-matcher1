import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const teamController = {
  async getTeam(req: Request, res: Response) {
    const team = await prisma.team.findUnique({
      where: { id: (req as any).user.team_id },
      include: {
        users: { select: { id: true, name: true, email: true, role: true, avatar_url: true, last_active: true } },
        _count: { select: { properties: true, clients: true, matches: true } },
      },
    });
    res.json(team);
  },
  async getActivity(req: Request, res: Response) {
    const activities = await prisma.activityLog.findMany({
      where: { team_id: (req as any).user.team_id },
      include: { user: { select: { name: true, avatar_url: true } } },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    res.json(activities);
  },
};
