import React, { useState, useEffect, useRef } from 'react';
import { graphEngine, GraphNode, GraphEdge } from '@/lib/graph';
import { cn } from '@/lib/utils';
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  HelpCircle, 
  CornerDownRight, 
  Clock, 
  Settings,
  ShieldAlert
} from 'lucide-react';

export function GraphCanvas() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Pan and Zoom states
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time updates from GraphEngine
  useEffect(() => {
    setNodes(graphEngine.getNodes());
    setEdges(graphEngine.getEdges());

    const unsubscribe = graphEngine.subscribe(() => {
      setNodes(graphEngine.getNodes());
      setEdges(graphEngine.getEdges());
    });
    return unsubscribe;
  }, []);

  // Compute layout coordinates (topological layers)
  const nodePositions: Record<string, { x: number; y: number }> = {};
  const topologicalOrder = graphEngine.getTopologicalOrder();
  const depths: Record<string, number> = {};
  const columns: Record<number, string[]> = {};

  for (const nodeId of topologicalOrder) {
    const parentEdges = edges.filter(e => e.target === nodeId);
    if (parentEdges.length === 0) {
      depths[nodeId] = 0;
    } else {
      const parentDepths = parentEdges.map(e => depths[e.source] ?? 0);
      depths[nodeId] = 1 + Math.max(...parentDepths);
    }

    const depth = depths[nodeId];
    if (!columns[depth]) {
      columns[depth] = [];
    }
    columns[depth].push(nodeId);
  }

  // Calculate pixel positions
  const colWidth = 240;
  const rowHeight = 120;

  Object.entries(columns).forEach(([depthStr, ids]) => {
    const depth = parseInt(depthStr, 10);
    const totalInCol = ids.length;
    
    ids.forEach((id, index) => {
      // Offset vertically to center columns
      const yOffset = (totalInCol - 1) * rowHeight / 2;
      nodePositions[id] = {
        x: depth * colWidth + 50,
        y: index * rowHeight - yOffset + 200,
      };
    });
  });

  // Pan interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag on left click on the background
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.graph-node')) return; // Ignore if clicking a node

    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom interaction handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const nextZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
    // Bound zoom level between 0.4x and 2.5x
    setZoom(Math.max(0.4, Math.min(2.5, nextZoom)));
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  // Helper to retrieve node status styling
  const getNodeStatusStyles = (status: GraphNode['status'], isSelected: boolean) => {
    switch (status) {
      case 'succeeded':
        return {
          border: isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-emerald-500/40 hover:border-emerald-500',
          bg: 'bg-emerald-950/20 text-emerald-500',
          icon: CheckCircle,
        };
      case 'failed':
        return {
          border: isSelected ? 'border-rose-500 ring-2 ring-rose-500/30' : 'border-rose-500/40 hover:border-rose-500',
          bg: 'bg-rose-950/20 text-rose-500',
          icon: XCircle,
        };
      case 'running':
        return {
          border: isSelected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-blue-500 animate-pulse',
          bg: 'bg-blue-950/20 text-blue-500',
          icon: Play,
        };
      case 'skipped':
        return {
          border: 'border-border/50 border-dashed opacity-60',
          bg: 'bg-muted/10 text-muted-foreground/60',
          icon: HelpCircle,
        };
      case 'queued':
        return {
          border: isSelected ? 'border-amber-500/80 ring-2 ring-amber-500/20' : 'border-border hover:border-amber-500/50',
          bg: 'bg-muted/30 text-amber-500/80',
          icon: Clock,
        };
      default:
        return {
          border: isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/50',
          bg: 'bg-muted/10 text-muted-foreground',
          icon: Clock,
        };
    }
  };

  const formatDuration = (ms?: number): string => {
    if (ms === undefined) return '--';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full min-h-[450px] bg-muted/5 border border-border rounded-xl overflow-hidden select-none cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Zoom / Reset Toolbar Overlay */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <div className="bg-card border border-border rounded-lg p-1.5 px-3 text-xs font-mono text-muted-foreground flex items-center gap-2 shadow-md">
          Zoom: {Math.round(zoom * 100)}%
        </div>
        <button 
          onClick={() => { setPan({ x: 50, y: 50 }); setZoom(1.0); }}
          className="bg-card border border-border hover:bg-muted text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md transition-colors text-foreground"
        >
          Reset View
        </button>
      </div>

      {/* SVG Canvas Stage */}
      <svg className="w-full h-full absolute inset-0">
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" className="fill-border" />
          </marker>
        </defs>

        {/* Global Transform group mapping Pan and Zoom */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          
          {/* Render dependency edges first */}
          {edges.map((edge) => {
            const start = nodePositions[edge.source];
            const end = nodePositions[edge.target];
            if (!start || !end) return null;

            // Offset coordinates to align to node connectors
            const startX = start.x + 180;
            const startY = start.y + 35;
            const endX = end.x;
            const endY = end.y + 35;

            // Smooth cubic bezier path
            const ctrlX1 = startX + 40;
            const ctrlY1 = startY;
            const ctrlX2 = endX - 40;
            const ctrlY2 = endY;

            return (
              <g key={edge.id}>
                <path
                  d={`M ${startX} ${startY} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${endX} ${endY}`}
                  fill="none"
                  className={cn(
                    "stroke-border transition-colors stroke-[1.5px]",
                    edge.type === 'optional' && 'stroke-dashed opacity-50'
                  )}
                  markerEnd="url(#arrow)"
                />
              </g>
            );
          })}

          {/* Render Nodes */}
          {nodes.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;

            const isSelected = selectedNodeId === node.id;
            const style = getNodeStatusStyles(node.status, isSelected);
            const Icon = style.icon;

            return (
              <g 
                key={node.id} 
                transform={`translate(${pos.x}, ${pos.y})`}
                className="graph-node cursor-pointer focus:outline-none"
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`Node: ${node.label}, status: ${node.status}`}
                onClick={() => setSelectedNodeId(node.id === selectedNodeId ? null : node.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedNodeId(node.id === selectedNodeId ? null : node.id);
                  }
                }}
              >
                {/* Router Nodes (Circular) vs. Task Nodes (Rounded Rectangles) */}
                {node.type === 'router' ? (
                  <circle
                    cx="90"
                    cy="35"
                    r="35"
                    className={cn(
                      "fill-card stroke-[1.5px] transition-all",
                      style.border
                    )}
                  />
                ) : (
                  <rect
                    width="180"
                    height="70"
                    rx="8"
                    className={cn(
                      "fill-card stroke-[1.5px] transition-all",
                      style.border
                    )}
                  />
                )}

                {/* Node Text contents */}
                <foreignObject width="180" height="70" pointerEvents="none">
                  <div className="w-full h-full flex items-center p-3 gap-2.5 overflow-hidden">
                    <div className={cn("p-1.5 rounded-lg shrink-0", style.bg)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground truncate leading-tight">
                        {node.label}
                      </p>
                      {node.tool && (
                        <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5 uppercase tracking-wide">
                          {node.tool}
                        </p>
                      )}
                    </div>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Selected Node Details Slide-over Pane */}
      {selectedNode && (
        <div className="absolute right-4 bottom-4 top-4 z-10 w-80 bg-card border border-border rounded-xl shadow-2xl p-5 flex flex-col max-h-[calc(100%-2rem)] animate-in slide-in-from-right duration-200">
          <div className="flex items-start justify-between pb-3 border-b border-border">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground truncate">{selectedNode.label}</h3>
              <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">ID: {selectedNode.id}</p>
            </div>
            <button 
              onClick={() => setSelectedNodeId(null)}
              className="text-muted-foreground hover:text-foreground text-xs font-bold font-mono px-1.5 py-0.5 rounded hover:bg-muted"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
            {/* Meta properties */}
            <div className="grid grid-cols-2 gap-3 bg-muted/10 p-3 rounded-lg border border-border/30">
              <div>
                <p className="text-muted-foreground font-mono text-[9px] uppercase tracking-wider">Status</p>
                <p className="font-semibold capitalize mt-0.5">{selectedNode.status}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-mono text-[9px] uppercase tracking-wider">Type</p>
                <p className="font-semibold capitalize mt-0.5">{selectedNode.type}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-mono text-[9px] uppercase tracking-wider">Duration</p>
                <div className="flex items-center gap-1 font-mono font-semibold mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(selectedNode.duration)}
                </div>
              </div>
              {selectedNode.tool && (
                <div>
                  <p className="text-muted-foreground font-mono text-[9px] uppercase tracking-wider">Tool Bounded</p>
                  <p className="font-semibold font-mono mt-0.5">{selectedNode.tool}</p>
                </div>
              )}
            </div>

            {/* Error stack log details */}
            {selectedNode.error && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-rose-500 font-bold">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Execution Exception</span>
                </div>
                <pre className="bg-rose-950/15 border border-rose-500/20 text-[10px] font-mono p-3 rounded-lg text-rose-300 overflow-x-auto whitespace-pre-wrap max-h-36">
                  {selectedNode.error}
                </pre>
              </div>
            )}

            {/* Event Payload inspect */}
            {selectedNode.data && Object.keys(selectedNode.data).length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-primary font-bold">
                  <Settings className="w-4 h-4 shrink-0" />
                  <span>Payload Metadata</span>
                </div>
                <pre className="bg-muted border border-border text-[10px] font-mono p-3 rounded-lg text-muted-foreground overflow-x-auto max-h-40">
                  {JSON.stringify(selectedNode.data, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between text-[10px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1">
              <CornerDownRight className="w-3.5 h-3.5" />
              Source Bounded:
            </span>
            <span>GraphEngine v1.0</span>
          </div>
        </div>
      )}
    </div>
  );
}
export default GraphCanvas;
