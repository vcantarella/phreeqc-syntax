// Types and case-insensitive indexes over data/phreeqc-keywords.json.
// No vscode imports here — this module must stay testable with plain Node.
import raw from "../data/phreeqc-keywords.json";

export interface OptionEntry {
  description: string;
  syntax: string;
  /** Alternate full spellings the manual lists ("Optionally, uncertainty, uncertainties, ...") */
  aliases?: string[];
}

export interface BlockEntry {
  description: string;
  syntax: string;
  example: string[];
  manualUrl: string;
  hasBasic: boolean;
  options: Record<string, OptionEntry>;
}

export interface BasicEntry {
  kind?: string; // "statement" | undefined (function)
  signature: string;
  description: string;
  manualUrl: string;
}

export interface KeywordData {
  meta: { source: string; manualIndexUrl: string };
  blocks: Record<string, BlockEntry>;
  basic: Record<string, BasicEntry>;
}

export const data = raw as KeywordData;

/** Keyword synonyms PHREEQC accepts. Evidence-based only (SOLID_SOLUTION appears in USGS example ex20a). */
const BLOCK_SYNONYMS: Record<string, string> = {
  SOLID_SOLUTION: "SOLID_SOLUTIONS",
};

/** UPPERCASE block name (or synonym) -> [canonical name, entry] */
export const blockIndex = new Map<string, [string, BlockEntry]>();
for (const [name, entry] of Object.entries(data.blocks)) {
  blockIndex.set(name.toUpperCase(), [name, entry]);
}
for (const [synonym, canonical] of Object.entries(BLOCK_SYNONYMS)) {
  const hit = blockIndex.get(canonical);
  if (hit) blockIndex.set(synonym, hit);
}

/** UPPERCASE BASIC name -> [canonical name, entry] */
export const basicIndex = new Map<string, [string, BasicEntry]>();
for (const [name, entry] of Object.entries(data.basic)) {
  basicIndex.set(name.toUpperCase(), [name, entry]);
}

/** per block: lowercase "-name" (canonical or alias) -> [canonical name, entry] */
export const optionIndexes = new Map<string, Map<string, [string, OptionEntry]>>();
for (const [name, entry] of Object.entries(data.blocks)) {
  const idx = new Map<string, [string, OptionEntry]>();
  for (const [opt, optEntry] of Object.entries(entry.options)) {
    idx.set(opt.toLowerCase(), [opt, optEntry]);
    for (const alias of optEntry.aliases ?? []) {
      if (!idx.has(alias.toLowerCase())) idx.set(alias.toLowerCase(), [opt, optEntry]);
    }
  }
  optionIndexes.set(name, idx);
}
