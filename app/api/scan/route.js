import * as cheerio from 'cheerio';

// Detection patterns from the desktop app
const cookieBannerPatterns = {
  'OneTrust': ['onetrust', 'optanon', 'ot-sdk'],
  'Cookiebot': ['cookiebot', 'cybot', 'cookieconsent'],
  'TrustArc': ['trustarc', 'truste', 'consent.trustarc'],
  'Quantcast': ['quantcast', 'qc-cmp', '__qca'],
  'Didomi': ['didomi', 'didomi-notice'],
  'Osano': ['osano', 'osano-cm'],
  'CookieYes': ['cookieyes', 'cky-consent'],
  'Termly': ['termly', 't-consentPrompt'],
  'iubenda': ['iubenda'],
  'Sourcepoint': ['sourcepoint', 'sp_message'],
  'Admiral': ['admiral', 'admiralcdn'],
  'Cookie Notice': ['cookie-notice', 'cn-notice'],
  'GDPR Cookie Compliance': ['gdpr-cookie', 'moove_gdpr'],
  'Civic UK': ['civicuk', 'civic-cookie'],
  'Cookie Law Info': ['cookie-law-info', 'cli-'],
  'Complianz': ['complianz', 'cmplz'],
  'CookiePro': ['cookiepro'],
  'Evidon': ['evidon'],
  'Cookie Script': ['cookie-script'],
  'Crownpeak': ['crownpeak', 'evidon'],
  'Usercentrics': ['usercentrics', 'uc-'],
  'Klaro': ['klaro', 'klaro-'],
  'Cookie Consent by Insites': ['cookieconsent', 'cc-window'],
  'CookieFirst': ['cookiefirst'],
  'Axeptio': ['axeptio'],
  'Borlabs Cookie': ['borlabs-cookie'],
  'Cookie Information': ['cookie-information'],
  'LiveRamp': ['liveramp', 'ats.js'],
  'Ketch': ['ketch', 'swb.js'],
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

async function scanUrl(url) {
  const result = {
    url,
    status: 'Success',
    cmp: [],
    consentSignals: [],
    tagManager: [],
    thirdPartyCookies: [],
    platform: [],
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
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

    // Detect CMPs
    for (const [cmp, patterns] of Object.entries(cookieBannerPatterns)) {
      for (const pattern of patterns) {
        if (fullContent.includes(pattern.toLowerCase())) {
          if (!result.cmp.includes(cmp)) {
            result.cmp.push(cmp);
          }
          break;
        }
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

  } catch (error) {
    result.status = 'Not Scannable';
    result.error = error.name === 'AbortError' ? 'Timeout' : error.message;
  }

  return result;
}

export async function POST(request) {
  try {
    const { urls } = await request.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return Response.json({ error: 'No URLs provided' }, { status: 400 });
    }

    // Limit to 5 URLs per request to stay within serverless timeout
    const urlsToScan = urls.slice(0, 5);
    const results = [];

    for (const url of urlsToScan) {
      if (url.trim()) {
        const result = await scanUrl(url.trim());
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
