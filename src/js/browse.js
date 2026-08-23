import { getQuestion, getTranslation, getQuestions } from "./data.js";
import { getSavedLanguage, setSavedLanguage } from "./filters.js";
import { getCategoryLabel, getTypeLabel, truncate, escapeHtml, escapeHtmlWithBreaks } from "./utils.js";
import { t } from "./i18n.js";

function getAnswerLabel(index) {
  return String.fromCharCode(96 + index);
}

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
    <div class="browse-toolbar">
      <div class="container">
        <div class="browse-toolbar-inner">
          <div class="browse-search-wrap">
            <input type="text" id="browse-search" class="browse-search" placeholder="${t("searchQuestions", state.language)}">
          </div>
          <div class="toolbar-group">
            <span class="toolbar-label">${t("official", state.language)}</span>
            <label class="toggle">
              <input type="checkbox" id="filter-official">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>
          <div class="toolbar-group">
            <span class="toolbar-label">${t("category", state.language)}</span>
            <select id="filter-category" class="form-select">
              <option value="all">${t("allCategories", state.language)}</option>
            </select>
          </div>
          <div class="toolbar-group">
            <button class="btn btn-sm btn-secondary" id="filter-reset">${t("reset", state.language)}</button>
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
    opt.textContent = getCategoryLabel(c, state.language);
    catSelect.appendChild(opt);
  }

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

export function applyBrowseFilters(opts = {}) {
  const officialOnly = "officialOnly" in opts ? opts.officialOnly : document.getElementById("filter-official")?.checked || false;
  const categoryId = "categoryId" in opts ? opts.categoryId : (document.getElementById("filter-category")?.value === "all" ? null : Number(document.getElementById("filter-category")?.value));
  const search = "search" in opts ? opts.search : document.getElementById("browse-search")?.value || "";
  browseFilter({ officialOnly, categoryId, search });
}

export function browseFilter({ officialOnly, categoryId, search } = {}) {
  state.filteredIds = state.questions
    .filter((q) => {
      if (officialOnly && !q.official) return false;
      if (categoryId !== null && categoryId !== undefined && q.category !== categoryId) return false;
      if (search) {
        const tq = getTranslation(q, state.language);
        const text = (tq?.question || "") + " " + (tq?.options || []).join(" ");
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
    const tq = getTranslation(q, state.language) || {};
    const text = truncate(tq.question || `Question #${id}`, 80);
    const imageHtml = q.questionImage
      ? `<img src="../../${q.questionImage}" alt="" class="question-card-image" loading="lazy">`
      : "";

    return `
      <div class="question-card" onclick="window._browse.selectQuestion(${q.id})">
        <div class="question-card-header">
          <span class="question-card-id">#${q.id} · ${q.originalId}</span>
          <div style="display:flex;gap:6px;">
            ${q.official ? `<span class="badge badge-official">${t("officialBadge", state.language)}</span>` : ""}
            <span class="badge badge-category">${getCategoryLabel(q.category, state.language)}</span>
          </div>
        </div>
        ${imageHtml}
        <div class="question-card-text">${escapeHtml(text)}</div>
        <div class="question-card-footer">
          <span style="font-size:0.8rem;color:var(--text-muted);">${getTypeLabel(q.type, state.language)} · ${q.answers.length} ${t("answersCount", state.language, { count: q.answers.length })}</span>
        </div>
      </div>
    `;
  }).join("");

  grid.innerHTML = items || `<p class="text-center" style="padding:40px;color:var(--text-muted);">${t("noQuestionsMatch", state.language)}</p>`;
}

export function selectQuestion(id) {
  state.selectedId = id;
  renderQuestionList();
  renderDetail(id);
  const overlay = document.getElementById("browse-modal-overlay");
  if (overlay) {
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }
}

function renderDetail(id) {
  const content = document.getElementById("modal-content");
  if (!content) return;

  const q = getQuestion(id);
  if (!q) return;

  const tq = getTranslation(q, state.language) || {};
  const questionText = tq.question || "";
  const options = tq.options || [];
  const explanations = tq.explanations || {};
  const questionExplanation = (tq.questionExplanation || "").trim();
  const isImageType = q.type === "image";
  const hasQuestionImage = !!q.questionImage;

  let answersHtml = "";
  if (isImageType) {
    for (let i = 0; i < q.answers.length; i++) {
      const a = q.answers[i];
      const imgSrc = a.image ? a.image : "";
      let cls = "answer-btn";
      if (a.correct) cls += " correct";
      else if (a.hidden) cls += " incorrect";
      answersHtml += '<div class="answer-wrapper">';
      answersHtml += `<button class="${cls}" disabled>`;
      if (imgSrc) answersHtml += `<img src="${imgSrc}" alt="Answer ${a.index}" loading="lazy">`;
      answersHtml += `  <span class="answer-label">${getAnswerLabel(a.index)}</span>`;
      answersHtml += '</button>';
      if (a.paragraph) {
        const explText = explanations[a.paragraph];
        if (explText) {
          const explCls = "answer-explanation" + (a.correct ? " correct-explanation" : "");
          answersHtml += `<div class="${explCls}">${escapeHtml(explText)}</div>`;
        }
      }
      answersHtml += '</div>';
    }
  } else {
    for (let i = 0; i < q.answers.length; i++) {
      const a = q.answers[i];
      const text = options[a.index - 1] || `Answer ${getAnswerLabel(a.index)}`;
      let cls = "answer-btn";
      if (a.correct) cls += " correct";
      else if (a.hidden) cls += " incorrect";
      answersHtml += '<div class="answer-wrapper">';
      answersHtml += `<button class="${cls}" disabled>`;
      answersHtml += `  <span class="answer-label">${getAnswerLabel(a.index)}</span>`;
      answersHtml += `  <span>${escapeHtml(text)}</span>`;
      answersHtml += '</button>';
      if (a.paragraph) {
        const explText = explanations[a.paragraph];
        if (explText) {
          const explCls = "answer-explanation" + (a.correct ? " correct-explanation" : "");
          answersHtml += `<div class="${explCls}">${escapeHtml(explText)}</div>`;
        }
      }
      answersHtml += '</div>';
    }
  }

  let html = '<div class="question-display">';
  html += '  <div class="question-header">';
  html += '    <div class="flex items-center gap-3">';
  html += `      <span class="badge badge-official">${q.official ? t("officialBadge", state.language) : t("practiceBadge", state.language)}</span>`;
  html += `      <span class="badge badge-category">${getCategoryLabel(q.category, state.language)}</span>`;
  html += `      <span class="badge badge-category">${getTypeLabel(q.type, state.language)}</span>`;
  html += '    </div>';
  html += '    <div class="flex items-center gap-2">';
  html += `      <span class="question-id">ID: ${q.originalId}</span>`;
  html += `      <button class="btn btn-sm btn-ghost" onclick="window._browse.closeDetail()">${t("close", state.language)}</button>`;
  html += '    </div>';
  html += '  </div>';

  if (hasQuestionImage || questionText) {
    html += '  <div class="question-body-stacked">';
    if (questionText) {
      html += `    <div class="question-text-main">${escapeHtml(questionText)}</div>`;
    }
    html += '    <div class="question-body">';
    if (hasQuestionImage) {
      html += '      <div class="question-image-side">';
      html += `        <img src="${q.questionImage}" alt="Question image" loading="lazy">`;
      html += '      </div>';
    }
    html += '      <div class="question-content">';
    html += `        <div class="answers-grid${isImageType ? " answers-grid-images" : ""}">${answersHtml}</div>`;
    html += '      </div>';
    html += '    </div>';
    html += '  </div>';
  } else {
    html += `    <div class="answers-grid${isImageType ? " answers-grid-images" : ""}">${answersHtml}</div>`;
  }
  if (questionExplanation) {
    html += `    <div class="question-explanation">${escapeHtmlWithBreaks(questionExplanation)}</div>`;
  }
  html += '</div>';

  content.innerHTML = html;
}

export function setLanguage(lang) {
  state.language = lang;
  renderFilters();
}

export function closeDetail() {
  state.selectedId = null;
  const overlay = document.getElementById("browse-modal-overlay");
  if (overlay) overlay.classList.remove("open");
  document.body.style.overflow = "";
  renderQuestionList();
  const content = document.getElementById("modal-content");
  if (content) content.innerHTML = "";
}

window._browse = { selectQuestion, closeDetail, applyBrowseFilters, resetFilters, setLanguage };
