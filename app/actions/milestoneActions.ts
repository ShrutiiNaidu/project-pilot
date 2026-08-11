'use server';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Define status enum
const MilestoneStatusEnum = z.enum(['UPCOMING', 'ONGOING', 'COMPLETED', 'Upcoming', 'Ongoing', 'Completed']);

// Create input validation schema
const createMilestoneSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  dueDate: z.preprocess((arg) => {
    if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
    return arg;
  }, z.date().nullable().optional()),
  status: MilestoneStatusEnum.optional().default('UPCOMING'),
  projectId: z.string().min(1, 'Project ID is required'),
});

// Update input validation schema
const updateMilestoneSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().nullable().optional(),
  dueDate: z.preprocess((arg) => {
    if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
    return arg;
  }, z.date().nullable().optional()),
  status: MilestoneStatusEnum.optional(),
});

// Helper to normalize status values to DB conventions
function normalizeStatus(status?: string): string {
  if (!status) return 'UPCOMING';
  const upper = status.toUpperCase();
  if (upper === 'UPCOMING' || upper === 'ONGOING' || upper === 'COMPLETED') {
    return upper;
  }
  return 'UPCOMING';
}

/**
 * Gets authenticated Clerk user ID or mock developer ID in local development.
 */
async function getAuthenticatedUserId(): Promise<string> {
  let userId: string | null = null;

  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const session = await auth();
    userId = session.userId;
  } else if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    userId = 'mock-developer-id';
  }

  if (!userId) {
    throw new Error('Unauthenticated user attempt.');
  }

  return userId;
}

/**
 * Verifies that the authenticated user owns the parent project.
 */
async function verifyProjectOwnership(projectId: string): Promise<{ success: boolean; dbUserId?: string; error?: string }> {
  try {
    const clerkId = await getAuthenticatedUserId();
    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!dbUser) {
      return { success: false, error: 'User record not found.' };
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: dbUser.id,
      },
    });

    if (!project) {
      return { success: false, error: 'Unauthorized to modify this project.' };
    }

    return { success: true, dbUserId: dbUser.id };
  } catch (error: any) {
    return { success: false, error: error.message || 'Authentication error.' };
  }
}

/**
 * Create a new milestone under a project.
 */
export async function createMilestone(data: unknown) {
  try {
    const parsed = createMilestoneSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, errorType: 'VALIDATION', errors: parsed.error.flatten().fieldErrors };
    }

    const payload = parsed.data;
    const ownership = await verifyProjectOwnership(payload.projectId);
    if (!ownership.success) {
      return { success: false, errorType: 'AUTH', message: ownership.error };
    }

    const milestone = await prisma.milestone.create({
      data: {
        title: payload.title,
        description: payload.description || null,
        dueDate: payload.dueDate || null,
        status: normalizeStatus(payload.status),
        projectId: payload.projectId,
      },
    });

    return { success: true, milestone };
  } catch (error: any) {
    console.error('Failed to create milestone:', error);
    return { success: false, errorType: 'SERVER', message: error.message || 'Internal server error.' };
  }
}

/**
 * Update an existing milestone.
 */
export async function updateMilestone(milestoneId: string, data: unknown) {
  try {
    if (!milestoneId) {
      return { success: false, errorType: 'VALIDATION', message: 'Milestone ID is required.' };
    }

    const parsed = updateMilestoneSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, errorType: 'VALIDATION', errors: parsed.error.flatten().fieldErrors };
    }

    const payload = parsed.data;

    // Fetch milestone to find parent project ID
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      return { success: false, errorType: 'NOT_FOUND', message: 'Milestone not found.' };
    }

    const ownership = await verifyProjectOwnership(milestone.projectId);
    if (!ownership.success) {
      return { success: false, errorType: 'AUTH', message: ownership.error };
    }

    const updatedMilestone = await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.dueDate !== undefined ? { dueDate: payload.dueDate } : {}),
        ...(payload.status !== undefined ? { status: normalizeStatus(payload.status) } : {}),
      },
    });

    return { success: true, milestone: updatedMilestone };
  } catch (error: any) {
    console.error('Failed to update milestone:', error);
    return { success: false, errorType: 'SERVER', message: error.message || 'Internal server error.' };
  }
}

/**
 * Delete a milestone.
 */
export async function deleteMilestone(milestoneId: string) {
  try {
    if (!milestoneId) {
      return { success: false, errorType: 'VALIDATION', message: 'Milestone ID is required.' };
    }

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      return { success: false, errorType: 'NOT_FOUND', message: 'Milestone not found.' };
    }

    const ownership = await verifyProjectOwnership(milestone.projectId);
    if (!ownership.success) {
      return { success: false, errorType: 'AUTH', message: ownership.error };
    }

    await prisma.milestone.delete({
      where: { id: milestoneId },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete milestone:', error);
    return { success: false, errorType: 'SERVER', message: error.message || 'Internal server error.' };
  }
}

/**
 * Update the status of a milestone.
 */
export async function updateMilestoneStatus(milestoneId: string, status: string) {
  try {
    if (!milestoneId) {
      return { success: false, errorType: 'VALIDATION', message: 'Milestone ID is required.' };
    }

    const parsedStatus = MilestoneStatusEnum.safeParse(status);
    if (!parsedStatus.success) {
      return { success: false, errorType: 'VALIDATION', message: 'Invalid milestone status.' };
    }

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      return { success: false, errorType: 'NOT_FOUND', message: 'Milestone not found.' };
    }

    const ownership = await verifyProjectOwnership(milestone.projectId);
    if (!ownership.success) {
      return { success: false, errorType: 'AUTH', message: ownership.error };
    }

    const updatedMilestone = await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: normalizeStatus(parsedStatus.data),
      },
    });

    return { success: true, milestone: updatedMilestone };
  } catch (error: any) {
    console.error('Failed to update milestone status:', error);
    return { success: false, errorType: 'SERVER', message: error.message || 'Internal server error.' };
  }
}
