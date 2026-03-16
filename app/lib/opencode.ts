import { analysisJobs, type Issue, type PullRequest } from './db';
import { loadLocalEnv } from './serverEnv';

loadLocalEnv();

type AnalysisResult = {
  solves: boolean;
  confidence: number;
  reason: string;
};

type DuplicateResult = {
  isDuplicate: boolean;
  confidence: number;
  reason: string;
};

type RelationshipMatch = {
  issue_number: number;
  pr_number: number;
  confidence: number;
  reason: string;
};

type DuplicateMatch = {
  issue_number: number;
  duplicate_issue_number: number;
  confidence: number;
  reason: string;
};

type RelationshipBatchResponse = {
  matches: RelationshipMatch[];
};

type DuplicateBatchResponse = {
  duplicates: DuplicateMatch[];
};

type RelationshipBatch = {
  issues: Issue[];
  pullRequests: PullRequest[];
};

type DuplicateBatch = {
  primaryIssues: Issue[];
  comparisonIssues: Issue[];
};

type OpenCodeGoTextPart = {
  type?: string;
  text?: string;
};

type OpenCodeGoResponse = {
  choices?: Array<{
    message?: {
      content?: string | OpenCodeGoTextPart[] | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

const BULK_BATCH_SIZE = 100;
const MAX_RELATIONSHIP_PROMPT_CHARS = 24_000;
const MAX_DUPLICATE_PROMPT_CHARS = 24_000;
const RELATIONSHIP_CONFIDENCE_THRESHOLD = 0.5;
const DUPLICATE_CONFIDENCE_THRESHOLD = 0.6;
const OPENCODE_TIMEOUT_MS = 90_000;
const TITLE_LIMIT = 72;
const ISSUE_BODY_LIMIT = 56;
const PR_BODY_LIMIT = 56;
const LABEL_LIMIT = 3;
const LABEL_NAME_LIMIT = 20;
const OPENCODE_GO_ENDPOINT = process.env.OPENCODE_GO_ENDPOINT?.trim() || 'https://opencode.ai/zen/go/v1/chat/completions';
const OPENCODE_GO_MODEL = process.env.OPENCODE_GO_MODEL?.trim() || 'kimi-k2.5';
const SYSTEM_MESSAGE = 'You analyze GitHub issues and pull requests. Respond with valid JSON only and never wrap it in markdown.';

function getOpenCodeApiKey(): string {
  loadLocalEnv();
  const apiKey = process.env.OPENCODE_GO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OpenCode Go is not configured. Set OPENCODE_GO_API_KEY in .local.env or .env.local.');
  }

  return apiKey;
}

function extractAssistantContent(content: string | OpenCodeGoTextPart[] | null | undefined): string | null {
  if (typeof content === 'string') {
    const text = content.trim();
    return text.length > 0 ? text : null;
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const text = content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text!.trim())
    .filter((part) => part.length > 0)
    .join('\n')
    .trim();

  return text.length > 0 ? text : null;
}

async function callOpenCodeGoAPI(prompt: string): Promise<string> {
  const apiKey = getOpenCodeApiKey();

  try {
    const response = await fetch(OPENCODE_GO_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENCODE_GO_MODEL,
        stream: false,
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM_MESSAGE },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(OPENCODE_TIMEOUT_MS),
    });

    const responseText = await response.text();
    let parsedResponse: OpenCodeGoResponse | null = null;

    try {
      parsedResponse = JSON.parse(responseText) as OpenCodeGoResponse;
    } catch {
      parsedResponse = null;
    }

    if (!response.ok) {
      const message = parsedResponse?.error?.message?.trim() || responseText.trim() || response.statusText;
      throw new Error(`OpenCode Go request failed (${response.status}): ${message}`);
    }

    const content = extractAssistantContent(parsedResponse?.choices?.[0]?.message?.content);
    if (!content) {
      throw new Error('OpenCode Go returned an empty response');
    }

    return content;
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      throw new Error(`OpenCode Go request timed out after ${OPENCODE_TIMEOUT_MS / 1000} seconds`);
    }

    throw error;
  }
}

function normalizeWhitespace(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function truncateText(value: string | null | undefined, maxLength: number): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function parseLabels(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((label): label is string => typeof label === 'string');
  } catch {
    return [];
  }
}

function compactLabels(value: string | null): string[] {
  return parseLabels(value)
    .map((label) => truncateText(label, LABEL_NAME_LIMIT))
    .filter((label) => label.length > 0)
    .slice(0, LABEL_LIMIT);
}

function summarizeIssue(issue: Issue) {
  return {
    n: issue.github_number,
    t: truncateText(issue.title, TITLE_LIMIT),
    b: truncateText(issue.body, ISSUE_BODY_LIMIT),
    l: compactLabels(issue.labels),
  };
}

function summarizePullRequest(pr: PullRequest) {
  return {
    n: pr.github_number,
    t: truncateText(pr.title, TITLE_LIMIT),
    b: truncateText(pr.body, PR_BODY_LIMIT),
    l: compactLabels(pr.labels),
    f: pr.changed_files,
    d: Boolean(pr.draft),
  };
}

function findBalancedJson(text: string): string | null {
  const possibleStarts = [text.indexOf('{'), text.indexOf('[')].filter((index) => index >= 0);
  if (possibleStarts.length === 0) {
    return null;
  }

  const start = Math.min(...possibleStarts);
  const opening = text[start];
  const closing = opening === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index++) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === opening) {
      depth++;
      continue;
    }

    if (char === closing) {
      depth--;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

export function extractJsonPayload(text: string): string | null {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return findBalancedJson(fencedMatch[1].trim());
  }

  return findBalancedJson(text.trim());
}

export function parseModelJsonResponse<T>(text: string): T {
  const payload = extractJsonPayload(text);
  if (!payload) {
    throw new Error('Model response did not contain valid JSON');
  }

  return JSON.parse(payload) as T;
}

export function chunkItems<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) {
    throw new Error('chunkSize must be greater than zero');
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function chunkItemsToFit<T>(items: T[], maxItems: number, fitsChunk: (chunk: T[]) => boolean): T[][] {
  if (maxItems <= 0) {
    throw new Error('maxItems must be greater than zero');
  }

  const chunks: T[][] = [];
  let start = 0;

  while (start < items.length) {
    let end = Math.min(items.length, start + maxItems);

    while (end > start && !fitsChunk(items.slice(start, end))) {
      end--;
    }

    if (end === start) {
      throw new Error('A single analysis item exceeded the AI prompt size limit');
    }

    chunks.push(items.slice(start, end));
    start = end;
  }

  return chunks;
}

function estimateRelationshipPromptSize(batch: RelationshipBatch): number {
  return buildRelationshipPrompt(batch).length;
}

function estimateDuplicatePromptSize(batch: DuplicateBatch): number {
  return buildDuplicatePrompt(batch).length;
}

export function buildRelationshipAnalysisBatches(
  issues: Issue[],
  pullRequests: PullRequest[],
  chunkSize = BULK_BATCH_SIZE
): RelationshipBatch[] {
  if (issues.length === 0 || pullRequests.length === 0) {
    return [];
  }

  if (estimateRelationshipPromptSize({ issues, pullRequests }) <= MAX_RELATIONSHIP_PROMPT_CHARS) {
    return [{ issues, pullRequests }];
  }

  if (
    issues.length <= pullRequests.length &&
    estimateRelationshipPromptSize({ issues, pullRequests: [pullRequests[0]] }) <= MAX_RELATIONSHIP_PROMPT_CHARS
  ) {
    return chunkItemsToFit(
      pullRequests,
      chunkSize,
      (prChunk) => estimateRelationshipPromptSize({ issues, pullRequests: prChunk }) <= MAX_RELATIONSHIP_PROMPT_CHARS
    ).map((prChunk) => ({
      issues,
      pullRequests: prChunk,
    }));
  }

  if (
    estimateRelationshipPromptSize({ issues: [issues[0]], pullRequests }) <= MAX_RELATIONSHIP_PROMPT_CHARS
  ) {
    return chunkItemsToFit(
      issues,
      chunkSize,
      (issueChunk) => estimateRelationshipPromptSize({ issues: issueChunk, pullRequests }) <= MAX_RELATIONSHIP_PROMPT_CHARS
    ).map((issueChunk) => ({
      issues: issueChunk,
      pullRequests,
    }));
  }

  const issueChunks = chunkItemsToFit(
    issues,
    chunkSize,
    (issueChunk) =>
      estimateRelationshipPromptSize({ issues: issueChunk, pullRequests: [pullRequests[0]] }) <= MAX_RELATIONSHIP_PROMPT_CHARS
  );

  const batches: RelationshipBatch[] = [];

  for (const issueChunk of issueChunks) {
    if (estimateRelationshipPromptSize({ issues: issueChunk, pullRequests }) <= MAX_RELATIONSHIP_PROMPT_CHARS) {
      batches.push({ issues: issueChunk, pullRequests });
      continue;
    }

    const prChunks = chunkItemsToFit(
      pullRequests,
      chunkSize,
      (prChunk) =>
        estimateRelationshipPromptSize({ issues: issueChunk, pullRequests: prChunk }) <= MAX_RELATIONSHIP_PROMPT_CHARS
    );

    for (const prChunk of prChunks) {
      batches.push({ issues: issueChunk, pullRequests: prChunk });
    }
  }

  return batches;
}

export function buildDuplicateAnalysisBatches(
  issues: Issue[],
  chunkSize = BULK_BATCH_SIZE
): DuplicateBatch[] {
  if (issues.length < 2) {
    return [];
  }

  if (estimateDuplicatePromptSize({ primaryIssues: issues, comparisonIssues: issues }) <= MAX_DUPLICATE_PROMPT_CHARS) {
    return [{ primaryIssues: issues, comparisonIssues: issues }];
  }

  const issueChunks = chunkItemsToFit(
    issues,
    chunkSize,
    (issueChunk) =>
      estimateDuplicatePromptSize({ primaryIssues: issueChunk, comparisonIssues: issueChunk }) <= MAX_DUPLICATE_PROMPT_CHARS
  );

  const batches: DuplicateBatch[] = [];

  for (let index = 0; index < issueChunks.length; index++) {
    for (let comparisonIndex = index; comparisonIndex < issueChunks.length; comparisonIndex++) {
      batches.push({
        primaryIssues: issueChunks[index],
        comparisonIssues: issueChunks[comparisonIndex],
      });
    }
  }

  return batches;
}

function buildRelationshipPrompt(batch: RelationshipBatch): string {
  return [
    'Match GitHub issues to pull requests in bulk.',
    'Input keys: n=number, t=title, b=body excerpt, l=labels, f=changed_files, d=draft.',
    'Return JSON only: {"matches":[{"issue_number":123,"pr_number":456,"confidence":0.84,"reason":"short explanation"}]}.',
    'Only include real matches where the PR clearly solves the issue. Confidence must be 0..1. If none, return {"matches":[]}.',
    `issues=${JSON.stringify(batch.issues.map(summarizeIssue))}`,
    `pull_requests=${JSON.stringify(batch.pullRequests.map(summarizePullRequest))}`,
  ].join('\n');
}

function buildDuplicatePrompt(batch: DuplicateBatch): string {
  return [
    'Find duplicate GitHub issues in bulk.',
    'Input keys: n=number, t=title, b=body excerpt, l=labels.',
    'Return JSON only: {"duplicates":[{"issue_number":123,"duplicate_issue_number":456,"confidence":0.76,"reason":"short explanation"}]}.',
    'Only include genuine duplicates. Confidence must be 0..1. issue_number must come from primary_issues, duplicate_issue_number from comparison_issues, and never self-match. If none, return {"duplicates":[]}.',
    `primary_issues=${JSON.stringify(batch.primaryIssues.map(summarizeIssue))}`,
    `comparison_issues=${JSON.stringify(batch.comparisonIssues.map(summarizeIssue))}`,
  ].join('\n');
}

function isFiniteConfidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeRelationshipMatches(matches: unknown, batch: RelationshipBatch): RelationshipMatch[] {
  if (!Array.isArray(matches)) {
    throw new Error('Relationship response was missing a matches array');
  }

  const validIssueNumbers = new Set(batch.issues.map((issue) => issue.github_number));
  const validPrNumbers = new Set(batch.pullRequests.map((pr) => pr.github_number));
  const deduped = new Map<string, RelationshipMatch>();

  for (const match of matches) {
    if (typeof match !== 'object' || match === null) {
      continue;
    }

    const candidate = match as Partial<RelationshipMatch>;
    if (
      typeof candidate.issue_number !== 'number' ||
      typeof candidate.pr_number !== 'number' ||
      !isFiniteConfidence(candidate.confidence) ||
      !validIssueNumbers.has(candidate.issue_number) ||
      !validPrNumbers.has(candidate.pr_number)
    ) {
      continue;
    }

    const normalized: RelationshipMatch = {
      issue_number: candidate.issue_number,
      pr_number: candidate.pr_number,
      confidence: Math.max(0, Math.min(1, candidate.confidence)),
      reason: typeof candidate.reason === 'string' ? candidate.reason : '',
    };

    deduped.set(`${normalized.issue_number}:${normalized.pr_number}`, normalized);
  }

  return [...deduped.values()];
}

function normalizeDuplicateMatches(matches: unknown, batch: DuplicateBatch): DuplicateMatch[] {
  if (!Array.isArray(matches)) {
    throw new Error('Duplicate response was missing a duplicates array');
  }

  const primaryIssueNumbers = new Set(batch.primaryIssues.map((issue) => issue.github_number));
  const comparisonIssueNumbers = new Set(batch.comparisonIssues.map((issue) => issue.github_number));
  const deduped = new Map<string, DuplicateMatch>();

  for (const match of matches) {
    if (typeof match !== 'object' || match === null) {
      continue;
    }

    const candidate = match as Partial<DuplicateMatch>;
    if (
      typeof candidate.issue_number !== 'number' ||
      typeof candidate.duplicate_issue_number !== 'number' ||
      !isFiniteConfidence(candidate.confidence)
    ) {
      continue;
    }

    let primaryNumber = candidate.issue_number;
    let duplicateNumber = candidate.duplicate_issue_number;

    const forwardPair =
      primaryIssueNumbers.has(primaryNumber) && comparisonIssueNumbers.has(duplicateNumber);
    const reversePair =
      primaryIssueNumbers.has(duplicateNumber) && comparisonIssueNumbers.has(primaryNumber);

    if (!forwardPair && reversePair) {
      primaryNumber = candidate.duplicate_issue_number;
      duplicateNumber = candidate.issue_number;
    } else if (!forwardPair) {
      continue;
    }

    if (primaryNumber === duplicateNumber) {
      continue;
    }

    const normalized: DuplicateMatch = {
      issue_number: primaryNumber,
      duplicate_issue_number: duplicateNumber,
      confidence: Math.max(0, Math.min(1, candidate.confidence)),
      reason: typeof candidate.reason === 'string' ? candidate.reason : '',
    };

    deduped.set(`${Math.min(primaryNumber, duplicateNumber)}:${Math.max(primaryNumber, duplicateNumber)}`, normalized);
  }

  return [...deduped.values()];
}

async function analyzeRelationshipBatch(batch: RelationshipBatch): Promise<RelationshipMatch[]> {
  const response = await callOpenCodeGoAPI(buildRelationshipPrompt(batch));
  const parsed = parseModelJsonResponse<RelationshipBatchResponse>(response);
  return normalizeRelationshipMatches(parsed.matches, batch);
}

async function analyzeDuplicateBatch(batch: DuplicateBatch): Promise<DuplicateMatch[]> {
  const response = await callOpenCodeGoAPI(buildDuplicatePrompt(batch));
  const parsed = parseModelJsonResponse<DuplicateBatchResponse>(response);
  return normalizeDuplicateMatches(parsed.duplicates, batch);
}

export async function analyzeIssuePRRelationship(issue: Issue, pr: PullRequest): Promise<AnalysisResult> {
  const [match] = await analyzeRelationshipBatch({
    issues: [issue],
    pullRequests: [pr],
  });

  if (!match) {
    return { solves: false, confidence: 0, reason: 'No strong relationship found' };
  }

  return {
    solves: true,
    confidence: match.confidence,
    reason: match.reason,
  };
}

export async function findDuplicateIssues(issue1: Issue, issue2: Issue): Promise<DuplicateResult> {
  const [match] = await analyzeDuplicateBatch({
    primaryIssues: [issue1],
    comparisonIssues: [issue2],
  });

  if (!match) {
    return { isDuplicate: false, confidence: 0, reason: 'No strong duplicate found' };
  }

  return {
    isDuplicate: true,
    confidence: match.confidence,
    reason: match.reason,
  };
}

function calculateProgress(completedBatches: number, totalBatches: number): number {
  if (totalBatches <= 0) {
    return 100;
  }

  return Math.min(99, Math.max(5, 5 + Math.round((completedBatches / totalBatches) * 90)));
}

export async function runAnalysis(repoId: number, jobId?: number) {
  const { issues: issuesDb, pullRequests: prsDb, relationships: relsDb, duplicates: dupsDb } = await import('./db');

  const analysisJobId = jobId ?? analysisJobs.create(repoId, 'analyze').id;
  const allIssues = issuesDb.getOpenByRepoId(repoId);
  const allPRs = prsDb.getByRepoId(repoId);
  const relationshipBatches = buildRelationshipAnalysisBatches(allIssues, allPRs);
  const duplicateBatches = buildDuplicateAnalysisBatches(allIssues);
  const totalBatches = relationshipBatches.length + duplicateBatches.length;
  let completedBatches = 0;
  let relationshipsCreated = 0;
  let duplicatesCreated = 0;

  try {
    if (totalBatches === 0) {
      analysisJobs.update(analysisJobId, {
        status: 'completed',
        progress: 100,
        result: JSON.stringify({ relationshipsCreated: 0, duplicatesCreated: 0, totalBatches: 0 }),
        completed_at: new Date().toISOString(),
        error: null,
      });

      return analysisJobs.getByRepoId(repoId).find((job) => job.id === analysisJobId);
    }

    analysisJobs.update(analysisJobId, {
      progress: calculateProgress(0, totalBatches),
      error: null,
    });

    const issueByNumber = new Map(allIssues.map((issue) => [issue.github_number, issue] as const));
    const prByNumber = new Map(allPRs.map((pr) => [pr.github_number, pr] as const));
    const seenDuplicatePairs = new Set<string>();

    for (const batch of relationshipBatches) {
      const matches = await analyzeRelationshipBatch(batch);

      for (const match of matches) {
        if (match.confidence < RELATIONSHIP_CONFIDENCE_THRESHOLD) {
          continue;
        }

        const issue = issueByNumber.get(match.issue_number);
        const pr = prByNumber.get(match.pr_number);
        if (!issue || !pr) {
          continue;
        }

        relsDb.create({
          issue_id: issue.id,
          pr_id: pr.id,
          relationship_type: 'solves',
          confidence: match.confidence,
        });
        relationshipsCreated++;
      }

      completedBatches++;
      analysisJobs.update(analysisJobId, {
        progress: calculateProgress(completedBatches, totalBatches),
      });
    }

    for (const batch of duplicateBatches) {
      const matches = await analyzeDuplicateBatch(batch);

      for (const match of matches) {
        if (match.confidence < DUPLICATE_CONFIDENCE_THRESHOLD) {
          continue;
        }

        const issue = issueByNumber.get(match.issue_number);
        const duplicateIssue = issueByNumber.get(match.duplicate_issue_number);
        if (!issue || !duplicateIssue || issue.id === duplicateIssue.id) {
          continue;
        }

        const pairKey = `${Math.min(issue.id, duplicateIssue.id)}:${Math.max(issue.id, duplicateIssue.id)}`;
        if (seenDuplicatePairs.has(pairKey)) {
          continue;
        }
        seenDuplicatePairs.add(pairKey);

        dupsDb.create({
          original_issue_id: Math.min(issue.id, duplicateIssue.id),
          duplicate_issue_id: Math.max(issue.id, duplicateIssue.id),
          confidence: match.confidence,
          reason: match.reason,
        });
        duplicatesCreated++;
      }

      completedBatches++;
      analysisJobs.update(analysisJobId, {
        progress: calculateProgress(completedBatches, totalBatches),
      });
    }

    analysisJobs.update(analysisJobId, {
      status: 'completed',
      progress: 100,
      result: JSON.stringify({
        relationshipsCreated,
        duplicatesCreated,
        relationshipBatches: relationshipBatches.length,
        duplicateBatches: duplicateBatches.length,
      }),
      completed_at: new Date().toISOString(),
      error: null,
    });
  } catch (error) {
    analysisJobs.update(analysisJobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      completed_at: new Date().toISOString(),
    });
  }

  return analysisJobs.getByRepoId(repoId).find((job) => job.id === analysisJobId);
}

export async function isOpenCodeConfigured(): Promise<boolean> {
  loadLocalEnv();
  return Boolean(process.env.OPENCODE_GO_API_KEY?.trim());
}
