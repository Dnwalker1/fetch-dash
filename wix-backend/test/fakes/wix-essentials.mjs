export let elevated = 0;
export const auth = { elevate: (fn) => { elevated++; return fn; } };
