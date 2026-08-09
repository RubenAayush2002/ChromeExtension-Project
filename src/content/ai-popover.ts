/** Shadow-DOM popover used by the two in-page AI-only features (§10.3):
 *  explain-highlighted-text and hold-key word lookup. Isolated from host-page
 *  CSS the same way the edge tab is, and positioned near the text it describes. */

export const POPOVER_HOST_ID = 'personal-home-base-ai-popover';
const MAX_WIDTH = 320;
const VIEWPORT_MARGIN = 8;

export interface PopoverHandle {
  showLoading(anchor: DOMRect, label: string): void;
  showMessage(anchor: DOMRect, message: string, options?: { action?: { label: string; onClick: () => void } }): void;
  hide(): void;
  /** Timestamp of the most recent show, so callers can avoid dismissing a
   *  popover that was opened by the very interaction being handled. */
  lastShownAt(): number;
}

const STYLES = `
  .popover {
    position: fixed;
    max-width: ${MAX_WIDTH}px;
    background: #1f1f1f;
    color: #f2f2f2;
    border-radius: 10px;
    padding: 12px 14px;
    font: 13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
    z-index: 2147483647;
  }
  /* Beats the UA stylesheet's [hidden] rule, which this class would otherwise
     override at equal specificity. */
  .popover[hidden] { display: none; }
  .body { margin: 0; white-space: pre-wrap; }
  .action {
    margin-top: 10px;
    background: rgba(255, 255, 255, 0.1);
    color: inherit;
    border: none;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  .action:hover { background: rgba(255, 255, 255, 0.2); }
`;

/** Creates the popover once and returns handles to drive it. The host element
 *  and its listeners persist for the page's lifetime — only text content
 *  changes between shows, so no listener is ever rebound or dropped. */
export function createAiPopover(): PopoverHandle {
  const host = document.createElement('div');
  host.id = POPOVER_HOST_ID;
  document.documentElement.append(host);

  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>${STYLES}</style>
    <div class="popover" id="popover" hidden>
      <p class="body" id="body"></p>
      <button class="action" id="action" hidden></button>
    </div>
  `;

  const popoverEl = shadow.getElementById('popover') as HTMLElement;
  const bodyEl = shadow.getElementById('body') as HTMLElement;
  const actionEl = shadow.getElementById('action') as HTMLButtonElement;

  // Bound once; the callback it invokes is swapped per show.
  let actionHandler: (() => void) | null = null;
  actionEl.addEventListener('click', () => actionHandler?.());

  function position(anchor: DOMRect) {
    // Placed below the anchor, nudged back inside the viewport if it would
    // overflow either edge.
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, anchor.left),
      window.innerWidth - MAX_WIDTH - VIEWPORT_MARGIN,
    );
    popoverEl.style.left = `${Math.max(VIEWPORT_MARGIN, left)}px`;
    popoverEl.style.top = `${anchor.bottom + VIEWPORT_MARGIN}px`;
  }

  let shownAt = 0;

  function show(anchor: DOMRect, text: string) {
    bodyEl.textContent = text;
    popoverEl.hidden = false;
    shownAt = Date.now();
    position(anchor);
  }

  return {
    showLoading(anchor, label) {
      actionEl.hidden = true;
      actionHandler = null;
      show(anchor, label);
    },

    showMessage(anchor, message, options) {
      show(anchor, message);
      if (options?.action) {
        actionEl.hidden = false;
        actionEl.textContent = options.action.label;
        actionHandler = options.action.onClick;
      } else {
        actionEl.hidden = true;
        actionHandler = null;
      }
    },

    hide() {
      popoverEl.hidden = true;
      actionHandler = null;
    },

    lastShownAt: () => shownAt,
  };
}
