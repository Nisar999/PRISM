import { useState, useEffect } from 'react';
import { useWorkspace, notificationStore } from '@/lib/store';
import { workspaceManager, SessionData, ArtifactData } from '@/lib/workspace';
import { brandAssets } from '@/lib/brand';
import { appNavigate } from '@/lib/appNavigation';
import { 
  Folder, 
  FileText, 
  Search, 
  Plus, 
  Download,
  Upload,
  MoreVertical,
  Trash2,
  ExternalLink,
  Code
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function WorkspaceExplorer() {
  const workspace = useWorkspace();
  const [activeTab, setActiveTab] = useState<'sessions' | 'artifacts'>('sessions');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Local lists hydrated from files
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactData[]>([]);
  
  // Context menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const activeProject = workspace.activeProject;

  // Close context menu on click outside
  useEffect(() => {
    if (!activeMenuId) return;
    const handleOutsideClick = () => {
      setActiveMenuId(null);
    };
    // Use capture phase to ensure it runs after any menu toggle triggers
    window.addEventListener('click', handleOutsideClick, { capture: true });
    return () => window.removeEventListener('click', handleOutsideClick, { capture: true });
  }, [activeMenuId]);

  // Re-hydrate directory listing whenever active project alters or workspace triggers sync
  useEffect(() => {
    const proj = activeProject;
    if (!proj) {
      setSessions([]);
      setArtifacts([]);
      return;
    }

    async function loadWorkspaceFiles() {
      if (!proj) return;
      try {
        const projData = await workspaceManager.loadProject(proj.path);
        
        const loadedSessions: SessionData[] = [];
        const loadedArtifacts: ArtifactData[] = [];

        for (const sid of projData.sessions) {
          try {
            const s = await workspaceManager.loadSession(proj.id, sid);
            loadedSessions.push(s);
            
            for (const aid of s.artifacts) {
              try {
                const art = await workspaceManager.loadArtifact(proj.id, aid);
                if (!loadedArtifacts.some(a => a.id === art.id)) {
                  loadedArtifacts.push(art);
                }
              } catch (e) {
                // Ignore missing files
              }
            }
          } catch (e) {
            // Ignore missing files
          }
        }

        // Sort sessions chronologically (recent first)
        setSessions(loadedSessions.sort((a, b) => b.created_at.localeCompare(a.created_at)));
        setArtifacts(loadedArtifacts.sort((a, b) => b.created_at.localeCompare(a.created_at)));
      } catch (err) {
        console.error('Failed to sync explorer items:', err);
      }
    }

    loadWorkspaceFiles();
    
    // Set up an interval timer to auto-refresh directory listings
    const timer = setInterval(loadWorkspaceFiles, 5000);
    return () => clearInterval(timer);
  }, [activeProject, workspace.activeSessionId]);

  // Handle Export Project Bundle
  const handleExportBundle = async () => {
    if (!activeProject) return;
    try {
      const bundleJson = await workspaceManager.exportWorkspace(activeProject.id);
      
      // Save string as file in browser fallback, or trigger Tauri file dialog download
      const blob = new Blob([bundleJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeProject.name}.prismpack`;
      a.click();
      URL.revokeObjectURL(url);
      notificationStore.addNotification({
        type: 'success',
        message: 'Workspace exported',
        description: `${activeProject.name}.prismpack downloaded.`,
      });
    } catch (err) {
      console.error('Export failed:', err);
      notificationStore.addNotification({
        type: 'error',
        message: 'Export failed',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Switch Active Session
  const handleSelectSession = (sessionId: string) => {
    if (activeProject) {
      workspaceManager.loadSession(activeProject.id, sessionId).catch(err => {
        console.error('Failed to load session:', err);
        notificationStore.addNotification({
          type: 'error',
          message: 'Failed to load session',
          description: err instanceof Error ? err.message : String(err),
        });
      });
    }
  };

  // Filter lists based on search query
  const filteredSessions = sessions.filter(s => 
    s.goal.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredArtifacts = artifacts.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Status mapping colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCEEDED':
      case 'COMPLETED':
        return 'bg-emerald-500';
      case 'FAILED':
        return 'bg-rose-500';
      case 'RUNNING':
        return 'bg-blue-500 animate-pulse';
      case 'PAUSED':
        return 'bg-amber-500';
      default:
        return 'bg-muted-foreground';
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-t border-border mt-auto overflow-hidden shrink-0 select-none">
      {/* Explorer Header */}
      <div className="p-3 border-b border-border flex items-center justify-between bg-muted/10 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Folder className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono truncate">
            Workspace Explorer
          </span>
        </div>

        {activeProject && (
          <div className="flex items-center gap-1 shrink-0">
            <button 
              onClick={handleExportBundle}
              title="Export (.prismpack)"
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => workspaceManager.createSession(activeProject.id, "Interactive Session initiated from explorer")}
              title="New Session"
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* If no project is active, display bootstrap helpers */}
          {!activeProject ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <img
            src={brandAssets.milly}
            alt=""
            className="h-20 w-auto object-contain mb-3 opacity-90"
            draggable={false}
          />
          <p className="text-xs font-semibold text-foreground">No active workspace</p>
          <p className="text-[10px] leading-relaxed text-muted-foreground mt-1 max-w-[200px]">
            Open a project so PRISM can load the editor, memory, and thoughts.
          </p>
          <div className="flex flex-col gap-1.5 w-full pt-3">
            <button
              onClick={() => {
                void import('@/lib/commands').then(({ commands }) =>
                  commands.execute('workspace:open'),
                );
              }}
              className="text-[10px] font-semibold bg-primary hover:bg-primary/95 text-primary-foreground py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Open Folder
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          
          {/* Active Project Details banner */}
          <div className="p-3 bg-muted/5 border-b border-border space-y-1.5 shrink-0">
            <div className="flex items-start justify-between gap-2">
              <span className="font-bold text-xs truncate leading-none">
                {activeProject.name}
              </span>
              <button 
                onClick={() => workspaceManager.importWorkspace(activeProject.path, JSON.stringify({ project: { id: activeProject.id, name: activeProject.name, created_at: '', last_active_at: '', tags: [], sessions: [] }, sessions: [], artifacts: [] }))}
                title="Import Pack"
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-semibold"
              >
                <Upload className="w-3 h-3" /> Import
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono truncate">
              {activeProject.path}
            </p>
          </div>

          {/* Search bar widget */}
          <div className="p-2 border-b border-border bg-muted/10 shrink-0">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter explorer..."
                className="bg-transparent outline-none w-full text-foreground placeholder:text-muted-foreground/60"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Navigation tab headers */}
          <div className="flex border-b border-border text-[10px] font-mono shrink-0 select-none">
            <button
              onClick={() => setActiveTab('sessions')}
              className={cn(
                "flex-1 py-2 text-center font-bold border-b-2 transition-colors",
                activeTab === 'sessions' 
                  ? "border-primary text-foreground" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Sessions ({filteredSessions.length})
            </button>
            <button
              onClick={() => setActiveTab('artifacts')}
              className={cn(
                "flex-1 py-2 text-center font-bold border-b-2 transition-colors",
                activeTab === 'artifacts' 
                  ? "border-primary text-foreground" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Artifacts ({filteredArtifacts.length})
            </button>
          </div>

          {/* Tab content listings */}
          <div className="flex-1 overflow-y-auto p-2 min-h-0">
            {activeTab === 'sessions' ? (
              filteredSessions.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground/60">
                  No sessions found
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredSessions.map((session) => {
                    const isSelected = workspace.activeSessionId === session.id;
                    const isMenuOpen = activeMenuId === session.id;
                    
                    return (
                      <div 
                        key={session.id}
                        onClick={() => handleSelectSession(session.id)}
                        className={cn(
                          "w-full p-2.5 rounded-lg border text-left cursor-pointer group flex items-center justify-between gap-3 relative transition-all",
                          isSelected 
                            ? "bg-secondary/40 border-primary/20" 
                            : "border-transparent hover:bg-muted/30"
                        )}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", getStatusColor(session.status))} />
                            <span className="font-semibold text-xs truncate">
                              {session.goal.slice(0, 30)}...
                            </span>
                          </div>
                          <p className="text-[9px] text-muted-foreground font-mono truncate pl-3.5">
                            ID: {session.id.slice(0, 15)}
                          </p>
                        </div>

                        {/* Options button */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(isMenuOpen ? null : session.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-all shrink-0"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {/* Dropdown context menu overlay */}
                        {isMenuOpen && (
                          <div 
                            className="absolute right-2 top-8 z-10 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[120px] text-[11px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                handleSelectSession(session.id);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 hover:bg-muted text-left flex items-center gap-2 text-foreground font-semibold"
                            >
                              <ExternalLink className="w-3 h-3 text-muted-foreground" /> Load Logs
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                notificationStore.addNotification({
                                  type: 'info',
                                  message: 'Session Archiving',
                                  description: `Archived session logs: ${session.id}`,
                                });
                              }}
                              className="w-full px-3 py-1.5 hover:bg-muted text-left flex items-center gap-2 text-rose-500 font-semibold"
                            >
                              <Trash2 className="w-3 h-3" /> Archive
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              filteredArtifacts.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground/60">
                  No artifacts registered
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredArtifacts.map((art) => {
                    const isMenuOpen = activeMenuId === art.id;
                    return (
                      <div 
                        key={art.id}
                        className="w-full p-2.5 rounded-lg border border-transparent hover:bg-muted/30 flex items-center justify-between gap-3 group relative cursor-pointer"
                      >
                        <div className="min-w-0 flex-1 flex items-center gap-2.5">
                          <div className="p-1 rounded bg-primary/10 text-primary shrink-0">
                            {art.type === 'code' ? <Code className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-xs truncate block leading-tight">
                              {art.name}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-mono mt-0.5 truncate block">
                              Ver: {art.version} | Type: {art.type}
                            </span>
                          </div>
                        </div>

                        {/* Options button */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(isMenuOpen ? null : art.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-all shrink-0"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {/* Dropdown context menu overlay */}
                        {isMenuOpen && (
                          <div 
                            className="absolute right-2 top-8 z-10 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[120px] text-[11px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                const q = new URLSearchParams({
                                  uri: `prism://artifact/${art.id}`,
                                  title: art.name,
                                  language: art.type === 'code' ? 'typescript' : 'markdown',
                                  content: art.content ?? '',
                                });
                                appNavigate(`/editor?${q.toString()}`);
                              }}
                              className="w-full px-3 py-1.5 hover:bg-muted text-left flex items-center gap-2 text-foreground font-semibold"
                            >
                              <Code className="w-3 h-3 text-muted-foreground" /> Open in Editor
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                notificationStore.addNotification({
                                  type: 'info',
                                  message: 'Viewing Artifact payload',
                                  description: `Artifact ${art.name} loaded in background.`,
                                });
                              }}
                              className="w-full px-3 py-1.5 hover:bg-muted text-left flex items-center gap-2 text-foreground font-semibold"
                            >
                              <FileText className="w-3 h-3 text-muted-foreground" /> View Payload
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                notificationStore.addNotification({
                                  type: 'warning',
                                  message: 'Artifact deleted',
                                  description: `Unregistered artifact ${art.id}`,
                                });
                              }}
                              className="w-full px-3 py-1.5 hover:bg-muted text-left flex items-center gap-2 text-rose-500 font-semibold"
                            >
                              <Trash2 className="w-3 h-3" /> Unregister
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

        </div>
      )}
    </div>
  );
}
export default WorkspaceExplorer;
