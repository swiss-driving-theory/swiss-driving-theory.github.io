const STORAGE_KEY = "swiss-driving-theory-progress";

export function getProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { correct: 0, total: 0 };
  } catch {
    return { correct: 0, total: 0 };
  }
}

export function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function recordAnswer(isCorrect) {
  const p = getProgress();
  p.total += 1;
  if (isCorrect) p.correct += 1;
  saveProgress(p);
  return p;
}

export function resetProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ correct: 0, total: 0 }));
}

export function getSessionState(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSessionState(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

export function clearSessionState(key) {
  sessionStorage.removeItem(key);
}
