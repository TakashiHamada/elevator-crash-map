import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { CONFIG, NEWS, NEWS_BODY, THREADS, ADMIN_MEMO } from '../board-data.js';
import { ACCIDENTS, BUILDINGS, TARGET_BUILDING, TARGET_BUILDING_ID, addressOf, recordsForSnapshot } from '../data.js';
import { createState, isValidState, localDate, dateShift, snapshotDates, newsIsVisible, normalizeText, isCorrectPassword, matchesArchiveQuery, validateReport, transition, viewerCount, visibleThreads, parseRoute, resolveRoute, createStore } from '../game-state.js';
import { profileHTML, threadHTML, mapHTML, reportHTML, escapeHTML, latestHTML } from '../community.js';
import { mapRecords, mapSVG } from '../map.js';

const startedAt = Date.parse('2026-10-23T00:15:00+09:00');
const restoredAt = startedAt + 60000;
const publishedAt = restoredAt + CONFIG.newsDelay;
const correctReport = { town: TARGET_BUILDING.town, chome: String(TARGET_BUILDING.chome), lot: String(TARGET_BUILDING.lot), source: NEWS_BODY };
const closed = () => createState(startedAt);
const restored = () => transition(closed(), { type: 'restore' }, restoredAt);
const published = () => transition(restored(), { type: 'publish', report: correctReport }, publishedAt);
const complete = () => transition(published(), { type: 'close' }, publishedAt + 1000);
function memoryStorage(initial = null) {
  const values = new Map(initial === null ? [] : [[CONFIG.storageKey, initial]]);
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); }
  };
}

test('日本時間の初回日付と前日を固定し、深夜でも日付がずれない', () => {
  const state = closed();
  assert.equal(state.storyDate, '2026-10-23');
  assert.equal(localDate(Date.parse('2026-10-22T14:59:59Z')), '2026-10-22');
  assert.equal(dateShift('2026-03-01', -1), '2026-02-28');
  assert.equal(snapshotDates(state).latest, '2026-10-22');
});
test('最新・中間・最古の保存記録は時系列順で、最古には事故が1件だけある', () => {
  const dates = snapshotDates(closed());
  assert.ok(dates.latest > dates.middle && dates.middle > dates.oldest);
  assert.equal(recordsForSnapshot('oldest', dates).length, 1);
  assert.equal(recordsForSnapshot('oldest', dates)[0].date, '2018-11-27');
  assert.equal(recordsForSnapshot('latest', dates).length, ACCIDENTS.length);
  assert.ok(recordsForSnapshot('middle', dates).length > 1);
  assert.ok(recordsForSnapshot('middle', dates).length < ACCIDENTS.length);
});
test('サイト名・表記揺れ・自サイトURLで魚拓を検索できる', () => {
  for (const query of [CONFIG.name, '三栖田えれ（β）', '「三栖田えれ(β)」', '三栖田えれ', 'https://example.com/arg/', 'https://example.com/arg/index.html', 'example.com/arg/']) {
    assert.equal(matchesArchiveQuery(query, 'https://example.com/arg/'), true, query);
  }
  assert.equal(matchesArchiveQuery('http://127.0.0.1:8000/', 'http://127.0.0.1:8000/'), true);
});
test('無関係な名前・別ホスト・別ディレクトリは検索に一致しない', () => {
  for (const query of ['大島てる', '三栖田えれじゃない', 'https://example.com.evil.test/arg/', 'https://example.com/other/', 'javascript:alert(1)', '']) {
    assert.equal(matchesArchiveQuery(query, 'https://example.com/arg/'), false, query);
  }
});
test('数字21と生年月日の組み合わせでだけログインできる', () => {
  assert.equal(isCorrectPassword('2119921127'), true);
  for (const value of ['2119921128', '1992112721', '２１１９９２１１２７', 'kanrinin', '']) assert.equal(isCorrectPassword(value), false);
});
test('プロフィールの手掛かりは中間保存にだけ残る', () => {
  assert.match(profileHTML('middle'), /1992年生まれ/u);
  assert.match(profileHTML('middle'), /ラスベガスをぶっつぶせ/u);
  assert.doesNotMatch(profileHTML('latest'), /1992年生まれ|ラスベガスをぶっつぶせ/u);
  assert.match(profileHTML('latest'), /セキュリティに関わる情報/u);
  assert.doesNotMatch(profileHTML('oldest'), /1992年生まれ|30代/u);
});
test('脚本の誕生日・音・撮影・都市伝説の投稿と管理人メモが揃っている', () => {
  const all = THREADS.flatMap(item => item.posts.map(post => post.body)).join('\n');
  for (const clue of ['兄が消えた日が自分の誕生日', 'スマホで録音したけど無音', 'JKです', 'デスゲーム', 'パスワードが割れそう']) assert.ok(all.includes(clue), clue);
  const memo = ADMIN_MEMO.join('\n');
  assert.match(memo, /被害者を救っているんじゃないか/u);
  assert.match(memo, /隣り合った建物が無くて/u);
});
test('復元しても5秒まではニュースが出現せず、5秒から出現する', () => {
  const state = restored();
  assert.equal(newsIsVisible(state, restoredAt + CONFIG.newsDelay - 1), false);
  assert.equal(newsIsVisible(state, restoredAt + CONFIG.newsDelay), true);
  assert.equal(visibleThreads('live', state, restoredAt).some(thread => thread.id === 'revival'), false);
  assert.equal(visibleThreads('live', state, publishedAt).filter(thread => thread.id === 'revival').length, 1);
});
test('復元は一度だけ実行され、再訪でタイマーが巻き戻らない', () => {
  const state = restored();
  assert.equal(transition(state, { type: 'restore' }, restoredAt + 50000), state);
  assert.equal(state.restoredAt, restoredAt);
});
test('正しい住所と記事本文・見出し・全文のコピーを受理する', () => {
  for (const source of [NEWS_BODY, NEWS.title, NEWS.title + '\n' + NEWS_BODY, '霧原日報\n' + NEWS.title + '\n' + NEWS_BODY + '\n社会／霧原市', NEWS_BODY.replaceAll('\n', '\r\n　')]) {
    assert.deepEqual(validateReport({ ...correctReport, source }), { ok: true });
  }
});
test('記事の一部だけ・無関係な文章・誤った住所は正解にならない', () => {
  for (const source of [NEWS.paragraphs[0], '事故があった', '', '<script>alert(1)</script>']) assert.equal(validateReport({ ...correctReport, source }).ok, false);
  assert.deepEqual(validateReport({ ...correctReport, lot: '7' }), { ok: false, reason: 'address' });
  assert.equal(validateReport({ ...correctReport, town: '港南' }).ok, false);
});
test('復元前・ニュース到着前・誤答では事故ピン追加に進まない', () => {
  const action = { type: 'publish', report: correctReport };
  const initial = closed();
  assert.equal(transition(initial, action, publishedAt), initial);
  const live = restored();
  assert.equal(transition(live, action, publishedAt - 1), live);
  assert.equal(transition(live, { ...action, report: { ...correctReport, source: '知らない記事' } }, publishedAt), live);
});
test('正答後に一度だけ公開が進み、重複投稿では時刻も変わらない', () => {
  const state = published();
  assert.equal(state.phase, 'published');
  assert.equal(state.publishedAt, publishedAt);
  assert.equal(transition(state, { type: 'publish', report: correctReport }, publishedAt + 5000), state);
});
test('現場公開前には閉鎖できず、公開後にだけ唯一の結末へ進む', () => {
  const live = restored();
  assert.equal(transition(live, { type: 'close' }, publishedAt), live);
  assert.equal(complete().phase, 'complete');
  assert.ok(isValidState(complete()));
  const finished = complete();
  assert.equal(transition(finished, { type: 'restore' }, publishedAt + 10000), finished);
});
test('復元後の閲覧人数は1→2〜10、公開後は11〜999で止まる', () => {
  assert.equal(viewerCount(restored(), restoredAt), 1);
  assert.equal(viewerCount(restored(), publishedAt), 2);
  assert.equal(viewerCount(restored(), publishedAt + 100000), 10);
  assert.equal(viewerCount(published(), publishedAt), 11);
  assert.equal(viewerCount(published(), publishedAt + CONFIG.floodDuration), 999);
  assert.equal(viewerCount(published(), publishedAt + 86400000), 999);
});
test('現場公開後にだけ閉鎖要請と配信スレッドが現れ、書き込みが有限に増える', () => {
  assert.equal(visibleThreads('live', restored(), publishedAt).some(item => item.id === 'privacy'), false);
  const initial = visibleThreads('live', published(), publishedAt);
  assert.ok(initial.some(item => item.id === 'privacy'));
  assert.equal(initial.find(item => item.id === 'livestream').posts.length, 3);
  const later = visibleThreads('live', published(), publishedAt + CONFIG.floodPostInterval);
  assert.equal(later.find(item => item.id === 'livestream').posts.length, 4);
  assert.equal(visibleThreads('live', published(), publishedAt + 100000).find(item => item.id === 'livestream').posts.length, 24);
});
test('公開後でもアーカイブの掲示板に未来の投稿は混入しない', () => {
  for (const snapshot of ['latest', 'middle', 'oldest']) {
    const threads = visibleThreads(snapshot, published(), publishedAt + 100000);
    assert.ok(threads.every(item => !['revival', 'privacy', 'livestream'].includes(item.id)));
    assert.ok(threads.every(item => item.date <= snapshotDates(closed())[snapshot]));
  }
});
test('公開後でもアーカイブの地図には新しい事故ピンを足さない', () => {
  const records = recordsForSnapshot('oldest', snapshotDates(closed()));
  assert.equal(mapRecords(records, published(), false).length, 1);
  assert.equal(mapRecords(ACCIDENTS, published(), true).length, ACCIDENTS.length + 1);
  assert.equal(mapRecords(ACCIDENTS, published(), true).filter(item => item.buildingId === TARGET_BUILDING_ID).length, 1);
  assert.equal(ACCIDENTS.length, 18);
});
test('所在地・事故IDは一意で、新しい現場は初期の事故に含まれていない', () => {
  assert.equal(new Set(BUILDINGS.map(item => item.id)).size, BUILDINGS.length);
  assert.equal(new Set(BUILDINGS.map(addressOf)).size, BUILDINGS.length);
  assert.equal(new Set(ACCIDENTS.map(item => item.id)).size, ACCIDENTS.length);
  assert.ok(ACCIDENTS.every(record => BUILDINGS.some(item => item.id === record.buildingId)));
  assert.ok(ACCIDENTS.every(record => record.date >= '2018-11-27'));
  assert.ok(ACCIDENTS.every(record => record.buildingId !== TARGET_BUILDING_ID));
});
test('ニュースの位置・階数とメモの設備条件に一致する現場が1つになる', () => {
  const candidates = BUILDINGS.filter(place => place.x > 1240 && place.y > 680 && place.floors === 5 && place.built < 1980 && !ACCIDENTS.some(record => record.buildingId === place.id) && place.elevator.includes('更新記録なし'));
  assert.deepEqual(candidates.map(item => item.id), [TARGET_BUILDING_ID]);
  assert.equal(addressOf(TARGET_BUILDING), '霧原市汐見町3丁目6番地');
});
test('生成地図の上に全施設・川・鉄道・橋・番地のラベルが揃う', () => {
  const svg = mapSVG();
  assert.equal((svg.match(/class="map-building(?: map-building--prominent)?"/gu) || []).length, BUILDINGS.length);
  for (const place of BUILDINGS) assert.ok(svg.includes('data-building-id="' + place.id + '"'));
  for (const clue of ['kirihara-realistic-map.png', '霧原線', '汐見大橋', '霧川', '三丁目', '>6</text>']) assert.ok(svg.includes(clue), clue);
});
test('保存状態は再読み込みで復帰し、タイマー基準を保つ', () => {
  const storage = memoryStorage();
  const store = createStore(storage, startedAt);
  store.dispatch({ type: 'restore' }, restoredAt);
  store.dispatch({ type: 'publish', report: correctReport }, publishedAt);
  const reloaded = createStore(storage, publishedAt + 60000);
  assert.deepEqual(reloaded.state, store.state);
  assert.equal(viewerCount(reloaded.state, publishedAt + 60000), 999);
});
test('壊れた保存データは安全に初期化でき、保存機能自体は使い続けられる', () => {
  for (const raw of ['{broken', 'null', '{"version":999}', JSON.stringify({ ...complete(), publishedAt: restoredAt - 1 })]) {
    const storage = memoryStorage(raw);
    const store = createStore(storage, startedAt);
    assert.equal(store.state.phase, 'closed');
    assert.equal(store.persistent, true);
    assert.ok(isValidState(JSON.parse(storage.getItem(CONFIG.storageKey))));
  }
});
test('保存拒否でもタブ内で最後まで進行できる', () => {
  const store = createStore({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } }, startedAt);
  assert.equal(store.persistent, false);
  store.dispatch({ type: 'restore' }, restoredAt);
  store.dispatch({ type: 'publish', report: correctReport }, publishedAt);
  store.dispatch({ type: 'close' }, publishedAt + 1000);
  assert.equal(store.state.phase, 'complete');
});
test('書き込みだけ失敗した場合も読み取った進行を失わない', () => {
  const saved = JSON.stringify(published());
  const storage = { getItem() { return saved; }, setItem() { throw new Error('full'); } };
  const store = createStore(storage, startedAt);
  assert.equal(store.persistent, false);
  assert.equal(store.state.phase, 'published');
});
test('最初から遊ぶ操作は認証以外の全進行を新しい開始状態へ戻す', () => {
  const store = createStore(memoryStorage(JSON.stringify(complete())), startedAt);
  const nextTime = startedAt + 86400000;
  store.reset(nextTime);
  assert.deepEqual(store.state, createState(nextTime));
});
test('8画面と掲示板・施設のパラメーターを正しく読み取る', () => {
  for (const [hash, type] of [['#/closed', 'closed'], ['#/archive', 'archive'], ['#/archive/latest', 'snapshot'], ['#/archive/middle', 'snapshot'], ['#/archive/oldest', 'snapshot'], ['#/admin', 'admin'], ['#/live', 'live'], ['#/ending', 'ending']]) assert.equal(parseRoute(hash).type, type);
  assert.equal(parseRoute('#/archive/latest?view=board&thread=profile').params.get('thread'), 'profile');
  assert.equal(parseRoute('#/live?view=map&building=shiomi-third').params.get('building'), TARGET_BUILDING_ID);
  assert.equal(parseRoute('#/archive/future').type, 'home');
});
test('URL直打ちでは復元・認証・結末の条件を飛ばせない', () => {
  assert.equal(resolveRoute(parseRoute('#/live'), closed(), false).redirect, '#/closed');
  assert.equal(resolveRoute(parseRoute('#/admin'), closed(), false).login, true);
  assert.equal(resolveRoute(parseRoute('#/ending'), restored(), true).redirect, '#/live');
  assert.equal(resolveRoute(parseRoute('#/closed'), restored(), true).redirect, '#/live');
  assert.equal(resolveRoute(parseRoute('#/live'), complete(), true).redirect, '#/ending');
  assert.equal(resolveRoute(parseRoute('#/admin'), restored(), true).route.type, 'admin');
});
test('入力用HTMLを安全にエスケープし、ニュースの内容は文字幅を正規化する', () => {
  assert.equal(escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(normalizeText('５人\r\n　行方不明'), '5人行方不明');
});
test('投稿・施設一覧・掲示板の画面部品に操作用の情報が揃う', () => {
  assert.match(reportHTML(), /name="town"/u);
  assert.match(reportHTML(), /name="chome"/u);
  assert.match(reportHTML(), /name="lot"/u);
  assert.match(reportHTML(), /name="source"/u);
  assert.match(mapHTML(ACCIDENTS, '#/live', false), /旧汐見第三ビル/u);
  const thread = visibleThreads('live', restored(), publishedAt).find(item => item.id === 'revival');
  assert.match(threadHTML(thread, '#/live', restored()), /記事本文をコピー/u);
  assert.match(latestHTML('latest', snapshotDates(closed()).latest, ACCIDENTS), /KR-018/u);
});
test('演出値は設定に集約され、待機ループが無制限に走らない', () => {
  assert.ok(CONFIG.tickInterval >= 250);
  assert.equal(CONFIG.newsDelay, 5000);
  assert.ok(CONFIG.floodDuration > CONFIG.floodPostInterval);
});
test('全ESモジュールのローカルimport先・HTMLの配信ファイルが存在する', async () => {
  for (const file of ['app.js', 'community.js', 'game-state.js', 'map.js', 'map-layout.js', 'data.js', 'board-data.js']) {
    const source = await readFile(new URL('../' + file, import.meta.url), 'utf8');
    for (const match of source.matchAll(/from\s+['"](\.\/[^'"]+)['"]/gu)) await access(new URL('../' + match[1], import.meta.url));
  }
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /src="app\.js" type="module"/u);
  await access(new URL('../style.css', import.meta.url));
  await access(new URL('../assets/elevator-crash.png', import.meta.url));
});
