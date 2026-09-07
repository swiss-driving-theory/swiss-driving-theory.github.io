import { loadData, filterQuestions, getOfficialQuestions } from "./data.js";
import { getSavedLanguage, setSavedLanguage, populateLanguageSelect, populateOfficialToggle, populateCategorySelect } from "./filters.js";
import { initQuiz, resetQuiz } from "./quiz.js";
import { initBrowse, applyBrowseFilters, resetFilters } from "./browse.js";
import { initExam } from "./exam.js";
import { initCoaching } from "./coaching.js";
import { getPageTitle, t, getCategoryLabel } from "./i18n.js";

let deferredInstallPrompt = null;

function initPWA() {
  const installBtns = document.querySelectorAll(".js-install-btn");
  const show = () => installBtns.forEach((b) => b.classList.remove("hidden"));
  const hide = () => installBtns.forEach((b) => b.classList.add("hidden"));

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    show();
  });

  installBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      hide();
    });
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    hide();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./service-worker.js")
        .then((reg) => {
          if (reg.waiting) reg.waiting && console.log("ServiceWorker waiting");
          if (reg.installing) console.log("ServiceWorker installing");
        })
        .catch((err) => console.error("ServiceWorker registration failed:", err));
    });
  }
}

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
      <div class="container error-container">
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
      syncDrawerLangSelect(newLang);
      if (currentPage === "quiz") {
        window._quiz?.setLanguage(newLang);
      } else if (currentPage === "training") {
        window._quiz?.setLanguage(newLang);
        window._coaching?.setLanguage(newLang);
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

  const drawerLangSelect = document.getElementById("drawer-lang-select");
  if (drawerLangSelect) {
    populateLanguageSelect(drawerLangSelect, (newLang) => {
      setSavedLanguage(newLang);
      document.documentElement.lang = newLang;
      document.title = getPageTitle(currentPage, newLang);
      applyI18n(newLang);
      const mainLangSelect = document.getElementById("lang-select");
      if (mainLangSelect) mainLangSelect.value = newLang;
      if (currentPage === "quiz") {
        window._quiz?.setLanguage(newLang);
      } else if (currentPage === "training") {
        window._quiz?.setLanguage(newLang);
        window._coaching?.setLanguage(newLang);
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

  document.querySelectorAll(".drawer .nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => closeDrawer());
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  if (currentPage === "quiz") initQuizPage();
  else if (currentPage === "browse") initBrowsePage();
  else if (currentPage === "training") initTrainingPage();
  else if (currentPage === "exam") initExamPage();
  else initHomePage();

  initPWA();
  bindGlobalHandlers();
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
        <p class="error-hint">${t("tryAdjustingFilters", lang)}</p>
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
  initCoachingPage();
  initBrowsePage();
}

function initCoachingPage() {
  if (window._coaching) {
    window._coaching.initCoaching();
  }
}

function initExamPage() {
  initExam();
}

export function switchTab(tab) {
  const tabs = document.querySelectorAll(".mode-tab");
  const views = document.querySelectorAll(".training-view");
  tabs.forEach((t) => {
    t.classList.remove("active");
    t.setAttribute("aria-selected", "false");
  });
  views.forEach((v) => {
    v.classList.remove("active");
    v.removeAttribute("hidden");
  });

  const targetTab = document.querySelector(`.mode-tab[data-tab="${tab}"]`);
  const targetView = document.getElementById(`${tab}-view`);
  targetTab?.classList.add("active");
  targetTab?.setAttribute("aria-selected", "true");
  if (!targetView) return;
  targetView.classList.add("active");
  targetView.removeAttribute("hidden");

  if (tab === "coaching" && window._coaching) {
    window._coaching.initCoaching();
  } else if (tab === "browse") {
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

function bindGlobalHandlers() {
  const hamburger = document.querySelector(".hamburger");
  const drawer = document.getElementById("drawer");
  if (hamburger) {
    hamburger.setAttribute("aria-controls", "drawer");
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.addEventListener("click", () => toggleDrawer());
  }
  if (drawer) {
    drawer.setAttribute("aria-hidden", "true");
  }
  document.querySelectorAll("[data-action='close-drawer']").forEach((el) => {
    el.addEventListener("click", () => closeDrawer());
  });
  const drawerOverlay = document.getElementById("drawer-overlay");
  if (drawerOverlay) {
    drawerOverlay.addEventListener("click", (e) => {
      if (e.target === drawerOverlay) closeDrawer();
    });
  }
  document.querySelectorAll("[data-action='close-modal']").forEach((el) => {
    el.addEventListener("click", () => closeDetail());
  });
  document.querySelectorAll(".mode-tab").forEach((tab, i) => {
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", tab.classList.contains("active") ? "true" : "false");
    tab.setAttribute("aria-controls", ["quiz-view", "coaching-view", "browse-view"][i] || "");
    tab.addEventListener("click", () => {
      const key = tab.dataset.tab || (i === 0 ? "quiz" : i === 1 ? "coaching" : "browse");
      switchTab(key);
    });
  });
  document.querySelectorAll(".training-view").forEach((v) => v.setAttribute("role", "tabpanel"));
  document.querySelectorAll("[data-action='switch-tab']").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      switchTab(el.dataset.tab);
    });
  });
  document.querySelectorAll("[data-action='apply-quiz-filters']").forEach((el) => {
    el.addEventListener("change", () => applyQuizFilters());
  });

  const finishExamBtn = document.getElementById("finish-exam-btn");
  if (finishExamBtn) {
    finishExamBtn.addEventListener("click", () => window._exam?.finishExam());
  }
  const restartQuizBtn = document.getElementById("restart-quiz-btn");
  if (restartQuizBtn) {
    restartQuizBtn.addEventListener("click", () => window._quiz?.resetQuiz());
  }
  const coachingClose = document.querySelector("[data-action='close-coaching-modal']");
  if (coachingClose) {
    coachingClose.addEventListener("click", () => window._coaching?.closeBoxModal());
  }
  const browseOverlay = document.getElementById("browse-modal-overlay");
  if (browseOverlay) {
    browseOverlay.addEventListener("click", (e) => {
      if (e.target === browseOverlay) closeDetail();
    });
  }
  const coachingOverlay = document.getElementById("coaching-modal-overlay");
  if (coachingOverlay) {
    coachingOverlay.addEventListener("click", (e) => {
      if (e.target === coachingOverlay) window._coaching?.closeBoxModal();
    });
  }
}

export function toggleDrawer() {
  const overlay = document.getElementById("drawer-overlay");
  const drawer = document.getElementById("drawer");
  const hamburger = document.querySelector(".hamburger");
  if (!overlay) return;
  const isOpen = overlay.classList.contains("open");
  if (isOpen) {
    closeDrawer();
  } else {
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    hamburger?.classList.add("open");
    hamburger?.setAttribute("aria-expanded", "true");
    drawer?.setAttribute("aria-hidden", "false");
  }
}

export function closeDrawer() {
  const overlay = document.getElementById("drawer-overlay");
  const drawer = document.getElementById("drawer");
  const hamburger = document.querySelector(".hamburger");
  if (overlay) {
    overlay.classList.remove("open");
    document.body.style.overflow = "";
    hamburger?.classList.remove("open");
    hamburger?.setAttribute("aria-expanded", "false");
    drawer?.setAttribute("aria-hidden", "true");
  }
}

function syncDrawerLangSelect(lang) {
  const drawerLangSelect = document.getElementById("drawer-lang-select");
  if (drawerLangSelect) drawerLangSelect.value = lang;
}

window._app = { switchTab, closeDetail, toggleDrawer, closeDrawer };
window._applyQuizFilters = applyQuizFilters;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export { allQuestions, meta };
