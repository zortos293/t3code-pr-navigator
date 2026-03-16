import { NextRequest, NextResponse } from 'next/server';
import { repos } from '@/app/lib/db';
import { parseGitHubUrl, fetchRepository, syncRepository } from '@/app/lib/github';

export async function GET() {
  try {
    const allRepos = repos.getAll();
    return NextResponse.json(allRepos);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 });
    }

    const existing = repos.getByFullName(`${parsed.owner}/${parsed.name}`);
    if (existing) {
      return NextResponse.json({ error: 'Repository already added', repo: existing }, { status: 409 });
    }

    const ghRepo = await fetchRepository(parsed.owner, parsed.name);

    const repo = repos.create({
      owner: ghRepo.owner,
      name: ghRepo.name,
      full_name: ghRepo.full_name,
      description: ghRepo.description,
      stars: ghRepo.stargazers_count,
      open_issues_count: 0,
      open_prs_count: 0,
    });

    const counts = await syncRepository(repo.id, repo.owner, repo.name);
    const updated = repos.update(repo.id, {
      open_issues_count: counts.issues,
      open_prs_count: counts.pullRequests,
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Not Found')) {
      return NextResponse.json({ error: 'Repository not found on GitHub' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
