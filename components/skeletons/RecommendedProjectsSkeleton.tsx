'use client';

import { Card } from '@/components/ui/Card';

import { Skeleton } from '@/components/ui/Skeleton';
import { ProjectCardSkeleton } from '@/components/skeletons/ProjectCardSkeleton';

export default function RecommendedProjectsSkeleton() {
  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        <div className="flex gap-3">
          <Skeleton className="h-10 w-40 rounded-xl" />
          <Skeleton className="h-8 w-44 rounded-full" />
        </div>
      </div>

      {/* Search / Filter Section */}
      <Card className="bg-[#08051e]/40 rounded-2xl p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Search */}
          <Skeleton className="h-12 w-full md:w-80 rounded-xl" />

          {/* Difficulty Tabs */}
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-10 w-24 rounded-xl"
              />
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-44 rounded-xl" />
          </div>
        </div>
      </Card>

      {/* Project Cards */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <ProjectCardSkeleton key={index} />
        ))}
      </div>

      {/* Load More */}
      <div className="flex justify-center pt-4">
        <Skeleton className="h-11 w-56 rounded-xl" />
      </div>
    </div>
  );
}