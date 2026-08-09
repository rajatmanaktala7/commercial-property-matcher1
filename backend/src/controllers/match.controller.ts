import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function calculateScore(property: any, client: any) {
  const factors = {
    price: (() => {
      if (!property.price) return 0;
      const min = client.budget_min || property.price * 0.5;
      const max = client.budget_max || property.price * 2;
      if (property.price >= min && property.price <= max) return 1;
      return property.price < min ? Math.max(0, property.price / min) : Math.max(0, max / property.price);
    })(),
    location: (() => {
      if (!client.preferred_cities?.length) return 0.5;
      const cities = client.preferred_cities.map((c: string) => c.toLowerCase());
      return cities.includes((property.city || '').toLowerCase()) ? 1 : 0.2;
    })(),
    propertyType: (() => {
      if (!client.property_types?.length) return 0.5;
      return client.property_types.map((t: string) => t.toLowerCase()).includes((property.property_type || '').toLowerCase()) ? 1 : 0.1;
    })(),
    size: (() => {
      if (!property.sqft) return 0.3;
      const min = client.min_sqft || 0;
      const max = client.max_sqft || property.sqft * 2;
      if (property.sqft >= min && property.sqft <= max) return 1;
      return property.sqft < min ? Math.max(0, property.sqft / (min || 1)) : Math.max(0, max / property.sqft);
    })(),
    capRate: (() => {
      if (!property.cap_rate) return 0.3;
      if (!client.min_cap_rate) return 0.5;
      return property.cap_rate >= client.min_cap_rate ? Math.min(1, 0.8 + (property.cap_rate - client.min_cap_rate) / client.min_cap_rate * 0.2) : Math.max(0, property.cap_rate / client.min_cap_rate);
    })(),
  };

  const weights = { price: 0.30, location: 0.25, propertyType: 0.20, size: 0.15, capRate: 0.10 };
  const score = Object.entries(factors).reduce((sum, [k, v]) => sum + v * weights[k as keyof typeof weights], 0);
  return { score: Math.round(score * 100) / 100, factors };
}

export const matchController = {
  async getClientMatches(req: Request, res: Response) {
    const { clientId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const matches = await prisma.match.findMany({
      where: { client_id: clientId },
      include: { property: true },
      orderBy: { score: 'desc' },
      take: limit,
    });
    res.json(matches);
  },

  async getPropertyMatches(req: Request, res: Response) {
    const matches = await prisma.match.findMany({
      where: { property_id: req.params.propertyId },
      include: { client: { select: { name: true, company: true } } },
      orderBy: { score: 'desc' },
    });
    res.json(matches);
  },

  async runMatching(req: Request, res: Response) {
    const teamId = (req as any).user.team_id;
    const properties = await prisma.property.findMany({ where: { team_id: teamId, status: 'active' } });
    const clients = await prisma.client.findMany({ where: { team_id: teamId, status: 'active' } });

    let count = 0;
    for (const client of clients) {
      for (const property of properties) {
        const { score, factors } = calculateScore(property, client);
        if (score >= 0.4) {
          await prisma.match.upsert({
            where: { property_id_client_id: { property_id: property.id, client_id: client.id } },
            update: { score, match_factors: factors, status: score >= 0.85 ? 'highlighted' : 'new' },
            create: { property_id: property.id, client_id: client.id, score, match_factors: factors, status: 'new' },
          });
          count++;
        }
      }
    }

    await prisma.activityLog.create({
      data: { team_id: teamId, user_id: (req as any).user.id, action: 'matching_run', entity_type: 'match', metadata: { matches_generated: count } },
    });

    res.json({ success: true, matchesGenerated: count });
  },

  async updateStatus(req: Request, res: Response) {
    const { status } = req.body;
    const updateData: any = { status };
    if (status === 'viewed') updateData.viewed_at = new Date();
    if (status === 'saved') updateData.saved_at = new Date();
    const match = await prisma.match.update({ where: { id: req.params.id }, data: updateData });
    res.json(match);
  },

  async addFeedback(req: Request, res: Response) {
    res.json({ success: true });
  },
};
