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

    let userName = document.getElementById('user-name').value.trim();
    let userX = document.getElementById('user-x').value.trim();
    if (userX && !userX.startsWith('@')) userX = '@' + userX;

    const topText = userName + (userX ? ' ' + userX : '');
    if (topText) {
      const top = document.createElement('div');
      top.textContent = topText;
      top.style.position = 'absolute';
      top.style.top = '16px';
      top.style.left = '20px';
      top.style.right = '110px';
      top.style.fontSize = '15px';
      top.style.fontWeight = '600';
      top.style.lineHeight = '1.25';
      top.style.wordBreak = 'break-all';
      top.style.color = '#111';
      top.style.textShadow = '0 0 6px rgba(255,255,255,0.85),0 1px 2px rgba(255,255,255,0.85)';
      wrapper.appendChild(top);
    }

    const badge = document.createElement('div');
    badge.textContent = `✔ ${totalCount}公演${pageCount > 1 ? `  (${pageIndex}/${pageCount})` : ''}`;
    badge.style.position = 'absolute';
    badge.style.top = '18px';
    badge.style.right = '20px';
    badge.style.fontSize = '12px';
    badge.style.fontWeight = '700';
    badge.style.padding = '6px 10px';
    badge.style.borderRadius = '999px';
    badge.style.background = 'rgba(255,255,255,0.75)';
    badge.style.color = '#111';
    badge.style.textShadow = '0 0 6px rgba(255,255,255,0.85)';
    wrapper.appendChild(badge);

    const card = document.createElement('div');
    card.style.position = 'absolute';
    card.style.inset = '52px 20px 44px';
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
    bottom.style.bottom = '10px';
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
    const colorName = bgSelect.options[bgSelect.selectedIndex].text;

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
          // ★修正：新ページを作るのは「まだ4枚未満」のときだけ
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

          // ★修正：ここも同様に、5枚目を作らず「入らない分だけ省略」へ
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
