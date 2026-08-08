const STORAGE_KEY = 'pendingScreenshot';

async function main() {
  const { [STORAGE_KEY]: dataUrl } = await chrome.storage.local.get(STORAGE_KEY);
  if (typeof dataUrl !== 'string') return;

  const img = document.getElementById('preview') as HTMLImageElement;
  img.src = dataUrl;

  document.getElementById('download')!.addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `screenshot-${Date.now()}.png`;
    link.click();
  });

  document.getElementById('discard')!.addEventListener('click', async () => {
    await chrome.storage.local.remove(STORAGE_KEY);
    window.close();
  });

  await chrome.storage.local.remove(STORAGE_KEY);
}

void main();
