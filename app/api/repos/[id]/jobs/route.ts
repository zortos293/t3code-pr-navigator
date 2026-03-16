import { NextRequest, NextResponse } from 'next/server';
import { analysisJobs, repos } from '@/app/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const repoId = parseInt(id, 10);

    if (Number.isNaN(repoId)) {
      return NextResponse.json({ error: 'Invalid repository id' }, { status: 400 });
    }

    const repo = await repos.getById(repoId);
    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    const job = (await analysisJobs.getByRepoId(repoId)).find((entry) => entry.job_type === 'analyze');

    if (!job) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      error: job.error,
      started_at: job.started_at,
      completed_at: job.completed_at,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
