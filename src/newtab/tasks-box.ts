import { addTask, toggleTaskDone, type Task, type TaskRepo } from '@/lib/task-store';
import { splitTaskBlob } from '@/lib/task-split';

export interface TasksBoxElements {
  box: HTMLElement;
  input: HTMLInputElement;
  list: HTMLElement;
  splitAction: HTMLElement;
  splitButton: HTMLButtonElement;
}

export function getTasksBoxElements(doc: Document): TasksBoxElements {
  return {
    box: doc.getElementById('tasks-box')!,
    input: doc.getElementById('task-input') as HTMLInputElement,
    list: doc.getElementById('task-list')!,
    splitAction: doc.getElementById('split-blob-action')!,
    splitButton: doc.getElementById('split-blob-button') as HTMLButtonElement,
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

/** Wires the Today's Tasks box: add-on-Enter, toggle-complete, and the
 *  paste-a-blob-to-split action. Listeners are bound exactly once, against
 *  elements that live in the static HTML and are never destroyed — only the
 *  <li> rows inside #task-list are re-created on each render. */
export async function initTasksBox(doc: Document, repo: TaskRepo, now: () => number = Date.now): Promise<void> {
  const elements = getTasksBoxElements(doc);
  let pendingBlobLines: string[] = [];

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
      pendingBlobLines = lines;
      elements.splitButton.textContent = `Split into ${lines.length} tasks`;
      elements.splitAction.hidden = false;
    }
  });

  elements.splitButton.addEventListener('click', async () => {
    for (const line of pendingBlobLines) {
      await addTask(repo, line, now());
    }
    pendingBlobLines = [];
    elements.splitAction.hidden = true;
    elements.input.value = '';
    await refresh();
  });

  await refresh();
}
