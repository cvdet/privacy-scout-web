import * as cheerio from 'cheerio';

// Strict CMP detection - ONLY detect via script sources (most reliable)
// Removed generic element patterns that cause false positives
const cookieBannerPatterns = {
  'OneTrust': {
    scripts: ['cdn.cookielaw.org', 'onetrust.com/consent', 'otSDKStub.js', 'otBannerSdk.js', 'optanon.js', 'otAutoBlock'],
    elements: ['onetrust-banner-sdk', 'onetrust-consent-sdk', 'optanon-alert-box-wrapper'],
  },
  'Cookiebot': {
    scripts: ['consent.cookiebot.com', 'consentcdn.cookiebot.com'],
    elements: ['CybotCookiebotDialog'],
  },
  'TrustArc': {
    scripts: ['consent.trustarc.com', 'consent-pref.trustarc.com', 'trustarc.mgr.consensu.org'],
    elements: ['truste-consent-track', 'trustarc-banner'],
  },
  'Quantcast': {
    scripts: ['quantcast.mgr.consensu.org', 'cmp.quantcast.com', 'choice.us.quantcast.com'],
    elements: ['qc-cmp2-container'],
  },
  'Didomi': {
    scripts: ['sdk.privacy-center.org', 'didomi.io/sdk'],
    elements: ['didomi-host', 'didomi-popup'],
  },
  'Osano': {
    scripts: ['cmp.osano.com', 'cookie-consent.osano.com'],
    elements: ['osano-cm-window'],
  },
  'CookieYes': {
    // ONLY script-based detection - no generic patterns
    scripts: ['cdn-cookieyes.com', 'app.cookieyes.com'],
  },
  'Termly': {
    scripts: ['app.termly.io/embed', 'termly.io/resources/templates'],
    elements: ['termly-code-snippet-support'],
  },
  'iubenda': {
    scripts: ['cdn.iubenda.com/cs/', 'iubenda_cs.js'],
    elements: ['iubenda-cs-banner'],
  },
  'Sourcepoint': {
    scripts: ['sourcepoint.mgr.consensu.org', 'cdn.privacy-mgmt.com'],
    elements: ['sp_message_container'],
  },
  'Usercentrics': {
    scripts: ['app.usercentrics.eu', 'usercentrics.eu/bundle'],
    elements: ['usercentrics-root'],
  },
  'Ketch': {
    scripts: ['global.ketchcdn.com', 'ketch-tag.js'],
    elements: ['lanyard-root'],
  },
  'CookiePro': {
    scripts: ['cookiepro.com/consent', 'cookie-cdn.cookiepro.com'],
  },
  'Admiral': {
    scripts: ['admiralcdn.com'],
  },
  'Complianz': {
    scripts: ['complianz-gdpr', 'cmplz-cookiebanner'],
    elements: ['cmplz-cookiebanner'],
  },
  'Cookie Script': {
    scripts: ['cdn.cookie-script.com', 'cookie-script.com/s/'],
  },
  'Axeptio': {
    scripts: ['static.axept.io', 'axeptio/sdk'],
  },
  'CookieFirst': {
    scripts: ['consent.cookiefirst.com'],
  },
  'Klaro': {
    scripts: ['kiprotect.com/klaro', 'klaro.min.js'],
  },
  'Civic UK': {
    scripts: ['cc.cdn.civiccomputing.com'],
  },
  'LiveRamp': {
    scripts: ['launchpad.privacymanager.io'],
  },
  'Securiti': {
    scripts: ['cdn.securiti.ai', 'consent.securiti.ai'],
  },
  'Transcend': {
    scripts: ['cdn.transcend.io', 'transcend.io/cm'],
  },
};

const consentSignalPatterns = {
  'IAB TCF v2': ['__tcfapi', 'tcData', 'gdprApplies', 'tcfapi'],
  'IAB USP (CCPA)': ['__uspapi', 'uspData', 'usprivacy'],
  'IAB GPP': ['__gpp', 'gppData'],
  'Google Consent Mode': ['consent_mode', 'gtag.*consent', 'consentMode'],
};

const tagManagerPatterns = {
  'Google Tag Manager': ['googletagmanager.com/gtm.js', 'gtm.js', 'GTM-'],
  'Google Analytics': ['google-analytics.com', 'gtag/js', 'ga.js', 'analytics.js'],
  'Google Analytics 4': ['gtag/js?id=G-'],
  'Adobe Launch': ['assets.adobedtm.com', 'launch-', 'adobedtm'],
  'Adobe Analytics': ['omtrdc.net', 's_code', 'AppMeasurement'],
  'Tealium': ['tealium', 'utag.js', 'tealiumiq'],
  'Segment': ['segment.com', 'analytics.min.js', 'cdn.segment'],
  'Heap': ['heap-', 'heapanalytics'],
  'Mixpanel': ['mixpanel', 'mxpnl'],
  'Amplitude': ['amplitude', 'cdn.amplitude'],
  'Hotjar': ['hotjar', 'static.hotjar.com'],
  'Crazy Egg': ['crazyegg'],
  'FullStory': ['fullstory', 'fs.js'],
  'Lucky Orange': ['luckyorange'],
  'Pendo': ['pendo.io', 'pendo-'],
  'Matomo': ['matomo', 'piwik'],
  'Plausible': ['plausible.io'],
  'Fathom': ['usefathom.com'],
  'Snowplow': ['snowplow', 'sp.js'],
  'Ensighten': ['ensighten', 'nexus.ensighten'],
  'Signal (BrightTag)': ['signal.co', 'brighttag'],
  'Commanders Act': ['commandersact', 'tagcommander'],
  'Piano Analytics': ['piano.io', 'at-internet'],
};

const platformPatterns = {
  'WordPress': ['wp-content', 'wp-includes', 'wordpress'],
  'Shopify': ['cdn.shopify', 'shopify.com', 'myshopify'],
  'Wix': ['wix.com', 'wixstatic', 'parastorage'],
  'Squarespace': ['squarespace', 'sqsp'],
  'Webflow': ['webflow.com', 'webflow.io'],
  'Drupal': ['drupal', '/sites/default/files'],
  'Joomla': ['joomla', '/components/com_'],
  'Magento': ['magento', 'mage/', 'static/frontend'],
  'BigCommerce': ['bigcommerce', 'cdn11.bigcommerce'],
  'PrestaShop': ['prestashop'],
  'HubSpot': ['hubspot', 'hs-scripts', 'hscollectedforms'],
  'Salesforce Commerce': ['demandware', 'salesforce'],
  'WooCommerce': ['woocommerce', 'wc-'],
  'Contentful': ['contentful', 'ctfassets'],
  'Sanity': ['sanity.io'],
  'Ghost': ['ghost.io', 'ghost-'],
  'Next.js': ['_next/static', 'nextjs'],
  'Gatsby': ['gatsby', '/static/'],
  'React': ['react', 'reactDOM'],
  'Vue': ['vue.js', 'vuejs'],
  'Angular': ['angular', 'ng-'],
  'Cloudflare': ['cloudflare', 'cf-ray'],
  'Vercel': ['vercel', '.vercel.app'],
  'Netlify': ['netlify', '.netlify.app'],
  'AWS': ['amazonaws.com', 'cloudfront.net'],
  'Azure': ['azure', 'azureedge.net', 'blob.core.windows.net'],
  'Akamai': ['akamai', 'akamaized'],
};

// Deep Scan patterns
const dsarPatterns = {
  'OneTrust DSAR': ['onetrust.com/webform', 'privacyportal.onetrust.com', 'privacyportal-cdn.onetrust.com'],
  'TrustArc DSAR': ['trustarc.com/consumer', 'submit-irm.trustarc.com', 'preferences.truste.com'],
  'BigID': ['bigid.com', 'portal.bigid.'],
  'DataGrail': ['datagrail.io', 'dsr.datagrail'],
  'Transcend': ['transcend.io', 'privacy.transcend'],
  'Securiti': ['securiti.ai', 'privaci.ai'],
  'WireWheel': ['wirewheel.io'],
  'Ketch DSAR': ['ketch.com/request', 'rights.ketch'],
  'Osano DSAR': ['osano.com/dsar', 'dsar.osano'],
  'Mine': ['saymine.com', 'dsr.saymine'],
  'Enzuzo': ['enzuzo.com'],
  'Ethyca': ['ethyca.com', 'fides.'],
  'Clarip': ['clarip.com'],
  'Didomi DSAR': ['didomi.io/request', 'preference.didomi'],
  'Sourcepoint DSAR': ['sourcepoint.com/dsar'],
};

const trustCenterPatterns = {
  'OneTrust Trust Center': ['onetrust.com/trust', 'trust.onetrust'],
  'Conveyor': ['conveyor.com', 'trust.'],
  'Vanta Trust Center': ['vanta.com/trust', 'trust-center.vanta'],
  'Drata': ['drata.com', 'trust.drata'],
  'Secureframe': ['secureframe.com', 'trust.secureframe'],
  'SafeBase': ['safebase.io', 'security.safebase'],
  'Tugboat Logic': ['tugboatlogic.com'],
  'Whistic': ['whistic.com'],
  'SecurityScorecard': ['securityscorecard.com', 'trust.securityscorecard'],
  'Trust Center by Salesforce': ['trust.salesforce.com'],
  'Cisco Trust Center': ['trustportal.cisco.com'],
  'AWS Trust Center': ['aws.amazon.com/compliance'],
  'Google Trust Center': ['cloud.google.com/security'],
  'Microsoft Trust Center': ['microsoft.com/trust-center'],
};

const privacyPolicyPatterns = {
  'Termly Generator': ['termly.io/products/privacy-policy', 'app.termly.io'],
  'iubenda Generator': ['iubenda.com/privacy-policy', 'iubenda.com/en/privacy'],
  'PrivacyPolicies.com': ['privacypolicies.com'],
  'FreePrivacyPolicy': ['freeprivacypolicy.com'],
  'GetTerms': ['getterms.io'],
  'Enzuzo Generator': ['enzuzo.com/privacy'],
  'Osano Generator': ['osano.com/privacy-policy-generator'],
  'CookieYes Generator': ['cookieyes.com/privacy-policy-generator'],
  'TermsFeed': ['termsfeed.com'],
  'Nolo': ['nolo.com/legal-encyclopedia/privacy-policy'],
  'Shopify Generator': ['shopify.com/tools/policy-generator'],
  'Privacy Policy Online': ['privacypolicyonline.com'],
};

async function scanUrl(url, scanType = 'quick') {
  const result = {
    url,
    status: 'Success',
    cmp: [],
    consentSignals: [],
    tagManager: [],
    thirdPartyCookies: [],
    platform: [],
    // Deep scan fields
    dsar: [],
    trustCenter: [],
    privacyPolicyGenerator: [],
    error: null,
  };

  try {
    // Normalize URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      result.status = 'Not Scannable';
      result.error = `HTTP ${response.status}`;
      return result;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const fullContent = html.toLowerCase();

    // Strict CMP detection - check for actual consent banner scripts and elements
    for (const [cmpName, patterns] of Object.entries(cookieBannerPatterns)) {
      let detected = false;

      // Check for CMP-specific script sources (PRIMARY detection method)
      if (patterns.scripts) {
        for (const scriptPattern of patterns.scripts) {
          // Look in script src attributes specifically
          const scriptFound = $(`script[src*="${scriptPattern}"]`).length > 0;
          if (scriptFound) {
            detected = true;
            break;
          }
        }
      }

      // Check for CMP-specific DOM elements (IDs only - more reliable than classes)
      if (!detected && patterns.elements) {
        for (const elementPattern of patterns.elements) {
          // Only check exact ID matches for reliability
          const elementFound = $(`#${elementPattern}`).length > 0;
          if (elementFound) {
            detected = true;
            break;
          }
        }
      }

      if (detected && !result.cmp.includes(cmpName)) {
        result.cmp.push(cmpName);
      }
    }

    // Detect Consent Signals
    for (const [signal, patterns] of Object.entries(consentSignalPatterns)) {
      for (const pattern of patterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(fullContent)) {
          if (!result.consentSignals.includes(signal)) {
            result.consentSignals.push(signal);
          }
          break;
        }
      }
    }

    // Detect Tag Managers
    for (const [tm, patterns] of Object.entries(tagManagerPatterns)) {
      for (const pattern of patterns) {
        if (fullContent.includes(pattern.toLowerCase())) {
          if (!result.tagManager.includes(tm)) {
            result.tagManager.push(tm);
          }
          break;
        }
      }
    }

    // Detect Platforms
    for (const [platform, patterns] of Object.entries(platformPatterns)) {
      for (const pattern of patterns) {
        if (fullContent.includes(pattern.toLowerCase())) {
          if (!result.platform.includes(platform)) {
            result.platform.push(platform);
          }
          break;
        }
      }
    }

    // Detect third-party scripts (potential cookie setters)
    const thirdPartyDomains = new Set();
    const urlObj = new URL(url);
    const mainDomain = urlObj.hostname.replace(/^www\./, '');

    $('script[src], img[src], iframe[src], link[href]').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('href');
      if (src) {
        try {
          const srcUrl = new URL(src, url);
          const srcDomain = srcUrl.hostname.replace(/^www\./, '');
          if (srcDomain !== mainDomain && !srcDomain.endsWith('.' + mainDomain)) {
            thirdPartyDomains.add(srcDomain);
          }
        } catch {}
      }
    });

    result.thirdPartyCookies = Array.from(thirdPartyDomains).slice(0, 10);

    // Deep Scan detections (only if scanType is 'deep')
    if (scanType === 'deep') {
      // Detect DSAR platforms
      for (const [dsar, patterns] of Object.entries(dsarPatterns)) {
        for (const pattern of patterns) {
          if (fullContent.includes(pattern.toLowerCase())) {
            if (!result.dsar.includes(dsar)) {
              result.dsar.push(dsar);
            }
            break;
          }
        }
      }

      // Detect Trust Centers
      for (const [tc, patterns] of Object.entries(trustCenterPatterns)) {
        for (const pattern of patterns) {
          if (fullContent.includes(pattern.toLowerCase())) {
            if (!result.trustCenter.includes(tc)) {
              result.trustCenter.push(tc);
            }
            break;
          }
        }
      }

      // Detect Privacy Policy Generators
      for (const [ppg, patterns] of Object.entries(privacyPolicyPatterns)) {
        for (const pattern of patterns) {
          if (fullContent.includes(pattern.toLowerCase())) {
            if (!result.privacyPolicyGenerator.includes(ppg)) {
              result.privacyPolicyGenerator.push(ppg);
            }
            break;
          }
        }
      }
    }

  } catch (error) {
    result.status = 'Not Scannable';
    result.error = error.name === 'AbortError' ? 'Timeout' : error.message;
  }

  return result;
}

export async function POST(request) {
  try {
    const { urls, scanType = 'quick' } = await request.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return Response.json({ error: 'No URLs provided' }, { status: 400 });
    }

    // Limit to 5 URLs per request to stay within serverless timeout
    const urlsToScan = urls.slice(0, 5);
    const results = [];

    for (const url of urlsToScan) {
      if (url.trim()) {
        const result = await scanUrl(url.trim(), scanType);
        results.push(result);
      }
    }

    return Response.json({
      results,
      processed: urlsToScan.length,
      total: urls.length,
      hasMore: urls.length > 5
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
