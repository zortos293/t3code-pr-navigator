import type { Issue, PullRequest } from './db';

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

async function callCopilotAPI(prompt: string): Promise<string> {
  const token = process.env.COPILOT_TOKEN;
  if (!token) {
    throw new Error('COPILOT_TOKEN not configured');
  }

  const response = await fetch('https://api.githubcopilot.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Copilot-Integration-Id': 'pr-navigator',
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing GitHub issues and pull requests. Always respond with valid JSON only, no markdown.',
        },
        { role: 'user', content: prompt },
      ],
      model: 'gpt-5.4',
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Copilot API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseJsonResponse<T>(text: string): T | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // parse failed
  }
  return null;
}

export async function analyzeIssuePRRelationship(
  issue: Issue,
  pr: PullRequest
): Promise<AnalysisResult> {
  const prompt = `Analyze if this Pull Request solves the given Issue.

Issue #${issue.github_number}: "${issue.title}"
${issue.body ? `Description: ${issue.body.slice(0, 500)}` : ''}

Pull Request #${pr.github_number}: "${pr.title}"
${pr.body ? `Description: ${pr.body.slice(0, 500)}` : ''}

Respond with JSON: { "solves": boolean, "confidence": number (0-1), "reason": string }`;

  try {
    const response = await callCopilotAPI(prompt);
    const result = parseJsonResponse<AnalysisResult>(response);
    return result || { solves: false, confidence: 0, reason: 'Failed to parse response' };
  } catch (error) {
    return { solves: false, confidence: 0, reason: `API error: ${error}` };
  }
}

export async function findDuplicateIssues(
  issue1: Issue,
  issue2: Issue
): Promise<DuplicateResult> {
  const prompt = `Determine if these two GitHub issues are duplicates of each other.

Issue #${issue1.github_number}: "${issue1.title}"
${issue1.body ? `Description: ${issue1.body.slice(0, 400)}` : ''}

Issue #${issue2.github_number}: "${issue2.title}"
${issue2.body ? `Description: ${issue2.body.slice(0, 400)}` : ''}

Respond with JSON: { "isDuplicate": boolean, "confidence": number (0-1), "reason": string }`;

  try {
    const response = await callCopilotAPI(prompt);
    const result = parseJsonResponse<DuplicateResult>(response);
    return result || { isDuplicate: false, confidence: 0, reason: 'Failed to parse response' };
  } catch (error) {
    return { isDuplicate: false, confidence: 0, reason: `API error: ${error}` };
  }
}

export async function runAnalysis(repoId: number) {
  const { issues: issuesDb, pullRequests: prsDb, relationships: relsDb, duplicates: dupsDb, analysisJobs } = await import('./db');

  const job = analysisJobs.create(repoId, 'analyze');
  const allIssues = issuesDb.getByRepoId(repoId);
  const allPRs = prsDb.getByRepoId(repoId);

  const totalPairs = allIssues.length * allPRs.length;
  const issuePairs = (allIssues.length * (allIssues.length - 1)) / 2;
  const totalWork = totalPairs + issuePairs;
  let completed = 0;

  try {
    for (const issue of allIssues) {
      for (const pr of allPRs) {
        const result = await analyzeIssuePRRelationship(issue, pr);
        if (result.solves && result.confidence > 0.5) {
          relsDb.create({
            issue_id: issue.id,
            pr_id: pr.id,
            relationship_type: 'solves',
            confidence: result.confidence,
          });
        }
        completed++;
        analysisJobs.update(job.id, {
          progress: Math.round((completed / totalWork) * 100),
        });
      }
    }

    for (let i = 0; i < allIssues.length; i++) {
      for (let j = i + 1; j < allIssues.length; j++) {
        const result = await findDuplicateIssues(allIssues[i], allIssues[j]);
        if (result.isDuplicate && result.confidence > 0.6) {
          dupsDb.create({
            original_issue_id: allIssues[i].id,
            duplicate_issue_id: allIssues[j].id,
            confidence: result.confidence,
            reason: result.reason,
          });
        }
        completed++;
        analysisJobs.update(job.id, {
          progress: Math.round((completed / totalWork) * 100),
        });
      }
    }

    analysisJobs.update(job.id, {
      status: 'completed',
      progress: 100,
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    analysisJobs.update(job.id, {
      status: 'failed',
      error: String(error),
      completed_at: new Date().toISOString(),
    });
  }

  return job;
}

export function isCopilotConfigured(): boolean {
  return !!process.env.COPILOT_TOKEN;
}
