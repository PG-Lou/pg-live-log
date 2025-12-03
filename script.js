document.addEventListener('DOMContentLoaded', () => {

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

  function renderList(liveData) {
    const container = document.getElementById('live-list');
    container.innerHTML = '';

    liveData.forEach((live, index) => {
      const details = document.createElement('details');
      details.className = 'tour';

      /* 最新( index===0 )だけ開いた状態に */
      if (index === 0) details.open = true;

      /* カラー設定 */
      const strong = live.color ? `${live.color}cc` : '#999';
      const light = live.color ? `${live.color}55` : '#ccc';

      details.style.setProperty('--tour-strong', strong);
      details.style.setProperty('--tour-light', light);

      /* summary */
      const summary = document.createElement('summary');
      summary.innerHTML = `
        <input type="checkbox" class="tour-check"> ${live.liveName}
      `;
      details.appendChild(summary);

      /* 中身 */
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

      /* タイトルチェック → 全部操作 */
      summary.querySelector('.tour-check').addEventListener('change', e => {
      const checked = e.target.checked;

      // 子をまとめてON/OFF
      content.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = checked);

      // チェック入れたら開く、外したら閉じる
      // details.open = checked;
      });


      container.appendChild(details);
    });
  }

  function exportImage() {
    html2canvas(document.getElementById('live-list')).then(canvas => {
      const link = document.createElement('a');
      link.download = 'pg_live_log.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  document.getElementById('export-btn').addEventListener('click', exportImage);

  loadLiveData().then(renderList);
});


