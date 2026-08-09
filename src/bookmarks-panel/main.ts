import { labelForUrl } from '@/lib/bookmark-labels';
import { keywordSearchBookmarks } from '@/lib/bookmark-search';
import { labelBookmarksSmart, searchBookmarksSmart } from '@/lib/smart-bookmarks';
import { createGroqProvider } from '@/lib/groq-provider';
import { applyOrderAndLabels, reorder, type OrderableBookmark, type OrderedBookmark } from '@/lib/bookmark-order';
import { createIndexedDbBookmarkMetaRepo } from '@/db/bookmark-meta-repo';

interface RawFolderGroup {
  folderId: string;
  folderTitle: string;
  bookmarks: OrderableBookmark[];
}

interface FolderGroup {
  folderId: string;
  folderTitle: string;
  bookmarks: OrderedBookmark[];
}

const metaRepo = createIndexedDbBookmarkMetaRepo();
const foldersEl = document.getElementById('folders')!;
const searchEl = document.getElementById('search') as HTMLInputElement;

/** Ids returned by a natural-language search, or null when showing the plain
 *  keyword filter. Cleared as soon as the query text changes. */
let smartMatchIds: Set<string> | null = null;

/** §10.4: short, non-blocking note about a smart-layer fallback. */
function showPanelNote(note: string) {
  const el = document.getElementById('panel-note')!;
  el.hidden = false;
  el.textContent = note;
  setTimeout(() => {
    el.hidden = true;
    el.textContent = '';
  }, 4000);
}

let allGroups: FolderGroup[] = [];

function flattenBookmarkTree(nodes: chrome.bookmarks.BookmarkTreeNode[]): RawFolderGroup[] {
  const groups: RawFolderGroup[] = [];

  function walk(node: chrome.bookmarks.BookmarkTreeNode) {
    if (!node.children) return;

    const leafBookmarks = node.children.filter((c) => c.url);
    if (leafBookmarks.length > 0) {
      groups.push({
        folderId: node.id,
        folderTitle: node.title || 'Bookmarks',
        bookmarks: leafBookmarks.map((b) => ({ id: b.id, title: b.title, url: b.url! })),
      });
    }
    for (const child of node.children) walk(child);
  }

  for (const root of nodes) walk(root);
  return groups;
}

async function loadAndRender() {
  const tree = await chrome.bookmarks.getTree();
  const rawGroups = flattenBookmarkTree(tree);
  const meta = await metaRepo.all();

  // Same label field, smarter values when the layer is on (§10.2): real topic
  // labels instead of hostnames, falling back per-bookmark on any failure.
  const allBookmarks = rawGroups.flatMap((g) => g.bookmarks);
  const labelResult = await labelBookmarksSmart(chrome.storage.local, createGroqProvider(), allBookmarks);
  const labelFor = (url: string, id: string) => labelResult.value.get(id) ?? labelForUrl(url);

  allGroups = rawGroups.map((group) => {
    const groupMeta = meta.filter((m) => group.bookmarks.some((b) => b.id === m.bookmarkId));
    return {
      folderId: group.folderId,
      folderTitle: group.folderTitle,
      bookmarks: applyOrderAndLabels(group.bookmarks, groupMeta, (b) => labelFor(b.url, b.id)),
    };
  });

  render(searchEl.value);
  if (labelResult.note) showPanelNote(labelResult.note);
}

function render(query: string) {
  foldersEl.innerHTML = '';

  for (const group of allGroups) {
    // A smart search result replaces the keyword filter until the query changes.
    const filtered = smartMatchIds
      ? group.bookmarks.filter((b) => smartMatchIds!.has(b.id))
      : keywordSearchBookmarks(query, group.bookmarks);
    if (filtered.length === 0) continue;

    const section = document.createElement('div');
    section.className = 'folder';
    section.innerHTML = `<h2>${escapeHtml(group.folderTitle)}</h2>`;

    const list = document.createElement('ul');
    list.className = 'bookmark-list';
    list.dataset.folderId = group.folderId;

    for (const bookmark of filtered) {
      list.append(renderRow(bookmark, group));
    }

    section.append(list);
    foldersEl.append(section);
  }

  if (foldersEl.children.length === 0) {
    foldersEl.innerHTML = '<p style="opacity:0.6">No bookmarks match.</p>';
  }
}

function renderRow(bookmark: OrderedBookmark, group: FolderGroup): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'bookmark-row';
  li.draggable = true;
  li.dataset.bookmarkId = bookmark.id;

  const favicon = document.createElement('img');
  favicon.className = 'bookmark-favicon';
  favicon.src = `chrome://favicon/${bookmark.url}`;
  favicon.alt = '';

  const title = document.createElement('span');
  title.className = 'bookmark-title';
  title.textContent = bookmark.title || bookmark.url;

  const label = document.createElement('span');
  label.className = 'bookmark-label';
  label.textContent = bookmark.label;

  li.append(favicon, title, label);

  li.addEventListener('click', () => chrome.tabs.create({ url: bookmark.url }));

  li.addEventListener('dragstart', () => li.classList.add('dragging'));
  li.addEventListener('dragend', () => li.classList.remove('dragging'));
  li.addEventListener('dragover', (e) => e.preventDefault());
  li.addEventListener('drop', async (e) => {
    e.preventDefault();
    const draggingId = foldersEl.querySelector('.dragging')?.getAttribute('data-bookmark-id');
    if (!draggingId || draggingId === bookmark.id) return;
    await handleReorder(group, draggingId, bookmark.id);
  });

  return li;
}

async function handleReorder(group: FolderGroup, draggedId: string, targetId: string) {
  const ids = group.bookmarks.map((b) => b.id);
  const fromIndex = ids.indexOf(draggedId);
  const toIndex = ids.indexOf(targetId);
  if (fromIndex === -1 || toIndex === -1) return;

  const newOrder = reorder(ids, fromIndex, toIndex);
  for (let i = 0; i < newOrder.length; i++) {
    const bookmarkId = newOrder[i]!;
    const bookmark = group.bookmarks.find((b) => b.id === bookmarkId)!;
    await metaRepo.put({ bookmarkId, order: i, label: bookmark.label });
  }

  await loadAndRender();
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Typing keeps the instant keyword filter — firing an API call per keystroke
// would be slow and wasteful. Enter runs the natural-language search (§10.2)
// against the same box.
searchEl.addEventListener('input', () => {
  smartMatchIds = null;
  render(searchEl.value);
});

searchEl.addEventListener('keydown', async (event) => {
  if (event.key !== 'Enter' || !searchEl.value.trim()) return;

  const all = allGroups.flatMap((g) => g.bookmarks);
  const result = await searchBookmarksSmart(chrome.storage.local, createGroqProvider(), searchEl.value, all);

  // Only narrow to smart matches when the smart path actually ran; a fallback
  // result is just the keyword filter we're already showing.
  smartMatchIds = result.usedSmart ? new Set(result.value.map((b) => b.id)) : null;
  render(searchEl.value);
  if (result.note) showPanelNote(result.note);
});

for (const event of ['onCreated', 'onRemoved', 'onChanged', 'onMoved'] as const) {
  chrome.bookmarks[event].addListener(() => void loadAndRender());
}

void loadAndRender();
