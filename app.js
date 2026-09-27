(() => {
  'use strict';
  const config = window.MAP_CONFIG;
  const records = window.ACCIDENTS;
  const map = document.querySelector('#map');
  const world = document.querySelector('#map-world');
  const detail = document.querySelector('#detail');
  const markers = new Map();
  let zoom = 1, offsetX = 0, offsetY = 0, baseScale = 1;
  let selectedId = null, noticeTimer, lastTrigger;
  let drag = null;
  const pointers = new Map();
  let pinchDistance = null;
  const escapeHTML = text => String(text).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const dateLabel = value => value.split('-').map((part,index) => `${Number(part)}${['年','月','日'][index]}`).join('');

  window.MAP_LABELS.forEach(([name,x,y,kind='']) => {
    const label = document.createElement('span');
    label.className = `map-label ${kind}`;
    label.textContent = name;
    label.style.left = `${x}%`; label.style.top = `${y}%`;
    document.querySelector('#labels').append(label);
  });
  records.forEach(record => {
    const marker = document.createElement('button');
    marker.className = 'marker';
    marker.style.left = `${record.x}%`; marker.style.top = `${record.y}%`;
    marker.textContent = '!';
    marker.title = `${record.name}｜${dateLabel(record.date)}`;
    marker.setAttribute('aria-label', `${record.name}：${record.type}の記録を開く`);
    marker.setAttribute('aria-expanded', 'false');
    marker.setAttribute('aria-controls', 'detail');
    marker.addEventListener('click', () => { if (!drag?.moved) openRecord(record.id, true); });
    document.querySelector('#markers').append(marker);
    markers.set(record.id, marker);
  });

  function renderMap() {
    if (!map.isConnected || !baseScale) return;
    const scale = baseScale * zoom;
    offsetX = Math.min(0, Math.max(map.clientWidth - config.width * scale, offsetX));
    offsetY = Math.min(0, Math.max(map.clientHeight - config.height * scale, offsetY));
    world.style.transform = `translate(${offsetX}px,${offsetY}px) scale(${scale})`;
    world.style.setProperty('--inverse-scale', 1 / scale);
    document.querySelector('#zoom-in').disabled = zoom >= config.maxZoom;
    document.querySelector('#zoom-out').disabled = zoom <= 1;
    document.querySelector('#scale').textContent = `${Math.round(500 / zoom / 10) * 10} m`;
  }
  function resetMap() {
    zoom = 1;
    if (!map.clientWidth || !map.clientHeight) { baseScale = 0; return; }
    baseScale = Math.max(map.clientWidth / config.width, map.clientHeight / config.height);
    offsetX = (map.clientWidth - config.width * baseScale) / 2;
    offsetY = (map.clientHeight - config.height * baseScale) / 2;
    renderMap();
  }
  function setZoom(next, x = map.clientWidth / 2, y = map.clientHeight / 2) {
    next = Math.min(config.maxZoom, Math.max(1, next));
    const ratio = next / zoom;
    offsetX = x - (x - offsetX) * ratio; offsetY = y - (y - offsetY) * ratio;
    zoom = next; renderMap();
  }
  function focusRecord(record) {
    const scale = baseScale * zoom;
    const targetX = map.clientWidth > 760 ? map.clientWidth * .38 : map.clientWidth * .5;
    offsetX = targetX - record.x / 100 * config.width * scale;
    offsetY = map.clientHeight * .4 - record.y / 100 * config.height * scale;
    renderMap();
  }
  function showNotice(message) {
    const notice = document.querySelector('#notice');
    notice.textContent = message; notice.hidden = false;
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.hidden = true; }, 4500);
  }
  function closeRecord(restoreFocus = false) {
    if (selectedId) markers.get(selectedId)?.setAttribute('aria-expanded','false');
    detail.hidden = true; selectedId = null;
    if (location.hash.startsWith('#record=')) history.replaceState(null,'',location.pathname + location.search);
    if (restoreFocus) lastTrigger?.focus({preventScroll:true});
  }
  function openRecord(id, focus = false) {
    const record = records.find(item => item.id === id);
    if (!record) return;
    if (selectedId) markers.get(selectedId).setAttribute('aria-expanded','false');
    selectedId = id; lastTrigger = markers.get(id);
    lastTrigger.setAttribute('aria-expanded','true');
    detail.innerHTML = `<button class="close-button" id="close-detail" aria-label="事故情報を閉じる">×</button>
      <p class="record-id">事故記録 / ${escapeHTML(record.id)}</p>
      <h2 id="detail-title">${escapeHTML(record.name)}</h2><p class="address">霧原市${escapeHTML(record.address)}</p>
      <span class="tag">${escapeHTML(record.type)}</span>
      <dl><dt>発生年月日</dt><dd>${dateLabel(record.date)}</dd><dt>資料・出典</dt><dd>${escapeHTML(record.source)}</dd></dl>
      <p class="record-body">${escapeHTML(record.body)}</p>${record.note ? `<p class="record-note">${escapeHTML(record.note)}</p>` : ''}
      <div class="record-footer"><span>記録は発生当時のものです</span><button id="copy-record">リンクをコピー ↗</button></div>`;
    detail.hidden = false; detail.scrollTop = 0;
    history.replaceState(null,'',`#record=${encodeURIComponent(id)}`);
    document.querySelector('#close-detail').addEventListener('click', () => closeRecord(true));
    document.querySelector('#copy-record').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(location.href); showNotice('この記録のリンクをコピーしました'); }
      catch { showNotice('コピーできませんでした。アドレス欄のURLをコピーしてください'); }
    });
    if (focus) { focusRecord(record); document.querySelector('#close-detail').focus({preventScroll:true}); }
  }
  document.querySelector('#zoom-in').addEventListener('click', () => setZoom(zoom * config.zoomStep));
  document.querySelector('#zoom-out').addEventListener('click', () => setZoom(zoom / config.zoomStep));
  document.querySelector('#reset-map').addEventListener('click', () => { closeRecord(); resetMap(); showNotice('霧原市全域を表示しています'); });
  map.addEventListener('wheel', event => {
    if (event.target.closest('.detail')) return;
    event.preventDefault();
    const bounds = map.getBoundingClientRect();
    setZoom(zoom * Math.exp(-event.deltaY * .0015),event.clientX-bounds.left,event.clientY-bounds.top);
  }, {passive:false});
  map.addEventListener('pointerdown', event => {
    if (event.target.closest('button,input,select,.detail') || event.button > 0) return;
    map.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    drag = {x:event.clientX,y:event.clientY,moved:false};
    if (pointers.size === 2) { const [a,b] = [...pointers.values()]; pinchDistance = Math.hypot(a.x-b.x,a.y-b.y); }
    map.classList.add('dragging');
  });
  map.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const previous = pointers.get(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if (pointers.size === 2) {
      const [a,b] = [...pointers.values()], distance = Math.hypot(a.x-b.x,a.y-b.y), bounds = map.getBoundingClientRect();
      if (pinchDistance > 0) {
        // 距離の変化率を累乗し、拡大・縮小の両方向に同じ感度を適用します。
        const zoomRatio = Math.pow(distance / pinchDistance, config.pinchSensitivity);
        setZoom(zoom * zoomRatio, (a.x+b.x)/2-bounds.left, (a.y+b.y)/2-bounds.top);
      }
      pinchDistance = distance;
    } else {
      offsetX += event.clientX - previous.x; offsetY += event.clientY - previous.y; renderMap();
    }
    if (drag && Math.hypot(event.clientX-drag.x,event.clientY-drag.y) > 5) drag.moved = true;
  });
  function endPointer(event) {
    pointers.delete(event.pointerId); pinchDistance = null;
    if (!pointers.size) { map.classList.remove('dragging'); setTimeout(() => { drag = null; },0); }
  }
  map.addEventListener('pointerup',endPointer); map.addEventListener('pointercancel',endPointer);
  map.addEventListener('keydown', event => {
    if (event.target !== map) return;
    const pan = {ArrowLeft:[80,0],ArrowRight:[-80,0],ArrowUp:[0,80],ArrowDown:[0,-80]};
    if (pan[event.key]) { event.preventDefault(); offsetX += pan[event.key][0]; offsetY += pan[event.key][1]; renderMap(); }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(zoom*config.zoomStep); }
    if (event.key === '-') { event.preventDefault(); setZoom(zoom/config.zoomStep); }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !document.querySelector('dialog[open]')) closeRecord(true); });
  const dialog = document.querySelector('#info-dialog');
  const pages = {
    about:'<h2>このサイトについて</h2><p>エレベーター事故マップは、霧原市内の昇降機事故を地図上に記録するアーカイブです。事故のあった場所と、当時の状況を閲覧できます。</p><p>本サイトはARG（代替現実ゲーム）のために制作されたフィクションです。霧原市、施設、事故、出典として記載された資料はすべて架空であり、実在する地域・人物・組織とは関係ありません。</p>',
    policy:'<h2>掲載情報について</h2><p>掲載されている事故、建物名、住所、資料・出典はすべて作品内の設定です。実際の安全情報や不動産情報としては使用できません。</p><p>情報提供と掲示板の進行はこのブラウザー内にのみ保存され、外部には送信されません。実在する個人の情報は入力しないでください。位置情報の取得は行いません。地図と事故アイコンは本作品用に生成した画像を使用しています。</p>'
  };
  document.querySelectorAll('[data-dialog]').forEach(button => button.addEventListener('click', () => { document.querySelector('#dialog-content').innerHTML = pages[button.dataset.dialog]; dialog.showModal(); }));
  document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
  document.querySelector('#dialog-done').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); });
  const mapResizeObserver = new ResizeObserver(() => {
    if (!map.isConnected) { mapResizeObserver.disconnect(); return; }
    if (!map.clientWidth || !map.clientHeight) return;
    const oldScale = baseScale*zoom;
    if (!oldScale) { resetMap(); return; }
    const centerX = (map.clientWidth/2-offsetX)/oldScale, centerY = (map.clientHeight/2-offsetY)/oldScale;
    baseScale = Math.max(map.clientWidth/config.width,map.clientHeight/config.height);
    offsetX = map.clientWidth/2-centerX*baseScale*zoom; offsetY = map.clientHeight/2-centerY*baseScale*zoom; renderMap();
  });
  mapResizeObserver.observe(map);
  function readHash() {
    if (!map.isConnected) return;
    const id = new URLSearchParams(location.hash.slice(1)).get('record');
    if (id && records.some(record => record.id === id)) { if (!map.clientWidth) document.querySelector('#tab-map').click(); if (!baseScale) resetMap(); openRecord(id); focusRecord(records.find(record => record.id === id)); }
    else closeRecord();
  }
  window.addEventListener('hashchange',readHash);
  resetMap(); readHash();
})();
