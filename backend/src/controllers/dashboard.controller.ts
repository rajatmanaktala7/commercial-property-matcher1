import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const dashboardController = {
  async getStats(req: Request, res: Response) {
    const { type } = req.params;
    const teamId = (req as any).user.team_id;
    let value = 0, change = 0;

    switch (type) {
      case 'totalProperties':
        value = await prisma.property.count({ where: { team_id: teamId } });
        change = 12.5; break;
      case 'activeMatches':
        value = await prisma.match.count({ where: { client: { team_id: teamId }, status: { in: ['new','viewed','saved'] } } });
        change = 8.3; break;
      case 'avgCapRate':
        const agg = await prisma.property.aggregate({ where: { team_id: teamId, cap_rate: { not: null } }, _avg: { cap_rate: true } });
        value = agg._avg.cap_rate || 0; change = -0.2; break;
      case 'pipelineValue':
        const matches = await prisma.match.findMany({ where: { client: { team_id: teamId }, status: { in: ['new','viewed','saved','contacted'] } }, include: { property: { select: { price: true } } } });
        value = matches.reduce((sum, m) => sum + (m.property?.price || 0), 0);
        change = 15.7; break;
    }
    res.json({ value, change });
  },

  async getChartData(req: Request, res: Response) {
    const { type } = req.params;
    const teamId = (req as any).user.team_id;
    let data: any[] = [];

    if (type === 'distribution') {
      const props = await prisma.property.groupBy({ by: ['property_type'], where: { team_id: teamId }, _count: { id: true } });
      data = props.map(p => ({ label: p.property_type, value: p._count.id }));
    } else if (type === 'trend') {
      data = [{ month: 'Jan', value: 2500000 }, { month: 'Feb', value: 2800000 }, { month: 'Mar', value: 2650000 }, { month: 'Apr', value: 3100000 }, { month: 'May', value: 2950000 }, { month: 'Jun', value: 3400000 }];
    } else if (type === 'priceRange') {
      const ranges = [{ label: '< $1M', min: 0, max: 1000000 }, { label: '$1M - $5M', min: 1000000, max: 5000000 }, { label: '$5M - $10M', min: 5000000, max: 10000000 }, { label: '$10M+', min: 10000000, max: Infinity }];
      for (const r of ranges) {
        const count = await prisma.property.count({ where: { team_id: teamId, price: { gte: r.min, ...(r.max !== Infinity && { lt: r.max }) } } });
        data.push({ label: r.label, value: count });
      }
    }
    res.json({ data });
  },

  async getActivity(req: Request, res: Response) {
    const activities = await prisma.activityLog.findMany({ where: { team_id: (req as any).user.team_id }, include: { user: { select: { name: true, avatar_url: true } } }, orderBy: { created_at: 'desc' }, take: 20 });
    res.json(activities);
  },

  async getPipeline(req: Request, res: Response) {
    const pipeline = await prisma.match.groupBy({ by: ['status'], where: { client: { team_id: (req as any).user.team_id } }, _count: { id: true } });
    res.json(pipeline);
  },

  async getWidgets(req: Request, res: Response) {
    res.json([]);
  },

  async updateWidgets(req: Request, res: Response) {
    res.json({ success: true });
  },
};
