import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { KanbanBoard } from '../components/KanbanBoard';
import { ChatPanel } from '../components/ChatPanel';
import { LiveTab } from '../components/LiveTab';
import { CodeTab } from '../components/CodeTab';
import { useProjects } from '../hooks/useProjects';
import { TabOption } from '../types';
import { TerminalIcon } from 'lucide-react';
export function MissionControl() {
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    activeProject,
    moveTask,
    addMessage,
    mainChatMessages,
    addMainChatMessage
  } = useProjects();
  const [activeTab, setActiveTab] = useState<TabOption>('project');
  const [chatPercent, setChatPercent] = useState(60);
  const [isDragging, setIsDragging] = useState(false);
  const [isChatView, setIsChatView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const percent = (rect.height - y) / rect.height * 100;
      setChatPercent(Math.min(85, Math.max(15, percent)));
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);
  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    setIsChatView(false);
  };
  const handleSelectChat = () => {
    setIsChatView(true);
  };
  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Fixed Sidebar */}
      <Sidebar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={handleSelectProject}
        isChatActive={isChatView}
        onSelectChat={handleSelectChat}
        chatPreview={
        mainChatMessages.length > 0 ?
        mainChatMessages[mainChatMessages.length - 1].content.slice(
          0,
          60
        ) + (
        mainChatMessages[mainChatMessages.length - 1].content.length > 60 ?
        '…' :
        '') :
        undefined
        } />


      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {isChatView ?
        <>
            {/* Chat View Header */}
            <header className="h-16 border-b border-zinc-800 bg-zinc-950 flex items-center px-6 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <TerminalIcon className="w-5 h-5 text-zinc-400" />
                <h1 className="text-lg font-semibold text-zinc-100 leading-tight">
                  Chat
                </h1>
              </div>
            </header>

            {/* Full Chat */}
            <main className="flex-1 flex flex-col overflow-hidden">
              <ChatPanel
              messages={mainChatMessages}
              onSendMessage={addMainChatMessage}
              style={{
                flex: 1
              }} />

            </main>
          </> :

        <>
            <TopBar
            project={activeProject}
            activeTab={activeTab}
            onTabChange={setActiveTab} />


            {/* Tab Content */}
            <main
            ref={containerRef}
            className="flex-1 flex flex-col overflow-hidden relative">

              {activeTab === 'project' &&
            <>
                  <div
                className="flex-1 min-h-0 overflow-hidden"
                style={{
                  flexBasis: `${100 - chatPercent}%`
                }}>

                    <KanbanBoard
                  tasks={activeProject.tasks}
                  onMoveTask={moveTask} />

                  </div>

                  {/* Resize Handle */}
                  <div
                onMouseDown={handleMouseDown}
                className={`w-full h-0 border-t border-zinc-800 hover:border-zinc-600 cursor-row-resize relative z-10 ${isDragging ? 'border-zinc-600' : ''}`}
                style={{
                  margin: '-2px 0',
                  padding: '2px 0'
                }} />


                  <ChatPanel
                messages={activeProject.messages}
                onSendMessage={addMessage}
                style={{
                  flexBasis: `${chatPercent}%`
                }} />

                </>
            }

              {activeTab === 'live' && <LiveTab project={activeProject} />}

              {activeTab === 'code' && <CodeTab project={activeProject} />}
            </main>
          </>
        }
      </div>

      {/* Drag overlay to prevent text selection */}
      {isDragging && <div className="fixed inset-0 z-50 cursor-row-resize" />}
    </div>);

}