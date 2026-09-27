(() => {
  'use strict';
  const config = window.ARG_CONFIG;
  const isAdmin = document.body.classList.contains('admin-page');
  const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const emptyState = () => ({reports:[], posts:[], logins:[], hiddenLogIds:[]});
  function readState() {
    const raw = localStorage.getItem(config.storageKey);
    if (!raw) return emptyState();
    const value = JSON.parse(raw);
    if (!value || !['reports','posts','logins','hiddenLogIds'].every(key => Array.isArray(value[key]))) throw new Error('invalid state');
    return value;
  }
  let state;
  try { state = readState(); } catch { state = emptyState(); }
  function saveState(change, status) {
    try {
      const next = readState();
      change(next);
      localStorage.setItem(config.storageKey, JSON.stringify(next));
      state = next;
      return true;
    } catch {
      if (status) status.textContent = '保存できませんでした。ブラウザーの保存設定をご確認ください。';
      return false;
    }
  }
  function renderBoard() {
    const list = document.querySelector('#rumor-list');
    if (!list) return;
    const posts = [...state.posts.slice().reverse(), ...window.RUMORS];
    list.innerHTML = posts.map((post, index) => `<li><article class="board-entry"><div class="board-entry-meta"><span>${index + 1} ：</span><strong>${escapeHTML(post.name)}</strong><time>${escapeHTML(post.date)}</time>${post.kind ? `<span class="board-kind">${escapeHTML(post.kind)}</span>` : ''}</div>${post.title ? `<h3>${escapeHTML(post.title)}</h3>` : ''}<p>${escapeHTML(post.body)}</p></article></li>`).join('');
  }
  function renderAdmin() {
    const memo = document.querySelector('#memo-content');
    if (!memo) return;
    memo.innerHTML = config.memo.map((paragraph, index) => `<article><span>メモ ${String(index + 1).padStart(2, '0')}</span><p>${escapeHTML(paragraph)}</p></article>`).join('');
    document.querySelector('#inbox-count').textContent = `${state.reports.length}件`;
    document.querySelector('#inbox-list').innerHTML = state.reports.length ? state.reports.slice().reverse().map(report => `<article class="inbox-entry"><time>${escapeHTML(report.date)}</time><p>${escapeHTML(report.body)}</p></article>`).join('') : '<p class="empty-note">まだ情報は届いていません。</p>';
    const history = [...state.logins.slice().reverse(), ...window.LOGIN_HISTORY].filter(entry => !state.hiddenLogIds.includes(entry.id));
    document.querySelector('#history-count').textContent = `${history.length}件`;
    document.querySelector('#history-list').innerHTML = history.map(entry => `<li><span class="history-date">${escapeHTML(entry.date)}</span><span>${escapeHTML(entry.device)}</span><span>${escapeHTML(entry.result)}</span><button type="button" data-delete-log="${escapeHTML(entry.id)}" aria-label="${escapeHTML(entry.date)} のログイン履歴を削除">削除</button></li>`).join('');
  }
  if (isAdmin) {
    let authenticated = false;
    try { authenticated = sessionStorage.getItem(config.sessionKey) === 'ok'; } catch { /* ログイン状態を使えない場合は拒否 */ }
    if (!authenticated) { location.replace('index.html#login'); return; }
    document.body.classList.add('authenticated');
    renderAdmin();
    document.querySelector('#logout').addEventListener('click', () => {
      sessionStorage.removeItem(config.sessionKey);
      location.assign('index.html');
    });
    document.querySelector('#history-list').addEventListener('click', event => {
      const button = event.target.closest('[data-delete-log]');
      if (!button) return;
      const status = document.querySelector('#history-status');
      if (saveState(next => { if (!next.hiddenLogIds.includes(button.dataset.deleteLog)) next.hiddenLogIds.push(button.dataset.deleteLog); }, status)) {
        renderAdmin();
        status.textContent = '履歴を削除しました。';
      }
    });
  } else {
    renderBoard();
    const dialog = document.querySelector('#community-dialog');
    const content = document.querySelector('#community-content');
    const menu = document.querySelector('#mobile-menu');
    const menuToggle = document.querySelector('#menu-toggle');
    function closeMenu() { menu.hidden = true; menuToggle.setAttribute('aria-expanded', 'false'); }
    function showDrawer(html) {
      closeMenu();
      content.innerHTML = html;
      dialog.showModal();
      dialog.scrollTop = 0;
    }
    dialog.querySelectorAll('[data-close-drawer]').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    menuToggle.addEventListener('click', () => {
      menu.hidden = !menu.hidden;
      menuToggle.setAttribute('aria-expanded', String(!menu.hidden));
    });
    document.addEventListener('click', event => { if (!event.target.closest('.mobile-nav')) closeMenu(); });
    document.querySelectorAll('[data-dialog]').forEach(button => button.addEventListener('click', closeMenu));
    document.querySelectorAll('[data-admin-about]').forEach(button => button.addEventListener('click', () => showDrawer(`<h2 id="community-title">管理人について</h2><p class="drawer-body">${escapeHTML(config.administrator)}</p>`)));
    document.querySelectorAll('[data-developer-info]').forEach(button => button.addEventListener('click', () => showDrawer(`<h2 id="community-title">開発者向け情報</h2><p>プロトタイプ確認用の設定です。公開版では認証をサーバー側へ移してください。</p><h3>反応するキーワード</h3><ul>${config.keywordRules.map(rule => `<li>${escapeHTML(rule.keywords.join(' / '))} → ${escapeHTML(rule.kind)}「${escapeHTML(rule.title)}」</li>`).join('')}</ul><h3>管理人ログイン</h3><dl class="developer-credentials"><dt>ユーザー名</dt><dd><code>${escapeHTML(config.username)}</code></dd><dt>パスワード</dt><dd><code>${escapeHTML(config.password)}</code></dd></dl><p>情報提供と削除状態は、このブラウザーの保存領域に記録されます。</p>`)));
    const loginDialog = document.querySelector('#login-dialog');
    const loginForm = document.querySelector('#login-form');
    function openLogin() {
      closeMenu();
      document.querySelector('#login-error').textContent = '';
      loginForm.reset();
      loginDialog.showModal();
      document.querySelector('#login-user').focus();
    }
    document.querySelectorAll('[data-admin-login]').forEach(button => button.addEventListener('click', openLogin));
    document.querySelector('[data-close-login]').addEventListener('click', () => loginDialog.close());
    loginDialog.addEventListener('click', event => { if (event.target === loginDialog) loginDialog.close(); });
    loginForm.addEventListener('submit', event => {
      event.preventDefault();
      const error = document.querySelector('#login-error');
      if (loginForm.elements.username.value !== config.username || loginForm.elements.password.value !== config.password) {
        error.textContent = 'ユーザー名またはパスワードが違います。';
        loginForm.elements.password.select();
        return;
      }
      try {
        sessionStorage.setItem(config.sessionKey, 'ok');
        const now = new Date();
        const entry = {id:`login-${crypto.randomUUID()}`, date:now.toLocaleString('ja-JP'), device:'このブラウザー', result:'ログイン成功'};
        if (!saveState(next => next.logins.push(entry), error)) { sessionStorage.removeItem(config.sessionKey); return; }
        location.assign(config.adminPath);
      } catch { error.textContent = 'ログイン状態を保存できませんでした。'; }
    });
    const form = document.querySelector('#report-form');
    form.addEventListener('submit', event => {
      event.preventDefault();
      const input = form.elements.body;
      const body = input.value.trim();
      input.setCustomValidity(body ? '' : '本文を入力してください。');
      if (!input.reportValidity()) return;
      const status = document.querySelector('#report-status');
      const normalized = body.normalize('NFKC').toLowerCase();
      const rule = config.keywordRules.find(item => item.keywords.some(keyword => normalized.includes(keyword.normalize('NFKC').toLowerCase())));
      const now = new Date().toLocaleString('ja-JP');
      const report = {id:`report-${crypto.randomUUID()}`, date:now, body};
      const post = rule ? {id:`post-${crypto.randomUUID()}`, date:now, name:'管理人', kind:rule.kind, title:rule.title, body:rule.body} : null;
      if (!saveState(next => { next.reports.push(report); if (post) next.posts.push(post); }, status)) return;
      form.reset();
      renderBoard();
      status.textContent = rule ? '情報を受け付けました。管理人の投稿が掲示板の先頭に追加されました。' : '情報を受け付けました。管理人が確認します。';
    });
    form.addEventListener('input', () => form.elements.body.setCustomValidity(''));
    function switchTab(view) {
      document.body.dataset.mobileView = view;
      document.querySelector('#tab-board').setAttribute('aria-selected', String(view === 'board'));
      document.querySelector('#tab-map').setAttribute('aria-selected', String(view === 'map'));
      closeMenu();
      if (view === 'map') window.dispatchEvent(new Event('resize'));
    }
    document.querySelector('#tab-board').addEventListener('click', () => switchTab('board'));
    document.querySelector('#tab-map').addEventListener('click', () => switchTab('map'));
    switchTab(location.hash.startsWith('#record=') ? 'map' : 'board');
    if (location.hash === '#login') { history.replaceState(null, '', location.pathname); openLogin(); }
  }
  window.addEventListener('storage', event => {
    if (event.key !== config.storageKey && event.key !== null) return;
    try { state = readState(); } catch { return; }
    if (isAdmin) renderAdmin(); else renderBoard();
  });
})();
