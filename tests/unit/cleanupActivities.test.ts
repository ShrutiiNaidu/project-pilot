import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/cron/cleanup-activities/route';
import { prisma } from '@/lib/prisma';

// Mock Prisma Client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    activity: {
      deleteMany: vi.fn(),
    },
  },
}));

describe('Cleanup Activities Cron API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'super-secret-cron-key';
    delete process.env.ACTIVITIES_RETENTION_DAYS;
  });

  it('returns 401 if authorization header is missing', async () => {
    const req = new Request('http://localhost/api/cron/cleanup-activities');
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 401 if authorization token is mismatched', async () => {
    const req = new Request('http://localhost/api/cron/cleanup-activities', {
      headers: { authorization: 'Bearer wrong-key' },
    });
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('successfully cleans up old activity records using default 30 days retention', async () => {
    vi.mocked(prisma.activity.deleteMany).mockResolvedValue({ count: 12 } as any);

    const req = new Request('http://localhost/api/cron/cleanup-activities', {
      headers: { authorization: 'Bearer super-secret-cron-key' },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deleted).toBe(12);

    expect(prisma.activity.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: {
          lt: expect.any(Date),
        },
      },
    });

    const calledArg = vi.mocked(prisma.activity.deleteMany).mock.calls[0][0] as any;
    const cutoffDate = calledArg?.where?.createdAt?.lt;
    expect(cutoffDate).toBeInstanceOf(Date);

    // Default: ~30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    expect(Math.abs(cutoffDate.getTime() - thirtyDaysAgo.getTime())).toBeLessThan(5000);
  });

  it('uses configurable retention period from env variable', async () => {
    process.env.ACTIVITIES_RETENTION_DAYS = '15';
    vi.mocked(prisma.activity.deleteMany).mockResolvedValue({ count: 5 } as any);

    const req = new Request('http://localhost/api/cron/cleanup-activities', {
      headers: { authorization: 'Bearer super-secret-cron-key' },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deleted).toBe(5);

    const calledArg = vi.mocked(prisma.activity.deleteMany).mock.calls[0][0] as any;
    const cutoffDate = calledArg?.where?.createdAt?.lt;

    // Configured: ~15 days ago
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    expect(Math.abs(cutoffDate.getTime() - fifteenDaysAgo.getTime())).toBeLessThan(5000);
  });

  it('handles database errors gracefully', async () => {
    vi.mocked(prisma.activity.deleteMany).mockRejectedValue(new Error('DB failure'));

    const req = new Request('http://localhost/api/cron/cleanup-activities', {
      headers: { authorization: 'Bearer super-secret-cron-key' },
    });
    const res = await GET(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Internal Server Error');
  });
});
