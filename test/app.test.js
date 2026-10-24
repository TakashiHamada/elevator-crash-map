import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, NEWS_BODY } from '../board-data.js';
import { TARGET_BUILDING } from '../data.js';
import { createState, transition } from '../game-state.js';

// 画面の見た目は扱わず、実際のapp.jsへイベントを送って検証する。
// app.js はモジュール読み込み時にイベントを登録するので、テストごとに別のURLで読み込み直す。
let appInstance = 0;
async function loadAppAt(t, savedState, setupTimers = () => {}) {
  const saved = new Map([[CONFIG.storageKey, JSON.stringify(savedState)]]);
  const storage = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value)
  };
  const windowEvents = new Map(), documentEvents = new Map();
  const curtain = { style: { setProperty() {} }, classList: { add() {} } };
  const app = { innerHTML: '', inert: false, querySelector: () => curtain };
  const elements = {
    '#app': app,
    '#site-dialog': { open: false, addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; } },
    '#dialog-content': {},
    '#announcer': {},
    'meta[name="theme-color"]': {}
  };
  const location = { hash: '#/admin', href: 'http://localhost:8000/#/admin' };
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
  return { app, elements, location, storage, windowEvents, click, savedPhase };
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
  const { elements, location, click, savedPhase } = await loadAppAt(t, createState(Date.parse('2026-10-23T12:00:00+09:00')));
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
});
