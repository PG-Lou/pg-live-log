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
  // 1. チェックされた公演を集める
  const checked = document.querySelectorAll(
    '.tour-content input[type="checkbox"]:checked'
  );

  if (checked.length === 0) {
    alert("チェックされた公演がありません");
    return;
  }

  // 2. 出力用のHTMLを生成
  const exportArea = document.getElementById("export-area");
  exportArea.innerHTML = ""; // 初期化

  let currentTour = "";
  let wrapper = document.createElement("div");
  wrapper.style.fontSize = "18px";
  wrapper.style.lineHeight = "1.6";
  wrapper.style.width = "360px";      // ←スマホ幅
  wrapper.style.padding = "20px";
  wrapper.style.background = "#fff";
  wrapper.style.border = "1px solid #ddd";
  wrapper.style.borderRadius = "10px";

  checked.forEach(cb => {
    const data = JSON.parse(cb.dataset.show);
    const tourName = data.live;
    const y = data.year;
    const s = data.show;

    // ツアー名が変わったらツアー見出しを追加
    if (tourName !== currentTour) {
      currentTour = tourName;

      const h = document.createElement("div");
      h.textContent = "■ " + tourName;
      h.style.marginTop = "16px";
      h.style.fontWeight = "bold";
      wrapper.appendChild(h);
    }

    // 昼/夜変換
    let timeLabel = "";
    if (s.time === "AM") timeLabel = "昼";
    if (s.time === "PM") timeLabel = "夜";

    const line = document.createElement("div");
    line.textContent =
      `${s.date} ${timeLabel ? timeLabel + " " : ""}${s.prefecture} ${s.venue}`;
    line.style.marginLeft = "10px";
    wrapper.appendChild(line);
  });

  exportArea.appendChild(wrapper);

  // 3. html2canvas で画像化
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

