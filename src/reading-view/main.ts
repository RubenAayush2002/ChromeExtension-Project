import { extractFromTab } from '@/lib/page-extract-client';
import { estimatedReadingMinutes } from '@/lib/reading-extract';

const FONT_STEP = 2;
const MIN_FONT = 14;
const MAX_FONT = 32;

function getTabId(): number | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('tabId');
  return raw ? Number(raw) : null;
}

function renderUnparseable() {
  document.getElementById('content')!.innerHTML =
    '<p class="unparseable-message">This page doesn\'t look like an article — couldn\'t find a clear, readable layout to show here.</p>';
  document.getElementById('reading-time')!.textContent = '';
}

function renderArticle(title: string, contentHtml: string, wordCount: number) {
  const content = document.getElementById('content')!;
  content.innerHTML = `<h1>${escapeHtml(title)}</h1>${contentHtml}`;
  document.getElementById('reading-time')!.textContent = `${estimatedReadingMinutes(wordCount)} min read`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setupFontControls() {
  let size = 19;
  const root = document.documentElement;

  document.getElementById('font-smaller')!.addEventListener('click', () => {
    size = Math.max(MIN_FONT, size - FONT_STEP);
    root.style.setProperty('--font-size', `${size}px`);
  });

  document.getElementById('font-larger')!.addEventListener('click', () => {
    size = Math.min(MAX_FONT, size + FONT_STEP);
    root.style.setProperty('--font-size', `${size}px`);
  });
}

async function main() {
  setupFontControls();

  const tabId = getTabId();
  if (tabId === null) {
    renderUnparseable();
    return;
  }

  const result = await extractFromTab(tabId);
  if (!result?.article) {
    renderUnparseable();
    return;
  }

  renderArticle(result.article.title, result.article.contentHtml, result.article.wordCount);
}

void main();
