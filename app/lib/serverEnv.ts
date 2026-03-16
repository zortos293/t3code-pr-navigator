import fs from 'node:fs';
import path from 'node:path';

let didLoadLocalEnv = false;

function parseEnvValue(rawValue: string): string {
  const value = rawValue.trim();
  if (value.length >= 2) {
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
      return value
        .slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
    }
  }

  return value;
}

function applyEnvLine(line: string): void {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return;
  }

  const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trimStart() : trimmed;
  const separatorIndex = normalized.indexOf('=');
  if (separatorIndex <= 0) {
    return;
  }

  const key = normalized.slice(0, separatorIndex).trim();
  if (!key || process.env[key] !== undefined) {
    return;
  }

  process.env[key] = parseEnvValue(normalized.slice(separatorIndex + 1));
}

export function loadLocalEnv(): void {
  if (didLoadLocalEnv) {
    return;
  }

  didLoadLocalEnv = true;
  for (const envFileName of ['.local.env', '.env.local', '.env']) {
    const envPath = path.resolve(process.cwd(), envFileName);
    if (!fs.existsSync(envPath)) {
      continue;
    }

    const contents = fs.readFileSync(envPath, 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      applyEnvLine(line);
    }
  }
}
