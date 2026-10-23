import { CONFIG, NEWS, NEWS_BODY, THREADS, REVIVAL_THREAD, PRIVACY_THREAD, FLOOD_THREAD } from './board-data.js';
import { TARGET_BUILDING } from './data.js';

export const PHASES = ['closed', 'restored', 'published', 'complete'];
export function localDate(timestamp = Date.now()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp));
}
export function dateShift(date, days) {
  const value = new Date(date + 'T12:00:00+09:00');
  value.setUTCDate(value.getUTCDate() + days);
  return localDate(value.getTime());
}
export function createState(now = Date.now()) {
  return { version: 1, phase: 'closed', startedAt: now, storyDate: localDate(now), restoredAt: null, publishedAt: null, completedAt: null };
}
export function isValidState(state) {
  if (!state || state.version !== 1 || !PHASES.includes(state.phase)) return false;
  if (!Number.isFinite(state.startedAt) || state.startedAt < 0 || !Number.isFinite(new Date(state.startedAt).getTime())) return false;
  if (state.storyDate !== localDate(state.startedAt)) return false;
  if (state.phase === 'closed') return state.restoredAt === null && state.publishedAt === null && state.completedAt === null;
  if (!Number.isFinite(state.restoredAt) || state.restoredAt < state.startedAt) return false;
  if (state.phase === 'restored') return state.publishedAt === null && state.completedAt === null;
  if (!Number.isFinite(state.publishedAt) || state.publishedAt < state.restoredAt + CONFIG.newsDelay) return false;
  if (state.phase === 'published') return state.completedAt === null;
  return Number.isFinite(state.completedAt) && state.completedAt >= state.publishedAt;
}
export function snapshotDates(state) {
  return { latest: dateShift(state.storyDate, -1), middle: CONFIG.snapshotMiddleDate, oldest: CONFIG.snapshotOldestDate };
}
export function newsIsVisible(state, now = Date.now()) {
  return state.restoredAt !== null && now >= state.restoredAt + CONFIG.newsDelay;
}
export function normalizeText(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/gu, '').trim();
}
export function isCorrectPassword(value) {
  return String(value).trim() === CONFIG.password;
}
export function matchesArchiveQuery(query, siteUrl) {
  const name = normalizeText(query).replace(/[()「」『』]/gu, '').toLowerCase();
  if (name === '三栖田えれβ' || name === '三栖田えれ') return true;
  try {
    const expected = new URL(siteUrl);
    const raw = String(query).trim();
    const candidate = new URL(raw.includes('://') ? raw : expected.protocol + '//' + raw);
    const path = value => value.replace(/\/index\.html$/u, '/').replace(/\/+$/u, '');
    return candidate.origin === expected.origin && path(candidate.pathname) === path(expected.pathname);
  } catch { return false; }
}
export function validateReport(report) {
  const place = TARGET_BUILDING;
  if (report.town !== place.town || String(report.chome) !== String(place.chome) || String(report.lot) !== String(place.lot)) return { ok: false, reason: 'address' };
  const text = normalizeText(report.source);
  const valid = text === normalizeText(NEWS.title) || text.includes(normalizeText(NEWS_BODY));
  return valid ? { ok: true } : { ok: false, reason: 'source' };
}
export function transition(state, action, now = Date.now()) {
  if (action.type === 'restore' && state.phase === 'closed') return { ...state, phase: 'restored', restoredAt: Math.max(now, state.startedAt) };
  if (action.type === 'publish' && state.phase === 'restored' && newsIsVisible(state, now) && validateReport(action.report).ok) return { ...state, phase: 'published', publishedAt: now };
  if (action.type === 'close' && state.phase === 'published') return { ...state, phase: 'complete', completedAt: Math.max(now, state.publishedAt) };
  return state;
}
export function viewerCount(state, now = Date.now()) {
  if (state.phase === 'published') {
    const ratio = Math.min(1, Math.max(0, now - state.publishedAt) / CONFIG.floodDuration);
    return Math.min(999, Math.floor(11 + 988 * Math.pow(ratio, 0.72)));
  }
  if (!newsIsVisible(state, now)) return 1;
  return Math.min(10, 2 + Math.floor(Math.max(0, now - state.restoredAt - CONFIG.newsDelay) / CONFIG.quietViewerInterval));
}
export function visibleThreads(snapshot, state, now = Date.now()) {
  const base = THREADS.filter(thread => thread.snapshots.includes(snapshot));
  if (snapshot !== 'live' || !newsIsVisible(state, now)) return base;
  if (state.phase !== 'published' && state.phase !== 'complete') return [REVIVAL_THREAD, ...base];
  const count = Math.min(FLOOD_THREAD.posts.length, 3 + Math.floor(Math.max(0, now - state.publishedAt) / CONFIG.floodPostInterval));
  return [PRIVACY_THREAD, { ...FLOOD_THREAD, posts: FLOOD_THREAD.posts.slice(0, count) }, REVIVAL_THREAD, ...base];
}
export function parseRoute(hash) {
  const [path, query = ''] = hash.replace(/^#/u, '').split('?');
  const params = new URLSearchParams(query);
  const snapshot = /^\/archive\/(latest|middle|oldest)$/u.exec(path || '');
  if (snapshot) return { type: 'snapshot', snapshot: snapshot[1], params };
  const type = ({ '/closed': 'closed', '/archive': 'archive', '/admin': 'admin', '/live': 'live', '/ending': 'ending' })[path];
  return { type: type || 'home', params };
}
export function resolveRoute(route, state, authenticated) {
  if (route.type === 'home') return { redirect: state.phase === 'complete' ? '#/ending' : state.phase === 'closed' ? '#/closed' : '#/live' };
  if (state.phase === 'complete' && ['closed', 'live', 'admin'].includes(route.type)) return { redirect: '#/ending' };
  if (route.type === 'closed' && state.phase !== 'closed') return { redirect: '#/live' };
  if (route.type === 'ending' && state.phase !== 'complete') return { redirect: state.phase === 'closed' ? '#/closed' : '#/live' };
  if (route.type === 'live' && state.phase === 'closed') return { redirect: '#/closed' };
  if (route.type === 'admin' && !authenticated) return { redirect: state.phase === 'closed' ? '#/closed' : '#/live', login: true };
  return { route };
}
export function createStore(storage, now = Date.now()) {
  let state = createState(now);
  let persistent = true;
  try {
    const raw = storage.getItem(CONFIG.storageKey);
    let saved = null;
    try { saved = raw ? JSON.parse(raw) : null; } catch { /* 壊れた保存データは初期化します。 */ }
    state = isValidState(saved) ? saved : createState(now);
  } catch { persistent = false; }
  try { storage.setItem(CONFIG.storageKey, JSON.stringify(state)); } catch { persistent = false; }
  return {
    get state() { return state; },
    get persistent() { return persistent; },
    dispatch(action, at = Date.now()) {
      const next = transition(state, action, at);
      if (next !== state) {
        state = next;
        try { storage.setItem(CONFIG.storageKey, JSON.stringify(state)); } catch { persistent = false; }
      }
      return state;
    },
    reset(at = Date.now()) {
      state = createState(at);
      try { storage.setItem(CONFIG.storageKey, JSON.stringify(state)); } catch { persistent = false; }
      return state;
    },
    sync() {
      try {
        const next = JSON.parse(storage.getItem(CONFIG.storageKey));
        if (isValidState(next)) state = next;
      } catch { /* 一時的に保存を読めない場合は、このタブの進行を保ちます。 */ }
      return state;
    }
  };
}
