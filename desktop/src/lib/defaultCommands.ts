import { appNavigate } from './appNavigation';
import { commands } from './commands';
import { api } from './api';
import { workspaceStore, notificationStore } from './store';
import { memoryManager } from './memory';
import { shellUiStore } from './shellUi';
import { authService } from './auth';

/**
 * Register the default core commands for PRISM.
 */
export function registerDefaultCommands(): void {
  // --- Navigation Commands ---
  commands.register({
    id: 'navigation:dashboard',
    name: 'View Dashboard',
    description: 'Go to the core cognitive pipeline dashboard',
    category: 'navigation',
    aliases: ['dash', 'home'],
    shortcuts: ['mod+shift+d'],
    action: () => {
      appNavigate('/');
    }
  });

  commands.register({
    id: 'navigation:memory',
    name: 'View Memory',
    description: 'Open the Memory surface',
    category: 'navigation',
    aliases: ['goto-memory'],
    action: () => {
      appNavigate('/memory');
    }
  });

  commands.register({
    id: 'navigation:execution',
    name: 'View Execution',
    description: 'Open the Execution graph surface',
    category: 'navigation',
    aliases: ['goto-execution', 'graph'],
    action: () => {
      appNavigate('/execution');
    }
  });

  commands.register({
    id: 'navigation:editor',
    name: 'View Editor',
    description: 'Open the Code-OSS editing engine (Explorer, Tabs, Terminal, Problems, Search)',
    category: 'navigation',
    aliases: ['goto-editor', 'code'],
    action: () => {
      shellUiStore.setActivity('editor');
      appNavigate('/editor');
    }
  });

  commands.register({
    id: 'navigation:settings',
    name: 'View Settings',
    description: 'Go to PRISM configuration and settings panel',
    category: 'navigation',
    aliases: ['config', 'preferences'],
    shortcuts: ['mod+,'],
    action: () => {
      appNavigate('/settings');
    }
  });

  commands.register({
    id: 'view:prism',
    name: 'Open PRISM View',
    description: 'Open Milly PRISM View as a center editor tab',
    category: 'navigation',
    aliases: ['prism-view', 'milly-prism'],
    action: () => {
      workspaceStore.openPane('prism');
      appNavigate('/views/prism');
    },
  });

  commands.register({
    id: 'view:globe',
    name: 'Open Globe View',
    description: 'Open Milly Globe View as a center editor tab',
    category: 'navigation',
    aliases: ['globe-view', 'milly-globe'],
    action: () => {
      workspaceStore.openPane('globe');
      appNavigate('/views/globe');
    },
  });

  // --- Editor (Workspace Adapter) ---
  commands.register({
    id: 'editor:open-sample',
    name: 'Open Sample File in Editor',
    description: 'Prove the Workspace Adapter by opening a sample buffer',
    category: 'editor',
    aliases: ['sample-file', 'demo-editor'],
    action: () => {
      const uri = 'prism://sample/hello.ts';
      const content = [
        '// PRISM Workspace Adapter — sample buffer',
        "export function greet(name: string): string {",
        "  return `Hello, ${name} — from the editing engine.`;",
        '}',
        '',
      ].join('\n');
      const q = new URLSearchParams({
        uri,
        title: 'hello.ts',
        language: 'typescript',
        content,
      });
      appNavigate(`/editor?${q.toString()}`);
    },
  });

  // --- Workspace Commands (local desktop ownership — no backend workspace API) ---
  commands.register({
    id: 'workspace:open',
    name: 'Open Folder',
    description: 'Open a folder as the active workspace (native dialog on desktop)',
    category: 'workspace',
    aliases: ['open-workspace', 'open-project', 'open-folder'],
    shortcuts: ['mod+o'],
    action: async () => {
      const { pickWorkspaceFolder } = await import('./nativeFolder');
      const path = await pickWorkspaceFolder(
        workspaceStore.getSnapshot().activeProject?.path ??
          undefined,
      );
      if (!path?.trim()) {
        notificationStore.addNotification({
          type: 'warning',
          message: 'Open Folder Cancelled',
          description: 'No folder selected.',
        });
        return;
      }
      const { runOpenWorkspaceWorkflow } = await import('./workflows/openWorkspace');
      return runOpenWorkspaceWorkflow({
        path: path.trim(),
        createIfMissing: {
          name: path.trim().split(/[/\\]/).filter(Boolean).pop() || 'Workspace',
          tags: ['opened'],
        },
      });
    },
  });

  commands.register({
    id: 'workspace:open-path',
    name: 'Open Folder Path',
    description: 'Open a workspace at a known path (recent / drag-drop)',
    category: 'workspace',
    aliases: ['open-path'],
    action: async (path?: string) => {
      const folder =
        typeof path === 'string' && path.trim()
          ? path.trim()
          : null;
      if (!folder) return;
      const { runOpenWorkspaceWorkflow } = await import('./workflows/openWorkspace');
      return runOpenWorkspaceWorkflow({
        path: folder,
        createIfMissing: {
          name: folder.split(/[/\\]/).filter(Boolean).pop() || 'Workspace',
          tags: ['opened'],
        },
      });
    },
  });

  commands.register({
    id: 'workspace:new-project',
    name: 'Create New Project',
    description: 'Pick an empty folder and initialize it as a new local project workspace',
    category: 'workspace',
    aliases: ['new', 'create-project'],
    shortcuts: ['mod+n'],
    action: async () => {
      const { pickWorkspaceFolder } = await import('./nativeFolder');
      const path = await pickWorkspaceFolder(
        workspaceStore.getSnapshot().activeProject?.path ?? undefined,
      );
      if (!path?.trim()) {
        notificationStore.addNotification({
          type: 'info',
          message: 'New Project Cancelled',
          description: 'No folder selected.',
        });
        return;
      }
      const name = path.trim().split(/[/\\]/).filter(Boolean).pop() || 'New Project';
      const { runOpenWorkspaceWorkflow } = await import('./workflows/openWorkspace');
      return runOpenWorkspaceWorkflow({
        path: path.trim(),
        createIfMissing: { name, tags: ['new'] },
      });
    },
  });

  commands.register({
    id: 'workspace:close-project',
    name: 'Close Active Project',
    description: 'Unbind and close the current project workspace',
    category: 'workspace',
    aliases: ['close', 'exit-project'],
    contextCondition: (ctx) => !!ctx.activeProjectId,
    action: async () => {
      workspaceStore.setActiveProject(null);
      workspaceStore.setActiveSession(null);
      const { clearLastWorkspace } = await import('./sessionRestore');
      await clearLastWorkspace();
      appNavigate('/');
      notificationStore.addNotification({
        type: 'warning',
        message: 'Project Closed',
        description: 'Workspace context boundary cleared.',
      });
    }
  });

  // --- Agent / Memory (backend-owned) ---
  commands.register({
    id: 'navigation:conversation',
    name: 'Open Conversation',
    description: 'Ask PRISM — workspace-scoped conversation engine',
    category: 'navigation',
    aliases: ['goto-conversation', 'ask', 'chat'],
    shortcuts: ['mod+shift+c'],
    action: () => {
      appNavigate('/conversation');
    },
  });

  commands.register({
    id: 'navigation:review',
    name: 'Open Code Review',
    description: 'Review pending unified diffs before apply',
    category: 'navigation',
    aliases: ['goto-review', 'code-review', 'diff-review'],
    shortcuts: ['mod+shift+r'],
    action: () => {
      appNavigate('/review');
    },
  });

  commands.register({
    id: 'agent:invoke',
    name: 'Ask PRISM (Conversation)',
    description: 'Open Conversation or send a prompt through the conversation engine',
    category: 'execution',
    aliases: ['agent', 'invoke', 'ask-agent'],
    action: async () => {
      appNavigate('/conversation');
    },
  });

  commands.register({
    id: 'memory:search',
    name: 'Search Memory Engine',
    description: 'Call backend POST /memory/search',
    category: 'memory',
    aliases: ['recall', 'search-memory'],
    action: async () => {
      const query =
        typeof window !== 'undefined'
          ? window.prompt('Memory search query:', '')
          : null;
      if (!query?.trim()) {
        notificationStore.addNotification({
          type: 'warning',
          message: 'Memory Search Cancelled',
          description: 'No query provided.',
        });
        return;
      }
      const results = await memoryManager.search({ query: query.trim(), limit: 10 });
      notificationStore.addNotification({
        type: 'success',
        message: 'Memory Search Complete',
        description: `Backend returned ${results.length} result(s).`,
      });
      return results;
    }
  });

  // --- Execution (WS-driven; pause/resume REST not exposed) ---
  commands.register({
    id: 'execution:pause',
    name: 'Pause Active Execution',
    description: 'Requires backend execution control API (not exposed yet)',
    category: 'execution',
    aliases: ['pause', 'stop-runtime'],
    shortcuts: ['mod+space'],
    contextCondition: (ctx) => !!ctx.hasActiveExecution,
    action: () => {
      notificationStore.addNotification({
        type: 'warning',
        message: 'Pause Unavailable',
        description: 'No REST endpoint for ExecutionRuntime.pause — see docs/API_SURFACE.md.',
      });
    }
  });

  commands.register({
    id: 'execution:resume',
    name: 'Resume Active Execution',
    description: 'Requires backend execution control API (not exposed yet)',
    category: 'execution',
    aliases: ['play', 'resume-runtime'],
    contextCondition: (ctx) => !ctx.hasActiveExecution && !!ctx.activeSessionId,
    action: () => {
      notificationStore.addNotification({
        type: 'warning',
        message: 'Resume Unavailable',
        description: 'No REST endpoint for ExecutionRuntime.resume — see docs/API_SURFACE.md.',
      });
    }
  });

  // --- System Commands ---
  commands.register({
    id: 'system:check-health',
    name: 'Check Kernel Health',
    description: 'GET /api/v1/health',
    category: 'system',
    aliases: ['status', 'ping'],
    shortcuts: ['mod+shift+h'],
    action: async () => {
      try {
        const health = await api.getHealth();
        notificationStore.addNotification({
          type: 'success',
          message: 'Kernel Health OK',
          description: `status=${health.status} version=${health.version} env=${health.environment}`,
        });
        return health;
      } catch (err) {
        notificationStore.addNotification({
          type: 'error',
          message: 'Kernel Connection Failed',
          description: 'No response from http://127.0.0.1:8000/api/v1/health',
        });
        throw err;
      }
    }
  });

  commands.register({
    id: 'system:check-ready',
    name: 'Check Backend Readiness',
    description: 'GET /api/v1/ready (storage backends)',
    category: 'system',
    aliases: ['ready'],
    action: async () => {
      try {
        const ready = await api.getReady();
        notificationStore.addNotification({
          type: ready.ready ? 'success' : 'warning',
          message: ready.ready ? 'Backend Ready' : 'Backend Not Ready',
          description: Object.entries(ready.checks)
            .map(([k, v]) => `${k}=${v}`)
            .join(', '),
        });
        return ready;
      } catch (err) {
        notificationStore.addNotification({
          type: 'error',
          message: 'Readiness Check Failed',
          description: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }
  });

  commands.register({
    id: 'system:reload-window',
    name: 'Reload Interface',
    description: 'Force a complete reload of the desktop UI client',
    category: 'system',
    aliases: ['reload', 'refresh'],
    action: () => {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  });

  commands.register({
    id: 'system:open-palette',
    name: 'Open Command Palette',
    description: 'Open the global command search palette overlay',
    category: 'system',
    aliases: ['palette', 'cmd-palette', 'search-commands'],
    shortcuts: ['mod+k', 'mod+p'],
    action: () => {
      commands.togglePalette(true);
    }
  });

  commands.register({
    id: 'shell:new-agent',
    name: 'New Agent',
    description: 'Open conversation / agent panel',
    category: 'navigation',
    shortcuts: ['mod+shift+l'],
    action: () => {
      shellUiStore.setActivity('agent');
      shellUiStore.setRightTab('chat');
      appNavigate('/conversation');
    },
  });

  commands.register({
    id: 'shell:show-terminal',
    name: 'Show Terminal',
    description: 'Toggle the bottom terminal / output dock',
    category: 'system',
    shortcuts: ['mod+j'],
    action: () => {
      shellUiStore.setBottomTab('output');
    },
  });

  commands.register({
    id: 'shell:add-folder',
    name: 'Add Folder',
    description: 'Open a workspace folder',
    category: 'workspace',
    shortcuts: ['mod+alt+a'],
    action: async () => commands.execute('workspace:open'),
  });

  // --- Authentication Commands ---
  commands.register({
    id: 'auth:logout',
    name: 'Sign Out',
    description: 'Clear the local session and return to the login screen',
    category: 'system',
    aliases: ['logout', 'sign-out'],
    action: async () => {
      await authService.logout();
      // Force a full reload so the splash gate re-evaluates the (now empty) session.
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    },
  });

  commands.register({
    id: 'auth:refresh-session',
    name: 'Refresh Session',
    description: 'Extend the current local session expiry',
    category: 'system',
    action: async () => authService.refreshSession(),
  });
}

export default registerDefaultCommands;
