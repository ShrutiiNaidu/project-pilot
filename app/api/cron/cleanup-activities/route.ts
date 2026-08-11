import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');

  // Only Vercel Cron (or another trusted caller holding CRON_SECRET) may run this.
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const retentionDays = process.env.ACTIVITIES_RETENTION_DAYS
      ? parseInt(process.env.ACTIVITIES_RETENTION_DAYS, 10)
      : 30;

    if (isNaN(retentionDays) || retentionDays < 0) {
      return NextResponse.json({ error: 'Invalid ACTIVITIES_RETENTION_DAYS configuration' }, { status: 400 });
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await prisma.activity.deleteMany({
      where: {
        createdAt: {
          lt: cutoff,
        },
      },
    });

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error('[CRON_CLEANUP_ACTIVITIES]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
