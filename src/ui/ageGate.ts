// The neutral age screen, shown once before the first hero portrait.
// Same words for everyone, no default month or year, and nothing says which
// answer unlocks what. "Not now" keeps nothing, so it's asked next time.

import { bandFromBirth, type AgeBand } from '../hero/age';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function openAgeGate(onAnswer: (band: AgeBand) => void): void {
  document.querySelector('#ui .limitpop')?.remove();
  const now = new Date();
  const years = Array.from({ length: 100 }, (_, i) => now.getFullYear() - i);
  const box = document.createElement('div');
  box.className = 'limitpop agegate';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = `<div class="box">
      <h2>Before your first hero portrait</h2>
      <p>When were you born?</p>
      <div class="when">
        <select class="month" aria-label="Month"><option value="">Month</option>${MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select>
        <select class="year" aria-label="Year"><option value="">Year</option>${years.map((y) => `<option value="${y}">${y}</option>`).join('')}</select>
      </div>
      <p class="small">We only keep your age group, not your birthday.</p>
      <div class="actions">
        <button class="btn ghost close">Not now</button>
        <button class="btn primary ok" disabled>Continue</button>
      </div>
    </div>`;
  const month = box.querySelector<HTMLSelectElement>('.month')!;
  const year = box.querySelector<HTMLSelectElement>('.year')!;
  const ok = box.querySelector<HTMLButtonElement>('.ok')!;
  const ready = () => { ok.disabled = !month.value || !year.value; };
  month.addEventListener('change', ready);
  year.addEventListener('change', ready);
  const close = () => box.remove();
  box.querySelector('.close')!.addEventListener('click', close);
  box.addEventListener('click', (e) => {
    if (e.target === box) close();
  });
  ok.addEventListener('click', () => {
    if (ok.disabled) return;
    const band = bandFromBirth(Number(month.value), Number(year.value), now);
    close();
    onAnswer(band);
  });
  (document.querySelector('#ui') ?? document.body).appendChild(box);
  month.focus({ preventScroll: true });
}
