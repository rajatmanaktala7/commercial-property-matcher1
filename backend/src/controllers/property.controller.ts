import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const propertyController = {
  async list(req: Request, res: Response) {
    const teamId = (req as any).user.team_id;
    const { page = '1', limit = '20', search, type, minPrice, maxPrice, city } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = { team_id: teamId };
    if (search) where.OR = [
      { title: { contains: search as string, mode: 'insensitive' } },
      { address: { contains: search as string, mode: 'insensitive' } },
      { city: { contains: search as string, mode: 'insensitive' } },
    ];
    if (type) where.property_type = type;
    if (minPrice || maxPrice) where.price = {};
    if (minPrice) where.price.gte = parseFloat(minPrice as string);
    if (maxPrice) where.price.lte = parseFloat(maxPrice as string);
    if (city) where.city = { contains: city as string, mode: 'insensitive' };

    const [properties, total] = await Promise.all([
      prisma.property.findMany({ where, skip, take: parseInt(limit as string), orderBy: { created_at: 'desc' } }),
      prisma.property.count({ where }),
    ]);

    res.json({ data: properties, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  },

  async search(req: Request, res: Response) {
    const teamId = (req as any).user.team_id;
    const { q } = req.query;
    const properties = await prisma.property.findMany({
      where: {
        team_id: teamId,
        OR: [
          { title: { contains: q as string, mode: 'insensitive' } },
          { address: { contains: q as string, mode: 'insensitive' } },
          { city: { contains: q as string, mode: 'insensitive' } },
        ],
      },
      take: 20,
    });
    res.json(properties);
  },

  async getById(req: Request, res: Response) {
    const property = await prisma.property.findFirst({
      where: { id: req.params.id, team_id: (req as any).user.team_id },
      include: { matches: { include: { client: { select: { name: true, company: true } } }, orderBy: { score: 'desc' } } },
    });
    if (!property) return res.status(404).json({ error: 'Property not found' });
    res.json(property);
  },

  async create(req: Request, res: Response) {
    const property = await prisma.property.create({
      data: { ...req.body, team_id: (req as any).user.team_id },
    });
    res.json(property);
  },

  async update(req: Request, res: Response) {
    const property = await prisma.property.updateMany({
      where: { id: req.params.id, team_id: (req as any).user.team_id },
      data: req.body,
    });
    res.json(property);
  },

  async delete(req: Request, res: Response) {
    await prisma.property.deleteMany({ where: { id: req.params.id, team_id: (req as any).user.team_id } });
    res.json({ success: true });
  },

  async addTag(req: Request, res: Response) {
    // Simplified - tags stored in metadata for this template
    res.json({ success: true });
  },

  async removeTag(req: Request, res: Response) {
    res.json({ success: true });
  },
};
