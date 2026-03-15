import { NextRequest, NextResponse } from 'next/server';
import { analysisJobs, repos } from '@/app/lib/db';
import { runAnalysis, isCopilotConfigured } from '@/app/lib/copilot';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const repoId = parseInt(id, 10);

    if (Number.isNaN(repoId)) {
      return NextResponse.json({ error: 'Invalid repository id' }, { status: 400 });
    }

    const repo = repos.getById(repoId);
    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    if (!isCopilotConfigured()) {
      return NextResponse.json(
        { error: 'Copilot API is not configured. Set COPILOT_TOKEN in environment variables.' },
        { status: 400 }
      );
    }

    const job = analysisJobs.create(repoId, 'analyze');
    void runAnalysis(repoId, job.id).catch((error) => {
      analysisJobs.update(job.id, {
        status: 'failed',
        error: String(error),
        completed_at: new Date().toISOString(),
      });
    });

    return NextResponse.json({ success: true, job });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
