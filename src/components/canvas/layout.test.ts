import { describe, expect, it } from "vitest";
import type { GraphEdge, GraphNode } from "../../client/types.ts";
import { layoutGraph } from "./layout.ts";

describe("layoutGraph", () => {
  it("returns empty arrays when nodes list is empty", () => {
    const res = layoutGraph([], [], null);
    expect(res.nodes).toEqual([]);
    expect(res.edges).toEqual([]);
  });

  it("arranges nodes without edges into grid columns", () => {
    const nodes: GraphNode[] = [
      { id: "a", label: "Module A", status: "exploring" },
      { id: "b", label: "Module B", status: "done" },
      { id: "c", label: "Module C", status: "problem" },
    ];
    const res = layoutGraph(nodes, [], "b");
    expect(res.nodes).toHaveLength(3);
    const nodeB = res.nodes.find((n) => n.id === "b");
    expect(nodeB?.data.isFocused).toBe(true);
    const nodeA = res.nodes.find((n) => n.id === "a");
    expect(nodeA?.data.isFocused).toBe(false);
  });

  it("arranges DAG sequentially according to edge layers", () => {
    const nodes: GraphNode[] = [
      { id: "core", label: "Core", status: "done" },
      { id: "api", label: "API", status: "changing" },
      { id: "web", label: "Web", status: "exploring" },
    ];
    const edges: GraphEdge[] = [
      { from: "core", to: "api" },
      { from: "api", to: "web" },
    ];

    const res = layoutGraph(nodes, edges, "api");
    expect(res.edges).toHaveLength(2);

    const core = res.nodes.find((n) => n.id === "core")!;
    const api = res.nodes.find((n) => n.id === "api")!;
    const web = res.nodes.find((n) => n.id === "web")!;

    expect(core.position.x).toBeLessThan(api.position.x);
    expect(api.position.x).toBeLessThan(web.position.x);
    expect(api.data.isFocused).toBe(true);
  });

  it("handles cycles gracefully without infinite loop", () => {
    const nodes: GraphNode[] = [
      { id: "n1", label: "N1", status: "exploring" },
      { id: "n2", label: "N2", status: "exploring" },
    ];
    const edges: GraphEdge[] = [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n1" },
    ];

    const res = layoutGraph(nodes, edges, null);
    expect(res.nodes).toHaveLength(2);
    expect(res.edges).toHaveLength(2);
  });
});
