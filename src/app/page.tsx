'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/components/ProjectsProvider';

export default function RootPage() {
  const router = useRouter();
  const { projects, isLoaded } = useProjects();

  useEffect(() => {
    if (!isLoaded) return;
    if (projects.length > 0) {
      router.replace(`/projects/${projects[0].id}`);
    }
  }, [isLoaded, projects, router]);

  if (!isLoaded) return null;

  if (projects.length === 0) {
    router.replace('/supervisor');
    return null;
  }

  return null;
}
