import type { Task, TaskRepo } from '@/lib/task-store';
import { STORES, getAll, put, deleteByKey } from '@/db/database';

export function createIndexedDbTaskRepo(): TaskRepo {
  return {
    all: () => getAll<Task>(STORES.tasks),
    put: (task) => put(STORES.tasks, task),
    delete: (id) => deleteByKey(STORES.tasks, id),
  };
}
