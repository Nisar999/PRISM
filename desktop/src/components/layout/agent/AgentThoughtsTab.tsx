import { useAgent } from '@/lib/agent';

/**
 * Agent panel Thoughts tab — replaces standalone Thought View.
 * Reads agentStore only (backend invoke / conversation pipeline output).
 */
export function AgentThoughtsTab() {
  const agent = useAgent();

  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-prism-dim">
        Thoughts · agent pipeline
      </p>
      <p className="text-xs text-prism-meta">Status: {agent.status}</p>
      {agent.lastRequest ? (
        <p className="text-xs text-white/70">
          Last ask: <span className="text-white/90">{agent.lastRequest}</span>
        </p>
      ) : null}
      {agent.error ? <p className="text-xs text-destructive">{agent.error}</p> : null}

      {!agent.lastResponse ? (
        <p className="text-xs text-prism-dim">
          No thoughts yet. Send a chat message or invoke the agent — plan, reasoning, and reflection
          appear here (not on a separate screen).
        </p>
      ) : (
        <div className="space-y-3 text-xs text-white/85">
          {agent.lastResponse.final_answer ? (
            <section>
              <h4 className="mb-1 font-semibold text-white">Answer</h4>
              <p className="whitespace-pre-wrap text-prism-meta">{agent.lastResponse.final_answer}</p>
            </section>
          ) : null}
          {agent.lastResponse.plan ? (
            <section>
              <h4 className="mb-1 font-semibold text-white">Plan</h4>
              <p className="whitespace-pre-wrap text-prism-meta">{agent.lastResponse.plan}</p>
            </section>
          ) : null}
          {agent.lastResponse.reasoning ? (
            <section>
              <h4 className="mb-1 font-semibold text-white">Reasoning</h4>
              <p className="whitespace-pre-wrap text-prism-meta">{agent.lastResponse.reasoning}</p>
            </section>
          ) : null}
          {agent.lastResponse.reflection ? (
            <section>
              <h4 className="mb-1 font-semibold text-white">Reflection</h4>
              <p className="whitespace-pre-wrap text-prism-meta">{agent.lastResponse.reflection}</p>
            </section>
          ) : null}
          <section>
            <h4 className="mb-1 font-semibold text-white">Trust</h4>
            <p className="font-mono">{agent.lastResponse.trust_score.toFixed(3)}</p>
          </section>
        </div>
      )}
    </div>
  );
}
