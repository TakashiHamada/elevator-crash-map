(() => {
  'use strict';
  const config = window.ARG_CONFIG;
  const emptyState = () => ({published: [], reports: [], deleted: false});
  function readState() {
    const value = JSON.parse(localStorage.getItem(config.storageKey) || 'null');
    if (!value) return emptyState();
    if (!Array.isArray(value.published) || !Array.isArray(value.reports) || typeof value.deleted !== 'boolean') throw new Error('保存データを読み込めません');
    return value;
  }
  let state;
  let storageError = false;
  try { state = readState(); } catch { state = emptyState(); storageError = true; }
  window.ARGStore = {isDeleted: () => state.deleted};
  const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  let deleting = false;
  function showEnding() {
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    document.title = 'このページは見つかりません';
    document.body.className = 'ending-page';
    document.body.innerHTML = '<main class="ending"><p class="eyebrow">404 / NOT FOUND</p><h1 tabindex="-1">このページは見つかりません</h1></main>';
    document.querySelector('h1').focus();
  }
  if (state.deleted) { showEnding(); return; }
  const dialog = document.querySelector('#community-dialog');
  const content = document.querySelector('#community-content');
  function showDrawer(html) {
    content.innerHTML = html;
    dialog.showModal();
    dialog.scrollTop = 0;
  }
  dialog.querySelectorAll('[data-close-drawer]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  function updateState(change, status) {
    try {
      const next = readState();
      if (next.deleted) { state = next; showEnding(); return false; }
      change(next);
      localStorage.setItem(config.storageKey, JSON.stringify(next));
      state = next;
      storageError = false;
      return true;
    } catch {
      status.textContent = '保存できませんでした。ブラウザーの保存設定や空き容量を確認して、もう一度お試しください。';
      return false;
    }
  }
  const allHeld = () => [...window.HELD_POSTS, ...state.reports];
  function publicPosts() {
    const posts = new Map(allHeld().map(post => [post.id, post]));
    return [...state.published.map(id => posts.get(id)).filter(Boolean), ...window.RUMORS].slice(0, config.topCount);
  }
  function renderBoard() {
    const list = document.querySelector('#rumor-list');
    if (!list) return;
    list.innerHTML = publicPosts().map((post,index) => `<li><button class="rumor-button" data-rumor="${escapeHTML(post.id)}" aria-haspopup="dialog"><span class="rumor-number">${String(index+1).padStart(2,'0')}</span><span class="rumor-copy"><span class="rumor-date">${escapeHTML(post.date)} · 町の噂</span><strong>${escapeHTML(post.title)}</strong><span class="rumor-address">${escapeHTML(post.address)}</span></span><span class="rumor-arrow" aria-hidden="true">↗</span></button></li>`).join('');
  }
  function renderAdmin() {
    const list = document.querySelector('#held-list');
    if (!list) return;
    const posts = allHeld();
    document.querySelector('#held-count').textContent = `${posts.filter(post => !state.published.includes(post.id)).length}件`;
    list.innerHTML = posts.map(post => {
      const published = state.published.includes(post.id);
      return `<article class="held-post"><div class="held-meta"><span class="tag">${published ? '公開済み' : '保留'}</span><span>${escapeHTML(post.id)} / ${escapeHTML(post.date)}</span></div><h3>${escapeHTML(post.title)}</h3><p class="held-address">${escapeHTML(post.address)}</p><p class="held-body">${escapeHTML(post.body)}</p><p class="hold-reason">保留理由：${escapeHTML(post.reason)}</p><button class="publish-button" data-publish="${escapeHTML(post.id)}" ${published ? 'disabled' : ''}>${published ? '表側に表示済み' : '表側に表示する'}</button></article>`;
    }).join('');
  }
  renderBoard(); renderAdmin();
  if (storageError) {
    const status = document.querySelector('#report-status, #admin-status');
    status.textContent = '保存データを読み込めませんでした。ブラウザーの保存設定をご確認ください。';
  }
  document.querySelector('#rumor-list')?.addEventListener('click', event => {
    const button = event.target.closest('[data-rumor]');
    if (!button) return;
    const post = publicPosts().find(post => post.id === button.dataset.rumor);
    if (post) showDrawer(`<p class="eyebrow">町の噂 / ${escapeHTML(post.date)}</p><h2 id="community-title">${escapeHTML(post.title)}</h2><p class="drawer-address">${escapeHTML(post.address)}</p><p class="drawer-body">${escapeHTML(post.body)}</p><p class="drawer-note">寄せられた情報であり、事実関係が確認された事故記録ではありません。</p>`);
  });
  document.querySelector('#administrator-link')?.addEventListener('click', event => {
    event.preventDefault();
    showDrawer(`<p class="eyebrow">この記録を集めている人</p><h2 id="community-title">管理者とは</h2><p class="drawer-body">${escapeHTML(config.administrator)}</p>`);
  });
  const reportForm = document.querySelector('#report-form');
  if (reportForm) {
    config.reportAddresses.forEach(address => {
      const option = document.createElement('option');
      option.value = address;
      option.textContent = address;
      reportForm.elements.address.append(option);
    });
  }
  reportForm?.addEventListener('submit', event => {
    event.preventDefault();
    const addressInput = reportForm.elements.address;
    const bodyInput = reportForm.elements.body;
    addressInput.setCustomValidity(config.reportAddresses.includes(addressInput.value) ? '' : '住所を選択してください。');
    if (!addressInput.reportValidity()) return;
    bodyInput.setCustomValidity(bodyInput.value.trim() ? '' : '空白以外の文字を入力してください。');
    if (!bodyInput.reportValidity()) return;
    const status = document.querySelector('#report-status');
    const report = {id:`report-${crypto.randomUUID()}`, title:'寄せられた情報', address:addressInput.value.trim(), body:bodyInput.value.trim(), date:new Date().toLocaleDateString('ja-JP').replaceAll('/','.'), reason:'新規投稿。管理者による確認待ち。'};
    if (updateState(next => next.reports.push(report), status)) {
      reportForm.reset();
      status.textContent = '情報を受け付けました。管理者の確認後に掲載されます。';
    }
  });
  reportForm?.addEventListener('input', event => event.target.setCustomValidity?.(''));
  let logoClicks = 0;
  if (document.querySelector('.public-layout')) document.querySelector('.brand').addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    logoClicks += 1;
    if (logoClicks >= config.logoClicks) location.assign(config.adminPath);
  });
  document.querySelector('#held-list')?.addEventListener('click', event => {
    const button = event.target.closest('[data-publish]');
    if (!button) return;
    const id = button.dataset.publish;
    const status = document.querySelector('#admin-status');
    if (updateState(next => { if (!next.published.includes(id)) next.published.unshift(id); }, status)) {
      renderAdmin();
      const replacement = [...document.querySelectorAll('[data-publish]')].find(item => item.dataset.publish === id);
      const article = replacement.closest('article');
      article.tabIndex = -1; article.focus({preventScroll:true});
      status.textContent = '公開しました。町の噂の先頭に表示されます。';
    }
  });
  document.querySelector('#delete-site')?.addEventListener('click', () => {
    showDrawer('<p class="eyebrow">アーカイブの終了</p><h2 id="community-title">このサイトを削除する</h2><p>実行すると、このサイトの記録は閲覧できなくなります。</p><form id="delete-form"><label for="delete-password">管理者パスワード</label><input id="delete-password" type="password" required autocomplete="off" placeholder="パスワードを入力"><p id="password-error" role="alert"></p><button class="danger-button" type="submit">削除を実行する</button></form>');
    document.querySelector('#delete-password').focus();
    document.querySelector('#delete-form').addEventListener('submit', event => {
      event.preventDefault();
      const error = document.querySelector('#password-error');
      if (document.querySelector('#delete-password').value !== config.deletionPassword) {
        error.textContent = 'パスワードが正しくありません。';
        document.querySelector('#delete-password').select();
        return;
      }
      // 保存に成功した場合のみ演出へ進み、途中で閉じても終了状態を維持します。
      if (!updateState(next => { next.deleted = true; }, error)) return;
      deleting = true;
      dialog.close();
      document.body.className = 'ending-page';
      document.body.innerHTML = '<main class="ending"><p class="eyebrow">ARCHIVE / ERASING</p><h1 tabindex="-1">記録を消去しています</h1><progress id="erase-progress" max="100" value="0" aria-label="サイトの消去進捗"></progress><p id="erase-label" role="status">事故記録を消去しています…</p></main>';
      document.querySelector('h1').focus();
      const start = performance.now();
      function animate(now) {
        const percent = Math.min(100, (now-start)/config.deletionDuration*100);
        document.querySelector('#erase-progress').value = percent;
        document.querySelector('#erase-label').textContent = percent < 35 ? '事故記録を消去しています…' : percent < 75 ? '投稿と保留記録を消去しています…' : 'アーカイブを終了しています…';
        if (percent < 100) requestAnimationFrame(animate);
        else { deleting = false; showEnding(); }
      }
      requestAnimationFrame(animate);
    });
  });
  window.addEventListener('storage', event => {
    if (event.key !== config.storageKey && event.key !== null) return;
    try { state = readState(); } catch { return; }
    if (state.deleted) { if (!deleting) showEnding(); }
    else if (document.querySelector('.ending')) location.reload();
    else { renderBoard(); renderAdmin(); }
  });
})();
