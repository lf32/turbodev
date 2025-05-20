// Initialize the popup
document.addEventListener('DOMContentLoaded', init);

/**
 * Initialize the popup
 */
function init() {
  // Get current tab info
  getCurrentTabInfo();
  
  // Load recent packages
  loadRecentPackages();
  
  // Add event listeners
  document.getElementById('refresh-data').addEventListener('click', refreshData);
  document.getElementById('clear-recent').addEventListener('click', clearRecentPackages);
}

/**
 * Get information about the current tab
 */
function getCurrentTabInfo() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    
    if (currentTab.url.includes('npmjs.com/package/')) {
      // We're on an npm package page
      const packageInfo = document.getElementById('package-info');
      const vulnerabilityData = document.getElementById('vulnerability-data');
      
      // Extract package name from URL
      const urlPath = new URL(currentTab.url).pathname;
      const packagePath = urlPath.split('/package/')[1];
      let packageName = packagePath.split('/')[0];
      
      // Handle scoped packages
      if (packageName.startsWith('@')) {
        const scopedParts = packagePath.split('/');
        if (scopedParts.length >= 2) {
          packageName = `${scopedParts[0]}/${scopedParts[1]}`;
        }
      }
      
      // Get version from URL or default to latest
      let version = 'latest';
      if (urlPath.includes('/v/')) {
        version = urlPath.split('/v/')[1];
      }
      
      // Update package info
      packageInfo.innerHTML = `
        <div class="package-header">
          <h3>${packageName}</h3>
          <span class="version">${version}</span>
        </div>
      `;
      
      // Show loading state
      vulnerabilityData.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading vulnerability data...</p>
        </div>
      `;
      
      // Get vulnerability data
      fetchVulnerabilityData(packageName, version);
    } else {
      // Not on an npm package page
      const packageInfo = document.getElementById('package-info');
      packageInfo.innerHTML = `<p>Not viewing an npm package</p>`;
      
      const vulnerabilityData = document.getElementById('vulnerability-data');
      vulnerabilityData.innerHTML = `
        <div class="placeholder">
          <p>Visit an npm package page to see vulnerability data</p>
        </div>
      `;
    }
  });
}

/**
 * Fetch vulnerability data for a package
 * @param {string} packageName - Package name
 * @param {string} version - Package version
 */
function fetchVulnerabilityData(packageName, version) {
  chrome.runtime.sendMessage({
    action: 'getVulnerabilities',
    packageName,
    version
  }, response => {
    if (response && response.success) {
      displayVulnerabilityData(response.data);
      
      // Save to recent packages
      chrome.runtime.sendMessage({
        action: 'saveRecentPackage',
        packageName,
        version,
        score: response.data.securityScore
      });
    } else {
      const vulnerabilityData = document.getElementById('vulnerability-data');
      vulnerabilityData.innerHTML = `
        <div class="error">
          <p>Error loading vulnerability data</p>
          <p class="error-details">${response?.error || 'Unknown error'}</p>
        </div>
      `;
    }
  });
}

/**
 * Display vulnerability data in the popup
 * @param {Object} data - Vulnerability data
 */
function displayVulnerabilityData(data) {
  const vulnerabilityData = document.getElementById('vulnerability-data');
  
  if (data.summary.total === 0) {
    vulnerabilityData.innerHTML = `
      <div class="security-score score-${data.securityScore}">
        <div class="score-label">Security Score</div>
        <div class="score-value">${getScoreText(data.securityScore)}</div>
      </div>
      <div class="no-vulnerabilities">
        <p>No known vulnerabilities</p>
      </div>
    `;
  } else {
    let vulnHtml = `
      <div class="security-score score-${data.securityScore}">
        <div class="score-label">Security Score</div>
        <div class="score-value">${getScoreText(data.securityScore)}</div>
      </div>
      <div class="vulnerability-summary">
        <p>${data.summary.total} vulnerabilities found</p>
        <ul class="severity-list">
    `;
    
    if (data.summary.critical > 0) {
      vulnHtml += `<li class="severity critical">${data.summary.critical} critical</li>`;
    }
    if (data.summary.high > 0) {
      vulnHtml += `<li class="severity high">${data.summary.high} high</li>`;
    }
    if (data.summary.medium > 0) {
      vulnHtml += `<li class="severity medium">${data.summary.medium} medium</li>`;
    }
    if (data.summary.low > 0) {
      vulnHtml += `<li class="severity low">${data.summary.low} low</li>`;
    }
    
    vulnHtml += `
        </ul>
      </div>
      <div class="vulnerability-list">
        <h4>Details:</h4>
        <ul>
    `;
    
    data.vulnerabilities.forEach(vuln => {
      let severity = 'Unknown';
      let severityClass = 'unknown';
      
      if (vuln.severity && vuln.severity.length > 0) {
        const cvss = vuln.severity.find(s => s.type === 'CVSS_V3');
        if (cvss) {
          const score = parseFloat(cvss.score);
          if (score >= 9.0) {
            severity = `Critical (${cvss.score})`;
            severityClass = 'critical';
          } else if (score >= 7.0) {
            severity = `High (${cvss.score})`;
            severityClass = 'high';
          } else if (score >= 4.0) {
            severity = `Medium (${cvss.score})`;
            severityClass = 'medium';
          } else {
            severity = `Low (${cvss.score})`;
            severityClass = 'low';
          }
        }
      }
      
      vulnHtml += `
        <li class="vulnerability-item">
          <div class="vulnerability-header">
            <span class="vulnerability-id">${vuln.id || 'Unknown'}</span>
            <span class="vulnerability-severity ${severityClass}">${severity}</span>
          </div>
          <div class="vulnerability-summary">${vuln.summary || 'No description available'}</div>
          ${vuln.references && vuln.references.length > 0 ? 
            `<a href="${vuln.references[0].url}" target="_blank" rel="noopener noreferrer" class="vulnerability-link">More details</a>` :
            ''}
        </li>
      `;
    });
    
    vulnHtml += `
        </ul>
      </div>
    `;
    
    vulnerabilityData.innerHTML = vulnHtml;
  }
}

/**
 * Load recent packages from storage
 */
function loadRecentPackages() {
  chrome.storage.local.get(['recentPackages'], (result) => {
    const recentPackages = result.recentPackages || [];
    const recentList = document.getElementById('recent-list');
    
    if (recentPackages.length === 0) {
      recentList.innerHTML = '<li class="empty-list">No recent packages</li>';
      return;
    }
    
    let listHtml = '';
    recentPackages.forEach(pkg => {
      listHtml += `
        <li class="recent-item">
          <div class="recent-package-info">
            <span class="recent-package-name">${pkg.packageName}</span>
            <span class="recent-package-version">${pkg.version}</span>
          </div>
          <span class="recent-package-score score-${pkg.score}">${getScoreText(pkg.score)}</span>
        </li>
      `;
    });
    
    recentList.innerHTML = listHtml;
  });
}

/**
 * Refresh current package data
 */
function refreshData() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab.url.includes('npmjs.com/package/')) {
      // Clear cache in background script
      chrome.runtime.sendMessage({ action: 'clearCache' });
      // Refresh data
      getCurrentTabInfo();
    }
  });
}

/**
 * Clear recent packages list
 */
function clearRecentPackages() {
  chrome.storage.local.set({ recentPackages: [] }, () => {
    loadRecentPackages();
  });
}

/**
 * Get human-readable score text
 * @param {string} score - Security score
 * @returns {string} - Human-readable score
 */
function getScoreText(score) {
  switch (score) {
    case 'best': return 'Excellent';
    case 'good': return 'Good';
    case 'moderate': return 'Moderate';
    case 'bad': return 'Poor';
    default: return 'Unknown';
  }
}