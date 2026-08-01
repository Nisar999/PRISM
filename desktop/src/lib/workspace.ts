import { workspaceStore, notificationStore, ProjectMetadata } from './store';

// --- Type Definitions matching the Workspace System canonical document ---

export interface ProjectData {
  id: string;
  name: string;
  created_at: string;
  last_active_at: string;
  tags: string[];
  sessions: string[]; // List of session IDs
}

export interface SessionData {
  id: string;
  project_id: string;
  goal: string;
  status:
    | 'PENDING'
    | 'QUEUED'
    | 'RUNNING'
    | 'PAUSED'
    | 'RETRYING'
    | 'SUCCEEDED'
    | 'FAILED'
    | 'CANCELLED'
    | 'COMPLETED';
  created_at: string;
  updated_at: string;
  tasks: any[];
  artifacts: string[]; // List of artifact IDs
}

export interface ArtifactData {
  id: string;
  session_id: string;
  name: string;
  type: string;
  content: string;
  version: number;
  created_at: string;
  parent_id?: string; // For tracking version provenance
}

export interface WorkspaceBundle {
  project: ProjectData;
  sessions: SessionData[];
  artifacts: ArtifactData[];
}

async function checkIsTauri(): Promise<boolean> {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
}

async function tauriInvoke<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  const isTauri = await checkIsTauri();
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(cmd, args);
  }
  
  // Browser sandbox mock FS using LocalStorage
  return mockBrowserFs(cmd, args) as unknown as T;
}

// In-Memory fallback store to prevent compilation issues and support browser testing
const mockFsRegistry: Record<string, string> = {};

function mockBrowserFs(cmd: string, args: Record<string, any>): any {
  const path = args.path || '';
  switch (cmd) {
    case 'read_file_string': {
      const data = mockFsRegistry[path] || localStorage.getItem(`fs:${path}`);
      if (data === null || data === undefined) {
        throw new Error(`File not found: ${path}`);
      }
      return data;
    }
    case 'write_file_string': {
      const content = args.content || '';
      mockFsRegistry[path] = content;
      localStorage.setItem(`fs:${path}`, content);
      return null;
    }
    case 'create_dir_all':
      return null;
    case 'read_dir_contents': {
      const keys = Object.keys(localStorage);
      const prefix = `fs:${path}`;
      const files = keys
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length).split('/')[1])
        .filter(Boolean);
      return Array.from(new Set(files));
    }
    default:
      throw new Error(`Unknown mock FS command: ${cmd}`);
  }
}

// --- WorkspaceManager Implementation ---

class WorkspaceManager {
  /**
   * Helper to construct paths standardly
   */
  private getPath(...parts: string[]): string {
    if (parts.length === 0) return '';
    const [head, ...rest] = parts;
    const base = (head ?? '').replace(/[/\\]+$/, '');
    const tail = rest
      .map((p) => p.replace(/^[/\\]+/, '').replace(/[/\\]+$/, ''))
      .filter(Boolean);
    // Prefer forward slashes — Windows APIs and Tauri accept them; avoids mixed separators.
    return [base, ...tail].join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
  }

  /**
   * Create a new Project workspace at the specified path.
   */
  public async createProject(path: string, name: string, tags: string[] = []): Promise<ProjectData> {
    const projectId = Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();
    
    const project: ProjectData = {
      id: projectId,
      name,
      created_at: now,
      last_active_at: now,
      tags,
      sessions: [],
    };

    const projectFilePath = this.getPath(path, 'project.json');
    
    try {
      await tauriInvoke('create_dir_all', { path });
      await tauriInvoke('create_dir_all', { path: this.getPath(path, 'sessions') });
      await tauriInvoke('create_dir_all', { path: this.getPath(path, 'artifacts') });
      
      await tauriInvoke('write_file_string', {
        path: projectFilePath,
        content: JSON.stringify(project, null, 2),
      });

      // Synchronize changes to store
      const meta: ProjectMetadata = { id: projectId, name, path, tags };
      workspaceStore.setActiveProject(meta);
      
      notificationStore.addNotification({
        type: 'success',
        message: 'Workspace Ready',
        description: `Project "${name}" is initialized at ${path}.`,
      });

      return project;
    } catch (err: any) {
      console.error('Failed to create project:', err);
      notificationStore.addNotification({
        type: 'error',
        message: 'Project Creation Failed',
        description: err.message || String(err),
      });
      throw err;
    }
  }

  /**
   * Load an existing Project from its path.
   */
  public async loadProject(path: string): Promise<ProjectData> {
    const projectFilePath = this.getPath(path, 'project.json');
    
    try {
      const content = await tauriInvoke<string>('read_file_string', { path: projectFilePath });
      const project = JSON.parse(content) as ProjectData;
      
      project.last_active_at = new Date().toISOString();
      await tauriInvoke('write_file_string', {
        path: projectFilePath,
        content: JSON.stringify(project, null, 2),
      });

      const meta: ProjectMetadata = {
        id: project.id,
        name: project.name,
        path,
        tags: project.tags,
      };

      workspaceStore.setActiveProject(meta);
      
      // Auto-load most recent session if available
      if (project.sessions.length > 0) {
        const lastSessionId = project.sessions[project.sessions.length - 1];
        workspaceStore.setActiveSession(lastSessionId);
      }

      notificationStore.addNotification({
        type: 'success',
        message: 'Workspace Ready',
        description: `"${project.name}" is open at ${path}.`,
      });

      return project;
    } catch (err: any) {
      console.error('Failed to load project:', err);
      notificationStore.addNotification({
        type: 'error',
        message: 'Project Loading Failed',
        description: `Ensure a valid project.json exists at ${path}.`,
      });
      throw err;
    }
  }

  /**
   * Create a new execution Session within a Project.
   */
  public async createSession(projectId: string, goal: string): Promise<SessionData> {
    const project = workspaceStore.getSnapshot().activeProject;
    if (!project || project.id !== projectId) {
      throw new Error('No active project matching session initialization.');
    }

    // Backend agent/memory APIs require RFC-4122 UUIDs — never use session_* prefixes.
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    const session: SessionData = {
      id: sessionId,
      project_id: projectId,
      goal,
      status: 'PENDING',
      created_at: now,
      updated_at: now,
      tasks: [],
      artifacts: [],
    };

    try {
      const sessionPath = this.getPath(project.path, 'sessions', `${sessionId}.json`);
      await tauriInvoke('write_file_string', {
        path: sessionPath,
        content: JSON.stringify(session, null, 2),
      });

      // Update project manifest
      const projectFilePath = this.getPath(project.path, 'project.json');
      const projectContent = await tauriInvoke<string>('read_file_string', { path: projectFilePath });
      const projectData = JSON.parse(projectContent) as ProjectData;
      
      projectData.sessions.push(sessionId);
      projectData.last_active_at = now;
      
      await tauriInvoke('write_file_string', {
        path: projectFilePath,
        content: JSON.stringify(projectData, null, 2),
      });

      workspaceStore.setActiveSession(sessionId);

      return session;
    } catch (err: any) {
      console.error('Failed to create session:', err);
      throw err;
    }
  }

  /**
   * Load a session log within a Project.
   */
  public async loadSession(projectId: string, sessionId: string): Promise<SessionData> {
    const project = workspaceStore.getSnapshot().activeProject;
    if (!project || project.id !== projectId) {
      throw new Error('Project context mismatched.');
    }

    const sessionPath = this.getPath(project.path, 'sessions', `${sessionId}.json`);
    try {
      const content = await tauriInvoke<string>('read_file_string', { path: sessionPath });
      const session = JSON.parse(content) as SessionData;
      
      workspaceStore.setActiveSession(sessionId);
      return session;
    } catch (err: any) {
      console.error(`Failed to load session ${sessionId}:`, err);
      throw err;
    }
  }

  /**
   * Save/flush active session state changes.
   */
  public async saveSession(projectId: string, session: SessionData): Promise<void> {
    const project = workspaceStore.getSnapshot().activeProject;
    if (!project || project.id !== projectId) {
      throw new Error('Project context mismatched.');
    }

    session.updated_at = new Date().toISOString();
    const sessionPath = this.getPath(project.path, 'sessions', `${session.id}.json`);
    
    try {
      await tauriInvoke('write_file_string', {
        path: sessionPath,
        content: JSON.stringify(session, null, 2),
      });
    } catch (err: any) {
      console.error(`Failed to save session ${session.id}:`, err);
      throw err;
    }
  }

  /**
   * Register a new output Artifact inside a Project.
   */
  public async createArtifact(
    projectId: string, 
    artifactInput: Omit<ArtifactData, 'created_at' | 'version'>
  ): Promise<ArtifactData> {
    const project = workspaceStore.getSnapshot().activeProject;
    if (!project || project.id !== projectId) {
      throw new Error('Project context mismatched.');
    }

    const now = new Date().toISOString();
    const artifact: ArtifactData = {
      ...artifactInput,
      version: 1,
      created_at: now,
    };

    try {
      const artifactPath = this.getPath(project.path, 'artifacts', `${artifact.id}.json`);
      await tauriInvoke('write_file_string', {
        path: artifactPath,
        content: JSON.stringify(artifact, null, 2),
      });

      // Update the active session link
      const activeSessionId = workspaceStore.getSnapshot().activeSessionId;
      if (activeSessionId) {
        const session = await this.loadSession(projectId, activeSessionId);
        session.artifacts.push(artifact.id);
        await this.saveSession(projectId, session);
      }

      return artifact;
    } catch (err: any) {
      console.error('Failed to register artifact:', err);
      throw err;
    }
  }

  /**
   * Create or overwrite an artifact by id (used for session-scoped conversation history).
   */
  public async upsertArtifact(
    projectId: string,
    artifactInput: Omit<ArtifactData, 'created_at' | 'version'> & { version?: number },
  ): Promise<ArtifactData> {
    const project = workspaceStore.getSnapshot().activeProject;
    if (!project || project.id !== projectId) {
      throw new Error('Project context mismatched.');
    }

    const now = new Date().toISOString();
    let version = artifactInput.version ?? 1;
    try {
      const existing = await this.loadArtifact(projectId, artifactInput.id);
      version = existing.version + 1;
    } catch {
      // new artifact
    }

    const artifact: ArtifactData = {
      ...artifactInput,
      version,
      created_at: now,
    };

    const artifactPath = this.getPath(project.path, 'artifacts', `${artifact.id}.json`);
    await tauriInvoke('write_file_string', {
      path: artifactPath,
      content: JSON.stringify(artifact, null, 2),
    });

    const activeSessionId = workspaceStore.getSnapshot().activeSessionId;
    if (activeSessionId) {
      try {
        const session = await this.loadSession(projectId, activeSessionId);
        if (!session.artifacts.includes(artifact.id)) {
          session.artifacts.push(artifact.id);
          await this.saveSession(projectId, session);
        }
      } catch {
        // session link best-effort
      }
    }

    return artifact;
  }

  /**
   * Read an Artifact from disk.
   */
  public async loadArtifact(projectId: string, artifactId: string): Promise<ArtifactData> {
    const project = workspaceStore.getSnapshot().activeProject;
    if (!project || project.id !== projectId) {
      throw new Error('Project context mismatched.');
    }

    const artifactPath = this.getPath(project.path, 'artifacts', `${artifactId}.json`);
    try {
      const content = await tauriInvoke<string>('read_file_string', { path: artifactPath });
      return JSON.parse(content) as ArtifactData;
    } catch (err: any) {
      console.error(`Failed to load artifact ${artifactId}:`, err);
      throw err;
    }
  }

  /**
   * Export the entire project workspace into a portable JSON pack bundle.
   */
  public async exportWorkspace(projectId: string): Promise<string> {
    const project = workspaceStore.getSnapshot().activeProject;
    if (!project || project.id !== projectId) {
      throw new Error('No active project workspace to export.');
    }

    try {
      const projectFilePath = this.getPath(project.path, 'project.json');
      const projectContent = await tauriInvoke<string>('read_file_string', { path: projectFilePath });
      const projectData = JSON.parse(projectContent) as ProjectData;

      const sessions: SessionData[] = [];
      const artifacts: ArtifactData[] = [];

      // Hydrate all sessions
      for (const sid of projectData.sessions) {
        try {
          const s = await this.loadSession(projectId, sid);
          sessions.push(s);
          
          // Hydrate session artifacts
          for (const aid of s.artifacts) {
            try {
              const art = await this.loadArtifact(projectId, aid);
              artifacts.push(art);
            } catch (e) {
              console.warn(`Skipping missing artifact ${aid} in export.`);
            }
          }
        } catch (e) {
          console.warn(`Skipping missing session ${sid} in export.`);
        }
      }

      const bundle: WorkspaceBundle = {
        project: projectData,
        sessions,
        artifacts,
      };

      return JSON.stringify(bundle, null, 2);
    } catch (err: any) {
      console.error('Failed to export workspace bundle:', err);
      throw err;
    }
  }

  /**
   * Import a workspace bundle and write all structures to the local target path.
   */
  public async importWorkspace(targetPath: string, bundleJson: string): Promise<ProjectData> {
    try {
      const bundle = JSON.parse(bundleJson) as WorkspaceBundle;
      if (!bundle.project || !bundle.project.id) {
        throw new Error('Invalid workspace bundle format.');
      }

      // Initialize directories
      await tauriInvoke('create_dir_all', { path: targetPath });
      await tauriInvoke('create_dir_all', { path: this.getPath(targetPath, 'sessions') });
      await tauriInvoke('create_dir_all', { path: this.getPath(targetPath, 'artifacts') });

      // Save project metadata
      const projectFilePath = this.getPath(targetPath, 'project.json');
      await tauriInvoke('write_file_string', {
        path: projectFilePath,
        content: JSON.stringify(bundle.project, null, 2),
      });

      // Write sessions
      for (const s of bundle.sessions) {
        const sPath = this.getPath(targetPath, 'sessions', `${s.id}.json`);
        await tauriInvoke('write_file_string', {
          path: sPath,
          content: JSON.stringify(s, null, 2),
        });
      }

      // Write artifacts
      for (const art of bundle.artifacts) {
        const artPath = this.getPath(targetPath, 'artifacts', `${art.id}.json`);
        await tauriInvoke('write_file_string', {
          path: artPath,
          content: JSON.stringify(art, null, 2),
        });
      }

      const meta: ProjectMetadata = {
        id: bundle.project.id,
        name: bundle.project.name,
        path: targetPath,
        tags: bundle.project.tags,
      };

      workspaceStore.setActiveProject(meta);
      if (bundle.project.sessions.length > 0) {
        const lastSessionId = bundle.project.sessions[bundle.project.sessions.length - 1];
        workspaceStore.setActiveSession(lastSessionId);
      }

      notificationStore.addNotification({
        type: 'success',
        message: 'Workspace Imported Successfully',
        description: `Imported "${bundle.project.name}" and hydrated ${bundle.sessions.length} sessions.`,
      });

      return bundle.project;
    } catch (err: any) {
      console.error('Failed to import workspace bundle:', err);
      notificationStore.addNotification({
        type: 'error',
        message: 'Workspace Import Failed',
        description: err.message || String(err),
      });
      throw err;
    }
  }

  /**
   * Read a file under the active project root (source tree, not metadata-only).
   */
  public async readProjectFile(relativePath: string): Promise<string> {
    const project = workspaceStore.getSnapshot().activeProject;
    if (!project) throw new Error('No active project.');
    const abs = this.getPath(project.path, relativePath.replace(/\\/g, '/'));
    return tauriInvoke<string>('read_file_string', { path: abs });
  }

  /**
   * Write a file under the active project root. Call only after user approval.
   */
  public async writeProjectFile(relativePath: string, content: string): Promise<string> {
    const project = workspaceStore.getSnapshot().activeProject;
    if (!project) throw new Error('No active project.');
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) {
      throw new Error('Invalid relative path.');
    }
    const abs = this.getPath(project.path, normalized);
    const parent = abs.includes('/') ? abs.slice(0, abs.lastIndexOf('/')) : project.path;
    await tauriInvoke('create_dir_all', { path: parent });
    await tauriInvoke('write_file_string', { path: abs, content });
    return abs;
  }

  /** Absolute path helper for project-relative files. */
  public resolveProjectPath(relativePath: string): string {
    const project = workspaceStore.getSnapshot().activeProject;
    if (!project) throw new Error('No active project.');
    return this.getPath(project.path, relativePath.replace(/\\/g, '/').replace(/^\/+/, ''));
  }
}

export const workspaceManager = new WorkspaceManager();
export default workspaceManager;
