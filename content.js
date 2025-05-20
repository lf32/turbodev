// State variables
let currentPackage = null;
let observer = null;
let securityBadges = {};

// Initialize when the page is loaded
init();

/**
 * Initialize the content script
 */
function init() {
  // Start observing the page for changes
  setupObserver();
  
  // Initial check for package page
  checkForPackagePage();
}

/**
 * Set up MutationObserver to watch for page changes
 */
function setupObserver() {
  // Disconnect existing observer if it exists
  if (observer) {
    observer.disconnect();
  }
  
  // Create new observer
  observer = new MutationObserver((mutations) => {
    // Check if URL has changed (SPA navigation)
    if (window.location.href !== currentPackage?.url) {
      checkForPackagePage();
    }
    
    // Look for version elements that might have been added
    const versionElements = document.querySelectorAll('.version-list li a, table.nx-table tbody tr td:nth-child(1)');
    if (versionElements.length > 0) {
      processVersionElements(versionElements);
    }
  });
  
  // Start observing
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
}

/**
 * Check if we're on a package page and extract info
 */
function checkForPackagePage() {
  // Update current URL
  const currentUrl = window.location.href;
  
  // Check if we're on a package page
  if (currentUrl.includes('npmjs.com/package/')) {
    // Extract package name from URL or page
    const urlPath = window.location.pathname;
    const packagePath = urlPath.split('/package/')[1];
    let packageName = packagePath.split('/')[0];
    
    // Handle scoped packages
    if (packageName.startsWith('@')) {
      const scopedParts = packagePath.split('/');
      if (scopedParts.length >= 2) {
        packageName = `${scopedParts[0]}/${scopedParts[1]}`;
      }
    }
    
    // Find current version
    let version = 'latest';
    
    // Check if a specific version is in the URL
    if (urlPath.includes('/v/')) {
      version = urlPath.split('/v/')[1];
    } else {
      // Try to get version from the page
      const versionElement = document.querySelector('span.f2874b88');
      if (versionElement) {
        version = versionElement.textContent.trim();
      }
    }
    
    // Update current package info
    currentPackage = {
      name: packageName,
      version,
      url: currentUrl
    };
    
    // Check for vulnerabilities
    getPackageVulnerabilities(packageName, version);
    
    // Process version elements
    const versionElements = document.querySelectorAll('.version-list li a, table.nx-table tbody tr td:nth-child(1)');
    if (versionElements.length > 0) {
      processVersionElements(versionElements);
    }
    
    // Add security info container if it doesn't exist
    if (!document.getElementById('turbodev-security-info')) {
      addSecurityInfoContainer();
    }
  } else {
    currentPackage = null;
  }
}

/**
 * Process version elements to add security indicators
 * @param {NodeList} elements - Version elements to process
 */
function processVersionElements(elements) {
  elements.forEach(element => {
    const version = element.textContent.trim();
    
    // Skip if we've already processed this element
    if (element.dataset.turbodevProcessed) {
      return;
    }
    
    // Mark as processed
    element.dataset.turbodevProcessed = 'true';
    
    // Skip elements that don't look like versions
    if (!version.match(/^\d+\.\d+\.\d+(-.*)?$/)) {
      return;
    }
    
    // Get vulnerabilities for this version
    if (currentPackage) {
      getPackageVulnerabilities(currentPackage.name, version)
        .then(data => {
          // Add security badge
          addSecurityBadge(element, data.securityScore, version);
        })
        .catch(error => {
          console.error(`Error processing version ${version}:`, error);
        });
    }
  });
}

/**
 * Get vulnerability information for a package
 * @param {string} packageName - The package name
 * @param {string} version - The package version
 * @returns {Promise<Object>} - Vulnerability data
 */
function getPackageVulnerabilities(packageName, version) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'getVulnerabilities',
      packageName,
      version
    }, response => {
      if (response && response.success) {
        // Save to recent packages
        chrome.runtime.sendMessage({
          action: 'saveRecentPackage',
          packageName,
          version,
          score: response.data.securityScore
        });
        
        // Update UI
        updateSecurityInfo(response.data);
        
        resolve(response.data);
      } else {
        reject(response?.error || 'Unknown error');
      }
    });
  });
}

/**
 * Add security info container to the page
 */
function addSecurityInfoContainer() {
  const sidebar = document.querySelector('div[class^="_9ba9a726"]');
  if (!sidebar) return;
  
  const container = document.createElement('div');
  container.id = 'turbodev-security-info';
  container.className = 'turbodev-container';
  container.innerHTML = `
    <h3>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;">
        <path d="M12 3C7.03 3 3 7.03 3 12H0L4 16L8 12H5C5 8.13 8.13 5 12 5C15.87 5 19 8.13 19 12C19 15.87 15.87 19 12 19C10.07 19 8.32 18.21 7.06 16.94L5.64 18.36C7.27 19.99 9.51 21 12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3Z" fill="currentColor"/>
      </svg>
      TurboDev Security
    </h3>
    <div class="turbodev-content">
      <div class="turbodev-loading">
        <div class="turbodev-spinner"></div>
        <p>Checking for vulnerabilities...</p>
      </div>
      <div class="turbodev-data" style="display: none">
        <div class="turbodev-score-container">
          <span class="turbodev-score-label">Security Score:</span>
          <span class="turbodev-score"></span>
        </div>
        <div class="turbodev-summary">
          <div class="turbodev-vuln-count"></div>
          <div class="turbodev-severity-breakdown"></div>
        </div>
        <div class="turbodev-details">
          <div class="turbodev-vuln-list"></div>
        </div>
      </div>
    </div>
  `;
  
  sidebar.prepend(container);
}

/**
 * Update security info in the UI
 * @param {Object} data - Vulnerability data
 */
function updateSecurityInfo(data) {
  const container = document.getElementById('turbodev-security-info');
  if (!container) return;
  
  const loadingEl = container.querySelector('.turbodev-loading');
  const dataEl = container.querySelector('.turbodev-data');
  const scoreEl = container.querySelector('.turbodev-score');
  const vulnCountEl = container.querySelector('.turbodev-vuln-count');
  const severityBreakdownEl = container.querySelector('.turbodev-severity-breakdown');
  const vulnListEl = container.querySelector('.turbodev-vuln-list');
  
  // Hide loading, show data
  loadingEl.style.display = 'none';
  dataEl.style.display = 'block';
  
  // Update score
  scoreEl.textContent = getScoreText(data.securityScore);
  scoreEl.className = 'turbodev-score turbodev-score-' + data.securityScore;
  
  // Update vulnerability count
  if (data.summary.total === 0) {
    vulnCountEl.innerHTML = '<p>No known vulnerabilities</p>';
  } else {
    vulnCountEl.innerHTML = `<p>${data.summary.total} vulnerabilities found</p>`;
    
    // Show severity breakdown
    let breakdownHtml = '<ul class="turbodev-severity-list">';
    if (data.summary.critical > 0) {
      breakdownHtml += `<li class="turbodev-critical">${data.summary.critical} critical</li>`;
    }
    if (data.summary.high > 0) {
      breakdownHtml += `<li class="turbodev-high">${data.summary.high} high</li>`;
    }
    if (data.summary.medium > 0) {
      breakdownHtml += `<li class="turbodev-medium">${data.summary.medium} medium</li>`;
    }
    if (data.summary.low > 0) {
      breakdownHtml += `<li class="turbodev-low">${data.summary.low} low</li>`;
    }
    breakdownHtml += '</ul>';
    severityBreakdownEl.innerHTML = breakdownHtml;
    
    // Show vulnerability details
    let vulnHtml = '<ul class="turbodev-vuln-details">';
    data.vulnerabilities.slice(0, 3).forEach(vuln => {
      let severity = 'Unknown';
      let severityClass = 'turbodev-unknown';
      
      if (vuln.severity && vuln.severity.length > 0) {
        const cvss = vuln.severity.find(s => s.type === 'CVSS_V3');
        if (cvss) {
          const score = parseFloat(cvss.score);
          if (score >= 9.0) {
            severity = `Critical (${cvss.score})`;
            severityClass = 'turbodev-critical';
          } else if (score >= 7.0) {
            severity = `High (${cvss.score})`;
            severityClass = 'turbodev-high';
          } else if (score >= 4.0) {
            severity = `Medium (${cvss.score})`;
            severityClass = 'turbodev-medium';
          } else {
            severity = `Low (${cvss.score})`;
            severityClass = 'turbodev-low';
          }
        }
      }
      
      vulnHtml += `
        <li>
          <div class="turbodev-vuln-title">
            <span class="turbodev-severity ${severityClass}">${severity}</span>
            <a href="${vuln.references?.[0]?.url || '#'}" target="_blank" rel="noopener noreferrer">
              ${vuln.id || 'Unknown vulnerability'}
            </a>
          </div>
          <div class="turbodev-vuln-summary">
            ${vuln.summary || 'No description available'}
          </div>
        </li>
      `;
    });
    
    if (data.vulnerabilities.length > 3) {
      vulnHtml += `<li class="turbodev-more-vulns">+ ${data.vulnerabilities.length - 3} more vulnerabilities</li>`;
    }
    
    vulnHtml += '</ul>';
    vulnListEl.innerHTML = vulnHtml;
  }
}

/**
 * Add security badge to version element
 * @param {Element} element - The element to add the badge to
 * @param {string} score - Security score
 * @param {string} version - Package version
 */
function addSecurityBadge(element, score, version) {
  // Check if we already added a badge for this version
  if (securityBadges[version]) {
    return;
  }
  
  const badge = document.createElement('span');
  badge.className = `turbodev-badge turbodev-badge-${score}`;
  badge.textContent = getScoreBadgeText(score);
  badge.title = `Security: ${getScoreText(score)}`;
  
  // Add badge to element
  element.appendChild(badge);
  
  // Remember that we added a badge for this version
  securityBadges[version] = true;
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

/**
 * Get short badge text for score
 * @param {string} score - Security score
 * @returns {string} - Badge text
 */
function getScoreBadgeText(score) {
  switch (score) {
    case 'best': return '✓ Safe';
    case 'good': return '✓ Good';
    case 'moderate': return '⚠ Moderate';
    case 'bad': return '✗ Vulnerable';
    default: return '? Unknown';
  }
}