import { CONFIG, NEWS, NEWS_BODY, THREADS, REVIVAL_THREAD, PRIVACY_THREAD, FLOOD_THREAD } from './board-data.js';
import { TARGET_BUILDING } from './data.js';

// 進行・ルート・保存を扱う純粋関数群。DOMには触れない（テスト対象）。
//
// 用語:
//   archive  … 魚拓サービスの検索画面（#/archive, 2ページ目）
//   snapshot … 魚拓に保存された世代 latest / middle / oldest（3〜5ページ目）
//   live     … 管理者が復元した現行サイト（7ページ目）。snapshot 引数に 'live' を渡す関数もある
//
// 進行（phase）:
//   closed    … 閉鎖中。1〜6ページを行き来する
//   restored  … 管理者画面でサイトを復元した。ニュースが出て、現場の投稿を待っている
//   published … 現場の事故情報を地図に掲載した（サイト公開の意味ではない）。拡散演出が進む
//   complete  … 管理者画面でサイトを再び閉鎖した。クリア（8ページ目）
// 保存データの phase 名を変えると既存の進行が無効になるため、変える場合は version も上げる。
export const PHASES = ['closed', 'restored', 'published', 'complete'];
// sv-SE は日付を YYYY-MM-DD 形式で出すため、ISO形式の日本時間の日付文字列として使う。
const tokyoDateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
/** 日本時間の YYYY-MM-DD を返す。 */
export function localDate(timestamp = Date.now()) {
  return tokyoDateFormat.format(new Date(timestamp));
}
export function dateShift(date, days) {
  // 日本時間の正午を基準にし、端末のタイムゾーンやサマータイムで日付がずれないようにする。
  const value = new Date(date + 'T12:00:00+09:00');
  value.setUTCDate(value.getUTCDate() + days);
  return localDate(value.getTime());
}
// startedAt は初回プレイ時刻、storyDate はその日本時間の日付（最新の魚拓の日付の基準）。
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
  // ニュース到着前には掲載できないため。CONFIG.newsDelay を増やすと、それ以前の掲載済みセーブはここで無効になる。
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
  if (CONFIG.archiveSearchNames.includes(name)) return true;
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
// 進行を1段だけ進める。条件を満たさない操作は同じ state を返す（呼び出し側は参照比較で変化を判定）。
// Math.max は端末の時計が巻き戻った場合でも時刻の順序（isValidState の条件）を保つため。
export function transition(state, action, now = Date.now()) {
  if (action.type === 'restore' && state.phase === 'closed') return { ...state, phase: 'restored', restoredAt: Math.max(now, state.startedAt) };
  if (action.type === 'publish' && state.phase === 'restored' && newsIsVisible(state, now) && validateReport(action.report).ok) return { ...state, phase: 'published', publishedAt: now };
  if (action.type === 'close' && state.phase === 'published') return { ...state, phase: 'complete', completedAt: Math.max(now, state.publishedAt) };
  return state;
}
export function hasReported(state) {
  return state.phase === 'published' || state.phase === 'complete';
}
export function viewerCount(state, now = Date.now()) {
  if (state.phase === 'published') {
    const { min, max, curve } = CONFIG.floodViewers;
    const ratio = Math.min(1, Math.max(0, now - state.publishedAt) / CONFIG.floodDuration);
    return Math.min(max, Math.floor(min + (max - min) * Math.pow(ratio, curve)));
  }
  if (!newsIsVisible(state, now)) return 1;
  const { min, max } = CONFIG.quietViewers;
  return Math.min(max, min + Math.floor(Math.max(0, now - state.restoredAt - CONFIG.newsDelay) / CONFIG.quietViewerInterval));
}
// snapshot は保存世代か 'live'。live ではニュース到着後に復元スレッド、掲載後に拡散スレッドなどが先頭に加わる。
export function visibleThreads(snapshot, state, now = Date.now()) {
  const base = THREADS.filter(thread => thread.snapshots.includes(snapshot));
  if (snapshot !== 'live' || !newsIsVisible(state, now)) return base;
  if (!hasReported(state)) return [REVIVAL_THREAD, ...base];
  const count = Math.min(FLOOD_THREAD.posts.length, CONFIG.floodInitialPosts + Math.floor(Math.max(0, now - state.publishedAt) / CONFIG.floodPostInterval));
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
/** クリア前のサイトの入口。閉鎖中なら閉鎖のお知らせ、復元後なら現行サイト。 */
export function siteEntryHash(state) {
  return state.phase === 'closed' ? '#/closed' : '#/live';
}
// 現在の進行で表示できないルートを振り分ける。{ redirect, login? } か { route } を返す。
// lastArchiveQuery は魚拓で最後に検索した語。検索語なしで魚拓を開いたら、その検索結果へ振り替える。
export function resolveRoute(route, state, authenticated, lastArchiveQuery = '') {
  if (route.type === 'archive' && !route.params.has('q') && lastArchiveQuery) return { redirect: '#/archive?q=' + encodeURIComponent(lastArchiveQuery) };
  if (route.type === 'home') return { redirect: state.phase === 'complete' ? '#/ending' : siteEntryHash(state) };
  if (state.phase === 'complete' && ['closed', 'live', 'admin'].includes(route.type)) return { redirect: '#/ending' };
  if (route.type === 'closed' && state.phase !== 'closed') return { redirect: '#/live' };
  if (route.type === 'ending' && state.phase !== 'complete') return { redirect: siteEntryHash(state) };
  if (route.type === 'live' && state.phase === 'closed') return { redirect: '#/closed' };
  if (route.type === 'admin' && !authenticated) return { redirect: siteEntryHash(state), login: true };
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
