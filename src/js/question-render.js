import { escapeHtml, escapeHtmlWithBreaks, getAnswerLabel } from "./utils.js";
import { t, getCategoryLabel } from "./i18n.js";

export function renderQuestionHeader(q, lang, extraBadge = "") {
  let html = '<div class="question-header">';
  html += '  <div class="flex items-center gap-3 flex-wrap">';
  html += `    <span class="badge badge-official">${q.official ? t("officialBadge", lang) : t("practiceBadge", lang)}</span>`;
  html += `    <span class="badge badge-category">${getCategoryLabel(q.category, lang)}</span>`;
  if (extraBadge) html += extraBadge;
  html += '  </div>';
  if (q.originalId) {
    html += `  <span class="question-id">ID: ${q.originalId}</span>`;
  }
  html += '</div>';
  return html;
}

export function renderQuestionBody(q, translation, answersHtml) {
  const isImageType = q.type === "image";
  const questionText = translation.question || "";
  const hasQuestionImage = !!q.questionImage;
  const grid = `<div class="answers-grid${isImageType ? " answers-grid-images" : ""}">${answersHtml}</div>`;
  if (!hasQuestionImage && !questionText) return grid;
  let html = '<div class="question-body-stacked">';
  if (questionText) html += `  <div class="question-text-main">${escapeHtml(questionText)}</div>`;
  html += '  <div class="question-body">';
  if (hasQuestionImage) {
    html += '    <div class="question-image-side">';
    html += `      <img src="${q.questionImage}" alt="Question image" loading="lazy">`;
    html += '    </div>';
  }
  html += '    <div class="question-content">';
  html += `      ${grid}`;
  html += '    </div>';
  html += '  </div>';
  html += '</div>';
  return html;
}

export function renderAnswerExplanation(a, explanations) {
  if (!a.paragraph) return "";
  const explText = explanations[a.paragraph];
  if (!explText) return "";
  const explCls = "answer-explanation" + (a.correct ? " correct-explanation" : "");
  return `<div class="${explCls}">${escapeHtml(explText)}</div>`;
}
