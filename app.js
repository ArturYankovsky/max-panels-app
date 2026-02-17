async function loadData() {
  const res = await fetch("data/panels.json");
  return await res.json();
}

function $(id) { return document.getElementById(id); }

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function setActiveTab(name) {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === name);
  });
  ["photos","docs","method","video"].forEach(t => {
    const el = $("tab-" + t);
    if (!el) return;
    if (t === name) show(el); else hide(el);
  });
}

function renderCatalog(panels) {
  const root = $("catalog");
  root.innerHTML = "";

  panels.forEach(p => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div class="title">${p.title}</div>
      <div class="short">${p.short}</div>
      <button class="btn btn-primary">Открыть</button>
    `;
    div.querySelector("button").onclick = () => openPanel(p);
    root.appendChild(div);
  });
}

function renderPanel(p) {
  $("panelTitle").textContent = p.title;
  $("panelShort").textContent = p.short;

  // Фото
  const photos = $("tab-photos");
  photos.innerHTML = "";
  (p.photos || []).forEach(url => {
    const img = document.createElement("img");
    img.src = url;
    img.alt = p.title;
    img.style.marginBottom = "10px";
    photos.appendChild(img);
  });

  // Документы
  const docs = $("tab-docs");
  docs.innerHTML = "";
  (p.docs || []).forEach(d => {
    const a = document.createElement("a");
    a.className = "btn";
    a.href = d.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = d.title;
    a.style.marginRight = "8px";
    a.style.marginBottom = "8px";
    docs.appendChild(a);
  });

  // Методика
  const method = $("tab-method");
  method.innerHTML = "";
  if (p.method) {
    method.innerHTML = `
      <div><b>Возраст:</b> ${p.method.age}</div>
      <div><b>Длительность:</b> ${p.method.duration}</div>
      <div style="margin-top:8px;"><b>Цель:</b> ${p.method.goal}</div>
      <div style="margin-top:8px;"><b>Области:</b> ${p.method.areas}</div>
      <div style="margin-top:8px;"><b>Ход занятия:</b></div>
      <ul>${(p.method.steps || []).map(s => `<li>${s}</li>`).join("")}</ul>
    `;
  } else {
    method.textContent = "Методика пока не добавлена.";
  }

  // Видео
  const video = $("tab-video");
  video.innerHTML = "";
  if (p.video) {
    const a = document.createElement("a");
    a.className = "btn btn-primary";
    a.href = p.video;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Открыть видео (VK)";
    video.appendChild(a);
  } else {
    video.textContent = "Видео не добавлено.";
  }

  setActiveTab("photos");
}

function openPanel(p) {
  hide($("catalog"));
  show($("panelView"));
  $("pageTitle").textContent = "Карточка панели";
  renderPanel(p);

  // MAX: включаем кнопку назад (если доступно)
  if (window.WebApp && window.WebApp.BackButton) {
    window.WebApp.BackButton.show();
    window.WebApp.BackButton.onClick(closePanel);
  }
}

function closePanel() {
  show($("catalog"));
  hide($("panelView"));
  $("pageTitle").textContent = "Каталог панелей";

  if (window.WebApp && window.WebApp.BackButton) {
    window.WebApp.BackButton.hide();
  }
}

async function main() {
  // MAX: сообщаем что загрузились
  if (window.WebApp && window.WebApp.ready) window.WebApp.ready();

  const data = await loadData();
  renderCatalog(data.panels || []);

  $("backBtn").onclick = closePanel;

  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => setActiveTab(btn.dataset.tab);
  });
}

main();
