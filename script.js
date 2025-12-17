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
  // 画像出力
  // ======================
  async function exportImage() {
    const checked = document.querySelectorAll('.show-check:checked');
    if (!checked.length) return;

    const bgSelect = document.getElementById('bg-select');
    const bg = bgSelect.value;
    const colorName = bgSelect.options[bgSelect.selectedIndex].text;

    const WIDTH = 390;
    const HEIGHT = 844;

    const exportArea = document.getElementById('export-area');
    exportArea.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.width = WIDTH + 'px';
    wrapper.style.height = HEIGHT + 'px';
    wrapper.style.position = 'relative';
    wrapper.style.background = bg;
    wrapper.style.fontFamily = 'Helvetica, Arial, sans-serif';

    /* ===== 上：名前＋X（折り返し対応・省略なし） ===== */
    let userName = document.getElementById('user-name').value.trim();
    let userX = document.getElementById('user-x').value.trim();
    if (userX && !userX.startsWith('@')) userX = '@' + userX;

    if (userName || userX) {
      const top = document.createElement('div');
      top.textContent = userName + (userX ? ' ' + userX : '');
      top.style.position = 'absolute';
      top.style.top = '16px';
      top.style.left = '20px';
      top.style.right = '20px';
      top.style.fontSize = '15px';
      top.style.fontWeight = '600';
      top.style.lineHeight = '1.25';
      top.style.wordBreak = 'break-all';   // ← ここが重要
      top.style.color = '#111';
      top.style.textShadow = '0 1px 3px rgba(255,255,255,0.75)';
      wrapper.appendChild(top);
    }

    /* ===== 白カード ===== */
    const card = document.createElement('div');
    card.style.position = 'absolute';
    card.style.inset = '64px 20px 92px';
    card.style.background = 'rgba(255,255,255,0.8)';
    card.style.borderRadius = '18px';
    card.style.padding = '20px';
    card.style.overflowY = 'auto';
    wrapper.appendChild(card);

    let currentTour = '';
    checked.forEach(cb => {
      const data = JSON.parse(cb.dataset.show);
      const s = data.show;

      if (data.live !== currentTour) {
        currentTour = data.live;
        const h = document.createElement('div');
        h.textContent = '■ ' + currentTour;
        h.style.fontWeight = '700';
        h.style.marginTop = '12px';
        card.appendChild(h);
      }

      const time = s.time === 'AM' ? '昼' : s.time === 'PM' ? '夜' : '';
      const line = document.createElement('div');
      line.textContent = `${s.date.replace(/-/g, '/')} ${time} ${s.prefecture} ${s.venue}`;
      line.style.fontSize = '15px';
      line.style.paddingLeft = '8px';
      card.appendChild(line);
    });

    /* ===== 右下：2段（少し上げて余裕） ===== */
    const bottom = document.createElement('div');
    bottom.style.position = 'absolute';
    bottom.style.right = '20px';
    bottom.style.bottom = '28px';   // ← 余裕を持たせた
    bottom.style.textAlign = 'right';
    bottom.style.fontSize = '11px';
    bottom.style.lineHeight = '1.45';
    bottom.style.color = '#111';
    bottom.style.opacity = '0.6';
    bottom.style.textShadow = '0 1px 3px rgba(255,255,255,0.75)';

    bottom.innerHTML = `
      <div>image color：♪${colorName}</div>
      <div>https://pg-lou.github.io/pg-live-log/</div>
    `;

    wrapper.appendChild(bottom);
    exportArea.appendChild(wrapper);

    html2canvas(wrapper, { scale: 2 }).then(canvas => {
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        window.location.href = url;
      });
    });
  }

  document.getElementById('export-btn')
    .addEventListener('click', exportImage);

  loadLiveData().then(renderList);
});
