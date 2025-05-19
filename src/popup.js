document.addEventListener("DOMContentLoaded", () => {
  const checkbox = document.getElementById("enableBadge");
  chrome.storage.local.get("enableBadge", data => {
    checkbox.checked = data.enableBadge !== false;
  });
  checkbox.addEventListener("change", () => {
    chrome.storage.local.set({ enableBadge: checkbox.checked });
  });
});
