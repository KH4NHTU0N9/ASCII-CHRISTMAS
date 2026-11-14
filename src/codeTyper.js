import { clamp } from './math.js';
import { highlightLineToHtml } from './syntaxHighlighter.js';

/**
 * Renders live auto-typing source code synced to animation elapsed time,
 * displaying line numbers, syntax colors, and an active red block cursor.
 */
export class CodeTyper {
  constructor(containerEl, sourceText, durationSec = 19.5) {
    this.containerEl = containerEl;
    this.sourceText = sourceText.replace(/\r\n/g, '\n');
    this.durationSec = Math.max(1, durationSec);
    this.lastCharCount = -1;
    this.autoScrollEnabled = true;

    this.containerEl.addEventListener('wheel', () => {
      const { scrollTop, scrollHeight, clientHeight } = this.containerEl;
      const nearBottom = scrollHeight - scrollTop - clientHeight < 48;
      this.autoScrollEnabled = nearBottom;
    }, { passive: true });
  }

  setSource(newSource) {
    this.sourceText = newSource.replace(/\r\n/g, '\n');
    this.lastCharCount = -1;
  }

  reset() {
    this.lastCharCount = -1;
    this.autoScrollEnabled = true;
    this.containerEl.scrollTop = 0;
  }

  /**
   * Updates the DOM to reveal characters proportional to elapsedSec.
   */
  update(elapsedSec) {
    const progress = clamp(elapsedSec / this.durationSec, 0, 1);
    const totalChars = this.sourceText.length;
    const charCount = progress >= 1 ? totalChars : Math.floor(totalChars * progress);

    if (charCount === this.lastCharCount) return;
    this.lastCharCount = charCount;

    const visibleSlice = this.sourceText.slice(0, charCount);
    const lines = visibleSlice.split('\n');
    const padWidth = String(this.sourceText.split('\n').length).length;

    const rowsHtml = new Array(lines.length);
    for (let i = 0; i < lines.length; i++) {
      const lineNum = String(i + 1).padStart(padWidth, ' ');
      const isLast = i === lines.length - 1;
      const contentHtml = highlightLineToHtml(lines[i], isLast);
      const activeCls = isLast ? ' code-line-active' : '';
      rowsHtml[i] = `<div class="code-line${activeCls}"><span class="line-no">${lineNum}</span><span class="line-code">${contentHtml}</span></div>`;
    }

    this.containerEl.innerHTML = rowsHtml.join('');

    if (this.autoScrollEnabled) {
      this.containerEl.scrollTop = this.containerEl.scrollHeight;
    }
  }
}
