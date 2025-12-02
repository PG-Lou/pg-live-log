// script.js

async function loadLiveData() {
  // 本番では fetch('data/live.json') に置き換え
  const response = await fetch('data/live.json');
  const data = await response.json();
  return data;
}

function renderList(liveData) {
  const container = document.getElementById('live-list');
  container.innerHTML = '';

  liveData.forEach(live => {
    const liveDiv = document.createElement('div');
    liveDiv.className = 'live';

    // ライブ名チェックボックス
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    label.appendChild(cb);
    label.append(` ${live.liveName}`);
    liveDiv.appendChild(label);

    // 年ごとのリスト
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
        sLabel.append(` ${s.date} — ${s.prefecture} — ${s.venue}`);
        yDiv.appendChild(sLabel);
      });

      yearsDiv.appendChild(yDiv);
    });

    // ライブ名チェックで内部チェックを同期
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

// 実行
loadLiveData().then(data => {
  renderList(data);
});
