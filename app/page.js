'use client';

import { useState } from 'react';

// Helper function to get CM vendor-specific CSS class
function getCmClass(vendor) {
  const vendorLower = vendor.toLowerCase();
  if (vendorLower.includes('onetrust')) return 'cm-onetrust';
  if (vendorLower.includes('trustarc')) return 'cm-trustarc';
  if (vendorLower.includes('cookiebot')) return 'cm-cookiebot';
  if (vendorLower.includes('cookieyes')) return 'cm-cookieyes';
  if (vendorLower.includes('osano')) return 'cm-osano';
  if (vendorLower.includes('securiti')) return 'cm-securiti';
  if (vendorLower.includes('transcend')) return 'cm-transcend';
  if (vendorLower.includes('ketch')) return 'cm-ketch';
  return 'cm-default';
}

export default function Home() {
  const [urls, setUrls] = useState('');
  const [results, setResults] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanType, setScanType] = useState('quick');
  const [activeTab, setActiveTab] = useState('quick');
  const [progress, setProgress] = useState({ current: 0, total: 0, currentUrl: '' });
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const stats = {
    success: results.filter(r => r.status === 'Success').length,
    errors: results.filter(r => r.status !== 'Success').length,
    total: results.length,
  };

  const summary = results.reduce((acc, r) => {
    r.cmp?.forEach(c => {
      acc.cmp[c] = (acc.cmp[c] || 0) + 1;
    });
    r.tagManager?.forEach(t => {
      acc.tagManager[t] = (acc.tagManager[t] || 0) + 1;
    });
    r.platform?.forEach(p => {
      acc.platform[p] = (acc.platform[p] || 0) + 1;
    });
    r.dsar?.forEach(d => {
      acc.dsar[d] = (acc.dsar[d] || 0) + 1;
    });
    r.trustCenter?.forEach(tc => {
      acc.trustCenter[tc] = (acc.trustCenter[tc] || 0) + 1;
    });
    r.privacyPolicyGenerator?.forEach(ppg => {
      acc.privacyPolicyGenerator[ppg] = (acc.privacyPolicyGenerator[ppg] || 0) + 1;
    });
    return acc;
  }, { cmp: {}, tagManager: {}, platform: {}, dsar: {}, trustCenter: {}, privacyPolicyGenerator: {} });

  const handleScan = async (type) => {
    const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean);
    if (urlList.length === 0) return;

    setScanType(type);
    setActiveTab(type);
    setIsScanning(true);
    setResults([]);
    setProgress({ current: 0, total: urlList.length, currentUrl: '' });

    const allResults = [];
    const batchSize = 5;

    for (let i = 0; i < urlList.length; i += batchSize) {
      const batch = urlList.slice(i, i + batchSize);
      setProgress({ current: i, total: urlList.length, currentUrl: batch[0] });

      try {
        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: batch, scanType: type }),
        });

        const data = await response.json();
        if (data.results) {
          allResults.push(...data.results);
          setResults([...allResults]);
        }
      } catch (error) {
        batch.forEach(url => {
          allResults.push({
            url,
            status: 'Not Scannable',
            error: error.message,
            cmp: [],
            consentSignals: [],
            tagManager: [],
            thirdPartyCookies: [],
            platform: [],
            dsar: [],
            trustCenter: [],
            privacyPolicyGenerator: [],
          });
        });
        setResults([...allResults]);
      }
    }

    setProgress({ current: urlList.length, total: urlList.length, currentUrl: '' });
    setIsScanning(false);
  };

  const handleClear = () => {
    setUrls('');
    setResults([]);
    setProgress({ current: 0, total: 0, currentUrl: '' });
  };

  const handleExport = () => {
    if (results.length === 0) return;

    const headers = activeTab === 'quick'
      ? ['URL', 'Status', 'CM', 'Consent Signals', 'Tag Manager', 'Third-Party Cookies', 'Platform']
      : ['URL', 'Status', 'CM', 'Consent Signals', 'Tag Manager', 'Third-Party Cookies', 'Platform', 'DSAR', 'Trust Center', 'Privacy Policy Generator'];

    const rows = results.map(r => {
      const baseRow = [
        r.url,
        r.status,
        r.cmp?.join('; ') || '',
        r.consentSignals?.join('; ') || '',
        r.tagManager?.join('; ') || '',
        r.thirdPartyCookies?.join('; ') || '',
        r.platform?.join('; ') || '',
      ];

      if (activeTab === 'deep') {
        baseRow.push(
          r.dsar?.join('; ') || '',
          r.trustCenter?.join('; ') || '',
          r.privacyPolicyGenerator?.join('; ') || ''
        );
      }

      return baseRow;
    });

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `privacy-scout-${activeTab}-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredResults = results.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (searchTerm && !r.url.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const urlCount = urls.split('\n').filter(u => u.trim()).length;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <svg className="app-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#ec4899' }} />
              <stop offset="50%" style={{ stopColor: '#8b5cf6' }} />
              <stop offset="100%" style={{ stopColor: '#3b82f6' }} />
            </linearGradient>
          </defs>
          <circle cx="7" cy="13" r="5" fill="url(#gradient1)" />
          <circle cx="7" cy="13" r="3" fill="white" fillOpacity="0.3" />
          <circle cx="17" cy="13" r="5" fill="url(#gradient1)" />
          <circle cx="17" cy="13" r="3" fill="white" fillOpacity="0.3" />
          <rect x="10" y="11" width="4" height="4" rx="1" fill="url(#gradient1)" />
          <path d="M4 8 L6 10" stroke="url(#gradient1)" strokeWidth="2" strokeLinecap="round" />
          <path d="M20 8 L18 10" stroke="url(#gradient1)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="app-title">Privacy Scout</span>
        <span className="app-subtitle">Sales Discovery Tool</span>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <h3>Scan Statistics</h3>
            <div className="stat-cards">
              <div className="stat-card">
                <div className="stat-icon success">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{stats.success}</span>
                  <span className="stat-label">Successful</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon error">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{stats.errors}</span>
                  <span className="stat-label">Not Scannable</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon total">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{stats.total}</span>
                  <span className="stat-label">Total URLs</span>
                </div>
              </div>
            </div>
          </div>

          <div className="sidebar-section">
            <h3>Detection Summary</h3>
            <div className="summary-list">
              {Object.keys(summary.cmp).length > 0 || Object.keys(summary.tagManager).length > 0 || Object.keys(summary.dsar).length > 0 ? (
                <>
                  {Object.entries(summary.cmp).slice(0, 3).map(([name, count]) => (
                    <div key={`cmp-${name}`} className="summary-item">
                      <span className="name">{name}</span>
                      <span className="count">{count}</span>
                    </div>
                  ))}
                  {Object.entries(summary.tagManager).slice(0, 3).map(([name, count]) => (
                    <div key={`tm-${name}`} className="summary-item">
                      <span className="name">{name}</span>
                      <span className="count">{count}</span>
                    </div>
                  ))}
                  {Object.entries(summary.dsar).slice(0, 2).map(([name, count]) => (
                    <div key={`dsar-${name}`} className="summary-item">
                      <span className="name">{name}</span>
                      <span className="count">{count}</span>
                    </div>
                  ))}
                  {Object.entries(summary.trustCenter).slice(0, 2).map(([name, count]) => (
                    <div key={`tc-${name}`} className="summary-item">
                      <span className="name">{name}</span>
                      <span className="count">{count}</span>
                    </div>
                  ))}
                </>
              ) : (
                <div className="summary-empty">
                  <p>Scan URLs to see detection summary</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Panel */}
        <main className="main-panel">
          {/* Input Section */}
          <div className="input-section">
            <div className="section-header">
              <h2>URL Scanner</h2>
              <p>Paste your URLs below (one per line) and select a scan type.</p>
            </div>

            <div className="textarea-container">
              <textarea
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder={`https://example.com\nhttps://another-site.com\nhttps://third-site.com\n\nPaste your URLs here, one per line...`}
              />
              <div className="textarea-actions">
                <span className="url-count">{urlCount} URLs</span>
                <button className="btn-clear" onClick={handleClear} title="Clear all">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="action-buttons">
              <button className="btn btn-primary" onClick={() => handleScan('quick')} disabled={isScanning || urlCount === 0}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                {isScanning && scanType === 'quick' ? 'Scanning...' : 'Quick Scan'}
              </button>
              <button className="btn btn-deep" onClick={() => handleScan('deep')} disabled={isScanning || urlCount === 0}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                </svg>
                {isScanning && scanType === 'deep' ? 'Scanning...' : 'Deep Scan'}
              </button>
              <button className="btn btn-export" onClick={handleExport} disabled={results.length === 0}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export CSV
              </button>
            </div>
          </div>

          {/* Progress Section */}
          {isScanning && (
            <div className="progress-section">
              <div className="progress-header">
                <div className="progress-info">
                  <span className="progress-text">{scanType === 'quick' ? 'Quick' : 'Deep'} Scanning...</span>
                  <span className="progress-detail">{progress.current} of {progress.total} URLs</span>
                </div>
                <span className="progress-percentage">{Math.round((progress.current / progress.total) * 100)}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
              </div>
              {progress.currentUrl && <div className="current-url">{progress.currentUrl}</div>}
            </div>
          )}

          {/* Results Section */}
          <div className="results-section">
            <div className="results-header">
              <div className="tabs">
                <button
                  className={`tab ${activeTab === 'quick' ? 'active' : ''}`}
                  onClick={() => setActiveTab('quick')}
                >
                  Quick Scan
                </button>
                <button
                  className={`tab ${activeTab === 'deep' ? 'active' : ''}`}
                  onClick={() => setActiveTab('deep')}
                >
                  Deep Scan
                </button>
              </div>
              <div className="results-filters">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Filter results..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                  className="filter-select"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="Success">Success</option>
                  <option value="Not Scannable">Not Scannable</option>
                </select>
              </div>
            </div>

            <div className="results-table-container">
              {activeTab === 'quick' ? (
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>URL</th>
                      <th>Status</th>
                      <th>CM</th>
                      <th>Consent Signals</th>
                      <th>Tag Manager</th>
                      <th>Third-Party Cookies</th>
                      <th>Platform</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.length > 0 ? (
                      filteredResults.map((result, index) => (
                        <tr key={index}>
                          <td className="url-cell" title={result.url}>{result.url}</td>
                          <td>
                            <span className={`status-badge ${result.status === 'Success' ? 'success' : 'error'}`}>
                              {result.status}
                            </span>
                          </td>
                          <td>
                            {result.cmp?.length > 0 ? (
                              result.cmp.map((c, i) => (
                                <span key={i} className={`tag ${getCmClass(c)}`}>{c}</span>
                              ))
                            ) : (
                              <span className="tag cm-default">Unknown</span>
                            )}
                          </td>
                          <td>
                            {result.consentSignals?.length > 0 ? (
                              result.consentSignals.map((s, i) => (
                                <span key={i} className="tag consent">{s}</span>
                              ))
                            ) : (
                              <span className="tag consent">Unknown</span>
                            )}
                          </td>
                          <td>
                            {result.tagManager?.length > 0 ? (
                              result.tagManager.map((t, i) => (
                                <span key={i} className="tag tm">{t}</span>
                              ))
                            ) : (
                              <span className="tag tm">Unknown</span>
                            )}
                          </td>
                          <td>
                            {result.thirdPartyCookies?.length > 0 ? (
                              <>
                                {result.thirdPartyCookies.slice(0, 3).map((c, i) => (
                                  <span key={i} className="tag cookie">{c}</span>
                                ))}
                                {result.thirdPartyCookies.length > 3 && (
                                  <span className="tag cookie">+{result.thirdPartyCookies.length - 3} more</span>
                                )}
                              </>
                            ) : (
                              <span className="tag cookie">Unknown</span>
                            )}
                          </td>
                          <td>
                            {result.platform?.length > 0 ? (
                              result.platform.map((p, i) => (
                                <span key={i} className="tag platform">{p}</span>
                              ))
                            ) : (
                              <span className="tag platform">Unknown</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="empty-state">
                        <td colSpan="7">
                          <div className="empty-message">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                              <rect x="9" y="3" width="6" height="4" rx="2" />
                              <path d="M9 14l2 2 4-4" />
                            </svg>
                            <p>No results yet</p>
                            <span>Enter URLs above and click "Quick Scan" to detect Consent Managers, Tag Managers, and Platforms</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>URL</th>
                      <th>Status</th>
                      <th>DSAR Platform</th>
                      <th>Trust Center</th>
                      <th>Privacy Policy Generator</th>
                      <th>CM</th>
                      <th>Tag Manager</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.length > 0 ? (
                      filteredResults.map((result, index) => (
                        <tr key={index}>
                          <td className="url-cell" title={result.url}>{result.url}</td>
                          <td>
                            <span className={`status-badge ${result.status === 'Success' ? 'success' : 'error'}`}>
                              {result.status}
                            </span>
                          </td>
                          <td>
                            {result.dsar?.length > 0 ? (
                              result.dsar.map((d, i) => (
                                <span key={i} className="tag dsar">{d}</span>
                              ))
                            ) : (
                              <span className="tag dsar">Unknown</span>
                            )}
                          </td>
                          <td>
                            {result.trustCenter?.length > 0 ? (
                              result.trustCenter.map((tc, i) => (
                                <span key={i} className="tag trust">{tc}</span>
                              ))
                            ) : (
                              <span className="tag trust">Unknown</span>
                            )}
                          </td>
                          <td>
                            {result.privacyPolicyGenerator?.length > 0 ? (
                              result.privacyPolicyGenerator.map((ppg, i) => (
                                <span key={i} className="tag ppg">{ppg}</span>
                              ))
                            ) : (
                              <span className="tag ppg">Unknown</span>
                            )}
                          </td>
                          <td>
                            {result.cmp?.length > 0 ? (
                              result.cmp.map((c, i) => (
                                <span key={i} className={`tag ${getCmClass(c)}`}>{c}</span>
                              ))
                            ) : (
                              <span className="tag cm-default">Unknown</span>
                            )}
                          </td>
                          <td>
                            {result.tagManager?.length > 0 ? (
                              result.tagManager.map((t, i) => (
                                <span key={i} className="tag tm">{t}</span>
                              ))
                            ) : (
                              <span className="tag tm">Unknown</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="empty-state">
                        <td colSpan="7">
                          <div className="empty-message">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                            </svg>
                            <p>No deep scan results yet</p>
                            <span>Click "Deep Scan" to detect DSAR platforms, Trust Centers, and Privacy Policy Generators</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
