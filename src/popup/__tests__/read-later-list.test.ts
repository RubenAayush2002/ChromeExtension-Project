import { describe, it, expect } from 'vitest';
import { refreshReadLaterList } from '../read-later-list';
import type { ReadLaterItem, ReadLaterRepo } from '@/lib/read-later-store';

function createInMemoryReadLaterRepo(initial: ReadLaterItem[] = []): ReadLaterRepo {
  const items = new Map(initial.map((i) => [i.id, i]));
  return {
    all: async () => [...items.values()],
    put: async (item) => {
      items.set(item.id, item);
    },
    delete: async (id) => {
      items.delete(id);
    },
  };
}

function makeItem(overrides: Partial<ReadLaterItem> = {}): ReadLaterItem {
  return {
    id: '1',
    url: 'https://example.com/article',
    title: 'An Article',
    preview: 'The opening lines of the article.',
    previewIsFallback: false,
    savedAt: 1000,
    ...overrides,
  };
}

function renderPopupDom(): Document {
  document.body.innerHTML = `
    <section class="read-later">
      <p id="read-later-empty" hidden>Nothing saved yet.</p>
      <ul id="read-later-list"></ul>
    </section>
  `;
  return document;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('refreshReadLaterList', () => {
  it('renders saved items with their title and preview', async () => {
    const doc = renderPopupDom();
    const repo = createInMemoryReadLaterRepo([makeItem()]);

    await refreshReadLaterList(doc, repo, () => {});

    const list = doc.getElementById('read-later-list')!;
    expect(list.children.length).toBe(1);
    expect(list.querySelector('.read-later-title')!.textContent).toBe('An Article');
    expect(list.querySelector('.read-later-preview')!.textContent).toBe('The opening lines of the article.');
  });

  it('shows the empty note and no rows when nothing is saved', async () => {
    const doc = renderPopupDom();
    const repo = createInMemoryReadLaterRepo();

    await refreshReadLaterList(doc, repo, () => {});

    expect(doc.getElementById('read-later-empty')!.hidden).toBe(false);
    expect(doc.getElementById('read-later-list')!.children.length).toBe(0);
  });

  it('hides the empty note once items exist', async () => {
    const doc = renderPopupDom();
    const repo = createInMemoryReadLaterRepo([makeItem()]);

    await refreshReadLaterList(doc, repo, () => {});

    expect(doc.getElementById('read-later-empty')!.hidden).toBe(true);
  });

  it('orders items newest first', async () => {
    const doc = renderPopupDom();
    const repo = createInMemoryReadLaterRepo([
      makeItem({ id: 'old', title: 'Older', savedAt: 1000 }),
      makeItem({ id: 'new', title: 'Newer', savedAt: 5000 }),
    ]);

    await refreshReadLaterList(doc, repo, () => {});

    const titles = [...doc.querySelectorAll('.read-later-title')].map((el) => el.textContent);
    expect(titles).toEqual(['Newer', 'Older']);
  });

  it('invokes onOpen with the clicked item', async () => {
    const doc = renderPopupDom();
    const repo = createInMemoryReadLaterRepo([makeItem({ url: 'https://example.com/read-me' })]);

    let opened: ReadLaterItem | null = null;
    await refreshReadLaterList(doc, repo, (item) => {
      opened = item;
    });

    (doc.querySelector('.read-later-body') as HTMLElement).click();

    expect(opened).not.toBeNull();
    expect(opened!.url).toBe('https://example.com/read-me');
  });

  it('removes an item from the repo and re-renders when ✕ is clicked', async () => {
    const doc = renderPopupDom();
    const repo = createInMemoryReadLaterRepo([makeItem({ id: 'a' }), makeItem({ id: 'b', savedAt: 2000 })]);

    await refreshReadLaterList(doc, repo, () => {});
    expect(doc.getElementById('read-later-list')!.children.length).toBe(2);

    (doc.querySelector('.read-later-row button') as HTMLButtonElement).click();
    await settle();

    // Newest ('b') renders first, so the first ✕ removes it.
    expect((await repo.all()).map((i) => i.id)).toEqual(['a']);
    expect(doc.getElementById('read-later-list')!.children.length).toBe(1);
  });

  it('does not open the item when the remove button is clicked', async () => {
    const doc = renderPopupDom();
    const repo = createInMemoryReadLaterRepo([makeItem()]);

    let openCount = 0;
    await refreshReadLaterList(doc, repo, () => {
      openCount++;
    });

    (doc.querySelector('.read-later-row button') as HTMLButtonElement).click();
    await settle();

    expect(openCount).toBe(0);
  });
});
