import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteProject, getUserProjects } from '@/app/actions/projectActions';
import { prisma } from '@/lib/prisma';

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => Promise.resolve({ userId: 'mock-developer-id' })),
}));

// Mock Prisma Client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('Project Soft Delete Server Actions', () => {
  const mockDbUser = { id: 'db-user-id', clerkId: 'mock-developer-id' };
  const mockProject = { id: 'project-id', userId: 'db-user-id', deletedAt: null };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deleteProject', () => {
    it('sets deletedAt field to a Date instead of deleting from db', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as any);
      vi.mocked(prisma.project.findFirst).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.project.update).mockResolvedValue({
        ...mockProject,
        deletedAt: new Date(),
      } as any);

      const result = await deleteProject('project-id');

      expect(result.success).toBe(true);
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-id' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('returns error if user does not own the project', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as any);
      vi.mocked(prisma.project.findFirst).mockResolvedValue(null); // unauthorized

      const result = await deleteProject('project-id');

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('AUTH');
    });
  });

  describe('getUserProjects', () => {
    it('queries projects with deletedAt: null', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockDbUser,
        projects: [mockProject],
      } as any);

      await getUserProjects();

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { clerkId: 'mock-developer-id' },
        include: {
          projects: {
            where: { deletedAt: null },
            include: {
              activities: { orderBy: { createdAt: 'desc' } },
              milestones: { orderBy: { dueDate: 'asc' } },
            },
            orderBy: { updatedAt: 'desc' },
          },
        },
      });
    });
  });
});
