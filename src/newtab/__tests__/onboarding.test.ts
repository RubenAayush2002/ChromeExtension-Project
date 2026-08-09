import { describe, it, expect, beforeEach } from 'vitest';
import { createChromeFake, type ChromeFake } from '@/lib/__tests__/chrome-fake';
import { initOnboarding, type OnboardingSubmission } from '../onboarding';
import { isOnboardingComplete, markOnboardingComplete, normalizeName } from '@/lib/onboarding-store';

function renderOnboardingDom(): Document {
  document.body.innerHTML = `
    <div id="onboarding" hidden>
      <input id="onboarding-name" type="text" />
      <select id="onboarding-engine">
        <option value="google">Google</option>
        <option value="duckduckgo">DuckDuckGo</option>
      </select>
      <input id="onboarding-city" type="text" />
      <button id="onboarding-start"></button>
      <button id="onboarding-skip"></button>
    </div>
    <div id="page"></div>
  `;
  return document;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

let chromeFake: ChromeFake;
beforeEach(() => {
  chromeFake = createChromeFake();
});

describe('normalizeName', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeName('  Ruben  ')).toBe('Ruben');
  });

  it('caps an absurdly long name so the greeting cannot overflow', () => {
    expect(normalizeName('x'.repeat(200))).toHaveLength(40);
  });

  it('allows an empty name', () => {
    expect(normalizeName('   ')).toBe('');
  });
});

describe('initOnboarding', () => {
  it('shows the overlay and hides the page on first run', async () => {
    const doc = renderOnboardingDom();

    const shown = await initOnboarding(doc, chromeFake.storage.local, async () => {});

    expect(shown).toBe(true);
    expect(doc.getElementById('onboarding')!.hidden).toBe(false);
    expect(doc.getElementById('page')!.hidden).toBe(true);
  });

  it('does not show once onboarding has been completed', async () => {
    const doc = renderOnboardingDom();
    await markOnboardingComplete(chromeFake.storage.local);

    const shown = await initOnboarding(doc, chromeFake.storage.local, async () => {});

    expect(shown).toBe(false);
    expect(doc.getElementById('onboarding')!.hidden).toBe(true);
    expect(doc.getElementById('page')!.hidden).toBe(false);
  });

  it('passes the entered details to the completion handler', async () => {
    const doc = renderOnboardingDom();
    let submitted: OnboardingSubmission | null = null;

    await initOnboarding(doc, chromeFake.storage.local, async (submission) => {
      submitted = submission;
    });

    (doc.getElementById('onboarding-name') as HTMLInputElement).value = '  Ruben ';
    (doc.getElementById('onboarding-engine') as HTMLSelectElement).value = 'duckduckgo';
    (doc.getElementById('onboarding-city') as HTMLInputElement).value = ' London ';
    (doc.getElementById('onboarding-start') as HTMLButtonElement).click();
    await settle();

    expect(submitted).toEqual({ name: 'Ruben', searchEngine: 'duckduckgo', city: 'London' });
  });

  it('reveals the page and marks completion after finishing', async () => {
    const doc = renderOnboardingDom();

    await initOnboarding(doc, chromeFake.storage.local, async () => {});
    (doc.getElementById('onboarding-start') as HTMLButtonElement).click();
    await settle();

    expect(doc.getElementById('onboarding')!.hidden).toBe(true);
    expect(doc.getElementById('page')!.hidden).toBe(false);
    expect(await isOnboardingComplete(chromeFake.storage.local)).toBe(true);
  });

  it('marks completion when skipped, so it never reappears', async () => {
    const doc = renderOnboardingDom();
    let submitted: OnboardingSubmission | null = null;

    await initOnboarding(doc, chromeFake.storage.local, async (submission) => {
      submitted = submission;
    });

    (doc.getElementById('onboarding-name') as HTMLInputElement).value = 'ignored';
    (doc.getElementById('onboarding-skip') as HTMLButtonElement).click();
    await settle();

    expect(submitted!.name).toBe('');
    expect(await isOnboardingComplete(chromeFake.storage.local)).toBe(true);
  });

  it('does not re-prompt on the next open after being skipped', async () => {
    const doc = renderOnboardingDom();

    await initOnboarding(doc, chromeFake.storage.local, async () => {});
    (doc.getElementById('onboarding-skip') as HTMLButtonElement).click();
    await settle();

    // Regression guard: completion is its own flag rather than inferred from
    // an empty name, so skipping is remembered.
    const shownAgain = await initOnboarding(renderOnboardingDom(), chromeFake.storage.local, async () => {});
    expect(shownAgain).toBe(false);
  });

  it('accepts an empty name without blocking completion', async () => {
    const doc = renderOnboardingDom();

    await initOnboarding(doc, chromeFake.storage.local, async () => {});
    (doc.getElementById('onboarding-start') as HTMLButtonElement).click();
    await settle();

    expect(await isOnboardingComplete(chromeFake.storage.local)).toBe(true);
    expect(doc.getElementById('page')!.hidden).toBe(false);
  });
});
