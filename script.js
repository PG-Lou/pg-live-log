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

      // ▼ツアータイトルのチェック挙動
      summary.querySelector('.tour-check').addEventListener('change', e => {
        const checked = e.target.checked;

        // 子チェックON/OFF
        content.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = checked);

        // 開閉
        details.open = checked;
      });

      container.appendChild(details);
    });
  }

  function exportImage() {
  const checked = document.querySelectorAll(
    '.tour-content input[type="checkbox"]:checked'
  );

  if (checked.length === 0) {
    alert("チェックされた公演がありません");
    return;
  }

  // ▼プルダウン背景色
  const bgColor = document.getElementById("bg-select").value;

  // ▼固定サイズ（スマホ画面くらい）
  const WIDTH = 390;
  const HEIGHT = 844;

  // ▼export-area 初期化
  const exportArea = document.getElementById("export-area");
  exportArea.innerHTML = "";

  // ▼背景
  const wrapper = document.createElement("div");
  wrapper.style.width = WIDTH + "px";
  wrapper.style.height = HEIGHT + "px";
  wrapper.style.background = bgColor;
  wrapper.style.position = "relative";
  wrapper.style.fontFamily = "Helvetica, Arial";
  wrapper.style.color = "#000";
  wrapper.style.overflow = "hidden";
  wrapper.style.padding = "0";

  // ▼内側の白カード（余白つけて読みやすく）
  const card = document.createElement("div");
  card.style.width = (WIDTH - 40) + "px";
  card.style.height = (HEIGHT - 80) + "px";
  card.style.position = "absolute";
  card.style.left = "20px";
  card.style.top = "40px";
  card.style.background = "rgba(255,255,255,0.86)";
  card.style.borderRadius = "18px";
  card.style.padding = "20px";
  card.style.boxSizing = "border-box";
  card.style.overflowY = "auto";
  card.style.display = "flex";
  card.style.flexDirection = "column";
  card.style.gap = "10px";

  wrapper.appendChild(card);

  // ▼現在のツアー名
  let currentTour = "";

  checked.forEach(cb => {
    const data = JSON.parse(cb.dataset.show);
    const tourName = data.live;
    const s = data.show;

    // ツアー名の見出し
    if (tourName !== currentTour) {
      currentTour = tourName;

      const h = document.createElement("div");
      h.textContent = "■ " + tourName;
      h.style.fontWeight = "bold";
      h.style.marginTop = "10px";
      h.style.fontSize = "18px";
      card.appendChild(h);
    }

    // 昼夜変換
    let timeLabel = "";
    if (s.time === "AM") timeLabel = "昼";
    if (s.time === "PM") timeLabel = "夜";

    const line = document.createElement("div");
    line.textContent =
      `${s.date} ${timeLabel ? timeLabel + " " : ""}${s.prefecture} ${s.venue}`;
    line.style.paddingLeft = "8px";
    line.style.fontSize = "16px";
    card.appendChild(line);
  });

  exportArea.appendChild(wrapper);

  // ▼画像化
  html2canvas(wrapper, { scale: 2 }).then(canvas => {
    const link = document.createElement("a");
    link.download = "pg_live_selected.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
}


  document.getElementById('export-btn').addEventListener('click', exportImage);

  loadLiveData().then(renderList);
});


