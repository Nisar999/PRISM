import { notificationStore } from './store';

export type CommandCategory =
  | 'navigation'
  | 'workspace'
  | 'editor'
  | 'execution'
  | 'memory'
  | 'models'
  | 'tools'
  | 'files'
  | 'settings'
  | 'debugging'
  | 'system';

export interface CommandContext {
  focusedPane?: string;
  activeProjectId?: string;
  activeSessionId?: string;
  hasActiveExecution?: boolean;
  userMode?: 'beginner' | 'standard' | 'expert';
  permissions?: string[];
  [key: string]: any;
}

export interface CommandDefinition {
  id: string;
  name: string;
  description: string;
  category: CommandCategory;
  action: (...args: any[]) => any | Promise<any>;
  aliases?: string[];
  shortcuts?: string[];
  contextCondition?: (context: CommandContext) => boolean;
}

export interface CommandSearchMatch {
  command: CommandDefinition;
  score: number; // Search relevance score
}

class CommandRegistry {
  private commands: Map<string, CommandDefinition> = new Map();
  private globalContext: CommandContext = {};
  private activeShortcutListener: ((e: KeyboardEvent) => void) | null = null;
  private isOpen = false;
  private onOpenListeners: Set<(open: boolean) => void> = new Set();

  constructor() {
    this.setupGlobalShortcutListener();
  }

  /**
   * Toggle the palette open or closed state.
   */
  public togglePalette(open?: boolean): void {
    this.isOpen = open !== undefined ? open : !this.isOpen;
    this.onOpenListeners.forEach(listener => {
      try {
        listener(this.isOpen);
      } catch (err) {
        console.error(err);
      }
    });
  }

  /**
   * Subscribe to command palette open/close state updates.
   */
  public subscribePalette(listener: (open: boolean) => void): () => void {
    this.onOpenListeners.add(listener);
    return () => {
      this.onOpenListeners.delete(listener);
    };
  }

  /**
   * Check if the palette is currently open.
   */
  public isPaletteOpen(): boolean {
    return this.isOpen;
  }

  /**
   * Register a new command in the registry.
   * Returns a cleanup function to unregister the command.
   */
  public register(cmd: CommandDefinition): () => void {
    if (this.commands.has(cmd.id)) {
      console.warn(`Overwriting command registration for ID: ${cmd.id}`);
    }
    this.commands.set(cmd.id, cmd);
    return () => {
      this.unregister(cmd.id);
    };
  }

  /**
   * Unregister a command by its ID.
   */
  public unregister(id: string): void {
    this.commands.delete(id);
  }

  /**
   * Retrieve a command definition.
   */
  public get(id: string): CommandDefinition | undefined {
    return this.commands.get(id);
  }

  /**
   * List all registered commands.
   */
  public list(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * Update the active command context.
   */
  public updateContext(context: Partial<CommandContext>): void {
    this.globalContext = { ...this.globalContext, ...context };
  }

  /**
   * Get the current global context.
   */
  public getContext(): CommandContext {
    return { ...this.globalContext };
  }

  /**
   * Execute a command by its ID.
   */
  public async execute(id: string, args: any[] = [], context: CommandContext = this.globalContext): Promise<any> {
    const cmd = this.commands.get(id);
    if (!cmd) {
      const errorMsg = `Command execution failed: Command "${id}" is not registered.`;
      console.error(errorMsg);
      notificationStore.addNotification({
        type: 'error',
        message: 'Command Not Found',
        description: errorMsg,
      });
      throw new Error(errorMsg);
    }

    // Context validation
    if (cmd.contextCondition && !cmd.contextCondition(context)) {
      const errorMsg = `Command execution blocked: Command "${id}" is not valid in the current context.`;
      console.warn(errorMsg);
      notificationStore.addNotification({
        type: 'warning',
        message: 'Command Context Blocked',
        description: `The command "${cmd.name}" cannot run in the active workspace view.`,
      });
      throw new Error(errorMsg);
    }

    try {
      const result = await cmd.action(...args);
      return result;
    } catch (err: any) {
      console.error(`Error executing command ${id}:`, err);
      notificationStore.addNotification({
        type: 'error',
        message: `Command Failed: ${cmd.name}`,
        description: err.message || String(err),
      });
      throw err;
    }
  }

  /**
   * Search and rank commands based on input query and active context.
   */
  public search(query: string, context: CommandContext = this.globalContext): CommandDefinition[] {
    const activeCommands = this.list().filter(cmd => {
      if (cmd.contextCondition) {
        return cmd.contextCondition(context);
      }
      return true;
    });

    if (!query || query.trim() === '') {
      // If query is empty, return active commands ordered alphabetically by category and name
      return activeCommands.sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
      });
    }

    const normalizedQuery = query.toLowerCase().trim();
    const queryWords = normalizedQuery.split(/\s+/);
    const matches: CommandSearchMatch[] = [];

    for (const cmd of activeCommands) {
      let score = 0;
      const cmdId = cmd.id.toLowerCase();
      const cmdName = cmd.name.toLowerCase();
      const cmdDesc = cmd.description.toLowerCase();
      const cmdAliases = (cmd.aliases || []).map(a => a.toLowerCase());

      // Exact matches (highest priority)
      if (cmdId === normalizedQuery) score += 100;
      if (cmdName === normalizedQuery) score += 90;
      if (cmdAliases.includes(normalizedQuery)) score += 85;

      // Prefix matches
      if (cmdName.startsWith(normalizedQuery)) score += 50;
      if (cmdId.startsWith(normalizedQuery)) score += 40;

      // Word matches & fuzzy substrings
      let matchedAllWords = true;
      for (const word of queryWords) {
        let wordMatched = false;
        if (cmdName.includes(word)) {
          score += 15;
          wordMatched = true;
        }
        if (cmdId.includes(word)) {
          score += 10;
          wordMatched = true;
        }
        if (cmdDesc.includes(word)) {
          score += 5;
          wordMatched = true;
        }
        for (const alias of cmdAliases) {
          if (alias.includes(word)) {
            score += 12;
            wordMatched = true;
          }
        }
        if (!wordMatched) {
          matchedAllWords = false;
        }
      }

      // Bonus score if all words match somewhere in definition
      if (matchedAllWords) {
        score += 20;
      }

      if (score > 0) {
        matches.push({ command: cmd, score });
      }
    }

    // Sort matches descending by relevance score
    return matches
      .sort((a, b) => b.score - a.score)
      .map(m => m.command);
  }

  /**
   * Set up window keyboard keydown listener for registered shortcuts.
   */
  private setupGlobalShortcutListener(): void {
    if (typeof window === 'undefined') return;

    if (this.activeShortcutListener) {
      window.removeEventListener('keydown', this.activeShortcutListener);
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    this.activeShortcutListener = (e: KeyboardEvent) => {
      // Skip listener if input is targeted at editable element (unless it's the Escape or Cmd+K palette key)
      const target = e.target as HTMLElement | null;
      const isEditable = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );

      const parsedCombination = this.parseKeyboardEvent(e, isMac);
      if (!parsedCombination) return;

      // Intercept Escape key if palette is open
      if (parsedCombination === 'escape' && this.isOpen) {
        e.preventDefault();
        this.togglePalette(false);
        return;
      }

      // Find matching command
      for (const cmd of this.list()) {
        if (!cmd.shortcuts) continue;

        for (const shortcut of cmd.shortcuts) {
          const normalizedShortcut = this.normalizeShortcut(shortcut, isMac);
          if (normalizedShortcut === parsedCombination) {
            // Prevent default behavior to avoid conflicts (e.g. default browser search bar on Ctrl+K)
            if (isEditable && (parsedCombination !== 'cmd+k' && parsedCombination !== 'ctrl+k' && parsedCombination !== 'escape')) {
              continue; 
            }
            e.preventDefault();
            this.execute(cmd.id).catch(err => {
              console.warn(`Failed executing shortcut command ${cmd.id}:`, err);
            });
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', this.activeShortcutListener);
  }

  /**
   * Parse a KeyboardEvent into standard normalized modifier order: ctrl -> alt -> shift -> meta + key
   */
  private parseKeyboardEvent(e: KeyboardEvent, isMac: boolean): string {
    const key = e.key.toLowerCase();
    
    // Skip single modifier keys
    if (['control', 'shift', 'alt', 'meta'].includes(key)) {
      return '';
    }

    const parts: string[] = [];

    // Map Command key on macOS to "cmd", otherwise map Ctrl to "ctrl"
    if (isMac && e.metaKey) {
      parts.push('cmd');
    } else if (e.ctrlKey) {
      parts.push('ctrl');
    }

    if (e.altKey) {
      parts.push('alt');
    }

    if (e.shiftKey) {
      parts.push('shift');
    }

    // If meta is pressed on non-Mac or if we want cmd explicit mapping
    if (!isMac && e.metaKey) {
      parts.push('meta');
    }

    // Normalize arrow keys and other utility keys
    let keyName = key;
    if (key === ' ') keyName = 'space';
    if (key === 'arrowup') keyName = 'up';
    if (key === 'arrowdown') keyName = 'down';
    if (key === 'arrowleft') keyName = 'left';
    if (key === 'arrowright') keyName = 'right';

    parts.push(keyName);
    return parts.join('+');
  }

  /**
   * Normalize shortcut string (e.g., resolving "mod+k" to cmd+k on Mac, ctrl+k on Windows)
   */
  private normalizeShortcut(shortcut: string, isMac: boolean): string {
    const parts = shortcut.toLowerCase().split('+');
    const normalizedParts: string[] = [];

    let ctrl = false;
    let alt = false;
    let shift = false;
    let cmd = false;
    let key = '';

    for (const part of parts) {
      if (part === 'mod') {
        if (isMac) cmd = true;
        else ctrl = true;
      } else if (part === 'ctrl' || part === 'control') {
        ctrl = true;
      } else if (part === 'alt' || part === 'option') {
        alt = true;
      } else if (part === 'shift') {
        shift = true;
      } else if (part === 'cmd' || part === 'meta' || part === 'command') {
        cmd = true;
      } else {
        key = part;
      }
    }

    if (ctrl) normalizedParts.push('ctrl');
    if (alt) normalizedParts.push('alt');
    if (shift) normalizedParts.push('shift');
    if (cmd) normalizedParts.push('cmd');
    if (key) normalizedParts.push(key);

    return normalizedParts.join('+');
  }

  /**
   * Tear down the global keydown event listener.
   */
  public destroy(): void {
    if (typeof window !== 'undefined' && this.activeShortcutListener) {
      window.removeEventListener('keydown', this.activeShortcutListener);
      this.activeShortcutListener = null;
    }
  }
}

export const commands = new CommandRegistry();
export default commands;
