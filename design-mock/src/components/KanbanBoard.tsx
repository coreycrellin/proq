import React, { useState } from 'react';
import {
  CircleDotIcon,
  RefreshCwIcon,
  SearchCheckIcon,
  CheckCircle2Icon,
  PlusIcon } from
'lucide-react';
import { Task, TaskStatus } from '../types';
import { TaskCard } from './TaskCard';
interface KanbanBoardProps {
  tasks: Task[];
  onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
}
const COLUMNS: {
  id: TaskStatus;
  label: string;
  icon: React.ReactNode;
}[] = [
{
  id: 'todo',
  label: 'To Do',
  icon: <CircleDotIcon className="w-3.5 h-3.5 text-zinc-500" />
},
{
  id: 'in-progress',
  label: 'In Progress',
  icon: <RefreshCwIcon className="w-3.5 h-3.5 text-blue-400" />
},
{
  id: 'verify',
  label: 'Verify',
  icon: <SearchCheckIcon className="w-3.5 h-3.5 text-amber-400" />
},
{
  id: 'done',
  label: 'Done',
  icon: <CheckCircle2Icon className="w-3.5 h-3.5 text-green-400" />
}];

export function KanbanBoard({ tasks, onMoveTask }: KanbanBoardProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent, columnId: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };
  const handleDrop = (e: React.DragEvent, columnId: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (draggedTaskId) {
      onMoveTask(draggedTaskId, columnId);
      setDraggedTaskId(null);
    }
  };
  return (
    <div className="flex-1 h-full overflow-x-auto bg-zinc-950">
      <div className="flex h-full min-w-[1000px] p-6 space-x-4">
        {COLUMNS.map((column) => {
          const columnTasks = tasks.filter((t) => t.status === column.id);
          const isDragOver = dragOverColumn === column.id;
          return (
            <div
              key={column.id}
              className={`flex-1 flex flex-col min-w-[240px] rounded-lg ${isDragOver ? 'bg-zinc-900/50 ring-2 ring-blue-500/20' : 'bg-transparent'}`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDrop={(e) => handleDrop(e, column.id)}
              onDragLeave={() => setDragOverColumn(null)}>

              {/* Column Header */}
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  {column.icon}
                  <h3 className="text-sm font-medium text-zinc-400">
                    {column.label}
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-500 font-mono">
                  {columnTasks.length}
                </span>
              </div>

              {/* Task List */}
              <div className="flex-1 space-y-3 overflow-y-auto pb-4 px-1 scrollbar-thin">
                {columnTasks.map((task) =>
                <TaskCard
                  key={task.id}
                  task={task}
                  onDragStart={handleDragStart} />

                )}

                {columnTasks.length === 0 &&
                <div className="h-24 border-2 border-dashed border-zinc-900 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-zinc-700">Empty</span>
                  </div>
                }

                {column.id === 'todo' &&
                <button className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-zinc-800/30 border border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-500 hover:text-zinc-300 text-xs">
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                }
              </div>
            </div>);

        })}
      </div>
    </div>);

}