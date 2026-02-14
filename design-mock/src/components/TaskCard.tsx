import React, { useState } from 'react';
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GripVerticalIcon } from
'lucide-react';
import { Task } from '../types';
interface TaskCardProps {
  task: Task;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
}
export function TaskCard({ task, onDragStart }: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFindingsOpen, setIsFindingsOpen] = useState(true);
  return (
    <div
      className={`
        group relative bg-zinc-800/30 border border-zinc-800 rounded-md overflow-hidden cursor-pointer
        ${isExpanded ? 'ring-1 ring-zinc-700 shadow-lg shadow-black/20' : 'hover:bg-zinc-900 hover:border-zinc-700'}
      `}
      onClick={() => setIsExpanded(!isExpanded)}
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}>

      {/* Drag Handle (visible on hover) */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-zinc-600 cursor-grab active:cursor-grabbing">
        <GripVerticalIcon className="w-4 h-4" />
      </div>

      <div className="p-3 min-h-[100px]">
        {/* Header / Title */}
        <div className="flex items-start justify-between pr-6">
          <h4
            className={`text-sm text-zinc-200 leading-snug ${isExpanded ? 'font-medium' : 'font-normal'}`}>

            {task.title}
          </h4>
        </div>

        {/* Preview text (collapsed only) */}
        {!isExpanded && task.description &&
        <p className="text-xs text-zinc-500 leading-relaxed mt-2 line-clamp-2">
            {task.description}
          </p>
        }

        {/* Expanded Content */}
        {isExpanded &&
        <div className="overflow-hidden">
            <div className="pt-3 space-y-4">
              {/* Description */}
              <p className="text-xs text-zinc-400 leading-relaxed">
                {task.description}
              </p>

              {/* Steps for you (Alert) */}
              {task.steps && task.steps.length > 0 &&
            <div className="bg-yellow-500/5 border-l-2 border-yellow-500/50 p-3 rounded-r-sm">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangleIcon className="w-3 h-3 text-yellow-500" />
                    <span className="text-xs font-medium text-yellow-500 uppercase tracking-wide">
                      Steps for you
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {task.steps.map((step, idx) =>
                <li
                  key={idx}
                  className="text-xs text-zinc-300 flex items-start">

                        <span className="mr-2 text-zinc-600">•</span>
                        {step}
                      </li>
                )}
                  </ul>
                </div>
            }

              {/* Findings (Collapsible) */}
              {task.findings && task.findings.length > 0 &&
            <div className="border-t border-zinc-800/50 pt-2">
                  <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFindingsOpen(!isFindingsOpen);
                }}
                className="flex items-center space-x-1 text-xs text-zinc-500 hover:text-zinc-300 mb-2">

                    {isFindingsOpen ?
                <ChevronDownIcon className="w-3 h-3" /> :

                <ChevronRightIcon className="w-3 h-3" />
                }
                    <span className="font-mono uppercase tracking-wider text-[10px]">
                      Findings
                    </span>
                  </button>

                  {isFindingsOpen &&
              <ul className="space-y-1 pl-1">
                      {task.findings.map((finding, idx) =>
                <li
                  key={idx}
                  className="text-xs text-zinc-400 flex items-start font-mono">

                          <span className="mr-2 text-zinc-700">-</span>
                          {finding}
                        </li>
                )}
                    </ul>
              }
                </div>
            }

              {/* Meta footer */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
                <span
                className={`text-[10px] px-1.5 py-0.5 rounded border ${task.priority === 'high' ? 'border-red-500/20 text-red-400 bg-red-500/5' : task.priority === 'medium' ? 'border-blue-500/20 text-blue-400 bg-blue-500/5' : 'border-zinc-700 text-zinc-500 bg-zinc-800/50'} uppercase tracking-wider`}>

                  {task.priority}
                </span>
                <span className="text-[10px] text-zinc-600 font-mono">
                  ID-{task.id}
                </span>
              </div>
            </div>
          </div>
        }
      </div>
    </div>);

}