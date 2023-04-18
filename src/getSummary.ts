export type SummaryNode = {
  text: string;
  sentence_indices: [number, number][];
  children: SummaryNode[];
};

export type FlattenedTree = {
  text: string;
  sentence_indices: [number, number][];
  children_in_next_level: number[];
}[][];

const flattenNode = (
  node: SummaryNode,
  level: number,
  flattenedTree: FlattenedTree
) => {
  if (flattenedTree.length === level) {
    flattenedTree.push([]);
  }

  const currentIndex = flattenedTree[level].length;
  const children_in_next_level: number[] = [];
  flattenedTree[level].push({
    text: node.text,
    children_in_next_level,
    sentence_indices: node.sentence_indices,
  });

  node.children.forEach((child) => {
    const childIndex = flattenNode(child, level + 1, flattenedTree);
    children_in_next_level.push(childIndex);
  });

  return currentIndex;
};

export const summaryNodeToFlatList = (node: SummaryNode): FlattenedTree => {
  const flattenedTree: FlattenedTree = [];
  flattenNode(node, 0, flattenedTree);
  return flattenedTree;
};

const SERVER_ORIGIN =
  process.env.NEXT_PUBLIC_SERVER_ORIGIN || "http://localhost:8000/";

const _getSummaryTree = (text: string): Promise<SummaryNode> => {
  return fetch(SERVER_ORIGIN + "summarize-text", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, token_count: 350 }),
  }).then((response) => response.json() as Promise<SummaryNode>);
};

const _getFlattenedSummaryTree = (
  text: string
): Promise<{ flattened_tree: FlattenedTree }> => {
  return fetch(SERVER_ORIGIN + "summarize-flattened-text", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, token_count: 350 }),
  }).then(
    (response) => response.json() as Promise<{ flattened_tree: FlattenedTree }>
  );
};

const getFlattenedSummaryTreeCacheKey = (text: string) =>
  `flattened-summary-${hash(text)}`;

const inflightRequests: Map<
  string,
  Promise<{
    flattened_tree: FlattenedTree;
  }>
> = new Map();

export const getFlattenedSummaryTree = (
  text: string
): Promise<{
  flattened_tree: FlattenedTree;
}> => {
  const cacheKey = getFlattenedSummaryTreeCacheKey(text);
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    return Promise.resolve(JSON.parse(cached));
  }

  const inflightRequest = inflightRequests.get(cacheKey);

  if (inflightRequest) {
    return inflightRequest;
  }

  const result = _getFlattenedSummaryTree(text);

  inflightRequests.set(cacheKey, result);

  return result;
};

const _getSimilarity = (
  source: string,
  target: string[]
): Promise<{
  targetIndex: number;
  sentenceIndex: number;
}> => {
  return fetch(SERVER_ORIGIN + "similarity", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({ source, target }),
  }).then((response) => response.json());
};

const hash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
};

const getCacheKey = (text: string) => `summary-${hash(text)}`;

export const getSummaryTree = (text: string): Promise<SummaryNode> => {
  const cacheKey = getCacheKey(text);
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    return Promise.resolve(JSON.parse(cached));
  }

  return _getSummaryTree(text).then((node) => {
    localStorage.setItem(cacheKey, JSON.stringify(node));
    return node;
  });
};

const getSimilarityCacheKey = (source: string, target: string[]) =>
  `similarity-${hash(source)}-${hash(target.join(""))}`;

export const getSimilarity = (
  source: string,
  target: string[]
): Promise<{
  targetIndex: number;
  sentenceIndex: number;
}> => {
  const cacheKey = getSimilarityCacheKey(source, target);
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    return Promise.resolve(JSON.parse(cached));
  }

  return _getSimilarity(source, target).then((similarity) => {
    localStorage.setItem(cacheKey, JSON.stringify(similarity));
    return similarity;
  });
};
