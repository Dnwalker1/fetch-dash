# Fetch Dash

A pet runner game from Goodwookie Productions. It will tie into the Design Your Pet app and goodwookie.com.

Your pet runs on its own. You keep it out of trouble and on task:

| Action | Phone | Keyboard |
| --- | --- | --- |
| Jump | Tap | Space |
| Slide (and fast-fall in the air) | Swipe down | Down arrow |
| Call your pet back from a distraction | Swipe up | Up arrow |

## Week 1 prototype

This version uses placeholder shapes only, so we can find out whether the game is fun before adding art.

- The pet speeds up over time.
- Fences and puddles need a jump. Low branches need a slide.
- Treats are worth 10 points each.
- A squirrel shows up about every 11 to 18 seconds. Swipe up within about a second for a focus bonus. Wait too long and your pet starts chasing it and drifting back. If it drifts off the left edge, the run ends.
- Your best score is saved on your device.

All the numbers that control how the game feels are in `src/config.ts`.

## Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open the address it prints, usually http://localhost:5173. To try it on your phone, run `npm run dev -- --host` and open the "Network" address on a phone that is on the same Wi-Fi.

`npm run build` checks the code and makes a web-ready copy of the game in `dist/`.

## Tech

[Phaser 3](https://phaser.io) with TypeScript, built with [Vite](https://vite.dev). Later, the web build gets wrapped in an Expo app for iOS and Android.
