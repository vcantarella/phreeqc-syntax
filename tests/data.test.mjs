// Data-file sanity: schema shape and completeness against the Notepad++ UDL
// keyword lists (phreeqc_notepad_config), which the original grammar was built from.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../data/phreeqc-keywords.json", import.meta.url), "utf8"));
const udl = readFileSync(new URL("../phreeqc_notepad_config", import.meta.url), "utf8");
const udlList = (name) => udl.match(new RegExp(`name="${name}">([^<]*)<`))[1].trim().split(/\s+/).filter(Boolean);

test("meta records the public-domain source", () => {
  assert.ok(data.meta.source.includes("public domain") || data.meta.source.includes("Public domain"));
  assert.ok(data.meta.manualIndexUrl.startsWith("https://"));
});

test("every block entry is complete", () => {
  for (const [name, entry] of Object.entries(data.blocks)) {
    assert.ok(entry.description.length > 0, `${name}: description`);
    assert.ok(entry.syntax.length > 0, `${name}: syntax`);
    assert.ok(entry.manualUrl.startsWith("https://"), `${name}: manualUrl`);
    assert.equal(typeof entry.hasBasic, "boolean", `${name}: hasBasic`);
    for (const [opt, optEntry] of Object.entries(entry.options)) {
      assert.ok(opt.startsWith("-"), `${name} ${opt}: options are hyphen-prefixed`);
      assert.ok(optEntry.syntax.length > 0, `${name} ${opt}: syntax`);
    }
  }
});

test("every UDL block keyword exists in the data file", () => {
  const have = new Set(Object.keys(data.blocks).map((k) => k.toUpperCase()));
  for (const kw of udlList("Keywords1")) {
    assert.ok(have.has(kw.toUpperCase()), `missing block keyword: ${kw}`);
  }
});

test("every UDL BASIC name exists in the data file", () => {
  const have = new Set(Object.keys(data.basic).map((k) => k.toUpperCase()));
  for (const kw of [...udlList("Keywords3"), ...udlList("Keywords4")]) {
    assert.ok(have.has(kw.toUpperCase()), `missing BASIC name: ${kw}`);
  }
});

test("every BASIC entry is complete", () => {
  for (const [name, entry] of Object.entries(data.basic)) {
    assert.ok(entry.signature.length > 0, `${name}: signature`);
    assert.ok(entry.description.length > 0, `${name}: description`);
    assert.ok(entry.manualUrl.startsWith("https://"), `${name}: manualUrl`);
  }
});

test("exactly the five BASIC-capable blocks have hasBasic", () => {
  const expected = ["CALCULATE_VALUES", "RATES", "USER_GRAPH", "USER_PRINT", "USER_PUNCH"];
  const actual = Object.entries(data.blocks).filter(([, e]) => e.hasBasic).map(([k]) => k).sort();
  assert.deepEqual(actual, expected);
});
