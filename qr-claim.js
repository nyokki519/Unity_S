/* Claim secrets stay in this page's memory; only their hash enters Google Forms. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.UnityQrClaim = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const endpoint = 'https://unity-qr-free-79cc330c2434.kukki519.workers.dev/api/v2/form/config';
  function validate(info, entries) {
    return !!(info && info.version === 1 && info.enabled === true &&
      /^entry\.\d{1,20}$/.test(info.entry) && !Object.values(entries || {}).includes(info.entry));
  }
  async function create(cryptoApi) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(32));
    const code = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(code));
    return { code, hash: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('') };
  }
  function message(code) {
    if (!/^[a-f0-9]{64}$/.test(code)) throw Error('invalid_claim');
    return '参加QR ' + code;
  }
  function link(code) { return 'https://line.me/R/oaMessage/%40145gavad/?' + encodeURIComponent(message(code)); }
  return { endpoint, validate, create, message, link };
});
