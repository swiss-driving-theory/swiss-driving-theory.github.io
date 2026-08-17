import { getAllCategories } from "./data.js";
import { getCategoryLabel, getLanguageName } from "./utils.js";

const LANGUAGE_KEY = "cut-exam-lang";
const OFFICIAL_KEY = "cut-exam-official";
const CATEGORY_KEY = "cut-exam-category";

export function getSavedLanguage() {
  return localStorage.getItem(LANGUAGE_KEY) || "de";
}

export function setSavedLanguage(lang) {
  localStorage.setItem(LANGUAGE_KEY, lang);
}

export function getSavedOfficialOnly() {
  return localStorage.getItem(OFFICIAL_KEY) === "true";
}

export function setSavedOfficialOnly(val) {
  localStorage.setItem(OFFICIAL_KEY, String(val));
}

export function getSavedCategory() {
  const v = localStorage.getItem(CATEGORY_KEY);
  return v === "all" ? null : v ? Number(v) : null;
}

export function setSavedCategory(val) {
  if (val === null || val === "all") localStorage.setItem(CATEGORY_KEY, "all");
  else localStorage.setItem(CATEGORY_KEY, String(val));
}

export function populateLanguageSelect(selectEl, onChange) {
  const langs = [
    { code: "de", name: "Deutsch" },
    { code: "fr", name: "Français" },
    { code: "it", name: "Italiano" },
  ];
  selectEl.innerHTML = langs
    .map(
      (l) =>
        `<option value="${l.code}">${getLanguageName(l.code)}</option>`
    )
    .join("");
  selectEl.value = getSavedLanguage();
  selectEl.addEventListener("change", (e) => {
    setSavedLanguage(e.target.value);
    if (onChange) onChange(e.target.value);
  });
}

export function populateOfficialToggle(checkboxEl, onChange) {
  checkboxEl.checked = getSavedOfficialOnly();
  checkboxEl.addEventListener("change", (e) => {
    setSavedOfficialOnly(e.target.checked);
    if (onChange) onChange(e.target.checked);
  });
}

export function populateCategorySelect(selectEl, onChange) {
  const cats = getAllCategories();
  const options = [
    `<option value="all">All categories</option>`,
    ...cats.map(
      (c) =>
        `<option value="${c}">${getCategoryLabel(c)}</option>`
    ),
  ].join("");
  selectEl.innerHTML = options;
  const saved = getSavedCategory();
  if (saved !== null && cats.includes(saved)) selectEl.value = String(saved);
  else selectEl.value = "all";

  selectEl.addEventListener("change", (e) => {
    const val = e.target.value === "all" ? null : Number(e.target.value);
    setSavedCategory(val);
    if (onChange) onChange(val);
  });
}
