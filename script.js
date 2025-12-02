async function loadLiveData() {
  const response = await fetch('data/live.json');
  const data = await response.json();
  return data;
}

// 簡易データ（例）
const liveData = [
  {
    liveName: "FANCLUB UNDERWORLD 6",
    years: [
      { year: 2025, shows:
        [
          { date: "2025-09-29", prefecture: "神奈川", venue: "KT Zepp Yokohama" },
          { date: "2025-09-30", prefecture: "神奈川", venue: "KT Zepp Yokohama" }
        ]
      }
    ]
  },
  {
    liveName: "PG wasn't built in a day",
    years: [
      { year: 2024, shows:
        [
          { date: "2024-02-10", prefecture: "埼玉", venue: "さいたまスーパーアリーナ" }
        ]
      }
    ]
  }
];

function renderList(){
  const container = document.getElementById("live-list");
  container.innerHTML = "";
  liveData.forEach(live=>{
    const liveDiv = document.createElement("div");
    liveDiv.className = "live";
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.live = live.liveName;
    label.appendChild(cb);
    label.append(" " + live.liveName);
    liveDiv.appendChild(label);

    const yearsDiv = document.createElement("div");
    yearsDiv.className = "year-list";
    live.years.forEach(y=>{
      const yDiv = document.createElement("div");
      yDiv.innerHTML = `<strong>${y.year}</strong>`;
      y.shows.forEach(s=>{
        const sLabel = document.createElement("label");
        sLabel.style.display="block";
        const sCb = document.createElement("input");
        sCb.type = "checkbox";
        sCb.dataset.show = JSON.stringify({live: live.liveName, year: y.year, show: s});
        sLabel.appendChild(sCb);
        sLabel.append(` ${s.date} — ${s.prefecture} — ${s.venue}`);
        yDiv.appendChild(sLabel);
      });
      yearsDiv.appendChild(yDiv);
    });
    liveDiv.appendChild(yearsDiv);

    // ライブ名チェックで内部のチェックを同期
    cb.addEventListener("change", e=>{
      const checked = e.target.checked;
      yearsDiv.querySelectorAll('input[type="checkbox"]').forEach(x=>{
        x.checked = checked;
      });
    });

    container.appendChild(liveDiv);
  });
}

function exportImage(){
  const el = document.getElementById("live-list");
  html2canvas(el).then(canvas=>{
    const link = document.createElement("a");
    link.download = "pg_live_log.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
}

document.getElementById("export-btn").addEventListener("click", exportImage);
renderList();

loadLiveData().then(liveData => {
  const container = document.getElementById('live-list');

  liveData.forEach(live => {
    const item = document.createElement('div');
    item.classList.add('live-item');
    item.innerHTML = `
      <label>
        <input type="checkbox">
        ${live.year} / ${live.date} / ${live.tour} / ${live.location}
      </label>
    `;
    
    container.appendChild(item);
  });
});
