export function getLanguageName(code) {
  const names = { de: "Deutsch", fr: "Français", it: "Italiano" };
  return names[code] || code;
}

export function getTypeLabel(type) {
  return type === "image" ? "Image" : "Text";
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

export function formatNumber(n) {
  return n.toLocaleString();
}

export function getCategoryLabel(catId) {
  const labels = {
    1: "Vehicle Equipment / Law",
    2: "Traffic Signs",
    3: "Traffic Signals / Behavior",
    4: "Overtaking / Turning",
    5: "Highway / Expressway",
    6: "Right of Way / Priority",
    7: "Parking",
    8: "Distances / Speed",
    9: "Vehicle Control / Situations",
    10: "Special Situations / Vulnerable Users",
    11: "Visibility / Lights",
    12: "Emergency / Accidents / Insurance",
  };
  return labels[catId] || `Category ${catId}`;
}

export function getCategoryColor(catId) {
  const colors = {
    1: "#e3f2fd",
    2: "#fce4ec",
    3: "#f3e5f5",
    4: "#e8f5e9",
    5: "#fff3e0",
    6: "#f5f5f5",
    7: "#e0f7fa",
    8: "#e8eaf6",
    9: "#fbe9e7",
    10: "#ffebee",
    11: "#e8f5e9",
    12: "#f5f5f5",
  };
  return colors[catId] || "#f5f5f5";
}
