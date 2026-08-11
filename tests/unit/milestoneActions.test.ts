import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMilestone,
  updateMilestone,
  deleteMilestone,
  updateMilestoneStatus,
} from '@/app/actions/milestoneActions';
import { prisma } from '@/lib/prisma';

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => Promise.resolve({ userId: 'mock-clerk-user-id' })),
}));

// Mock Prisma Client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
    },
    milestone: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

describe('Milestone CRUD Server Actions', () => {
  const mockDbUser = { id: 'db-user-id', clerkId: 'mock-clerk-user-id' };
  const mockProject = { id: 'project-id', userId: 'db-user-id' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createMilestone', () => {
    it('creates a milestone successfully when inputs and permissions are valid', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as any);
      vi.mocked(prisma.project.findFirst).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.milestone.create).mockResolvedValue({
        id: 'milestone-id',
        title: 'Design API',
        description: 'Create API spec',
        status: 'UPCOMING',
        projectId: 'project-id',
      } as any);

      const result = await createMilestone({
        title: 'Design API',
        description: 'Create API spec',
        status: 'Upcoming',
        projectId: 'project-id',
      });

      expect(result.success).toBe(true);
      expect(result.milestone).toBeDefined();
      expect(prisma.milestone.create).toHaveBeenCalledWith({
        data: {
          title: 'Design API',
          description: 'Create API spec',
          dueDate: null,
          status: 'UPCOMING',
          projectId: 'project-id',
        },
      });
    });

    it('returns validation errors for invalid input (e.g. empty title)', async () => {
      const result = await createMilestone({
        title: '',
        projectId: 'project-id',
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('VALIDATION');
      expect(result.errors).toBeDefined();
    });

    it('denies creation if user does not own the project', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as any);
      vi.mocked(prisma.project.findFirst).mockResolvedValue(null); // unauthorized

      const result = await createMilestone({
        title: 'Design API',
        projectId: 'project-id',
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('AUTH');
    });
  });

  describe('updateMilestone', () => {
    const mockMilestone = {
      id: 'milestone-id',
      title: 'Design API',
      projectId: 'project-id',
    };

    it('updates a milestone successfully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as any);
      vi.mocked(prisma.project.findFirst).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.milestone.findUnique).mockResolvedValue(mockMilestone as any);
      vi.mocked(prisma.milestone.update).mockResolvedValue({
        ...mockMilestone,
        title: 'New Title',
        status: 'ONGOING',
      } as any);

      const result = await updateMilestone('milestone-id', {
        title: 'New Title',
        status: 'Ongoing',
      });

      expect(result.success).toBe(true);
      expect(result.milestone?.title).toBe('New Title');
      expect(prisma.milestone.update).toHaveBeenCalled();
    });

    it('returns validation error when title is empty', async () => {
      const result = await updateMilestone('milestone-id', {
        title: '',
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('VALIDATION');
    });

    it('denies update if user does not own parent project', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as any);
      vi.mocked(prisma.milestone.findUnique).mockResolvedValue(mockMilestone as any);
      vi.mocked(prisma.project.findFirst).mockResolvedValue(null); // unauthorized

      const result = await updateMilestone('milestone-id', {
        title: 'New Title',
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('AUTH');
    });
  });

  describe('deleteMilestone', () => {
    const mockMilestone = {
      id: 'milestone-id',
      projectId: 'project-id',
    };

    it('deletes a milestone successfully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as any);
      vi.mocked(prisma.project.findFirst).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.milestone.findUnique).mockResolvedValue(mockMilestone as any);

      const result = await deleteMilestone('milestone-id');

      expect(result.success).toBe(true);
      expect(prisma.milestone.delete).toHaveBeenCalledWith({
        where: { id: 'milestone-id' },
      });
    });

    it('denies deletion if unauthorized', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as any);
      vi.mocked(prisma.milestone.findUnique).mockResolvedValue(mockMilestone as any);
      vi.mocked(prisma.project.findFirst).mockResolvedValue(null);

      const result = await deleteMilestone('milestone-id');

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('AUTH');
    });
  });

  describe('updateMilestoneStatus', () => {
    const mockMilestone = {
      id: 'milestone-id',
      projectId: 'project-id',
    };

    it('updates status successfully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDbUser as any);
      vi.mocked(prisma.project.findFirst).mockResolvedValue(mockProject as any);
      vi.mocked(prisma.milestone.findUnique).mockResolvedValue(mockMilestone as any);
      vi.mocked(prisma.milestone.update).mockResolvedValue({
        ...mockMilestone,
        status: 'COMPLETED',
      } as any);

      const result = await updateMilestoneStatus('milestone-id', 'Completed');

      expect(result.success).toBe(true);
      expect(prisma.milestone.update).toHaveBeenCalledWith({
        where: { id: 'milestone-id' },
        data: { status: 'COMPLETED' },
      });
    });

    it('rejects invalid status', async () => {
      const result = await updateMilestoneStatus('milestone-id', 'INVALID_STATUS');

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('VALIDATION');
    });
  });
});
