// Cache for vulnerability data to reduce API calls
let vulnerabilityCache = {};

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVulnerabilities') {
    getVulnerabilities(request.packageName, request.version)
      .then(data => {
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error('Error fetching vulnerabilities:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async sendResponse
  }

  if (request.action === 'saveRecentPackage') {
    saveRecentPackage(request.packageName, request.version, request.score);
  }

  if (request.action === 'clearCache') {
    vulnerabilityCache = {};
  }
});

/**
 * Fetch vulnerabilities for a specific package and version
 * @param {string} packageName - The name of the npm package
 * @param {string} version - The version of the package
 * @returns {Promise<Object>} - Vulnerability data and security score
 */
async function getVulnerabilities(packageName, version) {
  const cacheKey = `${packageName}@${version}`;
  
  // Check cache first
  if (vulnerabilityCache[cacheKey]) {
    return vulnerabilityCache[cacheKey];
  }
  
  try {
    // Query OSV.dev API
    const response = await fetch('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        package: {
          name: packageName,
          ecosystem: 'npm'
        },
        version
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Process vulnerability data
    const result = processVulnerabilityData(data, packageName, version);
    
    // Cache the result
    vulnerabilityCache[cacheKey] = result;
    
    // Limit cache size
    const cacheKeys = Object.keys(vulnerabilityCache);
    if (cacheKeys.length > 50) {
      delete vulnerabilityCache[cacheKeys[0]];
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching vulnerabilities:', error);
    throw error;
  }
}

/**
 * Process vulnerability data and calculate security score
 * @param {Object} data - Raw vulnerability data from OSV.dev
 * @param {string} packageName - The name of the npm package
 * @param {string} version - The version of the package
 * @returns {Object} - Processed vulnerability data with security score
 */
function processVulnerabilityData(data, packageName, version) {
  const vulnerabilities = data.vulns || [];
  
  // Calculate severity metrics
  const criticalCount = vulnerabilities.filter(v => 
    v.severity && v.severity.some(s => s.type === 'CVSS_V3' && parseFloat(s.score) >= 9.0)
  ).length;
  
  const highCount = vulnerabilities.filter(v => 
    v.severity && v.severity.some(s => s.type === 'CVSS_V3' && parseFloat(s.score) >= 7.0 && parseFloat(s.score) < 9.0)
  ).length;
  
  const mediumCount = vulnerabilities.filter(v => 
    v.severity && v.severity.some(s => s.type === 'CVSS_V3' && parseFloat(s.score) >= 4.0 && parseFloat(s.score) < 7.0)
  ).length;
  
  const lowCount = vulnerabilities.filter(v => 
    v.severity && v.severity.some(s => s.type === 'CVSS_V3' && parseFloat(s.score) < 4.0)
  ).length;
  
  // Determine security score
  let securityScore;
  if (criticalCount > 0 || highCount > 1) {
    securityScore = 'bad';
  } else if (highCount === 1 || mediumCount > 2) {
    securityScore = 'moderate';
  } else if (mediumCount > 0 || lowCount > 0) {
    securityScore = 'good';
  } else {
    securityScore = 'best';
  }
  
  return {
    packageName,
    version,
    vulnerabilities,
    summary: {
      total: vulnerabilities.length,
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount
    },
    securityScore
  };
}

/**
 * Save a package to recent history
 * @param {string} packageName - The name of the npm package
 * @param {string} version - The version of the package
 * @param {string} score - Security score (bad, moderate, good, best)
 */
function saveRecentPackage(packageName, version, score) {
  chrome.storage.local.get(['recentPackages'], (result) => {
    let recentPackages = result.recentPackages || [];
    
    // Check if package already exists in recent list
    const existingIndex = recentPackages.findIndex(
      p => p.packageName === packageName && p.version === version
    );
    
    if (existingIndex !== -1) {
      // Remove existing entry
      recentPackages.splice(existingIndex, 1);
    }
    
    // Add new entry at the beginning
    recentPackages.unshift({
      packageName,
      version,
      score,
      timestamp: Date.now()
    });
    
    // Limit to 10 recent packages
    if (recentPackages.length > 10) {
      recentPackages = recentPackages.slice(0, 10);
    }
    
    chrome.storage.local.set({ recentPackages });
  });
}