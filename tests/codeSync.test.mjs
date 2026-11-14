import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FALLBACK_SOURCE } from '../src/codeSource.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('FALLBACK_SOURCE matches src/treeEngine.js verbatim', () => {
  const diskText = readFileSync(
    join(__dirname, '..', 'src', 'treeEngine.js'),
    'utf8'
  ).replace(/\r\n/g, '\n');

  assert.equal(FALLBACK_SOURCE.trimEnd(), diskText.trimEnd());
});
