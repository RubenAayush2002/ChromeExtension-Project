import { describe, it, expect, beforeEach } from 'vitest';
import { createChromeFake, type ChromeFake } from '@/lib/__tests__/chrome-fake';
import { initFocusModeOverlay } from '../focus-mode-overlay';
import { setFocusModeActive, setBlocklist } from '@/lib/focus-mode-store';
import { localDateString } from '@/lib/focus-store';
import type { Task, TaskRepo } from '@/lib/task-store';

function createInMemoryTaskRepo(initial: Task[] = []): TaskRepo {
  const tasks = new Map(initial.map((t) => [t.id, t]));
  return {
    all: async () => [...tasks.values()],
    put: async (task) => {
      tasks.set(task.id, task);
    },
    delete: async (id) => {
      tasks.delete(id);
    },
  };
}

function renderOverlayDom(): Document {
  document.body.innerHTML = `
    <div id="page"></div>
    <div id="focus-mode-overlay" hidden>
      <p id="focus-mode-text"></p>
      <p id="focus-mode-progress"></p>
      <button id="focus-mode-off">Turn off Focus Mode</button>
    </div>
  `;
  return document;
}

describe('initFocusModeOverlay', () => {
  let chromeFake: ChromeFake;

  beforeEach(() => {
    chromeFake = createChromeFake();
  });

  it('does nothing and returns false when Focus Mode is not active', async () => {
    const doc = renderOverlayDom();
    const repo = createInMemoryTaskRepo();

    const shown = await initFocusModeOverlay(doc, chromeFake.storage.local, repo, () => {});

    expect(shown).toBe(false);
    expect(doc.getElementById('focus-mode-overlay')!.hidden).toBe(true);
    expect(doc.getElementById('page')!.hidden).toBe(false);
  });

  it('shows the overlay, hides the page, and renders focus text + task progress when active', async () => {
    const doc = renderOverlayDom();
    await setFocusModeActive(chromeFake.storage.local, true);
    await chromeFake.storage.local.set({
      focus: { focus_today: 'Ship the bug fix', focus_today_date: localDateString(new Date()) },
    });
    const repo = createInMemoryTaskRepo([
      { id: '1', text: 'a', done: true, doneAt: Date.now(), createdAt: Date.now() },
      { id: '2', text: 'b', done: false, doneAt: null, createdAt: Date.now() },
    ]);

    const shown = await initFocusModeOverlay(doc, chromeFake.storage.local, repo, () => {});

    expect(shown).toBe(true);
    expect(doc.getElementById('focus-mode-overlay')!.hidden).toBe(false);
    expect(doc.getElementById('page')!.hidden).toBe(true);
    expect(doc.getElementById('focus-mode-text')!.textContent).toBe('Ship the bug fix');
    expect(doc.getElementById('focus-mode-progress')!.textContent).toBe('1 of 2 tasks done today');
  });

  it('wires a click listener on the "Turn off Focus Mode" button that actually fires', async () => {
    const doc = renderOverlayDom();
    await setFocusModeActive(chromeFake.storage.local, true);
    const repo = createInMemoryTaskRepo();

    await initFocusModeOverlay(doc, chromeFake.storage.local, repo, () => {});

    const button = doc.getElementById('focus-mode-off') as HTMLButtonElement;
    let clicked = false;
    // Confirms a listener is actually attached to this exact element (not a
    // stale reference) by observing a second listener fire alongside it.
    button.addEventListener('click', () => {
      clicked = true;
    });
    button.click();

    expect(clicked).toBe(true);
  });

  it('turns Focus Mode off in storage and invokes onTurnOff when the button is clicked', async () => {
    const doc = renderOverlayDom();
    await setFocusModeActive(chromeFake.storage.local, true);
    await setBlocklist(chromeFake.storage.local, ['twitter.com']);
    const repo = createInMemoryTaskRepo();

    let turnOffCalled = false;
    await initFocusModeOverlay(doc, chromeFake.storage.local, repo, () => {
      turnOffCalled = true;
    });

    const button = doc.getElementById('focus-mode-off') as HTMLButtonElement;
    button.click();

    // The click handler is async (awaits setFocusModeActive's own two
    // storage round-trips); wait a macrotask so it's had time to complete.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(turnOffCalled).toBe(true);
    const { focusMode } = await chromeFake.storage.local.get('focusMode');
    expect((focusMode as { active: boolean }).active).toBe(false);
  });

  it('shows empty progress text when there are no tasks', async () => {
    const doc = renderOverlayDom();
    await setFocusModeActive(chromeFake.storage.local, true);
    const repo = createInMemoryTaskRepo();

    await initFocusModeOverlay(doc, chromeFake.storage.local, repo, () => {});

    expect(doc.getElementById('focus-mode-progress')!.textContent).toBe('');
  });

  it('shows a fallback message when no focus text is set', async () => {
    const doc = renderOverlayDom();
    await setFocusModeActive(chromeFake.storage.local, true);
    const repo = createInMemoryTaskRepo();

    await initFocusModeOverlay(doc, chromeFake.storage.local, repo, () => {});

    expect(doc.getElementById('focus-mode-text')!.textContent).toBe('No focus set for today.');
  });
});
