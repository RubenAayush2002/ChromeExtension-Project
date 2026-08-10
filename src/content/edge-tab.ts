import { snapSide, clampOffset, getEdgeTabPosition, setEdgeTabPosition } from '@/lib/edge-tab-position';
import { extractOpeningLines } from '@/lib/opening-lines';
import { initAiInlineFeatures } from './ai-inline';

const HANDLE_HEIGHT = 60; // must match .handle's height in STYLES
const TAB_WIDTH = 40;
const DRAG_THRESHOLD_PX = 4; // movement beyond this counts as a drag, not a click

async function init() {
  if (window.top !== window) return; // only the top frame gets an edge tab

  const host = document.createElement('div');
  host.id = 'zerodrift-edge-tab-host';
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

  const wasDragged = setupDrag(host, tabEl, handleEl);

  handleEl.addEventListener('click', () => {
    if (wasDragged()) return; // the click that ends a drag shouldn't toggle
    panelEl.hidden = !panelEl.hidden;
  });

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

/** Sets up dragging, and returns a predicate telling the click handler whether
 *  the gesture that just ended was a drag (so it shouldn't also toggle the
 *  panel). pointerdown/pointerup and click both fire on the handle, so without
 *  this every drag would also open or close the panel on release. */
function setupDrag(host: HTMLElement, tabEl: HTMLElement, handleEl: HTMLElement): () => boolean {
  let pointerDownY: number | null = null;
  let didDrag = false;

  handleEl.addEventListener('pointerdown', (e) => {
    pointerDownY = e.clientY;
    didDrag = false;
    handleEl.setPointerCapture(e.pointerId);
  });

  handleEl.addEventListener('pointermove', (e) => {
    if (pointerDownY === null) return;
    if (!didDrag && Math.abs(e.clientY - pointerDownY) < DRAG_THRESHOLD_PX) return;

    didDrag = true;
    host.style.top = `${clampOffset(e.clientY - HANDLE_HEIGHT / 2, window.innerHeight, HANDLE_HEIGHT)}px`;
  });

  handleEl.addEventListener('pointerup', async (e) => {
    if (pointerDownY === null) return;
    pointerDownY = null;
    if (!didDrag) return; // a plain click — leave it to the panel toggle

    const position = {
      side: snapSide(e.clientX, window.innerWidth),
      offset: clampOffset(e.clientY - HANDLE_HEIGHT / 2, window.innerHeight, HANDLE_HEIGHT),
    };

    applyPosition(host, tabEl, position);
    await setEdgeTabPosition(chrome.storage.local, position);
  });

  return () => didDrag;
}

async function handleAction(action: string) {
  switch (action) {
    case 'read-later': {
      // The preview must be extracted here (only the content script can see
      // the live DOM), but persistence has to happen in the service worker:
      // an IndexedDB opened from a content script belongs to the *host page's*
      // origin, so items saved here would be invisible to the extension's own
      // pages. Static import + sendMessage — a dynamic import() in this IIFE
      // bundle would resolve against the page's origin and throw.
      const extracted = extractOpeningLines(document);
      chrome.runtime.sendMessage({
        type: 'save-read-later',
        url: window.location.href,
        title: document.title,
        preview: extracted ?? 'No preview available for this page.',
        previewIsFallback: extracted === null,
      });
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
  /* Beats the UA stylesheet's [hidden] { display: none } at equal specificity,
     so the panel would stay open forever without this. Same class of bug as
     the new tab page's Focus Mode overlay. */
  .panel[hidden] {
    display: none;
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
initAiInlineFeatures();
