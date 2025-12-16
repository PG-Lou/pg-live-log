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

    liveData.forEach((live) => {

      const tour = document.createElement('section');
      tour.className = 'tour';
      tour.style.background = live.color || '#ddd';

      // ===== ヘッダー =====
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

      // ===== 中身 =====
      const content = document.createElement('div');
      content.className = 'tour-content';
      content.hidden = true;

      live.years.forEach(y => {
        const yearBlock = document.createElement('div');
        yearBlock.className = 'year-block';

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

      // ===== 開閉制御 =====
      header.addEventListener('click', e => {
        if (e.target.closest('.pgCheck')) return;

        const expanded = header.getAttribute('aria-expanded') === 'true';
        header.setAttribute('aria-expanded', String(!expanded));
        content.hidden = expanded;
      });

      // ===== 親チェック → 子チェック =====
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
  // 画像保存ボタンの活性制御
  // ======================
  function updateExportButtonState() {
    const hasCheckedShow = document.querySelectorAll('.show-check:checked').length > 0;
    const bgSelected = document.getElementById('bg-select')?.value;
    const btn = document.getElementById('export-btn');
    btn.disabled = !(hasCheckedShow && bgSelected);
  }

  // ======================
  // 画像出力
  // ======================
  async function exportImage() {
    updateExportButtonState();

    const checked = document.querySelectorAll('.show-check:checked');
    if (checked.length === 0) {
      alert('チェックされた公演がありません');
      return;
    }

    const bg = document.getElementById('bg-select')?.value;
    if (!bg) {
      alert('イメージカラーを選択してください');
      return;
    }

    const WIDTH = 390;
    const HEIGHT = 844;

    const exportArea = document.getElementById('export-area');
    exportArea.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.width = WIDTH + 'px';
    wrapper.style.height = HEIGHT + 'px';
    wrapper.style.position = 'relative';
    wrapper.style.fontFamily = 'Helvetica, Arial, sans-serif';

    // ▼ 背景：bg-select の値を使う（元の仕様に戻す）
    wrapper.style.background = bg;

    // ▼ 白カード（上下のバランスを中央寄りに）
    const card = document.createElement('div');
    card.style.position = 'absolute';
    card.style.inset = '40px 20px';
    card.style.background = 'rgba(255,255,255,0.78)';
    card.style.borderRadius = '18px';
    card.style.padding = '20px';
    card.style.boxSizing = 'border-box';
    card.style.overflowY = 'auto';

    wrapper.appendChild(card);

    // ===== 左下：URL =====
    const urlLabel = document.createElement('div');
    urlLabel.textContent = 'https://pg-lou.github.io/pg-live-log/';
    urlLabel.style.position = 'absolute';
    urlLabel.style.left = '20px';
    urlLabel.style.bottom = '14px';
    urlLabel.style.fontSize = '11px';
    urlLabel.style.opacity = '0.55';
    urlLabel.style.letterSpacing = '0.02em';
    wrapper.appendChild(urlLabel);
    
    // ===== 右下：イメージカラー =====
    const bgSelect = document.getElementById('bg-select');
    if (bgSelect && bgSelect.selectedIndex > 0) {
    const colorName = bgSelect.options[bgSelect.selectedIndex].text;
  
    const colorLabel = document.createElement('div');
    colorLabel.textContent = `image color：♪${colorName}`;
    colorLabel.style.position = 'absolute';
    colorLabel.style.right = '20px';
    colorLabel.style.bottom = '14px';
    colorLabel.style.fontSize = '11px';
    colorLabel.style.opacity = '0.55';
    colorLabel.style.letterSpacing = '0.02em';
    wrapper.appendChild(colorLabel);
    }



    // ▼ ユーザー情報
    let userName = document.getElementById('user-name')?.value.trim() || '';
    let userX = document.getElementById('user-x')?.value.trim() || '';
    if (userX && !userX.startsWith('@')) userX = '@' + userX;

    if (userName || userX) {
      const line = document.createElement('div');
      line.style.fontSize = '18px';
      line.style.fontWeight = '600';
      line.style.marginBottom = '14px';
      line.textContent = userName + (userX ? ' ' + userX : '');
      card.appendChild(line);
    }

    // ▼ 公演一覧
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

    exportArea.appendChild(wrapper);

    html2canvas(wrapper, { scale: 2, useCORS: true }).then(canvas => {
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        window.location.href = url;
      });
    });
  }

  document.getElementById('export-btn').addEventListener('click', exportImage);

  loadLiveData().then(renderList);

  // ===== 下部固定バー化 =====
  const bgSelector = document.querySelector('.bg-selector');
  const exportBtn = document.getElementById('export-btn');

  const bottomBar = document.createElement('div');
  bottomBar.className = 'bottom-bar';

  const inner = document.createElement('div');
  inner.className = 'bottom-bar-inner';

  inner.appendChild(bgSelector);
  inner.appendChild(exportBtn);

  bottomBar.appendChild(inner);
  document.body.appendChild(bottomBar);

  document.getElementById('bg-select')
    .addEventListener('change', updateExportButtonState);

});


