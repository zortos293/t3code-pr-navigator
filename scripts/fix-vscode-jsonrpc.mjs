import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const packageJsonPath = path.join(process.cwd(), 'node_modules', 'vscode-jsonrpc', 'package.json');

async function main() {
  let source;

  try {
    source = await readFile(packageJsonPath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }

    throw error;
  }

  const packageJson = JSON.parse(source);

  if (
    packageJson.exports?.['./node'] &&
    packageJson.exports?.['./node.js'] &&
    packageJson.exports?.['./browser'] &&
    packageJson.exports?.['./browser.js']
  ) {
    return;
  }

  packageJson.exports = {
    '.': packageJson.exports?.['.'] ?? './node.js',
    './node': './node.js',
    './node.js': './node.js',
    './browser': './browser.js',
    './browser.js': './browser.js',
    './package.json': './package.json',
  };

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, '\t')}\n`, 'utf8');
}

await main();
