import { loadData, filterQuestions, getOfficialQuestions } from "./data.js";
import { getSavedLanguage, setSavedLanguage, populateLanguageSelect, populateOfficialToggle, populateCategorySelect } from "./filters.js";
import { initQuiz, resetQuiz } from "./quiz.js";
import { initBrowse, applyBrowseFilters, resetFilters } from "./browse.js";
import { initExam } from "./exam.js";
import { getPageTitle, t, getCategoryLabel } from "./i18n.js";

let allQuestions = [];
let meta = null;
let currentPage = "home";

function applyI18n(lang) {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key.startsWith("category-")) {
      const catId = Number(key.slice("category-".length));
      if (!Number.isNaN(catId)) {
        el.textContent = getCategoryLabel(catId, lang);
        return;
      }
    }
    const translation = t(key, lang);
    if (el.tagName === "OPTION") {
      el.textContent = translation;
    } else {
      el.innerHTML = translation;
    }
  });
}

async function init() {
  try {
    const result = await loadData();
    allQuestions = result.questions;
    meta = result.meta;
  } catch (e) {
    console.error("Failed to load data:", e);
    const lang = getSavedLanguage();
    document.body.innerHTML = `
      <div class="container" style="padding:40px;">
        <h1>${t("errorLoadingData", lang)}</h1>
        <p>${e.message}</p>
        <p class="error-hint">${t("errorHint", lang)}</p>
      </div>
    `;
    return;
  }

  const lang = getSavedLanguage();
  document.documentElement.lang = lang;
  currentPage = document.body.dataset.page;
  document.title = getPageTitle(currentPage, lang);

  applyI18n(lang);

  const langSelect = document.getElementById("lang-select");
  if (langSelect) {
    populateLanguageSelect(langSelect, (newLang) => {
      setSavedLanguage(newLang);
      document.documentElement.lang = newLang;
      document.title = getPageTitle(currentPage, newLang);
      applyI18n(newLang);
      if (currentPage === "quiz") {
        window._quiz?.setLanguage(newLang);
      } else if (currentPage === "training") {
        window._quiz?.setLanguage(newLang);
        window._browse?.setLanguage(newLang);
        window._browse?.applyBrowseFilters();
      } else if (currentPage === "exam") {
        window._exam?.setLanguage(newLang);
      } else if (currentPage === "browse") {
        window._browse?.setLanguage(newLang);
        window._browse?.applyBrowseFilters();
      }
    }, lang);
  }

  if (currentPage === "quiz") initQuizPage();
  else if (currentPage === "browse") initBrowsePage();
  else if (currentPage === "training") initTrainingPage();
  else if (currentPage === "exam") initExamPage();
  else initHomePage();
}

function initHomePage() {
  const lang = getSavedLanguage();
  document.getElementById("total-questions").textContent = allQuestions.length.toLocaleString();
  document.getElementById("official-count").textContent = allQuestions.filter((q) => q.official).length.toLocaleString();
}

function initQuizPage() {
  const lang = getSavedLanguage();
  const officialOnly = document.getElementById("quiz-official");
  populateOfficialToggle(officialOnly, () => {
    applyQuizFilters();
  });

  const categorySelect = document.getElementById("quiz-category");
  populateCategorySelect(categorySelect, () => {
    applyQuizFilters();
  }, lang);

  applyQuizFilters();
}

export function applyQuizFilters() {
  const officialOnly = document.getElementById("quiz-official")?.checked || false;
  const categoryVal = document.getElementById("quiz-category")?.value;
  const categoryId = categoryVal === "all" ? null : Number(categoryVal);
  const filtered = filterQuestions({ officialOnly, categoryId });

  if (filtered.length === 0) {
    const lang = getSavedLanguage();
    document.getElementById("quiz-container").innerHTML = `
      <div class="quiz-container text-center">
        <h3>${t("noQuestionsMatch", lang)}</h3>
        <p style="color:var(--text-muted);">${t("tryAdjustingFilters", lang)}</p>
      </div>
    `;
    return;
  }

  initQuiz(filtered);
}

function initBrowsePage() {
  const filtered = filterQuestions({});
  initBrowse(filtered);

  const lang = getSavedLanguage();
  const browseLang = document.getElementById("browse-lang");
  if (browseLang) {
    populateLanguageSelect(browseLang, (newLang) => {
      setSavedLanguage(newLang);
      applyBrowseFilters();
    }, lang);
  }

  const searchInput = document.getElementById("browse-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const officialOnly = document.getElementById("filter-official")?.checked || false;
      const categoryVal = document.getElementById("filter-category")?.value;
      const categoryId = categoryVal === "all" ? null : Number(categoryVal);
      applyBrowseFilters({ officialOnly, categoryId, search: e.target.value });
    });
  }
}

function initTrainingPage() {
  initQuizPage();
  initBrowsePage();
}

function initExamPage() {
  initExam();
}

export function switchTab(tab) {
  document.querySelectorAll(".mode-tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".training-view").forEach((v) => v.classList.remove("active"));

  if (tab === "quiz") {
    document.querySelector('.mode-tab:first-child').classList.add("active");
    document.getElementById("quiz-view").classList.add("active");
  } else {
    document.querySelector('.mode-tab:last-child').classList.add("active");
    document.getElementById("browse-view").classList.add("active");
    const questionGrid = document.getElementById("question-grid");
    if (questionGrid && questionGrid.children.length === 0 && allQuestions.length > 0) {
      applyBrowseFilters();
    }
  }
}

export function closeDetail() {
  const overlay = document.getElementById("browse-modal-overlay");
  if (overlay) overlay.classList.remove("open");
  document.body.style.overflow = "";
  if (window._browse) window._browse.closeDetail();
}

export function closeModalOutside(event) {
  if (event.target === document.getElementById("browse-modal-overlay")) {
    closeDetail();
  }
}

window._app = { switchTab, closeDetail, closeModalOutside };
window._applyQuizFilters = applyQuizFilters;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export { allQuestions, meta };
