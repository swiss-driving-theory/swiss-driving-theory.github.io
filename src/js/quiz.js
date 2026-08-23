import { getQuestion, getTranslation, getOptions, getExplanation } from "./data.js";
import { getSavedLanguage, setSavedLanguage } from "./filters.js";
import { recordAnswer, getSessionState, setSessionState, clearSessionState } from "./progress.js";
import { shuffleArray, truncate, escapeHtml, escapeHtmlWithBreaks, getCategoryLabel } from "./utils.js";
import { t } from "./i18n.js";

const SESSION_KEY = "swiss-driving-theory-quiz-state";

function getAnswerLabel(index) {
  return String.fromCharCode(96 + index);
}

let state = {
  questions: [],
  currentIndex: 0,
  answers: {},
  language: "de",
  selectedIndices: [],
  checked: false,
};

function loadState() {
  const saved = getSessionState(SESSION_KEY);
  if (saved && saved.questions && saved.questions.length > 0) {
    state = saved;
    state.language = getSavedLanguage();
    return true;
  }
  return false;
}

function saveState() {
  setSessionState(SESSION_KEY, state);
}

export function initQuiz(questions) {
  const hasState = loadState();
  if (!hasState || state.questions.length !== questions.length) {
    state = {
      questions: shuffleArray(questions),
      currentIndex: 0,
      answers: {},
      language: getSavedLanguage(),
      selectedIndices: [],
      checked: false,
    };
  }
  saveState();
  render();
}

export function resetQuiz() {
  state = {
    questions: shuffleArray(state.questions),
    currentIndex: 0,
    answers: {},
    language: getSavedLanguage(),
    selectedIndices: [],
    checked: false,
  };
  saveState();
  render();
}

export function setLanguage(lang) {
  state.language = lang;
  setSavedLanguage(lang);
  saveState();
  render();
}

function getCurrentQuestion() {
  return state.questions[state.currentIndex] || null;
}

function selectAnswer(answerIndex) {
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

function checkAnswer() {
  if (state.selectedIndices.length === 0) return;
  state.checked = true;
  const q = getCurrentQuestion();
  state.answers[q.id] = state.selectedIndices.slice();
  saveState();
  render();
}

function nextQuestion() {
  if (state.currentIndex < state.questions.length - 1) {
    const q = getCurrentQuestion();
    state.answers[q.id] = state.selectedIndices.slice();
    state.currentIndex += 1;
    state.selectedIndices = [];
    state.checked = false;
    saveState();
    render();
  } else {
    finishQuiz();
  }
}

function prevQuestion() {
  if (state.currentIndex > 0) {
    const q = getCurrentQuestion();
    state.answers[q.id] = state.selectedIndices.slice();
    state.currentIndex -= 1;
    state.selectedIndices = state.answers[state.questions[state.currentIndex].id] ? state.answers[state.questions[state.currentIndex].id].slice() : [];
    state.checked = false;
    saveState();
    render();
  }
}

function finishQuiz() {
  const q = getCurrentQuestion();
  state.answers[q.id] = state.selectedIndices.slice();
  clearSessionState(SESSION_KEY);
  showResults();
}

export function skip() {
  const q = getCurrentQuestion();
  state.answers[q.id] = null;
  nextQuestion();
}

function showResults() {
  let correct = 0;
  const wrong = [];
  for (const q of state.questions) {
    const ans = state.answers[q.id];
    if (ans !== undefined && ans !== null && ans.length > 0) {
      const isCorrect = checkMultiCorrect(q, ans);
      if (isCorrect) correct++;
      else wrong.push({ question: q, selected: ans });
    }
  }

  const totalAttempted = Object.keys(state.answers).length;
  const pct = totalAttempted > 0 ? Math.round((correct / totalAttempted) * 100) : 0;

  document.getElementById("quiz-container").innerHTML = `
    <div class="results-container">
      <div class="card">
        <h2>${t("trainingComplete", state.language)}</h2>
        <div class="results-score">${pct}%</div>
        <div class="results-detail">
          ${t("correctOutOf", state.language, {
            correct,
            attempted: totalAttempted,
            total: state.questions.length,
          })}
        </div>
        <div class="text-center" style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="location.reload()">${t("startNewQuiz", state.language)}</button>
          <button class="btn btn-secondary" onclick="history.back()">${t("back", state.language)}</button>
        </div>
      </div>
      ${wrong.length > 0 ? `
        <div class="card mt-24">
          <h3>${t("wrongAnswers", state.language, { count: wrong.length })}</h3>
          <div class="wrong-answers-list">
            ${wrong.map((w, i) => {
              const tq = getTranslation(w.question, state.language) || {};
              const qText = escapeHtml(tq.question || truncate(w.question.originalId, 40));
              const correctAns = w.question.answers.find((a) => a.correct);
              const correctText = correctAns ? escapeHtml(tq.options?.[correctAns.index - 1] || `Answer ${correctAns.index}`) : "";
              return `<div class="wrong-answer-item">
                <strong>#${i + 1}</strong> ${qText}
                <div style="margin-top:6px;color:var(--success);font-size:0.9rem;">${t("correctLabel", state.language)} ${correctText}</div>
              </div>`;
            }).join("")}
          </div>
        </div>
      ` : ""}
    </div>
  `;
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

function render() {
  const q = getCurrentQuestion();
  if (!q) {
    finishQuiz();
    return;
  }

  const tq = getTranslation(q, state.language) || {};
  const lang = state.language;
  const questionText = tq.question || "";
  const options = tq.options || [];
  const explanations = tq.explanations || {};
  const questionExplanation = tq.questionExplanation || "";
  const current = state.currentIndex + 1;
  const total = state.questions.length;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  let correctCount = 0;
  let attemptedCount = 0;
  for (const sq of state.questions) {
    const ans = state.answers[sq.id];
    if (ans !== undefined && ans !== null && ans.length > 0) {
      attemptedCount++;
      const isCorrect = checkMultiCorrect(sq, ans);
      if (isCorrect) correctCount++;
    }
  }

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
      answersHtml += `<button class="${cls}" onclick="window._quiz.selectAnswer(${a.index})" ${disabled}>`;
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
      answersHtml += `<button class="${cls}" onclick="window._quiz.selectAnswer(${a.index})" ${disabled}>`;
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

  const canPrev = state.currentIndex > 0;
  const canNext = state.currentIndex < total - 1;
  const isLast = state.currentIndex === total - 1;

  let html = '<div class="quiz-container">';
  html += `  <div class="progress-bar"><div class="progress-fill" style="width: ${pct}%"></div></div>`;
  html += `  <div class="progress-text">${t("questionOf", lang, { current, total, pct })}</div>`;
  html += '  <div class="question-display">';
  html += '    <div class="question-header">';
  html += '      <div class="flex items-center gap-3">';
  html += `        <span class="badge badge-official">${q.official ? t("officialBadge", lang) : t("practiceBadge", lang)}</span>`;
  html += `        <span class="badge badge-category">${getCategoryLabel(q.category, lang)}</span>`;
  html += '      </div>';
  html += `      <span class="question-id">ID: ${q.originalId}</span>`;
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
  html += '    <div class="score-display">';
  html += `      <div class="score-item"><span class="score-correct">${correctCount}</span> ${t("scoreCorrect", lang)}</div>`;
  html += `      <div class="score-item"><span class="score-wrong">${attemptedCount - correctCount}</span> ${t("scoreWrong", lang)}</div>`;
  html += `      <div class="score-item"><span>${attemptedCount}</span> ${t("scoreAttempted", lang)}</div>`;
  html += '    </div>';
  html += '    <div style="display:flex;gap:8px;">';
  html += `      <button class="btn btn-secondary" onclick="window._quiz.prevQuestion()" ${!canPrev ? "disabled" : ""}>${t("previous", lang)}</button>`;
  html += `      <button class="btn btn-primary" onclick="window._quiz.checkAnswer()" ${state.checked || state.selectedIndices.length === 0 ? "disabled" : ""}>${t("checkAnswer", lang)}</button>`;
  html += `      <button class="btn btn-primary" onclick="window._quiz.nextQuestion()" ${!canNext && !isLast ? "disabled" : ""}>${isLast ? t("finish", lang) : t("next", lang)}</button>`;
  html += '    </div>';
  html += '  </div>';
  html += '</div>';

  document.getElementById("quiz-container").innerHTML = html;
}

export function getState() {
  return state;
}

window._quiz = { selectAnswer, nextQuestion, prevQuestion, checkAnswer, skip, finishQuiz, resetQuiz, initQuiz, getState, setLanguage };
