import { describe, it, expect } from 'vitest';
import { addTask, toggleTaskDone, purgeOldCompletedTasks, type Task, type TaskRepo } from '../task-store';

function createInMemoryTaskRepo(): TaskRepo {
  const tasks = new Map<string, Task>();
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

const DAY_MS = 24 * 60 * 60 * 1000;

describe('task-store', () => {
  it('adds a task as not-done with no doneAt', async () => {
    const repo = createInMemoryTaskRepo();
    const task = await addTask(repo, 'buy milk', Date.now());
    expect(task.done).toBe(false);
    expect(task.doneAt).toBeNull();
    expect(await repo.all()).toHaveLength(1);
  });

  it('toggles a task done and sets doneAt, toggles back and clears it', async () => {
    const repo = createInMemoryTaskRepo();
    const now = Date.now();
    const task = await addTask(repo, 'buy milk', now);

    await toggleTaskDone(repo, task.id, now + 1000);
    let [updated] = await repo.all();
    expect(updated!.done).toBe(true);
    expect(updated!.doneAt).toBe(now + 1000);

    await toggleTaskDone(repo, task.id, now + 2000);
    [updated] = await repo.all();
    expect(updated!.done).toBe(false);
    expect(updated!.doneAt).toBeNull();
  });

  it('purges tasks completed more than 7 days ago', async () => {
    const repo = createInMemoryTaskRepo();
    const now = Date.now();

    const old = await addTask(repo, 'old task', now - 10 * DAY_MS);
    await toggleTaskDone(repo, old.id, now - 8 * DAY_MS);

    const recent = await addTask(repo, 'recent task', now - 2 * DAY_MS);
    await toggleTaskDone(repo, recent.id, now - 1 * DAY_MS);

    const purgedCount = await purgeOldCompletedTasks(repo, now);

    expect(purgedCount).toBe(1);
    const remaining = await repo.all();
    expect(remaining.map((t) => t.text)).toEqual(['recent task']);
  });

  it('does not purge incomplete tasks regardless of age', async () => {
    const repo = createInMemoryTaskRepo();
    const now = Date.now();
    await addTask(repo, 'ancient but unfinished', now - 30 * DAY_MS);

    const purgedCount = await purgeOldCompletedTasks(repo, now);

    expect(purgedCount).toBe(0);
    expect(await repo.all()).toHaveLength(1);
  });
});
