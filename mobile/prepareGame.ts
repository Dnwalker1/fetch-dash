import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

import { GAME_FILES, GAME_VERSION } from './game/manifest';

/**
 * Copies the bundled web game into the app's documents folder (once per game
 * version) and returns the folder, so the WebView can open game/index.html
 * from real files next to its art.
 */
export async function prepareGame(onProgress?: (done: number, total: number) => void): Promise<Directory> {
  const dir = new Directory(Paths.document, 'game');
  const stamp = new File(dir, '.version');
  if (stamp.exists && stamp.textSync() === GAME_VERSION) return dir;

  if (dir.exists) dir.delete();
  dir.create({ intermediates: true });

  let done = 0;
  const copyOne = async ([path, asset]: [string, number]) => {
    const a = Asset.fromModule(asset);
    await a.downloadAsync();
    if (!a.localUri) throw new Error(`Game file missing: ${path}`);
    const dest = new File(dir, path);
    dest.parentDirectory.create({ intermediates: true, idempotent: true });
    new File(a.localUri).copySync(dest);
    onProgress?.(++done, GAME_FILES.length);
  };

  // A few at a time keeps first launch quick without flooding the device.
  const queue = [...GAME_FILES];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) await copyOne(next);
    }),
  );

  stamp.write(GAME_VERSION);
  return dir;
}
