import { NextRequest, NextResponse } from 'next/server';
import { relationships } from '@/app/lib/db';

export async function GET(request: NextRequest) {
  try {
    const repoId = request.nextUrl.searchParams.get('repo_id');
    if (repoId) {
      return NextResponse.json(await relationships.getByRepoId(parseInt(repoId, 10)));
    }
    return NextResponse.json(await relationships.getAll());
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { issue_id, pr_id, relationship_type, confidence } = body;

    if (!issue_id || !pr_id) {
      return NextResponse.json({ error: 'issue_id and pr_id are required' }, { status: 400 });
    }

    const rel = await relationships.create({
      issue_id,
      pr_id,
      relationship_type: relationship_type || 'solves',
      confidence: confidence || 1.0,
    });

    return NextResponse.json(rel, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    await relationships.delete(parseInt(id, 10));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
