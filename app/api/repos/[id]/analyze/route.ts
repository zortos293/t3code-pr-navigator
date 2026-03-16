import { NextRequest, NextResponse } from 'next/server';
import { analysisJobs, repos } from '@/app/lib/db';
import { runAnalysis, isOpenCodeConfigured } from '@/app/lib/opencode';

type Params = { params: Promise<{ id: string }> };
export const runtime = 'nodejs';

export async function POST(_request: NextRequest, { params }: Params) {
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

    if (!(await isOpenCodeConfigured())) {
      return NextResponse.json(
        { error: 'OpenCode Go is not configured. Set OPENCODE_GO_API_KEY in .local.env or .env.local.' },
        { status: 400 }
      );
    }

    const job = await analysisJobs.create(repoId, 'analyze');
    void runAnalysis(repoId, job.id).catch((error) => {
      void analysisJobs.update(job.id, {
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
