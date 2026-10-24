// 生成地図画像の上にラベル・事故ピン・目撃ピンを重ね、ドラッグ・ピンチ・ホイール・キーでの移動と拡大縮小を扱う。
// 座標はすべて画像のピクセル座標（map-layout.js）。調整値は data.js の MAP_CONFIG にある。
import { MAP_CONFIG, BUILDINGS, TOWN_LABELS, TARGET_BUILDING_ID, getBuilding, addressOf } from './data.js';
import { NEWS, NEWS_BODY, REPORTED_ACCIDENT } from './board-data.js';
import { MAP_LAYOUT } from './map-layout.js';
import { escapeHTML, dateLabel } from './community.js';
import { localDate } from './game-state.js';

export function mapSVG() {
  const config = MAP_CONFIG;
  // 施設一覧を設けず、地図上の施設そのものをキーボード・支援技術から選べるようにする。
  return `<svg class="city-map" viewBox="0 0 ${config.width} ${config.height}" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="施設情報">
    <image class="map-basemap" href="${config.image}" x="0" y="0" width="${config.width}" height="${config.height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"/>
    <g class="geographic-labels" aria-hidden="true">${MAP_LAYOUT.geographicLabels.map(label => `<text x="${label.x}" y="${label.y}" class="${label.kind}-label"${label.rotate ? ` transform="rotate(${label.rotate} ${label.x} ${label.y})"` : ''}>${escapeHTML(label.text)}</text>`).join('')}</g>
    <g class="town-labels" aria-hidden="true">${TOWN_LABELS.map(([name, x, y]) => `<text x="${x}" y="${y}">${escapeHTML(name)}</text>`).join('')}</g>
    <g class="block-labels" aria-hidden="true">${MAP_LAYOUT.blockLabels.map(([name, x, y]) => `<text x="${x}" y="${y}">${escapeHTML(name)}</text>`).join('')}</g>
    <g class="building-layer">${BUILDINGS.map(place => `<g class="map-building${place.prominent ? ' map-building--prominent' : ''}" data-building-id="${place.id}" tabindex="0" role="button" aria-label="${escapeHTML(place.name)}の施設情報" aria-controls="map-detail" aria-expanded="false">
      <rect x="${place.box[0]}" y="${place.box[1]}" width="${place.width}" height="${place.height}" rx="1"/>
      <text x="${place.x}" y="${place.box[3] + 12}">${escapeHTML(place.name)}</text>
    </g>`).join('')}</g>
  </svg>`;
}
export function sightingPinsHTML(sightings) {
  return sightings.map(item => `<button type="button" class="map-pin map-pin--sighting" style="left:${item.x}px;top:${item.y}px" data-sighting-id="${item.id}" aria-label="目撃情報：${escapeHTML(item.title)}" aria-controls="map-detail" aria-expanded="false"><span>目</span></button>`).join('');
}
function accidentPinsHTML(plottedRecords) {
  return plottedRecords.map(record => {
    const place = getBuilding(record.buildingId);
    return `<button type="button" class="map-pin${record.id === REPORTED_ACCIDENT.id ? ' map-pin--new' : ''}" style="left:${place.x}px;top:${place.y}px" data-building-id="${place.id}" aria-label="${escapeHTML(place.name)}：${escapeHTML(record.type)}の記録" aria-controls="map-detail" aria-expanded="false"><span>!</span></button>`;
  }).join('');
}

export function sightingDetailHTML(item) {
  const place = getBuilding(item.buildingId);
  return `<button class="detail-close" type="button" data-map-action="close" aria-label="目撃情報を閉じる">×</button>
    <p class="detail-kicker detail-kicker--sighting">目撃・証言／${item.id}</p>
    <h3 id="detail-title">${escapeHTML(item.title)}</h3>
    <p class="detail-address">${escapeHTML(item.location)}</p>
    <dl class="detail-facts"><div><dt>目撃日</dt><dd>${dateLabel(item.date)}</dd></div><div><dt>情報源</dt><dd>${escapeHTML(item.source)}</dd></div></dl>
    <p class="detail-body">${escapeHTML(item.body)}</p>
    <p class="sighting-note">寄せられた証言を記録したものです。内容のすべてが確認されているわけではありません。</p>
    <h4>付近の施設</h4><button type="button" class="text-link" data-building-id="${place.id}">${escapeHTML(place.name)}の施設情報 →</button><p class="detail-address">${escapeHTML(addressOf(place))}</p>`;
}
/** 施設の詳細パネル。record はその施設の事故記録（無ければ undefined）。 */
export function buildingDetailHTML(place, record) {
  // 事故記録が地図に載っていない施設では「事故後〜」の記述を隠し、記録より先に事故が分からないようにする。
  const elevator = !record && /事故後/u.test(place.elevator) ? place.elevator.replace(/・事故後.*$/u, '') : place.elevator;
  const recordHTML = record
    ? `<p class="incident-type">${escapeHTML(record.type)}</p><dl class="detail-facts"><div><dt>発生日</dt><dd>${dateLabel(record.date)}</dd></div><div><dt>出典</dt><dd>${escapeHTML(record.source)}</dd></div></dl><p class="detail-body">${escapeHTML(record.body)}</p>`
    : '<p class="no-record">この施設の事故情報は登録されていません。</p>';
  const commentsHTML = record
    ? `<section class="record-comments"><h4>口コミ <span>${record.comments.length}件</span></h4>${record.comments.map((comment, index) => `<div><small>${index + 1}：名無しの市民</small><p>${escapeHTML(comment)}</p></div>`).join('')}<p class="comments-readonly">口コミの投稿は受け付けていません。</p></section>`
    : '';
  return `<button class="detail-close" type="button" data-map-action="close" aria-label="施設情報を閉じる">×</button>
      <p class="detail-kicker">${record ? '事故記録／' + escapeHTML(record.id) : '施設情報'}</p><h3 id="detail-title">${escapeHTML(place.name)}</h3>
      <p class="detail-address">${escapeHTML(addressOf(place))}</p>
      ${recordHTML}
      <h4>建物・設備情報</h4><dl class="detail-facts"><div><dt>竣工</dt><dd>${place.built}年</dd></div><div><dt>階数・用途</dt><dd>地上${place.floors}階／${escapeHTML(place.use)}</dd></div><div><dt>昇降設備</dt><dd>${escapeHTML(elevator)}</dd></div></dl>
      ${place.note ? `<p class="building-note">${escapeHTML(place.note)}</p>` : ''}
      ${commentsHTML}
    `;
}
/** 表示倍率 displayScale のときの縮尺バー（切りのよい距離と、その画面上の長さ）。 */
export function mapScale(displayScale) {
  const desiredMeters = MAP_CONFIG.scaleBarPixels * MAP_CONFIG.metersPerPixel / displayScale;
  const units = MAP_CONFIG.scaleUnits;
  const meters = units.findLast(value => value <= desiredMeters) ?? units[0];
  return { meters, pixels: meters / MAP_CONFIG.metersPerPixel * displayScale };
}

/** 地図に出す事故記録。掲載済み（published）ならプレイヤーが投稿した現場の記録を末尾に足す。 */
export function mapRecords(records, state, published = false) {
  if (!published) return records;
  return [...records, {
    ...REPORTED_ACCIDENT, buildingId: TARGET_BUILDING_ID, date: localDate(state.publishedAt),
    body: NEWS_BODY, source: NEWS.publisher
  }];
}
/**
 * stage（#map-stage）に地図を組み立て、操作を受け付ける。戻り値の destroy() で全リスナーを外す。
 * plottedRecords は mapRecords() の結果。onSelect(buildingId, sightingId) は選択が変わるたびに呼ばれる（URL同期用）。
 */
export function mountMap(stage, { plottedRecords, onSelect, sightings = [] }) {
  const config = MAP_CONFIG;
  const world = stage.querySelector('#map-world');
  const panel = stage.querySelector('#map-detail');
  const zoomInButton = stage.querySelector('[data-map-action="in"]');
  const zoomOutButton = stage.querySelector('[data-map-action="out"]');
  const scaleBar = stage.querySelector('#map-scale');
  const controller = new AbortController();
  const signal = controller.signal;
  // fitScale: 表示枠を覆う基準倍率、userZoom: 利用者が操作する拡大率（1〜maxZoom）、
  // offsetX/Y: 画像左上の画面上の位置。画面上の倍率は displayScale() = fitScale × userZoom。
  let userZoom = 1, fitScale = 1, offsetX = 0, offsetY = 0, stageWidth = 0, stageHeight = 0, selectedId = null;
  let appliedScale = null;
  const pointers = new Map();
  let previousPinchDistance = null, lastFocus = null;
  world.innerHTML = mapSVG() + accidentPinsHTML(plottedRecords) + sightingPinsHTML(sightings);
  world.style.width = config.width + 'px';
  world.style.height = config.height + 'px';

  const displayScale = () => fitScale * userZoom;
  // 位置を表示枠からはみ出さない範囲に収めて反映する。倍率が変わったときだけラベル・縮尺・ボタンも更新する。
  function applyView() {
    const scale = displayScale();
    const mapWidth = config.width * scale, mapHeight = config.height * scale;
    offsetX = mapWidth <= stageWidth ? (stageWidth - mapWidth) / 2 : Math.min(0, Math.max(stageWidth - mapWidth, offsetX));
    offsetY = mapHeight <= stageHeight ? (stageHeight - mapHeight) / 2 : Math.min(0, Math.max(stageHeight - mapHeight, offsetY));
    world.style.transform = `translate(${offsetX}px,${offsetY}px) scale(${scale})`;
    if (scale === appliedScale) return;
    appliedScale = scale;
    // ピンとラベルは倍率の逆数で打ち消し、画面上で一定の大きさに見せる。
    world.style.setProperty('--inverse-scale', 1 / scale);
    world.style.setProperty('--map-label-size', config.labelFontSize / scale + 'px');
    world.style.setProperty('--map-label-stroke', config.labelStrokeWidth / scale + 'px');
    world.style.setProperty('--map-town-size', config.townFontSize / scale + 'px');
    stage.dataset.detailLevel = scale >= config.streetLabelScale ? 'street' : scale >= config.districtLabelScale ? 'district' : 'city';
    zoomOutButton.disabled = userZoom <= 1;
    zoomInButton.disabled = userZoom >= config.maxZoom;
    const ruler = mapScale(scale);
    scaleBar.textContent = ruler.meters >= 1000 ? ruler.meters / 1000 + ' km' : ruler.meters + ' m';
    scaleBar.style.width = ruler.pixels + 'px';
  }
  // 表示枠の大きさが変わったら、画面中央に見えていた地点を保ったまま基準倍率を合わせ直す。
  function resize() {
    const newWidth = stage.clientWidth, newHeight = stage.clientHeight;
    if (!newWidth || !newHeight) return;
    const centerX = stageWidth ? (stageWidth / 2 - offsetX) / displayScale() : config.width / 2;
    const centerY = stageHeight ? (stageHeight / 2 - offsetY) / displayScale() : config.height / 2;
    stageWidth = newWidth; stageHeight = newHeight;
    // 表示枠を覆う倍率を最小倍率にし、地図の外側が露出しないようにします。
    fitScale = Math.max(stageWidth / config.width, stageHeight / config.height);
    centerOn(centerX, centerY);
  }
  function centerOn(imageX, imageY) {
    offsetX = stageWidth / 2 - imageX * displayScale();
    offsetY = stageHeight / 2 - imageY * displayScale();
    applyView();
  }
  function setZoom(value, atX = stageWidth / 2, atY = stageHeight / 2) {
    value = Math.min(config.maxZoom, Math.max(1, value));
    const ratio = value / userZoom;
    offsetX = atX - (atX - offsetX) * ratio; offsetY = atY - (atY - offsetY) * ratio;
    userZoom = value; applyView();
  }
  function markSelected({ buildingId = null, sightingId = null }) {
    world.querySelectorAll('[aria-expanded]').forEach(marker => marker.setAttribute('aria-expanded', String(
      (buildingId !== null && marker.dataset.buildingId === buildingId) || (sightingId !== null && marker.dataset.sightingId === sightingId))));
    world.querySelector('.map-building.is-selected')?.classList.remove('is-selected');
    if (buildingId) world.querySelector('.map-building[data-building-id="' + buildingId + '"]')?.classList.add('is-selected');
  }
  function closeDetail(restoreFocus = false) {
    panel.hidden = true;
    markSelected({});
    selectedId = null;
    if (restoreFocus) lastFocus?.focus({ preventScroll: true });
    onSelect?.(null);
  }
  // 詳細パネルを開き、focus 指定時は選択地点がパネルに隠れない位置まで寄せる。
  function revealPanelAt(point, focus) {
    panel.hidden = false; panel.scrollTop = 0;
    if (!focus) return;
    lastFocus = document.activeElement;
    userZoom = Math.max(userZoom, stageWidth < config.focusNarrowMaxWidth ? config.focusZoomNarrow : config.focusZoomWide);
    const focusX = stageWidth > config.focusSideBySideMinWidth ? config.focusXSideBySide : config.focusXStacked;
    offsetX = stageWidth * focusX - point.x * displayScale();
    offsetY = stageHeight * config.focusY - point.y * displayScale();
    applyView();
    panel.querySelector('button').focus({ preventScroll: true });
  }
  function selectSighting(id, focus = true) {
    const item = sightings.find(entry => entry.id === id);
    if (!item) return;
    selectedId = id;
    markSelected({ sightingId: id });
    panel.innerHTML = sightingDetailHTML(item);
    revealPanelAt(item, focus);
    onSelect?.(null, id);
  }
  function selectBuilding(id, focus = true) {
    const place = getBuilding(id);
    if (!place) return;
    selectedId = id;
    markSelected({ buildingId: id });
    panel.innerHTML = buildingDetailHTML(place, plottedRecords.find(item => item.buildingId === id));
    revealPanelAt(place, focus);
    onSelect?.(id);
  }
  stage.addEventListener('click', event => {
    const layerButton = event.target.closest('[data-map-layer]');
    if (layerButton && !layerButton.disabled) {
      const layer = layerButton.dataset.mapLayer;
      if (['accidents', 'sightings'].includes(layer)) {
        const visible = layerButton.getAttribute('aria-pressed') !== 'true';
        layerButton.setAttribute('aria-pressed', String(visible));
        stage.dataset[layer + 'Hidden'] = String(!visible);
      }
      return;
    }
    const sighting = event.target.closest('[data-sighting-id]');
    if (sighting) { selectSighting(sighting.dataset.sightingId); return; }
    const action = event.target.closest('[data-map-action]')?.dataset.mapAction;
    if (action === 'in') setZoom(userZoom * config.zoomStep);
    if (action === 'out') setZoom(userZoom / config.zoomStep);
    if (action === 'close') closeDetail(true);
    const building = event.target.closest('[data-building-id]');
    if (building) selectBuilding(building.dataset.buildingId);
  }, { signal });
  stage.addEventListener('wheel', event => {
    if (event.target.closest('.map-detail')) return;
    event.preventDefault();
    const rect = stage.getBoundingClientRect();
    setZoom(userZoom * Math.exp(-event.deltaY * config.wheelZoomSensitivity), event.clientX - rect.left, event.clientY - rect.top);
  }, { signal, passive: false });
  // 建物・ピン・ボタンの上から始めた操作はクリックとして扱い、ドラッグを始めない。
  stage.addEventListener('pointerdown', event => {
    if (event.button > 0 || event.target.closest('[data-building-id],button,.map-detail')) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stage.setPointerCapture(event.pointerId);
    stage.classList.add('is-dragging');
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; previousPinchDistance = Math.hypot(a.x - b.x, a.y - b.y); }
  }, { signal });
  stage.addEventListener('pointermove', event => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      // 2本指: 指の間隔の変化率で、2本指の中点を中心に拡大縮小する。
      const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = stage.getBoundingClientRect();
      if (previousPinchDistance) setZoom(userZoom * distance / previousPinchDistance, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
      previousPinchDistance = distance;
    } else { offsetX += event.clientX - previous.x; offsetY += event.clientY - previous.y; applyView(); }
  }, { signal });
  function endPointer(event) {
    pointers.delete(event.pointerId); previousPinchDistance = null;
    if (!pointers.size) stage.classList.remove('is-dragging');
  }
  stage.addEventListener('pointerup', endPointer, { signal });
  stage.addEventListener('pointercancel', endPointer, { signal });
  // 拡大・移動で表示枠の外にある施設も、Tabで選んだときは見える位置へ寄せる。
  stage.addEventListener('focusin', event => {
    const building = event.target.closest('.map-building');
    if (!building) return;
    const place = getBuilding(building.dataset.buildingId);
    if (place) centerOn(place.x, place.y);
  }, { signal });
  stage.addEventListener('keydown', event => {
    if (event.key === 'Escape' && selectedId) { closeDetail(true); return; }
    const building = event.target.closest('.map-building');
    if (building && ['Enter', ' '].includes(event.key)) {
      event.preventDefault(); selectBuilding(building.dataset.buildingId); return;
    }
    if (event.target !== stage) return;
    const step = config.keyboardPanPixels;
    const pan = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[event.key];
    if (pan) { event.preventDefault(); offsetX += pan[0]; offsetY += pan[1]; applyView(); }
    if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); setZoom(event.key === '-' ? userZoom / config.zoomStep : userZoom * config.zoomStep); }
  }, { signal });
  const observer = new ResizeObserver(() => resize());
  observer.observe(stage);
  resize();
  return {
    selectBuilding,
    selectSighting,
    destroy() { controller.abort(); observer.disconnect(); }
  };
}
