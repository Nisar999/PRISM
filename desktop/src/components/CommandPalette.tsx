import React, { useState, useEffect, useRef } from 'react';
import { commands, CommandDefinition } from '@/lib/commands';
import { cn } from '@/lib/utils';
import { Search, CornerDownLeft, Eye } from 'lucide-react';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommandDefinition[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  // Subscribe to registry open state updates
  useEffect(() => {
    const unsubscribe = commands.subscribePalette((open) => {
      setIsOpen(open);
      if (open) {
        setQuery('');
        setSelectedIndex(0);
        // Focus the search input next frame
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    });
    return unsubscribe;
  }, []);

  // Update search results whenever query or open state changes
  useEffect(() => {
    if (isOpen) {
      const searchResults = commands.search(query);
      setResults(searchResults);
      setSelectedIndex(0);
    }
  }, [query, isOpen]);

  // Keep selected element scrolled into view
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  // Keyboard navigation within the palette overlay
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      commands.togglePalette(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        executeCommand(results[selectedIndex]);
      }
    }
  };

  const executeCommand = (cmd: CommandDefinition) => {
    commands.togglePalette(false);
    commands.execute(cmd.id).catch((err) => {
      console.error(`Error in Command Palette executing ${cmd.id}:`, err);
    });
  };

  // Helper to format shortcut strings into premium visual keys
  const formatShortcut = (shortcut: string): string => {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    
    return shortcut
      .toLowerCase()
      .split('+')
      .map((part) => {
        if (part === 'mod') return isMac ? '⌘' : 'Ctrl';
        if (part === 'cmd' || part === 'meta') return '⌘';
        if (part === 'ctrl') return 'Ctrl';
        if (part === 'alt' || part === 'option') return isMac ? '⌥' : 'Alt';
        if (part === 'shift') return '⇧';
        return part.toUpperCase();
      })
      .join(' ');
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-background/85 backdrop-blur-sm prism-enter-fast"
      onClick={() => commands.togglePalette(false)}
    >
      <div 
        className="w-full max-w-lg overflow-hidden border border-border rounded-xl bg-card shadow-2xl flex flex-col max-h-[50vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 border-b border-border h-12 gap-3 bg-muted/20">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 h-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Command Results Lists */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1">
          {results.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No commands matched your search.
            </div>
          ) : (
            results.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  ref={isSelected ? activeItemRef : null}
                  type="button"
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm transition-colors border border-transparent outline-none group",
                    isSelected 
                      ? "bg-secondary text-secondary-foreground border-primary/20" 
                      : "text-foreground hover:bg-muted/50"
                  )}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                    <span className="font-medium truncate flex items-center gap-2">
                      {cmd.name}
                      <span className={cn(
                        "text-[10px] uppercase px-1.5 py-0.5 rounded-md font-semibold tracking-wider font-mono",
                        isSelected 
                          ? "bg-primary/20 text-primary" 
                          : "bg-muted text-muted-foreground"
                      )}>
                        {cmd.category}
                      </span>
                    </span>
                    <span className={cn(
                      "text-xs truncate",
                      isSelected ? "text-secondary-foreground/80" : "text-muted-foreground"
                    )}>
                      {cmd.description}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {cmd.shortcuts && cmd.shortcuts.length > 0 && (
                      <kbd className={cn(
                        "hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border px-1.5 font-mono text-[10px] font-medium transition-colors",
                        isSelected 
                          ? "border-primary/20 bg-primary/10 text-primary" 
                          : "border-border bg-muted text-muted-foreground"
                      )}>
                        {formatShortcut(cmd.shortcuts[0])}
                      </kbd>
                    )}
                    <CornerDownLeft className={cn(
                      "w-3 h-3 opacity-0 transition-opacity",
                      isSelected && "opacity-100 text-primary"
                    )} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Meta Details */}
        {results[selectedIndex] && (
          <div className="px-4 py-2 border-t border-border bg-muted/10 text-[10px] text-muted-foreground flex items-center justify-between font-mono shrink-0 select-none">
            <span className="truncate">
              ID: {results[selectedIndex].id}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <Eye className="w-3 h-3" />
              Focus Conditions: {results[selectedIndex].contextCondition ? 'Contextual' : 'Global'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
export default CommandPalette;
