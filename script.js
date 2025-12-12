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
      const details = document.createElement('details');
      details.className = 'tour';

      // ★ ここが重要：色はそのまま background に突っ込む
      if (live.color) {
        details.style.background = live.color;
        details.style.backgroundRepeat = 'no-repeat';
        details.style.backgroundSize = 'cover';
      } else {
        details.style.background = '#ccc';
      }

      // ▼ summary
      const summary = document.createElement('summary');
      summary.innerHTML = `<input type="checkbox" class="tour-check"> ${live.liveName}`;
      details.appendChild(summary);

      const content = document.createElement('div');
      content.className = 'tour-content';

      live.years.forEach(y => {
        const yBlock = document.createElement('div');
        yBlock.className = 'year-block';
        yBlock.innerHTML = `<strong>${y.year}</strong>`;

        y.shows.forEach(s => {
          const label = document.createElement('label');
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.dataset.show = JSON.stringify({
            live: live.liveName,
            year: y.year,
            show: s
          });

          const timeText = s.time ? `(${s.time})` : '';
          label.appendChild(input);
          label.append(` ${s.date} ${timeText} — ${s.prefecture} — ${s.venue}`);

          yBlock.appendChild(label);
        });

        content.appendChild(yBlock);
      });

      details.appendChild(content);

      // ▼ 親チェックで子もON/OFF（※開閉はチェック時のみ）
      summary.querySelector('.tour-check').addEventListener('change', e => {
        const checked = e.target.checked;
        content.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = checked);
        if (checked) details.open = true;
      });

      container.appendChild(details);
    });
  }

  // ======================
  // ボタン制御
  // ======================
  const bgSelect = document.getElementById('bg-select');
  const exportBtn = document.getElementById('export-btn');
  exportBtn.disabled = !bgSelect.value;

  bgSelect.addEventListener('change', () => {
    exportBtn.disabled = !bgSelect.value;
  });

  // ======================
  // 画像出力（画面遷移）
  // ======================
  async function exportImage() {
    const checked = document.querySelectorAll('.tour-content input[type="checkbox"]:checked');
    if (checked.length === 0) {
      alert('チェックされた公演がありません');
      return;
    }

    const bgStyle = bgSelect.value;
    const colorName = bgSelect.selectedOptions?.[0]?.textContent || '';

    const WIDTH = 390;
    const HEIGHT = 844;

    const exportArea = document.getElementById('export-area');
    exportArea.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.width = WIDTH + 'px';
    wrapper.style.height = HEIGHT + 'px';
    wrapper.style.background = bgStyle;
    wrapper.style.backgroundRepeat = 'no-repeat';
    wrapper.style.backgroundSize = 'cover';
    wrapper.style.position = 'relative';
    wrapper.style.fontFamily = 'Helvetica, Arial, sans-serif';

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

    // ▼ ユーザー名 + X
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
        h.style.marginTop = '10px';
        card.appendChild(h);
      }

      const time = s.time === 'AM' ? '昼' : s.time === 'PM' ? '夜' : '';
      const line = document.createElement('div');
      line.textContent = `${s.date.replace(/-/g, '/')} ${time} ${s.prefecture} ${s.venue}`;
      line.style.fontSize = '16px';
      line.style.paddingLeft = '8px';
      card.appendChild(line);
    });

    // ▼ 右下カラー名
    if (colorName) {
      const label = document.createElement('div');
      label.textContent = 'カラーイメージ：' + colorName;
      label.style.position = 'absolute';
      label.style.right = '10px';
      label.style.bottom = '10px';
      label.style.fontSize = '12px';
      label.style.color = '#fff';
      label.style.textShadow = '0 0 6px rgba(0,0,0,0.5)';
      wrapper.appendChild(label);
    }

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
