import { ExecutionEvent } from './api';

export type GraphNodeType = 'task' | 'capability' | 'checkpoint' | 'router';

export type GraphNodeStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped';

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  status: GraphNodeStatus;
  tool?: string;
  duration?: number; // Execution time in ms
  error?: string;
  start_time?: string;
  end_time?: string;
  data?: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'dependency' | 'flow' | 'optional';
}

export interface SerializedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Validate if the graph nodes and edges form a Directed Acyclic Graph (DAG).
 * Returns validity status and the cycle path if a cycle is detected.
 */
export function validateDAG(
  nodes: GraphNode[],
  edges: GraphEdge[]
): { isValid: boolean; cyclePath?: string[] } {
  const adjList: Map<string, string[]> = new Map();
  
  for (const n of nodes) {
    adjList.set(n.id, []);
  }
  
  for (const edge of edges) {
    if (!adjList.has(edge.source)) adjList.set(edge.source, []);
    if (!adjList.has(edge.target)) adjList.set(edge.target, []);
    adjList.get(edge.source)!.push(edge.target);
  }

  const visited: Record<string, 'unvisited' | 'visiting' | 'visited'> = {};
  for (const n of adjList.keys()) {
    visited[n] = 'unvisited';
  }

  const path: string[] = [];

  function dfs(node: string): boolean {
    visited[node] = 'visiting';
    path.push(node);

    const neighbors = adjList.get(node) || [];
    for (const neighbor of neighbors) {
      if (visited[neighbor] === 'visiting') {
        // Cycle detected
        path.push(neighbor);
        return false;
      }
      if (visited[neighbor] === 'unvisited') {
        if (!dfs(neighbor)) return false;
      }
    }

    path.pop();
    visited[node] = 'visited';
    return true;
  }

  for (const n of adjList.keys()) {
    if (visited[n] === 'unvisited') {
      if (!dfs(n)) {
        return { isValid: false, cyclePath: [...path] };
      }
    }
  }

  return { isValid: true };
}

/**
 * The GraphEngine manages DAG states, handles incremental runtime events,
 * and handles serialization/validation logic.
 */
export class GraphEngine {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private listeners: Set<() => void> = new Set();

  /**
   * Reset graph state.
   */
  public clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.notify();
  }

  /**
   * Add or update a Node.
   */
  public setNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    this.notify();
  }

  /**
   * Remove a node and all connecting edges.
   */
  public removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    
    // Remove connecting edges
    for (const [edgeId, edge] of this.edges.entries()) {
      if (edge.source === nodeId || edge.target === nodeId) {
        this.edges.delete(edgeId);
      }
    }
    
    this.notify();
  }

  /**
   * Add or update an Edge.
   */
  public setEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);
    this.notify();
  }

  /**
   * Remove an Edge.
   */
  public removeEdge(edgeId: string): void {
    this.edges.delete(edgeId);
    this.notify();
  }

  /**
   * Retrieve nodes array.
   */
  public getNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Retrieve edges array.
   */
  public getEdges(): GraphEdge[] {
    return Array.from(this.edges.values());
  }

  /**
   * Subscribe to graph state changes.
   */
  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify(): void {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error('Error executing GraphEngine subscriber callback:', err);
      }
    });
  }

  /**
   * Validate DAG properties on the current graph.
   */
  public validate(): { isValid: boolean; cyclePath?: string[] } {
    return validateDAG(this.getNodes(), this.getEdges());
  }

  /**
   * Retrieve topological sort order of Node IDs.
   */
  public getTopologicalOrder(): string[] {
    const nodes = this.getNodes();
    const edges = this.getEdges();
    
    const adjList: Map<string, string[]> = new Map();
    const inDegree: Map<string, number> = new Map();

    for (const n of nodes) {
      adjList.set(n.id, []);
      inDegree.set(n.id, 0);
    }

    for (const edge of edges) {
      if (!adjList.has(edge.source)) adjList.set(edge.source, []);
      if (!adjList.has(edge.target)) adjList.set(edge.target, []);
      
      adjList.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(id);
      }
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      const neighbors = adjList.get(node) || [];
      for (const neighbor of neighbors) {
        const nextDeg = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, nextDeg);
        if (nextDeg === 0) {
          queue.push(neighbor);
        }
      }
    }

    // If topological sort does not contain all nodes, there is a cycle
    if (result.length !== nodes.length) {
      console.warn('Topological sort incomplete due to cycle in graph.');
    }

    return result;
  }

  /**
   * Serialize graph representation to JSON.
   */
  public serialize(): string {
    const data: SerializedGraph = {
      nodes: this.getNodes(),
      edges: this.getEdges(),
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Hydrate graph from JSON representation.
   */
  public deserialize(json: string): void {
    try {
      const data = JSON.parse(json) as SerializedGraph;
      this.nodes.clear();
      this.edges.clear();
      
      if (data.nodes) {
        for (const n of data.nodes) {
          this.nodes.set(n.id, n);
        }
      }
      if (data.edges) {
        for (const e of data.edges) {
          this.edges.set(e.id, e);
        }
      }
      this.notify();
    } catch (err) {
      console.error('Failed to deserialize execution graph:', err);
      throw err;
    }
  }

  /**
   * Incrementally updates the graph state by consuming single ExecutionEvents.
   */
  public handleRuntimeEvent(event: ExecutionEvent): void {
    const eventType = event.event_type;

    if (eventType === 'session_created') {
      this.clear();
      return;
    }

    const taskId = event.task_id;
    if (!taskId) {
      // Session-level updates do not map to specific task nodes
      return;
    }

    const existingNode = this.nodes.get(taskId);
    const now = new Date().toISOString();

    let nodeType: GraphNodeType = 'task';
    if (event.tool_id === 'router' || taskId.startsWith('router')) {
      nodeType = 'router';
    } else if (taskId.startsWith('checkpoint')) {
      nodeType = 'checkpoint';
    }

    let status: GraphNodeStatus = 'pending';

    switch (eventType) {
      case 'task_started':
        status = 'running';
        break;
      case 'task_succeeded':
        status = 'succeeded';
        break;
      case 'task_failed':
        status = 'failed';
        break;
      case 'task_skipped':
        status = 'skipped';
        break;
      default:
        // Preserving current node status if event type is metadata/progress update
        status = existingNode ? existingNode.status : 'pending';
        break;
    }

    const updatedNode: GraphNode = {
      id: taskId,
      label: existingNode ? existingNode.label : (event.message || `Task ${taskId}`),
      type: existingNode ? existingNode.type : nodeType,
      status,
      tool: event.tool_id || (existingNode ? existingNode.tool : undefined),
      start_time: eventType === 'task_started' ? now : (existingNode ? existingNode.start_time : undefined),
      end_time: ['task_succeeded', 'task_failed', 'task_skipped'].includes(eventType) ? now : (existingNode ? existingNode.end_time : undefined),
      error: eventType === 'task_failed' ? event.message : (existingNode ? existingNode.error : undefined),
      data: {
        ...(existingNode ? existingNode.data : {}),
        ...(event.data || {}),
      }
    };

    // Calculate execution duration if completed
    if (updatedNode.start_time && updatedNode.end_time) {
      const start = new Date(updatedNode.start_time).getTime();
      const end = new Date(updatedNode.end_time).getTime();
      updatedNode.duration = Math.max(0, end - start);
    }

    this.setNode(updatedNode);

    // If the event defines dependencies in its payload, map those dependencies as edges
    if (event.data && Array.isArray(event.data.dependencies)) {
      for (const parentId of event.data.dependencies) {
        const edgeId = `${parentId}->${taskId}`;
        this.setEdge({
          id: edgeId,
          source: parentId,
          target: taskId,
          type: 'dependency',
        });
      }
    }
  }
}

export const graphEngine = new GraphEngine();
export default graphEngine;
