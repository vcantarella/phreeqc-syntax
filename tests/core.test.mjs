// Logic tests. Run via `npm test` (pretest bundles src/core.ts -> dist-test/core.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { blockContext, completionsFor, hoverFor, lookupOption } from "../dist-test/core.mjs";

const doc = `TITLE test
SOLUTION 1
    temp 25
# comment

END
solution 2
    pH 7.0
RATES
    Calcite
    -start
10 rate = TOT("Ca")
    -end
END`.split("\n");

test("blockContext finds the enclosing block", () => {
  assert.equal(blockContext(doc, 2)?.name, "SOLUTION");
});

test("blockContext skips comment and blank lines", () => {
  assert.equal(blockContext(doc, 4)?.name, "SOLUTION");
});

test("blockContext resets to top level at END", () => {
  assert.equal(blockContext(doc, 5), null);
});

test("blockContext recognizes lowercase keywords", () => {
  assert.equal(blockContext(doc, 7)?.name, "SOLUTION");
});

test("blockContext flags BASIC-capable blocks", () => {
  const ctx = blockContext(doc, 11);
  assert.equal(ctx?.name, "RATES");
  assert.equal(ctx?.entry.hasBasic, true);
});

test("top level offers keywords but no options or BASIC names", () => {
  const items = completionsFor(["# nothing yet"], 0);
  assert.ok(items.some((i) => i.label === "SOLUTION" && i.kind === "keyword"));
  assert.ok(!items.some((i) => i.kind === "option"));
  assert.ok(!items.some((i) => i.kind === "basicFunction"));
});

test("inside SOLUTION offers its options first, no BASIC", () => {
  const items = completionsFor(doc, 2);
  const temp = items.find((i) => i.label === "-temp");
  assert.ok(temp, "-temp offered");
  assert.ok(temp.sortText.startsWith("0"), "options sort before keywords");
  assert.ok(!items.some((i) => i.label === "TOT"));
});

test("inside RATES offers BASIC functions and its options", () => {
  const items = completionsFor(doc, 11);
  const tot = items.find((i) => i.label === "TOT");
  assert.ok(tot, "TOT offered");
  assert.equal(tot.kind, "basicFunction");
  assert.equal(tot.snippet, 'TOT("$1")');
  assert.ok(items.some((i) => i.label === "-start"));
});

test("option lookup: unique abbreviation and long form resolve", () => {
  assert.equal(lookupOption("TRANSPORT", "-len")?.[0], "-lengths");
  assert.equal(lookupOption("SOLUTION", "-temperature")?.[0], "-temp");
});

test("hover on a keyword shows description and manual link", () => {
  const md = hoverFor("SOLUTION", doc, 1);
  assert.ok(md.includes("**SOLUTION**"));
  assert.ok(md.includes("PHREEQC v3 manual"));
  assert.ok(md.includes("public domain"));
});

test("hover on options works hyphenated and bare", () => {
  assert.ok(hoverFor("-temp", doc, 2).includes("option of **SOLUTION**"));
  assert.ok(hoverFor("temp", doc, 2).includes("option of **SOLUTION**"));
});

test("hover on a BASIC function inside RATES", () => {
  assert.ok(hoverFor("SR", doc, 11).includes("BASIC function"));
});

test("hover falls back to any block defining the option", () => {
  const md = hoverFor("-log_k", ["# top level"], 0);
  assert.ok(md, "found a defining block");
  assert.ok(md.includes("option of"));
});

test("hover on an unknown word returns null", () => {
  assert.equal(hoverFor("Xyzzyite", doc, 2), null);
});
