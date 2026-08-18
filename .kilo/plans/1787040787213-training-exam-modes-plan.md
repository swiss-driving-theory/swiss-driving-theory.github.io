# Training & Exam Simulation Mode Plan

## Goal
Rework the Driver app to support **Training Mode** and **Exam Simulation Mode** as separate, independently extensible modes, and integrate the standalone Browse page into Training.

---

## Decisions

### Exam Mode Rules
- **50 questions**, randomly selected from the official question pool (`official: true`) only
- **45-minute countdown timer**, displayed prominently
- **Max 15 error points** to pass
- **Navigation:** Next / Previous only — no per-question confirm button
- Answers are stored silently; nothing is evaluated until the exam ends
- On timeout or explicit finish: calculate results

### Error Point Model (Swiss exam rules)
Per-question error points are counted **per answer**, not per question:
- **Each missed correct answer** = 1 error point
- **Each incorrectly selected answer** = 1 error point
- **Max 3 error points per question** (as per Swiss exam rules)
- Skipped questions: each correct answer you missed counts as 1 error point

Example: Question has correct answers A, B. User selects A and C.
- Missed correct B → 1 error point
- Wrong selected C → 1 error point
- Total: 2 error points for this question

### Training Mode Rules
- Uses the full filtered question set (current filters: official-only toggle, category)
- **Immediate feedback** after each answer selection
- Shows correct/incorrect state + explanation right away
- No time limit
- Keeps existing per-question "Check Answer" flow, cleaned up
- Includes integrated Browse/Study sub-view

### Architecture: Separate Modes
Training and Exam are **separate HTML pages with separate JS entry points**, sharing only the data layer:
```
Home (index.html)
  ├── Training Mode → training.html
  │     ├── Quiz flow (immediate feedback)
  │     └── Browse/Study sub-view (integrated)
  └── Exam Mode → exam.html
        └── Exam flow (50 questions, timer, no per-question feedback)
```
- `training.html` + `training.js` — fully independent, can be extended later
- `exam.html` + `exam.js` — fully independent, can be extended later
- Shared data loading via `src/js/data.js` (already exists)

---

## Implementation Tasks

### 1. Update `index.html` — Home page
- Replace or augment current CTA buttons with **Training** and **Exam Simulation** buttons
- Link to `training.html` and `exam.html`
- Update branding copy to reflect "Swiss Driving Theory"

### 2. Create `training.html` + `training.js`
- Load questions via shared `data.js`
- Filter by official-only toggle + category (same as current quiz)
- **Quiz sub-view:**
  - Answer buttons with immediate visual feedback (green/red borders)
  - Show explanation below answers after selection
  - Next / Previous navigation
  - Finish button → training results (percentage-based scoring)
- **Browse/Study sub-view:**
  - Search input + category filter + official toggle
  - Grid of question cards
  - Detail panel with full question + explanations
  - Toggle between Quiz and Study sub-views

### 3. Create `exam.html` + `exam.js`
- Load questions via shared `data.js`
- Filter to `official: true` only, shuffle, pick 50
- **Exam UI:**
  - Show question counter (`12 / 50`)
  - Show countdown timer (`MM:SS`), red when < 5 min
  - Next / Previous navigation (no per-question confirm)
  - Question palette/overview strip (answered/skipped indicators)
- **Timer logic:**
  - `setInterval` countdown from 45:00
  - At 0: auto-submit
- **Results screen:**
  - Show total error points
  - Pass / Fail verdict (≤ 15 = pass)
  - Per-question breakdown

### 4. Extract shared scoring logic
- Move `calculateResults(questions, answers)` into `src/js/utils.js` or a new shared module
- Both `training.js` and `exam.js` use it (training uses percentage, exam uses error points)

### 5. Remove `browse.html`
- Delete `browse.html` from repo root
- Remove any links pointing to it

### 6. Update `serve.py` (if needed)
- Ensure it still serves the updated root-level HTML files correctly

---

## Out of Scope
- Language switching during active quiz (keep current behavior: language locked at quiz start)
- Resuming an interrupted exam session
- Animations or transitions between modes
- Backend / persistence beyond `localStorage` and `sessionStorage`

---

## Validation
- Load `index.html` → see Training and Exam buttons
- Training: answer questions, see immediate feedback, finish, see score; browse/study accessible from training mode
- Exam: start, see 50 questions + timer, navigate with Next/Prev, finish early or wait for timeout, see error points + pass/fail
- No references to `browse.html` remain
- All pages load correctly via `serve.py` and would deploy correctly via GitHub Pages
