chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchVulnerabilities") {
    fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      body: JSON.stringify({ package: { name: request.packageName, ecosystem: "npm" }, version: request.version })
    })
      .then(res => res.json())
      .then(data => sendResponse(data))
      .catch(err => sendResponse({ error: err.message }));
    return true; // Keep channel open for async
  }
});
