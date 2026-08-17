import { loadData, filterQuestions } from "./data.js";
import { getSavedLanguage, setSavedLanguage, populateLanguageSelect, populateOfficialToggle, populateCategorySelect } from "./filters.js";
import { initQuiz, resetQuiz } from "./quiz.js";
import { initBrowse, browseFilter, resetFilters } from "./browse.js";

let allQuestions = [];
let meta = null;

async function init() {
  try {
    const result = await loadData();
    allQuestions = result.questions;
    meta = result.meta;
  } catch (e) {
    console.error("Failed to load data:", e);
    document.body.innerHTML = `<div class="container" style="padding:40px;"><h1>Error loading quiz data</h1><p>${e.message}</p></div>`;
    return;
  }

  const page = document.body.dataset.page;
  if (page === "quiz") initQuizPage();
  else if (page === "browse") initBrowsePage();
  else initHomePage();
}

function initHomePage() {
  document.getElementById("total-questions").textContent = allQuestions.length.toLocaleString();
  document.getElementById("official-count").textContent = allQuestions.filter((q) => q.official).length.toLocaleString();

  populateLanguageSelect(document.getElementById("home-lang"), (lang) => {
    setSavedLanguage(lang);
  });
}

function initQuizPage() {
  const lang = getSavedLanguage();
  populateLanguageSelect(document.getElementById("quiz-lang"), (l) => {
    setSavedLanguage(l);
    window._quiz.setLanguage(l);
  });

  const officialOnly = document.getElementById("quiz-official");
  populateOfficialToggle(officialOnly, () => {
    applyQuizFilters();
  });

  const categorySelect = document.getElementById("quiz-category");
  populateCategorySelect(categorySelect, () => {
    applyQuizFilters();
  });

  applyQuizFilters();
}

function applyQuizFilters() {
  const officialOnly = document.getElementById("quiz-official")?.checked || false;
  const categoryVal = document.getElementById("quiz-category")?.value;
  const categoryId = categoryVal === "all" ? null : Number(categoryVal);
  const filtered = filterQuestions({ officialOnly, categoryId });

  if (filtered.length === 0) {
    document.getElementById("quiz-container").innerHTML = `
      <div class="quiz-container text-center">
        <h3>No questions match your filters</h3>
        <p style="color:var(--text-muted);">Try adjusting the filters above.</p>
      </div>
    `;
    return;
  }

  initQuiz(filtered);
}

function initBrowsePage() {
  const filtered = filterQuestions({});
  initBrowse(filtered);

  populateLanguageSelect(document.getElementById("browse-lang"), (lang) => {
    setSavedLanguage(lang);
    browseFilter({});
  });

  const searchInput = document.getElementById("browse-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const officialOnly = document.getElementById("filter-official")?.checked || false;
      const categoryVal = document.getElementById("filter-category")?.value;
      const categoryId = categoryVal === "all" ? null : Number(categoryVal);
      browseFilter({ officialOnly, categoryId, search: e.target.value });
    });
  }
}

document.addEventListener("DOMContentLoaded", init);

export { allQuestions, meta };
