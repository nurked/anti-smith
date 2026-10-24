import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

/** Folder name under plugins/ for each plugin kind. */
export const KIND_FOLDERS = { detector: 'detectors', responder: 'responders', sink: 'sinks', scorer: 'scorers' };

/**
 * Finds every plugin entry point: plugins/<kind folder>/<name>/index.js.
 * The expected id is derived from the path, so adding a plugin never requires
 * editing a shared list (no merge conflicts between contributors).
 */
export async function discoverPlugins(root) {
  const found = [];
  for (const [kind, folder] of Object.entries(KIND_FOLDERS)) {
    const kindDir = path.join(root, 'plugins', folder);
    let names = [];
    try {
      names = await readdir(kindDir);
    } catch {
      continue;
    }
    for (const name of names.sort()) {
      const dir = path.join(kindDir, name);
      const entry = path.join(dir, 'index.js');
      if (!(await isFile(entry))) continue;
      found.push({
        id: `${kind}.${name}`,
        kind,
        name,
        dir,
        entry,
        urlPath: `/plugins/${folder}/${name}/index.js`,
      });
    }
  }
  return found;
}

async function isFile(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}
