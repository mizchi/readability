// src/serializer.ts

import type {
  // VDocument, // Not serializing VDocument directly
  VElement,
  VNode,
  VText,
  ExtractedSnapshot,
  CandidateInfo,
  AriaTree,
  VNodeType, // Use VNodeType from types.ts
  LinkInfo,
  PageMetadata,
  PageType, // Import PageType
} from "./types.ts";
// import { NodeType } from "./dom.ts"; // Remove this import

// --- Serialization ---

interface SerializableVNodeBase {
  id: number;
  type: VNodeType; // Use VNodeType
}

interface SerializableVElement extends SerializableVNodeBase {
  type: "element";
  tagName: string;
  attributes: Record<string, string>;
  childrenIds: number[];
  parentId?: number; // Optional parent ID (only for elements within the serialized tree)
  // Store necessary readability data if needed, keep it minimal
  readabilityScore?: number;
}

interface SerializableVText extends SerializableVNodeBase {
  type: "text";
  textContent: string;
  parentId?: number; // Optional parent ID
}

// Removed SerializableVComment and SerializableVDocument

type SerializableVNode = SerializableVElement | SerializableVText;

interface SerializableSnapshot {
  rootId: number | null; // ID of the root VElement
  nodes: Record<number, SerializableVNode>;
  metadata: PageMetadata; // Use PageMetadata type
  links: LinkInfo[]; // Use LinkInfo type
  mainCandidates: { score: number; elementId: number }[];
  ariaTree?: AriaTree; // Assuming AriaTree is serializable or we omit/rebuild it
  nodeCount: number;
  pageType: PageType; // Added pageType
}

let nodeIdCounter: number;
const nodeMap: Map<VNode, number> = new Map(); // Key is VNode (VElement | VText)
const serializableNodes: Record<number, SerializableVNode> = {};

function assignId(node: VNode): number {
  if (nodeMap.has(node)) {
    return nodeMap.get(node)!;
  }
  const id = ++nodeIdCounter;
  nodeMap.set(node, id);
  return id;
}

// parentId is the ID of the VElement parent
function serializeNode(node: VNode, parentId?: number): number {
  const id = assignId(node);

  // Avoid re-serializing if already processed
  if (serializableNodes[id]) {
    // Update parentId if it wasn't set before and a parent is provided now
    if (serializableNodes[id].parentId === undefined && parentId !== undefined) {
      serializableNodes[id].parentId = parentId;
    }
    return id;
  }

  let serialized: SerializableVNode;

  switch (node.nodeType) {
    case "element": {
      const el = node as VElement;
      // Recursively serialize children, passing the current element's ID as parentId
      const childrenIds = el.children.map((child) => serializeNode(child, id));
      serialized = {
        id,
        type: "element",
        tagName: el.tagName,
        attributes: { ...el.attributes }, // Clone attributes
        childrenIds,
        parentId: parentId, // Assign parentId passed from the caller
        readabilityScore: el.readability?.contentScore,
      };
      break;
    }
    case "text": {
      const text = node as VText;
      serialized = {
        id,
        type: "text",
        textContent: text.textContent,
        parentId: parentId, // Assign parentId passed from the caller
      };
      break;
    }
    // VComment and VDocument are not handled
    // default:
    //   console.warn("Unsupported node type for serialization:", (node as any).nodeType);
    //   return -1; // Indicate failure/skip
  }

  serializableNodes[id] = serialized;
  return id;
}

// Modify serialize to accept pageType
export function serialize(snapshot: ExtractedSnapshot, pageType: PageType): string {
  nodeIdCounter = 0;
  nodeMap.clear();
  // Clear object properly
  Object.keys(serializableNodes).forEach((key) => delete serializableNodes[Number(key)]);

  let rootId: number | null = null;
  if (snapshot.root) {
    // Start serialization from the snapshot's root element. No parentId for the root.
    rootId = serializeNode(snapshot.root, undefined);
  } else {
    console.warn("Cannot serialize: No root element found in snapshot.");
  }

  // Use nullish coalescing for safety
  const candidates = snapshot.mainCandidates ?? [];
  const serializableCandidates = candidates
    .map((candidate) => {
      // candidate.element might not be in the serialized tree if snapshot.root is different
      const elementId = nodeMap.get(candidate.element);
      // Only include candidates whose elements were successfully serialized
      return elementId !== undefined ? { score: candidate.score, elementId } : null;
    })
    .filter((c): c is { score: number; elementId: number } => c !== null); // Type guard

  const serializableData: SerializableSnapshot = {
    rootId,
    nodes: serializableNodes,
    metadata: snapshot.metadata,
    links: snapshot.links, // Assuming links are simple data
    mainCandidates: serializableCandidates,
    ariaTree: snapshot.ariaTree, // Assuming AriaTree is serializable or handled elsewhere
    nodeCount: snapshot.nodeCount,
    pageType: pageType, // Store pageType (Ensure variable name is correct)
  };

  // Clean up maps after serialization
  nodeMap.clear();

  return JSON.stringify(serializableData);
}

// --- Deserialization ---

// Remove helper interfaces for deserialized nodes

// Use VNode directly, but add parentId property in createNode
const deserializedNodes: Map<number, VNode> = new Map(); // Use VNode

// Creates a plain VNode object based on serialized data, without linking children/parent yet
function createNode(data: SerializableVNode): VNode {
  // Return VNode
  switch (data.type) {
    case "element": {
      const elData = data as SerializableVElement;
      // Add parentId to the created VElement object
      const element: VElement & { parentId?: number } = {
        nodeType: "element",
        tagName: elData.tagName,
        attributes: elData.attributes,
        children: [],
        readability:
          elData.readabilityScore !== undefined
            ? { contentScore: elData.readabilityScore }
            : undefined,
        id: elData.attributes.id,
        className: elData.attributes.class,
        parentId: elData.parentId, // Add parentId here
      };
      return element as VElement; // Cast back to VElement
    }
    case "text": {
      const textData = data as SerializableVText;
      // Add parentId to the created VText object
      const textNode: VText & { parentId?: number } = {
        nodeType: "text",
        textContent: textData.textContent,
        parentId: textData.parentId, // Add parentId here
      };
      return textNode as VText; // Cast back to VText
    }
    // No VComment or VDocument
    // default:
    //   throw new Error(`Unsupported node type for deserialization: ${(data as any).type}`);
  }
}

// Modify deserialize to return snapshot and pageType
export function deserialize(jsonString: string): {
  snapshot: ExtractedSnapshot;
  pageType: PageType;
} {
  const serializableData: SerializableSnapshot = JSON.parse(jsonString);
  deserializedNodes.clear();

  // Step 1: Create all node instances without linking
  for (const idStr in serializableData.nodes) {
    const id = parseInt(idStr, 10);
    if (isNaN(id)) continue; // Skip if key is not a number
    const nodeData = serializableData.nodes[id];
    if (!nodeData) continue; // Skip if data is missing
    const node = createNode(nodeData);
    deserializedNodes.set(id, node);
  }

  // Step 2: Link children (Parent linking via WeakRef is not feasible)
  for (const idStr in serializableData.nodes) {
    const id = parseInt(idStr, 10);
    if (isNaN(id)) continue;
    const nodeData = serializableData.nodes[id];
    if (!nodeData || nodeData.type !== "element") continue; // Only elements have children

    const parentElement = deserializedNodes.get(id) as VElement | undefined; // Should be VElement
    if (!parentElement) continue;

    const childrenIds = (nodeData as SerializableVElement).childrenIds;
    parentElement.children = []; // Ensure children array is clean

    for (const childId of childrenIds) {
      const childNode = deserializedNodes.get(childId);
      if (childNode) {
        parentElement.children.push(childNode as VElement | VText); // Ensure correct type for push
        // We cannot reliably set the child's parent WeakRef here.
        // The VNode structure in types.ts relies on WeakRef, which breaks serialization.
        // If parent access is needed after deserialization, the structure might need rethinking
        // (e.g., using IDs or direct references post-deserialization).
        // (childNode as any).parent = parentElement; // Avoid setting parent directly
      } else {
        console.warn(`Child node with id ${childId} not found for parent node ${id}`);
      }
    }
  }

  // Step 3: Reconstruct Snapshot
  const rootElement =
    serializableData.rootId !== null
      ? ((deserializedNodes.get(serializableData.rootId) as VElement | null) ?? null) // Ensure it's VElement or null
      : null;

  // Use nullish coalescing for safety
  const candidatesData = serializableData.mainCandidates ?? [];
  const mainCandidates: CandidateInfo[] = candidatesData
    .map((c) => {
      const element = deserializedNodes.get(c.elementId) as VElement | undefined;
      // Ensure the found node is actually an element
      return element?.nodeType === "element" ? { element: element, score: c.score } : null;
    })
    .filter((c): c is CandidateInfo => c !== null); // Use type guard

  const snapshot: ExtractedSnapshot = {
    root: rootElement,
    nodeCount: serializableData.nodeCount,
    mainCandidates: mainCandidates,
    links: serializableData.links, // Assuming LinkInfo[] is directly usable
    ariaTree: serializableData.ariaTree, // Assuming AriaTree is directly usable
    metadata: serializableData.metadata, // Assuming PageMetadata is directly usable
  };

  // Clean up map after deserialization
  deserializedNodes.clear();

  // Return snapshot and pageType
  return { snapshot: snapshot, pageType: serializableData.pageType }; // Correct return object structure
}

// Removed helper class definitions
