export interface ProgressCountable {
  done: boolean;
}

/** "X of Y tasks done today" (§9) — counts across all currently-visible tasks
 *  in the Today's Tasks list (completed tasks purge after 7 days per §6.4,
 *  so "visible" already approximates "today's" without a separate cutoff). */
export function todaysTaskProgress(tasks: ProgressCountable[]): { done: number; total: number } {
  return {
    done: tasks.filter((t) => t.done).length,
    total: tasks.length,
  };
}
