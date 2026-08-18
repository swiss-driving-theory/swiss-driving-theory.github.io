import { getTranslation, getOptions, getExplanation, getQuestion, getOfficialQuestions } from "./data.js";
import { getSavedLanguage, setSavedLanguage } from "./filters.js";
import { shuffleArray, escapeHtml, getCategoryLabel } from "./utils.js";
import { t } from "./i18n.js";
import { getSessionState, setSessionState, clearSessionState } from "./progress.js";

const EXAM_KEY = "swiss-driving-theory-exam-state";

function getAnswerLabel(index) {
  return String.fromCharCode(96 + index);
}

let state = {
  questions: [],
  currentIndex: 0,
  answers: {},
  language: "de",
  timeRemaining: 45 * 60,
  timerInterval: null,
};

function loadState() {
  const saved = getSessionState(EXAM_KEY);
  if (saved && saved.questions && saved.questions.length > 0) {
    state = saved;
    state.language = getSavedLanguage();
    return true;
  }
  return false;
}

function saveState() {
  setSessionState(EXAM_KEY, state);
}

export function initExam() {
  const hasState = loadState();
  if (!hasState || state.questions.length !== 50) {
    const official = getOfficialQuestions();
    state = {
      questions: shuffleArray(official).slice(0, 50),
      currentIndex: 0,
      answers: {},
      language: getSavedLanguage(),
      timeRemaining: 45 * 60,
      timerInterval: null,
    };
  }
  saveState();
  startTimer();
  render();
  renderPalette();
}

export function setLanguage(lang) {
  state.language = lang;
  setSavedLanguage(lang);
  saveState();
  render();
  renderPalette();
}

function getCurrentQuestion() {
  return state.questions[state.currentIndex] || null;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
}

function startTimer() {
  const timerEl = document.getElementById("exam-timer");
  if (!timerEl) return;

  if (state.timerInterval) clearInterval(state.timerInterval);

  state.timerInterval = setInterval(() => {
    state.timeRemaining--;
    timerEl.textContent = formatTime(state.timeRemaining);
    if (state.timeRemaining <= 300) {
      timerEl.classList.add("warning");
    }
    if (state.timeRemaining <= 0) {
      clearInterval(state.timerInterval);
      finishExam();
    }
  }, 1000);
}

function selectAnswer(index) {
  const q = getCurrentQuestion();
  const pos = state.answers[q.id];
  if (pos === undefined || pos === null) {
    state.answers[q.id] = [index];
  } else {
    const idx = pos.indexOf(index);
    if (idx >= 0) {
      pos.splice(idx, 1);
      if (pos.length === 0) {
        state.answers[q.id] = null;
      }
    } else {
      pos.push(index);
    }
  }
  saveState();
  renderPalette();
  render();
}

function nextQuestion() {
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex++;
    saveState();
    render();
    renderPalette();
  }
}

function prevQuestion() {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    saveState();
    render();
    renderPalette();
  }
}

function goToQuestion(index) {
  if (index >= 0 && index < state.questions.length) {
    state.currentIndex = index;
    saveState();
    render();
    renderPalette();
  }
}

function calculateErrorPoints(questions, answers) {
  let totalErrorPoints = 0;
  const questionErrorPoints = {};

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const ans = answers[q.id];
    let ep = 0;

    if (ans === undefined || ans === null || ans.length === 0) {
      ep = q.answers.filter((a) => a.correct).length;
    } else {
      const correctIndices = {};
      for (let j = 0; j < q.answers.length; j++) {
        if (q.answers[j].correct) {
          correctIndices[q.answers[j].index] = true;
        }
      }
      for (let k = 0; k < ans.length; k++) {
        if (!correctIndices[ans[k]]) {
          ep++;
        }
      }
      for (const key in correctIndices) {
        if (ans.indexOf(Number(key)) === -1) {
          ep++;
        }
      }
    }

    ep = Math.min(ep, 3);
    questionErrorPoints[q.id] = ep;
    totalErrorPoints += ep;
  }

  return { total: totalErrorPoints, perQuestion: questionErrorPoints };
}

function finishExam() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  clearSessionState(EXAM_KEY);
  const results = calculateErrorPoints(state.questions, state.answers);
  const passed = results.total <= 15;
  showExamResults(results, passed);
}

function showExamResults(results, passed) {
  const container = document.getElementById("exam-container");
  const verdictClass = passed ? "pass" : "fail";
  const verdictText = passed ? t("passed", state.language) : t("failed", state.language);

  let html = `<div class="results-container">`;
  html += `  <div class="card results-card">`;
  html += `    <h2 class="results-header">${t("examComplete", state.language)}</h2>`;
  html += `    <div class="exam-result-verdict ${verdictClass}">${verdictText}</div>`;
  html += `    <div class="results-score">${results.total} <span style="font-size:0.5em;font-weight:600;">${t("errorPoints", state.language, { points: "" })}</span></div>`;
  html += `    <div class="results-detail">${passed ? t("youPassed", state.language) : t("maxAllowed", state.language)}</div>`;
  html += `    <div class="results-controls">`;
  html += `      <button class="btn btn-primary" onclick="location.reload()">${t("newExam", state.language)}</button>`;
  html += `      <a href="index.html" class="btn btn-secondary">${t("home", state.language)}</a>`;
  html += `    </div>`;
  html += `  </div>`;

  html += `  <div class="card wrong-answers-section">`;
  html += `    <div class="wrong-header">`;
  html += `      <h3 class="wrong-title">${t("questionReview", state.language)}</h3>`;
  html += `    </div>`;
  html += `    <div class="wrong-answers-list">`;

  for (let i = 0; i < state.questions.length; i++) {
    const q = state.questions[i];
    const ep = results.perQuestion[q.id] || 0;
    const ans = state.answers[q.id];
    const tq = getTranslation(q, state.language) || {};
    const qText = escapeHtml(tq.question || `Question ${q.originalId}`);

    let statusBadge = "";
    if (ep === 0) statusBadge = `<span class="badge badge-success">${t("correctBadge", state.language)}</span>`;
    else statusBadge = `<span class="badge badge-error">${ep} ${t("errorPoints", state.language, { points: "" })}</span>`;

    let selectedText = "";
    if (ans !== undefined && ans !== null && ans.length > 0) {
      const texts = [];
      for (let k = 0; k < ans.length; k++) {
        const aIndex = ans[k];
        const aText = tq.options && tq.options[aIndex - 1] ? escapeHtml(tq.options[aIndex - 1]) : `Answer ${getAnswerLabel(aIndex)}`;
        texts.push(aText);
      }
      selectedText = `<div style="margin-top:6px;font-size:var(--text-sm);color:var(--text-muted);">${t("selectedLabel", state.language)} ${texts.join(", ")}</div>`;
    } else if (ans === null) {
      selectedText = `<div style="margin-top:6px;font-size:var(--text-sm);color:var(--text-muted);">${t("skippedLabel", state.language)}</div>`;
    }

    const correctTexts = [];
    for (let j = 0; j < q.answers.length; j++) {
      if (q.answers[j].correct) {
        const cText = tq.options && tq.options[q.answers[j].index - 1] ? escapeHtml(tq.options[q.answers[j].index - 1]) : `Answer ${getAnswerLabel(q.answers[j].index)}`;
        correctTexts.push(cText);
      }
    }

    html += `      <div class="wrong-answer-item">`;
    html += `        <div class="flex items-start gap-3">`;
    html += `          <span class="wrong-answer-number">${i + 1}</span>`;
    html += `          <div class="flex-1">`;
    html += `            <div class="flex items-center gap-2" style="margin-bottom:4px;">`;
    html += `              <span class="badge badge-official">${q.official ? t("officialBadge", state.language) : t("practiceBadge", state.language)}</span>`;
    html += `              <span class="badge badge-category">${getCategoryLabel(q.category, state.language)}</span>`;
    html += `              ${statusBadge}`;
    html += `            </div>`;
    html += `            <div>${qText}</div>`;
    html += selectedText;
    if (correctTexts.length > 0) {
      html += `            <div class="correct-answer-text">${t("correctLabel", state.language)} ${correctTexts.join(", ")}</div>`;
    }
    html += `          </div>`;
    html += `        </div>`;
    html += `      </div>`;
  }

  html += `    </div>`;
  html += `  </div>`;
  html += `</div>`;

  container.innerHTML = html;
}

function renderPalette() {
  const palette = document.getElementById("exam-palette");
  if (!palette) return;

  let html = "";
  for (let i = 0; i < state.questions.length; i++) {
    const q = state.questions[i];
    const ans = state.answers[q.id];
    let cls = "exam-palette-dot";
    if (i === state.currentIndex) cls += " current";
    else if (ans !== undefined && ans !== null && ans.length > 0) cls += " answered";
    else if (ans === null) cls += " skipped";
    html += `<div class="${cls}" onclick="window._exam.goToQuestion(${i})">${i + 1}</div>`;
  }
  palette.innerHTML = html;
}

function render() {
  const q = getCurrentQuestion();
  if (!q) {
    finishExam();
    return;
  }

  const tq = getTranslation(q, state.language) || {};
  const lang = state.language;
  const questionText = tq.question || "";
  const options = tq.options || [];
  const explanations = tq.explanations || {};
  const current = state.currentIndex + 1;
  const total = state.questions.length;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  const isImageType = q.type === "image";
  const hasQuestionImage = !!q.questionImage;

  const ans = state.answers[q.id];
  const selectedIndices = (ans !== undefined && ans !== null) ? ans : [];

  let answersHtml = "";
  if (isImageType) {
    for (let i = 0; i < q.answers.length; i++) {
      const a = q.answers[i];
      const imgSrc = a.image ? a.image : "";
      let cls = "answer-btn";
      if (selectedIndices.indexOf(a.index) >= 0) cls += " selected";
      answersHtml += `<div class="answer-wrapper">`;
      answersHtml += `<button class="${cls}" onclick="window._exam.selectAnswer(${a.index})">`;
      if (imgSrc) answersHtml += `<img src="${imgSrc}" alt="Answer ${a.index}" loading="lazy">`;
      answersHtml += `  <span class="answer-label">${getAnswerLabel(a.index)}</span>`;
      answersHtml += `</button>`;
      answersHtml += `</div>`;
    }
  } else {
    for (let i = 0; i < q.answers.length; i++) {
      const a = q.answers[i];
      const text = options[a.index - 1] || `Option ${getAnswerLabel(a.index)}`;
      let cls = "answer-btn";
      if (selectedIndices.indexOf(a.index) >= 0) cls += " selected";
      answersHtml += `<div class="answer-wrapper">`;
      answersHtml += `<button class="${cls}" onclick="window._exam.selectAnswer(${a.index})">`;
      answersHtml += `  <span class="answer-label">${getAnswerLabel(a.index)}</span>`;
      answersHtml += `  <span>${escapeHtml(text)}</span>`;
      answersHtml += `</button>`;
      answersHtml += `</div>`;
    }
  }

  const canPrev = state.currentIndex > 0;
  const canNext = state.currentIndex < total - 1;

  let html = `<div class="quiz-container">`;
  html += `  <div class="progress-bar"><div class="progress-fill" style="width: ${pct}%"></div></div>`;
  html += `  <div class="progress-text">${t("questionOf", lang, { current, total, pct })}</div>`;
  html += `  <div class="question-display">`;
  html += `    <div class="question-header">`;
  html += `      <div class="flex items-center gap-3">`;
  html += `        <span class="badge badge-official">${q.official ? t("officialBadge", lang) : t("practiceBadge", lang)}</span>`;
  html += `        <span class="badge badge-category">${getCategoryLabel(q.category, lang)}</span>`;
  html += `      </div>`;
  html += `      <span class="question-id">ID: ${q.originalId}</span>`;
  html += `    </div>`;

  if (hasQuestionImage || questionText) {
    html += `    <div class="question-body-stacked">`;
    if (questionText) {
      html += `      <div class="question-text-main">${escapeHtml(questionText)}</div>`;
    }
    html += `      <div class="question-body">`;
    if (hasQuestionImage) {
      html += `        <div class="question-image-side">`;
      html += `          <img src="${q.questionImage}" alt="Question image" loading="lazy">`;
      html += `        </div>`;
    }
    html += `        <div class="question-content">`;
    html += `          <div class="answers-grid${isImageType ? " answers-grid-images" : ""}">${answersHtml}</div>`;
    html += `        </div>`;
    html += `      </div>`;
    html += `    </div>`;
  } else {
    html += `    <div class="answers-grid${isImageType ? " answers-grid-images" : ""}">${answersHtml}</div>`;
  }
  html += `  </div>`;

  html += `  <div class="quiz-controls">`;
  html += `    <div class="quiz-actions flex gap-3">`;
  html += `      <button class="btn btn-secondary" onclick="window._exam.prevQuestion()" ${!canPrev ? "disabled" : ""}>${t("previous", lang)}</button>`;
  html += `      <button class="btn btn-primary" onclick="window._exam.nextQuestion()" ${!canNext && !(state.currentIndex === total - 1) ? "disabled" : ""}>${state.currentIndex === total - 1 ? t("finish", lang) : t("next", lang)}</button>`;
  html += `    </div>`;
  html += `  </div>`;
  html += `</div>`;

  document.getElementById("exam-container").innerHTML = html;
  document.getElementById("exam-counter").textContent = t("questionCounter", lang, { current, total });
}

window._exam = { selectAnswer, nextQuestion, prevQuestion, goToQuestion, finishExam, initExam, setLanguage };
