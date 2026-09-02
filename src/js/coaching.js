import { getOfficialQuestions, getQuestions, getTranslation } from "./data.js";
import { getSavedLanguage, setSavedLanguage } from "./filters.js";
import { getSessionState, setSessionState, clearSessionState } from "./progress.js";
import { shuffleArray, escapeHtml, escapeHtmlWithBreaks, getCategoryLabel } from "./utils.js";
import { t } from "./i18n.js";

const SESSION_KEY = "swiss-driving-theory-coaching-state";
const BOXES_KEY = "swiss-driving-theory-coaching-boxes";
const BONUS_INTERVAL = 6;

function getAnswerLabel(index) {
  return String.fromCharCode(96 + index);
}

let state = {
  questions: [],
  queue: [],
  currentIndex: 0,
  answers: {},
  language: "de",
  selectedIndices: [],
  checked: false,
  boxes: {},
  officialSeen: 0,
};

function loadBoxes() {
  try {
    const raw = localStorage.getItem(BOXES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveBoxes() {
  localStorage.setItem(BOXES_KEY, JSON.stringify(state.boxes));
}

function loadState() {
  const saved = getSessionState(SESSION_KEY);
  if (saved && saved.questions && saved.questions.length > 0 && Array.isArray(saved.queue)) {
    const firstItem = saved.queue[0];
    if (!firstItem || !firstItem.question || !Array.isArray(firstItem.question.answers)) {
      return false;
    }
    state = saved;
    state.language = getSavedLanguage();
    return true;
  }
  return false;
}

function saveState() {
  setSessionState(SESSION_KEY, state);
}

export function initCoaching() {
  const official = getOfficialQuestions();
  if (official.length === 0) {
    document.getElementById("coaching-container").innerHTML = `
      <div class="coaching-container text-center">
        <h3>${t("noOfficialQuestions", state.language)}</h3>
        <p class="error-hint">${t("noOfficialQuestionsDesc", state.language)}</p>
      </div>
    `;
    return;
  }

  const hasState = loadState();
  state.boxes = loadBoxes();

  if (hasState && state.questions.length === official.length) {
    state.currentIndex = 0;
    state.answers = {};
    state.selectedIndices = [];
    state.checked = false;
    state.officialSeen = 0;
  } else {
    state.questions = [...official];
    state.currentIndex = 0;
    state.answers = {};
    state.selectedIndices = [];
    state.checked = false;
    state.officialSeen = 0;
  }
  buildQueue();

  saveState();
  render();
}

export function resetCoachingProgress() {
  state.boxes = {};
  saveBoxes();
  clearSessionState(SESSION_KEY);
  state.questions = getOfficialQuestions();
  state.currentIndex = 0;
  state.answers = {};
  state.selectedIndices = [];
  state.checked = false;
  state.officialSeen = 0;
  buildQueue();
  saveState();
  render();
}

function advanceBox(questionId, correct) {
  const currentBox = state.boxes[questionId] ?? 1;
  if (correct) {
    if (currentBox >= 3) {
      state.boxes[questionId] = 0;
    } else {
      state.boxes[questionId] = currentBox + 1;
    }
  } else {
    state.boxes[questionId] = 1;
  }
  saveBoxes();
}

function getExtraQuestions() {
  const all = getQuestions();
  return all.filter((q) => !q.official);
}

function buildQueue() {
  const box1 = [];
  const box2 = [];
  const box3 = [];

  for (const q of state.questions) {
    const box = state.boxes[q.id] ?? 1;
    if (box === 0) continue;
    if (box === 1) box1.push(q);
    else if (box === 2) box2.push(q);
    else if (box === 3) box3.push(q);
  }

  const shuffled1 = shuffleArray(box1);
  const shuffled2 = shuffleArray(box2);
  const shuffled3 = shuffleArray(box3);

  const extras = getExtraQuestions();
  const result = [];
  let officialCount = 0;

  for (const q of [...shuffled1, ...shuffled2, ...shuffled3]) {
    result.push({ question: q, isBonus: false });
    officialCount++;
    if (officialCount % BONUS_INTERVAL === 0 && extras.length > 0) {
      const bonus = extras[Math.floor(Math.random() * extras.length)];
      result.push({ question: bonus, isBonus: true });
    }
  }

  state.queue = result;
  state.currentIndex = 0;
}

export function setLanguage(lang) {
  state.language = lang;
  setSavedLanguage(lang);
  saveState();
  render();
}

function getCurrentItem() {
  return state.queue[state.currentIndex] || null;
}

export function selectAnswer(answerIndex) {
  if (state.checked) return;
  const pos = state.selectedIndices.indexOf(answerIndex);
  if (pos >= 0) {
    state.selectedIndices.splice(pos, 1);
  } else {
    state.selectedIndices.push(answerIndex);
  }
  saveState();
  render();
}

export function checkAnswer() {
  if (state.selectedIndices.length === 0) return;
  state.checked = true;
  const item = getCurrentItem();
  const q = item ? item.question : null;

  if (item && !item.isBonus) {
    const isCorrect = checkMultiCorrect(q, state.selectedIndices);
    advanceBox(q.id, isCorrect);
    state.officialSeen++;
  }

  if (q) state.answers[q.id] = state.selectedIndices.slice();
  saveState();
  render();
}

export function nextQuestion() {
  if (state.currentIndex < state.queue.length - 1) {
    const item = getCurrentItem();
    const q = item ? item.question : null;
    if (q) state.answers[q.id] = state.selectedIndices.slice();
    state.currentIndex += 1;
    state.selectedIndices = [];
    state.checked = false;
    saveState();
    render();
  } else {
    finishCoaching();
  }
}

export function prevQuestion() {
  if (state.currentIndex > 0) {
    const item = getCurrentItem();
    const q = item ? item.question : null;
    if (q) state.answers[q.id] = state.selectedIndices.slice();
    state.currentIndex -= 1;
    const prev = state.queue[state.currentIndex];
    state.selectedIndices = prev ? (state.answers[prev.id] ? state.answers[prev.id].slice() : []) : [];
    state.checked = false;
    saveState();
    render();
  }
}

function finishCoaching() {
  const item = getCurrentItem();
  const q = item ? item.question : null;
  if (q) state.answers[q.id] = state.selectedIndices.slice();
  clearSessionState(SESSION_KEY);
  showResults();
}

export function skip() {
  const item = getCurrentItem();
  const q = item ? item.question : null;
  if (q) {
    state.answers[q.id] = null;
    if (!item.isBonus) {
      advanceBox(q.id, false);
      state.officialSeen++;
    }
  }
  nextQuestion();
}

function checkMultiCorrect(q, ans) {
  if (!ans || ans.length === 0) return false;
  const correctCount = q.answers.filter((a) => a.correct).length;
  if (ans.length !== correctCount) return false;
  for (let k = 0; k < ans.length; k++) {
    const found = q.answers.some((a) => a.index === ans[k] && a.correct);
    if (!found) return false;
  }
  return true;
}

function showResults() {
  let box1 = 0;
  let box2 = 0;
  let box3 = 0;
  let mastered = 0;

  for (const q of state.questions) {
    const box = state.boxes[q.id] ?? 1;
    if (box === 0) mastered++;
    else if (box === 1) box1++;
    else if (box === 2) box2++;
    else if (box === 3) box3++;
  }

  const remaining = box1 + box2 + box3;
  const total = state.questions.length;

  document.getElementById("coaching-container").innerHTML = `
    <div class="quiz-container">
      <div class="card">
        <h2>${t("coachingAllDone", state.language)}</h2>
        <div class="coaching-stats">
          <div class="stat-card">
            <div class="stat-value">${mastered}</div>
            <div class="stat-label">${t("coachingMastered", state.language)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${remaining}</div>
            <div class="stat-label">${t("coachingRemaining", state.language)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${box1}</div>
            <div class="stat-label">${t("coachingBox1", state.language)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${box2}</div>
            <div class="stat-label">${t("coachingBox2", state.language)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${box3}</div>
            <div class="stat-label">${t("coachingBox3", state.language)}</div>
          </div>
        </div>
        <div class="results-controls">
          <button class="btn btn-primary" onclick="window._coaching.continueCoaching()">${t("coachingContinue", state.language)}</button>
          <button class="btn btn-secondary" onclick="window._coaching.resetCoachingProgress()">${t("resetCoachingProgress", state.language)}</button>
        </div>
      </div>
    </div>
  `;
}

export function continueCoaching() {
  state.questions = getOfficialQuestions();
  state.currentIndex = 0;
  state.answers = {};
  state.selectedIndices = [];
  state.checked = false;
  state.officialSeen = 0;
  buildQueue();
  saveState();
  render();
}

function render() {
  let item = state.queue[state.currentIndex];

  while (!item || !item.question || !item.question.id) {
    if (state.currentIndex < state.queue.length - 1) {
      state.currentIndex += 1;
      item = state.queue[state.currentIndex];
    } else {
      finishCoaching();
      return;
    }
  }

  const q = item.question;
  const tq = getTranslation(q, state.language) || {};
  const lang = state.language;
  const questionText = tq.question || "";
  const options = tq.options || [];
  const explanations = tq.explanations || {};
  const questionExplanation = tq.questionExplanation || "";
  const isImageType = q.type === "image";
  const hasQuestionImage = !!q.questionImage;

  let answersHtml = "";
  if (isImageType) {
    for (let i = 0; i < q.answers.length; i++) {
      const a = q.answers[i];
      const imgSrc = a.image ? a.image : "";
      let cls = "answer-btn";
      if (state.checked) {
        if (a.correct) cls += " correct";
        else if (state.selectedIndices.indexOf(a.index) >= 0 && !a.correct) cls += " incorrect";
      } else {
        if (state.selectedIndices.indexOf(a.index) >= 0) cls += " selected";
      }
      const disabled = state.checked ? "disabled" : "";
      answersHtml += '<div class="answer-wrapper">';
      answersHtml += `<button type="button" class="${cls}" onclick="window._coaching.selectAnswer(${a.index})" ${disabled}>`;
      if (imgSrc) answersHtml += `<img src="${imgSrc}" alt="Answer ${a.index}" loading="lazy">`;
      answersHtml += `  <span class="answer-label">${getAnswerLabel(a.index)}</span>`;
      answersHtml += '</button>';
      if (state.checked && a.paragraph) {
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
      const text = options[a.index - 1] || `Option ${getAnswerLabel(a.index)}`;
      let cls = "answer-btn";
      if (state.checked) {
        if (a.correct) cls += " correct";
        else if (state.selectedIndices.indexOf(a.index) >= 0 && !a.correct) cls += " incorrect";
      } else {
        if (state.selectedIndices.indexOf(a.index) >= 0) cls += " selected";
      }
      const disabled = state.checked ? "disabled" : "";
      answersHtml += '<div class="answer-wrapper">';
      answersHtml += `<button type="button" class="${cls}" onclick="window._coaching.selectAnswer(${a.index})" ${disabled}>`;
      answersHtml += `  <span class="answer-label">${getAnswerLabel(a.index)}</span>`;
      answersHtml += `  <span>${escapeHtml(text)}</span>`;
      answersHtml += '</button>';
      if (state.checked && a.paragraph) {
        const explText = explanations[a.paragraph];
        if (explText) {
          const explCls = "answer-explanation" + (a.correct ? " correct-explanation" : "");
          answersHtml += `<div class="${explCls}">${escapeHtml(explText)}</div>`;
        }
      }
      answersHtml += '</div>';
    }
  }

  const canNext = state.currentIndex < state.queue.length - 1;
  const isLast = state.currentIndex === state.queue.length - 1;

  let box1 = 0;
  let box2 = 0;
  let box3 = 0;
  let mastered = 0;
  for (const oq of state.questions) {
    const box = state.boxes[oq.id] ?? 1;
    if (box === 0) mastered++;
    else if (box === 1) box1++;
    else if (box === 2) box2++;
    else if (box === 3) box3++;
  }

  const total = state.questions.length;
  const masteredPct = total > 0 ? (mastered / total) * 100 : 0;
  const box3Pct = total > 0 ? (box3 / total) * 100 : 0;
  const box2Pct = total > 0 ? (box2 / total) * 100 : 0;
  const box1Pct = total > 0 ? (box1 / total) * 100 : 0;

  let html = '<div class="quiz-container">';
  html += '  <div class="coaching-stacked-bar">';
  if (masteredPct > 0) {
    html += `<div class="coaching-segment coaching-segment-mastered" style="width:${masteredPct.toFixed(1)}%"></div>`;
  }
  if (box3Pct > 0) {
    html += `<div class="coaching-segment coaching-segment-box3" style="width:${box3Pct.toFixed(1)}%"></div>`;
  }
  if (box2Pct > 0) {
    html += `<div class="coaching-segment coaching-segment-box2" style="width:${box2Pct.toFixed(1)}%"></div>`;
  }
  if (box1Pct > 0) {
    html += `<div class="coaching-segment coaching-segment-box1" style="width:${box1Pct.toFixed(1)}%"></div>`;
  }
  html += '  </div>';
  html += '  <div class="coaching-top-row">';
  html += '    <div class="coaching-legend">';
  html += `      <span class="coaching-legend-item${mastered === 0 ? ' coaching-legend-empty' : ''}"><span class="coaching-legend-dot coaching-legend-mastered"></span>${mastered}</span>`;
  html += `      <span class="coaching-legend-item${box3 === 0 ? ' coaching-legend-empty' : ''}"><span class="coaching-legend-dot coaching-legend-box3"></span>${box3}</span>`;
  html += `      <span class="coaching-legend-item${box2 === 0 ? ' coaching-legend-empty' : ''}"><span class="coaching-legend-dot coaching-legend-box2"></span>${box2}</span>`;
  html += `      <span class="coaching-legend-item${box1 === 0 ? ' coaching-legend-empty' : ''}"><span class="coaching-legend-dot coaching-legend-box1"></span>${box1}</span>`;
  html += '    </div>';
  html += `    <button class="btn-coaching-reset" onclick="window._coaching.resetCoachingProgress()">${t("resetCoachingProgress", lang)}</button>`;
  html += '  </div>';
  html += '  <div class="question-display">';
  html += '    <div class="question-header">';
  html += '      <div class="flex items-center gap-3 flex-wrap">';
  html += `        <span class="badge badge-official">${q.official ? t("officialBadge", lang) : t("practiceBadge", lang)}</span>`;
  html += `        <span class="badge badge-category">${getCategoryLabel(q.category, lang)}</span>`;
  if (item.isBonus) {
    html += `        <span class="badge badge-success">${t("coachingBonus", lang)}</span>`;
  }
  html += '      </div>';
  if (q.originalId) {
    html += `      <span class="question-id">ID: ${q.originalId}</span>`;
  }
  html += '    </div>';

  if (hasQuestionImage || questionText) {
    html += '    <div class="question-body-stacked">';
    if (questionText) {
      html += `      <div class="question-text-main">${escapeHtml(questionText)}</div>`;
    }
    html += '      <div class="question-body">';
    if (hasQuestionImage) {
      html += '        <div class="question-image-side">';
      html += `          <img src="${q.questionImage}" alt="Question image" loading="lazy">`;
      html += '        </div>';
    }
    html += '        <div class="question-content">';
    html += `          <div class="answers-grid${isImageType ? " answers-grid-images" : ""}">${answersHtml}</div>`;
    html += '        </div>';
    html += '      </div>';
    html += '    </div>';
  } else {
    html += `    <div class="answers-grid${isImageType ? " answers-grid-images" : ""}">${answersHtml}</div>`;
  }
  if (state.checked && questionExplanation) {
    html += `    <div class="question-explanation">${escapeHtmlWithBreaks(questionExplanation)}</div>`;
  }
  html += '  </div>';

  html += '  <div class="quiz-controls">';
  html += '    <div class="quiz-actions flex gap-2">';
  html += `      <button class="btn btn-primary" onclick="window._coaching.checkAnswer()" ${state.checked || state.selectedIndices.length === 0 ? "disabled" : ""}>${t("checkAnswer", lang)}</button>`;
  html += `      <button class="btn btn-primary" onclick="window._coaching.nextQuestion()" ${!state.checked || (!canNext && !isLast) ? "disabled" : ""}>${isLast ? t("coachingFinish", lang) : t("next", lang)}</button>`;
  html += '    </div>';
  html += '  </div>';
  html += '</div>';

  document.getElementById("coaching-container").innerHTML = html;
}

export function getState() {
  return state;
}

window._coaching = {
  selectAnswer,
  nextQuestion,
  prevQuestion,
  checkAnswer,
  skip,
  finishCoaching,
  resetCoachingProgress,
  initCoaching,
  continueCoaching,
  getState,
  setLanguage,
};
