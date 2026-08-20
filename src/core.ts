// All completion/hover logic as pure functions over plain strings.
// No vscode imports here — tests run this with plain Node (see tests/core.test.mjs).
import { data, blockIndex, basicIndex, optionIndexes, BlockEntry, BasicEntry, OptionEntry } from "./data";

// Re-exported for the corpus tests (tests/corpus.test.mjs checks real inputs against these).
export { blockIndex, basicIndex } from "./data";

/** Word shape shared with the hover/completion adapters (mirrors wordPattern in language-configuration.json). */
export const WORD_PATTERN = /-?[A-Za-z_][A-Za-z0-9_$]*/;

const ATTRIBUTION = "*Excerpt from USGS TM 6-A43 (Parkhurst and Appelo, 2013), public domain*";
// ponytail: context scan is a backward line loop capped at 5000 lines, no parsing.
const SCAN_CAP = 5000;

export interface BlockCtx {
  name: string;
  entry: BlockEntry;
}

function firstToken(line: string): string | null {
  const m = line.split("#")[0].match(/^\s*(\S+)/);
  return m ? m[1] : null;
}

/** The keyword block governing `lineNo`, or null at top level (before any block / after END). */
export function blockContext(lines: readonly string[], lineNo: number): BlockCtx | null {
  const start = Math.min(lineNo, lines.length - 1);
  for (let i = start; i >= 0 && i > start - SCAN_CAP; i--) {
    const first = firstToken(lines[i]);
    if (!first) continue;
    const upper = first.toUpperCase();
    if (upper === "END") return null;
    const hit = blockIndex.get(upper);
    if (hit) return { name: hit[0], entry: hit[1] };
  }
  return null;
}

/**
 * Resolve a word to an option of the given block, the way PHREEQC does:
 * exact match, else (for hyphenated words) unique abbreviation, else the
 * longest option the word extends (e.g. "-temperature" -> "-temp").
 */
export function lookupOption(blockName: string, word: string): [string, OptionEntry] | null {
  const idx = optionIndexes.get(blockName);
  if (!idx) return null;
  const key = "-" + word.replace(/^-/, "").toLowerCase();
  const exact = idx.get(key);
  if (exact) return exact;
  if (!word.startsWith("-")) return null; // bare words only match exactly, to avoid false hits on species names
  // Dedupe by canonical name: an option and its aliases count as one candidate.
  const abbrev = [...new Map([...idx.entries()].filter(([k]) => k.startsWith(key)).map(([, v]) => [v[0], v])).values()];
  if (abbrev.length === 1) return abbrev[0];
  const longForm = [...idx.keys()].filter((k) => key.startsWith(k)).sort((a, b) => b.length - a.length);
  if (longForm.length > 0) return idx.get(longForm[0])!;
  return null;
}

// ---------- completion ----------

export interface Item {
  label: string;
  kind: "keyword" | "option" | "basicFunction" | "basicStatement";
  detail: string;
  doc: string;
  sortText: string;
  snippet?: string;
}

function shortDoc(description: string, url: string): string {
  return `${description}\n\n[PHREEQC manual](${url})`;
}

const keywordItems: Item[] = Object.entries(data.blocks).map(([name, entry]) => ({
  label: name,
  kind: "keyword",
  detail: entry.syntax,
  doc: shortDoc(entry.description, entry.manualUrl),
  sortText: "2" + name,
}));

function basicSnippet(name: string, entry: BasicEntry): string | undefined {
  if (entry.kind === "statement") return undefined;
  if (entry.signature.includes('("')) return `${name}("$1")`;
  if (entry.signature.includes("(")) return `${name}($1)`;
  return undefined;
}

const basicItems: Item[] = Object.entries(data.basic).map(([name, entry]) => ({
  label: name,
  kind: entry.kind === "statement" ? "basicStatement" : "basicFunction",
  detail: entry.signature,
  doc: shortDoc(entry.description, entry.manualUrl),
  sortText: "1" + name,
  snippet: basicSnippet(name, entry),
}));

const optionItems = new Map<string, Item[]>(
  Object.entries(data.blocks).map(([blockName, entry]) => [
    blockName,
    Object.entries(entry.options).map(([opt, optEntry]) => ({
      label: opt,
      kind: "option" as const,
      detail: optEntry.syntax,
      doc: shortDoc(optEntry.description || optEntry.syntax, entry.manualUrl),
      sortText: "0" + opt,
    })),
  ])
);

/** Completion items for the cursor position: current block's options, BASIC names (in BASIC blocks), then keywords. */
export function completionsFor(lines: readonly string[], lineNo: number): Item[] {
  const ctx = blockContext(lines, lineNo);
  const items: Item[] = [];
  if (ctx) {
    items.push(...(optionItems.get(ctx.name) ?? []));
    if (ctx.entry.hasBasic) items.push(...basicItems);
  }
  items.push(...keywordItems);
  return items;
}

// ---------- hover ----------

function fence(text: string): string {
  return "```\n" + text + "\n```";
}

function footer(label: string, url: string): string {
  return `[PHREEQC v3 manual — ${label}](${url})\n\n${ATTRIBUTION}`;
}

function blockHover(name: string, entry: BlockEntry): string {
  const parts = [`**${name}** — keyword data block`, entry.description, fence(entry.syntax)];
  if (entry.example.length > 0) parts.push("Example:", fence(entry.example.join("\n")));
  parts.push(footer(name, entry.manualUrl));
  return parts.join("\n\n");
}

function optionHover(opt: string, optEntry: OptionEntry, blockName: string, blockEntry: BlockEntry, also: string[] = []): string {
  const parts = [`**${opt}** — option of **${blockName}**`];
  if (optEntry.description) parts.push(optEntry.description);
  parts.push(fence(optEntry.syntax));
  if (also.length > 0) parts.push(`Also an option of: ${also.join(", ")}`);
  parts.push(footer(blockName, blockEntry.manualUrl));
  return parts.join("\n\n");
}

function basicHover(name: string, entry: BasicEntry): string {
  const label = entry.kind === "statement" ? "BASIC statement" : "BASIC function";
  return [`**${name}** — ${label}`, fence(entry.signature), entry.description, footer("The Basic Interpreter", entry.manualUrl)].join("\n\n");
}

/** Markdown hover for the word at the cursor, or null when we know nothing about it. */
export function hoverFor(word: string, lines: readonly string[], lineNo: number): string | null {
  const upper = word.toUpperCase();
  const block = blockIndex.get(upper);
  if (block) return blockHover(block[0], block[1]);

  const ctx = blockContext(lines, lineNo);
  if (ctx) {
    const opt = lookupOption(ctx.name, word);
    if (opt) return optionHover(opt[0], opt[1], ctx.name, ctx.entry);
    if (ctx.entry.hasBasic) {
      const basic = basicIndex.get(upper);
      if (basic) return basicHover(basic[0], basic[1]);
    }
  }

  // Fallback: exact option of any block (pasted text, or the context scan guessed wrong).
  const key = "-" + word.replace(/^-/, "").toLowerCase();
  const owners: [string, BlockEntry, string, OptionEntry][] = [];
  for (const [blockName, entry] of Object.entries(data.blocks)) {
    const hit = optionIndexes.get(blockName)?.get(key);
    if (hit) owners.push([blockName, entry, hit[0], hit[1]]);
  }
  if (owners.length > 0) {
    const [blockName, entry, opt, optEntry] = owners[0];
    return optionHover(opt, optEntry, blockName, entry, owners.slice(1).map((o) => o[0]));
  }
  return null;
}
