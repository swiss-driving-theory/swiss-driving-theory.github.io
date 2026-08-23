import { getCategoryLabel as _getCategoryLabel, getTypeLabel as _getTypeLabel, getLanguageName as _getLanguageName } from "./i18n.js";

export function getCategoryLabel(catId, lang = "de") {
  return _getCategoryLabel(catId, lang);
}

export function getTypeLabel(type, lang = "de") {
  return _getTypeLabel(type, lang);
}

export function getLanguageName(code, lang = "de") {
  return _getLanguageName(code, lang);
}

export function truncate(text, maxLen = 80) {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + "...";
}

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function escapeHtmlWithBreaks(str) {
  return escapeHtml(str).replace(/\r?\n/g, "<br>");
}

export function formatNumber(n) {
  return n.toLocaleString();
}
