import { NextRequest } from 'next/server';
import { repos } from '@/app/lib/db';
import { syncRepository } from '@/app/lib/github';

type Params = { params: Promise<{ id: string }> };

type SyncEvent =
  | { type: 'progress'; entityType: 'issue' | 'pr'; current: number; total: number; number: number; repoName: string }
  | { type: 'complete'; issues: number; pullRequests: number }
  | { type: 'error'; error: string };

function encodeEvent(event: SyncEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(_request: NextRequest, { params }: Params) {
  const encoder = new TextEncoder();

  try {
    const { id } = await params;
    const repoId = parseInt(id, 10);
    const repo = await repos.getById(repoId);

    if (!repo) {
      return new Response(JSON.stringify({ error: 'Repository not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const counts = await syncRepository(repoId, repo.owner, repo.name, (entityType, current, total, item) => {
            controller.enqueue(encoder.encode(encodeEvent({
              type: 'progress',
              entityType,
              current,
              total,
              number: item.number,
              repoName: repo.full_name,
            })));
          });

          await repos.update(repoId, {
            open_issues_count: counts.issues,
            open_prs_count: counts.pullRequests,
          });

          controller.enqueue(encoder.encode(encodeEvent({
            type: 'complete',
            issues: counts.issues,
            pullRequests: counts.pullRequests,
          })));
          controller.close();
        } catch (error) {
          controller.enqueue(encoder.encode(encodeEvent({
            type: 'error',
            error: String(error),
          })));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
