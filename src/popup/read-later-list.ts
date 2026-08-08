import { removeReadLaterItem, type ReadLaterItem, type ReadLaterRepo } from '@/lib/read-later-store';

export interface ReadLaterListElements {
  list: HTMLElement;
  empty: HTMLElement;
}

export function getReadLaterListElements(doc: Document): ReadLaterListElements {
  return {
    list: doc.getElementById('read-later-list')!,
    empty: doc.getElementById('read-later-empty')!,
  };
}

/** Renders saved read-later items, newest first. Clicking an item opens it;
 *  the ✕ removes it. Both callbacks are injected so this stays testable
 *  without chrome.* globals. */
export function renderReadLaterList(
  elements: ReadLaterListElements,
  items: ReadLaterItem[],
  handlers: { onOpen: (item: ReadLaterItem) => void; onRemove: (id: string) => void },
): void {
  elements.list.innerHTML = '';
  elements.empty.hidden = items.length > 0;

  for (const item of [...items].sort((a, b) => b.savedAt - a.savedAt)) {
    const li = document.createElement('li');
    li.className = 'read-later-row';

    const body = document.createElement('div');
    body.className = 'read-later-body';

    const title = document.createElement('span');
    title.className = 'read-later-title';
    title.textContent = item.title;

    const preview = document.createElement('span');
    preview.className = 'read-later-preview';
    preview.textContent = item.preview;

    body.append(title, preview);
    body.addEventListener('click', () => handlers.onOpen(item));

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '✕';
    deleteBtn.title = 'Remove from read later';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onRemove(item.id);
    });

    li.append(body, deleteBtn);
    elements.list.append(li);
  }
}

/** Loads items from the repo and renders them, re-rendering after a removal. */
export async function refreshReadLaterList(
  doc: Document,
  repo: ReadLaterRepo,
  onOpen: (item: ReadLaterItem) => void,
): Promise<void> {
  const elements = getReadLaterListElements(doc);

  const render = async () => {
    renderReadLaterList(elements, await repo.all(), {
      onOpen,
      onRemove: async (id) => {
        await removeReadLaterItem(repo, id);
        await render();
      },
    });
  };

  await render();
}
