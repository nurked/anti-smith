/**
 * Classic headless-browser tells. Each check is cheap and individually weak;
 * the plugin reports which ones fired so runs can be compared.
 */
export default {
  id: 'detector.headless',
  kind: 'detector',
  version: '0.1.0',
  title: 'Headless browser signs',
  description: 'HeadlessChrome in UA or client hints, values no real browser produces (non-ANGLE WebGL on desktop Chromium, invalid client-hint platform), empty plugins/languages, UA vs client-hint mismatch, software WebGL, zero outer window size, missing window.chrome.',
  weight: 'medium',
  phase: 'static',
  tags: ['headless', 'fingerprint'],
  lists: { softRenderers: 'software-renderers' },
  limitations: [
    'New headless Chrome (--headless=new) and stealth plugins fix most of these.',
    'Software WebGL (SwiftShader, llvmpipe) also appears in VMs, remote desktops and GPU-blocklisted machines.',
    'Extension agents run in a real headed browser and pass every check.',
  ],
  defaults: {
    softRenderers: ['SwiftShader', 'llvmpipe', 'softpipe', 'Mesa OffScreen', 'Google SwiftShader'],
  },

  start(ctx) {
    const { window: win, document: doc, config } = ctx;
    const nav = win.navigator ?? {};
    const ua = nav.userAgent ?? '';
    const chromium = /\b(?:Chrome|Chromium)\/\d+/.test(ua);
    const mobile = /Mobile|Android/.test(ua);
    const hard = [];
    const soft = [];
    // Values a real browser cannot produce: someone overrode them (stealth kits, anti-detect browsers).
    const spoofed = [];

    if (/HeadlessChrome/.test(ua)) hard.push('userAgent contains HeadlessChrome');
    const brands = nav.userAgentData?.brands ?? [];
    if (brands.some((b) => /Headless/i.test(b.brand))) hard.push('client-hint brand contains Headless');

    if (chromium && !mobile && nav.plugins && nav.plugins.length === 0) soft.push('navigator.plugins is empty');
    if (!nav.languages || nav.languages.length === 0) soft.push('navigator.languages is empty');

    if (chromium && !nav.userAgentData) soft.push('Chromium UA without navigator.userAgentData');
    if (nav.userAgentData) {
      const hinted = nav.userAgentData.platform;
      const claimed = platformFromUA(ua);
      if (hinted && !CLIENT_HINT_PLATFORMS.includes(hinted)) spoofed.push(`client-hint platform "${hinted}" is not a value browsers send`);
      else if (hinted && claimed && hinted !== claimed) soft.push(`platform mismatch: UA says ${claimed}, client hints say ${hinted}`);
      const uaMajor = ua.match(/Chrome\/(\d+)/)?.[1];
      const brandMajor = brands.find((b) => /Chrom/.test(b.brand))?.version;
      if (uaMajor && brandMajor && uaMajor !== brandMajor) soft.push(`version mismatch: UA ${uaMajor}, client hints ${brandMajor}`);
    }

    const renderer = webglRenderer(doc);
    if (renderer && config.softRenderers.some((name) => renderer.includes(name))) soft.push(`software WebGL renderer: ${renderer}`);
    // Desktop Chromium has reported "ANGLE (vendor, renderer…)" for years; anything else is a spoofed value
    // (puppeteer-extra stealth reports "Intel Iris OpenGL Engine", seen on an Apple M3 on 2026-10-24).
    else if (renderer && chromium && !mobile && !renderer.startsWith('ANGLE')) spoofed.push(`non-ANGLE WebGL renderer on desktop Chromium: ${renderer}`);

    if (win.outerWidth === 0 || win.outerHeight === 0) soft.push(`outer window size ${win.outerWidth}x${win.outerHeight}`);
    if (chromium && !win.chrome) soft.push('Chromium UA without window.chrome');

    const evidence = { hard, spoofed, soft, renderer, userAgent: ua };
    if (hard.length) return ctx.report({ status: 'detected', weight: 'strong', evidence });
    if (spoofed.length || soft.length >= 3) return ctx.report({ status: 'detected', evidence });
    if (soft.length) return ctx.report({ status: 'suspicious', evidence });
    return ctx.report({ status: 'clean', evidence });
  },
};

// The values navigator.userAgentData.platform can take (UA client hints spec).
const CLIENT_HINT_PLATFORMS = ['Android', 'Chrome OS', 'Chromium OS', 'Fuchsia', 'iOS', 'Linux', 'macOS', 'Windows', 'Unknown'];

function platformFromUA(ua) {
  if (/Windows/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return 'Android';
  if (/CrOS/.test(ua)) return 'Chrome OS';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return null;
}

function webglRenderer(doc) {
  if (!doc?.createElement) return null;
  try {
    const gl = doc.createElement('canvas').getContext('webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  } catch {
    return null;
  }
}
