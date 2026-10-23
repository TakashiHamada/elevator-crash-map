import { MAP_CONFIG, BUILDINGS, TOWN_LABELS, TARGET_BUILDING_ID, getBuilding, addressOf } from './data.js';
import { NEWS } from './board-data.js';
import { MAP_LAYOUT } from './map-layout.js';
import { escapeHTML, dateLabel } from './community.js';
import { localDate } from './game-state.js';

export function mapSVG() {
  const config = MAP_CONFIG;
  return `<svg class="city-map" viewBox="0 0 ${config.width} ${config.height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <image class="map-basemap" href="${config.image}" x="0" y="0" width="${config.width}" height="${config.height}" preserveAspectRatio="xMidYMid meet"/>
    <g class="geographic-labels">${MAP_LAYOUT.geographicLabels.map(label => `<text x="${label.x}" y="${label.y}" class="${label.kind}-label"${label.rotate ? ` transform="rotate(${label.rotate} ${label.x} ${label.y})"` : ''}>${escapeHTML(label.text)}</text>`).join('')}</g>
    <g class="town-labels">${TOWN_LABELS.map(([name, x, y]) => `<text x="${x}" y="${y}">${name}</text>`).join('')}</g>
    <g class="block-labels">${MAP_LAYOUT.blockLabels.map(([name, x, y]) => `<text x="${x}" y="${y}">${name}</text>`).join('')}</g>
    <g class="building-layer">${BUILDINGS.map(place => `<g class="map-building${place.prominent ? ' map-building--prominent' : ''}" data-building-id="${place.id}">
      <rect x="${place.box[0]}" y="${place.box[1]}" width="${place.width}" height="${place.height}" rx="1"/>
      <text x="${place.x}" y="${place.box[3] + 12}">${escapeHTML(place.name)}</text>
    </g>`).join('')}</g>
  </svg>`;
}
export function sightingPinsHTML(sightings) {
  return sightings.map(item => `<button type="button" class="map-pin map-pin--sighting" style="left:${item.x}px;top:${item.y}px" data-sighting-id="${item.id}" aria-label="目撃情報：${escapeHTML(item.title)}" aria-controls="map-detail" aria-expanded="false"><span>目</span></button>`).join('');
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
    <h4>付近の施設</h4><button type="button" class="text-link" data-building-id="${place.id}">${escapeHTML(place.name)}の施設情報 →</button><p class="detail-address">${addressOf(place)}</p>`;
}
export function mapScale(full) {
  const desiredMeters = MAP_CONFIG.scaleBarPixels * MAP_CONFIG.metersPerPixel / full;
  const units = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  const meters = units.findLast(value => value <= desiredMeters) ?? units[0];
  return { meters, pixels: meters / MAP_CONFIG.metersPerPixel * full };
}

export function mapRecords(records, state, published = false) {
  if (!published) return records;
  return [...records, {
    id: 'KR-019', buildingId: TARGET_BUILDING_ID, date: localDate(state.publishedAt),
    type: 'かご落下・5名行方不明', body: NEWS.paragraphs.join('\n\n'), source: NEWS.publisher,
    comments: ['この事故、さっきの配信のやつ？', 'もう場所が分かったんだ。', '見に行く人が増えてるみたい。']
  }];
}
export function mountMap(stage, { records, state, onSelect, published = false, sightings = [] }) {
  const config = MAP_CONFIG;
  const world = stage.querySelector('#map-world');
  const panel = stage.querySelector('#map-detail');
  const controller = new AbortController();
  const signal = controller.signal;
  let zoom = 1, scale = 1, x = 0, y = 0, width = 0, height = 0, selected = null;
  const pointers = new Map();
  let pinch = null, lastFocus = null;
  const plotted = mapRecords(records, state, published);
  world.innerHTML = mapSVG() + plotted.map(record => {
    const place = getBuilding(record.buildingId);
    return `<button type="button" class="map-pin${record.id === 'KR-019' ? ' map-pin--new' : ''}" style="left:${place.x}px;top:${place.y}px" data-building-id="${place.id}" aria-label="${escapeHTML(place.name)}：${escapeHTML(record.type)}の記録" aria-controls="map-detail" aria-expanded="false"><span>!</span></button>`;
  }).join('') + sightingPinsHTML(sightings);
  world.style.width = config.width + 'px';
  world.style.height = config.height + 'px';

  function clamp() {
    const full = scale * zoom;
    x = config.width * full <= width ? (width - config.width * full) / 2 : Math.min(0, Math.max(width - config.width * full, x));
    y = config.height * full <= height ? (height - config.height * full) / 2 : Math.min(0, Math.max(height - config.height * full, y));
    world.style.transform = `translate(${x}px,${y}px) scale(${full})`;
    world.style.setProperty('--inverse-scale', 1 / full);
    world.style.setProperty('--map-label-size', 10.5 / full + 'px');
    world.style.setProperty('--map-label-stroke', 3 / full + 'px');
    world.style.setProperty('--map-town-size', 12 / full + 'px');
    stage.dataset.detailLevel = full >= config.streetLabelScale ? 'street' : full >= config.districtLabelScale ? 'district' : 'city';
    stage.querySelector('[data-map-action="out"]').disabled = zoom <= 1;
    stage.querySelector('[data-map-action="in"]').disabled = zoom >= config.maxZoom;
    const ruler = mapScale(full);
    stage.querySelector('#map-scale').textContent = ruler.meters >= 1000 ? ruler.meters / 1000 + ' km' : ruler.meters + ' m';
    stage.querySelector('#map-scale').style.width = ruler.pixels + 'px';
  }
  function resize(reset = false) {
    const newWidth = stage.clientWidth, newHeight = stage.clientHeight;
    if (!newWidth || !newHeight) return;
    const cx = width ? (width / 2 - x) / (scale * zoom) : config.width / 2;
    const cy = height ? (height / 2 - y) / (scale * zoom) : config.height / 2;
    width = newWidth; height = newHeight;
    // 表示枠を覆う倍率を最小倍率にし、地図の外側が露出しないようにします。
    scale = Math.max(width / config.width, height / config.height);
    if (reset) zoom = 1;
    x = width / 2 - cx * scale * zoom;
    y = height / 2 - cy * scale * zoom;
    clamp();
  }
  function setZoom(value, atX = width / 2, atY = height / 2) {
    value = Math.min(config.maxZoom, Math.max(1, value));
    const ratio = value / zoom;
    x = atX - (atX - x) * ratio; y = atY - (atY - y) * ratio;
    zoom = value; clamp();
  }
  function closeDetail(restore = false) {
    panel.hidden = true;
    world.querySelectorAll('[aria-expanded]').forEach(item => item.setAttribute('aria-expanded', 'false'));
    world.querySelector('.map-building.is-selected')?.classList.remove('is-selected');
    selected = null;
    if (restore) lastFocus?.focus({ preventScroll: true });
    onSelect?.(null);
  }
  function revealPanelAt(point, focus) {
    panel.hidden = false; panel.scrollTop = 0;
    if (!focus) return;
    lastFocus = document.activeElement;
    zoom = Math.max(zoom, width < 600 ? 2.3 : 1.5);
    const full = scale * zoom;
    x = width * (width > 760 ? .32 : .5) - point.x * full;
    y = height * .4 - point.y * full;
    clamp();
    panel.querySelector('button').focus({ preventScroll: true });
  }
  function selectSighting(id, focus = true) {
    const item = sightings.find(entry => entry.id === id);
    if (!item) return;
    selected = id;
    world.querySelectorAll('[aria-expanded]').forEach(marker => marker.setAttribute('aria-expanded', String(marker.dataset.sightingId === id)));
    world.querySelector('.map-building.is-selected')?.classList.remove('is-selected');
    panel.innerHTML = sightingDetailHTML(item);
    revealPanelAt(item, focus);
    onSelect?.(null, id);
  }
  function selectBuilding(id, focus = true) {
    const place = getBuilding(id);
    if (!place) return;
    selected = id;
    const record = plotted.find(item => item.buildingId === id);
    world.querySelectorAll('[aria-expanded]').forEach(item => item.setAttribute('aria-expanded', String(item.dataset.buildingId === id)));
    world.querySelector('.map-building.is-selected')?.classList.remove('is-selected');
    world.querySelector('.map-building[data-building-id="' + id + '"]')?.classList.add('is-selected');
    const elevator = !record && /事故後/u.test(place.elevator) ? place.elevator.replace(/・事故後.*$/u, '') : place.elevator;
    panel.innerHTML = `<button class="detail-close" type="button" data-map-action="close" aria-label="施設情報を閉じる">×</button>
      <p class="detail-kicker">${record ? '事故記録／' + record.id : '施設情報'}</p><h3 id="detail-title">${place.name}</h3>
      <p class="detail-address">${addressOf(place)}</p>
      ${record ? `<p class="incident-type">${record.type}</p><dl class="detail-facts"><div><dt>発生日</dt><dd>${dateLabel(record.date)}</dd></div><div><dt>出典</dt><dd>${record.source}</dd></div></dl><p class="detail-body">${escapeHTML(record.body)}</p>` : '<p class="no-record">この施設の事故情報は登録されていません。</p>'}
      <h4>建物・設備情報</h4><dl class="detail-facts"><div><dt>竣工</dt><dd>${place.built}年</dd></div><div><dt>階数・用途</dt><dd>地上${place.floors}階／${place.use}</dd></div><div><dt>昇降設備</dt><dd>${elevator}</dd></div></dl>
      ${place.note ? `<p class="building-note">${place.note}</p>` : ''}
      ${record ? `<section class="record-comments"><h4>口コミ <span>${record.comments.length}件</span></h4>${record.comments.map((comment, index) => `<div><small>${index + 1}：名無しの市民</small><p>${comment}</p></div>`).join('')}<p class="comments-readonly">口コミの投稿は受け付けていません。</p></section>` : ''}
    `;
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
    if (action === 'in') setZoom(zoom * config.zoomStep);
    if (action === 'out') setZoom(zoom / config.zoomStep);
    if (action === 'reset') { closeDetail(); resize(true); }
    if (action === 'close') closeDetail(true);
    const building = event.target.closest('[data-building-id]');
    if (building) selectBuilding(building.dataset.buildingId);
  }, { signal });
  stage.addEventListener('wheel', event => {
    if (event.target.closest('.map-detail')) return;
    event.preventDefault();
    const rect = stage.getBoundingClientRect();
    setZoom(zoom * Math.exp(-event.deltaY * .0013), event.clientX - rect.left, event.clientY - rect.top);
  }, { signal, passive: false });
  stage.addEventListener('pointerdown', event => {
    if (event.button > 0 || event.target.closest('[data-building-id],button,.map-detail')) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stage.setPointerCapture(event.pointerId);
    stage.classList.add('is-dragging');
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  }, { signal });
  stage.addEventListener('pointermove', event => {
    const old = pointers.get(event.pointerId);
    if (!old) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = stage.getBoundingClientRect();
      if (pinch) setZoom(zoom * distance / pinch, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
      pinch = distance;
    } else { x += event.clientX - old.x; y += event.clientY - old.y; clamp(); }
  }, { signal });
  function endPointer(event) {
    pointers.delete(event.pointerId); pinch = null;
    if (!pointers.size) stage.classList.remove('is-dragging');
  }
  stage.addEventListener('pointerup', endPointer, { signal });
  stage.addEventListener('pointercancel', endPointer, { signal });
  stage.addEventListener('keydown', event => {
    if (event.key === 'Escape' && selected) { closeDetail(true); return; }
    if (event.target !== stage) return;
    const pan = { ArrowLeft: [65, 0], ArrowRight: [-65, 0], ArrowUp: [0, 65], ArrowDown: [0, -65] }[event.key];
    if (pan) { event.preventDefault(); x += pan[0]; y += pan[1]; clamp(); }
    if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); setZoom(event.key === '-' ? zoom / config.zoomStep : zoom * config.zoomStep); }
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
