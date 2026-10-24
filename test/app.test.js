import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, NEWS_BODY } from '../board-data.js';
import { TARGET_BUILDING } from '../data.js';
import { createState, transition } from '../game-state.js';

// 画面の見た目は扱わず、実際のapp.jsへイベントを送って検証する。
// app.js はモジュール読み込み時にイベントを登録するので、テストごとに別のURLで読み込み直す。
let appInstance = 0;
async function loadAppAt(t, savedState, setupTimers = () => {}, { hash = '#/admin', hints = 'off' } = {}) {
  const saved = new Map([[CONFIG.storageKey, JSON.stringify(savedState)]]);
  saved.set(CONFIG.hintsKey, hints);
  const storage = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: key => saved.delete(key)
  };
  const windowEvents = new Map(), documentEvents = new Map();
  const curtain = { style: { setProperty() {} }, classList: { add() {} } };
  const app = { innerHTML: '', inert: false, querySelector: () => curtain };
  const elements = {
    '#app': app,
    '#site-dialog': { open: false, dataset: {}, addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; } },
    '#dialog-content': {},
    '#admin-password': { focus() {} },
    '#announcer': {},
    'meta[name="theme-color"]': {},
    '[data-action="toggle-hints"]': { textContent: '', attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } }
  };
  const location = { hash, href: 'http://localhost:8000/' + hash };
  const globals = {
    location,
    history: { replaceState(_state, _unused, hash) { location.hash = hash; } },
    sessionStorage: { getItem: () => 'yes' },
    window: {
      localStorage: storage, scrollY: 0, scrollTo() {},
      addEventListener: (name, callback) => windowEvents.set(name, callback)
    },
    document: {
      body: { dataset: {} },
      querySelector: selector => elements[selector] ?? null,
      addEventListener: (name, callback) => documentEvents.set(name, callback)
    },
    requestAnimationFrame: callback => callback()
  };
  for (const [key, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    });
  }
  t.mock.method(globalThis, 'setInterval', () => 0);
  setupTimers();
  await import('../app.js?instance=' + ++appInstance);
  const click = action => documentEvents.get('click')({ target: { closest: () => ({ dataset: { action } }) } });
  const savedPhase = () => JSON.parse(storage.getItem(CONFIG.storageKey)).phase;
  return { app, elements, location, storage, windowEvents, documentEvents, click, savedPhase, body: globals.document.body };
}

test('閉鎖演出中の別タブのリプレイを取り込み、演出後は初期状態へ戻る', async t => {
  const startedAt = Date.parse('2026-10-23T12:00:00+09:00');
  const restored = transition(createState(startedAt), { type: 'restore' }, startedAt);
  const published = transition(restored, {
    type: 'publish', report: { ...TARGET_BUILDING, source: NEWS_BODY }
  }, startedAt + CONFIG.newsDelay);
  const timers = new Map();
  let timerId = 0;
  const { app, elements, location, storage, windowEvents, click, savedPhase } = await loadAppAt(t, published, () => {
    t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
      timers.set(++timerId, { callback, delay });
      return timerId;
    });
    t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  });

  await click('close-site');
  assert.equal(elements['#site-dialog'].open, true);
  assert.equal(savedPhase(), 'published', '確認前には閉鎖しない');
  await click('dismiss');
  assert.equal(elements['#site-dialog'].open, false);
  assert.equal(savedPhase(), 'published', 'キャンセル時は公開を維持する');
  await click('close-site');
  await click('confirm-close-site');
  assert.equal(elements['#site-dialog'].open, false);
  assert.equal(savedPhase(), 'complete');
  assert.equal(app.inert, true);
  const closure = app.innerHTML;

  // 他のタブで初期化された保存内容を、このタブへstorageイベントとして届ける。
  storage.setItem(CONFIG.storageKey, JSON.stringify(createState(startedAt + 60000)));
  windowEvents.get('storage')({ key: CONFIG.storageKey });
  assert.equal(app.innerHTML, closure, '保存同期だけで演出中の画面を描き直さない');

  for (const delay of [CONFIG.closingNoticeHold, CONFIG.closingFadeDuration]) {
    const [id, timer] = timers.entries().next().value;
    timers.delete(id);
    assert.equal(timer.delay, delay);
    timer.callback();
  }
  assert.equal(location.hash, '#/ending');
  windowEvents.get('hashchange')();
  assert.equal(location.hash, '#/closed', '最新の保存に従ってルートを判定する');
  assert.equal(app.inert, false);
  assert.equal(timers.size, 0);
});

test('サイトの復元は確認ダイアログで確定するまで実行しない', async t => {
  const { app, elements, location, storage, windowEvents, documentEvents, click, savedPhase } = await loadAppAt(t, createState(Date.parse('2026-10-23T12:00:00+09:00')));
  assert.match(app.innerHTML, /data-action="restore" data-hint="action">サイトを復元/);
  await click('restore');
  assert.equal(elements['#site-dialog'].open, true);
  assert.equal(savedPhase(), 'closed', '確認前には復元しない');
  await click('dismiss');
  assert.equal(elements['#site-dialog'].open, false);
  assert.equal(savedPhase(), 'closed', 'キャンセル時は閉鎖を維持する');
  await click('confirm-restore');
  assert.equal(savedPhase(), 'closed', 'ダイアログを開かずに確定操作だけ届いても復元しない');
  await click('restore');
  await click('confirm-restore');
  assert.equal(elements['#site-dialog'].open, false);
  assert.equal(savedPhase(), 'restored');
  assert.equal(location.hash, '#/live');

  let now = JSON.parse(storage.getItem(CONFIG.storageKey)).restoredAt;
  t.mock.method(Date, 'now', () => now);
  windowEvents.get('hashchange')();
  assert.doesNotMatch(app.innerHTML, /class="new-post-notice"/, 'ニュース到着前に新着案内のヒントを出さない');
  elements['#live-notice'] = { innerHTML: '' };
  elements['[data-board-count]'] = { textContent: '' };
  now += CONFIG.newsDelay;
  documentEvents.get('visibilitychange')();
  assert.match(elements['#live-notice'].innerHTML, /class="new-post-notice" href="#\/live\?view=board" data-hint="action"/);
  assert.match(elements['#live-notice'].innerHTML, /市民掲示板に新しい書き込みがあります。/);
});

test('ヒントは確認後にオン、オフは即時、再利用時は再確認する', async t => {
  const state = createState(Date.parse('2026-10-25T12:00:00+09:00'));
  const { app, elements, storage, click, body, savedPhase } = await loadAppAt(t, state, undefined, { hash: '#/closed' });
  const dialog = elements['#site-dialog'];
  const toggle = elements['[data-action="toggle-hints"]'];
  const initialHTML = app.innerHTML;
  assert.equal(body.dataset.hints, 'off');
  assert.match(initialHTML, /aria-pressed="false">ヒントを使う/);
  await click('confirm-hints');
  assert.equal(body.dataset.hints, 'off', '確認なしの確定操作は無視する');

  await click('toggle-hints');
  assert.equal(dialog.open, true);
  assert.equal(dialog.dataset.context, 'game');
  assert.equal(body.dataset.hints, 'off', 'ダイアログを開いただけではヒントを出さない');
  await click('dismiss');
  assert.equal(body.dataset.hints, 'off');
  await click('confirm-hints');
  assert.equal(body.dataset.hints, 'off', 'キャンセル後もヒントを出さない');

  await click('toggle-hints');
  await click('confirm-hints');
  assert.equal(body.dataset.hints, 'on');
  assert.equal(dialog.open, false);
  assert.equal(toggle.textContent, 'ヒント使用中');
  assert.equal(toggle.attributes['aria-pressed'], 'true');
  assert.equal(storage.getItem(CONFIG.hintsKey), 'on');
  assert.equal(app.innerHTML, initialHTML, 'ヒントの切替で地図などの画面を再生成しない');
  assert.equal(savedPhase(), 'closed', 'ヒントの利用はゲーム進行に影響しない');

  await click('toggle-hints');
  assert.equal(body.dataset.hints, 'off');
  assert.equal(dialog.open, false, 'オフには確認を挟まない');
  assert.equal(toggle.textContent, 'ヒントを使う');
  assert.equal(toggle.attributes['aria-pressed'], 'false');
  assert.equal(storage.getItem(CONFIG.hintsKey), 'off');
  await click('toggle-hints');
  assert.equal(dialog.open, true, 'もう一度オンにするときは確認する');
  assert.equal(body.dataset.hints, 'off');
  await click('about');
  await click('confirm-hints');
  assert.equal(body.dataset.hints, 'off', '別のダイアログからはヒントを確定できない');
});

test('ヒントは保存・画面移動後も有効で、指定の保存世代と手掛かりだけを対象にする', async t => {
  const state = createState(Date.parse('2026-10-25T12:00:00+09:00'));
  const { app, elements, location, windowEvents, click, body } = await loadAppAt(t, state, undefined, { hash: '#/closed', hints: 'on' });
  const move = hash => { location.hash = hash; windowEvents.get('hashchange')(); };
  assert.equal(body.dataset.hints, 'on', '再読み込み時に設定を復帰する');
  assert.match(app.innerHTML, /<span data-hint="text">三栖田えれ<\/span>/);
  assert.match(app.innerHTML, /<span data-hint="text">三栖田えれ\(β\)<\/span> 管理人/);
  assert.match(app.innerHTML, /href="#\/archive" data-hint="action"/);
  assert.match(app.innerHTML, /class="admin-link"[^>]*data-action="login" data-hint="action"/);

  move('#/archive/latest?view=updates');
  assert.equal(body.dataset.hints, 'on');
  assert.match(app.innerHTML, /aria-pressed="true">ヒント使用中/);
  assert.doesNotMatch(app.innerHTML, /data-hint="action"/, '最新の保存ページではメニューを明滅させない');
  assert.match(app.innerHTML, /<dd data-hint="text">掲載情報を更新しました。管理人プロフィールの一部を修正しました。<\/dd>/);
  move('#/archive/latest?view=board');
  assert.match(app.innerHTML, /<strong data-hint="text">管理人のプロフィールなんかワロタ<\/strong>/);
  assert.doesNotMatch(app.innerHTML, /data-hint="action"/, 'スレッドのリンクも明滅させず、タイトルだけ赤くする');
  assert.doesNotMatch(app.innerHTML, /data-thread-id="filming" data-hint/);
  move('#/archive/latest?view=board&thread=profile');
  assert.match(app.innerHTML, /<p data-hint="text">よく考えたらここのパスワードが割れそうだったので<\/p>/);
  assert.equal((app.innerHTML.match(/data-hint="text"/gu) ?? []).length, 1);

  move('#/archive/middle?view=updates');
  assert.match(app.innerHTML, /view=profile" data-hint="action"/);
  assert.equal((app.innerHTML.match(/data-hint="action"/gu) ?? []).length, 1, '2024年の保存では管理人についてだけを明滅させる');
  move('#/archive/middle?view=profile');
  assert.match(app.innerHTML, /<span data-hint="text">1992<\/span>年生まれ/);
  assert.match(app.innerHTML, /<span data-hint="text">トランプゲーム<\/span>全般。<span data-hint="text">手塚治虫のマンガ<\/span>にもあるやつとか/);
  assert.match(app.innerHTML, /<span data-hint="text">夜９時<\/span>ころ/);
  assert.match(app.innerHTML, /サイコロを振って<span data-hint="text">出た目を足し算<\/span>する/);
  const movieLink = app.innerHTML.match(/<a href="([^"]+)" target="_blank" rel="noopener noreferrer" aria-label="ラスベガスをぶっつぶせをGoogleで検索（別タブ）">『ラスベガスをぶっつぶせ』<\/a>/);
  assert.ok(movieLink, '映画名はヒントの強調をせず、安全指定を付けた別タブの検索リンクにする');
  const search = new URL(movieLink[1]);
  assert.equal(search.origin, 'https://www.google.com');
  assert.equal(search.pathname, '/search');
  assert.equal(search.searchParams.get('q'), 'ラスベガスをぶっつぶせ');
  for (const snapshot of ['latest', 'middle']) {
    move(`#/archive/${snapshot}?view=board`);
    assert.equal(body.dataset.snapshot, snapshot);
    assert.match(app.innerHTML, /<strong data-hint="text">そもそもこのサイトって<\/strong>/);
    move(`#/archive/${snapshot}?view=board&thread=purpose`);
    assert.match(app.innerHTML, /<span data-hint="text">兄が消えた日が自分の誕生日だった<\/span>こともあって、忘れられない事故ですね/);
    assert.equal((app.innerHTML.match(/data-hint="text"/gu) ?? []).length, 1, '誕生日だったまでの部分だけを強調する');
  }
  move('#/archive/middle?view=profile');
  await click('toggle-hints');
  windowEvents.get('hashchange')();
  assert.equal(body.dataset.hints, 'off');
  assert.match(app.innerHTML, /target="_blank" rel="noopener noreferrer"/, '検索リンクはヒントがオフでも利用できる');
  move('#/archive/oldest?view=board');
  assert.equal(body.dataset.snapshot, 'oldest', '最古の保存だけに地図のヒント用スタイルを適用する');
  assert.doesNotMatch(app.innerHTML, /data-hint=/);
  move('#/archive/oldest');
  assert.match(app.innerHTML, /<strong>1<\/strong> 件/);
  move('#/admin');
  assert.equal(body.dataset.snapshot, '', '保存ページを離れたら地図のヒント用スタイルを解除する');
  await click('about');
  assert.equal(elements['#site-dialog'].dataset.context, 'game');
  await click('restore');
  assert.equal(elements['#site-dialog'].dataset.context, 'story', 'ゲーム内の確認には元の配色を使う');
  await click('logout');
  windowEvents.get('hashchange')();
  await click('login');
  assert.equal(elements['#site-dialog'].open, true);
  assert.ok(elements['#dialog-content'].innerHTML.includes(`<p class="password-hint" id="password-hint" data-hint="text">${CONFIG.passwordHint}</p>`), 'ログインの説明文全体を赤文字のヒントにする');
});

test('ヒント設定の保存が拒否されても、そのタブではオン・オフできる', async t => {
  const { storage, click, body } = await loadAppAt(t, createState(), undefined, { hash: '#/closed' });
  t.mock.method(storage, 'setItem', () => { throw new Error('storage blocked'); });
  await click('toggle-hints');
  await click('confirm-hints');
  assert.equal(body.dataset.hints, 'on');
  await click('toggle-hints');
  assert.equal(body.dataset.hints, 'off');
});
