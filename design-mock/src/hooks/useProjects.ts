import { useState } from 'react';
import { Project, Task, TaskStatus, Message } from '../types';

const MOCK_PROJECTS: Project[] = [
{
  id: 'p1',
  name: 'Artemis Frontend',
  path: '~/dev/artemis-web',
  status: 'active',
  liveUrl: 'http://localhost:3000',
  tasks: [
  {
    id: 't1',
    title: 'Implement Auth Flow',
    description:
    'Set up JWT handling and protected routes. Need to ensure token refresh works silently.',
    status: 'in-progress',
    priority: 'high',
    steps: ['Check token expiration logic', 'Add interceptor for 401s'],
    findings: [
    'Current implementation leaks memory on logout',
    'Refresh token endpoint returns 500 occasionally']

  },
  {
    id: 't2',
    title: 'Refactor Sidebar',
    description:
    'Convert the old class-based sidebar to a functional component with hooks.',
    status: 'todo',
    priority: 'medium'
  },
  {
    id: 't3',
    title: 'Fix Mobile Layout',
    description: 'The grid breaks on screens smaller than 375px.',
    status: 'verify',
    priority: 'high',
    steps: ['Test on iPhone SE simulator'],
    findings: ['Flex-wrap was missing on the card container']
  },
  {
    id: 't4',
    title: 'Update Dependencies',
    description: 'Bump React to 18.3 and fix resulting type errors.',
    status: 'done',
    priority: 'low'
  }],

  messages: [
  {
    id: 'm1',
    role: 'brian',
    content: 'Hey, the auth token seems to expire too quickly.',
    timestamp: '10:42 AM'
  },
  {
    id: 'm2',
    role: 'twin',
    content:
    "I checked the config. The `expiresIn` was set to `15m` instead of `15d`. I've updated the environment variable.",
    timestamp: '10:43 AM',
    logEntries: [
    'Read src/config/auth.ts',
    'Read .env.production',
    'Edited .env.production — changed JWT_EXPIRES_IN=15m → 15d',
    'Ran validate-env — passed']

  },
  {
    id: 'm3',
    role: 'brian',
    content: 'Great, can you also look at the refresh logic?',
    timestamp: '10:45 AM'
  },
  {
    id: 'm4',
    role: 'twin',
    content:
    'On it. I found a race condition in the interceptor. Patching now.',
    timestamp: '10:46 AM',
    logEntries: [
    'Read src/auth/interceptor.ts',
    'Read src/auth/tokenStore.ts',
    'Found race condition — concurrent refresh calls not queued',
    'Edited interceptor.ts — added mutex lock on refresh',
    'Ran test:auth — 7/7 passed']

  }]

},
{
  id: 'p2',
  name: 'Data Pipeline v2',
  path: '~/dev/data-pipe-v2',
  status: 'review',
  tasks: [
  {
    id: 't5',
    title: 'Optimize SQL Queries',
    description: 'The aggregation query takes 4s to run. Needs indexing.',
    status: 'in-progress',
    priority: 'high',
    steps: [
    'Analyze query plan',
    'Add composite index on (user_id, created_at)'],

    findings: ['Table scan on `events` table is the bottleneck']
  },
  {
    id: 't6',
    title: 'Add Redis Caching',
    description: 'Cache the leaderboard results for 60s.',
    status: 'todo',
    priority: 'medium'
  }],

  messages: [
  {
    id: 'm5',
    role: 'brian',
    content: 'Pipeline latency is up 20% since the last deploy.',
    timestamp: '2:15 PM'
  },
  {
    id: 'm6',
    role: 'twin',
    content:
    'Analyzing logs... It looks like the new transformation step is CPU bound.',
    timestamp: '2:16 PM',
    logEntries: [
    'Read logs/pipeline-2024-02-13.log',
    'Grep "duration_ms" — avg 4200ms (was 3500ms)',
    'Read src/transforms/aggregate.ts',
    'Profiled — 68% time in JSON.parse on line 89']

  }]

},
{
  id: 'p3',
  name: 'Auth Service',
  path: '~/dev/auth-service',
  status: 'error',
  tasks: [
  {
    id: 't7',
    title: 'Fix OAuth callback crash',
    description: 'The callback handler throws on malformed state param.',
    status: 'todo',
    priority: 'high',
    steps: ['Reproduce with empty state param'],
    findings: ['Missing null check on line 142 of callback.ts']
  }],

  messages: []
},
{
  id: 'p4',
  name: 'Docs Rewrite',
  path: '~/dev/docs-v2',
  status: 'idle',
  tasks: [],
  messages: []
},
{
  id: 'p5',
  name: 'Mobile App',
  path: '~/dev/mobile-ios',
  status: 'review',
  tasks: [],
  messages: []
}];


export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>('p1');
  const [mainChatMessages, setMainChatMessages] = useState<Message[]>([
  {
    id: 'mc1',
    role: 'twin',
    content:
    "Hey! I'm your AI assistant. Ask me anything across all your projects.",
    timestamp: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  }]
  );

  const activeProject =
  projects.find((p) => p.id === activeProjectId) || projects[0];

  const moveTask = (taskId: string, newStatus: TaskStatus) => {
    setProjects((prev) =>
    prev.map((project) => {
      if (project.id !== activeProjectId) return project;

      return {
        ...project,
        tasks: project.tasks.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task
        )
      };
    })
    );
  };

  const addMessage = (content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'brian',
      content,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    setProjects((prev) =>
    prev.map((project) => {
      if (project.id !== activeProjectId) return project;
      return {
        ...project,
        messages: [...project.messages, newMessage]
      };
    })
    );

    // Mock AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'twin',
        content:
        "I've noted that. Is there anything else you need help with regarding this task?",
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      };
      setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== activeProjectId) return project;
        return {
          ...project,
          messages: [...project.messages, aiMessage]
        };
      })
      );
    }, 1500);
  };

  const addMainChatMessage = (content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'brian',
      content,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    setMainChatMessages((prev) => [...prev, newMessage]);

    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'twin',
        content: "I've noted that. Is there anything else you need help with?",
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        }),
        logEntries: ['Processed request', 'Checking across projects...']
      };
      setMainChatMessages((prev) => [...prev, aiMessage]);
    }, 1500);
  };

  return {
    projects,
    activeProjectId,
    setActiveProjectId,
    activeProject,
    moveTask,
    addMessage,
    mainChatMessages,
    addMainChatMessage
  };
}