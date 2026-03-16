import { analysisJobs, type Issue, type PullRequest } from './db';

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

const BULK_BATCH_SIZE = 100;
const RELATIONSHIP_CONFIDENCE_THRESHOLD = 0.5;
const DUPLICATE_CONFIDENCE_THRESHOLD = 0.6;
const COPILOT_TIMEOUT_MS = 90_000;
const ISSUE_BODY_LIMIT = 160;
const PR_BODY_LIMIT = 160;

async function callCopilotAPI(prompt: string): Promise<string> {
  const token = process.env.COPILOT_TOKEN;
  if (!token) {
    throw new Error('COPILOT_TOKEN not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COPILOT_TIMEOUT_MS);

  try {
    const response = await fetch('https://models.github.ai/inference/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Copilot-Integration-Id': 'pr-navigator',
      },
      signal: controller.signal,
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content:
              'You analyze GitHub issues and pull requests. Respond with valid JSON only and never wrap it in markdown.',
          },
          { role: 'user', content: prompt },
        ],
        model: 'gpt-5.4',
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Copilot API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Copilot API returned an empty response');
    }

    return content;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Copilot API request timed out after ${COPILOT_TIMEOUT_MS / 1000} seconds`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
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

function summarizeIssue(issue: Issue) {
  return {
    number: issue.github_number,
    title: issue.title,
    body: truncateText(issue.body, ISSUE_BODY_LIMIT),
    labels: parseLabels(issue.labels),
  };
}

function summarizePullRequest(pr: PullRequest) {
  return {
    number: pr.github_number,
    title: pr.title,
    body: truncateText(pr.body, PR_BODY_LIMIT),
    labels: parseLabels(pr.labels),
    additions: pr.additions,
    deletions: pr.deletions,
    changed_files: pr.changed_files,
    draft: Boolean(pr.draft),
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

export function parseCopilotJsonResponse<T>(text: string): T {
  const payload = extractJsonPayload(text);
  if (!payload) {
    throw new Error('Copilot response did not contain valid JSON');
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

export function buildRelationshipAnalysisBatches(
  issues: Issue[],
  pullRequests: PullRequest[],
  chunkSize = BULK_BATCH_SIZE
): RelationshipBatch[] {
  if (issues.length === 0 || pullRequests.length === 0) {
    return [];
  }

  if (issues.length <= pullRequests.length) {
    return chunkItems(pullRequests, chunkSize).map((prChunk) => ({
      issues,
      pullRequests: prChunk,
    }));
  }

  return chunkItems(issues, chunkSize).map((issueChunk) => ({
    issues: issueChunk,
    pullRequests,
  }));
}

export function buildDuplicateAnalysisBatches(
  issues: Issue[],
  chunkSize = BULK_BATCH_SIZE
): DuplicateBatch[] {
  if (issues.length < 2) {
    return [];
  }

  return chunkItems(issues, chunkSize).map((primaryIssues) => ({
    primaryIssues,
    comparisonIssues: issues,
  }));
}

function buildRelationshipPrompt(batch: RelationshipBatch): string {
  return [
    'Analyze these GitHub issues and pull requests in bulk.',
    'Return JSON only with the exact shape {"matches":[{"issue_number":123,"pr_number":456,"confidence":0.84,"reason":"short explanation"}]}.',
    'Only include entries for real issue/PR matches where the PR clearly solves the issue.',
    'Every confidence must be between 0 and 1.',
    'If there are no matches, return {"matches":[]}.',
    '',
    `Issues (${batch.issues.length}):`,
    JSON.stringify(batch.issues.map(summarizeIssue), null, 2),
    '',
    `Pull requests (${batch.pullRequests.length}):`,
    JSON.stringify(batch.pullRequests.map(summarizePullRequest), null, 2),
  ].join('\n');
}

function buildDuplicatePrompt(batch: DuplicateBatch): string {
  return [
    'Analyze these GitHub issues in bulk and find duplicates.',
    'Return JSON only with the exact shape {"duplicates":[{"issue_number":123,"duplicate_issue_number":456,"confidence":0.76,"reason":"short explanation"}]}.',
    'Only include entries when the two issues are genuine duplicates.',
    'Every confidence must be between 0 and 1.',
    'Only use issue_number values from the primary issue list for issue_number.',
    'Use issue_number values from the comparison issue list for duplicate_issue_number.',
    'Do not return self-matches.',
    'If there are no duplicates, return {"duplicates":[]}.',
    '',
    `Primary issue list (${batch.primaryIssues.length}):`,
    JSON.stringify(batch.primaryIssues.map(summarizeIssue), null, 2),
    '',
    `Comparison issue list (${batch.comparisonIssues.length}):`,
    JSON.stringify(batch.comparisonIssues.map(summarizeIssue), null, 2),
  ].join('\n');
}

function isFiniteConfidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeRelationshipMatches(matches: unknown, batch: RelationshipBatch): RelationshipMatch[] {
  if (!Array.isArray(matches)) {
    throw new Error('Copilot relationship response was missing a matches array');
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
    throw new Error('Copilot duplicate response was missing a duplicates array');
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
  const response = await callCopilotAPI(buildRelationshipPrompt(batch));
  const parsed = parseCopilotJsonResponse<RelationshipBatchResponse>(response);
  return normalizeRelationshipMatches(parsed.matches, batch);
}

async function analyzeDuplicateBatch(batch: DuplicateBatch): Promise<DuplicateMatch[]> {
  const response = await callCopilotAPI(buildDuplicatePrompt(batch));
  const parsed = parseCopilotJsonResponse<DuplicateBatchResponse>(response);
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
  const allIssues = issuesDb.getByRepoId(repoId);
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

export function isCopilotConfigured(): boolean {
  return !!process.env.COPILOT_TOKEN;
}
