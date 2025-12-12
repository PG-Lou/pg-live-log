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

// 「イメージカラー選択」が未選択なら export ボタンを無効化
const bgSelect = document.getElementById("bg-select");
const exportBtn = document.getElementById("export-btn");

// 初期状態（ページ読み込み直後）
exportBtn.disabled = !bgSelect.value;

// 選択変更時にON/OFF切り替え
bgSelect.addEventListener("change", () => {
  exportBtn.disabled = !bgSelect.value;
});


  async function exportImage() {
  try {
    const checked = document.querySelectorAll('.tour-content input[type="checkbox"]:checked');

    if (checked.length === 0) {
      alert("チェックされた公演がありません");
      return;
    }

    // 選択中の background とそのラベル名を取得（selectedOptions 安全）
    // const bgSelect = document.getElementById("bg-select");
    const bgStyle = bgSelect.value || "";
    const selectedName = (bgSelect.selectedOptions && bgSelect.selectedOptions[0])
      ? bgSelect.selectedOptions[0].textContent.trim()
      : "";

    console.log("bgStyle:", bgStyle, "selectedName:", selectedName);

    // 固定サイズ（スマホイメージ）
    const WIDTH = 390;
    const HEIGHT = 844;

    const exportArea = document.getElementById("export-area");
    exportArea.innerHTML = "";

    // wrapper（必ず body 配下にある exportArea に append するので html2canvas が拾える）
    const wrapper = document.createElement("div");
    wrapper.style.width = WIDTH + "px";
    wrapper.style.height = HEIGHT + "px";
    // gradient を backgroundImage と background の両方に設定（互換性のため）
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

    // 白カード（透過）
    const card = document.createElement("div");
    card.style.width = (WIDTH - 40) + "px";
    card.style.height = (HEIGHT - 80) + "px";
    card.style.position = "absolute";
    card.style.left = "20px";
    card.style.top = "40px";
    card.style.background = "rgba(255,255,255,0.7)"; // 透過具合調整
    card.style.boxShadow = "0 4px 18px rgba(0,0,0,0.18)";
    card.style.borderRadius = "18px";
    card.style.padding = "20px";
    card.style.boxSizing = "border-box";
    card.style.overflowY = "auto";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "10px";

    wrapper.appendChild(card);
    
// ▼ユーザー入力の取得
let userName = document.getElementById("user-name").value.trim();
let userX = document.getElementById("user-x").value.trim();

// X は先頭に @ がなかったら自動で付ける
if (userX && !userX.startsWith("@")) {
  userX = "@" + userX;
}

// ▼名前＋X を1行で表示（どちらかあれば表示）
if (userName || userX) {
  const userLine = document.createElement("div");
  userLine.style.fontSize = "18px";
  userLine.style.fontWeight = "600";
  userLine.style.marginBottom = "14px";
  userLine.style.display = "flex";
  userLine.style.alignItems = "baseline";
  userLine.style.gap = "8px";

  // 名前
  if (userName) {
    const nameSpan = document.createElement("span");
    nameSpan.textContent = userName;
    userLine.appendChild(nameSpan);
  }

  // Xアカウント（小さめ）
  if (userX) {
    const xSpan = document.createElement("span");
    xSpan.textContent = userX;
    xSpan.style.fontSize = "14px";
    xSpan.style.opacity = "0.8";
    userLine.appendChild(xSpan);
  }

  card.appendChild(userLine);
}
    

    // コンテンツ作成（ツアーごとに見出し）
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

      const line = document.createElement("div");
      // date を 2025-09-30 みたいなフォーマットから 2025/9/30 にしておく（元データの形式によるが保持）
      const dateText = s.date.replace(/-/g, '/').replace(/^0+/g, '');
      line.textContent = `${dateText}${timeLabel ? " " + timeLabel : ""} ${s.prefecture} ${s.venue}`;
      line.style.paddingLeft = "8px";
      line.style.fontSize = "16px";
      card.appendChild(line);
    });

    // 右下の小文字表記（wrapper の外側に重ならないように配置）
    if (selectedName) {
      const label = document.createElement("div");
      label.textContent = "カラーイメージ：" + selectedName;
      label.style.position = "absolute";
      label.style.right = "10px";
      label.style.bottom = "10px";
      label.style.fontSize = "12px";
      label.style.color = "rgba(255,255,255,0.85)";
      label.style.textShadow = "0 0 6px rgba(0,0,0,0.45)";
      // 背景が明るいときに見えるように軽いボーダーを付ける（任意）
      label.style.padding = "2px 6px";
      label.style.borderRadius = "8px";
      label.style.backdropFilter = "blur(2px)";
      wrapper.appendChild(label);
    }

    exportArea.appendChild(wrapper);

    // html2canvas 実行（要素が DOM にある状態で）
    // scale:2 で解像度上げる
    html2canvas(wrapper, { scale: 2, useCORS: true }).then(canvas => {
      const link = document.createElement("a");
      link.download = "pg_live_selected.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    }).catch(err => {
      console.error("html2canvas error:", err);
      alert("画像エクスポート中にエラーが発生しました（コンソールを確認）");
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


// ===== ヘッダー画像に合わせて背景自動色調整 =====
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

  // 平均色
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









