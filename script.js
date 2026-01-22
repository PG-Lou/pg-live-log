// =====================
// 初期URL判定フラグ
// =====================
const INITIAL_URL_HAS_CHECKS = (() => {
  try {
    const params = new URLSearchParams(location.search.startsWith('?')
      ? location.search.slice(1)
      : location.search
    );
    return params.has('r') || params.has('d') || params.has('b')
      || ((location.hash || '').length > 1);
  } catch {
    return false;
  }
})();



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

    const queryUrl = `${base}?${params.toString()}`;

    // Android等の一部環境で「長いURLが途中で切れる」ケース対策：
    // 一定以上長いときは、#s=（lz-string圧縮）にフォールバックする。
    // ※index.html で lz-string を読み込んでいる前提（なければ #s0=）。
    const URL_LEN_LIMIT = 1200;
    if (queryUrl.length > URL_LEN_LIMIT) {
      const payloadObj = { v: 1, n: userName, x: userX, c: getCheckedShowIds() };
      const json = JSON.stringify(payloadObj);

      if (typeof LZString !== 'undefined') {
        const compressed = LZString.compressToEncodedURIComponent(json);
        return `${base}#s=${compressed}`;
      } else {
        const encoded = encodeURIComponent(json);
        return `${base}#s0=${encoded}`;
      }
    }

    return queryUrl;
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
      // stripで消されるので「初回URLにあったか」を使う
      const urlHasChecks = INITIAL_URL_HAS_CHECKS;
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
  // ★イメージカラー追加（末尾に順番どおり追加 / もやもや系）
  //   - 既存の同名は上書きしない（例：ブレス）
  // ======================
  // ======================
  // 画像出力（分割対応）
  // ======================
  // ======================
  // プレビュー（別ウィンドウ）
  //  - 画像プレビュー
  //  - 対応端末では「まとめて保存（共有シート）」ボタンを表示
  // ======================
  function openPreviewTab(imageUrls, fileNames, title, w, shareFiles) {
    const win = w || window.open('', '_blank');
    try { win && win.focus && win.focus(); } catch (_) {}
    if (!win) {
      alert('ポップアップがブロックされました。ブラウザ設定で許可してください。');
      return;
    }

    // 共有用に File 配列を直接渡す（押下時にfetchせずに share() できる＝無反応対策）
    try { if (Array.isArray(shareFiles)) win.__PGLL_SHARE_FILES = shareFiles; } catch (_) {}

    const safeTitle = title || 'PG LIVE LOG export preview';
    const safeUrls = imageUrls.map(u => String(u));
    const safeNames = Array.isArray(fileNames) && fileNames.length
      ? fileNames.map(n => String(n))
      : safeUrls.map((_, i) => `pg-live-log_${String(i + 1).padStart(2, '0')}.png`);

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
    .wrap { max-width: 420px; margin: 0 auto; position: relative; }
    .hint { font-size: 13px; color: rgba(0,0,0,0.65); margin: 0 0 12px; }
    .shareBtn {
      position: fixed;
      top: 10px;
      right: 10px;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: 1px solid rgba(0,0,0,0.14);
      background: rgba(255,255,255,0.78);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: rgba(0,0,0,0.85);
      box-shadow: 0 6px 18px rgba(0,0,0,0.10);
    }
    .shareBtn:active { transform: scale(0.98); }
    .shareBtn[disabled] { opacity: 0.45; cursor: default; transform: none; }
    .shareBtn svg { width: 20px; height: 20px; opacity: 0.78; display: block;}
    .shareBtn img { width: 20px; height: 20px; opacity: 0.78; display: block; }
    .msg { font-size: 13px; color: #c62828; font-weight: 650; margin: 8px 0 12px; }
    .imgbox { background: #fff; border-radius: 14px; padding: 10px; box-shadow: 0 6px 18px rgba(0,0,0,0.10); margin-bottom: 14px; }
    img { width: 100%; height: auto; display: block; border-radius: 10px; }
  </style>
</head>
<body>
  <div class="wrap">
    <p class="hint">画像を長押し/右クリックで保存できます（端末/ブラウザによって表記が違います）。</p>
    <button id="shareBtn" class="shareBtn" type="button" aria-label="共有" title="共有">
      <img src="images/share.png?v=1769051702" alt="共有" width="20" height="20" style="display:block; opacity:0.78;">
    </button>
    <div id="shareMsg" class="msg" style="display:none"></div>
    ${safeUrls.map((u, i) => `
      <div class="imgbox">
        <img src="${u}" alt="export ${i + 1}">
      </div>
    `).join('')}
  </div>

  <script>
    const urls = ${JSON.stringify(safeUrls)};
    const names = ${JSON.stringify(safeNames)};

    function getEls() {
      return {
        btn: document.getElementById('shareBtn'),
        msg: document.getElementById('shareMsg'),
      };
    }

    function showFailMessage(text) {
      const { msg } = getEls();
      if (!msg) return;
      msg.style.display = 'block';
      msg.textContent = text || 'この端末/ブラウザでは共有が使えません。下の画像を長押しして保存してください。';
    }

    function clearMessage() {
      const { msg } = getEls();
      if (!msg) return;
      msg.style.display = 'none';
      msg.textContent = '';
    }

    async function shareAll() {
      const { btn } = getEls();
      if (!btn) return;

      // UI: 連打防止
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      clearMessage();

      try {
        if (!navigator.share) {
          showFailMessage('この端末/ブラウザでは共有が使えません。下の画像を長押しして保存してください。');
          return;
        }

        // opener から渡された File 配列を使う（押下後にfetchしない＝ユーザー操作扱いを切らさない）
        const files = (window.__PGLL_SHARE_FILES && Array.isArray(window.__PGLL_SHARE_FILES)) ? window.__PGLL_SHARE_FILES : null;
        if (!files || files.length === 0) {
          showFailMessage('共有する画像の準備に失敗しました。下の画像を長押しして保存してください。');
          return;
        }

        // canShare は端末依存で厳しすぎることがあるので使わない（誤爆防止）
        await navigator.share({
          files,
          title: 'PG LIVE LOG',
          text: '参戦履歴画像'
        });

        // 共有が開けた/完了した場合は何も出さない（キャンセルもここで扱う）
      } catch (e) {
        // ユーザーキャンセルはエラー表示しない
        const name = (e && e.name) ? String(e.name) : '';
        if (name === 'AbortError') return;

        showFailMessage('共有できませんでした。下の画像を長押しして保存してください。');
      } finally {
        const { btn } = getEls();
        if (btn) {
          btn.disabled = false;
          btn.removeAttribute('aria-busy');
        }
      }
    }

    (function initShareUI(){
      const { btn, msg } = getEls();
      if (!btn) return;

      // ボタンはスマホ/PC問わず表示（押してダメなら文言で案内）
      btn.style.display = 'block';

      // 失敗時だけ表示したいので最初は消す
      if (msg) {
        msg.style.display = 'none';
        msg.textContent = '';
      }

      // クリック/タップの取りこぼし対策
      const fire = (e) => {
        try { e && e.preventDefault && e.preventDefault(); } catch (_) {}
        shareAll().catch(() => {
          showFailMessage('この端末/ブラウザでは共有が使えません。下の画像を長押しして保存してください。');
        });
      };

      btn.addEventListener('click', fire, { passive: false });
    })();

    window.addEventListener('beforeunload', () => {
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



// ===== 背景（テーマごとに上書き） =====
function resolveBackground(bgValue, name) {
  // はみだし御免：炎ベース＋赤み追加
  if (bgValue === 'HMD_GOMEN') {
    return "radial-gradient(circle at 25% 25%, rgba(255, 120, 60, 0.95) 0%, transparent 55%)," +
           "radial-gradient(circle at 70% 30%, rgba(255, 80, 60, 0.85) 0%, transparent 60%)," +
           "radial-gradient(circle at 45% 80%, rgba(255, 200, 120, 0.75) 0%, transparent 70%)," +
           "#ff6a3a";
  }

  // Zombies：右上→左下に オレンジ→水色 のグラデーション
  //   ※radial だと「塊」に見えやすいので linear を主役にして “面” を作る
  if (bgValue === 'ZOMBIES') {
    return "linear-gradient(to bottom left," +
           " rgba(255, 170, 90, 0.98) 0%," +
           " rgba(255, 205, 150, 0.88) 32%," +
           " rgba(170, 225, 255, 0.88) 68%," +
           " rgba(110, 190, 235, 0.98) 100%)," +
           "radial-gradient(circle at 78% 22%, rgba(255, 170, 90, 0.55) 0%, transparent 55%)," +
           "radial-gradient(circle at 22% 78%, rgba(120, 200, 240, 0.55) 0%, transparent 60%)";
  }

  // ラック：黒すぎるので “チャコール寄りのグレー” を混ぜる
  if (bgValue === 'RACK') {
    return "radial-gradient(circle at 30% 28%, rgba(235, 235, 235, 0.55) 0%, transparent 58%)," +
           "radial-gradient(circle at 72% 40%, rgba(170, 170, 170, 0.55) 0%, transparent 62%)," +
           "radial-gradient(circle at 50% 86%, rgba(120, 120, 120, 0.45) 0%, transparent 72%)," +
           "#2f2f2f";
  }

  // Rainbow：流行り寄り・ほんのりくすみ（くすませすぎない）
  if (bgValue === 'RAINBOW') {
    return "linear-gradient(135deg," +
           " #f3b3ad 0%," +   // muted coral
           " #f6d8a8 18%," +  // muted yellow
           " #cfe7b8 36%," +  // muted green
           " #c7e7df 54%," +  // muted mint
           " #c9dff2 72%," +  // muted sky
           " #d7cff2 90%)," + // muted lavender
           "radial-gradient(circle at 22% 28%, rgba(255,255,255,0.10) 0%, transparent 60%)," +
           "radial-gradient(circle at 78% 82%, rgba(255,255,255,0.08) 0%, transparent 65%)";
  }


  return bgValue;
}


  function createExportWrapper({ bg, colorName, totalCount, pageIndex, pageCount, shareUrl, height }) {
    const WIDTH = 390;
    const HEIGHT = Number.isFinite(height) ? Math.max(300, Math.floor(height)) : 844;

    const wrapper = document.createElement('div');
    wrapper.style.width = WIDTH + 'px';
    wrapper.style.height = HEIGHT + 'px';
    wrapper.style.position = 'relative';
    wrapper.style.background = bg;
    wrapper.style.fontFamily = 'Helvetica, Arial, sans-serif';

    // ===== 枠外テキスト（名前/X/右下表記）の見やすさ調整 =====
    const theme = (() => {
      const n = String(colorName || '');
      // Zombies は背景が明るめなので、枠外テキストは黒固定にしたい
      const forceOuterTextBlack = /Zombies/i.test(n);

      // 暗背景として扱うのは「ラック」「はみだし御免」だけ（Zombies は除外）
      const dark = /ラック|はみだし御免/i.test(n);

      return { dark, forceOuterTextBlack };
    })();

    const isDarkTheme = theme.dark;
    const forceOuterTextBlack = theme.forceOuterTextBlack;

    function applyOuterTextStyle(el, dark) {
      if (!el) return;
      // 背景にカードは敷かない。文字色と縁取り（shadow/stroke）だけで可読性を上げる。
      el.style.opacity = '1';
      el.style.fontWeight = el.style.fontWeight || '600';

      // Zombies は枠外テキストを黒固定
      if (forceOuterTextBlack) {
        el.style.color = '#000000';
        el.style.textShadow = 'none';
        el.style.webkitTextStroke = '0px transparent';
        return;
      }

      if (dark) {
        // 暗背景：白文字（黒いもやもやは入れない）
        el.style.color = '#ffffff';
        el.style.textShadow = 'none'; el.style.webkitTextStroke = '0px transparent';
      } else {
        // 明背景：黒文字（縁取りは控えめ。白く見えすぎるのを防ぐ）
        el.style.color = '#111111';
        el.style.textShadow = 'none'; el.style.webkitTextStroke = '0px transparent';
      }
    }


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
    applyOuterTextStyle(topLeft, isDarkTheme);

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
      xEl.style.opacity = '1';
      xEl.style.whiteSpace = 'nowrap';
      xEl.style.overflow = 'hidden';
      xEl.style.textOverflow = 'clip';
      topLeft.appendChild(xEl);
    }

    const badge = document.createElement('div');
    badge.style.color = '#111111';
    badge.style.opacity = '1';
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
    badge.style.opacity = '1';
    badge.style.textShadow = 'none';
    badge.style.webkitTextStroke = '0px transparent';
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
    applyOuterTextStyle(rightBox, isDarkTheme);
    
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
    // scrollHeight は最小でも clientHeight になってしまい、
    // 「予約領域のため maxHeight を小さくする」方式だと常に false になることがある。
    // なので、追加した要素の「下端位置」で判定する。
    container.appendChild(testEl);

    const cRect = container.getBoundingClientRect();
    const tRect = testEl.getBoundingClientRect();
    const bottom = tRect.bottom - cRect.top;

    const ok = bottom <= maxHeightPx + 0.5;

    container.removeChild(testEl);
    return ok;
  }




  // ======================
  // ★出力方式選択モーダル（4枚に収まらない時だけ表示）
  //   - OKはラジオ選択までdisabled
  //   - OK: 'normal' or 'long'
  //   - Cancel/Esc/背景クリック: null
  // ======================
  function askExportModeIfNeeded() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.background = 'rgba(0,0,0,0.45)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.padding = '16px';
      overlay.style.zIndex = '9999';

      const panel = document.createElement('div');
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.style.width = 'min(420px, 100%)';
      panel.style.background = '#fff';
      panel.style.borderRadius = '14px';
      panel.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
      panel.style.padding = '14px 14px 12px';
      panel.style.fontFamily = '-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif';

      const title = document.createElement('div');
      title.textContent = '出力数が多いため、以下どちらか選択してください';
      title.style.fontSize = '14px';
      title.style.fontWeight = '700';
      title.style.marginBottom = '12px';
      panel.appendChild(title);

      const form = document.createElement('div');
      form.style.display = 'grid';
      form.style.gap = '10px';
      form.style.marginBottom = '14px';

      const mkRadio = (value, labelText) => {
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'flex-start';
        label.style.gap = '10px';
        label.style.cursor = 'pointer';

        const r = document.createElement('input');
        r.type = 'radio';
        r.name = 'pgll_export_mode';
        r.value = value;
        r.style.marginTop = '2px';

        const text = document.createElement('div');
        text.textContent = labelText;
        text.style.fontSize = '13px';
        text.style.lineHeight = '1.35';

        label.appendChild(r);
        label.appendChild(text);
        return { label, radio: r };
      };

      const a = mkRadio('normal', '通常サイズで4枚出力、入らない分は省略');
      const b = mkRadio('long', 'ロングサイズで全公演出力');
      form.appendChild(a.label);
      form.appendChild(b.label);
      panel.appendChild(form);

      const btnRow = document.createElement('div');
      btnRow.style.display = 'flex';
      btnRow.style.gap = '10px';
      btnRow.style.justifyContent = 'flex-end';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'キャンセル';
      cancelBtn.style.padding = '9px 12px';
      cancelBtn.style.borderRadius = '10px';
      cancelBtn.style.border = '1px solid rgba(0,0,0,0.2)';
      cancelBtn.style.background = '#fff';
      cancelBtn.style.fontSize = '13px';

      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.textContent = 'OK';
      okBtn.disabled = true; // ★ラジオ選択まで非活性
      okBtn.style.padding = '9px 14px';
      okBtn.style.borderRadius = '10px';
      okBtn.style.border = 'none';
      okBtn.style.background = '#111';
      okBtn.style.color = '#fff';
      okBtn.style.fontSize = '13px';
      okBtn.style.fontWeight = '700';
      okBtn.style.opacity = '0.55';

      const syncOk = () => {
        const chosen = overlay.querySelector('input[name="pgll_export_mode"]:checked');
        okBtn.disabled = !chosen;
        okBtn.style.opacity = okBtn.disabled ? '0.55' : '1';
      };
      a.radio.addEventListener('change', syncOk);
      b.radio.addEventListener('change', syncOk);

      const close = (val) => {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        document.body.style.overflow = '';
        resolve(val);
      };

      const onKey = (e) => {
        if (e.key === 'Escape') close(null);
      };

      overlay.addEventListener('click', (e) => {
        // 背景クリックでキャンセル
        if (e.target === overlay) close(null);
      });

      cancelBtn.addEventListener('click', () => close(null));
      okBtn.addEventListener('click', () => {
        const chosen = overlay.querySelector('input[name="pgll_export_mode"]:checked');
        close(chosen ? chosen.value : null);
      });

      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(okBtn);
      panel.appendChild(btnRow);

      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';

      document.addEventListener('keydown', onKey);

      // 初期フォーカス
      try { (a.radio).focus(); } catch (_) {}
    });
  }

  // ======================
  // ★省略表示（他X公演参戦済み）を「白カード内」に確実に出す
  //   - 4枚目（最後のページ）だけ、あらかじめ表示領域を予約して溢れないようにする
  //   - 省略が無い場合は表示しない（予約分だけ少し余白が増える）
  // ======================
  function addSuppressedNoteIntoContent(content, suppressedCount) {
    if (!content || !suppressedCount || suppressedCount <= 0) return;

    const note = document.createElement('div');
    note.textContent = `他${suppressedCount}公演参戦済み`;
    note.style.marginTop = '10px';
    note.style.fontSize = '13px';
    note.style.fontWeight = '700';
    note.style.lineHeight = '1.35';
    note.style.opacity = '0.85';
    note.style.color = '#111';
    note.style.wordBreak = 'break-word';

    content.appendChild(note);
  }

  // ======================
  // ★ページ分割（通常/ロング両対応）
  //   - maxPages: 通常は4、ロングはInfinity
  //   - height: wrapper高さ（通常844 / ロング1600など）
  //   - reserveLastPagePx: 最終ページ（通常4枚目）の下側に確保する予約領域（省略文言のため）
  // ======================
  function paginateBlocks({ exportArea, blocks, bg, colorName, totalCount, shareUrl, maxPages, height, reserveLastPagePx = 0 }) {
    exportArea.innerHTML = '';

    const pages = [];

    const newPage = () => {
      const p = createExportWrapper({ bg, colorName, totalCount, pageIndex: 1, pageCount: 1, shareUrl, height });
      exportArea.appendChild(p.wrapper);
      pages.push(p);
      return p;
    };

    let page = newPage();

    const getBaseMaxHeight = () => {
      const h = page.content?.clientHeight;
      if (h && h > 50) return h;
      return page.content?.getBoundingClientRect?.().height || 716;
    };

    let baseMaxHeight = getBaseMaxHeight();

    // 「最後のページ（通常4枚目）」だけ下側に予約領域を確保
    const getEffectiveMaxHeight = () => {
      const isLastAllowedPage = Number.isFinite(maxPages) && maxPages > 0 && pages.length >= maxPages;
      return isLastAllowedPage ? Math.max(0, baseMaxHeight - reserveLastPagePx) : baseMaxHeight;
    };

    let suppressedCount = 0;
    let suppressedStarted = false;

    for (let bi = 0; bi < blocks.length; bi++) {
      const block = blocks[bi];
      let lineIdx = 0;
      let isContinuation = false;

      while (lineIdx < block.lines.length) {
        if (suppressedStarted) break;

        const headerText = '■ ' + block.live + (isContinuation ? '（続き）' : '');

        const headerEl = makeHeaderEl(headerText);
        const firstLineEl = makeLineEl(block.lines[lineIdx]);

        if (page.content.childElementCount === 0) headerEl.style.marginTop = '0px';

        const testWrap = document.createElement('div');
        testWrap.appendChild(headerEl.cloneNode(true));
        testWrap.appendChild(firstLineEl.cloneNode(true));

        const effectiveMaxHeight = getEffectiveMaxHeight();
        const canPutHeaderAndOne =
          fits(page.content, testWrap, effectiveMaxHeight) || page.content.childElementCount === 0;

        if (!canPutHeaderAndOne) {
          // これ以上ページを増やせない → 省略開始
          if (Number.isFinite(maxPages) && pages.length >= maxPages) {
            suppressedStarted = true;
            suppressedCount += (block.lines.length - lineIdx);
            for (let bj = bi + 1; bj < blocks.length; bj++) suppressedCount += blocks[bj].lines.length;
            break;
          }

          // 次ページへ
          page = newPage();
          baseMaxHeight = getBaseMaxHeight();
          continue;
        }

        // ヘッダ確定
        const realHeader = makeHeaderEl(headerText);
        if (page.content.childElementCount === 0) realHeader.style.marginTop = '0px';
        page.content.appendChild(realHeader);

        // 行を詰める
        while (lineIdx < block.lines.length) {
          const lineEl = makeLineEl(block.lines[lineIdx]);
          const ok = fits(page.content, lineEl, getEffectiveMaxHeight());
          if (ok) {
            page.content.appendChild(lineEl);
            lineIdx++;
          } else {
            break;
          }
        }

        // まだ残っている → 続き扱いで次ページへ
        if (lineIdx < block.lines.length) {
          isContinuation = true;

          // これ以上ページを増やせない → 残りは省略
          if (Number.isFinite(maxPages) && pages.length >= maxPages) {
            suppressedStarted = true;
            suppressedCount += (block.lines.length - lineIdx);
            for (let bj = bi + 1; bj < blocks.length; bj++) suppressedCount += blocks[bj].lines.length;
            break;
          }

          page = newPage();
          baseMaxHeight = getBaseMaxHeight();
        }
      }

      if (suppressedStarted) break;
    }

    return { pages, suppressedCount };
  }

  async function exportImage() {
    const items = getCheckedShowsInOrder();
    if (!items.length) return;

    // ======================
    // 描画中表示（くるくる）
    // ======================
    const showBusy = (msg) => {
      let ov = document.getElementById('pgll-busy-overlay');
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'pgll-busy-overlay';
        ov.style.position = 'fixed';
        ov.style.inset = '0';
        ov.style.background = 'rgba(0,0,0,0.35)';
        ov.style.display = 'flex';
        ov.style.alignItems = 'center';
        ov.style.justifyContent = 'center';
        ov.style.zIndex = '10000';

        const panel = document.createElement('div');
        panel.style.background = '#fff';
        panel.style.borderRadius = '14px';
        panel.style.padding = '14px 16px';
        panel.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
        panel.style.display = 'flex';
        panel.style.alignItems = 'center';
        panel.style.gap = '12px';

        const spinner = document.createElement('div');
        spinner.style.width = '22px';
        spinner.style.height = '22px';
        spinner.style.border = '3px solid rgba(0,0,0,0.15)';
        spinner.style.borderTopColor = 'rgba(0,0,0,0.75)';
        spinner.style.borderRadius = '999px';
        spinner.style.animation = 'pgllSpin 0.9s linear infinite';

        const text = document.createElement('div');
        text.id = 'pgll-busy-text';
        text.style.fontSize = '13px';
        text.style.fontWeight = '700';
        text.style.color = '#111';
        text.textContent = msg || '画像を生成中…';

        const style = document.createElement('style');
        style.textContent = '@keyframes pgllSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}';

        panel.appendChild(spinner);
        panel.appendChild(text);
        ov.appendChild(panel);
        ov.appendChild(style);
        document.body.appendChild(ov);
      }
      const t = document.getElementById('pgll-busy-text');
      if (t) t.textContent = msg || '画像を生成中…';
      ov.hidden = false;
      document.body.style.overflow = 'hidden';
    };

    const hideBusy = () => {
      const ov = document.getElementById('pgll-busy-overlay');
      if (ov) ov.hidden = true;
      document.body.style.overflow = '';
    };

    const writePreviewLoading = (win) => {
      if (!win) return;
      try {
        win.document.open();
        win.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>PG LIVE LOG</title><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;background:#f2f4f8;} .wrap{max-width:420px;margin:0 auto;padding:16px;} .card{background:#fff;border-radius:14px;padding:14px;box-shadow:0 6px 18px rgba(0,0,0,0.10);} .row{display:flex;gap:12px;align-items:center;} .spin{width:22px;height:22px;border:3px solid rgba(0,0,0,0.15);border-top-color:rgba(0,0,0,0.75);border-radius:999px;animation:spin 0.9s linear infinite;} @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}} .txt{font-size:13px;font-weight:700;color:#111;}</style></head><body><div class="wrap"><div class="card"><div class="row"><div class="spin"></div><div class="txt">画像を生成中…</div></div></div></div></body></html>`);
        win.document.close();
      } catch (_) {}
    };

    let previewWin = null;
    const openPreviewWindow = () => {
      const w = window.open('', '_blank');
      try { w && w.focus && w.focus(); } catch (_) {}
      if (!w) {
        alert('ポップアップがブロックされました。ブラウザ設定で許可してください。');
        return null;
      }
      writePreviewLoading(w);
      return w;
    };

    const bgSelect = document.getElementById('bg-select');
    const bg = resolveBackground(bgSelect.value);
    const selectedOption = bgSelect.options[bgSelect.selectedIndex];
    const colorName = selectedOption.dataset.label || selectedOption.text;

    const blocks = buildBlocks(items);
    const totalCount = items.length;

    const exportArea = document.getElementById('export-area');
    exportArea.innerHTML = '';

    // ★ここで復元用URLを生成（チェック＋名前＋Xを含む）
    const shareUrl = makeShareUrl();

    // ======================
    // 1) まず通常サイズでページ分割して、4枚に収まるか判定
    // ======================
    const normal = paginateBlocks({
      exportArea,
      blocks,
      bg,
      colorName,
      totalCount,
      shareUrl,
      maxPages: 4,
      height: 844,
      // 4枚目に「他X公演参戦済み」を入れるための予約領域（溢れ防止）
      reserveLastPagePx: 52
    });

    let mode = 'normal';

    if (normal.suppressedCount > 0) {
      // 4枚に収まらない時だけ、出力方式を選択
      const chosen = await askExportModeIfNeeded();
      if (!chosen) {
        // キャンセル
        exportArea.innerHTML = '';
        return;
      }
      mode = chosen;

      // ★モーダルOK押下後に別ウインドウを開く（気づかない対策）
      previewWin = openPreviewWindow();
      if (!previewWin) {
        exportArea.innerHTML = '';
        return;
      }
    } else {
      // 4枚に収まる場合は、従来通りクリック直後に開く（ポップアップブロック対策）
      previewWin = openPreviewWindow();
      if (!previewWin) {
        exportArea.innerHTML = '';
        return;
      }
    }

    // ======================
    // 2) 選択に応じて、実際に描画するページを確定
    // ======================
    let pages = normal.pages;
    let suppressedCount = normal.suppressedCount;

    if (mode === 'long') {
      // ロングサイズで全公演出力（省略なし）
      const long = paginateBlocks({
        exportArea,
        blocks,
        bg,
        colorName,
        totalCount,
        shareUrl,
        maxPages: Infinity,
        height: 1400
      });
      pages = long.pages;
      suppressedCount = 0;
    }

    // ★省略がある場合は、最後のページに必ず表示（表示漏れ修正）
    if (mode === 'normal' && suppressedCount > 0 && pages.length > 0) {
      const last = pages[pages.length - 1];
      addSuppressedNoteIntoContent(last.content, suppressedCount);
    }

    // バッジのページ番号更新
    const pageCount = pages.length;
    pages.forEach((p, i) => {
      const badge = p.wrapper.querySelector('div[style*="border-radius: 999px"]');
      if (badge) {
        badge.textContent = `✔ ${totalCount}公演${pageCount > 1 ? `  (${i + 1}/${pageCount})` : ''}`;
      }
    });

    // ======================
    // 3) 画像化してプレビュー表示
    // ======================
    const urls = [];
    const fileNames = [];
    const shareFiles = [];

    try {
      const ua = navigator.userAgent || '';
      const isIPadOS = /Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1;
      const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || isIPadOS || (navigator.userAgentData && navigator.userAgentData.mobile);

      // モバイルはメモリ/描画制限で toBlob が null になりやすいので少し軽くする
      const SCALE = 2;

      function dataURLToBlob(dataUrl) {
        try {
          const parts = String(dataUrl).split(',');
          if (parts.length < 2) return null;
          const m = parts[0].match(/data:(.*?);base64/);
          const mime = m ? m[1] : 'image/png';
          const bin = atob(parts[1]);
          const len = bin.length;
          const buf = new Uint8Array(len);
          for (let i = 0; i < len; i++) buf[i] = bin.charCodeAt(i);
          return new Blob([buf], { type: mime });
        } catch (e) {
          return null;
        }
      }

      const pad = 2;
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const canvas = await html2canvas(p.wrapper, { scale: SCALE });

        let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) {
          // iOS系で toBlob が null になることがあるので dataURL フォールバック
          const dataUrl = canvas.toDataURL('image/png');
          blob = dataURLToBlob(dataUrl);
        }
        if (!blob) continue;

        const url = URL.createObjectURL(blob);
        const fname = `pg-live-log_${String(i + 1).padStart(pad, '0')}_of_${String(pages.length).padStart(pad, '0')}.png`;
        urls.push(url);
        fileNames.push(fname);
        try { shareFiles.push(new File([blob], fname, { type: blob.type || 'image/png' })); } catch(e) {}
      }
    } catch (err) {
      console.error('画像生成エラー', err);
    }

    exportArea.innerHTML = '';

    if (urls.length) {
      openPreviewTab(urls, fileNames, `pg-live-log_${pages.length}pages`, previewWin, shareFiles);
    } else {
      // 画像生成に失敗した場合：プレビューを閉じずにエラーメッセージを表示（スマホで“開いてすぐ閉じる”対策）
      try {
        if (previewWin && previewWin.document) {
          previewWin.document.open();
          previewWin.document.write(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <title>PG LIVE LOG export</title>
            <style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f2f4f8;margin:0;padding:18px}
            .card{max-width:520px;margin:0 auto;background:#fff;border-radius:14px;padding:16px;box-shadow:0 8px 20px rgba(0,0,0,.08)}
            h1{font-size:16px;margin:0 0 10px}p{margin:0 0 10px;color:#333;font-size:14px;line-height:1.5}
            code{background:#f6f7fb;padding:2px 6px;border-radius:6px}</style>
            <div class="card">
              <h1>画像の生成に失敗しました</h1>
              <p>スマホのブラウザだと、画像生成（canvas）が失敗することがあります。</p>
              <p>対処：</p>
              <p>・端末の標準ブラウザ（Safari/Chrome）で開く<br>・他のアプリ内ブラウザ（X/Instagram等）ではなく、ブラウザで開く</p>
            </div>`);
          previewWin.document.close();
          try { previewWin.focus && previewWin.focus(); } catch(_) {}
        }
      } catch (_) {}
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










