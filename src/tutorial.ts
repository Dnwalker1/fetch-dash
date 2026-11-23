/**
 * The first-run tutorial on Level 1 (see GameScene): one prompt each for
 * tap, swipe down and swipe up. Whether it's been done is kept on the device;
 * "Replay tutorial" on the home card clears it.
 */
const KEY = 'fetch-dash-tutorial-done';

export function tutorialDone(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // storage blocked: don't show it on every run
  }
}

export function setTutorialDone(done: boolean): void {
  try {
    if (done) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // not remembered; fine
  }
}
