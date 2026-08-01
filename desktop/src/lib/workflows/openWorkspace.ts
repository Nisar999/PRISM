/**
 * Beta Milestone 1 — Workflow 1: Open Workspace
 *
 * Sequences existing managers only. No new architecture.
 * Desktop renders; backend owns intelligence; adapter is the only editor bridge.
 */

import type { ExecutionEvent } from '../api';
import { workspaceManager, type ProjectData } from '../workspace';
import { memoryManager } from '../memory';
import { agentManager } from '../agent';
import { vscodeWorkspaceAdapter } from '@/editor';
import { executionStore, notificationStore, workspaceStore } from '../store';
import { graphEngine } from '../graph';
import { shellUiStore } from '../shellUi';
import { appNavigate } from '../appNavigation';
import {
  MOUNTED_WORKSPACE_URI,
  mountEditorWorkspace,
} from '../ensureEditorRuntime';
import { isNativeDesktop } from '../nativeFolder';
import { backendSessionId } from '../ids';

export interface OpenWorkspaceOptions {
  path: string;
  /** If project.json is missing, create then open. */
  createIfMissing?: { name: string; tags?: string[] };
  /**
   * Navigate to PRISM IDE (`/editor`) after open.
   * Default true — Open Workspace enters the IDE as one product surface.
   */
  openEditor?: boolean;
  /** Invoke agent for thoughts/summary (default true). */
  summarize?: boolean;
}

export interface OpenWorkspaceResult {
  project: ProjectData;
  sessionId: string;
  folderUri: string;
  memoryHits: number;
  summary: string | null;
  editorReady: boolean;
}

function folderUriForPath(path: string, mounted: boolean): string {
  // Packaged engine serves the folder via vscode-test-web FS provider mount.
  if (mounted) return MOUNTED_WORKSPACE_URI;
  const normalized = path.replace(/\\/g, '/');
  if (/^[a-zA-Z]:\//.test(normalized) || normalized.startsWith('/')) {
    return `file:///${normalized.replace(/^\/+/, '')}`;
  }
  // Relative sandbox path (browser mock FS)
  return `prism://workspace/${normalized}`;
}

function emit(sessionId: string, partial: Partial<ExecutionEvent> & Pick<ExecutionEvent, 'event_type' | 'message'>): void {
  const event: ExecutionEvent = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    task_id: null,
    tool_id: null,
    data: { workflow: 'open_workspace' },
    ...partial,
  };
  executionStore.handleRuntimeEvent(`runtime.${event.event_type}`, event);
  graphEngine.handleRuntimeEvent(event);
}

async function runStep(
  sessionId: string,
  taskId: string,
  label: string,
  tool: string,
  fn: () => Promise<void>,
): Promise<void> {
  emit(sessionId, {
    event_type: 'task_started',
    task_id: taskId,
    tool_id: tool,
    message: label,
  });
  try {
    await fn();
    emit(sessionId, {
      event_type: 'task_succeeded',
      task_id: taskId,
      tool_id: tool,
      message: `${label} · done`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit(sessionId, {
      event_type: 'task_failed',
      task_id: taskId,
      tool_id: tool,
      message: `${label} · ${message}`,
    });
    throw err;
  }
}

/**
 * End-to-end Open Workspace workflow.
 */
export async function runOpenWorkspaceWorkflow(
  options: OpenWorkspaceOptions,
): Promise<OpenWorkspaceResult> {
  const openEditor = options.openEditor !== false;
  const summarize = options.summarize !== false;
  const sessionId = `wf_open_${crypto.randomUUID().slice(0, 8)}`;

  executionStore.resetSession(sessionId);
  emit(sessionId, {
    event_type: 'session_created',
    message: 'Open Workspace workflow',
    state_to: 'PENDING',
  });
  emit(sessionId, {
    event_type: 'session_started',
    message: `Opening workspace at ${options.path}`,
    state_to: 'RUNNING',
  });
  executionStore.applyLocalPipelineState('RUNNING', sessionId);

  shellUiStore.setBottomTab('graph');
  shellUiStore.setRightTab('memory');

  let project: ProjectData;

  // 1–2. WorkspaceManager opens project
  await runStep(sessionId, 'wf.open_project', 'Open project', 'workspaceManager', async () => {
    try {
      project = await workspaceManager.loadProject(options.path);
    } catch (err) {
      if (!options.createIfMissing) throw err;
      await workspaceManager.createProject(
        options.path,
        options.createIfMissing.name,
        options.createIfMissing.tags ?? [],
      );
      project = await workspaceManager.loadProject(options.path);
    }
  });

  let folderUri = folderUriForPath(options.path, false);
  let editorReady = false;

  // 3–4. Mount local folder into the editing engine, then open PRISM IDE
  await runStep(sessionId, 'wf.open_editor', 'Open PRISM IDE', 'vscodeWorkspaceAdapter', async () => {
    if (await isNativeDesktop()) {
      try {
        const mount = await mountEditorWorkspace(options.path);
        if (mount?.folderUri) {
          folderUri = mount.folderUri;
        } else {
          folderUri = folderUriForPath(options.path, true);
        }
      } catch {
        folderUri = folderUriForPath(options.path, true);
      }
    } else {
      folderUri = folderUriForPath(options.path, false);
    }

    if (openEditor) {
      const q = new URLSearchParams({ folder: folderUri });
      appNavigate(`/editor?${q.toString()}`);
    }
    // Best-effort: if host already mounted, push openWorkspace; else EditorPage mounts host.
    try {
      const ready = await vscodeWorkspaceAdapter.waitUntilReady(45_000);
      if (ready) {
        await vscodeWorkspaceAdapter.openWorkspace({
          folderUri,
          name: project!.name,
        });
        editorReady = true;
      } else {
        editorReady = false;
      }
    } catch {
      editorReady = false;
    }
  });

  // 5. Memory searches for existing project context
  let memoryHits = 0;
  let memoryDigest = '';
  await runStep(sessionId, 'wf.memory_search', 'Search project memory', 'memoryManager', async () => {
    try {
      const query = `${project!.name} project workspace context`;
      const results = await memoryManager.search({ query, limit: 8 });
      memoryHits = results.length;
      memoryDigest = results
        .slice(0, 5)
        .map((r: { relevance_score: number; memory: { content: string } }) =>
          `- (${r.relevance_score.toFixed(2)}) ${r.memory.content.slice(0, 160)}`,
        )
        .join('\n');
      shellUiStore.setRightTab('memory');
    } catch (err) {
      // Soft-fail memory: workflow continues; status bar shows memory error via store.
      memoryHits = 0;
      memoryDigest = `(memory unreachable: ${err instanceof Error ? err.message : String(err)})`;
    }
  });

  // 6–7. Project summary + Thoughts panel (backend agent)
  let summary: string | null = null;
  if (summarize) {
    await runStep(sessionId, 'wf.project_summary', 'Project summary / thoughts', 'agentManager', async () => {
      try {
        const prompt = [
          `Open Workspace workflow — project summary.`,
          `Project: ${project!.name}`,
          `Path: ${options.path}`,
          `Tags: ${(project!.tags || []).join(', ') || 'none'}`,
          `Sessions: ${project!.sessions.length}`,
          `Memory hits (${memoryHits}):`,
          memoryDigest || '(none)',
          ``,
          `Provide a short project summary and initial thoughts for continuing work.`,
        ].join('\n');

        const response = await agentManager.invoke(
          {
            message: prompt,
            session_id: backendSessionId(sessionId),
          },
          { resetExecution: false },
        );
        summary = response.final_answer || response.reasoning || null;
        shellUiStore.setRightTab('thoughts');
      } catch {
        // Soft-fail agent: memory + workspace still open.
        summary = null;
      }
    });
  }

  // Link workflow steps on the graph (linear DAG)
  const stepIds = [
    'wf.open_project',
    'wf.open_editor',
    'wf.memory_search',
    ...(summarize ? ['wf.project_summary'] : []),
  ];
  for (let i = 0; i < stepIds.length - 1; i++) {
    graphEngine.setEdge({
      id: `e_${stepIds[i]}_${stepIds[i + 1]}`,
      source: stepIds[i],
      target: stepIds[i + 1],
      type: 'flow',
    });
  }

  emit(sessionId, {
    event_type: 'session_succeeded',
    message: `Workspace "${project!.name}" open`,
    state_to: 'SUCCEEDED',
  });
  executionStore.applyLocalPipelineState('SUCCEEDED', sessionId);

  notificationStore.addNotification({
    type: 'success',
    message: 'Workspace Ready',
    description: `${project!.name} · memory ${memoryHits} hit(s) · editor ${editorReady ? 'ready' : 'loading'}`,
  });

  // Ensure store still points at project (agent resetSession may have changed execution only)
  const active = workspaceStore.getSnapshot().activeProject;
  if (!active || active.id !== project!.id) {
    workspaceStore.setActiveProject({
      id: project!.id,
      name: project!.name,
      path: options.path,
      tags: project!.tags,
    });
  }

  try {
    const { rememberWorkspacePath } = await import('../sessionRestore');
    await rememberWorkspacePath(options.path);
  } catch {
    /* persistence soft-fail */
  }

  return {
    project: project!,
    sessionId,
    folderUri,
    memoryHits,
    summary,
    editorReady,
  };
}
