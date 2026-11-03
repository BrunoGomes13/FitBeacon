import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sourceExtensions = new Set(['.ts', '.tsx', '.css', '.json', '.html']);
const deprecatedColor = ['#c8ff', '3d'].join('');

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return sourceExtensions.has(path.slice(path.lastIndexOf('.')).toLowerCase()) ? [path] : [];
  });
}

describe('FitBeacon brand tokens', () => {
  it('does not leave the deprecated lime color in app or web source', () => {
    const files = [
      ...sourceFiles(resolve(root, 'app', 'app')),
      ...sourceFiles(resolve(root, 'app', 'src')),
      ...sourceFiles(resolve(root, 'web', 'src')),
      resolve(root, 'app', 'app.json'),
      resolve(root, 'web', 'index.html'),
    ];
    const matches = files.filter((file) =>
      readFileSync(file, 'utf8').toLowerCase().includes(deprecatedColor),
    );

    expect(matches).toEqual([]);
  });

  it('uses the brand backgrounds and contrast-safe secondary text tokens', () => {
    const tokens = readFileSync(resolve(root, 'web', 'src', 'design', 'tokens.css'), 'utf8');

    expect(tokens).toContain('--background: #040b14');
    expect(tokens).toContain('--surface: #071b30');
    expect(tokens).toContain('--text-muted: #8fa3ba');
    expect(tokens).toContain('--primary-gradient: linear-gradient');
  });
});
