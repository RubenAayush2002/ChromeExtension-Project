import type { LocalStorage } from '@/lib/storage-types';
import { isOnboardingComplete, markOnboardingComplete, normalizeName } from '@/lib/onboarding-store';

export interface OnboardingElements {
  overlay: HTMLElement;
  page: HTMLElement;
  nameInput: HTMLInputElement;
  engineSelect: HTMLSelectElement;
  cityInput: HTMLInputElement;
  startButton: HTMLButtonElement;
  skipButton: HTMLButtonElement;
}

export function getOnboardingElements(doc: Document): OnboardingElements {
  return {
    overlay: doc.getElementById('onboarding')!,
    page: doc.getElementById('page')!,
    nameInput: doc.getElementById('onboarding-name') as HTMLInputElement,
    engineSelect: doc.getElementById('onboarding-engine') as HTMLSelectElement,
    cityInput: doc.getElementById('onboarding-city') as HTMLInputElement,
    startButton: doc.getElementById('onboarding-start') as HTMLButtonElement,
    skipButton: doc.getElementById('onboarding-skip') as HTMLButtonElement,
  };
}

export interface OnboardingSubmission {
  name: string;
  searchEngine: string;
  city: string;
}

/** Shows the first-run walkthrough (§6.1) if it hasn't been completed.
 *
 *  Returns true when the overlay was shown, so main() can skip the rest of
 *  page init — the page underneath is hidden and would otherwise render a
 *  nameless greeting behind the overlay.
 *
 *  Listeners are bound once to elements that live in the static HTML and are
 *  never destroyed; finishing hides the overlay rather than removing it. */
export async function initOnboarding(
  doc: Document,
  storage: LocalStorage,
  onComplete: (submission: OnboardingSubmission) => Promise<void>,
): Promise<boolean> {
  if (await isOnboardingComplete(storage)) return false;

  const elements = getOnboardingElements(doc);
  elements.overlay.hidden = false;
  elements.page.hidden = true;

  async function finish(submission: OnboardingSubmission) {
    await onComplete(submission);
    await markOnboardingComplete(storage);
    elements.overlay.hidden = true;
    elements.page.hidden = false;
  }

  elements.startButton.addEventListener('click', () => {
    void finish({
      name: normalizeName(elements.nameInput.value),
      searchEngine: elements.engineSelect.value,
      city: elements.cityInput.value.trim(),
    });
  });

  // Skipping still marks onboarding done — it must not reappear on the next
  // new tab. Everything stays at its default and is editable in Settings.
  elements.skipButton.addEventListener('click', () => {
    void finish({ name: '', searchEngine: elements.engineSelect.value, city: '' });
  });

  // Enter anywhere in the form submits, matching the rest of the page's inputs.
  elements.overlay.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Enter') elements.startButton.click();
  });

  elements.nameInput.focus();
  return true;
}
