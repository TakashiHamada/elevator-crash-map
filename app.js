import { CONFIG, ADMIN_MEMO, NEWS_BODY } from './board-data.js';
import { ACCIDENTS, recordsForSnapshot, sightingsForSnapshot, TARGET_BUILDING_ID } from './data.js';
import { createStore, parseRoute, resolveRoute, snapshotDates, matchesArchiveQuery, isCorrectPassword, newsIsVisible, viewerCount, visibleThreads, validateReport, localDate } from './game-state.js';
import { escapeHTML, dateLabel, timeLabel, makeRoute, articleHTML, threadListHTML, threadHTML, postHTML, profileHTML, reportHTML, mapHTML, postingHelpHTML, latestHTML, archivedNewsHTML } from './community.js';
import { mountMap } from './map.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#site-dialog');
const dialogContent = document.querySelector('#dialog-content');
const announcer = document.querySelector('#announcer');
let storage;
try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('unavailable'); }, setItem() { throw new Error('unavailable'); } }; }
const store = createStore(storage);
let authenticated = false;
try { authenticated = sessionStorage.getItem(CONFIG.sessionKey) === 'yes'; } catch { /* 保存を使えない場合はタブ内で認証します。 */ }
let currentRoute, currentBase, currentSnapshot, currentView, mapInstance;
let lastNewsVisible = false, renderedPhase = '', currentKey = '';
const scrollPositions = new Map();
const closedViewers = 1 + Math.floor(Math.random() * 3);
const siteUrl = CONFIG.siteUrl || new URL('./', location.href).href;
const isLive = () => currentRoute?.type === 'live';

function setAuthentication(value) {
  authenticated = value;
  try { value ? sessionStorage.setItem(CONFIG.sessionKey, 'yes') : sessionStorage.removeItem(CONFIG.sessionKey); } catch { /* タブ内の認証状態で続行します。 */ }
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
  modal(`<p class="modal-eyebrow">三栖田えれ(β)</p><h2 id="modal-title">管理者ログイン</h2>
    <form id="login-form" class="login-form" novalidate><label for="admin-password">パスワード</label>
    <input id="admin-password" name="password" type="password" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" autocomplete="off" required placeholder="${CONFIG.passwordHint}" aria-describedby="password-hint login-error">
    <p class="password-hint" id="password-hint">${CONFIG.passwordHint}</p><p id="login-error" class="form-status" role="alert"></p>
    <button class="button button--primary" type="submit">ログイン</button></form>`);
  document.querySelector('#admin-password').focus();
}
function headerHTML(base = '#/closed', archived = false) {
  return `<header class="site-header"><a class="site-brand" href="${base}" aria-label="三栖田えれ ベータ ホーム">三栖田えれ<span>(β)</span></a>
    <button class="admin-link" type="button" data-action="login" ${archived ? 'disabled title="アーカイブではログインできません"' : ''}><svg viewBox="0 0 16 18" width="12" height="14" aria-hidden="true"><path d="M4 7V5a4 4 0 0 1 8 0v2M2 7h12v9H2z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>${authenticated && !archived ? '管理者画面' : '管理者ログイン'}</button></header>`;
}
function footerHTML(page, snapshot = '') {
  return `<footer class="site-footer"><div class="footer-about"><span>© 三栖田えれ(β)</span><button type="button" data-action="about">このサイトについて</button></div>
    <div class="footer-center">${page === 1 ? '<span>お困りですか？ 提携システム：</span><a href="#/archive">WEBアーカイブを利用する</a>' : snapshot ? '<button type="button" data-action="profile">管理人について</button><span class="footer-separator">／</span><a href="#/archive">WEBアーカイブ</a>' : '<a href="#/closed">三栖田えれ(β)</a>'}</div>
    <span class="page-number" aria-label="全8ページ中${page}ページ">${page}<span> / </span>8</span></footer>`;
}
function viewersHTML(number) {
  return `<div class="viewer-display${store.state.phase === 'published' && isLive() ? ' viewer-display--busy' : ''}"><span class="viewer-dot" aria-hidden="true"></span>現在 <strong data-viewers>${number}</strong> 人が閲覧中</div>`;
}
function closureHTML() {
  return `<div class="site-shell closure-shell">${headerHTML()}<main class="closure-main"><div class="closure-viewers">${viewersHTML(closedViewers)}</div>
    <div class="closure-notice"><p class="closure-caption">お知らせ</p><h1>当サイト「三栖田えれ」は<br>都合により閉鎖いたしました。</h1><p>長らくのご利用ありがとうございました。</p><div class="closure-signature">三栖田えれ(β) 管理人</div></div>
    </main>${footerHTML(1)}</div>`;
}
function archiveHTML(query = '') {
  const dates = snapshotDates(store.state);
  const hasQuery = currentRoute.params.has('q');
  const found = hasQuery && matchesArchiveQuery(query, siteUrl);
  return `<div class="site-shell archive-service"><header class="archive-service-header"><a href="#/closed">← 元のページへ</a><span>WEB ARCHIVE SERVICE</span></header>
    <main class="archive-search-main"><div class="archive-wordmark"><span class="archive-symbol" aria-hidden="true">魚拓</span><h1>インターネット魚拓</h1><p>インターネットウェブページの保存・検索アーカイブ</p></div>
    <section class="archive-search" aria-labelledby="search-heading"><h2 id="search-heading">保存されたページを探す</h2>
      <form id="archive-search-form"><label class="sr-only" for="archive-query">サイト名またはURL</label><input id="archive-query" name="query" type="search" maxlength="300" required autocomplete="off" value="${escapeHTML(query)}" placeholder="サイト名またはURLを入力"><button type="submit">検索</button></form>
      <p class="search-help">サイト名・URLから、過去に保存されたページを検索できます。</p>
    </section>
    ${hasQuery ? `<section class="archive-results" aria-live="polite"><div class="search-result-heading"><h2>検索結果</h2><span>${found ? '3件の保存記録' : '0件'}</span></div>
      ${found ? `<p class="result-url">${escapeHTML(siteUrl)}</p><ol>${['latest', 'middle', 'oldest'].map((key, index) => `<li><a href="#/archive/${key}"><div class="archive-result-date"><span>${dates[key].slice(0, 4)}</span><strong>${dates[key].slice(5).replace('-', '/')}</strong></div><div class="archive-result-text"><span class="archive-result-tag">${['最新の保存', '過去の保存', '最初の保存'][index]}</span><h3>三栖田えれ(β)</h3><p>${dateLabel(dates[key])} 保存のページを表示</p></div><span class="result-arrow" aria-hidden="true">→</span></a></li>`).join('')}</ol>` : '<p class="no-results">アーカイブが存在しません</p><p class="search-help">サイト名またはURLをご確認ください。</p>'}
    </section>` : '<div class="archive-service-note"><h3>消えてしまったページにも、記録を。</h3><p>当サービスはウェブページを保存し、過去の姿を閲覧するためのサービスです。<br>保存されたページの内容は、保存当時のものです。</p></div>'}
    </main>${footerHTML(2)}</div>`;
}
function liveNoticeHTML(now) {
  if (!isLive() || !newsIsVisible(store.state, now)) return '';
  return `<a class="new-post-notice" href="#/live?view=board"><span class="new-post-label">新着</span>市民掲示板に新しい書き込みがあります。<span aria-hidden="true">→</span></a>`;
}
function sidebarHTML(threads, records, published) {
  const links = [['map', '事故マップ'], ['post', '投稿方法'], ['news', 'ニュース'], ['updates', '新着情報'], ['board', '市民掲示板']];
  return `<aside class="site-sidebar"><p class="sidebar-label">霧原市のエレベーター事故</p><nav class="section-nav" aria-label="サイトメニュー">${links.map(([key, label]) => `<a href="${makeRoute(currentBase, key)}" ${currentView === key ? 'aria-current="page"' : ''}><span>${label}</span>${key === 'map' ? `<small>${records.length + (published ? 1 : 0)}</small>` : key === 'board' ? `<small data-board-count>${threads.length}</small>` : ''}</a>`).join('')}</nav>
    <div class="sidebar-note"><h2>情報をお寄せください</h2><p>町内で起きたエレベーター事故を記録しています。小さな情報でも、ご協力をお願いします。</p><button class="text-link" type="button" data-action="report">事故情報の投稿 →</button></div>
    <div class="sidebar-board"><h2>市民掲示板より</h2>${threads.slice(0, 3).map(thread => `<a href="${makeRoute(currentBase, 'board', { thread: thread.id })}">${escapeHTML(thread.title)}</a>`).join('')}</div>
    <p class="sidebar-footnote">投稿の際は、被害に遭われた方や<br>ご家族への配慮をお願いします。</p></aside>`;
}
function contentHTML(records, threads, now) {
  const archived = currentRoute.type === 'snapshot';
  if (currentView === 'post') return postingHelpHTML(archived);
  if (currentView === 'updates') return latestHTML(currentSnapshot, archived ? snapshotDates(store.state)[currentSnapshot] : localDate(store.state.restoredAt), records);
  if (currentView === 'news') return `<div id="breaking-article">${!archived && newsIsVisible(store.state, now) ? `<div class="document-page breaking-news"><p class="section-label">最新のニュース</p><h2>町内の事故報道</h2>${articleHTML(store.state)}</div>` : ''}</div>${archivedNewsHTML(records, currentBase)}`;
  if (currentView === 'board') {
    const thread = threads.find(item => item.id === currentRoute.params.get('thread'));
    return thread ? threadHTML(thread, currentBase, store.state) : threadListHTML(threads, currentBase, store.state);
  }
  return mapHTML(records, currentBase, !archived && store.state.phase === 'published', sightingsForSnapshot(currentSnapshot, snapshotDates(store.state)));
}
function publicHTML(now) {
  const archived = currentRoute.type === 'snapshot';
  const dates = snapshotDates(store.state);
  currentSnapshot = archived ? currentRoute.snapshot : 'live';
  currentBase = archived ? '#/archive/' + currentSnapshot : '#/live';
  currentView = ['map', 'board', 'post', 'news', 'updates'].includes(currentRoute.params.get('view')) ? currentRoute.params.get('view') : 'map';
  const records = archived ? recordsForSnapshot(currentSnapshot, dates) : ACCIDENTS;
  const threads = visibleThreads(currentSnapshot, store.state, now);
  const published = !archived && store.state.phase === 'published';
  const page = archived ? ({ latest: 3, middle: 4, oldest: 5 })[currentSnapshot] : 7;
  const archivedBar = archived ? `<div class="archive-capture-bar"><a href="#/archive?q=${encodeURIComponent(CONFIG.name)}"><span aria-hidden="true">↶</span> インターネット魚拓</a><span>${dateLabel(dates[currentSnapshot])} の保存ページ<span class="capture-readonly">／閲覧専用</span></span><a href="#/archive?q=${encodeURIComponent(CONFIG.name)}">保存一覧へ戻る →</a></div>` : '';
  return { html: `<div class="site-shell public-shell">${archivedBar}${headerHTML(currentBase, archived)}
    <div class="site-status-line"><span>霧原市の事故情報を記録しています。</span>${viewersHTML(archived ? 1 : viewerCount(store.state, now))}</div>
    <div id="live-notice">${liveNoticeHTML(now)}</div>
    <main class="public-layout">${sidebarHTML(threads, records, published)}<section class="content-panel" id="content-panel" aria-label="${currentView === 'board' ? '市民掲示板' : '掲載情報'}">${contentHTML(records, threads, now)}</section></main>
    ${footerHTML(page, currentSnapshot)}</div>`, records, published, sightings: sightingsForSnapshot(currentSnapshot, dates) };
}
function adminHTML() {
  const state = store.state;
  return `<div class="admin-shell"><header class="admin-header"><a href="${state.phase === 'closed' ? '#/closed' : '#/live'}">三栖田えれ<span>(β)</span><small>管理者ページ</small></a><button type="button" data-action="logout">ログアウト</button></header>
    <main class="admin-layout"><aside class="admin-sidebar"><p>CONTROL PANEL</p><a href="#/admin" aria-current="page">考察メモ</a><button disabled>投稿の承認</button><button disabled>アクセス解析</button><button disabled>登録情報</button><button disabled>システム設定</button><div class="admin-site-state"><span>サイトの状態</span><strong>${state.phase === 'closed' ? '閉鎖中' : '公開中'}</strong></div></aside>
    <div class="admin-content"><div class="admin-breadcrumb">管理者専用 / 個人メモ</div><article class="admin-memo" id="admin-note"><p class="admin-note-label">PRIVATE NOTE</p><h1>管理人の考察メモ</h1>
      ${ADMIN_MEMO.map((paragraph, index) => `<p class="${index === 11 ? 'memo-resolution' : index === 12 ? 'memo-location' : ''}">${escapeHTML(paragraph)}</p>`).join('')}
    </article><section class="admin-operation" aria-label="サイトの公開設定"><h2>サイトの公開設定</h2>
      ${state.phase === 'closed' ? '<p>保存されている内容を使って、サイトの公開を再開します。</p><button class="admin-operation-button" type="button" data-action="restore">サイトを復元</button>' : state.phase === 'published' ? '<p>サイトを閉鎖すると、公開中の地図と掲示板は閲覧できなくなります。</p><button class="admin-operation-button admin-operation-button--close" type="button" data-action="close-site">サイトを閉鎖</button>' : '<p class="admin-public-message"><span aria-hidden="true">●</span> サイトを公開しています。</p><a href="#/live">公開中のサイトを開く →</a>'}
    </section></div></main><footer class="admin-footer"><span>三栖田えれ(β) / 管理者専用</span><span class="page-number" aria-label="全8ページ中6ページ">6<span> / </span>8</span></footer></div>`;
}
function endingHTML() {
  const text = 'この町で起きたエレベーター事故の裏側を知った。\nあなたは「ミスターエレベーター」の真相の一端に触れた。\n#WebARG #ミスターエレベーター\n\n※このゲームは「ミスターエレベーター」の番外編WebARGです。';
  const share = new URL('https://twitter.com/intent/tweet');
  share.searchParams.set('text', text); share.searchParams.set('url', siteUrl);
  return `<div class="ending-shell"><main class="ending-main"><section class="ending-story"><span class="ending-floor" aria-hidden="true">08</span><p class="ending-congratulations">おめでとうございます。</p>
    <h1>あなたは事故の裏側を知った上で<br>サイトを再び閉鎖し<br>被害者のプライベートを守りました。</h1>
    <p class="ending-afterword">行方不明になった５名は、<br>今もどこかの階層を彷徨っているのかも知れません。</p>
    <a class="share-button" href="${escapeHTML(share.href)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">𝕏</span> Xで結果を共有する <span aria-hidden="true">↗</span></a>
    </section><section class="ending-promotion"><p class="ending-question">消えた５人の運命は？</p><h2>兄を探しに向かった<br>「エレベーターおとこ」を<br>待ち受ける世界とは――。</h2>
      <p>５人の男女が迷い込んだ異世界。<br>しゃべるエレベーター。<br>彼らが探すものとは一体何なのか。</p>
      <div class="game-wordmark"><small>マジックリアリズム・パズルアドベンチャー</small><strong>ミスターエレベーター</strong><span>MR. ELEVATOR</span></div>
      <p class="release-line">${CONFIG.releaseLabel}</p><a class="store-button" href="${escapeHTML(CONFIG.promotionUrl)}" target="_blank" rel="noopener noreferrer">${CONFIG.promotionLabel} <span aria-hidden="true">↗</span></a>
    </section><p class="ending-fiction">このゲームは「ミスターエレベーター」の番外編WebARGです。<br>登場する地名・人物・事件はすべて架空です。</p><button class="replay-button" data-action="replay">最初から遊ぶ</button></main>
    <footer class="ending-footer"><span>三栖田えれ(β)</span><span class="page-number" aria-label="全8ページ中8ページ">8<span> / </span>8</span></footer></div>`;
}
function render(options = {}) {
  const previousScroll = window.scrollY;
  if (currentKey) scrollPositions.set(currentKey, previousScroll);
  mapInstance?.destroy(); mapInstance = null;
  if (dialog.open) dialog.close();
  let requested = parseRoute(location.hash);
  const resolved = resolveRoute(requested, store.state, authenticated);
  if (resolved.redirect) { history.replaceState(null, '', resolved.redirect); requested = parseRoute(resolved.redirect); }
  currentRoute = requested; currentKey = location.hash;
  currentBase = ''; currentSnapshot = ''; currentView = '';
  const now = Date.now();
  document.body.dataset.screen = currentRoute.type;
  let mapData;
  if (currentRoute.type === 'closed') app.innerHTML = closureHTML();
  if (currentRoute.type === 'archive') app.innerHTML = archiveHTML(currentRoute.params.get('q') ?? '');
  if (currentRoute.type === 'admin') app.innerHTML = adminHTML();
  if (currentRoute.type === 'ending') app.innerHTML = endingHTML();
  if (['snapshot', 'live'].includes(currentRoute.type)) { mapData = publicHTML(now); app.innerHTML = mapData.html; }
  if (!store.persistent) app.insertAdjacentHTML('beforeend', '<p class="storage-note" role="status">このブラウザーでは進行を保存できません。このタブを開いたままプレイしてください。</p>');
  const titles = { closed: '閉鎖のお知らせ', archive: 'インターネット魚拓', admin: '管理者画面', ending: 'クリア' };
  document.title = (titles[currentRoute.type] || (currentRoute.type === 'snapshot' ? 'アーカイブ ' + dateLabel(snapshotDates(store.state)[currentSnapshot]) : '事故マップ')) + ' | ' + CONFIG.name;
  document.querySelector('meta[name="theme-color"]').content = ['admin', 'ending'].includes(currentRoute.type) ? '#101516' : '#f5f4ee';
  const stage = document.querySelector('#map-stage');
  if (stage && mapData) {
    mapInstance = mountMap(stage, {
      records: mapData.records, state: store.state, published: mapData.published, sightings: mapData.sightings,
      onSelect(id, sightingId = null) {
        const params = new URLSearchParams(currentRoute.params);
        if (id) params.set('building', id); else params.delete('building');
        if (sightingId) params.set('sighting', sightingId); else params.delete('sighting');
        const next = currentBase + (params.size ? '?' + params : '');
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
  if (currentRoute.type === 'snapshot') {
    modal('<h2 id="modal-title">保存されたページです</h2><p>アーカイブでは投稿機能は利用できません。</p><p>投稿方法は左側のメニューからご覧いただけます。</p>');
    return;
  }
  if (!isLive()) return;
  if (store.state.phase === 'published') { modal('<h2 id="modal-title">事故情報を掲載しました</h2><p>お寄せいただいた事故情報は、地図に掲載されています。</p>'); return; }
  modal(reportHTML());
}
function tick() {
  if (document.hidden || !isLive()) return;
  if (renderedPhase !== store.state.phase) { render({ preserveScroll: true }); return; }
  const now = Date.now();
  const visible = newsIsVisible(store.state, now);
  const viewers = document.querySelector('[data-viewers]');
  if (viewers) viewers.textContent = viewerCount(store.state, now);
  const threads = visibleThreads('live', store.state, now);
  if (visible && !lastNewsVisible) {
    lastNewsVisible = true;
    document.querySelector('#live-notice').innerHTML = liveNoticeHTML(now);
    document.querySelector('[data-board-count]').textContent = threads.length;
    const sidebar = document.querySelector('.sidebar-board');
    sidebar.innerHTML = '<h2>市民掲示板より</h2>' + threads.slice(0, 3).map(thread => `<a href="${makeRoute(currentBase, 'board', { thread: thread.id })}">${escapeHTML(thread.title)}</a>`).join('');
    if (currentView === 'board' && !currentRoute.params.has('thread')) document.querySelector('#content-panel').innerHTML = threadListHTML(threads, currentBase, store.state);
    if (currentView === 'news') document.querySelector('#breaking-article').innerHTML = `<div class="document-page breaking-news"><p class="section-label">最新のニュース</p><h2>町内の事故報道</h2>${articleHTML(store.state)}</div>`;
    announcer.textContent = '市民掲示板に新しい書き込みがあります。';
  }
  if (store.state.phase !== 'published') return;
  const thread = threads.find(item => item.id === 'livestream');
  const counter = document.querySelector('.thread-row[href*="thread=livestream"] .thread-replies');
  if (counter) counter.textContent = thread.posts.length;
  const posts = document.querySelector('[data-thread-posts="livestream"]');
  if (posts && posts.children.length < thread.posts.length) {
    const start = posts.children.length;
    posts.insertAdjacentHTML('beforeend', thread.posts.slice(start).map((post, index) => postHTML(post, start + index, thread, store.state)).join(''));
    document.querySelector('.thread-nav > span').textContent = thread.posts.length + '件の書き込み';
  }
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'dismiss') { dialog.close(); return; }
  if (action === 'login') { authenticated ? navigate('#/admin') : login(); return; }
  if (action === 'logout') { setAuthentication(false); navigate(store.state.phase === 'closed' ? '#/closed' : '#/live'); return; }
  if (action === 'profile') { modal(profileHTML(currentSnapshot)); return; }
  if (action === 'about') {
    modal('<h2 id="modal-title">このサイトについて</h2><p>「三栖田えれ(β)」は、架空の町のエレベーター事故を調べるWebARG（謎解きゲーム）です。</p><p>地名・建物・人物・事故・報道・掲示板の投稿は、すべてフィクションです。実在する地域・人物・組織とは関係ありません。</p><p>プレイ時間の目安は約30分。PC・スマートフォンのブラウザーで遊べます。</p><p>進行はこのブラウザーに保存されます。入力内容が掲示板や外部サーバーへ送信されることはありません。</p>');
    return;
  }
  if (action === 'report') { openReport(); return; }
  if (action === 'restore' && authenticated && currentRoute.type === 'admin') {
    store.dispatch({ type: 'restore' }); navigate('#/live'); return;
  }
  if (action === 'close-site' && authenticated && currentRoute.type === 'admin' && store.state.phase === 'published') {
    store.dispatch({ type: 'close' }); navigate('#/ending'); return;
  }
  if (action === 'replay') {
    modal('<h2 id="modal-title">最初から遊びますか？</h2><p>このブラウザーの進行を消して、閉鎖のお知らせからもう一度始めます。</p><div class="modal-actions"><button class="button" data-action="dismiss">戻る</button><button class="button button--primary" data-action="confirm-replay">最初から遊ぶ</button></div>');
    return;
  }
  if (action === 'confirm-replay' && currentRoute.type === 'ending') {
    store.reset(); setAuthentication(false); scrollPositions.clear(); navigate('#/closed'); return;
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
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
window.addEventListener('hashchange', () => render());
window.addEventListener('storage', event => {
  if (event.key === CONFIG.storageKey || event.key === null) { store.sync(); render({ preserveScroll: true }); }
  if (event.key === CONFIG.sessionKey) {
    try { authenticated = sessionStorage.getItem(CONFIG.sessionKey) === 'yes'; } catch { /* 現在の認証を維持します。 */ }
    render({ preserveScroll: true });
  }
});
document.addEventListener('visibilitychange', tick);
render();
setInterval(tick, CONFIG.tickInterval);
