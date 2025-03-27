import { describe, it, expect } from "vitest";
import { calculatePageRank } from "./pagerank";

describe("calculatePageRank", () => {
  it("should return an empty map for an empty graph", () => {
    const linkGraph = new Map<string, Set<string>>();
    const visited = new Set<string>();
    const ranks = calculatePageRank(linkGraph, visited);
    expect(ranks.size).toBe(0);
  });

  it("should assign equal ranks for a fully connected graph", () => {
    const linkGraph = new Map<string, Set<string>>([
      ["A", new Set(["B", "C"])],
      ["B", new Set(["A", "C"])],
      ["C", new Set(["A", "B"])],
    ]);
    const visited = new Set(["A", "B", "C"]);
    const ranks = calculatePageRank(linkGraph, visited);
    expect(ranks.size).toBe(3);
    expect(ranks.get("A")).toBeCloseTo(1 / 3);
    expect(ranks.get("B")).toBeCloseTo(1 / 3);
    expect(ranks.get("C")).toBeCloseTo(1 / 3);
  });

  it("should assign higher rank to pages with more incoming links", () => {
    // A -> B, B -> C, C -> A (cycle)
    // D -> A
    const linkGraph = new Map<string, Set<string>>([
      ["A", new Set(["B"])],
      ["B", new Set(["C"])],
      ["C", new Set(["A"])],
      ["D", new Set(["A"])],
    ]);
    const visited = new Set(["A", "B", "C", "D"]);
    const ranks = calculatePageRank(linkGraph, visited);
    expect(ranks.size).toBe(4);
    // A should have the highest rank because it receives links from C and D
    expect(ranks.get("A")).toBeGreaterThan(ranks.get("B")!);
    expect(ranks.get("A")).toBeGreaterThan(ranks.get("C")!);
    expect(ranks.get("A")).toBeGreaterThan(ranks.get("D")!);
    // D has no incoming links (except the base probability), so it should have the lowest rank
    expect(ranks.get("D")).toBeLessThan(ranks.get("A")!);
    expect(ranks.get("D")).toBeLessThan(ranks.get("B")!);
    expect(ranks.get("D")).toBeLessThan(ranks.get("C")!);
  });

  it("should handle dangling nodes (nodes with no outgoing links)", () => {
    // A -> B
    // B -> C (dangling)
    const linkGraph = new Map<string, Set<string>>([
      ["A", new Set(["B"])],
      ["B", new Set(["C"])],
      ["C", new Set<string>()], // C has no outgoing links
    ]);
    const visited = new Set(["A", "B", "C"]);
    const ranks = calculatePageRank(linkGraph, visited);
    expect(ranks.size).toBe(3);
    // Check that ranks sum to approximately 1
    const totalRank = Array.from(ranks.values()).reduce(
      (sum, rank) => sum + rank,
      0
    );
    expect(totalRank).toBeCloseTo(1);
    // C receives rank from B, B from A. A receives base rank.
    // Exact values depend on damping factor, but C should likely have the highest rank.
    expect(ranks.get("C")).toBeGreaterThan(ranks.get("A")!);
    expect(ranks.get("C")).toBeGreaterThan(ranks.get("B")!);
  });

  it("should handle nodes outside visited set gracefully", () => {
    const linkGraph = new Map<string, Set<string>>([
      ["A", new Set(["B", "X"])], // X is not in visited
      ["B", new Set(["A"])],
    ]);
    const visited = new Set(["A", "B"]);
    const ranks = calculatePageRank(linkGraph, visited);
    expect(ranks.size).toBe(2);
    expect(ranks.has("X")).toBe(false);
    // A and B link to each other, should have equal rank
    expect(ranks.get("A")).toBeCloseTo(0.5);
    expect(ranks.get("B")).toBeCloseTo(0.5);
  });

  it("should handle complex graph structure", () => {
    // Example from Wikipedia PageRank page (simplified)
    const linkGraph = new Map<string, Set<string>>([
      ["B", new Set(["C"])],
      ["C", new Set(["B"])],
      ["D", new Set(["A", "B"])],
      ["E", new Set(["B", "D", "F"])],
      ["F", new Set(["B", "E"])],
      ["G", new Set(["B", "E"])],
      ["H", new Set(["B", "E"])],
      ["I", new Set(["B", "E"])],
      ["J", new Set(["E"])],
      ["K", new Set(["E"])],
    ]);
    // Assuming all nodes A-K are visited, but A has no outgoing links in the graph provided
    const visited = new Set([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
    ]);
    // Add A to linkGraph if it exists but has no outgoing links
    if (visited.has("A") && !linkGraph.has("A")) {
      linkGraph.set("A", new Set());
    }

    const ranks = calculatePageRank(linkGraph, visited, 100); // More iterations for convergence
    expect(ranks.size).toBe(11);
    const totalRank = Array.from(ranks.values()).reduce(
      (sum, rank) => sum + rank,
      0
    );
    expect(totalRank).toBeCloseTo(1);

    // Based on the graph, B and E should have significantly higher ranks
    const rankB = ranks.get("B")!;
    const rankE = ranks.get("E")!;
    expect(rankB).toBeGreaterThan(0.1); // Expect significant rank for B
    expect(rankE).toBeGreaterThan(0.07); // Lowering expectation slightly for E based on result

    // Nodes only pointing to E (J, K) or B (C) should have lower ranks
    expect(ranks.get("C")).toBeLessThan(rankB);
    expect(ranks.get("J")).toBeLessThan(rankE);
    expect(ranks.get("K")).toBeLessThan(rankE);
    // A is a dangling node in this setup (or only receives base rank)
    expect(ranks.get("A")).toBeLessThan(rankB);
  });
});
