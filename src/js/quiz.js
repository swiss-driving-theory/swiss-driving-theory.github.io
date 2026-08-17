import { getQuestion, getTranslation, getOptions, getExplanation } from "./data.js";
import { getSavedLanguage, setSavedLanguage } from "./filters.js";
import { recordAnswer, getSessionState, setSessionState, clearSessionState } from "./progress.js";
import { shuffleArray, truncate, escapeHtml } from "./utils.js";

const SESSION_KEY = "cut-exam-quiz-state";

function getAnswerLabel(index) {
  return String.fromCharCode(96 + index);
}

let state = {
  questions: [],
  currentIndex: 0,
  answers: {},
  language: "de",
  showFeedback: false,
  selectedAnswer: null,
};

function loadState() {
  const saved = getSessionState(SESSION_KEY);
  if (saved && saved.questions && saved.questions.length > 0) {
    state = saved;
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
      showFeedback: false,
      selectedAnswer: null,
    };
  }
  saveState();
  render();
}

export function resetQuiz(questions) {
  state = {
    questions: shuffleArray(questions),
    currentIndex: 0,
    answers: {},
    language: getSavedLanguage(),
    showFeedback: false,
    selectedAnswer: null,
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
  if (state.showFeedback) return;
  state.selectedAnswer = answerIndex;
  state.answers[getCurrentQuestion().id] = answerIndex;
  state.showFeedback = true;
  saveState();
  render();
}

function nextQuestion() {
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex += 1;
    state.showFeedback = false;
    state.selectedAnswer = null;
    saveState();
    render();
  }
}

function prevQuestion() {
  if (state.currentIndex > 0) {
    state.currentIndex -= 1;
    state.showFeedback = false;
    state.selectedAnswer = null;
    saveState();
    render();
  }
}

function finishQuiz() {
  clearSessionState(SESSION_KEY);
  showResults();
}

function showResults() {
  let correct = 0;
  const wrong = [];
  for (const q of state.questions) {
    const ans = state.answers[q.id];
    if (ans !== undefined) {
      const isCorrect = q.answers.some((a) => a.index === ans && a.correct);
      if (isCorrect) correct++;
      else wrong.push({ question: q, selected: ans });
    }
  }

  const totalAttempted = Object.keys(state.answers).length;
  const pct = totalAttempted > 0 ? Math.round((correct / totalAttempted) * 100) : 0;

  document.getElementById("quiz-container").innerHTML = `
    <div class="results-container">
      <div class="card">
        <h2>Quiz Complete</h2>
        <div class="results-score">${pct}%</div>
        <div class="results-detail">
          ${correct} correct out of ${totalAttempted} attempted
          (${state.questions.length} total questions)
        </div>
        <div class="text-center" style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="location.reload()">Start New Quiz</button>
          <button class="btn btn-secondary" onclick="history.back()">Back</button>
        </div>
      </div>
      ${wrong.length > 0 ? `
        <div class="card mt-24">
          <h3>Wrong Answers (${wrong.length})</h3>
          <div class="wrong-answers-list">
            ${wrong.map((w, i) => {
              const t = getTranslation(w.question, state.language) || {};
              const qText = escapeHtml(t.question || truncate(w.question.originalId, 40));
              const correctAns = w.question.answers.find((a) => a.correct);
              const correctText = correctAns ? escapeHtml(t.options?.[correctAns.index - 1] || `Answer ${correctAns.index}`) : "";
              return `<div class="wrong-answer-item">
                <strong>#${i + 1}</strong> ${qText}
                <div style="margin-top:6px;color:var(--success);font-size:0.9rem;">Correct: ${correctText}</div>
              </div>`;
            }).join("")}
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

function render() {
  const q = getCurrentQuestion();
  if (!q) {
    finishQuiz();
    return;
  }

  const t = getTranslation(q, state.language) || {};
  const lang = state.language;
  const questionText = t.question || "";
  const options = t.options || [];
  const explanations = t.explanations || {};
  const current = state.currentIndex + 1;
  const total = state.questions.length;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  let correctCount = 0;
  let attemptedCount = 0;
  for (const sq of state.questions) {
    if (state.answers[sq.id] !== undefined) {
      attemptedCount++;
      const ans = sq.answers.find((a) => a.index === state.answers[sq.id]);
      if (ans && ans.correct) correctCount++;
    }
  }

  const isImageType = q.type === "image";
  const hasQuestionImage = !!q.questionImage;

  let answersHtml = "";
  if (isImageType) {
    answersHtml = q.answers
      .map(
        (a, i) => {
          const imgSrc = a.image ? `../${a.image}` : "";
          let cls = "answer-btn";
          if (state.showFeedback) {
            if (a.correct) cls += " correct";
            else if (a.index === state.selectedAnswer && !a.correct) cls += " incorrect";
          }
          const disabled = state.showFeedback ? "disabled" : "";
          return `<button class="${cls}" onclick="window._quiz.selectAnswer(${a.index})" ${disabled}>
            ${imgSrc ? `<img src="${imgSrc}" alt="Answer ${a.index}" loading="lazy">` : ""}
            <span class="answer-label">${getAnswerLabel(a.index)}</span>
          </button>`;
        }
      )
      .join("");
  } else {
    answersHtml = q.answers
      .map((a, i) => {
        const text = options[a.index - 1] || `Option ${getAnswerLabel(a.index)}`;
        let cls = "answer-btn";
        if (state.showFeedback) {
          if (a.correct) cls += " correct";
          else if (a.index === state.selectedAnswer && !a.correct) cls += " incorrect";
        }
        const disabled = state.showFeedback ? "disabled" : "";
        return `<button class="${cls}" onclick="window._quiz.selectAnswer(${a.index})" ${disabled}>
          <span class="answer-label">${getAnswerLabel(a.index)}</span>
          <span>${escapeHtml(text)}</span>
        </button>`;
      })
      .join("");
  }

  let explanationHtml = "";
  if (state.showFeedback && state.selectedAnswer !== null) {
    const selectedPara = q.answers.find((a) => a.index === state.selectedAnswer)?.paragraph;
    const explText = selectedPara ? explanations[selectedPara] : null;
    if (explText) {
      explanationHtml = `
        <div class="explanation-panel">
          <div class="explanation-title">Explanation</div>
          <div class="explanation-text">${escapeHtml(explText)}</div>
        </div>
      `;
    }
  }

  const canPrev = state.currentIndex > 0;
  const canNext = state.currentIndex < total - 1;
  const isLast = state.currentIndex === total - 1;

  document.getElementById("quiz-container").innerHTML = `
    <div class="quiz-container">
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${pct}%"></div>
      </div>
      <div class="progress-text">Question ${current} of ${total}</div>

      <div class="question-display">
        <div class="question-header">
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="badge badge-official">${q.official ? "Official" : "Practice"}</span>
            <span class="badge badge-category">${getCategoryLabel(q.category)}</span>
          </div>
          <span style="font-size:0.85rem;color:var(--text-muted);">ID: ${q.originalId}</span>
        </div>

        ${hasQuestionImage ? `<img src="../${q.questionImage}" alt="Question image" class="question-image-main" loading="lazy">` : ""}

        ${questionText ? `<div class="question-text-main">${escapeHtml(questionText)}</div>` : ""}

        <div class="answers-grid">
          ${answersHtml}
        </div>

        ${explanationHtml}
      </div>

      <div class="quiz-controls">
        <div class="score-display">
          <div class="score-item">
            <span class="score-correct">${correctCount}</span> correct
          </div>
          <div class="score-item">
            <span class="score-wrong">${attemptedCount - correctCount}</span> wrong
          </div>
          <div class="score-item">
            <span>${attemptedCount}</span> attempted
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" onclick="window._quiz.prev()" ${!canPrev ? "disabled" : ""}>
            Previous
          </button>
          <button class="btn btn-secondary" onclick="window._quiz.skip()">
            Skip
          </button>
          <button class="btn btn-primary" onclick="window._quiz.next()" ${!canNext && !isLast ? "disabled" : ""}>
            ${isLast ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  `;
}

export function skip() {
  state.answers[getCurrentQuestion().id] = null;
  nextQuestion();
}

export function getState() {
  return state;
}

window._quiz = { selectAnswer, nextQuestion, prevQuestion, skip, finishQuiz, resetQuiz, initQuiz, getState };
