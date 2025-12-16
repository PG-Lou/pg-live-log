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

    liveData.forEach((live, index) => {

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
      });

      container.appendChild(tour);
    });
  }

  // ======================
  // 画像出力
  // ======================
  async function exportImage() {
    const checked = document.querySelectorAll('.show-check:checked');
    if (checked.length === 0) {
      alert('チェックされた公演がありません');
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

    // ▼ 背景（最初のライブ）
    const first = JSON.parse(checked[0].dataset.show);
    const tourEl = [...document.querySelectorAll('.tour')]
      .find(t => t.querySelector('.liveTitle')?.textContent === first.live);

    if (tourEl?.style.background) {
      wrapper.style.background = tourEl.style.background;
    }

    // ▼ 白カード
    const card = document.createElement('div');
    card.style.width = 'calc(100% - 40px)';
    card.style.height = 'calc(100% - 80px)';
    card.style.margin = '40px 20px';
    card.style.background = 'rgba(255,255,255,0.75)';
    card.style.borderRadius = '18px';
    card.style.padding = '20px';
    card.style.boxSizing = 'border-box';
    card.style.overflowY = 'auto';

    wrapper.appendChild(card);

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
});
