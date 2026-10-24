# Signal lists

Detection *data* lives here, separate from detection *code* — the way uBlock Origin separates its engine from its filter lists. Lists change far more often than plugins (a new extension release renames its files, a new framework adds a global), and updating one needs no code review of logic.

| List | Feeds | What it holds |
| --- | --- | --- |
| [automation-globals](automation-globals.json) | `detector.automation-globals` | Window/document properties and attributes left by automation frameworks |
| [stack-markers](stack-markers.json) | `detector.sensitive-reads` | Stack-trace substrings that identify automation or extension callers |
| [agent-extensions](agent-extensions.json) | `detector.extension-probe` | Agent extensions and their probeable web-accessible resources |
| [dom-attribute-patterns](dom-attribute-patterns.json) | `detector.dom-mutations` | Attribute-name patterns added by agent tooling |
| [software-renderers](software-renderers.json) | `detector.headless` | WebGL renderer names that mean software rendering |

## Format

```json
{
  "name": "agent-extensions",
  "version": "2026.10.24",
  "description": "One sentence.",
  "data": []
}
```

- `name` matches the file name. `version` is the date of the last change.
- `data` is whatever the consuming plugin's config key expects (an array or an object).

## How plugins use them

A plugin declares which config keys come from which list:

```js
lists: { names: 'automation-globals.names', prefixes: 'automation-globals.prefixes' },
```

Precedence: plugin `defaults` < list < host config. Plugins keep working without lists (tests, minimal embeds) because their defaults remain.

## Changing a list

1. Edit the JSON and bump `version` to today's date.
2. Cite the source in the PR (manifest excerpt, framework source line, a run export).
3. `npm run check` validates every list and every plugin reference.

Lists have their own owners in `CODEOWNERS`, so data updates do not wait on plugin reviewers.
