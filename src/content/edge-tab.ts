import { snapSide, clampOffset, getEdgeTabPosition, setEdgeTabPosition } from '@/lib/edge-tab-position';
import { extractOpeningLines } from '@/lib/opening-lines';

const TAB_HEIGHT = 220;
const TAB_WIDTH = 40;

async function init() {
  if (window.top !== window) return; // only the top frame gets an edge tab

  const host = document.createElement('div');
  host.id = 'personal-home-base-edge-tab-host';
  host.style.cssText = 'position:fixed;top:0;z-index:2147483647;';
  document.documentElement.append(host);

  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>${STYLES}</style>
    <div class="tab" id="tab">
      <div class="handle" id="handle">⋮</div>
      <div class="panel" id="panel" hidden>
        <button data-action="read-later">Save to Read Later</button>
        <button data-action="reading-view">Open Reading View</button>
        <button data-action="bookmark">Bookmark this page</button>
        <button data-action="tidy">Tidy tabs</button>
        <button data-action="dedupe">Close duplicates</button>
        <button data-action="screenshot">Take a screenshot</button>
      </div>
    </div>
  `;

  const tabEl = shadow.getElementById('tab')!;
  const handleEl = shadow.getElementById('handle')!;
  const panelEl = shadow.getElementById('panel')!;

  const position = await getEdgeTabPosition(chrome.storage.local);
  applyPosition(host, tabEl, position);

  handleEl.addEventListener('click', () => {
    panelEl.hidden = !panelEl.hidden;
  });

  setupDrag(host, tabEl, handleEl);

  shadow.getElementById('panel')!.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest('button');
    if (!button) return;
    handleAction(button.dataset.action!);
  });
}

function applyPosition(host: HTMLElement, tabEl: HTMLElement, position: { side: 'left' | 'right'; offset: number }) {
  host.style.left = position.side === 'left' ? '0' : 'auto';
  host.style.right = position.side === 'right' ? '0' : 'auto';
  host.style.top = `${position.offset}px`;
  tabEl.classList.toggle('side-left', position.side === 'left');
  tabEl.classList.toggle('side-right', position.side === 'right');
}

function setupDrag(host: HTMLElement, tabEl: HTMLElement, handleEl: HTMLElement) {
  let dragging = false;

  handleEl.addEventListener('pointerdown', (e) => {
    dragging = true;
    handleEl.setPointerCapture(e.pointerId);
  });

  handleEl.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const offset = clampOffset(e.clientY - TAB_HEIGHT / 2, window.innerHeight, TAB_HEIGHT);
    host.style.top = `${offset}px`;
  });

  handleEl.addEventListener('pointerup', async (e) => {
    if (!dragging) return;
    dragging = false;

    const side = snapSide(e.clientX, window.innerWidth);
    const offset = clampOffset(e.clientY - TAB_HEIGHT / 2, window.innerHeight, TAB_HEIGHT);
    const position = { side, offset };

    applyPosition(host, tabEl, position);
    await setEdgeTabPosition(chrome.storage.local, position);
  });
}

async function handleAction(action: string) {
  switch (action) {
    case 'read-later': {
      const { saveForLater } = await import('@/lib/read-later-store');
      const { createIndexedDbReadLaterRepo } = await import('@/db/read-later-repo');
      const preview = extractOpeningLines(document) ?? 'No preview available for this page.';
      await saveForLater(
        createIndexedDbReadLaterRepo(),
        window.location.href,
        document.title,
        preview,
        Date.now(),
        !extractOpeningLines(document),
      );
      break;
    }
    case 'reading-view': {
      chrome.runtime.sendMessage({ type: 'open-reading-view' });
      break;
    }
    case 'bookmark': {
      chrome.runtime.sendMessage({ type: 'bookmark-page', title: document.title, url: window.location.href });
      break;
    }
    case 'tidy': {
      chrome.runtime.sendMessage({ type: 'tidy-tabs' });
      break;
    }
    case 'dedupe': {
      chrome.runtime.sendMessage({ type: 'close-duplicates' });
      break;
    }
    case 'screenshot': {
      chrome.runtime.sendMessage({ type: 'take-screenshot' });
      break;
    }
  }
}

const STYLES = `
  .tab {
    display: flex;
    align-items: center;
    background: #2a2a2a;
    color: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    overflow: hidden;
  }
  .tab.side-left { flex-direction: row-reverse; border-radius: 0 8px 8px 0; }
  .tab.side-right { border-radius: 8px 0 0 8px; }
  .handle {
    width: ${TAB_WIDTH}px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    font-size: 16px;
    touch-action: none;
    user-select: none;
  }
  .panel {
    display: flex;
    flex-direction: column;
    padding: 6px;
    gap: 4px;
    width: 170px;
  }
  .panel button {
    background: rgba(255,255,255,0.08);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 10px;
    text-align: left;
    font-size: 12px;
    cursor: pointer;
  }
  .panel button:hover {
    background: rgba(255,255,255,0.18);
  }
`;

void init();
