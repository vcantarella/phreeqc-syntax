# Maintaining this extension

A guide for making changes without prior VS Code extension / TypeScript / TextMate experience.
The golden rule: **after any change, run `npm test`, then press F5 and glance at `examples/demo.pqi`.**

## One-time setup

```bash
npm install        # installs the dev tools (TypeScript, esbuild, test runner)
```

## Map of the repo — "I want to change X → edit Y"

| I want to... | Edit this file | Then |
|---|---|---|
| Fix/extend documentation shown on hover or in autocomplete | `data/phreeqc-keywords.json` | `npm test`, F5 |
| Add a new keyword block | `data/phreeqc-keywords.json` **and** `phreeqc.tmLanguage.json` (see recipe 2) | `npm test`, F5 |
| Add or change a snippet | `snippets/phreeqc.json` | F5 (snippets have no tests) |
| Change what gets highlighted / colors | `phreeqc.tmLanguage.json` (see recipe 4) | `npm test`, F5 |
| Change completion/hover *behavior* | `src/core.ts` (logic) or `src/extension.ts` (VS Code wiring) | `npm test`, F5 |
| Change bracket matching, comment toggling, word selection | `language-configuration.json` | F5 |
| Change marketplace metadata (name, description, version) | `package.json` | — |

Files you normally never touch: `tools/scrape-manual.mjs` (generator that built the JSON from
the online USGS manual — hand-authored fixups live inside it, so it can be re-run), `dist/` and
`dist-test/` (build output), `phreeqc_notepad_config` (historical keyword source, used by the
tests as a completeness checklist), `tests/corpus/` (the official USGS example inputs ex1–ex22,
public domain, plus `.snap` grammar snapshots — see below).

## Recipes

### 1. Fix a description, example, or broken manual link

Everything hover/autocomplete shows lives in `data/phreeqc-keywords.json`. Shape:

```jsonc
"blocks": {
  "SOLUTION": {
    "description": "Shown at the top of the hover. Keep it a few sentences.",
    "syntax": "SOLUTION [number] [description]",     // shown as a code line
    "example": ["SOLUTION 1", "    pH 7.0"],          // one array item per line
    "manualUrl": "https://...",                        // the hover's manual link
    "hasBasic": false,                                 // true only for RATES/USER_*/CALCULATE_VALUES
    "options": {
      "-temp": { "description": "...", "syntax": "temp temperature" }
    }
  }
},
"basic": {
  "TOT": { "signature": "TOT(\"element\")", "description": "...", "manualUrl": "https://..." },
  "IF":  { "kind": "statement", "signature": "IF a THEN b", "description": "...", "manualUrl": "..." }
}
```

Edit the JSON, run `npm test`. The tests catch structural mistakes (missing fields, bad URLs,
deleted keywords) and tell you exactly which entry is wrong.

### 2. Add a new keyword block (e.g. a future PHREEQC release adds one)

1. Add an entry under `"blocks"` in `data/phreeqc-keywords.json` (copy a similar one).
2. Add the keyword name to **both** long alternations in `phreeqc.tmLanguage.json`
   (the `keywords` rule and the `end` pattern of `basicRegion` — search for `TRANSPORT|USE`
   and insert your keyword in alphabetical position, both places).
3. Optional: add an assertion line to `tests/grammar/highlight.test.pqi` (see recipe 4).
4. `npm test`, F5.

### 3. Add or change a snippet

Snippets live in `snippets/phreeqc.json`. `${1:default}` are Tab stops, `${2|a,b,c|}` is a
choice dropdown, `$0` is where the cursor ends. The `"prefix"` is what the user types to
trigger it. Reload the F5 window to try it (no build needed).

### 4. Change highlighting

`phreeqc.tmLanguage.json` maps regexes to *scope names*; the user's color theme decides the
actual colors. Scopes used here: `keyword.control.phreeqc` (blocks), `variable.parameter.phreeqc`
(`-options`), `constant.numeric.phreeqc`, `string.quoted.*`, `comment.line.*`,
`support.function.phreeqc` (BASIC functions), `keyword.control.basic.phreeqc` (BASIC statements).

Highlighting is tested in `tests/grammar/highlight.test.pqi`: each `#   ^^^^ scope.name` line
asserts that the characters under the carets (on the line above) have that scope. Add a line
for whatever you change, then `npm test`. In the F5 window, the command
*"Developer: Inspect Editor Tokens and Scopes"* shows the scopes under the cursor — invaluable
when a regex doesn't do what you expect. After grammar edits, reload the F5 window
(`Developer: Reload Window`).

### 5. Change completion or hover behavior

- `src/core.ts` — all the logic, plain functions over arrays of lines. No VS Code knowledge needed.
- `src/extension.ts` — thin adapter that converts VS Code documents/positions to plain data.

If `npm test` is green but the editor misbehaves, the bug is in `extension.ts`; otherwise it's
in `core.ts` — add a failing case to `tests/core.test.mjs` first, then fix.

## How to check everything works

```bash
npm test             # everything below, in one command
npm run typecheck    # TypeScript type errors
```

What `npm test` runs:

1. **Logic tests** (`tests/core.test.mjs`) — completion context, option lookup, hover text.
2. **Data-file checks** (`tests/data.test.mjs`) — every entry complete, nothing from the
   original keyword lists missing.
3. **Corpus tests** (`tests/corpus.test.mjs`) — the official USGS examples ex1–ex22 in
   `tests/corpus/`: every keyword and every `-option` they use must be known to the
   extension, and completion/hover must work at every position. If you delete something
   from the data file that real inputs use, this fails and names the file and line.
4. **Grammar assertions** (`tests/grammar/highlight.test.pqi`) — hand-picked scope checks.
5. **Grammar snapshots** (`tests/corpus/*.snap`) — the exact highlighting of all corpus
   files, compared token by token. Any grammar change that alters real-file highlighting
   shows up as a diff here. If the change is *intended*, regenerate the snapshots and
   commit them:

   ```bash
   npm run snap-update
   git diff tests/corpus   # review: is this the highlighting change you meant to make?
   ```

Then the 2-minute manual check: press **F5** (opens an "Extension Development Host" window),
open `examples/demo.pqi` there, and verify:

1. The file is colored; lowercase `solution 1` and `USE solution 1` highlight.
2. `Ctrl+Space` on a fresh line offers keyword blocks.
3. Inside `SOLUTION`, typing `-` offers `-temp`, `-units`, ... (its options first).
4. Inside the `RATES` `-start`/`-end` body, completion offers `TOT`, `SR`, `TIME`.
5. Hovering `SOLUTION`, `-temp`, or `TOT` shows documentation with a working manual link.
6. On a fresh line, typing `solution` + Tab expands the snippet.

## CI

Every push to `main` and every pull request runs the full check suite on GitHub Actions
(`.github/workflows/ci.yml`) and attaches the built `.vsix` as a downloadable artifact —
so you always know whether the repo is releasable.

## How to release a new version

Releases are automated (`.github/workflows/release.yml`): pushing a version tag packages
the extension, creates a GitHub Release with the `.vsix` attached, and publishes it to the
VS Code Marketplace.

1. Bump `"version"` in `package.json` (e.g. `0.1.0` → `0.1.1` for fixes, `0.2.0` for features).
2. Add a section to `CHANGELOG.md`.
3. Commit, then tag and push — the tag must match the version:

   ```bash
   git commit -am "Release 0.2.0"
   git tag v0.2.0
   git push && git push --tags
   ```

4. Watch the *Release* workflow on GitHub → Actions. It refuses to publish if any test
   fails or the tag doesn't match `package.json`.

**One-time setup** for marketplace publishing from CI: create a Personal Access Token for
the `VitorCantarella` publisher (see the
[vsce docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)),
then add it on GitHub under *Settings → Secrets and variables → Actions* as a secret named
`VSCE_PAT`. Tokens expire (max ~1 year) — when a release fails with an authentication
error, create a fresh token and update the secret.

**Manual fallback** (CI unavailable): `npm run package` builds the `.vsix` locally after
running all tests; `npx vsce publish` publishes it (uses a locally stored token via
`vsce login VitorCantarella`). You can also install the `.vsix` locally first via
Extensions view → `...` → *Install from VSIX*.

## Troubleshooting

- **Completion/hover stopped appearing**: run `npm test`. Green → the bug is in
  `src/extension.ts` or the build is stale (`npm run build`). Red → the failing test names the file.
- **Grammar change has no effect in F5**: reload the window (`Developer: Reload Window`).
- **`npm test` fails after editing the JSON**: the assertion message names the exact entry
  and field, e.g. `SOLUTION -temp: syntax`.
- **F5 does nothing**: you need the repo open as the workspace folder in VS Code, and
  `npm install` must have been run once.
- **Manual links 404**: USGS occasionally moves pages. Links are plain data in
  `data/phreeqc-keywords.json` — fix the URL, bump the patch version, republish.

## Asking an AI for help

The whole repo is small. When stuck, give an assistant this file plus the failing `npm test`
output (or a description of the wrong behavior) and the file you edited — that is enough
context to fix almost anything here.
