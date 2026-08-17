import { getQuestion, getTranslation, getQuestions, getSavedLanguage, setSavedLanguage } from "./data.js";
import { getCategoryLabel, getCategoryColor, truncate, escapeHtml } from "./utils.js";

let state = {
  questions: [],
  filteredIds: [],
  selectedId: null,
  language: "de",
  view: "grid",
};

function loadState() {
  state.questions = getQuestions();
  state.language = getSavedLanguage();
}

export function initBrowse(questions) {
  loadState();
  state.filteredIds = questions.map((q) => q.id);
  renderFilters();
  renderQuestionList();
}

function renderFilters() {
  const container = document.getElementById("browse-filters");
  if (!container) return;

  container.innerHTML = `
    <div class="filters-bar">
      <div class="container">
        <div class="filters-inner">
          <div class="filter-group">
            <label>Language</label>
            <select id="filter-lang">
              <option value="de">Deutsch</option>
              <option value="fr">Français</option>
              <option value="it">Italiano</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Category</label>
            <select id="filter-category">
              <option value="all">All categories</option>
            </select>
          </div>
          <div class="filter-group">
            <label style="visibility:hidden;">Action</label>
            <button class="btn btn-sm btn-secondary" id="filter-reset">Reset</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const cats = [...new Set(state.questions.map((q) => q.category))].sort((a, b) => a - b);
  const catSelect = document.getElementById("filter-category");
  for (const c of cats) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = getCategoryLabel(c);
    catSelect.appendChild(opt);
  }

  document.getElementById("filter-lang").value = state.language;
  document.getElementById("filter-lang").addEventListener("change", (e) => {
    state.language = e.target.value;
    setSavedLanguage(state.language);
    renderQuestionList();
    if (state.selectedId) renderDetail(state.selectedId);
  });

  document.getElementById("filter-official").addEventListener("change", () => {
    applyBrowseFilters();
  });

  document.getElementById("filter-category").addEventListener("change", () => {
    applyBrowseFilters();
  });

  document.getElementById("filter-reset").addEventListener("click", () => {
    resetFilters();
  });
}

export function applyBrowseFilters() {
  const officialOnly = document.getElementById("filter-official")?.checked || false;
  const categoryVal = document.getElementById("filter-category")?.value;
  const categoryId = categoryVal === "all" ? null : Number(categoryVal);
  const search = document.getElementById("browse-search")?.value || "";
  browseFilter({ officialOnly, categoryId, search });
}

export function browseFilter({ officialOnly, categoryId, search } = {}) {
  state.filteredIds = state.questions
    .filter((q) => {
      if (officialOnly && !q.official) return false;
      if (categoryId !== null && categoryId !== undefined && q.category !== categoryId) return false;
      if (search) {
        const t = getTranslation(q, state.language);
        const text = (t?.question || "") + " " + (t?.options || []).join(" ");
        if (!text.toLowerCase().includes(search.toLowerCase())) return false;
      }
      return true;
    })
    .map((q) => q.id);
  renderQuestionList();
}

export function resetFilters() {
  state.filteredIds = state.questions.map((q) => q.id);
  state.selectedId = null;
  renderQuestionList();
  const detail = document.getElementById("detail-panel");
  if (detail) detail.innerHTML = "";
}

function renderQuestionList() {
  const grid = document.getElementById("question-grid");
  if (!grid) return;

  const items = state.filteredIds.map((id) => {
    const q = getQuestion(id);
    if (!q) return "";
    const t = getTranslation(q, state.language) || {};
    const text = truncate(t.question || `Question #${id}`, 80);
    const imageHtml = q.questionImage
      ? `<img src="../../${q.questionImage}" alt="" class="question-card-image" loading="lazy">`
      : "";

    return `
      <div class="question-card" onclick="window._browse.selectQuestion(${q.id})">
        <div class="question-card-header">
          <span class="question-card-id">#${q.id} · ${q.originalId}</span>
          <div style="display:flex;gap:6px;">
            ${q.official ? '<span class="badge badge-official">Official</span>' : ""}
            <span class="badge badge-category">${getCategoryLabel(q.category)}</span>
          </div>
        </div>
        ${imageHtml}
        <div class="question-card-text">${escapeHtml(text)}</div>
        <div class="question-card-footer">
          <span style="font-size:0.8rem;color:var(--text-muted);">${getTypeLabel(q.type)} · ${q.answers.length} answers</span>
        </div>
      </div>
    `;
  }).join("");

  grid.innerHTML = items || '<p class="text-center" style="padding:40px;color:var(--text-muted);">No questions match your filters.</p>';
}

export function selectQuestion(id) {
  state.selectedId = id;
  renderDetail(id);
}

function renderDetail(id) {
  const panel = document.getElementById("detail-panel");
  if (!panel) return;

  const q = getQuestion(id);
  if (!q) return;

  const t = getTranslation(q, state.language) || {};
  const questionText = t.question || "";
  const options = t.options || [];
  const explanations = t.explanations || {};

  panel.innerHTML = `
    <div class="detail-view">
      <div class="detail-header">
        <div>
          <h3 style="margin-bottom:8px;">Question #${q.id} · ${q.originalId}</h3>
          <div class="detail-meta">
            ${q.official ? '<span class="badge badge-official">Official</span>' : ""}
            <span class="badge badge-category">${getCategoryLabel(q.category)}</span>
            <span class="badge badge-category">${getTypeLabel(q.type)}</span>
          </div>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="window._browse.closeDetail()">Close</button>
      </div>

      ${q.questionImage ? `<img src="../../${q.questionImage}" alt="Question image" style="max-width:100%;max-height:300px;object-fit:contain;background:var(--bg-secondary);border-radius:var(--radius);margin-bottom:20px;">` : ""}

      ${questionText ? `<div class="detail-section"><div class="detail-section-title">Question</div><p style="font-size:1.05rem;line-height:1.6;">${escapeHtml(questionText)}</p></div>` : ""}

      <div class="detail-section">
        <div class="detail-section-title">Answers</div>
        ${q.answers
          .map(
            (a) => {
              const text = options[a.index - 1] || `Answer ${a.index}`;
              const expl = a.paragraph ? explanations[a.paragraph] : null;
              let cls = "detail-answer";
              if (a.correct) cls += " correct";
              return `<div class="${cls}">
                <div class="detail-answer-label">${a.correct ? "✓" : a.index}</div>
                <div class="detail-answer-text">
                  <strong>${escapeHtml(text)}</strong>
                  ${expl ? `<div class="detail-explanation">${escapeHtml(expl)}</div>` : ""}
                  ${a.hidden ? '<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">(hidden)</div>' : ""}
                </div>
              </div>`;
            }
          )
          .join("")}
      </div>
    </div>
  `;

  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function closeDetail() {
  state.selectedId = null;
  const panel = document.getElementById("detail-panel");
  if (panel) panel.innerHTML = "";
}

window._browse = { selectQuestion, closeDetail, applyBrowseFilters, resetFilters };
