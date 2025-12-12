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

      summary.querySelector('.tour-check').addEventListener('change', e => {
        const checked = e.target.checked;
        content.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = checked);
        details.open = checked;
      });

      container.appendChild(details);
    });
  }

  // === ボタンON/OFF ===
  const bgSelect = document.getElementById("bg-select");
  const exportBtn = document.getElementById("export-btn");
  exportBtn.disabled = !bgSelect.value;

  bgSelect.addEventListener("change", () => {
    exportBtn.disabled = !bgSelect.value;
  });


  // ========== 画像出力（画面遷移版） ==========
async function exportImage() {
  try {
    const checked = document.querySelectorAll('.tour-content input[type="checkbox"]:checked');

    if (checked.length === 0) {
      alert("チェックされた公演がありません");
      return;
    }

    const bgSelect = document.getElementById("bg-select");
    const bgStyle = bgSelect.value || "";
    const selectedName = bgSelect.selectedOptions?.[0]?.textContent.trim() || "";

    const WIDTH = 390;
    const HEIGHT = 844;

    const exportArea = document.getElementById("export-area");
    exportArea.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.style.width = WIDTH + "px";
    wrapper.style.height = HEIGHT + "px";

    if (bgStyle) {
      wrapper.style.background = bgStyle;
      wrapper.style.backgroundImage = bgStyle;
      wrapper.style.backgroundSize = "cover";
      wrapper.style.backgroundRepeat = "no-repeat";
      wrapper.style.backgroundPosition = "center center";
    } else {
      wrapper.style.background = "#ffffff";
    }

    wrapper.style.position = "relative";
    wrapper.style.fontFamily = "Helvetica, Arial, sans-serif";
    wrapper.style.color = "#000";
    wrapper.style.overflow = "hidden";

    // ▼ 白いカード
    const card = document.createElement("div");
    card.style.width = (WIDTH - 40) + "px";
    card.style.height = (HEIGHT - 80) + "px";
    card.style.position = "absolute";
    card.style.left = "20px";
    card.style.top = "40px";
    card.style.background = "rgba(255,255,255,0.7)";
    card.style.boxShadow = "0 4px 18px rgba(0,0,0,0.18)";
    card.style.borderRadius = "18px";
    card.style.padding = "20px";
    card.style.boxSizing = "border-box";
    card.style.overflowY = "auto";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "10px";

    wrapper.appendChild(card);

    // ▼ ユーザー名前 + X
    let userName = document.getElementById("user-name").value.trim();
    let userX = document.getElementById("user-x").value.trim();

    if (userX && !userX.startsWith("@")) {
      userX = "@" + userX;
    }

    if (userName || userX) {
      const userLine = document.createElement("div");
      userLine.style.fontSize = "18px";
      userLine.style.fontWeight = "600";
      userLine.style.marginBottom = "14px";
      userLine.style.display = "flex";
      userLine.style.alignItems = "baseline";
      userLine.style.gap = "8px";

      if (userName) {
        const nameSpan = document.createElement("span");
        nameSpan.textContent = userName;
        userLine.appendChild(nameSpan);
      }

      if (userX) {
        const xSpan = document.createElement("span");
        xSpan.textContent = userX;
        xSpan.style.fontSize = "14px";
        xSpan.style.opacity = "0.8";
        userLine.appendChild(xSpan);
      }

      card.appendChild(userLine);
    }

    // ▼ チェックされたライブを追加
    let currentTour = "";
    checked.forEach(cb => {
      const data = JSON.parse(cb.dataset.show);
      const tourName = data.live;
      const s = data.show;

      if (tourName !== currentTour) {
        currentTour = tourName;
        const h = document.createElement("div");
        h.textContent = "■ " + tourName;
        h.style.fontWeight = "700";
        h.style.marginTop = "10px";
        h.style.fontSize = "18px";
        card.appendChild(h);
      }

      let timeLabel = "";
      if (s.time === "AM") timeLabel = "昼";
      if (s.time === "PM") timeLabel = "夜";

      const dateText = s.date.replace(/-/g, '/').replace(/^0+/g, '');

      const line = document.createElement("div");
      line.textContent = `${dateText}${timeLabel ? " " + timeLabel : ""} ${s.prefecture} ${s.venue}`;
      line.style.paddingLeft = "8px";
      line.style.fontSize = "16px";
      card.appendChild(line);
    });

    // ▼ カラー名（右下表示）
    if (selectedName) {
      const label = document.createElement("div");
      label.textContent = "カラーイメージ：" + selectedName;
      label.style.position = "absolute";
      label.style.right = "10px";
      label.style.bottom = "10px";
      label.style.fontSize = "12px";
      label.style.color = "rgba(255,255,255,0.85)";
      label.style.textShadow = "0 0 6px rgba(0,0,0,0.45)";
      label.style.padding = "2px 6px";
      label.style.borderRadius = "8px";
      label.style.backdropFilter = "blur(2px)";
      wrapper.appendChild(label);
    }

    exportArea.appendChild(wrapper);

    // ▼ ここから重要（Blob で生成 & 画面遷移）
    html2canvas(wrapper, { scale: 2, useCORS: true }).then(canvas => {
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);

        // ★ プレビュー画面に遷移（スマホでも動く）
        window.location.href = url;

      }, "image/png");
    }).catch(err => {
      console.error("html2canvas error:", err);
      alert("画像エクスポート中にエラーが発生しました");
    });

  } catch (err) {
    console.error(err);
    alert("エクスポート処理で問題が発生しました");
  }
}

  document.getElementById('export-btn').addEventListener('click', exportImage);

  loadLiveData().then(renderList);

  document.getElementById("bg-select").addEventListener("change", () => {
    const btn = document.getElementById("export-btn");
    btn.disabled = !document.getElementById("bg-select").value;
  });

});


// ===== ヘッダー画像 平均色 → 背景色 =====
function averageColor(imgEl) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = imgEl.naturalWidth;
  canvas.height = imgEl.naturalHeight;

  ctx.drawImage(imgEl, 0, 0);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  let r = 0, g = 0, b = 0;
  const len = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }

  r = Math.round(r / len);
  g = Math.round(g / len);
  b = Math.round(b / len);

  return `rgb(${r}, ${g}, ${b})`;
}

window.addEventListener("load", () => {
  const header = document.querySelector(".header");

  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.src = "https://raw.githubusercontent.com/PG-Lou/pg-live-log/main/images/header.png";

  img.onload = () => {
    const avg = averageColor(img);
    document.body.style.backgroundColor = avg;
  };
});

