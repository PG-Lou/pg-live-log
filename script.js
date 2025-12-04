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

      if (index === 0) details.open = true;

      const strong = live.color ? `${live.color}cc` : '#999';
      const light = live.color ? `${live.color}55` : '#ccc';

      details.style.setProperty('--tour-strong', strong);
      details.style.setProperty('--tour-light', light);

      const summary = document.createElement('summary');
      summary.innerHTML = `
        <input type="checkbox" class="tour-check"> ${live.liveName}
      `;
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

      // 🌟 修正済み：summary のチェック動作制御
      const toggle = summary.querySelector('.tour-check');

      toggle.addEventListener('click', e => {
        // ← summaryクリック扱いになるの防止（これ大事）
        e.stopPropagation();

        const checked = e.target.checked;

        // 中身のチェック全部切り替える
        content.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = checked;
        });

        // チェックしたら折りたたみ自動で開く
        if (checked) details.open = true;
      });

      container.appendChild(details);
    });
  }

  function exportImage() {
    html
