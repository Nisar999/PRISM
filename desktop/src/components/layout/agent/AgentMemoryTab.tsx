import { useMemory } from '@/lib/memory';

/**
 * Agent panel Memory tab — backend Memory engine via memoryStore (no local mock).
 */
export function AgentMemoryTab() {
  const memory = useMemory();

  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-prism-dim">
        Memory · backend engine
      </p>
      <p className="text-xs text-prism-meta">
        Status: {memory.status}
        {memory.backendReachable === false ? ' · unreachable' : ''}
      </p>
      {memory.lastQuery ? (
        <p className="text-xs text-white/80">
          Last query: <span className="font-mono">{memory.lastQuery}</span>
        </p>
      ) : null}
      {memory.lastResults.length === 0 ? (
        <p className="text-xs text-prism-dim">
          No results yet. Conversation retrieval and Command Palette → Search Memory Engine fill this
          list from the same store.
        </p>
      ) : (
        <ul className="space-y-2">
          {memory.lastResults.slice(0, 12).map((r) => (
            <li
              key={r.memory.id}
              className="space-y-1 rounded-md border border-prism-border bg-prism-soft p-2 text-xs"
            >
              <div className="flex justify-between gap-2 font-mono text-[10px] text-prism-meta">
                <span>{r.memory.memory_type}</span>
                <span>
                  rel {r.relevance_score.toFixed(2)} · trust {r.memory.trust.toFixed(2)}
                </span>
              </div>
              <p className="line-clamp-4 text-white/85">{r.memory.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
