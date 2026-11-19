# Fetch Dash

A pet runner game from Goodwookie Productions. It will tie into the Design Your Pet app and goodwookie.com.

Your pet runs on its own. You keep it out of trouble and on task:

| Action | Phone | Keyboard |
| --- | --- | --- |
| Jump | Tap | Space |
| Slide (and fast-fall in the air) | Swipe down | Down arrow |
| Keep your pet on task (call it back) | Swipe up | Up arrow |

## Week 1 prototype

This version uses placeholder shapes only, so we can find out whether the game is fun before adding art.

- The pet speeds up over time. Reach the ball at 600 m to finish Level 1 (about a minute).
- Fences and puddles need a jump. Low branches need a slide (or a well-timed jump).
- Treats are worth 10 points each.
- Distractions show up every 8 to 13 seconds. Swipe up during the warning ("!" or "?") for a +50 focus bonus.
  - Squirrel on the trail: if you wait, your pet turns around, the run slows down, and your pet runs back after it. If it gets too far back, the run ends.
  - Bird in the sky or a critter in a den hole: out of reach, so your pet just stops to stare and the run slows down until you call it back.
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
