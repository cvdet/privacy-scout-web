import * as cheerio from 'cheerio';

// CMP detection patterns - using CDN domains and specific element IDs/classes
// Scripts array: checked in script src AND inline content (for GTM-loaded scripts)
// Elements array: checked as exact ID matches
// Classes array: checked as class attribute matches (for OneTrust settings buttons etc)
const cookieBannerPatterns = {
  'OneTrust': {
    // CDN domains that are unique to OneTrust
    scripts: ['cdn.cookielaw.org', 'optanon.blob.core.windows.net', 'onetrust.com/consent'],
    elements: ['onetrust-banner-sdk', 'onetrust-consent-sdk', 'optanon-alert-box-wrapper'],
    // OneTrust-specific classes (settings buttons, etc)
    classes: ['ot-sdk-show-settings', 'optanon-toggle-display'],
  },
  'Cookiebot': {
    scripts: ['consent.cookiebot.com', 'consentcdn.cookiebot.com'],
    elements: ['CybotCookiebotDialog', 'CybotCookiebotDialogBody'],
    classes: ['CybotCookiebotDialogActive'],
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
    scripts: ['sdk.privacy-center.org', 'cdn.didomi.io'],
    elements: ['didomi-host', 'didomi-popup'],
    classes: ['didomi-consent-popup-backdrop', 'didomi-popup-open'],
  },
  'Osano': {
    scripts: ['cmp.osano.com', 'cookie-consent.osano.com'],
    elements: ['osano-cm-window'],
  },
  'CookieYes': {
    // Only CDN domain - very specific
    scripts: ['cdn-cookieyes.com'],
    elements: ['cky-consent'],
    classes: ['cky-consent-container', 'cky-btn-accept'],
  },
  'Termly': {
    scripts: ['app.termly.io'],
    elements: ['termly-code-snippet-support'],
  },
  'iubenda': {
    scripts: ['cdn.iubenda.com'],
    elements: ['iubenda-cs-banner'],
    classes: ['iubenda-tp-btn', 'iubenda-cs-preferences-link'],
  },
  'Sourcepoint': {
    scripts: ['cdn.privacy-mgmt.com', 'sourcepoint.mgr.consensu.org'],
    elements: ['sp_message_container'],
  },
  'Usercentrics': {
    scripts: ['app.usercentrics.eu'],
    elements: ['usercentrics-root'],
  },
  'Ketch': {
    scripts: ['global.ketchcdn.com'],
    elements: ['lanyard-root'],
  },
  'CookiePro': {
    scripts: ['cookie-cdn.cookiepro.com', 'cookiepro.blob.core.windows.net'],
  },
  'Complianz': {
    scripts: ['complianz-gdpr'],
    elements: ['cmplz-cookiebanner'],
  },
  'Cookie Script': {
    scripts: ['cdn.cookie-script.com'],
  },
  'Axeptio': {
    scripts: ['static.axept.io'],
  },
  'CookieFirst': {
    scripts: ['consent.cookiefirst.com'],
  },
  'Civic UK': {
    scripts: ['cc.cdn.civiccomputing.com'],
  },
  'Securiti': {
    scripts: ['cdn.securiti.ai', 'consent.securiti.ai'],
  },
  'Transcend': {
    scripts: ['cdn.transcend.io'],
  },
  'Ensighten (Cheq)': {
    scripts: ['nexus.ensighten.com', 'ensighten.com'],
    // Also check for Ensighten consent cookies pattern
    inlinePatterns: ['ENSIGHTEN_PRIVACY', 'checkEnsightenConsent'],
  },
  'HubSpot': {
    scripts: ['js.hs-banner.com', 'js.hscollectedforms.net/collectedforms'],
    elements: ['hs-banner-container', 'hs-cookie-banner'],
    classes: ['hs-cookie-consent-banner'],
    inlinePatterns: ['hs-banner.com', '__hs_cookie_cat_pref'],
  },
};

const consentSignalPatterns = {
  'IAB TCF v2': ['__tcfapi', 'tcData', 'gdprApplies', 'tcfapi'],
  'IAB USP (CCPA)': ['__uspapi', 'uspData', 'usprivacy'],
  'IAB GPP': ['__gpp', 'gppData'],
  'Google Consent Mode': ['consent_mode', 'gtag.*consent', 'consentMode'],
};

// Tag Managers ONLY - systems that manage/deploy other tags
const tagManagerPatterns = {
  'Google Tag Manager': ['googletagmanager.com/gtm.js', 'gtm.js', 'GTM-'],
  'Adobe Launch': ['assets.adobedtm.com', 'launch-'],
  'Tealium': ['tealium', 'utag.js', 'tealiumiq'],
  'Segment': ['cdn.segment.com', 'segment.io'],
  'Ensighten Manage': ['nexus.ensighten.com/manage'],
  'Signal (BrightTag)': ['signal.co', 'brighttag'],
  'Commanders Act': ['commandersact', 'tagcommander'],
  'Piwik Tag Manager': ['piwik.pro/tag-manager'],
};

// Third-party data vendors - analytics, tracking, PII collectors
const thirdPartyVendorPatterns = {
  'Google Analytics': ['google-analytics.com', 'gtag/js', 'ga.js', 'analytics.js'],
  'Google Analytics 4': ['gtag/js?id=G-'],
  'Adobe Analytics': ['omtrdc.net', 's_code', 'AppMeasurement'],
  'Facebook Pixel': ['connect.facebook.net', 'fbevents.js', 'fbq('],
  'Meta Pixel': ['connect.facebook.net/signals'],
  'LinkedIn Insight': ['snap.licdn.com', 'linkedin.com/px'],
  'Twitter/X Pixel': ['static.ads-twitter.com', 'twq('],
  'TikTok Pixel': ['analytics.tiktok.com', 'ttq.'],
  'Pinterest Tag': ['pintrk', 's.pinimg.com'],
  'Snapchat Pixel': ['sc-static.net', 'snaptr('],
  'Microsoft Clarity': ['clarity.ms'],
  'Hotjar': ['hotjar', 'static.hotjar.com'],
  'Heap': ['heap-', 'heapanalytics'],
  'Mixpanel': ['mixpanel', 'mxpnl'],
  'Amplitude': ['amplitude', 'cdn.amplitude'],
  'FullStory': ['fullstory', 'fs.js'],
  'Crazy Egg': ['crazyegg'],
  'Lucky Orange': ['luckyorange'],
  'Pendo': ['pendo.io', 'pendo-'],
  'Mouseflow': ['mouseflow.com'],
  'Matomo': ['matomo', 'piwik'],
  'Plausible': ['plausible.io'],
  'Fathom': ['usefathom.com'],
  'Snowplow': ['snowplow', 'sp.js'],
  'Piano Analytics': ['piano.io', 'at-internet'],
  'HubSpot Tracking': ['js.hs-scripts.com', 'js.hubspot.com'],
  'Salesforce DMP': ['krxd.net', 'cdn.krxd.net'],
  'Oracle BlueKai': ['bluekai.com', 'bkrtx.com'],
  'Criteo': ['criteo.com', 'criteo.net'],
  'DoubleClick': ['doubleclick.net'],
  'Google Ads': ['googleadservices.com', 'googlesyndication.com'],
  'Bing Ads': ['bat.bing.com', 'clarity.ms'],
  'Intercom': ['intercom.io', 'widget.intercom.io'],
  'Drift': ['drift.com', 'js.driftt.com'],
  'Zendesk': ['zendesk.com', 'zdassets.com'],
  'LiveChat': ['livechatinc.com'],
  'Optimizely': ['optimizely.com', 'cdn.optimizely'],
  'VWO': ['visualwebsiteoptimizer.com', 'vwo.com'],
  'AB Tasty': ['abtasty.com'],
  'LaunchDarkly': ['launchdarkly.com'],
};

// Platform - website/CMS type only
const platformPatterns = {
  'WordPress': ['wp-content', 'wp-includes'],
  'Shopify': ['cdn.shopify', 'myshopify.com'],
  'Wix': ['wixstatic.com', 'parastorage.com'],
  'Squarespace': ['squarespace.com', 'sqsp.com'],
  'Webflow': ['webflow.io', 'assets.website-files.com'],
  'Drupal': ['/sites/default/files', 'drupal.js'],
  'Joomla': ['/components/com_', '/media/jui/'],
  'Magento': ['mage/cookies.js', 'static/frontend/Magento'],
  'BigCommerce': ['cdn11.bigcommerce.com', 'bigcommerce.com/s-'],
  'PrestaShop': ['prestashop', '/modules/ps_'],
  'Salesforce Commerce': ['demandware.net', 'demandware.static'],
  'WooCommerce': ['woocommerce', 'wc-add-to-cart'],
  'HubSpot CMS': ['hs-sites.com', 'hubspotusercontent'],
  'Ghost': ['ghost.io', 'ghost.org'],
  'Contentful': ['ctfassets.net'],
  'Sitecore': ['sitecore', '/-/media/'],
  'Adobe Experience Manager': ['adobeaemcloud.com', '/content/dam/'],
  'Kentico': ['kentico', '/cmspages/'],
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
    thirdPartyVendors: [],
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

      // Check for CMP-specific script sources
      if (patterns.scripts) {
        for (const scriptPattern of patterns.scripts) {
          // Check script src attributes
          const scriptFound = $(`script[src*="${scriptPattern}"]`).length > 0;
          // Also check full HTML for CDN references (catches GTM-loaded scripts)
          const inlineFound = fullContent.includes(scriptPattern.toLowerCase());
          if (scriptFound || inlineFound) {
            detected = true;
            break;
          }
        }
      }

      // Check for CMP-specific DOM elements (exact ID matches only)
      if (!detected && patterns.elements) {
        for (const elementPattern of patterns.elements) {
          const elementFound = $(`#${elementPattern}`).length > 0;
          if (elementFound) {
            detected = true;
            break;
          }
        }
      }

      // Check for CMP-specific classes (e.g., OneTrust settings buttons)
      if (!detected && patterns.classes) {
        for (const classPattern of patterns.classes) {
          const classFound = $(`.${classPattern}`).length > 0;
          if (classFound) {
            detected = true;
            break;
          }
        }
      }

      // Check for inline patterns (e.g., Ensighten consent functions)
      if (!detected && patterns.inlinePatterns) {
        for (const inlinePattern of patterns.inlinePatterns) {
          if (fullContent.includes(inlinePattern.toLowerCase())) {
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

    // Detect Third-Party Vendors (analytics, tracking, data collectors)
    for (const [vendor, patterns] of Object.entries(thirdPartyVendorPatterns)) {
      for (const pattern of patterns) {
        if (fullContent.includes(pattern.toLowerCase())) {
          if (!result.thirdPartyVendors.includes(vendor)) {
            result.thirdPartyVendors.push(vendor);
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
