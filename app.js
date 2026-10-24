// 画面の組み立てと操作。ハッシュルート（#/closed, #/archive, #/archive/<世代>, #/admin, #/live, #/ending）ごとに
// #app を描き直す。進行の判定は game-state.js、公開サイトの部品は community.js、地図は map.js に任せる。
import { CONFIG, ADMIN_MEMO, NEWS_BODY, SNAPSHOTS, ABOUT_PARAGRAPHS, ENDING, FLOOD_THREAD } from './board-data.js';
import { ACCIDENTS, recordsForSnapshot, sightingsForSnapshot, TARGET_BUILDING_ID } from './data.js';
import { createStore, parseRoute, resolveRoute, siteEntryHash, snapshotDates, matchesArchiveQuery, isCorrectPassword, newsIsVisible, viewerCount, visibleThreads, validateReport, localDate } from './game-state.js';
import { escapeHTML, dateLabel, makeRoute, breakingNewsHTML, threadListHTML, threadHTML, postHTML, profileHTML, reportHTML, mapHTML, postingHelpHTML, updatesHTML, newsIndexHTML } from './community.js';
import { mountMap, mapRecords } from './map.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#site-dialog');
const dialogContent = document.querySelector('#dialog-content');
const announcer = document.querySelector('#announcer');
// localStorage を使えない環境では null を渡し、createStore がタブ内だけで進行を保持する。
let storage = null;
try { storage = window.localStorage; } catch { /* 保存なしで続行します。 */ }
const store = createStore(storage);
let authenticated = false;
try { authenticated = sessionStorage.getItem(CONFIG.sessionKey) === 'yes'; } catch { /* 保存を使えない場合はタブ内で認証します。 */ }
// 魚拓の検索語。魚拓に戻るたびにサイト名を入れ直さなくてよいよう、最後の検索を覚えておく。
let lastArchiveQuery = '';
try { lastArchiveQuery = storage?.getItem(CONFIG.archiveQueryKey) ?? ''; } catch { /* 保存を使えない場合はタブ内で覚えます。 */ }
// 公開サイト（保存世代・現行サイト）を表示中の状態。render() → publicHTML() が毎回設定する。
let currentRoute, currentBase, currentSnapshot, currentView, mapInstance;
let lastNewsVisible = false, renderedPhase = '', currentKey = '';
// 閉鎖→クリア画面の演出のタイマー。演出中は他の描き直しを止め、render() で必ず解除する。
let closingTimers = [];
const scrollPositions = new Map();
const closedViewers = CONFIG.closedViewers.min + Math.floor(Math.random() * (CONFIG.closedViewers.max - CONFIG.closedViewers.min + 1));
const siteUrl = CONFIG.siteUrl || new URL('./', location.href).href;
const isLive = () => currentRoute?.type === 'live';
const TOTAL_PAGES = 8;
const PAGE_NUMBERS = { closed: 1, archive: 2, admin: 6, live: 7, ending: 8 };

function setAuthentication(value) {
  authenticated = value;
  try { value ? sessionStorage.setItem(CONFIG.sessionKey, 'yes') : sessionStorage.removeItem(CONFIG.sessionKey); } catch { /* タブ内の認証状態で続行します。 */ }
}
function rememberArchiveQuery(query) {
  lastArchiveQuery = query;
  try { query ? storage.setItem(CONFIG.archiveQueryKey, query) : storage.removeItem(CONFIG.archiveQueryKey); } catch { /* タブ内の検索語で続行します。 */ }
}
function navigate(hash, replace = false) {
  if (replace || location.hash === hash) { history.replaceState(null, '', hash); render(); }
  else location.hash = hash;
}
function modal(html) {
  if (dialog.open) dialog.close();
  dialogContent.innerHTML = html;
  dialog.showModal();
  dialog.scrollTop = 0;
}
function login() {
  const digits = CONFIG.password.length;
  modal(`<p class="modal-eyebrow">${escapeHTML(CONFIG.name)}</p><h2 id="modal-title">管理者ログイン</h2>
    <form id="login-form" class="login-form" novalidate><label for="admin-password">パスワード</label>
    <input id="admin-password" name="password" type="password" inputmode="numeric" pattern="[0-9]{${digits}}" maxlength="${digits}" autocomplete="off" required placeholder="${escapeHTML(CONFIG.passwordPlaceholder)}" aria-describedby="password-hint login-error">
    <p class="password-hint" id="password-hint">${escapeHTML(CONFIG.passwordHint)}</p><p id="login-error" class="form-status" role="alert"></p>
    <button class="button button--primary" type="submit">ログイン</button></form>`);
  document.querySelector('#admin-password').focus();
}
function pageNumberHTML(page) {
  return `<span class="page-number" aria-label="全${TOTAL_PAGES}ページ中${page}ページ">${page}<span> / </span>${TOTAL_PAGES}</span>`;
}
function headerHTML(base = '#/closed', archived = false) {
  return `<header class="site-header"><a class="site-brand" href="${base}" aria-label="三栖田えれ ベータ ホーム">三栖田えれ<span>(β)</span></a>
    <button class="admin-link" type="button" data-action="login" ${archived ? 'disabled' : ''}><svg viewBox="0 0 16 18" width="12" height="14" aria-hidden="true"><path d="M4 7V5a4 4 0 0 1 8 0v2M2 7h12v9H2z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>${authenticated && !archived ? '管理者画面' : '管理者ログイン'}</button></header>`;
}
// 全8ページ共通のフッター。ゲームの外側（メタ情報）だけを載せ、物語内のリンクは各ページの本文側に置く。
function footerHTML(page) {
  return `<footer class="site-footer"><button class="footer-about" type="button" data-action="about">このページについて</button>${pageNumberHTML(page)}</footer>`;
}
function viewersHTML(number) {
  return `<div class="viewer-display${store.state.phase === 'published' && isLive() ? ' viewer-display--busy' : ''}"><span class="viewer-dot" aria-hidden="true"></span>現在 <strong data-viewers>${number}</strong> 人が閲覧中</div>`;
}
function closureHTML() {
  return `<div class="site-shell closure-shell">${headerHTML()}<main class="closure-main"><div class="closure-viewers">${viewersHTML(closedViewers)}</div>
    <div class="closure-notice"><p class="closure-caption">お知らせ</p><h1>当サイト「三栖田えれ」は<br>都合により閉鎖いたしました。</h1><p>長らくのご利用ありがとうございました。</p><div class="closure-signature">${escapeHTML(CONFIG.name)} 管理人</div></div>
    <p class="closure-archive"><span>お困りですか？ 提携システム：</span><a href="#/archive">WEBアーカイブを利用する</a></p>
    </main>${footerHTML(PAGE_NUMBERS.closed)}</div>`;
}
function archiveResultItemHTML({ key, label }, date) {
  return `<li><a href="#/archive/${key}"><div class="archive-result-date"><span>${date.slice(0, 4)}</span><strong>${date.slice(5).replace('-', '/')}</strong></div><div class="archive-result-text"><span class="archive-result-tag">${escapeHTML(label)}</span><h3>${escapeHTML(CONFIG.name)}</h3><p>${dateLabel(date)} 保存のページを表示</p></div><span class="result-arrow" aria-hidden="true">→</span></a></li>`;
}
function archiveHTML(query = '') {
  const dates = snapshotDates(store.state);
  const hasQuery = currentRoute.params.has('q');
  const found = hasQuery && matchesArchiveQuery(query, siteUrl);
  const resultsHTML = found
    ? `<p class="result-url">${escapeHTML(siteUrl)}</p><ol>${SNAPSHOTS.map(snapshot => archiveResultItemHTML(snapshot, dates[snapshot.key])).join('')}</ol>`
    : '<p class="no-results">アーカイブが存在しません</p><p class="search-help">サイト名またはURLをご確認ください。</p>';
  return `<div class="site-shell archive-service"><header class="archive-service-header"><a href="#/closed">← 元のページへ</a><span>WEB ARCHIVE SERVICE</span></header>
    <main class="archive-search-main"><div class="archive-wordmark"><span class="archive-symbol" aria-hidden="true">魚拓</span><h1>インターネット魚拓</h1><p>インターネットウェブページの保存・検索アーカイブ</p></div>
    <section class="archive-search" aria-labelledby="search-heading"><h2 id="search-heading">保存されたページを探す</h2>
      <form id="archive-search-form"><label class="sr-only" for="archive-query">サイト名またはURL</label><input id="archive-query" name="query" type="search" maxlength="300" required autocomplete="off" value="${escapeHTML(query)}" placeholder="サイト名またはURLを入力"><button type="submit">検索</button></form>
      <p class="search-help">サイト名・URLから、過去に保存されたページを検索できます。</p>
    </section>
    ${hasQuery ? `<section class="archive-results" aria-live="polite"><div class="search-result-heading"><h2>検索結果</h2><span>${found ? SNAPSHOTS.length + '件の保存記録' : '0件'}</span></div>
      ${resultsHTML}
    </section>` : '<div class="archive-service-note"><h3>消えてしまったページにも、記録を。</h3><p>当サービスはウェブページを保存し、過去の姿を閲覧するためのサービスです。<br>保存されたページの内容は、保存当時のものです。</p></div>'}
    </main>${footerHTML(PAGE_NUMBERS.archive)}</div>`;
}
function liveNoticeHTML(now) {
  if (!isLive() || !newsIsVisible(store.state, now)) return '';
  return `<a class="new-post-notice" href="#/live?view=board"><span class="new-post-label">新着</span>市民掲示板に新しい書き込みがあります。<span aria-hidden="true">→</span></a>`;
}
function sidebarBoardHTML(threads) {
  return '<h2>市民掲示板より</h2>' + threads.slice(0, 3).map(thread => `<a href="${makeRoute(currentBase, 'board', { thread: thread.id })}">${escapeHTML(thread.title)}</a>`).join('');
}
function sidebarHTML(threads, recordCount) {
  const links = [['map', '事故マップ'], ['post', '投稿方法'], ['news', 'ニュース'], ['updates', '新着情報'], ['board', '市民掲示板'], ['profile', '管理人について']];
  const badge = key => key === 'map' ? `<small>${recordCount}</small>` : key === 'board' ? `<small data-board-count>${threads.length}</small>` : '';
  return `<aside class="site-sidebar"><p class="sidebar-label">三栖田市のエレベーター事故</p><nav class="section-nav" aria-label="サイトメニュー">${links.map(([key, label]) => `<a href="${makeRoute(currentBase, key)}" ${currentView === key ? 'aria-current="page"' : ''}><span>${label}</span>${badge(key)}</a>`).join('')}<a href="#/archive"><span>WEBアーカイブ</span></a></nav>
    <div class="sidebar-note"><h2>情報をお寄せください</h2><p>町内で起きたエレベーター事故を記録しています。小さな情報でも、ご協力をお願いします。</p><button class="text-link" type="button" data-action="report">事故情報の投稿 →</button></div>
    <div class="sidebar-board">${sidebarBoardHTML(threads)}</div>
    <p class="sidebar-footnote">投稿の際は、被害に遭われた方や<br>ご家族への配慮をお願いします。</p></aside>`;
}
function contentHTML(records, plottedRecords, threads, sightings, now) {
  const archived = currentRoute.type === 'snapshot';
  if (currentView === 'post') return postingHelpHTML();
  if (currentView === 'profile') return `<div class="document-page">${profileHTML(currentSnapshot)}</div>`;
  if (currentView === 'updates') return updatesHTML(currentSnapshot, archived ? snapshotDates(store.state)[currentSnapshot] : localDate(store.state.restoredAt), records);
  if (currentView === 'news') return `<div id="breaking-article">${!archived && newsIsVisible(store.state, now) ? breakingNewsHTML(store.state) : ''}</div>${newsIndexHTML(records, currentBase)}`;
  if (currentView === 'board') {
    const thread = threads.find(item => item.id === currentRoute.params.get('thread'));
    return thread ? threadHTML(thread, currentBase, store.state) : threadListHTML(threads, currentBase, store.state);
  }
  return mapHTML(plottedRecords, sightings);
}
function publicHTML(now) {
  const archived = currentRoute.type === 'snapshot';
  const dates = snapshotDates(store.state);
  currentSnapshot = archived ? currentRoute.snapshot : 'live';
  currentBase = archived ? '#/archive/' + currentSnapshot : '#/live';
  currentView = ['map', 'board', 'post', 'news', 'updates', 'profile'].includes(currentRoute.params.get('view')) ? currentRoute.params.get('view') : 'map';
  const records = archived ? recordsForSnapshot(currentSnapshot, dates) : ACCIDENTS;
  const plottedRecords = mapRecords(records, store.state, !archived && store.state.phase === 'published');
  const threads = visibleThreads(currentSnapshot, store.state, now);
  const sightings = sightingsForSnapshot(currentSnapshot, dates);
  const page = archived ? SNAPSHOTS.find(snapshot => snapshot.key === currentSnapshot).page : PAGE_NUMBERS.live;
  const archiveListLink = `#/archive?q=${encodeURIComponent(CONFIG.name)}`;
  const archivedBar = archived ? `<div class="archive-capture-bar"><a href="${archiveListLink}"><span aria-hidden="true">←</span> 保存一覧へ戻る</a><span>${dateLabel(dates[currentSnapshot])} の保存ページ<span class="capture-readonly">／閲覧専用</span></span></div>` : '';
  return { html: `<div class="site-shell public-shell">${archivedBar}${headerHTML(currentBase, archived)}
    <div class="site-status-line"><span>三栖田市の事故情報を記録しています。</span>${viewersHTML(archived ? 1 : viewerCount(store.state, now))}</div>
    <div id="live-notice">${liveNoticeHTML(now)}</div>
    <main class="public-layout">${sidebarHTML(threads, plottedRecords.length)}<section class="content-panel" id="content-panel" aria-label="${currentView === 'board' ? '市民掲示板' : '掲載情報'}">${contentHTML(records, plottedRecords, threads, sightings, now)}</section></main>
    ${footerHTML(page)}</div>`, plottedRecords, sightings };
}
// 管理者画面下部の操作。閉鎖中は「復元」、現場掲載後は「再閉鎖」（クリア条件）、その間は公開中の案内。
function adminOperationHTML(phase) {
  if (phase === 'closed') return '<p>保存されている内容を使って、サイトの公開を再開します。</p><button class="admin-operation-button" type="button" data-action="restore">サイトを復元</button>';
  if (phase === 'published') return '<p>サイトを閉鎖すると、公開中の地図と掲示板は閲覧できなくなります。</p><button class="admin-operation-button admin-operation-button--close" type="button" data-action="close-site">サイトを閉鎖</button>';
  return '<p class="admin-public-message"><span aria-hidden="true">●</span> サイトを公開しています。</p><a href="#/live">公開中のサイトを開く →</a>';
}
function adminHTML() {
  const state = store.state;
  const memoHTML = ADMIN_MEMO.map(({ text, emphasis }) => `<p class="${emphasis ? 'memo-' + emphasis : ''}">${escapeHTML(text)}</p>`).join('');
  return `<div class="admin-shell"><header class="admin-header"><a href="${siteEntryHash(state)}">三栖田えれ<span>(β)</span><small>管理者ページ</small></a><button type="button" data-action="logout">ログアウト</button></header>
    <main class="admin-layout"><aside class="admin-sidebar"><p>CONTROL PANEL</p><a href="#/admin" aria-current="page">考察メモ</a><button disabled>投稿の承認</button><button disabled>アクセス解析</button><button disabled>登録情報</button><button disabled>システム設定</button><div class="admin-site-state"><span>サイトの状態</span><strong>${state.phase === 'closed' ? '閉鎖中' : '公開中'}</strong></div></aside>
    <div class="admin-content"><div class="admin-breadcrumb">管理者専用 / 個人メモ</div><article class="admin-memo" id="admin-note"><p class="admin-note-label">PRIVATE NOTE</p><h1>考察メモ</h1>
      ${memoHTML}
    </article><section class="admin-operation" aria-label="サイトの公開設定"><h2>サイトの公開設定</h2>
      ${adminOperationHTML(state.phase)}
    </section></div></main>${footerHTML(PAGE_NUMBERS.admin)}</div>`;
}
function endingHTML() {
  const share = new URL('https://twitter.com/intent/tweet');
  share.searchParams.set('text', ENDING.shareText); share.searchParams.set('url', siteUrl);
  return `<div class="ending-shell"><main class="ending-main"><section class="ending-story"><span class="ending-floor" aria-hidden="true">08</span><p class="ending-congratulations">おめでとうございます。</p>
    <h1>あなたは事故の裏側を知った上で<br>サイトを再び閉鎖し<br>被害者のプライベートを守りました。</h1>
    <p class="ending-afterword">行方不明になった５名は、<br>今もどこかの階層を彷徨っているのかも知れません。</p>
    <a class="share-button" href="${escapeHTML(share.href)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">𝕏</span> Xで結果を共有する <span aria-hidden="true">↗</span></a>
    </section><section class="ending-promotion"><p class="ending-question">消えた５人の運命は？</p><h2>兄を探しに向かった<br>「エレベーターおとこ」を<br>待ち受ける世界とは――。</h2>
      <p>５人の男女が迷い込んだ異世界。<br>しゃべるエレベーター。<br>彼らが探すものとは一体何なのか。</p>
      <div class="game-wordmark"><small>マジックリアリズム・パズルアドベンチャー</small><strong>ミスターエレベーター</strong><span>MR. ELEVATOR</span></div>
      <p class="release-line">${escapeHTML(CONFIG.releaseLabel)}</p><a class="store-button" href="${escapeHTML(CONFIG.promotionUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(CONFIG.promotionLabel)} <span aria-hidden="true">↗</span></a>
    </section><p class="ending-fiction">このゲームは「ミスターエレベーター」の番外編WebARGです。<br>登場する地名・人物・事件はすべて架空です。</p><button class="replay-button" data-action="replay">最初から遊ぶ</button></main>
    ${footerHTML(PAGE_NUMBERS.ending)}</div>`;
}
function stopClosingTransition() {
  closingTimers.forEach(clearTimeout); closingTimers = [];
  app.inert = false;
}
// サイト閉鎖後、1ページ目の閉鎖のお知らせを closingNoticeHold だけ見せ、closingFadeDuration かけて暗転してから8ページ目へ進む。
// 進行は呼び出し前に complete として保存済みなので、途中で再読み込みしても8ページ目から再開できる。
function playClosingTransition() {
  stopClosingTransition();
  mapInstance?.destroy(); mapInstance = null;
  if (dialog.open) dialog.close();
  app.innerHTML = closureHTML() + '<div class="closing-curtain" aria-hidden="true"></div>';
  app.inert = true;
  document.body.dataset.screen = 'closed';
  document.title = '閉鎖のお知らせ | ' + CONFIG.name;
  document.querySelector('meta[name="theme-color"]').content = '#f5f4ee';
  window.scrollTo({ top: 0, behavior: 'instant' });
  const curtain = app.querySelector('.closing-curtain');
  curtain.style.setProperty('--closing-fade', CONFIG.closingFadeDuration + 'ms');
  closingTimers.push(setTimeout(() => {
    curtain.classList.add('is-dark');
    closingTimers.push(setTimeout(() => navigate('#/ending'), CONFIG.closingFadeDuration));
  }, CONFIG.closingNoticeHold));
}
function render(options = {}) {
  stopClosingTransition();
  const previousScroll = window.scrollY;
  if (currentKey) scrollPositions.set(currentKey, previousScroll);
  mapInstance?.destroy(); mapInstance = null;
  if (dialog.open) dialog.close();
  let requested = parseRoute(location.hash);
  const resolved = resolveRoute(requested, store.state, authenticated, lastArchiveQuery);
  if (resolved.redirect) { history.replaceState(null, '', resolved.redirect); requested = parseRoute(resolved.redirect); }
  currentRoute = requested; currentKey = location.hash;
  currentBase = ''; currentSnapshot = ''; currentView = '';
  const now = Date.now();
  document.body.dataset.screen = currentRoute.type;
  let publicView;
  if (currentRoute.type === 'closed') app.innerHTML = closureHTML();
  if (currentRoute.type === 'archive') {
    const query = currentRoute.params.get('q') ?? '';
    if (query.trim() && query !== lastArchiveQuery) rememberArchiveQuery(query);
    app.innerHTML = archiveHTML(query);
  }
  if (currentRoute.type === 'admin') app.innerHTML = adminHTML();
  if (currentRoute.type === 'ending') app.innerHTML = endingHTML();
  if (['snapshot', 'live'].includes(currentRoute.type)) { publicView = publicHTML(now); app.innerHTML = publicView.html; }
  if (!store.persistent) app.insertAdjacentHTML('beforeend', '<p class="storage-note" role="status">このブラウザーでは進行を保存できません。このタブを開いたままプレイしてください。</p>');
  const titles = { closed: '閉鎖のお知らせ', archive: 'インターネット魚拓', admin: '管理者画面', ending: 'クリア' };
  document.title = (titles[currentRoute.type] || (currentRoute.type === 'snapshot' ? 'アーカイブ ' + dateLabel(snapshotDates(store.state)[currentSnapshot]) : '事故マップ')) + ' | ' + CONFIG.name;
  document.querySelector('meta[name="theme-color"]').content = ['admin', 'ending'].includes(currentRoute.type) ? '#101516' : '#f5f4ee';
  const stage = document.querySelector('#map-stage');
  if (stage && publicView) {
    mapInstance = mountMap(stage, {
      plottedRecords: publicView.plottedRecords, sightings: publicView.sightings,
      // 選択中の施設・目撃をURLに残し、再読み込みや戻る操作で同じ詳細を開けるようにする。
      onSelect(buildingId, sightingId = null) {
        const params = new URLSearchParams(currentRoute.params);
        if (buildingId) params.set('building', buildingId); else params.delete('building');
        if (sightingId) params.set('sighting', sightingId); else params.delete('sighting');
        const query = params.toString();
        const next = currentBase + (query ? '?' + query : '');
        history.replaceState(null, '', next); currentRoute.params = params; currentKey = next;
      }
    });
    const building = currentRoute.params.get('building');
    const sighting = currentRoute.params.get('sighting');
    if (sighting) mapInstance.selectSighting(sighting);
    else if (building) mapInstance.selectBuilding(building);
  }
  renderedPhase = store.state.phase;
  lastNewsVisible = newsIsVisible(store.state, now);
  requestAnimationFrame(() => window.scrollTo({ top: options.preserveScroll ? previousScroll : (scrollPositions.get(currentKey) || 0), behavior: 'instant' }));
  if (resolved.login) login();
}
function openReport() {
  // 保存ページでは当時のボタンが残っているだけで、押しても何も起きない。
  if (!isLive()) return;
  if (store.state.phase === 'published') { modal('<h2 id="modal-title">事故情報を掲載しました</h2><p>お寄せいただいた事故情報は、地図に掲載されています。</p>'); return; }
  modal(reportHTML());
}

// 現行サイトの時間経過による変化を、画面全体を描き直さずに反映する（CONFIG.tickInterval ごと）。
// ニュース到着（復元から newsDelay 後）の部分差し替えと、現場掲載後の閲覧人数・拡散スレッドの増加を扱う。
function refreshViewerCount(now) {
  const viewers = document.querySelector('[data-viewers]');
  const count = String(viewerCount(store.state, now));
  if (viewers && viewers.textContent !== count) viewers.textContent = count;
}
function revealNewsArrival(threads, now) {
  lastNewsVisible = true;
  document.querySelector('#live-notice').innerHTML = liveNoticeHTML(now);
  document.querySelector('[data-board-count]').textContent = threads.length;
  document.querySelector('.sidebar-board').innerHTML = sidebarBoardHTML(threads);
  if (currentView === 'board' && !currentRoute.params.has('thread')) document.querySelector('#content-panel').innerHTML = threadListHTML(threads, currentBase, store.state);
  if (currentView === 'news') document.querySelector('#breaking-article').innerHTML = breakingNewsHTML(store.state);
  announcer.textContent = '市民掲示板に新しい書き込みがあります。';
}
function appendFloodPosts(threads) {
  const thread = threads.find(item => item.id === FLOOD_THREAD.id);
  const counter = document.querySelector(`.thread-row[data-thread-id="${FLOOD_THREAD.id}"] .thread-replies`);
  if (counter) counter.textContent = thread.posts.length;
  const posts = document.querySelector(`[data-thread-posts="${FLOOD_THREAD.id}"]`);
  if (posts && posts.children.length < thread.posts.length) {
    const start = posts.children.length;
    posts.insertAdjacentHTML('beforeend', thread.posts.slice(start).map((post, index) => postHTML(post, start + index, thread, store.state)).join(''));
    document.querySelector('[data-post-count]').textContent = thread.posts.length + '件の書き込み';
  }
}
function updateLiveScreen() {
  if (document.hidden || !isLive()) return;
  if (renderedPhase !== store.state.phase) { render({ preserveScroll: true }); return; }
  const now = Date.now();
  refreshViewerCount(now);
  const threads = visibleThreads('live', store.state, now);
  if (newsIsVisible(store.state, now) && !lastNewsVisible) revealNewsArrival(threads, now);
  if (store.state.phase === 'published') appendFloodPosts(threads);
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'dismiss') { dialog.close(); return; }
  if (action === 'login') { authenticated ? navigate('#/admin') : login(); return; }
  if (action === 'logout') { setAuthentication(false); navigate(siteEntryHash(store.state)); return; }
  if (action === 'about') {
    modal('<h2 id="modal-title">このページについて</h2>' + ABOUT_PARAGRAPHS.map(text => `<p>${escapeHTML(text)}</p>`).join(''));
    return;
  }
  if (action === 'report') { openReport(); return; }
  if (action === 'restore' && authenticated && currentRoute.type === 'admin') {
    store.dispatch({ type: 'restore' }); navigate('#/live'); return;
  }
  if (action === 'close-site' && authenticated && currentRoute.type === 'admin' && store.state.phase === 'published') {
    store.dispatch({ type: 'close' }); playClosingTransition(); return;
  }
  if (action === 'replay') {
    modal('<h2 id="modal-title">最初から遊びますか？</h2><p>このブラウザーの進行を消して、閉鎖のお知らせからもう一度始めます。</p><div class="modal-actions"><button class="button" data-action="dismiss">戻る</button><button class="button button--primary" data-action="confirm-replay">最初から遊ぶ</button></div>');
    return;
  }
  if (action === 'confirm-replay' && currentRoute.type === 'ending') {
    store.reset(); setAuthentication(false); rememberArchiveQuery(''); scrollPositions.clear(); navigate('#/closed'); return;
  }
  if (action === 'copy-news') {
    const result = button.closest('.article-bottom').querySelector('.copy-result');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('unavailable');
      await navigator.clipboard.writeText(NEWS_BODY);
      result.textContent = 'コピーしました';
    } catch {
      modal(`<h2 id="modal-title">記事本文をコピー</h2><p>本文を選択し、コピーしてください。</p><textarea class="copy-fallback" readonly aria-label="コピーするニュース本文">${escapeHTML(NEWS_BODY)}</textarea>`);
      dialog.querySelector('textarea').select();
    }
  }
});
document.addEventListener('submit', event => {
  const form = event.target;
  if (form.id === 'archive-search-form') {
    event.preventDefault();
    const query = form.elements.query.value.trim();
    if (query) navigate('#/archive?q=' + encodeURIComponent(query));
  }
  if (form.id === 'login-form') {
    event.preventDefault();
    const field = form.elements.password;
    if (!isCorrectPassword(field.value)) {
      document.querySelector('#login-error').textContent = 'パスワードが違います。';
      field.setAttribute('aria-invalid', 'true'); field.focus(); field.select(); return;
    }
    setAuthentication(true); dialog.close(); navigate('#/admin');
  }
  if (form.id === 'incident-form') {
    event.preventDefault();
    if (!isLive() || store.state.phase !== 'restored') return;
    const report = Object.fromEntries(new FormData(form));
    const result = validateReport(report);
    const status = document.querySelector('#incident-status');
    if (!newsIsVisible(store.state)) { status.textContent = '出典を確認できませんでした。ニュース記事の情報をご確認ください。'; return; }
    if (!result.ok) {
      status.textContent = result.reason === 'address' ? 'この場所は即時掲載に対応していません。所在地と出典をもう一度ご確認ください。' : '出典を確認できませんでした。ニュース記事のタイトル、または本文をそのまま貼り付けてください。';
      return;
    }
    store.dispatch({ type: 'publish', report });
    dialog.close(); announcer.textContent = '事故情報を1件掲載しました。';
    navigate('#/live?view=map&building=' + TARGET_BUILDING_ID);
  }
});
// 背景（ダイアログ枠の外）を押したときだけ閉じる。dialog 自身の余白や、文字選択のドラッグ終端では閉じない。
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  if (!inside) dialog.close();
});
window.addEventListener('hashchange', () => render());
// 別タブで進行が変わったら追従する（sessionStorage はタブごとなので監視しない）。
window.addEventListener('storage', event => {
  if (event.key !== CONFIG.storageKey && event.key !== null) return;
  // 演出中も別タブのリプレイなどは取り込む。描画だけを保留し、演出後のルート判定に最新の進行を使う。
  store.sync();
  if (!closingTimers.length) render({ preserveScroll: true });
});
document.addEventListener('visibilitychange', updateLiveScreen);
render();
setInterval(updateLiveScreen, CONFIG.tickInterval);
