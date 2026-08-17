let questions = [];
let indexes = { byId: {}, byCategory: {}, officialIds: new Set() };

export async function loadData() {
  const resp = await fetch("../../assets/questions.json");
  if (!resp.ok) throw new Error(`Failed to load questions.json: ${resp.status}`);
  const data = await resp.json();
  questions = data.questions || [];

  indexes.byId = {};
  indexes.byCategory = {};
  indexes.officialIds = new Set();

  for (const q of questions) {
    indexes.byId[q.id] = q;
    if (!indexes.byCategory[q.category]) indexes.byCategory[q.category] = [];
    indexes.byCategory[q.category].push(q);
    if (q.official) indexes.officialIds.add(q.id);
  }

  return { questions, meta: data.meta };
}

export function getQuestion(id) {
  return indexes.byId[id] || null;
}

export function getQuestionsByCategory(catId) {
  return indexes.byCategory[catId] || [];
}

export function getOfficialQuestions() {
  return questions.filter((q) => q.official);
}

export function getAllCategories() {
  const cats = new Set(questions.map((q) => q.category));
  return Array.from(cats).sort((a, b) => a - b);
}

export function filterQuestions({ language, officialOnly, categoryId } = {}) {
  return questions.filter((q) => {
    if (officialOnly && !q.official) return false;
    if (categoryId !== undefined && categoryId !== null && q.category !== categoryId) return false;
    return true;
  });
}

export function getQuestions() {
  return questions;
}

export function getIndexes() {
  return indexes;
}

export function getTranslation(q, lang) {
  if (!q || !q.translations) return null;
  return q.translations[lang] || q.translations["de"] || null;
}

export function getQuestionText(q, lang) {
  const t = getTranslation(q, lang);
  if (!t) return "";
  return t.question || "";
}

export function getOptions(q, lang) {
  const t = getTranslation(q, lang);
  if (!t) return [];
  return t.options || [];
}

export function getExplanation(q, lang, paragraph) {
  const t = getTranslation(q, lang);
  if (!t || !t.explanations) return null;
  return t.explanations[paragraph] || null;
}
