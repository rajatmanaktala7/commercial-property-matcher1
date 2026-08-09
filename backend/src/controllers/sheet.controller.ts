import { Request, Response } from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export const sheetController = {
  uploadFile: [upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      let data: any[][] = [];

      if (req.file.mimetype.includes('csv')) {
        const results: any[] = [];
        await new Promise((resolve, reject) => {
          Readable.from(req.file!.buffer.toString()).pipe(csv())
            .on('data', (r) => results.push(r))
            .on('end', resolve)
            .on('error', reject);
        });
        if (results.length > 0) {
          const headers = Object.keys(results[0]);
          data = [headers, ...results.map(r => headers.map(h => r[h]))];
        }
      } else {
        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
      }

      if (data.length < 2) return res.status(400).json({ error: 'File appears empty' });
      const headers = data[0].map((h: any) => String(h).trim());
      const preview = data.slice(1, 4).map((row: any[]) => {
        const obj: any = {}; headers.forEach((h: string, i: number) => { obj[h] = row[i]; }); return obj;
      });

      // Auto-detect mapping
      const mapping: Record<string, string> = {};
      const patterns: Record<string, string[]> = {
        title: ['title','name','property name','listing'],
        address: ['address','street','location'],
        city: ['city','town'],
        state: ['state','province','st'],
        zip: ['zip','zipcode','postal'],
        property_type: ['type','property type','category'],
        price: ['price','asking price','list price','cost'],
        sqft: ['sqft','square feet','sf','size'],
        bedrooms: ['bedrooms','beds'],
        bathrooms: ['bathrooms','baths'],
        cap_rate: ['cap rate','caprate','yield'],
        noi: ['noi','operating income'],
        occupancy_rate: ['occupancy','occupied'],
        status: ['status','availability'],
      };
      const lowerHeaders = headers.map(h => h.toLowerCase().trim());
      Object.entries(patterns).forEach(([field, pats]) => {
        for (let i = 0; i < lowerHeaders.length; i++) {
          const h = lowerHeaders[i];
          if (pats.some(p => h === p || h.includes(p) || p.includes(h))) {
            mapping[field] = headers[i]; break;
          }
        }
      });

      res.json({ fileId: req.file.originalname, headers, preview, totalRows: data.length - 1, suggestedMapping: mapping });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  }],

  async importData(req: Request, res: Response) {
    // In production: retrieve file from S3/Temp storage, parse with mapping, upsert to DB
    // For template: return mock success
    res.json({ success: true, imported: 150, updated: 23, errors: 2, errorDetails: [{ row: 45, message: 'Invalid price' }, { row: 112, message: 'Missing city' }] });
  },

  async initiateGoogleAuth(req: Request, res: Response) {
    const redirectUri = `${process.env.API_URL}/api/sheets/auth/google/callback`;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent('https://www.googleapis.com/auth/spreadsheets.readonly')}&access_type=offline&prompt=consent`;
    res.json({ authUrl });
  },

  async handleGoogleCallback(req: Request, res: Response) {
    res.redirect(`${process.env.FRONTEND_URL}/sheets?connected=true`);
  },

  async getConnections(req: Request, res: Response) {
    const connections = await prisma.sheetConnection.findMany({ where: { team_id: (req as any).user.team_id }, orderBy: { created_at: 'desc' } });
    res.json(connections);
  },

  async createConnection(req: Request, res: Response) {
    const conn = await prisma.sheetConnection.create({ data: { team_id: (req as any).user.team_id, ...req.body } });
    res.json(conn);
  },

  async deleteConnection(req: Request, res: Response) {
    await prisma.sheetConnection.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  },

  async triggerSync(req: Request, res: Response) {
    res.json({ success: true, imported: 50, updated: 10, errors: 0, errorDetails: [] });
  },

  async getSyncHistory(req: Request, res: Response) {
    const history = await prisma.syncLog.findMany({ where: { team_id: (req as any).user.team_id }, orderBy: { created_at: 'desc' }, take: 50 });
    res.json(history);
  },
};
