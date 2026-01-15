document.addEventListener('DOMContentLoaded', () => {

  // ======================
  // JSON 読み込み
  // ======================
  async function loadLiveData() {
    try {
      const response = await fetch('data/live.json');
      if (!response.ok) throw new Error('JSON load error ' + response.status);
      return await response.json();
    } catch (e) {
      console.error(e);
      alert('ライブデータの読み込みに失敗しました');
      return [];
    }
  }

  // ======================
  // ★QR/URL用：公演ID生成（JSON構造は変えない）
  // ======================
  function norm(s) {
    return (s || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[’']/g, "'")
      .toUpperCase();
  }

  // ======================
  // ★ 公演用ハッシュID生成
  // ======================
  function fnv1a32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h >>> 0;
  }
  
  function makeShowKey(liveName, show) {
    return `${liveName}|${show.date}|${show.venue}|${show.time || ''}`;
  }

  
  // QR・保存用の短いID（数字）
  function makeShortShowId(liveName, show) {
    return String(fnv1a32(makeShowKey(liveName, show)));
  }

  
  function makeShowId(liveName, show) {
    return [
      norm(liveName),
      show.date,
      norm(show.venue),
      show.time ? norm(show.time) : ''
    ].join('|');
  }


  function getCheckedShowIds() {
    return Array.from(document.querySelectorAll('.show-check:checked'))
      .map(cb => {
        const data = JSON.parse(cb.dataset.show);
        return makeShortShowId(data.live, data.show);
      });
  }

function createQrElement(text) {
  // できるだけ小さく、でも読み取りは死なないバランス
  const boxSize = 60;  // 外枠サイズ
  const pad = 4;       // quiet zone（最低限）
  const imgSize = boxSize - pad * 2;

  const box = document.createElement('div');
  box.style.width = boxSize + 'px';
  box.style.height = boxSize + 'px';
  box.style.background = '#fff';
  box.style.padding = pad + 'px';
  box.style.borderRadius = '0px'; // ★角丸なし
  box.style.boxSizing = 'border-box';
  box.style.opacity = '1';

  // 一旦大きめで作ってPNG化 → 縮小表示（html2canvasでも崩れにくい）
  const tmp = document.createElement('div');
  tmp.style.position = 'fixed';
  tmp.style.left = '-9999px';
  tmp.style.top = '-9999px';
  document.body.appendChild(tmp);

  const GEN = 256; // 生成解像度（高めの方が綺麗）
  new QRCode(tmp, {
    text,
    width: GEN,
    height: GEN,
    // ★Hは細かくなりがちなのでMに落として読み取り優先
    correctLevel: QRCode.CorrectLevel.M
  });

  // qrcodejsは canvas / img / table の可能性がある
  let dataUrl = null;

  const canvas = tmp.querySelector('canvas');
  if (canvas) {
    dataUrl = canvas.toDataURL('image/png');
  } else {
    const img = tmp.querySelector('img');
    if (img && img.src) dataUrl = img.src;
  }

  tmp.remove();

  const out = document.createElement('img');
  out.src = dataUrl || '';
  out.alt = 'QR';
  out.style.width = imgSize + 'px';
  out.style.height = imgSize + 'px';
  out.style.display = 'block';
  out.style.imageRendering = 'pixelated'; // にじみ抑制
  box.appendChild(out);

  return box;
}


  // ======================
  // ★ v2: QR用（ビット列） - 日付+AM/PMでインデックス化
  // ======================
  let __tinyIdList = [];
  let __tinyIdToIndex = new Map();

  function makeTinyId(show) {
    const d = (show.date || '').replace(/-/g, ''); // YYYYMMDD
    const t = show.time === 'AM' ? 'A' : show.time === 'PM' ? 'P' : '';
    return d + t;
  }


  function buildTinyIndex(liveData) {
    const list = [];
    liveData.forEach(live => {
      (live.years || []).forEach(y => {
        (y.shows || []).forEach(s => {
          list.push(makeTinyId(s));
        });
      });
    });
    __tinyIdList = list;
    __tinyIdToIndex = new Map(list.map((id, i) => [id, i]));
  }

  function setBit(bytes, i) {
    bytes[i >> 3] |= (1 << (i & 7));
  }
  function getBit(bytes, i) {
    return (bytes[i >> 3] & (1 << (i & 7))) !== 0;
  }

  function base64UrlEncode(bytes) {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function base64UrlDecode(str) {
    const pad = '='.repeat((4 - (str.length % 4)) % 4);
    const bin = atob((str + pad).replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  
  function applyBitsetB64(b64) {
  const bytes = base64UrlDecode(b64);

  document.querySelectorAll('.show-check').forEach(cb => {
    const d = JSON.parse(cb.dataset.show);
    const id = makeTinyId(d.show);
    const idx = __tinyIdToIndex.get(id);
    if (idx === undefined) {
      cb.checked = false;
      return;
    }
    cb.checked = getBit(bytes, idx);
  });

  updateExportButtonState();
}


  function getCheckedBitsetB64() {
    const bytes = new Uint8Array(Math.ceil(__tinyIdList.length / 8));
    document.querySelectorAll('.show-check:checked').forEach(cb => {
      const d = JSON.parse(cb.dataset.show);
      const id = makeTinyId(d.show);
      const idx = __tinyIdToIndex.get(id);
      if (idx !== undefined) setBit(bytes, idx);
    });

    // ★末尾の0をトリム（短くなりやすい）
    let last = bytes.length - 1;
    while (last >= 0 && bytes[last] === 0) last--;
    const trimmed = bytes.slice(0, Math.max(1, last + 1));

    return base64UrlEncode(trimmed);
  }

function indexesToRanges(idxs) {
  if (!idxs || idxs.length === 0) return '';
  const parts = [];
  let start = idxs[0];
  let prev = idxs[0];

  for (let i = 1; i < idxs.length; i++) {
    const cur = idxs[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    parts.push(start === prev ? String(start) : `${start}-${prev}`);
    start = prev = cur;
  }
  parts.push(start === prev ? String(start) : `${start}-${prev}`);
  return parts.join(',');
}

function applyRanges(rangeStr) {
  const checked = new Set();

  if (typeof rangeStr === 'string' && rangeStr.length > 0) {
    for (const token of rangeStr.split(',')) {
      if (!token) continue;
      const seg = token.split('-');
      if (seg.length === 1) {
        const v = parseInt(seg[0], 10);
        if (!Number.isNaN(v)) checked.add(v);
      } else {
        const a = parseInt(seg[0], 10);
        const b = parseInt(seg[1], 10);
        if (Number.isNaN(a) || Number.isNaN(b)) continue;
        const from = Math.min(a, b);
        const to = Math.max(a, b);
        for (let i = from; i <= to; i++) checked.add(i);
      }
    }
  }

  document.querySelectorAll('.show-check').forEach(cb => {
    const d = JSON.parse(cb.dataset.show);
    const id = makeTinyId(d.show);
    const idx = __tinyIdToIndex.get(id);
    cb.checked = (idx !== undefined) && checked.has(idx);
  });

  updateExportButtonState();
}


function encodeDeltaBase36(idxs) {
  if (!idxs || idxs.length === 0) return '';
  const sorted = idxs.slice().sort((a, b) => a - b);
  const parts = [];
  let prev = 0;
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const d = (i === 0) ? cur : (cur - prev);
    parts.push(d.toString(36));
    prev = cur;
  }
  return parts.join('.');
}

function decodeDeltaBase36(str) {
  if (!str) return [];
  const parts = String(str).split('.');
  const idxs = [];
  let cur = 0;
  for (let i = 0; i < parts.length; i++) {
    const d = parseInt(parts[i], 36);
    if (!Number.isFinite(d)) break;
    cur = (i === 0) ? d : (cur + d);
    idxs.push(cur);
  }
  return idxs;
}

function getCheckedIndexes() {
  const idxs = [];
  document.querySelectorAll('.show-check:checked').forEach(cb => {
    const d = JSON.parse(cb.dataset.show);
    const id = makeTinyId(d.show);
    const idx = __tinyIdToIndex.get(id);
    if (idx !== undefined) idxs.push(idx);
  });
  idxs.sort((a, b) => a - b);
  return idxs;
}
  
// ----------------------
// ★最短を自動選択してURL化
//   r: レンジ
//   d: 差分(base36)
//   b: ビット列(base64url)
// ----------------------
function makeShareUrl() {
  let userName = document.getElementById('user-name')?.value?.trim() || '';
  let userX = document.getElementById('user-x')?.value?.trim() || '';
  if (userX && !userX.startsWith('@')) userX = '@' + userX;

  const base = `${location.origin}${location.pathname}`;
  const params = new URLSearchParams();

  // まずはチェック状態を取る（tinyIndex前提）
  if (__tinyIdList && __tinyIdList.length > 0) {
    const idxs = getCheckedIndexes();

    const r = indexesToRanges(idxs);
    const d = encodeDeltaBase36(idxs);

    // ビット列は最悪ケースに強い（ただし長くなることもある）
    const b = getCheckedBitsetB64();

    // 最短を選ぶ
    let mode = 'r';
    let payload = r;

    if (typeof d === 'string' && d.length > 0 && (payload === '' || d.length < payload.length)) {
      mode = 'd';
      payload = d;
    }
    if (typeof b === 'string' && b.length > 0 && (payload === '' || b.length < payload.length)) {
      mode = 'b';
      payload = b;
    }

    // 空でもセットしておく（復元側で全解除ができる）
    params.set(mode, payload);

    if (userName) params.set('n', userName);
    if (userX) params.set('x', userX);

    return `${base}?${params.toString()}`;
  }

  // 念のためのフォールバック（旧方式）
  if (typeof LZString === 'undefined') {
    console.warn('LZString が見つかりません。lz-string を読み込んでください。');
    const payload = { v: 1, n: userName, x: userX, c: getCheckedShowIds() };
    const json = JSON.stringify(payload);
    const encoded = encodeURIComponent(json);
    return `${base}#s0=${encoded}`;
  }

  const payload = { v: 1, n: userName, x: userX, c: getCheckedShowIds() };
  const json = JSON.stringify(payload);
  const compressed = LZString.compressToEncodedURIComponent(json);
  return `${base}#s=${compressed}`;
}

function stripStateParamsFromUrl() {
  try {
    const url = new URL(location.href);

    // チェック状態だけ消す（名前とXは残す）
    url.searchParams.delete('b');
    url.searchParams.delete('r');
    url.searchParams.delete('d');

    // 履歴を増やさずURLだけ差し替え
    history.replaceState(null, '', url.toString());
  } catch (e) {}
}

  
function restoreFromUrl() {
  try {
    // 新方式：? から読む（優先）
    const search = location.search || '';
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

    // name / x は共通
    const nameEl = document.getElementById('user-name');
    const xEl = document.getElementById('user-x');
    const n = params.get('n');
    const x = params.get('x');
    if (nameEl && typeof n === 'string') nameEl.value = n;
    if (xEl && typeof x === 'string') xEl.value = x.replace(/^@/, '');

    // v3: r（レンジ）
    if (params.has('r')) {
      applyRanges(params.get('r') || '');
      stripStateParamsFromUrl(); // ★追加：一度復元したらURLの状態を消す
      return;
    }

    // v3: d（差分 base36）
    const d = params.get('d');
    if (d !== null) {
      const idxs = decodeDeltaBase36(d);
      const checked = new Set(idxs);
      document.querySelectorAll('.show-check').forEach(cb => {
        const dd = JSON.parse(cb.dataset.show);
        const id = makeTinyId(dd.show);
        const idx = __tinyIdToIndex.get(id);
        cb.checked = (idx !== undefined) && checked.has(idx);
      });
      updateExportButtonState();
      stripStateParamsFromUrl(); // ★追加
      return;
    }

    // v2互換: b（ビット列）
    const b = params.get('b');
    if (b) {
      applyBitsetB64(b);
      stripStateParamsFromUrl(); // ★追加
      return;
    }

    // ---- ここから旧方式互換（#s= / #s0=） ----
    const hash = location.hash || '';
    if (!hash) return;

    let m = hash.match(/(?:^|[#&])s=([^&]+)/);
    if (m) {
      if (typeof LZString === 'undefined') {
        console.warn('LZString が見つからないため、復元できません（#s=）。');
        return;
      }
      const json = LZString.decompressFromEncodedURIComponent(m[1]);
      if (!json) return;
      applyRestoredData(JSON.parse(json));
      return;
    }

    m = hash.match(/(?:^|[#&])s0=([^&]+)/);
    if (m) {
      const json = decodeURIComponent(m[1]);
      applyRestoredData(JSON.parse(json));
      return;
    }
  } catch (e) {
    console.warn('URL復元に失敗しました:', e);
  }
}

function applyRestoredData(data) {
    if (!data || data.v !== 1) return;

    const nameEl = document.getElementById('user-name');
    const xEl = document.getElementById('user-x');

    if (nameEl && typeof data.n === 'string') nameEl.value = data.n;

    // 入力欄は @なし運用なので取り除く
    if (xEl && typeof data.x === 'string') xEl.value = data.x.replace(/^@/, '');

    const checkedSet = new Set(Array.isArray(data.c) ? data.c : []);

    document.querySelectorAll('.show-check').forEach(cb => {
      const d = JSON.parse(cb.dataset.show);
      const id = makeShortShowId(d.live, d.show);
      cb.checked = checkedSet.has(id);
    });

    updateExportButtonState();
  }

  // ======================
  // ライブ一覧描画
  // ======================
  function renderList(liveData) {
    const container = document.getElementById('live-list');
    container.innerHTML = '';

    liveData.forEach(live => {
      const tour = document.createElement('section');
      tour.className = 'tour';
      tour.style.background = live.color || '#ddd';

      const header = document.createElement('button');
      header.className = 'liveHeader';
      header.type = 'button';
      header.setAttribute('aria-expanded', 'false');

      header.innerHTML = `
        <span class="chev" aria-hidden="true">
          <svg viewBox="0 0 20 20" class="chevIcon">
            <path d="M7.5 4.5L13 10l-5.5 5.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"/>
          </svg>
        </span>
        <input type="checkbox" class="pgCheck tour-check">
        <span class="liveTitle">${live.liveName}</span>
      `;

      tour.appendChild(header);

      const content = document.createElement('div');
      content.className = 'tour-content';
      content.hidden = true;

      live.years.forEach(y => {
        const yearBlock = document.createElement('div');

        const yearTitle = document.createElement('div');
        yearTitle.className = 'year-title';
        yearTitle.textContent = y.year;
        yearBlock.appendChild(yearTitle);

        y.shows.forEach(s => {
          const label = document.createElement('label');
          label.className = 'show-item';

          const input = document.createElement('input');
          input.type = 'checkbox';
          input.className = 'show-check';
          input.dataset.show = JSON.stringify({
            live: live.liveName,
            year: y.year,
            show: s
          });
          input.addEventListener('change', updateExportButtonState);

          const timeText = s.time ? `（${s.time === 'AM' ? '昼' : '夜'}）` : '';
          const text = document.createElement('span');
          text.textContent = `${s.date.replace(/-/g, '/')} ${timeText} ${s.prefecture} ${s.venue}`;

          label.appendChild(input);
          label.appendChild(text);
          yearBlock.appendChild(label);
        });

        content.appendChild(yearBlock);
      });

      tour.appendChild(content);

      header.addEventListener('click', e => {
        if (e.target.closest('.pgCheck')) return;
        const expanded = header.getAttribute('aria-expanded') === 'true';
        header.setAttribute('aria-expanded', String(!expanded));
        content.hidden = expanded;
      });

      header.querySelector('.tour-check').addEventListener('change', e => {
        const checked = e.target.checked;
        content.querySelectorAll('.show-check').forEach(cb => cb.checked = checked);
        if (checked) {
          header.setAttribute('aria-expanded', 'true');
          content.hidden = false;
        }
        updateExportButtonState();
      });

      container.appendChild(tour);
    });
  }

  // ======================
  // ボタン活性制御
  // ======================
  

  // ======================
  // ★ 自動保存（localStorage）
  //   - 名前 / X：debounce（入力が止まってから保存）
  //   - チェック：変更時に即保存
  //   - 30日経過したら自動削除
  // ======================
  const DRAFT_KEY = 'pgll_draft_v1';
  const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30日

  function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function chooseShortestPayload(idxs) {
    const r = indexesToRanges(idxs);
    const d = encodeDeltaBase36(idxs);
    const b = getCheckedBitsetB64();

    let mode = 'r';
    let payload = r;

    if (typeof d === 'string' && d.length > 0 && (payload === '' || d.length < payload.length)) {
      mode = 'd';
      payload = d;
    }
    if (typeof b === 'string' && b.length > 0 && (payload === '' || b.length < payload.length)) {
      mode = 'b';
      payload = b;
    }
    return { mode, payload };
  }

  function saveDraftNow() {
    try {
      const name = document.getElementById('user-name')?.value?.trim() || '';
      let x = document.getElementById('user-x')?.value?.trim() || '';
      if (x && !x.startsWith('@')) x = '@' + x;

      // tinyIndexが未構築ならチェックは保存しない（一覧描画前の事故防止）
      let mode = '';
      let payload = '';

      if (__tinyIdList && __tinyIdList.length > 0) {
        const idxs = getCheckedIndexes();
        const chosen = chooseShortestPayload(idxs);
        mode = chosen.mode;
        payload = chosen.payload;
      }

      const data = { t: Date.now(), n: name, x, m: mode, p: payload };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch (e) {
      // 何もしない（保存できなくても動作は継続）
    }
  }

  const saveDraftDebounced = debounce(saveDraftNow, 300);

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data || !data.t) return;

      // 30日超えは削除
      if (Date.now() - data.t > DRAFT_TTL_MS) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }

      // URLが指定している内容は優先（ドラフトで上書きしない）
      const search = location.search || '';
      const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
      const urlHasChecks = params.has('r') || params.has('d') || params.has('b') || (location.hash || '').length > 1;
      const urlHasName = params.has('n');
      const urlHasX = params.has('x');

      const nameEl = document.getElementById('user-name');
      const xEl = document.getElementById('user-x');

      if (!urlHasName && nameEl && typeof data.n === 'string') nameEl.value = data.n;
      if (!urlHasX && xEl && typeof data.x === 'string') xEl.value = data.x.replace(/^@/, '');

      if (!urlHasChecks && data.m && typeof data.p === 'string' && __tinyIdList && __tinyIdList.length > 0) {
        if (data.m === 'r') applyRanges(data.p || '');
        else if (data.m === 'd') {
          const idxs = decodeDeltaBase36(data.p || '');
          const checked = new Set(idxs);
          document.querySelectorAll('.show-check').forEach(cb => {
            const dd = JSON.parse(cb.dataset.show);
            const id = makeTinyId(dd.show);
            const idx = __tinyIdToIndex.get(id);
            cb.checked = (idx !== undefined) && checked.has(idx);
          });
          updateExportButtonState();
        } else if (data.m === 'b') {
          applyBitsetB64(data.p || '');
        }
      }
    } catch (e) {
      // 何もしない（復元失敗しても動作は継続）
    }
  }

function updateExportButtonState() {
    const hasCheckedShow = document.querySelectorAll('.show-check:checked').length > 0;
    const bgSelected = document.getElementById('bg-select')?.value;
    document.getElementById('export-btn').disabled = !(hasCheckedShow && bgSelected);
  }

  document.getElementById('bg-select')
    .addEventListener('change', updateExportButtonState);

  // ======================
  // 画像出力（分割対応）
  // ======================
  function openPreviewTab(imageUrls, title, w) {
    const win = w || window.open('', '_blank');
    try { win && win.focus && win.focus(); } catch (_) {}
    if (!win) {
      alert('ポップアップがブロックされました。ブラウザ設定で許可してください。');
      return;
    }

    const safeTitle = title || 'PG LIVE LOG export preview';
    const safeUrls = imageUrls.map(u => String(u));

    win.document.open();
    win.document.write(`
<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    body { margin: 0; padding: 16px; font-family: -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif; background: #f2f4f8; }
    .wrap { max-width: 420px; margin: 0 auto; }
    .hint { font-size: 13px; color: rgba(0,0,0,0.65); margin: 0 0 12px; }
    .imgbox { background: #fff; border-radius: 14px; padding: 10px; box-shadow: 0 6px 18px rgba(0,0,0,0.10); margin-bottom: 14px; }
    img { width: 100%; height: auto; display: block; border-radius: 10px; }
  </style>
</head>
<body>
  <div class="wrap">
    <p class="hint">画像を長押し/右クリックで保存できます（端末/ブラウザによって表記が違います）。</p>
    ${safeUrls.map((u, i) => `
      <div class="imgbox">
        <img src="${u}" alt="export ${i + 1}">
      </div>
    `).join('')}
  </div>

  <script>
    window.addEventListener('beforeunload', () => {
      const urls = ${JSON.stringify(safeUrls)};
      urls.forEach(u => { try { URL.revokeObjectURL(u); } catch(e){} });
    });
  </script>
</body>
</html>
    `);
    win.document.close();
  }

  function getCheckedShowsInOrder() {
    const checked = Array.from(document.querySelectorAll('.show-check:checked'));
  
    // 今日（00:00基準）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
  
    return checked.map(cb => {
      const data = JSON.parse(cb.dataset.show);
      const s = data.show;
  
      const time =
        s.time === 'AM' ? '昼' :
        s.time === 'PM' ? '夜' : '';
  
      // 公演日（00:00基準）
      const showDate = new Date(s.date);
      showDate.setHours(0, 0, 0, 0);
  
      const isFuture = showDate > today;
  
      return {
        live: data.live,
        date: s.date,
        lineText: `${s.date.replace(/-/g, '/')} ${time} ${s.prefecture} ${s.venue}${isFuture ? '（予定）' : ''}`
          .replace(/\s+/g, ' ')
          .trim()
      };
    });
  }

  function buildBlocks(items) {
    const blocks = [];
    let current = null;

    for (const it of items) {
      if (!current || current.live !== it.live) {
        current = { live: it.live, lines: [] };
        blocks.push(current);
      }
      current.lines.push(it.lineText);
    }
    return blocks;
  }

  function createExportWrapper({ bg, colorName, totalCount, pageIndex, pageCount, shareUrl }) {
    const WIDTH = 390;
    const HEIGHT = 844;

    const wrapper = document.createElement('div');
    wrapper.style.width = WIDTH + 'px';
    wrapper.style.height = HEIGHT + 'px';
    wrapper.style.position = 'relative';
    wrapper.style.background = bg;
    wrapper.style.fontFamily = 'Helvetica, Arial, sans-serif';

    // ===== 上部：左（名前1行 + X2行目小さめ）／右（バッジ固定） =====
    let userName = document.getElementById('user-name').value.trim();
    let userX = document.getElementById('user-x').value.trim();
    if (userX && !userX.startsWith('@')) userX = '@' + userX;

    const topRow = document.createElement('div');
    topRow.style.position = 'absolute';
    topRow.style.top = '14px';
    topRow.style.left = '20px';
    topRow.style.right = '20px';
    topRow.style.display = 'flex';
    topRow.style.alignItems = 'flex-start';
    topRow.style.gap = '10px';

    const topLeft = document.createElement('div');
    topLeft.style.flex = '1 1 auto';
    topLeft.style.minWidth = '0';
    topLeft.style.display = 'flex';
    topLeft.style.flexDirection = 'column';
    topLeft.style.gap = '0px'; // ← @をもうちょい上に寄せる
    topLeft.style.color = '#111';
    topLeft.style.textShadow = '0 0 6px rgba(255,255,255,0.85),0 1px 2px rgba(255,255,255,0.85)';

    if (userName) {
      const nameEl = document.createElement('div');
      nameEl.textContent = userName;
      nameEl.style.fontSize = '15px';
      nameEl.style.fontWeight = '600';
      nameEl.style.lineHeight = '1.18';  // ←詰める
      nameEl.style.whiteSpace = 'nowrap';
      nameEl.style.overflow = 'hidden';
      nameEl.style.textOverflow = 'clip';
      topLeft.appendChild(nameEl);
    }

    if (userX) {
      const xEl = document.createElement('div');
      xEl.textContent = userX;
      xEl.style.fontSize = '13px';
      xEl.style.fontWeight = '500';
      xEl.style.lineHeight = '1.4';
      xEl.style.opacity = '0.85';
      xEl.style.whiteSpace = 'nowrap';
      xEl.style.overflow = 'hidden';
      xEl.style.textOverflow = 'clip';
      topLeft.appendChild(xEl);
    }

    const badge = document.createElement('div');
    badge.textContent = `✔ ${totalCount}公演${pageCount > 1 ? `  (${pageIndex}/${pageCount})` : ''}`;
    badge.style.flex = '0 0 auto';
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';
    badge.style.justifyContent = 'center';
    badge.style.fontSize = '12px';
    badge.style.fontWeight = '700';
    badge.style.lineHeight = '1';
    badge.style.padding = '6px 10px';
    badge.style.borderRadius = '999px';
    badge.style.background = 'rgba(255,255,255,0.75)';
    badge.style.color = '#111';
    badge.style.textShadow = '0 0 6px rgba(255,255,255,0.85)';
    badge.style.marginTop = '0';
    badge.style.alignSelf = 'flex-start';
    topRow.style.alignItems = 'center';
    topLeft.style.paddingTop = '1px';

    if (userName || userX) {
      topRow.appendChild(topLeft);
    } else {
      const spacer = document.createElement('div');
      spacer.style.flex = '1 1 auto';
      topRow.appendChild(spacer);
    }
    topRow.appendChild(badge);
    wrapper.appendChild(topRow);

    const card = document.createElement('div');
    card.style.position = 'absolute';
    // ★下が切れる対策：下余白を少し増やしてカードを上に広げる
    card.style.inset = '54px 20px 80px';
    card.style.background = 'rgba(255,255,255,0.8)';
    card.style.borderRadius = '18px';
    card.style.padding = '16px 18px';
    card.style.overflow = 'hidden';
    wrapper.appendChild(card);

    const content = document.createElement('div');
    content.style.position = 'relative';
    content.style.width = '100%';
    content.style.height = '100%';
    content.style.overflow = 'hidden';
    card.appendChild(content);

    // ===== 下部：左にQR、右にテキスト（被らない） =====
    const bottom = document.createElement('div');
    bottom.style.position = 'absolute';
    bottom.style.left = '8px';
    bottom.style.right = '16px';
    bottom.style.bottom = '14px';
    bottom.style.display = 'flex';
    bottom.style.justifyContent = 'space-between';
    bottom.style.alignItems = 'flex-end';
    bottom.style.gap = '12px';
    
    // 左：QR（左下固定）
    const leftBox = document.createElement('div');
    leftBox.style.flex = '0 0 auto';
    if (shareUrl && typeof QRCode !== 'undefined') {
      leftBox.appendChild(createQrElement(shareUrl));
    }
    bottom.appendChild(leftBox);
    
    // 右：image color + サイトURL（今まで通り）
    const rightBox = document.createElement('div');
    rightBox.style.flex = '1 1 auto';
    rightBox.style.textAlign = 'right';
    rightBox.style.fontSize = '11px';
    rightBox.style.lineHeight = '1.45';
    rightBox.style.color = '#111';
    rightBox.style.opacity = '0.6';
    rightBox.style.textShadow = '0 0 6px rgba(255,255,255,0.85),0 1px 2px rgba(255,255,255,0.85)';
    
    // ★ここはあなたの元の表示を維持
    rightBox.innerHTML = `
      <div>image color：♪${colorName}</div>
      <div>https://pg-lou.github.io/pg-live-log/</div>
    `;
    bottom.appendChild(rightBox);
    
    wrapper.appendChild(bottom);

    return { wrapper, card, content, WIDTH, HEIGHT };
  }

  // ★修正：<s>...</s> を span.strike にしてHTMLとして描画（生HTMLは使わない）
  function makeHeaderEl(titleText) {
    const h = document.createElement('div');

    const escaped = titleText
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');

    h.innerHTML = escaped.replace(
      /&lt;s&gt;([\s\S]*?)&lt;\/s&gt;/g,
      '<span class="strike">$1</span>'
    );

    h.style.fontWeight = '800';
    h.style.fontSize = '16px';
    h.style.lineHeight = '1.25';
    h.style.marginTop = '10px';
    h.style.marginBottom = '6px';
    h.style.wordBreak = 'break-word';
    return h;
  }

  function makeLineEl(text) {
    const line = document.createElement('div');
    line.textContent = text;
    line.style.fontSize = '14px';
    line.style.lineHeight = '1.38';
    line.style.paddingLeft = '8px';
    line.style.wordBreak = 'break-word';
    return line;
  }

  function fits(container, testEl, maxHeightPx) {
    container.appendChild(testEl);
    const ok = container.scrollHeight <= maxHeightPx + 0.5;
    container.removeChild(testEl);
    return ok;
  }

  async function exportImage() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items = getCheckedShowsInOrder();
    if (!items.length) return;

    // ★ポップアップブロック対策：クリック直後に先にタブを開く
    const previewWin = window.open('', '_blank');
    try { previewWin && previewWin.focus && previewWin.focus(); } catch (_) {}
    if (!previewWin) {
      alert('ポップアップがブロックされました。ブラウザ設定で許可してください。');
      return;
    }

    const bgSelect = document.getElementById('bg-select');
    const bg = bgSelect.value;
    const selectedOption = bgSelect.options[bgSelect.selectedIndex];
    const colorName = selectedOption.dataset.label || selectedOption.text;

    const blocks = buildBlocks(items);
    const totalCount = items.length;

    const exportArea = document.getElementById('export-area');
    exportArea.innerHTML = '';

    // ★ここで復元用URLを生成（チェック＋名前＋Xを含む）
    const shareUrl = makeShareUrl();

    const tmp = createExportWrapper({ bg, colorName, totalCount, pageIndex: 1, pageCount: 1, shareUrl });
    exportArea.appendChild(tmp.wrapper);

    let maxHeight = tmp.content.clientHeight;
    if (!maxHeight || maxHeight < 50) {
      // HEIGHT 844 / card inset 52,44 / padding 16*2 → おおよそ 716
      maxHeight = 716;
    }

    exportArea.innerHTML = '';

    const pages = [];
    let page = null;

    const newPage = () => {
      const p = createExportWrapper({ bg, colorName, totalCount, pageIndex: 1, pageCount: 1, shareUrl });
      exportArea.appendChild(p.wrapper);
      pages.push(p);
      return p;
    };

    page = newPage();

    let blockIndex = 0;
    let suppressedCount = 0;
    let suppressedStarted = false;

    for (const block of blocks) {
      blockIndex++;

      let lineIdx = 0;
      let isContinuation = false;

      while (lineIdx < block.lines.length) {
        if (suppressedStarted) break;

        const headerText = '■ ' + block.live + (isContinuation ? '（続き）' : '');

        const headerEl = makeHeaderEl(headerText);
        const firstLineEl = makeLineEl(block.lines[lineIdx]);

        if (page.content.childElementCount === 0) {
          headerEl.style.marginTop = '0px';
        }

        const testWrap = document.createElement('div');
        testWrap.appendChild(headerEl.cloneNode(true));
        testWrap.appendChild(firstLineEl.cloneNode(true));

        const canPutHeaderAndOne =
          fits(page.content, testWrap, maxHeight) || page.content.childElementCount === 0;

        if (!canPutHeaderAndOne) {
          if (pages.length >= 4) {
            suppressedStarted = true;
            suppressedCount += (block.lines.length - lineIdx);
            for (let b = blockIndex; b < blocks.length; b++) {
              suppressedCount += blocks[b].lines.length;
            }
            break;
          }

          page = newPage();
          continue;
        }

        const realHeader = makeHeaderEl(headerText);
        if (page.content.childElementCount === 0) {
          realHeader.style.marginTop = '0px';
        }
        page.content.appendChild(realHeader);

        while (lineIdx < block.lines.length) {
          const lineEl = makeLineEl(block.lines[lineIdx]);

          if (fits(page.content, lineEl, maxHeight)) {
            page.content.appendChild(lineEl);
            lineIdx++;
          } else {
            break;
          }
        }

        if (lineIdx < block.lines.length) {
          isContinuation = true;

          if (pages.length >= 4) {
            suppressedStarted = true;
            suppressedCount += (block.lines.length - lineIdx);
            for (let b = blockIndex; b < blocks.length; b++) {
              suppressedCount += blocks[b].lines.length;
            }
            break;
          }

          page = newPage();
        }
      }

      if (suppressedStarted) break;
    }

    if (suppressedCount > 0 && pages.length > 0) {
      const last = pages[Math.min(3, pages.length - 1)];
      const note = document.createElement('div');
      note.textContent = `他${suppressedCount}公演参戦済み`;
      note.style.marginTop = '10px';
      note.style.fontSize = '13px';
      note.style.fontWeight = '700';
      note.style.opacity = '0.85';
      last.content.appendChild(note);
    }

    const pageCount = pages.length;
    pages.forEach((p, i) => {
      const badge = p.wrapper.querySelector('div[style*="border-radius: 999px"]');
      if (badge) {
        badge.textContent = `✔ ${totalCount}公演${pageCount > 1 ? `  (${i + 1}/${pageCount})` : ''}`;
      }
    });

    const urls = [];

    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const canvas = await html2canvas(p.wrapper, { scale: 2 });

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) continue;

      const url = URL.createObjectURL(blob);
      urls.push(url);
    }

    exportArea.innerHTML = '';

    if (urls.length) {
      openPreviewTab(urls, `pg-live-log_${pages.length}pages`, previewWin);
    } else {
      // 生成できなかった場合は開いたタブを閉じる
      try { previewWin.close(); } catch (_) {}
    }
  }

  document.getElementById('export-btn')
    .addEventListener('click', exportImage);

  // ======================
  // ★入力欄の文字数制限（固定）
  // 名前：全角想定で12文字
  // X：半角想定で15文字（@不要入力）
  // ======================
  const nameInput = document.getElementById('user-name');
  const xInput = document.getElementById('user-x');
  if (nameInput) nameInput.maxLength = 12;
  if (xInput) xInput.maxLength = 15;

  // ======================
  // ★ 自動保存：イベント設定
  //   - 名前 / X：debounce保存
  //   - チェック：変更時に即保存
  // ======================
  if (nameInput) nameInput.addEventListener('input', saveDraftDebounced);
  if (xInput) xInput.addEventListener('input', saveDraftDebounced);

  // show-check / tour-check の変更で即保存（ツアー一括チェックも拾う）
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t || !t.classList) return;

    if (t.classList.contains('show-check')) {
      saveDraftNow();
    } else if (t.classList.contains('tour-check')) {
      // まとめて子要素を変更した直後に保存したいので1tick遅らせる
      setTimeout(saveDraftNow, 0);
    }
  });


  // ★描画後にURL復元（DOMができてからじゃないとチェック付けられない）
  loadLiveData()
    .then(liveData => {
      renderList(liveData);
      buildTinyIndex(liveData);
      restoreFromUrl();
      restoreDraft();
      updateExportButtonState();
    });

  // ======================
  // はじめにモーダル
  // ======================
  const aboutOpenBtn = document.getElementById('about-open');
  const aboutModal = document.getElementById('about-modal');

  function openAbout() {
    if (!aboutModal) return;
    aboutModal.hidden = false;
    document.body.style.overflow = 'hidden';

    const panel = aboutModal.querySelector('.modal-panel');
    panel && panel.focus();
  }

  function closeAbout() {
    if (!aboutModal) return;
    aboutModal.hidden = true;
    document.body.style.overflow = '';
    aboutOpenBtn && aboutOpenBtn.focus();
  }

  aboutOpenBtn && aboutOpenBtn.addEventListener('click', openAbout);

  aboutModal && aboutModal.addEventListener('click', (e) => {
    const closeTarget = e.target.closest('[data-close="about"]');
    if (closeTarget) closeAbout();
  });

  document.addEventListener('keydown', (e) => {
    if (!aboutModal || aboutModal.hidden) return;
    if (e.key === 'Escape') closeAbout();
  });

});



