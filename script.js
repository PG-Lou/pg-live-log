document.addEventListener('DOMContentLoaded', () => {

  async function loadLiveData() {
    try {
      const response = await fetch('data/live.json');
      if (!response.ok) throw new Error('JSON読み込み失敗: ' + response.status);
      const data = await response.json();
      console.log("読み込んだライブデータ:", data);
      return data;
    } catch (e) {
      console.error(e);
      alert('ライブデータの読み込みに失敗しました');
      return [];
    }
  }

  function renderList(liveData) {
    const container = document.getElementById('live-list');
    container.innerHTML = '';

    liveData.forEach(live => {
      const liveDiv = document.createElement('div');
      liveDiv.className = 'live';

      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      label.appendChild(cb);
      label.append(` ${live.liveName}`);
      liveDiv.appendChild(label);

      const yearsDiv = document.createElement('div');
      yearsDiv.className = 'year-list';

      live.years.forEach(y => {
        const yDiv = document.createElement('div');
        yDiv.innerHTML = `<strong>${y.year}</strong>`;

        y.shows.forEach(s => {
          const sLabel = document.createElement('label');
          sLabel.style.display = 'block';
          const sCb = document.createElement('input');
          sCb.type = 'checkbox';
          sCb.dataset.show = JSON.stringify({ live: live.liveName, year: y.year, show: s });
          sLabel.appendChild(sCb);
          sLabel.append(` ${s.date} ${s.time ? `(${s.time})` : ''} — ${s.prefecture} — ${s.venue}`);
          yDiv.appendChild(sLabel);
        });

        yearsDiv.appendChild(yDiv);
      });

      cb.addEventListener('change', e => {
        const checked = e.target.checked;
        yearsDiv.querySelectorAll('input[type="checkbox"]').forEach(x => x.checked = checked);
      });

      liveDiv.appendChild(yearsDiv);
      container.appendChild(liveDiv);
    });
  }

  function exportImage() {
    const el = document.getElementById('live-list');
    html2canvas(el).then(canvas => {
      const link = document.createElement('a');
      link.download = 'pg_live_log.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  document.getElementById('export-btn').addEventListener('click', exportImage);

  loadLiveData().then(data => {
    renderList(data);
  });

});



