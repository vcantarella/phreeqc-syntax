// One-time bootstrap: scrape the online USGS PHREEQC v3 manual (public domain,
// Parkhurst & Appelo 2013, TM 6-A43) into data/phreeqc-keywords.json.
//
//   node tools/scrape-manual.mjs
//
// The committed JSON is the source of truth — after re-running this, DIFF the
// result before committing. Hand-edits in the JSON are expected and normal.
// ponytail: regex-over-HTML parser tuned to this FrameMaker export, not general HTML.

import { writeFileSync, mkdirSync } from "node:fs";

const BASE = "https://water.usgs.gov/water-resources/software/PHREEQC/documentation/phreeqc3-html/";

// Keywords the extension knows (grammar + completion). TOC-name differences are mapped below.
const KEYWORDS = `ADVECTION CALCULATE_VALUES COPY DATABASE DELETE DUMP END EQUILIBRIUM_PHASES
EQUILIBRIUM_PHASES_MIX EQUILIBRIUM_PHASES_MODIFY EQUILIBRIUM_PHASES_RAW EXCHANGE EXCHANGE_MASTER_SPECIES
EXCHANGE_MIX EXCHANGE_MODIFY EXCHANGE_RAW EXCHANGE_SPECIES GAS_BINARY_PARAMETERS GAS_PHASE GAS_PHASE_MIX
GAS_PHASE_MODIFY GAS_PHASE_RAW INCLUDE$ INCREMENTAL_REACTIONS INVERSE_MODELING ISOTOPES ISOTOPE_ALPHAS
ISOTOPE_RATIOS KINETICS KINETICS_MIX KINETICS_MODIFY KINETICS_RAW KNOBS LLNL_AQUEOUS_MODEL_PARAMETERS
MEAN_GAMMAS MIX MIX_RAW NAMED_EXPRESSIONS PHASES PITZER PRINT RATES RATE_PARAMETERS_HERMANSKA
RATE_PARAMETERS_PK RATE_PARAMETERS_SVD REACTION REACTION_MODIFY REACTION_PRESSURE REACTION_PRESSURE_RAW
REACTION_RAW REACTION_TEMPERATURE REACTION_TEMPERATURE_MODIFY REACTION_TEMPERATURE_RAW RUN_CELLS SAVE
SELECTED_OUTPUT SIT SOLID_SOLUTIONS SOLID_SOLUTIONS_MIX SOLID_SOLUTIONS_MODIFY SOLID_SOLUTIONS_RAW
SOLUTION SOLUTION_MASTER_SPECIES SOLUTION_MIX SOLUTION_MODIFY SOLUTION_RAW SOLUTION_SPECIES
SOLUTION_SPREAD SURFACE SURFACE_MASTER_SPECIES SURFACE_MIX SURFACE_MODIFY SURFACE_RAW SURFACE_SPECIES
TITLE TRANSPORT USE USER_GRAPH USER_PRINT USER_PUNCH`.split(/\s+/).filter(Boolean);

// Our keyword name -> name used in the manual's table of contents.
const TOC_NAME = {
  EQUILIBRIUM_PHASES_MIX: "MIX_EQUILIBRIUM_PHASES",
  EXCHANGE_MIX: "MIX_EXCHANGE",
  GAS_PHASE_MIX: "MIX_GAS_PHASE",
  KINETICS_MIX: "MIX_KINETICS",
  SOLID_SOLUTIONS_MIX: "MIX_SOLID_SOLUTION",
  SOLUTION_MIX: "MIX_SOLUTION",
};
// Pages whose TOC link has no text — match by href instead.
const HREF_OVERRIDE = {
  MEAN_GAMMAS: "mean_gammas.htm",
  GAS_BINARY_PARAMETERS: "gas_binary_parameters.htm",
};

const HAS_BASIC = new Set(["RATES", "USER_PRINT", "USER_PUNCH", "USER_GRAPH", "CALCULATE_VALUES"]);

// BASIC statements (control flow etc.) vs functions, per UDL Keywords4 split.
const BASIC_STATEMENTS = new Set(`AND DATA DIM ELSE ERASE FOR GOSUB GOTO IF MOD NEXT NOT ON OR READ
REM RESTORE RETURN STEP THEN TO WEND WHILE XOR`.split(/\s+/).filter(Boolean));
// Every BASIC name we accept from the tables (UDL Keywords3 + Keywords4, deduped, uppercased).
const BASIC_NAMES = new Set(`ABS AND ARCTAN ASC CHR$ CEIL COS DATA DIM ELSE ERASE EXP FLOOR FOR GOSUB
GOTO IF INSTR LEN LOG LOG10 LTRIM MID$ MOD NEXT NOT ON OR PAD READ REM RESTORE RETURN RTRIM SGN SIN SQR
SQRT STEP STR$ STR_E$ STR_F$ TAN THEN TO TRIM VAL WEND WHILE XOR
ACT ALK APHI CALC_VALUE CELL_NO CHANGE_POR CHANGE_SURF CHARGE_BALANCE COLOR CURRENT_A DEBYE_LENGTH
DELTA_H_PHASE DELTA_H_SPECIES DESCRIPTION DH_A DH_A0 DH_AV DH_B DH_BDOT DIFF_C DIST EDL EDL_SPECIES
EOL$ EOL_NOTAB$ EPS_R EQUI EXISTS FALSE F_VISC GAMMA GAS GAS_P GAS_VM GET GET_POR GFW GRAPH_SY GRAPH_X
GRAPH_Y KAPPA KIN KINETICS_FORMULA$ KIN_DELTA KIN_TIME LA LG LINE_WIDTH LIST_S_S LK_NAMED LK_PHASE
LK_SPECIES LM M M0 MCD_JCONC MCD_JTOT MEANG MISC1 MISC2 MOL MU NO_NEWLINES OSMOTIC PARM PERCENT_ERROR
PHASE_FORMULA$ PHASE_VM PLOT_XY POT_V PRESSURE PRINT PR_P PR_PHI PUNCH PUT QBRN RHO RHO_0 RXN SAVE SC
SETDIFF_C SI SIM_NO SIM_TIME SOLN_VOL SPECIES_FORMULA$ SR STEP_NO SUM_GAS SUM_SPECIES SUM_S_S SURF
SYMBOL SYMBOL_SIZE SYS S_S TC TIME TK TOT TOTAL_TIME TOTMOLE TRUE T_SC VISCOS VISCOS_0 VM`
  .split(/\s+/).filter(Boolean));

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", deg: "°", ndash: "–", mdash: "—" };
function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (_, n) => ENTITIES[n] ?? `&${n};`);
}
function text(html) {
  return decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}
function truncate(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = cut.lastIndexOf(". ");
  return end > max * 0.4 ? cut.slice(0, end + 1) : cut.trimEnd() + "…";
}

async function fetchPage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  // Old pages are FrameMaker/ISO-8859-1, 2024-updated ones are Word/windows-1252 (a superset).
  return new TextDecoder("windows-1252").decode(await res.arrayBuffer());
}

// Flatten a page into ordered elements we care about: p, h2, h6, pre — with class and inner HTML.
// Handles both markup generations: FrameMaker (CLASS="BodyText") and Word 2024 (class=bodytext, or none).
function elements(html) {
  const out = [];
  const re = /<(p|h2|h6|pre)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const cls = (m[2].match(/class=["']?([\w-]+)/i)?.[1] ?? "").toLowerCase();
    out.push({ tag: m[1].toLowerCase(), cls, html: m[3] });
  }
  return out;
}

function parseKeywordPage(html, keyword, url) {
  const els = elements(html);
  const entry = { description: "", syntax: keyword, example: [], manualUrl: url, hasBasic: HAS_BASIC.has(keyword), options: {} };

  // Description: first BodyText paragraph on the page.
  const desc = els.find((e) => e.tag === "p" && e.cls === "bodytext");
  if (desc) entry.description = truncate(text(desc.html), 700);

  // Example: pre-blocks after the first "Example data block" heading, up to the next heading.
  const exStart = els.findIndex((e) => e.tag === "h6" && /example data block/i.test(text(e.html)));
  if (exStart >= 0) {
    for (let i = exStart + 1; i < els.length; i++) {
      const e = els[i];
      if (e.tag === "h6") break;
      if (e.tag !== "pre") continue;
      const line = decode(e.html.replace(/<[^>]+>/g, "")).replace(/^\s*Line\s+\S+?:\s?/i, "").replace(/\t/g, "    ").trimEnd();
      entry.example.push(line);
      if (entry.example.length >= 12) { entry.example.push("..."); break; }
    }
  }

  // Explanation "Line n:" paragraphs: syntax (Line 0 with the keyword) and options.
  // Option token: bold first token (FrameMaker pages) or a hyphen-leading first token (Word pages).
  // Any body* paragraph class qualifies — e.g. the PRINT page switches to "bodytext" mid-list.
  for (let i = 0; i < els.length; i++) {
    const e = els[i];
    if (e.tag !== "p" || !/^body/.test(e.cls)) continue;
    const plain = text(e.html);
    const lm = plain.match(/^Line\s+\S+?:\s*(.+)$/);
    if (!lm) continue;
    const lineText = lm[1];
    const bold = e.html.match(/<(?:STRONG|B)\b[^>]*>\s*([-A-Za-z][A-Za-z0-9_$]*)/i)?.[1];
    const token = /^-?[A-Za-z][A-Za-z0-9_]*$/.test(bold ?? "")
      ? bold
      : lineText.match(/^(-[A-Za-z][A-Za-z0-9_]*)/)?.[1] ?? bold;
    if (!token) {
      if (entry.syntax === keyword && lineText.toUpperCase().startsWith(keyword)) entry.syntax = lineText;
      continue;
    }
    if (token.replace(/^-/, "").toUpperCase() === keyword.replace(/\$$/, "")) {
      if (entry.syntax === keyword) entry.syntax = lineText;
      continue;
    }
    if (!/^-?[A-Za-z][A-Za-z0-9_]*$/.test(token)) continue;
    const key = "-" + token.replace(/^-/, "");
    // Argument descriptions: following body1/body1-indent paragraphs until the next "Line n:" paragraph.
    const parts = [];
    for (let j = i + 1; j < els.length && parts.length < 3; j++) {
      const f = els[j];
      if (f.tag !== "p") break;
      if (/^body/.test(f.cls) && /^Line\s+\S+?:/.test(text(f.html))) break;
      if (!/^body1/.test(f.cls)) continue;
      const t = text(f.html).replace(/\s*--\s*/, ": ");
      if (t) parts.push(t);
    }
    if (!entry.options[key]) {
      const full = parts.join(" ");
      const aliases = extractAliases(full, key); // from the full text — the "Optionally, ..." sentence may sit past the truncation point
      entry.options[key] = { description: truncate(full, 450), syntax: lineText, ...(aliases.length ? { aliases } : {}) };
    }
  }
  return entry;
}

// The manual lists accepted alternate spellings as "Optionally, uncertainty, uncertainties, or -u [ ncertainty ]."
// Keep only whole alternate words; bracketed prefix forms ("-u [ ncertainty ]") are covered by
// prefix matching at runtime and are dropped here.
function extractAliases(description, canonical) {
  const m = description.match(/Optionally[,:]?\s+([^.]+)/i);
  if (!m) return [];
  const bare = canonical.replace(/^-/, "").toLowerCase();
  const out = new Set();
  for (const raw of m[1].split(/,|\bor\b/)) {
    const t = raw.trim();
    if (!/^-?[A-Za-z][A-Za-z0-9_]*$/.test(t)) continue;
    const norm = t.replace(/^-/, "").toLowerCase();
    if (norm !== bare) out.add("-" + norm);
  }
  return [...out];
}

function parseBasicTables(html, url) {
  const basic = {};
  for (const row of html.match(/<TR[^>]*>[\s\S]*?<\/TR>/gi) ?? []) {
    const cells = (row.match(/<TD[^>]*>[\s\S]*?<\/TD>/gi) ?? []).map((c) => text(c));
    if (cells.length < 2) continue;
    const [sig, expl] = cells;
    const nm = sig.match(/^([A-Za-z][A-Za-z0-9_]*\$?)/);
    if (!nm) continue;
    const name = nm[1].toUpperCase();
    if (!BASIC_NAMES.has(name) || basic[name]) continue;
    basic[name] = {
      ...(BASIC_STATEMENTS.has(name) ? { kind: "statement" } : {}),
      signature: sig,
      description: truncate(expl, 450),
      manualUrl: url,
    };
  }
  return basic;
}

// ---- main ----
const index = await fetchPage(BASE + "phreeqc3.htm");
const tocLinks = {};
for (const m of index.matchAll(/<a href="([^"]+\.htm)(?:#[^"]*)?"[^>]*>([^<]*)/gi)) {
  const label = decode(m[2]).trim();
  if (label && !tocLinks[label]) tocLinks[label] = m[1];
}

const blocks = {};
const missing = [];
for (const kw of KEYWORDS) {
  const page = HREF_OVERRIDE[kw] ?? tocLinks[TOC_NAME[kw] ?? kw];
  if (!page) {
    missing.push(kw);
    blocks[kw] = { description: "", syntax: kw, example: [], manualUrl: BASE + "phreeqc3.htm", hasBasic: HAS_BASIC.has(kw), options: {} };
    continue;
  }
  const url = BASE + page;
  try {
    blocks[kw] = parseKeywordPage(await fetchPage(url), kw, url);
    console.log(`ok   ${kw}  (${Object.keys(blocks[kw].options).length} options)  ${page}`);
  } catch (err) {
    missing.push(kw);
    blocks[kw] = { description: "", syntax: kw, example: [], manualUrl: url, hasBasic: HAS_BASIC.has(kw), options: {} };
    console.log(`FAIL ${kw}  ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 150));
}

const basicUrl = BASE + (tocLinks["The Basic Interpreter"] ?? "phreeqc3-61.htm").replace(/#.*/, "");
const basic = parseBasicTables(await fetchPage(basicUrl), basicUrl);

// ---- hand-authored content the manual does not provide; merged on every run ----

// Keywords with no page in the online v3 manual (newer than 2013, or undocumented dump forms).
const appendixUrl = BASE + "phreeqc3-86.htm";
const HAND_BLOCKS = {
  MIX_RAW: { description: "Defines mixing fractions of solutions in the internal raw format written by DUMP. Intended for restarting simulations from dump files, not for hand-editing.", manualUrl: appendixUrl },
  REACTION_TEMPERATURE_MODIFY: { description: "Modifies an existing REACTION_TEMPERATURE definition without redefining it completely. Only the data items given are changed. See Appendix A of the manual for the _MODIFY keyword conventions.", manualUrl: appendixUrl },
  SURFACE_MIX: { description: "Mixes two or more surface assemblages in specified fractions to define a new surface assemblage, analogous to SOLUTION_MIX for solutions. Used mainly by transport and coupled (PhreeqcRM) calculations." },
  RATE_PARAMETERS_PK: { description: "Defines mineral dissolution/precipitation rate parameters from the Palandri and Kharaka (2004) compilation for use with the generic rate expressions distributed in phreeqc_rates.dat (PHREEQC 3.7+). See the phreeqc_rates.dat database file for parameter definitions and examples." },
  RATE_PARAMETERS_SVD: { description: "Defines mineral dissolution/precipitation rate parameters based on singular value decomposition fits for use with the generic rate expressions in phreeqc_rates.dat (PHREEQC 3.7+). See the phreeqc_rates.dat database file for parameter definitions and examples." },
  RATE_PARAMETERS_HERMANSKA: { description: "Defines mineral dissolution/precipitation rate parameters from the Hermanska and others (2022) compilation for use with the generic rate expressions in phreeqc_rates.dat (PHREEQC 3.7+). See the phreeqc_rates.dat database file for parameter definitions and examples." },
};
for (const [kw, patch] of Object.entries(HAND_BLOCKS)) {
  if (blocks[kw] && !blocks[kw].description) Object.assign(blocks[kw], patch);
}

// SURFACE_SPECIES and EXCHANGE_SPECIES accept the same checking options as SOLUTION_SPECIES,
// but their manual pages do not repeat them (real inputs use them, e.g. USGS example ex19).
for (const target of ["SURFACE_SPECIES", "EXCHANGE_SPECIES"]) {
  for (const opt of ["-no_check", "-mole_balance", "-log_k", "-delta_h", "-gamma", "-analytical_expression"]) {
    if (!blocks[target].options[opt] && blocks.SOLUTION_SPECIES.options[opt]) {
      blocks[target].options[opt] = blocks.SOLUTION_SPECIES.options[opt];
    }
  }
}

// Options newer than the 2013 manual (real inputs use them, e.g. USGS example ex22).
if (!blocks.USER_GRAPH.options["-plot_csv_file"]) {
  blocks.USER_GRAPH.options["-plot_csv_file"] = {
    description: "Writes the USER_GRAPH data to a comma-separated-values file (newer PHREEQC versions; analogous to -plot_tsv_file).",
    syntax: "-plot_csv_file file name",
  };
}

// BASIC names that appear only inside compound rows of the manual's tables (THEN, WEND, ...)
// or that the tables omit (USER_GRAPH plot commands, TRUE/FALSE).
const st = (sig, desc) => ({ kind: "statement", signature: sig, description: desc, manualUrl: basicUrl });
const fn = (sig, desc) => ({ signature: sig, description: desc, manualUrl: basicUrl });
const HAND_BASIC = {
  AND: st("a AND b", "Boolean AND operator."),
  OR: st("a OR b", "Boolean OR operator."),
  NOT: st("NOT a", "Boolean NOT operator."),
  MOD: st("a MOD b", "Remainder of integer division a/b."),
  ELSE: st("IF expr THEN statement ELSE statement", "Alternative branch of an IF ... THEN statement."),
  THEN: st("IF expr THEN statement", "Marks the statement executed when the IF condition is true."),
  NEXT: st("FOR i = n1 TO n2 ... NEXT i", "Closes a FOR loop."),
  TO: st("FOR i = n1 TO n2 [STEP n3]", "Upper bound of a FOR loop counter."),
  STEP: st("FOR i = n1 TO n2 STEP n3", "Increment of a FOR loop counter (default 1)."),
  WEND: st("WHILE expr ... WEND", "Closes a WHILE loop."),
  TRUE: fn("TRUE", "Boolean constant true (1)."),
  FALSE: fn("FALSE", "Boolean constant false (0)."),
  COLOR: fn("COLOR 'Red'", "USER_GRAPH plot command: sets the color of the current curve."),
  SYMBOL: fn("SYMBOL 'Circle'", "USER_GRAPH plot command: sets the symbol of the current curve."),
  SYMBOL_SIZE: fn("SYMBOL_SIZE size", "USER_GRAPH plot command: sets the symbol size of the current curve."),
  LINE_WIDTH: fn("LINE_WIDTH width", "USER_GRAPH plot command: sets the line width of the current curve."),
  PHASE_FORMULA$: fn("PHASE_FORMULA$('phase')", "Chemical formula of a phase, as a character string."),
  NO_NEWLINES: fn("NO_NEWLINES", "Suppresses newlines in PUNCH output so all values print on one line."),
};
for (const [name, entry] of Object.entries(HAND_BASIC)) {
  if (!basic[name]) basic[name] = entry;
}

const sorted = (obj) => Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
const out = {
  meta: {
    source: "Parkhurst, D.L., and Appelo, C.A.J., 2013, Description of input and examples for PHREEQC version 3. USGS Techniques and Methods 6-A43. Public domain.",
    manualIndexUrl: BASE + "phreeqc3.htm",
  },
  blocks: sorted(blocks),
  basic: sorted(basic),
};
mkdirSync("data", { recursive: true });
writeFileSync("data/phreeqc-keywords.json", JSON.stringify(out, null, 2) + "\n");
console.log(`\nWrote data/phreeqc-keywords.json: ${Object.keys(blocks).length} blocks, ${Object.keys(basic).length} BASIC entries.`);
if (missing.length) console.log(`Hand-author these (no manual page found): ${missing.join(", ")}`);
