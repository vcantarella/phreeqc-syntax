// Corpus tests: the official PHREEQC example inputs (ex1..ex22, USGS distribution,
// public domain) live in tests/corpus/. Every keyword and option they use must be
// known to the extension, and the providers must hold up at every position.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { blockContext, lookupOption, hoverFor, completionsFor, blockIndex } from "../dist-test/core.mjs";

const dir = new URL("./corpus/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".pqi"));

// Data-line tokens that look like keywords (3+ uppercase letters/underscores) but are not.
// Add here (with the file that uses them) only after checking the token really is data.
const NOT_KEYWORDS = new Set([]);

test("corpus is present", () => {
  assert.ok(files.length >= 25, `expected the ex1..ex22 corpus, found ${files.length} files`);
});

for (const f of files) {
  const lines = readFileSync(new URL(f, dir), "utf8").split(/\r?\n/);

  test(`corpus ${f}: every keyword and option is recognized`, () => {
    let keywordLines = 0;
    lines.forEach((line, i) => {
      const code = line.split("#")[0];
      const first = code.match(/^\s*(\S+)/)?.[1];
      if (!first) return;
      const ctx = blockContext(lines, i);
      if (blockIndex.has(first.toUpperCase()) || first.toUpperCase() === "END") {
        keywordLines++;
      } else if (
        /^[A-Z][A-Z_$]{2,}$/.test(first) && // keyword-shaped: 3+ chars, all caps, no digits
        ctx?.name !== "TITLE" && // TITLE is followed by free text
        !ctx?.entry.hasBasic && // BASIC bodies contain all-caps identifiers
        !NOT_KEYWORDS.has(first)
      ) {
        assert.fail(`${f}:${i + 1}: keyword-shaped token "${first}" is not a known keyword`);
      }
      const opt = code.match(/^\s*(-[A-Za-z][A-Za-z0-9_]*)/);
      if (opt) {
        assert.ok(ctx, `${f}:${i + 1}: option ${opt[1]} outside any block`);
        assert.ok(lookupOption(ctx.name, opt[1]), `${f}:${i + 1}: [${ctx.name}] unknown option ${opt[1]}`);
      }
    });
    assert.ok(keywordLines > 0, "file contains at least one keyword line");
  });

  test(`corpus ${f}: completion and hover never break`, () => {
    lines.forEach((line, i) => {
      const items = completionsFor(lines, i);
      assert.ok(items.length > 0);
      for (const m of line.matchAll(/-?[A-Za-z_][A-Za-z0-9_$]*/g)) {
        const md = hoverFor(m[0], lines, i);
        assert.ok(md === null || typeof md === "string");
      }
    });
  });
}
