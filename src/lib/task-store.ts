export interface Task {
  id: string;
  text: string;
  done: boolean;
  doneAt: number | null;
  createdAt: number;
}

/** Minimal persistence contract task-store logic depends on — the real IndexedDB
 *  adapter and a test in-memory adapter both implement this. */
export interface TaskRepo {
  all(): Promise<Task[]>;
  put(task: Task): Promise<void>;
  delete(id: string): Promise<void>;
}

export const TASK_PURGE_ALARM = 'task-weekly-purge';
const PURGE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export async function addTask(repo: TaskRepo, text: string, now: number): Promise<Task> {
  const task: Task = {
    id: crypto.randomUUID(),
    text,
    done: false,
    doneAt: null,
    createdAt: now,
  };
  await repo.put(task);
  return task;
}

export async function toggleTaskDone(repo: TaskRepo, id: string, now: number): Promise<void> {
  const tasks = await repo.all();
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.done = !task.done;
  task.doneAt = task.done ? now : null;
  await repo.put(task);
}

/** Called on the weekly-purge alarm: deletes tasks completed more than 7 days ago. */
export async function purgeOldCompletedTasks(repo: TaskRepo, now: number): Promise<number> {
  const tasks = await repo.all();
  let purged = 0;
  for (const task of tasks) {
    if (task.done && task.doneAt !== null && now - task.doneAt > PURGE_AFTER_MS) {
      await repo.delete(task.id);
      purged++;
    }
  }
  return purged;
}
