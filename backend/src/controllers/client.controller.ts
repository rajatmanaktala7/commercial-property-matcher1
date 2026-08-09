import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const clientController = {
  async list(req: Request, res: Response) {
    const teamId = (req as any).user.team_id;
    const clients = await prisma.client.findMany({ where: { team_id: teamId }, orderBy: { created_at: 'desc' } });
    res.json(clients);
  },
  async getById(req: Request, res: Response) {
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, team_id: (req as any).user.team_id },
      include: { matches: { include: { property: true }, orderBy: { score: 'desc' }, take: 10 } },
    });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  },
  async create(req: Request, res: Response) {
    const client = await prisma.client.create({ data: { ...req.body, team_id: (req as any).user.team_id } });
    res.json(client);
  },
  async update(req: Request, res: Response) {
    const client = await prisma.client.updateMany({ where: { id: req.params.id, team_id: (req as any).user.team_id }, data: req.body });
    res.json(client);
  },
  async delete(req: Request, res: Response) {
    await prisma.client.deleteMany({ where: { id: req.params.id, team_id: (req as any).user.team_id } });
    res.json({ success: true });
  },
};
