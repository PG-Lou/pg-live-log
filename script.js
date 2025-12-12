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

      // ===== ★ここが修正点 =====
      let strong;
      let light;

      if (live.color && live.color.startsWith("radial-gradient")) {
        // グラデーションの場合はそのまま使う
        strong = live.color;
        light = live.color;
      } else if (live.color) {
        // 単色HEXの場合
        strong = `${live.color}cc`;
        light  = `${live.color}55`;
      } else {
        strong = '#999';
        light  = '#ccc';
      }

      details.style.setProperty('--tour-strong', strong);
      details.style.setProperty('--tour-light', light);
      // =======================

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

  // ===== ボタンON/OFF =====
  const bgSelect = document.getElementById("bg-select");
  const exportBtn = document.getElementById("export-btn");
  exportBtn.disabled = !bgSelect.value;

  bgSelect.addEventListener("change", () => {
    exportBtn.disabled = !bgSelect.value;
  });

  // ===== 画像出力 =====
  async function exportImage() {
    try {
      const checked = document.querySelectorAll('.tour-content input[type="checkbox"]:checked');
      if (checked.length === 0) {
        alert("チェックされた公演がありません");
        return;
      }

      const bgStyle = bgSelect.value || "";
      const selectedName = bgSelect.selectedOptions?.[0]?.textContent.trim() || "";

      const WIDTH = 390;
      const HEIGHT = 844;

      const exportArea = document.getElementById("export-area");
      exportArea.innerHTML = "";

      const wrapper = document.createElement("div");
      wrapper.style.width = WIDTH + "px";
      wrapper.style.height = HEIGHT + "px";
      wrapper.style.background = bgStyle || "#fff";
      wrapper.style.backgroundSize = "cover";
      wrapper.style.backgroundPosition = "center";
      wrapper.style.position = "relative";
      wrapper.style.fontFamily = "Helvetica, Arial, sans-serif";
      wrapper.style.overflow = "hidden";

      const card = document.createElement("div");
      card.style.width = (WIDTH - 40) + "px";
      card.style.height = (HEIGHT - 80) + "px";
      card.style.position = "absolute";
      card.style.left = "20px";
      card.style.top = "40px";
      card.style.background = "rgba(255,255,255,0.7)";
      card.style.borderRadius = "18px";
      card.style.padding = "20px";
      card.style.boxSizing = "border-box";
      card.style.overflowY = "auto";

      wrapper.appendChild(card);

      let userName = document.getElementById("user-name")?.value.trim() || "";
      let userX = document.getElementById("user-x")?.value.trim() || "";
      if (userX && !userX.startsWith("@")) userX = "@" + userX;

      if (userName || userX) {
        const userLine = document.createElement("div");
        userLine.style.fontSize = "18px";
        userLine.style.fontWeight = "600";
        userLine.style.marginBottom = "14px";
        userLine.textContent = userName + (userX ? " " + userX : "");
        card.appendChild(userLine);
      }

      let currentTour = "";
      checked.forEach(cb => {
        const data = JSON.parse(cb.dataset.show);
        if (data.live !== currentTour) {
          currentTour = data.live;
          const h = document.createElement("div");
          h.textContent = "■ " + currentTour;
          h.style.fontWeight = "700";
          h.style.marginTop = "10px";
          card.appendChild(h);
        }

        const s = data.show;
        const time = s.time === "AM" ? " 昼" : s.time === "PM" ? " 夜" : "";
        const line = document.createElement("div");
        line.textContent = `${s.date.replace(/-/g, "/")}${time} ${s.prefecture} ${s.venue}`;
        card.appendChild(line);
      });

      if (selectedName) {
        const label = document.createElement("div");
        label.textContent = "カラーイメージ：" + selectedName;
        label.style.position = "absolute";
        label.style.right = "10px";
        label.style.bottom = "10px";
        label.style.fontSize = "12px";
        label.style.color = "#fff";
        wrapper.appendChild(label);
      }

      exportArea.appendChild(wrapper);

      html2canvas(wrapper, { scale: 2, useCORS: true }).then(canvas => {
        canvas.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          window.location.href = url;
        });
      });

    } catch (e) {
      console.error(e);
      alert("エクスポート処理でエラーが発生しました");
    }
  }

  document.getElementById('export-btn').addEventListener('click', exportImage);
  loadLiveData().then(renderList);
});
