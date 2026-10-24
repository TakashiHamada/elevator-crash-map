import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { MAP_LAYOUT } from '../map-layout.js';
import { MAP_CONFIG, BUILDINGS, ACCIDENTS, SIGHTINGS, TARGET_BUILDING, sightingsForSnapshot } from '../data.js';
import { snapshotDates, createState } from '../game-state.js';
import { mapSVG, sightingPinsHTML, sightingDetailHTML, mapScale, mountMap } from '../map.js';
import { mapHTML } from '../community.js';

// PNGの画素を直接読み、座標が道路・水面・建物のどこに当たるかを検証します。
// 依存ライブラリは使わず、生成された8bit RGB/RGBA PNGを対象にします。
let imagePromise;
// 配信用WebPの容量の上限。品質を上げて超える場合はこの値を見直す。
const MAP_WEBP_BUDGET_BYTES = 500 * 1024;
function imageData() {
  if (imagePromise) return imagePromise;
  imagePromise = (async () => {
    const file = await readFile(new URL('../' + MAP_LAYOUT.sourceImage, import.meta.url));
    assert.equal(file.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const width = file.readUInt32BE(16), height = file.readUInt32BE(20);
    assert.equal(file[24], 8);
    assert.equal(file[28], 0);
    const channels = file[25] === 2 ? 3 : file[25] === 6 ? 4 : 0;
    assert.ok(channels);
    const chunks = [];
    for (let offset = 8; offset < file.length;) {
      const size = file.readUInt32BE(offset);
      if (file.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(file.subarray(offset + 8, offset + 8 + size));
      offset += size + 12;
    }
    const raw = inflateSync(Buffer.concat(chunks));
    const stride = width * channels, pixels = Buffer.alloc(stride * height);
    let position = 0;
    const paeth = (a, b, c) => {
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    };
    for (let y = 0; y < height; y++) {
      const filter = raw[position++];
      assert.ok(filter <= 4);
      for (let x = 0; x < stride; x++) {
        const index = y * stride + x;
        const a = x >= channels ? pixels[index - channels] : 0;
        const b = y ? pixels[index - stride] : 0;
        const c = y && x >= channels ? pixels[index - stride - channels] : 0;
        const predictor = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
        pixels[index] = (raw[position++] + predictor) & 255;
      }
    }
    return { file, width, height, pixel(x, y) { const offset = (y * width + x) * channels; return [...pixels.subarray(offset, offset + 3)]; } };
  })();
  return imagePromise;
}
const dates = snapshotDates(createState(Date.parse('2026-10-23T12:00:00+09:00')));
const isWater = ([r, g, b]) => b > r + 25 && b > g + 20 && g > 140;
const interpolated = (line, x, axis) => {
  const input = axis === 'y' ? 1 : 0, output = 1 - input;
  const right = line.findIndex(point => point[input] >= x);
  if (right <= 0) return line[Math.max(0, right)][output];
  const a = line[right - 1], b = line[right];
  return a[output] + (b[output] - a[output]) * (x - a[input]) / (b[input] - a[input]);
};
test('配信画像の寸法・座標系・画像の指紋が一致する', async () => {
  const image = await imageData();
  assert.equal(image.width, MAP_CONFIG.width);
  assert.equal(image.height, MAP_CONFIG.height);
  assert.equal(createHash('sha256').update(image.file).digest('hex'), MAP_LAYOUT.imageSha256);
  assert.match(mapSVG(), /<image class="map-basemap"/u);
  assert.match(mapSVG(), /preserveAspectRatio="xMidYMid meet"/u);
});
test('配信用WebPは元PNGと同じ寸法で、容量の予算内に収まる', async () => {
  const file = await readFile(new URL('../' + MAP_CONFIG.image, import.meta.url));
  assert.equal(file.toString('ascii', 0, 4), 'RIFF');
  assert.equal(file.toString('ascii', 8, 16), 'WEBPVP8 ');
  assert.equal(file.readUInt16LE(26) & 0x3fff, MAP_CONFIG.width);
  assert.equal(file.readUInt16LE(28) & 0x3fff, MAP_CONFIG.height);
  assert.ok(file.length <= MAP_WEBP_BUDGET_BYTES, `${file.length} bytes`);
});
test('31施設の中心は生成画像の灰色の建物に重なり、水面や白い道路に乗らない', async () => {
  const image = await imageData();
  assert.equal(BUILDINGS.length, 31); // 登録施設の件数。変更時は README も更新する
  for (const place of BUILDINGS) {
    assert.ok(place.x >= 0 && place.x < image.width && place.y >= 0 && place.y < image.height, place.id);
    const color = image.pixel(place.x, place.y), [r, g, b] = color;
    assert.ok(!isWater(color), place.id + ': 水面');
    assert.ok(r >= 153 && r <= 217 && g >= 155 && g <= 221 && b >= 158 && b <= 226 && Math.max(...color) - Math.min(...color) <= 22, place.id + ': 建物外');
    assert.ok(place.box[0] <= place.x && place.x < place.box[2] && place.box[1] <= place.y && place.y < place.box[3], place.id);
  }
});
test('事故18件のピンは登録済み施設に結び付き、施設の当たり領域も原画像に対応する', () => {
  for (const record of ACCIDENTS) {
    const place = BUILDINGS.find(item => item.id === record.buildingId);
    assert.ok(place);
    assert.equal(place.width, place.box[2] - place.box[0]);
    assert.equal(place.height, place.box[3] - place.box[1]);
  }
});
test('全施設の切り抜き・当たり領域が同じ原寸の輪郭を使い、施設の中心を含む', () => {
  const svg = mapSVG();
  assert.ok(!svg.includes('<rect'), '四角い施設表示を残さない');
  assert.ok(svg.includes(`<image id="facility-source-image" href="${MAP_CONFIG.image}" x="0" y="0" width="${MAP_CONFIG.width}" height="${MAP_CONFIG.height}"`));
  for (const place of BUILDINGS) {
    assert.ok(place.outline.length >= 3, place.id);
    let inside = false;
    for (let i = 0, j = place.outline.length - 1; i < place.outline.length; j = i++) {
      const [x, y] = place.outline[i], [previousX, previousY] = place.outline[j];
      assert.ok(Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= MAP_CONFIG.width && y >= 0 && y <= MAP_CONFIG.height, place.id);
      if ((y > place.y) !== (previousY > place.y) && place.x < (previousX - x) * (place.y - y) / (previousY - y) + x) inside = !inside;
    }
    assert.ok(inside, place.id + ': 事故ピンの基準点が切り抜きの外');
    const points = place.outline.map(point => point.join(',')).join(' ');
    assert.ok(svg.includes(`<clipPath id="facility-clip-${place.id}" clipPathUnits="userSpaceOnUse"><polygon points="${points}"/></clipPath>`), place.id);
    assert.ok(svg.includes(`<g clip-path="url(#facility-clip-${place.id})"><use href="#facility-source-image"/></g>`), place.id);
    assert.ok(svg.includes(`<polygon class="building-hit-area" points="${points}"`), place.id);
  }
});
test('6件の目撃地点は付近の歩道や広場の明るい地面にあり、水面と建物内部を避ける', async () => {
  const image = await imageData();
  assert.equal(SIGHTINGS.length, 6); // 脚本上の件数。変更時は README も更新する
  assert.equal(new Set(SIGHTINGS.map(item => item.id)).size, SIGHTINGS.length);
  for (const item of SIGHTINGS) {
    const place = BUILDINGS.find(entry => entry.id === item.buildingId), color = image.pixel(item.x, item.y);
    assert.ok(place);
    assert.ok(!isWater(color), item.id + ': 水面');
    assert.ok(Math.min(...color) > 242 && Math.max(...color) - Math.min(...color) < 15, item.id + ': 歩道・広場外');
    assert.ok(Math.hypot(item.x - place.x, item.y - place.y) < 65, item.id + ': 証言の施設から離れている');
    assert.ok(item.x < place.box[0] || item.x >= place.box[2] || item.y < place.box[1] || item.y >= place.box[3], item.id + ': 建物内部');
  }
});
test('目撃情報は保存日以前のものだけを表示し、最古の保存には追加しない', () => {
  // 保存日より後の目撃は出さない（脚本上の世代別件数）。
  assert.equal(sightingsForSnapshot('oldest', dates).length, 0);
  assert.equal(sightingsForSnapshot('middle', dates).length, 4);
  assert.equal(sightingsForSnapshot('latest', dates).length, 6);
  assert.equal(sightingsForSnapshot('live', dates).length, 6);
  for (const snapshot of ['oldest', 'middle', 'latest']) assert.ok(sightingsForSnapshot(snapshot, dates).every(item => item.date <= dates[snapshot]));
});
test('現場は画像の川の東岸・線路と橋の南側で、両側に空地がある', async () => {
  const place = TARGET_BUILDING, geography = MAP_LAYOUT.geography, image = await imageData();
  assert.ok(place.x > interpolated(geography.riverCenterline, place.y, 'y') + 50);
  assert.ok(place.y > interpolated(geography.railwayLine, place.x, 'x'));
  assert.ok(place.y > geography.lowerBridge.y);
  assert.ok(!isWater(image.pixel(place.x, place.y)));
  for (const x of [place.box[0] - 8, place.box[2] + 16]) {
    const color = image.pixel(x, place.y);
    assert.ok(!isWater(color));
    assert.ok(Math.min(...color) > 220, '隣接区画が空地ではない');
  }
});
test('拡大率に応じて縮尺の線と距離が同じ倍率で変わる', () => {
  for (const full of [.2, .5, 1, 3.5]) {
    const scale = mapScale(full);
    assert.ok(Math.abs(scale.pixels / full * MAP_CONFIG.metersPerPixel - scale.meters) < 1e-8);
    assert.ok(scale.pixels <= MAP_CONFIG.scaleBarPixels);
    assert.ok(scale.pixels >= MAP_CONFIG.scaleBarPixels / 3);
  }
});
test('目撃ピン・詳細・表示レイヤーが同じ証言を指す', () => {
  const html = sightingPinsHTML(SIGHTINGS);
  for (const item of SIGHTINGS) {
    assert.ok(html.includes('data-sighting-id="' + item.id + '"'));
    assert.ok(html.includes('left:' + item.x + 'px;top:' + item.y + 'px'));
    const detail = sightingDetailHTML(item);
    assert.ok(detail.includes(item.title));
    assert.ok(detail.includes(item.body));
    assert.ok(detail.includes('data-building-id="' + item.buildingId + '"'));
  }
  const controls = mapHTML(ACCIDENTS, SIGHTINGS);
  assert.match(controls, /data-map-layer="accidents"/u);
  assert.match(controls, /data-map-layer="sightings"/u);
  assert.match(controls, /目撃情報 6/u);
});
test('全施設を支援技術から識別でき、キーボードでフォーカスできる', () => {
  // 生成SVGの階層を追い、施設自身だけでなく祖先の aria-hidden も確認する。
  const ancestors = [], facilities = new Map();
  for (const [tag] of mapSVG().matchAll(/<\/?([\w-]+)\b[^>]*>/gu)) {
    if (tag.startsWith('</')) { ancestors.pop(); continue; }
    const attributes = Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/gu)].map(([, key, value]) => [key, value]));
    if (attributes['data-building-id']) {
      assert.ok([...ancestors, attributes].every(item => item['aria-hidden'] !== 'true'), attributes['data-building-id']);
      facilities.set(attributes['data-building-id'], attributes);
    }
    if (!tag.endsWith('/>')) ancestors.push(attributes);
  }
  assert.equal(facilities.size, BUILDINGS.length);
  for (const place of BUILDINGS) {
    const attributes = facilities.get(place.id);
    assert.ok(attributes, place.id);
    assert.equal(attributes.tabindex, '0', place.id);
    assert.equal(attributes.role, 'button', place.id);
    assert.equal(attributes['aria-label'], place.name + 'の施設情報', place.id);
    assert.equal(attributes['aria-controls'], 'map-detail', place.id);
    assert.equal(attributes['aria-expanded'], 'false', place.id);
  }
});
test('詳細は地図のタップ・クリックで閉じ、別スポットでは直接切り替わり、ドラッグ・ピンチでは閉じない', t => {
  const handlers = new Map(), selections = [];
  const node = (selectors = [], parent = null, dataset = {}) => ({
    dataset,
    attributes: new Map(),
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    setAttribute(name, value) { this.attributes.set(name, value); },
    closest(selector) {
      return selector.split(',').some(part => selectors.includes(part)) ? this : parent?.closest(selector) ?? null;
    }
  });
  const style = () => ({ setProperty() {} });
  const closeButton = { focus() {} };
  const panel = { ...node(['.map-detail']), hidden: true, querySelector: () => closeButton };
  const world = { ...node(), style: style(), querySelectorAll: () => [], querySelector: () => null };
  const elements = new Map([
    ['#map-world', world], ['#map-detail', panel], ['#map-scale', { style: style() }],
    ['[data-map-action="in"]', {}], ['[data-map-action="out"]', {}]
  ]);
  const stage = {
    ...node(), clientWidth: 800, clientHeight: 500, dataset: {},
    classList: { add() {}, remove() {} }, setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    querySelector: selector => elements.get(selector),
    addEventListener: (type, handler) => handlers.set(type, handler)
  };
  const background = node([], world);
  world.contains = target => [world, background].includes(target);
  const facility = node(['[data-building-id]', '.map-building'], world, { buildingId: BUILDINGS[0].id });
  let keyboardFocus = false;
  facility.matches = selector => selector === ':focus-visible' && keyboardFocus;
  const sighting = node(['[data-sighting-id]', 'button'], world, { sightingId: SIGHTINGS[0].id });
  const click = target => handlers.get('click')({ target, detail: 1 });
  const pointer = (type, pointerType, x = 100, pointerId = 1) => handlers.get(type)({
    target: background, pointerId, pointerType, button: 0, clientX: x, clientY: 100
  });
  for (const [key, value] of Object.entries({
    document: { activeElement: null }, ResizeObserver: class { observe() {} disconnect() {} }
  })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    });
  }
  const map = mountMap(stage, { plottedRecords: ACCIDENTS, sightings: SIGHTINGS,
    onSelect: (...ids) => selections.push(ids) });
  t.after(() => map.destroy());

  for (const pointerType of ['mouse', 'touch']) {
    map.selectBuilding(TARGET_BUILDING.id);
    selections.length = 0;
    // pointerdown → focusin → pointerup → clickの順序で、押している間に地図が動かないことを確認する。
    const beforeTap = world.style.transform;
    handlers.get('pointerdown')({ target: facility, pointerType, button: 0, pointerId: 1 });
    handlers.get('focusin')({ target: facility });
    assert.equal(world.style.transform, beforeTap, pointerType + 'のフォーカスで地図を動かさない');
    assert.deepEqual(selections, []);
    handlers.get('pointerup')({ pointerId: 1 });
    click(node([], facility)); // 建物の子要素を押しても、一度閉じずに切り替わる。
    assert.equal(panel.hidden, false);
    assert.ok(panel.innerHTML.includes(BUILDINGS[0].name));
    click(node([], sighting));
    assert.equal(panel.hidden, false);
    assert.ok(panel.innerHTML.includes(SIGHTINGS[0].title));
    assert.deepEqual(selections, [[BUILDINGS[0].id], [null, SIGHTINGS[0].id]]);

    selections.length = 0;
    click(node([], panel));
    click(node(['button', '[data-map-action]'], stage, { mapAction: 'in' }));
    click(node(['button', '[data-map-layer]'], stage, { mapLayer: 'sightings' }));
    assert.equal(panel.hidden, false);
    assert.deepEqual(selections, []);

    pointer('pointerdown', pointerType);
    pointer('pointermove', pointerType, 100 + MAP_CONFIG.tapMoveTolerancePixels + 1);
    pointer('pointerup', pointerType);
    click(stage); // pointer capture後はstageにクリックが届く。
    assert.equal(panel.hidden, false);
    assert.deepEqual(selections, []);

    pointer('pointerdown', pointerType);
    pointer('pointerdown', pointerType, 200, 2);
    pointer('pointermove', pointerType, 240, 2);
    pointer('pointerup', pointerType, 240, 2);
    pointer('pointerup', pointerType);
    click(stage);
    assert.equal(panel.hidden, false);
    assert.deepEqual(selections, []);

    pointer('pointerdown', pointerType);
    pointer('pointermove', pointerType, 100 + MAP_CONFIG.tapMoveTolerancePixels / 2);
    pointer('pointerup', pointerType);
    click(stage);
    assert.equal(panel.hidden, true);
    assert.deepEqual(selections, [[null]]);

    map.selectBuilding(TARGET_BUILDING.id);
    click(background);
    assert.equal(panel.hidden, true);
  }
  const beforeKeyboardFocus = world.style.transform;
  keyboardFocus = true;
  handlers.get('focusin')({ target: facility });
  assert.notEqual(world.style.transform, beforeKeyboardFocus, 'キーボードで選ぶと施設の位置へ地図を動かす');
  assert.equal(panel.hidden, true, 'フォーカス移動だけでは詳細を開かない');
});
test('右端の建物と詳細が重なると左へ表示し、移動・倍率・サイズ変更で位置を更新する', t => {
  const handlers = new Map();
  let resize, bottomPanel = false;
  const style = () => ({ setProperty() {} });
  const world = { style: style(), querySelectorAll: () => [], querySelector: () => null };
  const panel = {
    hidden: true,
    get offsetWidth() { return bottomPanel ? stage.clientWidth - 20 : 360; },
    get offsetHeight() { return bottomPanel ? 300 : stage.clientHeight - 48; },
    get offsetLeft() { return bottomPanel ? 10 : stage.dataset.detailSide === 'left' ? 12 : stage.clientWidth - this.offsetWidth - 12; },
    get offsetTop() { return bottomPanel ? stage.clientHeight - this.offsetHeight - 10 : 12; },
    querySelector: () => ({ focus() {} })
  };
  const elements = new Map([
    ['#map-world', world], ['#map-detail', panel], ['#map-scale', { style: style() }],
    ['[data-map-action="in"]', {}], ['[data-map-action="out"]', {}]
  ]);
  const stage = {
    clientWidth: 800, clientHeight: 500, dataset: {},
    querySelector: selector => elements.get(selector),
    addEventListener: (type, handler) => handlers.set(type, handler)
  };
  for (const [key, value] of Object.entries({
    document: { activeElement: null },
    ResizeObserver: class { constructor(callback) { resize = callback; } observe() {} disconnect() {} }
  })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    });
  }
  const map = mountMap(stage, { plottedRecords: ACCIDENTS, sightings: SIGHTINGS });
  t.after(() => map.destroy());
  const keydown = key => handlers.get('keydown')({ key, target: stage, preventDefault() {} });
  stage.closest = () => null;

  map.selectBuilding(TARGET_BUILDING.id);
  assert.equal(stage.dataset.detailSide, 'left', '右端の建物は詳細を左側に出す');
  map.selectBuilding(TARGET_BUILDING.id, false);
  assert.equal(stage.dataset.detailSide, 'left', '左側に表示した後も配置が往復しない');
  map.selectBuilding('central');
  assert.equal(stage.dataset.detailSide, 'right', '中央の建物へ切り替えると通常の右側へ戻す');
  map.selectBuilding('warehouse', false);
  assert.equal(stage.dataset.detailSide, 'left', '地図を動かさず詳細を開く場合も判定する');

  map.selectBuilding(TARGET_BUILDING.id);
  stage.clientWidth = 2000;
  resize();
  assert.equal(stage.dataset.detailSide, 'right', '表示枠が広がり重ならなくなれば右側に戻す');
  keydown('ArrowLeft');
  assert.equal(stage.dataset.detailSide, 'left', '倍率が変わらない移動でも重なりを検知する');
  keydown('ArrowRight');
  assert.equal(stage.dataset.detailSide, 'right');
  keydown('+');
  assert.equal(stage.dataset.detailSide, 'left', '拡大後の建物の範囲で判定する');
  keydown('-');
  assert.equal(stage.dataset.detailSide, 'right');

  stage.clientWidth = 400;
  bottomPanel = true;
  resize();
  assert.equal(stage.dataset.detailSide, 'right', '下部全面のパネルは左右を切り替えない');
  keydown('Escape');
  assert.equal(panel.hidden, true);
  assert.equal(stage.dataset.detailSide, 'right');
});
test('EnterとSpaceで事故未掲載の施設を選び、Escapeで元の施設にフォーカスを戻せる', () => {
  // レイアウトの見た目は検証せず、mountMap の選択・フォーカス・イベント処理に必要なDOMだけを用意する。
  const originalGlobals = new Map(['document', 'ResizeObserver'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const handlers = new Map(), selected = [], attributes = new Map(), classes = new Set();
  const facility = {
    dataset: { buildingId: TARGET_BUILDING.id },
    classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
    setAttribute: (name, value) => attributes.set(name, value),
    closest: selector => selector === '.map-building' ? facility : null,
    focus() { globalThis.document.activeElement = facility; }
  };
  const style = () => ({ setProperty() {} });
  const closeButton = { focus() { globalThis.document.activeElement = closeButton; } };
  const panel = { hidden: true, innerHTML: '', querySelector: () => closeButton };
  const world = {
    style: style(),
    querySelectorAll: () => [facility],
    querySelector: selector => selector === '.map-building.is-selected'
      ? (classes.has('is-selected') ? facility : null) : facility
  };
  const elements = new Map([
    ['#map-world', world], ['#map-detail', panel], ['#map-scale', { style: style() }],
    ['[data-map-action="in"]', {}], ['[data-map-action="out"]', {}]
  ]);
  const stage = {
    clientWidth: 800, clientHeight: 500, dataset: {},
    querySelector: selector => elements.get(selector),
    addEventListener: (type, handler) => handlers.set(type, handler)
  };
  let map;
  try {
    globalThis.document = { activeElement: facility };
    globalThis.ResizeObserver = class { observe() {} disconnect() {} };
    assert.ok(ACCIDENTS.every(record => record.buildingId !== TARGET_BUILDING.id));
    map = mountMap(stage, { plottedRecords: ACCIDENTS, onSelect: id => selected.push(id) });
    for (const key of ['Enter', ' ']) {
      let prevented = false;
      handlers.get('keydown')({ key, target: facility, preventDefault() { prevented = true; } });
      assert.equal(prevented, true, key);
      assert.equal(selected.at(-1), TARGET_BUILDING.id, key);
      assert.equal(panel.hidden, false, key);
      assert.ok(panel.innerHTML.includes(TARGET_BUILDING.name), key);
      assert.ok(panel.innerHTML.includes('この施設の事故情報は登録されていません。'), key);
      assert.equal(attributes.get('aria-expanded'), 'true', key);
      assert.ok(classes.has('is-selected'), key + ': 詳細表示中は建物も選択状態');
      assert.equal(globalThis.document.activeElement, closeButton, key);
      handlers.get('keydown')({ key: 'Escape', target: closeButton });
      assert.equal(panel.hidden, true);
      assert.equal(attributes.get('aria-expanded'), 'false');
      assert.ok(!classes.has('is-selected'), '詳細を閉じると建物の選択表示も解除');
      assert.equal(globalThis.document.activeElement, facility);
    }
  } finally {
    map?.destroy();
    for (const [key, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
