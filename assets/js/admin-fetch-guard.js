"use strict";
(() => {
  if (window.__HYU_ADMIN_FETCH_GUARD__) return;

  const nativeFetch = window.fetch.bind(window);
  const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

  function isR2Put(method, url, init) {
    return method === 'PUT' && url.pathname.includes('/admin/media/') && init?.body instanceof Blob;
  }

  function safeToRetry(input, init, method, url) {
    if (typeof Request !== 'undefined' && input instanceof Request) return false;
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || method === 'DELETE') return true;
    return isR2Put(method, url, init);
  }

  function timeoutMs(method, url, init) {
    if (isR2Put(method, url, init)) {
      const bytes = Number(init?.body?.size || 0);
      const mib = bytes / (1024 * 1024);
      // Large splash-art files can legitimately take longer on mobile/Vietnam uplinks.
      // Keep a hard ceiling so a dead request still terminates.
      return Math.min(180000, Math.max(60000, Math.round(60000 + mib * 12000)));
    }
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || method === 'DELETE') return 20000;
    return 0;
  }

  function maxAttempts(method, url, init, canRetry) {
    if (!canRetry) return 1;
    if (isR2Put(method, url, init)) return 4;
    return 2;
  }

  function retryDelay(response, attempt) {
    const raw = response?.headers?.get?.('retry-after');
    const seconds = raw && /^\d+$/.test(raw) ? Number(raw) : 0;
    if (seconds > 0) return Math.min(seconds * 1000, 4000);
    const exponential = Math.min(4000, 500 * (2 ** attempt));
    return exponential + Math.floor(Math.random() * 250);
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
      return await nativeFetch(input, { ...(init || {}), signal: controller.signal, cache: init?.cache || 'no-store' });
    } finally {
      clearTimeout(timer);
      detach?.();
    }
  }

  function networkError(error, target, method, attempts) {
    const timedOut = error?.name === 'AbortError' || error?.name === 'TimeoutError';
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const reason = offline ? 'thiết bị đang offline' : timedOut ? 'quá thời gian chờ' : 'kết nối tới Worker bị ngắt trước khi nhận được phản hồi CORS/HTTP';
    const retryText = attempts > 1 ? ` sau ${attempts} lần thử` : '';
    return new Error(`Không thể kết nối tới ${target}${retryText}: ${reason}. Bản nháp trong tab vẫn được giữ nguyên; hãy giữ tab này mở và thử lại thao tác ${method}.`);
  }

  window.fetch = async function guardedFetch(input, init) {
    const { url, method } = requestMeta(input, init);
    const canRetry = safeToRetry(input, init, method, url);
    const attempts = maxAttempts(method, url, init, canRetry);
    const timeout = timeoutMs(method, url, init);
    let lastError;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetchAttempt(input, init, timeout);
        if (attempt + 1 < attempts && RETRYABLE_STATUS.has(response.status)) {
          await sleep(retryDelay(response, attempt));
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt + 1 < attempts) {
          await sleep(retryDelay(null, attempt));
          continue;
        }
      }
    }

    throw networkError(lastError, targetName(url), method, attempts);
  };

  Object.defineProperty(window, '__HYU_ADMIN_FETCH_GUARD__', {
    value: { version: '2026-09-12', nativeFetch },
    configurable: false,
    enumerable: false,
    writable: false
  });
})();
