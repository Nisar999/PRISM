import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Lightweight Markdown renderer for conversation turns.
 * Supports fenced code, inline code, bold/italic, lists, links, paragraphs.
 * No external dependency — keeps the desktop package lean.
 */
export function PrismMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks = splitBlocks(content);
  return (
    <div className={cn('space-y-2 font-manrope text-[13px] leading-relaxed text-white/90', className)}>
      {blocks.map((block, i) => {
        if (block.type === 'code') {
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[12px] text-prism-muted"
            >
              {block.lang ? (
                <div className="mb-2 text-[10px] uppercase tracking-wide text-prism-dim">{block.lang}</div>
              ) : null}
              <code>{block.text}</code>
            </pre>
          );
        }
        if (block.type === 'list') {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

type Block =
  | { type: 'code'; lang: string; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'para'; text: string };

function splitBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] || '';
      i += 1;
      const body: string[] = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      out.push({ type: 'code', lang, text: body.join('\n') });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      out.push({ type: 'list', items });
      continue;
    }
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('```') && !/^\s*[-*]\s+/.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    out.push({ type: 'para', text: para.join('\n') });
  }
  return out;
}

function renderInline(text: string): ReactNode[] {
  // Order: code, bold, italic, links
  const nodes: React.ReactNode[] = [];
  const re =
    /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('`')) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-white/10 px-1 py-0.5 font-mono text-[12px] text-prism-focus"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(
        <strong key={key++} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('*') || token.startsWith('_')) {
      nodes.push(
        <em key={key++} className="italic text-white/90">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith('[')) {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        nodes.push(
          <a
            key={key++}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="text-prism-focus underline underline-offset-2"
          >
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(token);
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
