import * as cheerio from 'cheerio';

// Strict CMP detection - only detect actual cookie banner/consent management scripts
// These patterns look for specific script sources, SDK initializations, and banner elements
const cookieBannerPatterns = {
  'OneTrust': {
    // Must find OneTrust-specific SDK scripts or banner elements
    scripts: ['cdn.cookielaw.org', 'onetrust.com/consent', 'otSDKStub.js', 'otBannerSdk.js', 'optanon.js', 'otAutoBlock'],
    elements: ['onetrust-banner-sdk', 'onetrust-consent-sdk', 'ot-sdk-container', 'optanon-alert-box-wrapper', 'ot-sdk-show-settings', 'ot-sdk-btn', 'onetrust-pc-sdk', 'optanon-cookie-policy'],
  },
  'Cookiebot': {
    scripts: ['consent.cookiebot.com', 'consentcdn.cookiebot.com'],
    elements: ['CybotCookiebotDialog', 'cookiebot-widget'],
  },
  'TrustArc': {
    scripts: ['consent.trustarc.com', 'consent-pref.trustarc.com', 'trustarc.mgr.consensu.org'],
    elements: ['truste-consent-track', 'trustarc-banner', 'consent_blackbar'],
  },
  'Quantcast': {
    scripts: ['quantcast.mgr.consensu.org', 'cmp.quantcast.com', 'choice.us.quantcast.com'],
    elements: ['qc-cmp2-container', 'qc-cmp-ui-container'],
  },
  'Didomi': {
    scripts: ['sdk.privacy-center.org', 'didomi.io/sdk'],
    elements: ['didomi-host', 'didomi-popup', 'didomi-notice'],
  },
  'Osano': {
    scripts: ['cmp.osano.com', 'cookie-consent.osano.com'],
    elements: ['osano-cm-window', 'osano-cm-dialog'],
  },
  'CookieYes': {
    scripts: ['cdn-cookieyes.com', 'app.cookieyes.com', 'cdn.cookieyes.com', 'cookieyes.com'],
    elements: ['cky-consent-container', 'cky-banner', 'cky-consent', 'cky-btn', 'cky-notice'],
    // Case-insensitive patterns to check
    caseInsensitive: ['cookieyes', 'cky-'],
  },
  'Termly': {
    scripts: ['app.termly.io/embed', 'termly.io/resources/templates'],
    elements: ['termly-code-snippet-support', 't-consentPrompt'],
  },
  'iubenda': {
    scripts: ['cdn.iubenda.com/cs/', 'iubenda_cs.js'],
    elements: ['iubenda-cs-banner', 'iubenda-iframe'],
  },
  'Sourcepoint': {
    scripts: ['sourcepoint.mgr.consensu.org', 'cdn.privacy-mgmt.com'],
    elements: ['sp_message_container', 'sp-message'],
  },
  'Usercentrics': {
    scripts: ['app.usercentrics.eu', 'usercentrics.eu/bundle', 'usercentrics.eu'],
    elements: ['uc-banner', 'usercentrics-root', 'uc-embedding-container'],
    // Case-insensitive patterns for Usercentrics (UC- prefix often used)
    caseInsensitive: ['usercentrics', 'uc-'],
  },
  'Ketch': {
    scripts: ['global.ketchcdn.com', 'ketch-tag.js'],
    elements: ['ketch-consent', 'lanyard-root'],
  },
  'CookiePro': {
    scripts: ['cookiepro.com/consent', 'cookie-cdn.cookiepro.com'],
    elements: ['onetrust-banner-sdk'], // CookiePro uses OneTrust SDK
  },
  'Admiral': {
    scripts: ['admiralcdn.com'],
    elements: ['admiral-cmp'],
  },
  'Complianz': {
    scripts: ['complianz-gdpr', 'cmplz-cookiebanner'],
    elements: ['cmplz-cookiebanner', 'cmplz-consent-modal'],
  },
  'Cookie Script': {
    scripts: ['cdn.cookie-script.com', 'cookie-script.com/s/'],
    elements: ['cookie-script-banner'],
  },
  'Axeptio': {
    scripts: ['static.axept.io', 'axeptio/sdk'],
    elements: ['axeptio_overlay', 'axeptio_btn'],
  },
  'CookieFirst': {
    scripts: ['consent.cookiefirst.com'],
    elements: ['cookiefirst-root'],
  },
  'Klaro': {
    scripts: ['kiprotect.com/klaro', 'klaro.js', 'klaro.min.js'],
    elements: ['klaro', 'cookie-modal'],
  },
  'Civic UK': {
    scripts: ['cc.cdn.civiccomputing.com'],
    elements: ['ccc-notify', 'civic-cookie-control'],
  },
  'LiveRamp': {
    scripts: ['launchpad.privacymanager.io', 'ats.rlcdn.com'],
    elements: ['_lp_banner'],
  },
  'Securiti': {
    scripts: ['cdn.securiti.ai', 'consent.securiti.ai'],
    elements: ['securiti-consent-banner'],
  },
  'Transcend': {
    scripts: ['cdn.transcend.io', 'transcend.io/cm'],
    elements: ['transcend-consent-manager'],
  },
  'HubSpot Cookie Banner': {
    scripts: ['js.hs-banner.com', 'js.hscollectedforms.net/collectedforms', 'hs-banner'],
    elements: ['hs-banner-cookie-settings', 'hs-eu-cookie-confirmation', 'hs-cookie-notification'],
    caseInsensitive: ['hs-banner', 'hscookiebanner'],
  },
  'monday.com Cookie': {
    // monday.com uses a custom cookie banner
    elements: ['cookie-settings', 'cookie-banner', 'cookies-banner'],
    caseInsensitive: ['cookie-settings', 'cookies-policy-banner'],
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

      // Check for CMP-specific script sources
      if (patterns.scripts) {
        for (const scriptPattern of patterns.scripts) {
          // Look in script src attributes specifically
          const scriptFound = $(`script[src*="${scriptPattern}"]`).length > 0;
          // Also check inline scripts for SDK initialization
          const inlineFound = fullContent.includes(scriptPattern.toLowerCase());
          if (scriptFound || inlineFound) {
            detected = true;
            break;
          }
        }
      }

      // Check for CMP-specific DOM elements (IDs and classes)
      if (!detected && patterns.elements) {
        for (const elementPattern of patterns.elements) {
          const elementFound = $(`#${elementPattern}, .${elementPattern}, [id*="${elementPattern}"], [class*="${elementPattern}"]`).length > 0;
          if (elementFound) {
            detected = true;
            break;
          }
        }
      }

      // Check for case-insensitive patterns (for CMPs like Usercentrics with UC- prefix)
      if (!detected && patterns.caseInsensitive) {
        for (const pattern of patterns.caseInsensitive) {
          if (fullContent.includes(pattern.toLowerCase())) {
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
