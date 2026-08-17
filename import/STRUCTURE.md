# DirectorCastRipper_D12 Exports — Data Structure Reference

## Overview

Macromedia Director 12 extraction of a German driving-theory quiz app.  
960 questions total, exported as 5 parallel asset folders plus per-folder `Members.csv` mapping files.

## Directory Layout

| Folder | Files | Purpose |
|--------|-------|---------|
| `assets/` | — | Generated app output |
| `assets/images/` | 795 PNG | Traffic-sign and diagram images |
| `import/` | — | Raw Director export data (per language) |
| `import/de/` | 2880 | German question data |
| `import/de/xmlquestions/` | 960 | German question definition XML |
| `import/de/xmlequestions/` | 961 | German explanation/answer linkage XML |
| `import/de/txtquestions/` | 960 | German question text + options |
| `import/de/txtequestions/` | 3039 | German explanation text blocks |
| `import/fr/` | 2879 | French question data |
| `import/it/` | 2879 | Italian question data |
| `src/` | — | Quiz app source code |
| `src/css/` | 1 | Stylesheet |
| `src/js/` | 6 | JavaScript modules |
| `src/pages/` | 3 | HTML pages (index, quiz, browse) |
| `tools/` | 1 | Export scripts |
| `tools/export_to_json.py` | 1 | Generates `assets/questions.json` from `import/` |

Each language folder contains a `Members.csv` that maps the sequential export filenames (e.g. `1.png`, `42.txt`) back to the original Macromedia Director cast-member names.

## File Naming Convention

- Questions are numbered 1–960 (or up to 1025 in `txtequestions`).
- A question index **N** links across folders:
  - `import/de/xmlquestions/N.txt` ↔ `import/de/txtquestions/N.txt` ↔ `import/de/xmlequestions/N.txt`

## Question Definition — `xmlquestions/N.txt`

```xml
<?xml version="1.0" ?><test1>
<question number="11" fragenumber="10011" txtcast="t11" typ="1" lKategorie="2" text="1">
  <answer number="1" validity="0" image="1.29"/>
  <answer number="2" validity="0" image="1.11"/>
  <answer number="3" validity="1" image="1.12"/>
</question>
</test1>
```

| Attribute | Meaning |
|-----------|---------|
| `number` | Sequential export index (1–960) |
| `fragenumber` | Original question ID (e.g. `10001`, `20041`, `30001`...) |
| `txtcast` | Links to `txtquestions/N.txt` cast-member name (e.g. `t11`) |
| `typ` | Question type: `1` = image-based answers, `2/3/4` = text answers |
| `lKategorie` | Category / topic ID |
| `text` | Likely a text-cast reference flag (`"1"`) |

### Answer elements

| Attribute | Meaning |
|-----------|---------|
| `number` | Sequential answer option (1-based) |
| `validity` | `"1"` = correct answer, `"0"` = wrong answer |
| `image` | Reference to `bmpquestions` via `Members.csv` mapping (e.g. `"1.29"` → `29.png`) |

- **typ=1**: 3 answers, each referencing an image.
- **typ=2**: 3–5 text answers; question text is multi-line in `txtquestions/N.txt`.
- **typ=3**: 3–5 text answers.
- **typ=4**: 2–5 text answers (shorter questions, e.g. sign recognition).

## Question Text — `txtquestions/N.txt`

- **typ=1**: Single line — the question prompt only.
- **typ=2/3/4**: Multiple lines — line 1 is the question, subsequent lines are the answer options in order.

Example (typ=2):
```
NACH WELCHEM SIGNAL MUSS ALLENFALLS MIT EINEM ERHEBLICH LÄNGEREN BREMSWEG GERECHNET WERDEN?
Ja
Nein
Nur Fahrräder und Motorfahrräder
Nur landwirtschaftliche Fahrzeuge
```

The `Members.csv` in this folder maps sequential numbers → cast names `t1`, `t2` … `t960`.

## Explanation Linkage — `xmlequestions/N.txt`

```xml
<?xml version="1.0" ?><question fragenummer="10011" asa="0">
  <answer number="1" paragraf="a" validity="0" text="t31" asadelete="0"/>
  <answer number="2" paragraf="b" validity="0" text="t32" asadelete="1"/>
  <answer number="3" paragraf="c" validity="1" text="t33" asadelete="0"/>
</question>
```

| Attribute | Meaning |
|-----------|---------|
| `fragenummer` | Matches `fragenumber` in `xmlquestions/N.txt` |
| `number` | Answer option index |
| `paragraf` | Paragraph / section label (a, b, c, d…) |
| `validity` | Correctness flag (mirrors `xmlquestions`) |
| `text` | Links to `txtequestions/` cast-member name (e.g. `t33`) |
| `asadelete` | Likely a soft-delete / visibility flag (`0` = active, `1` = hidden) |

The `Members.csv` in this folder maps sequential numbers → cast names `test10001`, `test10002` … `test41802` etc. (non-contiguous IDs).

## Explanation Text — `txtequestions/N.txt`

Plain-text explanation shown when the user selects an answer.

Example:
```
Dieser Weg muss von den Fussgängern benützt werden.
```

The `Members.csv` here maps sequential numbers → cast names `t1` … `t1026` (note: count is 3039 files but cast names go up to ~1026, suggesting reuse / multiple text blocks per cast member).

## Images — `bmpquestions/`

PNG files named sequentially (`1.png` … `795.png`).  
`Members.csv` maps each number to the original Director cast-member name:

```
Number,Type,Name,Registration Point,Filename
1,bitmap,1.01,"(50, 44)"
2,bitmap,1.02,"(50, 44)"
19,bitmap,2.01,"(50, 50)"
20,bitmap,2.02,"(50, 50)"
...
68,bitmap,20002,"(205, 137)"
...
234,bitmap,3.03,"(50, 50)"
...
243,bitmap,30001,"(185, 137)"
...
349,bitmap,4.01,"(50, 69)"
...
383,bitmap,40001,"(213, 142)"
...
769,bitmap,5.02,"(50, 35)"
...
790,bitmap,6.01,"(50, 30)"
```

### Image name patterns

| Prefix | Likely category |
|--------|----------------|
| `1.xx` | Traffic signs — warning / priority |
| `2.xx` | Traffic signs — prohibitions / mandatory |
| `3.xx` | Traffic signs — other |
| `4.xx` | Traffic signs — additional panels |
| `5.xx` | Traffic signs — road markings |
| `6.xx` | Traffic signs — light signals |
| `20002`+ | Large-format / diagram images |
| `25001`+ | Scenario / situation images |
| `30001`+ | Hazard / danger images |
| `40001`+ | Answer-option images |
| `41587`+ | Extended image set |
| `50004`+ | Additional image set |

The **Registration Point** is the Director sprite registration point (x, y) used for positioning.

## Cross-Reference Summary

```
xmlquestions/N.txt
  ├── txtcast → txtquestions/N.txt        (question text + options)
  ├── image attributes → bmpquestions/    (via Members.csv number mapping)
  └── fragenumber → xmlequestions/M.txt   (explanation linkage, matched by fragenummer)
        └── text attributes → txtequestions/K.txt  (explanations, via Members.csv)
```

## Question Type Summary

| typ | Answer count | Content source | Image answers? |
|-----|-------------|----------------|----------------|
| 1 | 3 | txtquestions (single line) | Yes — all 3 answers are images |
| 2 | 3–5 | txtquestions (multi-line) | No |
| 3 | 3–5 | txtquestions (multi-line) | No |
| 4 | 2–5 | txtquestions (multi-line) | No |
