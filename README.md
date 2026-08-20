# PHREEQC language support for VS Code

A writing tool for [PHREEQC](https://www.usgs.gov/software/phreeqc-version-3) input files:

- **Syntax highlighting** for keyword data blocks, options, numbers, strings, comments, and the embedded BASIC language in `RATES`, `USER_PRINT`, `USER_PUNCH`, `USER_GRAPH`, and `CALCULATE_VALUES` blocks.
- **Autocomplete** that knows where you are: keyword blocks at the top level, each block's own `-options` inside it, and BASIC functions (`TOT`, `SR`, `TIME`, ...) inside rate/user blocks. Abbreviations and any letter case work, as in PHREEQC itself.
- **Hover documentation** with real excerpts from the USGS PHREEQC v3 manual — description, syntax line, example — plus a link to the exact manual section.
- **Snippets** for common blocks: type `solution`, `kinetics-rates`, `transport`, `selected_output`, `speciation-run`, and more, then Tab through the placeholders.

Recognized file extensions: `.phr`, `.ppi`, `.pqi`, `.phrq`, `.dat` (databases), `.out`.

<p align="center">
<img src="images/syntaxscreenrecording.gif" width=75%>
<br/>
<em>(Example file)</em>
</p>

## Usage

Open any PHREEQC input file and start typing. `Ctrl+Space` opens completion anywhere; hover any keyword, option, or BASIC function for its documentation.

This extension does not include or run PHREEQC itself. Get PHREEQC from:

- [USGS](https://www.usgs.gov/software/phreeqc-version-3)
- [Appelo's website](https://www.hydrochemistry.eu/)

## Documentation excerpts

Hover documentation is excerpted from: Parkhurst, D.L., and Appelo, C.A.J., 2013, *Description of input and examples for PHREEQC version 3*, [USGS Techniques and Methods 6-A43](https://water.usgs.gov/water-resources/software/PHREEQC/documentation/phreeqc3-html/phreeqc3.htm). As a U.S. Geological Survey publication it is in the public domain.

Element, species, and phase names come from the loaded database file and are **not** completed or documented (a possible future feature).

The original syntax highlighting was ported from the Notepad++ user-defined language distributed at [hydrochemistry.eu](https://www.hydrochemistry.eu/).

## Disclaimer

This extension only assists with reading and writing PHREEQC files; it does not affect how PHREEQC executes them. This is not an official PHREEQC or USGS project and is not endorsed by the authors of PHREEQC or related organizations.

## Contributing / maintaining

See [MAINTAINING.md](https://github.com/vcantarella/phreeqc-syntax/blob/main/MAINTAINING.md) for how the extension is put together and how to make changes safely.

## License

[MIT](https://choosealicense.com/licenses/mit/)
