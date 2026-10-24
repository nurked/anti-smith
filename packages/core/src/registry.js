import { validatePlugin } from './plugin.js';

/** Holds validated plugins by id. Each runtime owns one registry. */
export function createRegistry() {
  const plugins = new Map();

  return {
    register(plugin) {
      const problems = validatePlugin(plugin);
      if (problems.length) {
        throw new TypeError(`Invalid plugin ${plugin?.id ?? '(unknown)'}: ${problems.join('; ')}`);
      }
      if (plugins.has(plugin.id)) throw new Error(`Duplicate plugin id ${plugin.id}`);
      plugins.set(plugin.id, plugin);
      return plugin;
    },
    get: (id) => plugins.get(id),
    has: (id) => plugins.has(id),
    list: (kind) => [...plugins.values()].filter((plugin) => !kind || plugin.kind === kind),
  };
}
