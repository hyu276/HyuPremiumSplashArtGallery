"use strict";
(() => {
  if (window.__HYU_ADMIN_FETCH_GUARD__) return;

  const nativeFetch = window.fetch.bind(window);
  const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
  const LEGACY_R2_HOST = 'hyu-premium-media.csquocnguyen.workers.dev';
  const R2_V2_HOST = 'hyu-premium-media-v2.csquocnguyen.workers.dev';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function rewriteLegacyAdminR2Input(input) {
    if (typeof Request !== 'undefined' && input instanceof Request) return input;
    try {
      const url = new URL(String(input), window.location.href);
      if (url.hostname === LEGACY_R2_HOST && url.pathname.includes('/admin/media/')) {
        url.protocol = 'https:';
        url.host = R2_V2_HOST;
        return url.href;
      }
    } catch {}
    return input;
  }

  function requestMeta(input, init) {
    const request = typeof Request !== 'undefined' && input instanceof Request ? input : null;
    const rawUrl = request ? request.url : String(input);
    const method = String(init?.method || request?.method || 'GET').toUpperCase();
    let url;
    try { url = new URL(rawUrl, window.location.href); }
    catch { url = new URL(window.location.href); }
    return { request, url, method };
  }

  function targetName(url) {
    if (url.pathname.includes('/api/admin-backend')) return 'Vercel Admin API';
    if (url.pathname.includes('/admin/media/')) return 'Cloudflare R2';
    return url.hostname || 'dịch vụ mạng';
  }

  function safeToRetry(input, init, method, url) {
    if (typeof Request !== 'undefined' && input instanceof Request) return false;
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || method === 'DELETE') return true;
    return method === 'PUT' && url.pathname.includes('/admin/media/') && init?.body instanceof Blob;
  }

  function timeoutMs(method, url) {
    if (method === 'PUT' && url.pathname.includes('/admin/media/')) return 45000;
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || method === 'DELETE') return 20000;
    return 0;
  }

  function retryDelay(response, attempt) {
    const raw = response?.headers?.get?.('retry-after');
    const seconds = raw && /^\d+$/.test(raw) ? Number(raw) : 0;
    if (seconds > 0) return Math.min(seconds * 1000, 1500);
    return 350 + attempt * 450;
  }

  async function fetchAttempt(input, init, timeout) {
    if (!timeout || typeof AbortController === 'undefined') return nativeFetch(input, init);
    const controller = new AbortController();
    const externalSignal = init?.signal;
    let detach = null;
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort(externalSignal.reason);
      else {
        const forwardAbort = () => controller.abort(externalSignal.reason);
        externalSignal.addEventListener('abort', forwardAbort, { once: true });
        detach = () => externalSignal.removeEventListener('abort', forwardAbort);
      }
    }
    const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeout);
    try {
      return await nativeFetch(input, { ...(init || {}), signal: controller.signal });
    } finally {
      clearTimeout(timer);
      detach?.();
    }
  }

  function networkError(error, target, method, attempts) {
    const timedOut = error?.name === 'AbortError' || error?.name === 'TimeoutError';
    const reason = timedOut ? 'quá thời gian chờ' : 'lỗi mạng/CORS hoặc dịch vụ tạm thời không phản hồi';
    const retryText = attempts > 1 ? ` sau ${attempts} lần thử` : '';
    return new Error(`Không thể kết nối tới ${target}${retryText}: ${reason}. Bản nháp trong tab vẫn được giữ nguyên; hãy thử lại thao tác ${method}.`);
  }

  window.fetch = async function guardedFetch(input, init) {
    const routedInput = rewriteLegacyAdminR2Input(input);
    const { url, method } = requestMeta(routedInput, init);
    const canRetry = safeToRetry(routedInput, init, method, url);
    const maxAttempts = canRetry ? 2 : 1;
    const timeout = timeoutMs(method, url);
    let lastError;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await fetchAttempt(routedInput, init, timeout);
        if (attempt + 1 < maxAttempts && RETRYABLE_STATUS.has(response.status)) {
          await sleep(retryDelay(response, attempt));
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt + 1 < maxAttempts) {
          await sleep(350 + attempt * 450);
          continue;
        }
      }
    }

    throw networkError(lastError, targetName(url), method, maxAttempts);
  };

  Object.defineProperty(window, '__HYU_ADMIN_FETCH_GUARD__', {
    value: { version: '2026-09-02-r2-v2', nativeFetch },
    configurable: false,
    enumerable: false,
    writable: false
  });
})();
