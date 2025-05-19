async function fetchPackageData(packageName) {
  const response = await fetch(`https://registry.npmjs.org/${packageName}`);
  return response.json();
}

async function fetchVulnerabilities(packageName, version) {
  const response = await fetch("https://api.osv.dev/v1/query", {
    method: "POST",
    body: JSON.stringify({ package: { name: packageName, ecosystem: "npm" }, version })
  });
  return response.json();
}

function displayBadge(score, details) {
  const badge = document.createElement("div");
  badge.innerHTML = `Turbo Score: ${score}/100<br>${details}`;
  badge.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #fff;
    padding: 10px;
    border: 1px solid #333;
    z-index: 1000;
    font-family: Arial, sans-serif;
  `;
  document.body.appendChild(badge);
}

// Extract package name from URL (e.g., npmjs.com/package/express)
const packageName = window.location.pathname.split("/")[2];
if (packageName) {
  fetchPackageData(packageName).then(async data => {
    const latestVersion = data["dist-tags"].latest;
    const vulnData = await fetchVulnerabilities(packageName, latestVersion);
    const score = calculateScore(data, vulnData); // Implement scoring
    const details = vulnData.vulns?.length
      ? `⚠️ ${vulnData.vulns.length} vulnerabilities found`
      : "No known vulnerabilities";
    displayBadge(score, details);
  });
}

function calculateScore(packageData, vulnData) {
  let score = 100;
  if (vulnData.vulns?.length) score -= 10 * vulnData.vulns.length;
  const lastCommit = new Date(packageData.time?.modified);
  if (Date.now() - lastCommit > 6 * 30 * 24 * 60 * 60 * 1000) score -= 20; // Older than 6 months
  return Math.max(0, score);
}
