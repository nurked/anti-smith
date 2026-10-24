import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/** Reads lists/*.json → { [name]: { version, description, data } }. */
export async function loadLists(root) {
  const dir = path.join(root, 'lists');
  const lists = {};
  let files = [];
  try {
    files = (await readdir(dir)).filter((file) => file.endsWith('.json')).sort();
  } catch {
    return lists;
  }
  for (const file of files) {
    const list = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    lists[list.name] = { version: list.version, description: list.description, data: list.data, file };
  }
  return lists;
}
