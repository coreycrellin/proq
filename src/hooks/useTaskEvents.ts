import { useEffect, useRef } from 'react';

export interface TaskUpdateEvent {
  taskId: string;
  changes: Record<string, unknown>;
}

export interface TaskCreatedEvent {
  type: 'created';
  task: Record<string, unknown>;
}

export type TaskSSEEvent = TaskUpdateEvent | TaskCreatedEvent;

/**
 * Subscribe to SSE task events for a project.
 * - Update events carry {taskId, changes} — merged into existing tasks.
 * - Created events carry {type: 'created', task} — inserted into the todo column.
 */
export function useTaskEvents(
  projectId: string | undefined,
  onUpdate: (event: TaskUpdateEvent) => void,
  onCreated?: (event: TaskCreatedEvent) => void,
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;

  useEffect(() => {
    if (!projectId) return;

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;

      es = new EventSource(`/api/projects/${projectId}/events`);

      es.onmessage = (event) => {
        if (event.data === 'heartbeat') return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'created' && parsed.task) {
            onCreatedRef.current?.(parsed as TaskCreatedEvent);
          } else if (parsed.taskId && parsed.changes) {
            onUpdateRef.current(parsed as TaskUpdateEvent);
          }
        } catch {
          // ignore unparseable events
        }
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (!disposed) {
          reconnectTimer = setTimeout(connect, 3_000);
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [projectId]);
}
