import { addTask, toggleTaskDone, type Task, type TaskRepo } from '@/lib/task-store';
import { splitTaskBlob } from '@/lib/task-split';

/** Turns a pasted blob into task lines. `simple` is the already-computed
 *  line-split result, used as the fallback. */
export type SplitLines = (
  raw: string,
  simple: string[],
) => Promise<{ value: string[]; usedSmart: boolean; note: string | null }>;

export interface TasksBoxElements {
  box: HTMLElement;
  input: HTMLInputElement;
  list: HTMLElement;
  splitAction: HTMLElement;
  splitButton: HTMLButtonElement;
  note: HTMLElement;
}

export function getTasksBoxElements(doc: Document): TasksBoxElements {
  return {
    box: doc.getElementById('tasks-box')!,
    input: doc.getElementById('task-input') as HTMLInputElement,
    list: doc.getElementById('task-list')!,
    splitAction: doc.getElementById('split-blob-action')!,
    splitButton: doc.getElementById('split-blob-button') as HTMLButtonElement,
    note: doc.getElementById('tasks-note')!,
  };
}

/** Renders the task list into the box.
 *
 *  The box stays mounted even when the list is empty. §6.4 asks for no
 *  empty-state clutter, but the add-task input lives inside this box — hiding
 *  the box on an empty list removes the only way to create a first task, so a
 *  fresh profile can never add one (the list stays empty, so the box stays
 *  hidden, forever). An empty list simply renders no <li>s; the heading and
 *  input remain available. */
export function renderTaskList(elements: TasksBoxElements, tasks: Task[], onToggle: (id: string) => void): void {
  elements.list.innerHTML = '';
  elements.box.hidden = false;

  for (const task of [...tasks].sort((a, b) => a.createdAt - b.createdAt)) {
    const li = document.createElement('li');
    li.className = task.done ? 'done' : '';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.done;
    checkbox.addEventListener('change', () => onToggle(task.id));

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = task.text;

    li.append(checkbox, text);
    elements.list.append(li);
  }
}

/** §10.4: a short, non-blocking note when the smart layer couldn't be reached.
 *  Writes into its own element — never into the split action's container,
 *  which would destroy the split button and drop its click listener. */
function showNote(elements: TasksBoxElements, note: string) {
  elements.note.hidden = false;
  elements.note.textContent = note;
  setTimeout(() => {
    elements.note.hidden = true;
    elements.note.textContent = '';
  }, 4000);
}

/** Wires the Today's Tasks box: add-on-Enter, toggle-complete, and the
 *  paste-a-blob-to-split action. Listeners are bound exactly once, against
 *  elements that live in the static HTML and are never destroyed — only the
 *  <li> rows inside #task-list are re-created on each render. */
export async function initTasksBox(
  doc: Document,
  repo: TaskRepo,
  now: () => number = Date.now,
  /** Injected so the smart upgrade (§10.2) can be swapped for a plain split in
   *  tests and on surfaces without storage access. Defaults to simple mode. */
  splitLines: SplitLines = async (_raw, simple) => ({ value: simple, usedSmart: false, note: null }),
): Promise<void> {
  const elements = getTasksBoxElements(doc);
  let pendingBlobLines: string[] = [];
  let pendingBlobRaw = '';

  async function refresh() {
    renderTaskList(elements, await repo.all(), async (id) => {
      await toggleTaskDone(repo, id, now());
      await refresh();
    });
  }

  elements.input.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter' && elements.input.value.trim()) {
      await addTask(repo, elements.input.value.trim(), now());
      elements.input.value = '';
      await refresh();
    }
  });

  elements.input.addEventListener('paste', (event) => {
    const text = (event as ClipboardEvent).clipboardData?.getData('text') ?? '';
    const lines = splitTaskBlob(text);
    if (lines.length > 1) {
      event.preventDefault();
      pendingBlobRaw = text;
      pendingBlobLines = lines;
      elements.splitButton.textContent = `Split into ${lines.length} tasks`;
      elements.splitAction.hidden = false;
    }
  });

  elements.splitButton.addEventListener('click', async () => {
    // The smart pass runs here rather than in the paste handler: paste must
    // stay synchronous to call preventDefault(), and the button already shows
    // the simple count as an honest preview of the worst case.
    elements.splitButton.disabled = true;
    const result = await splitLines(pendingBlobRaw, pendingBlobLines);
    elements.splitButton.disabled = false;

    for (const line of result.value) {
      await addTask(repo, line, now());
    }

    pendingBlobLines = [];
    pendingBlobRaw = '';
    elements.splitAction.hidden = true;
    elements.input.value = '';
    if (result.note) showNote(elements, result.note);
    await refresh();
  });

  await refresh();
}
