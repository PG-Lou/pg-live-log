async function loadLiveData() {
  const response = await fetch('data/live.json');
  const data = await response.json();
  return data;
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

