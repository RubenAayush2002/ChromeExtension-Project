import { describe, it, expect } from 'vitest';
import { initTasksBox } from '../tasks-box';
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

function renderTasksBoxDom(): Document {
  document.body.innerHTML = `
    <aside id="tasks-box" class="tasks-box">
      <h2>Today's Tasks</h2>
      <input id="task-input" type="text" />
      <div id="split-blob-action" hidden>
        <button id="split-blob-button"></button>
      </div>
      <p id="tasks-note" hidden></p>
      <ul id="task-list"></ul>
    </aside>
  `;
  return document;
}

/** jsdom has no DataTransfer, so the clipboard payload is stubbed directly. */
function pasteInto(input: HTMLInputElement, text: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (type: string) => (type === 'text' ? text : '') },
  });
  input.dispatchEvent(event);
}

function pressEnter(input: HTMLInputElement) {
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

/** The click/keydown handlers are async and await storage round-trips; yield a
 *  macrotask so they've completed before asserting. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeTask(overrides: Partial<Task> = {}): Task {
  return { id: '1', text: 'a task', done: false, doneAt: null, createdAt: 1000, ...overrides };
}

describe('initTasksBox', () => {
  it('keeps the box visible when there are no tasks, so the input is reachable', async () => {
    const doc = renderTasksBoxDom();
    const repo = createInMemoryTaskRepo();

    await initTasksBox(doc, repo);

    // Regression guard: the box used to hide itself on an empty list, which
    // also hid the add-task input inside it — leaving a fresh profile with no
    // way to ever create a first task.
    expect(doc.getElementById('tasks-box')!.hidden).toBe(false);
    expect(doc.getElementById('task-input')).not.toBeNull();
    expect(doc.getElementById('task-list')!.children.length).toBe(0);
  });

  it('adds a task from an empty state when the user types and presses Enter', async () => {
    const doc = renderTasksBoxDom();
    const repo = createInMemoryTaskRepo();

    await initTasksBox(doc, repo);

    const input = doc.getElementById('task-input') as HTMLInputElement;
    input.value = 'Buy milk';
    pressEnter(input);
    await settle();

    // The end-to-end path that was previously unreachable: empty state →
    // type → Enter → task persisted and rendered.
    expect((await repo.all()).map((t) => t.text)).toEqual(['Buy milk']);
    expect(doc.getElementById('task-list')!.children.length).toBe(1);
    expect(doc.getElementById('task-list')!.textContent).toContain('Buy milk');
    expect(input.value).toBe('');
  });

  it('renders existing tasks on init, oldest first', async () => {
    const doc = renderTasksBoxDom();
    const repo = createInMemoryTaskRepo([
      makeTask({ id: '2', text: 'second', createdAt: 2000 }),
      makeTask({ id: '1', text: 'first', createdAt: 1000 }),
    ]);

    await initTasksBox(doc, repo);

    const rows = [...doc.getElementById('task-list')!.querySelectorAll('.task-text')];
    expect(rows.map((r) => r.textContent)).toEqual(['first', 'second']);
  });

  it('toggles a task to done in the repo when its checkbox is clicked', async () => {
    const doc = renderTasksBoxDom();
    const repo = createInMemoryTaskRepo([makeTask({ id: '1', text: 'a task' })]);

    await initTasksBox(doc, repo);

    const checkbox = doc.querySelector('#task-list input[type="checkbox"]') as HTMLInputElement;
    checkbox.click();
    await settle();

    const tasks = await repo.all();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.done).toBe(true);
    expect(tasks[0]!.doneAt).not.toBeNull();
    expect(doc.querySelector('#task-list li')!.className).toBe('done');
  });

  it('does not add a task when the input is empty or whitespace', async () => {
    const doc = renderTasksBoxDom();
    const repo = createInMemoryTaskRepo();

    await initTasksBox(doc, repo);

    const input = doc.getElementById('task-input') as HTMLInputElement;
    input.value = '   ';
    pressEnter(input);
    await settle();

    expect(await repo.all()).toEqual([]);
  });

  it('adds the smart-split tasks when the split button is used', async () => {
    const doc = renderTasksBoxDom();
    const repo = createInMemoryTaskRepo();

    // Stands in for the smart layer returning cleaned-up wording.
    await initTasksBox(doc, repo, Date.now, async () => ({
      value: ['Buy milk', 'Call the dentist'],
      usedSmart: true,
      note: null,
    }));

    const input = doc.getElementById('task-input') as HTMLInputElement;
    pasteInto(input, 'milk\ndentist');
    (doc.getElementById('split-blob-button') as HTMLButtonElement).click();
    await settle();

    expect((await repo.all()).map((t) => t.text).sort()).toEqual(['Buy milk', 'Call the dentist']);
  });

  it('shows the fallback note and still adds the simple tasks when the smart call fails', async () => {
    const doc = renderTasksBoxDom();
    const repo = createInMemoryTaskRepo();

    await initTasksBox(doc, repo, Date.now, async (_raw, simple) => ({
      value: simple,
      usedSmart: false,
      note: "Couldn't reach the smart layer. Showed the simple version instead.",
    }));

    const input = doc.getElementById('task-input') as HTMLInputElement;
    pasteInto(input, 'milk\ndentist');
    (doc.getElementById('split-blob-button') as HTMLButtonElement).click();
    await settle();

    // §10.4: the feature completes with the simple result AND says so.
    expect((await repo.all()).map((t) => t.text).sort()).toEqual(['dentist', 'milk']);
    const note = doc.getElementById('tasks-note')!;
    expect(note.hidden).toBe(false);
    expect(note.textContent).toContain('simple version instead');
  });

  it('re-renders without dropping the input listener after a task is added', async () => {
    const doc = renderTasksBoxDom();
    const repo = createInMemoryTaskRepo();

    await initTasksBox(doc, repo);
    const input = doc.getElementById('task-input') as HTMLInputElement;

    // The listener is bound once to an element that survives re-render; a
    // second add proves it wasn't dropped or double-bound by the first.
    input.value = 'one';
    pressEnter(input);
    await settle();

    input.value = 'two';
    pressEnter(input);
    await settle();

    expect((await repo.all()).map((t) => t.text).sort()).toEqual(['one', 'two']);
    expect(doc.getElementById('task-list')!.children.length).toBe(2);
  });
});
