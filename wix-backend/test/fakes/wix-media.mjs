// Media Manager stand-in. `files` holds the IDs that exist; `trash` would hold
// trashed ones, which the tests check stays empty.
export const store = { files: new Set(), trash: new Set(), refuse: new Set() };
export const files = {
  async bulkDeleteFiles(ids, opts) {
    for (const id of ids) if (store.refuse.has(id)) throw new Error('boom');
    for (const id of ids) if (!store.files.has(id)) throw new Error('File not found');
    for (const id of ids) { store.files.delete(id); if (!opts?.permanent) store.trash.add(id); }
  }
};
