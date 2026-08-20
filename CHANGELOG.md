# Changelog

## 0.1.0 — 2026-08-20

From a pure syntax highlighter to a PHREEQC writing tool.

### Added
- Context-aware autocomplete: keyword blocks, per-block `-options`, and BASIC functions inside `RATES` / `USER_*` / `CALCULATE_VALUES` blocks.
- Hover documentation for every keyword, option, and BASIC function, excerpted from the USGS PHREEQC v3 manual (TM 6-A43, public domain) with deep links to the online manual.
- Snippets: `solution`, `equilibrium_phases`, `kinetics-rates`, `transport`, `selected_output`, `phases`, `exchange`, `surface`, `reaction`, `speciation-run`.
- Automated tests (`npm test`): completion/hover logic, data-file completeness, grammar scope assertions, plus the official USGS example inputs (ex1–ex22) as a test corpus — every keyword/option they use must resolve, and grammar snapshots guard the highlighting of all of them.
- GitHub Actions CI on pushes/PRs; tagged releases build the `.vsix`, attach it to a GitHub Release, and publish to the marketplace.

### Fixed (grammar)
- Keyword matching is now case-insensitive (`solution 1` highlights like `SOLUTION 1`).
- `USE` and the `*_RAW` keywords are recognized; `INCLUDE$` matches correctly.
- Numbers with uppercase exponents (`1.2E-5`), leading dots (`.5`), and signs highlight correctly.
- BASIC bodies of `RATES` / `USER_*` blocks now highlight statements, functions, and PHREEQC intrinsics (`TOT`, `SR`, `SI`, ...).
- Removed ~400 bare-word false positives (`name`, `time`, `file`, ... no longer light up in free text); options highlight via their leading hyphen.
- Removed broken folding markers and runaway indentation rules left over from a JavaScript template.

### Changed
- Package no longer ships demo GIF/MP4 media (install size down from 6.6 MB to well under 1 MB).

## 0.0.1

Initial release: TextMate grammar ported from the Notepad++ user-defined language.
