const KEYWORDS = new Set([
  'import', 'from', 'export', 'const', 'let', 'var', 'function', 'return',
  'if', 'else', 'for', 'while', 'new', 'class', 'true', 'false', 'null',
]);

const BUILTINS = new Set([
  'Math', 'CONFIG', 'PART_KINDS', 'PartsBuffer', 'Object', 'Float32Array',
  'Uint8Array', 'Array', 'Number', 'String',
]);

export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Tokenizes a single line of JavaScript into typed spans for syntax highlighting.
 * @param {string} line
 * @returns {Array<{ type: string, text: string }>}
 */
export function tokenizeLine(line) {
  const tokens = [];
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    // Single-line comment
    if (ch === '/' && line[i + 1] === '/') {
      tokens.push({ type: 'comment', text: line.slice(i) });
      break;
    }

    // String literals (' or " or `)
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === '\\' && j + 1 < line.length) {
          j += 2;
          continue;
        }
        if (line[j] === quote) {
          j++;
          break;
        }
        j++;
      }
      tokens.push({ type: 'string', text: line.slice(i, j) });
      i = j;
      continue;
    }

    // Numeric literal
    if (/[0-9]/.test(ch) && (i === 0 || !/[A-Za-z0-9_$]/.test(line[i - 1]))) {
      let j = i;
      while (j < line.length && /[0-9.eExX_]/.test(line[j])) j++;
      tokens.push({ type: 'number', text: line.slice(i, j) });
      i = j;
      continue;
    }

    // Identifier / keyword / function call
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /[A-Za-z0-9_$]/.test(line[j])) j++;
      const word = line.slice(i, j);
      let type = 'ident';
      if (KEYWORDS.has(word)) {
        type = 'keyword';
      } else if (BUILTINS.has(word)) {
        type = 'builtin';
      } else if (line[j] === '(') {
        type = 'fn';
      } else if (/^[A-Z0-9_]+$/.test(word) && word.length > 1) {
        type = 'const';
      }
      tokens.push({ type, text: word });
      i = j;
      continue;
    }

    // Whitespace or punctuation
    let j = i + 1;
    while (
      j < line.length &&
      !/[A-Za-z0-9_$'"`/]/.test(line[j])
    ) {
      j++;
    }
    tokens.push({ type: 'punct', text: line.slice(i, j) });
    i = j;
  }

  return tokens;
}

/**
 * Renders a tokenized JS line into safe HTML spans, optionally appending a block cursor.
 */
export function highlightLineToHtml(line, withCursor = false) {
  const tokens = tokenizeLine(line);
  let html = '';
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const safe = escapeHtml(tok.text);
    html += tok.type === 'punct'
      ? safe
      : `<span class="tok-${tok.type}">${safe}</span>`;
  }
  if (withCursor) {
    html += '<span class="code-cursor" aria-hidden="true"></span>';
  }
  return html || (withCursor ? '<span class="code-cursor" aria-hidden="true"></span>' : '&nbsp;');
}
