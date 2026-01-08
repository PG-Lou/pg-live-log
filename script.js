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
  function openPreviewTab(imageUrls, title) {
    const w = window.open('', '_blank');
    if (!w) {
      alert('ポップアップがブロックされました。ブラウザ設定で許可してください。');
      return;
    }

    const safeTitle = title || 'PG LIVE LOG export preview';
    const safeUrls = imageUrls.map(u => String(u));

    w.document.open();
    w.document.write(`
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
    w.document.close();
  }

  function getCheckedShowsInOrder() {
    const checked = Array.from(document.querySelectorAll('.show-check:checked'));

    return checked.map(cb => {
      const data = JSON.parse(cb.dataset.show);
      const s = data.show;
      const time = s.time === 'AM' ? '昼' : s.time === 'PM' ? '夜' : '';
      return {
        live: data.live,
        date: s.date,
        lineText: `${s.date.replace(/-/g, '/')} ${time} ${s.prefecture} ${s.venue}`.replace(/\s+/g, ' ').trim()
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

  function createExportWrapper({ bg, colorName, totalCount, pageIndex, pageCount }) {
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
    card.style.inset = '54px 20px 56px';
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

    const bottom = document.createElement('div');
    bottom.style.position = 'absolute';
    bottom.style.right = '20px';
    bottom.style.bottom = '14px';
    bottom.style.textAlign = 'right';
    bottom.style.fontSize = '11px';
    bottom.style.lineHeight = '1.45';
    bottom.style.color = '#111';
    bottom.style.opacity = '0.6';
    bottom.style.textShadow = '0 0 6px rgba(255,255,255,0.85),0 1px 2px rgba(255,255,255,0.85)';
    bottom.innerHTML = `
      <div>image color：♪${colorName}</div>
      <div>https://pg-lou.github.io/pg-live-log/</div>
    `;
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
    const items = getCheckedShowsInOrder();
    if (!items.length) return;

    const bgSelect = document.getElementById('bg-select');
    const bg = bgSelect.value;
    const selectedOption = bgSelect.options[bgSelect.selectedIndex];
    const colorName = selectedOption.dataset.label || selectedOption.text;


    const blocks = buildBlocks(items);
    const totalCount = items.length;

    const exportArea = document.getElementById('export-area');
    exportArea.innerHTML = '';

    const tmp = createExportWrapper({ bg, colorName, totalCount, pageIndex: 1, pageCount: 1 });
    exportArea.appendChild(tmp.wrapper);
    const maxHeight = tmp.content.clientHeight;
    exportArea.innerHTML = '';

    const pages = [];
    let page = null;

    const newPage = () => {
      const p = createExportWrapper({ bg, colorName, totalCount, pageIndex: 1, pageCount: 1 });
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
      openPreviewTab(urls, `pg-live-log_${pages.length}pages`);
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

  loadLiveData().then(renderList);

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




