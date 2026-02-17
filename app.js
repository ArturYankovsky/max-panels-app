async function loadProgram() {
  const res = await fetch("data/program.json");
  return await res.json();
}

function $(id) { return document.getElementById(id); }
function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

let MODE = localStorage.getItem("mode") || "parent"; // parent | teacher
let PROGRAM = null;
let CURRENT_SECTION = null;

function renderModeButtons() {
  const parentBtn = document.querySelector('[data-mode="parent"]');
  const teacherBtn = document.querySelector('[data-mode="teacher"]');
  if (!parentBtn || !teacherBtn) return;

  parentBtn.classList.toggle("active", MODE === "parent");
  teacherBtn.classList.toggle("active", MODE === "teacher");

  parentBtn.onclick = () => { MODE = "parent"; localStorage.setItem("mode", MODE); renderAll(); };
  teacherBtn.onclick = () => { MODE = "teacher"; localStorage.setItem("mode", MODE); renderAll(); };
}

function renderCatalog() {
  $("pageTitle").textContent = PROGRAM?.title || "Программа просвещения родителей";
  const root = $("catalog");
  root.innerHTML = "";

  const top = document.createElement("div");
  top.className = "card";
  top.innerHTML = `
    <div class="title">Выберите режим</div>
    <div class="tabs" style="margin-top:10px;">
      <button class="tab" data-mode="parent">Родителям</button>
      <button class="tab" data-mode="teacher">Педагогам</button>
    </div>
    <div style="margin-top:10px;">
      <a class="btn btn-primary" href="${PROGRAM.pdfUrl}" target="_blank" rel="noopener">Открыть программу (PDF)</a>
    </div>
  `;
  root.appendChild(top);

  const listTitle = document.createElement("div");
  listTitle.style.margin = "12px 2px";
  listTitle.style.fontWeight = "700";
  listTitle.textContent = "Разделы";
  root.appendChild(listTitle);

  (PROGRAM.sections || []).forEach(s => {
    const div = document.createElement("div");
    div.className = "card";
    const preview = (MODE === "parent" ? s.parent : s.teacher) || [];
    div.innerHTML = `
      <div class="title">${s.title}</div>
      <div class="short">${preview.slice(0,2).join(" ")}</div>
      <button class="btn btn-primary">Открыть</button>
    `;
    div.querySelector("button").onclick = () => openSection(s);
    root.appendChild(div);
  });

  renderModeButtons();
}

function openSection(section) {
  CURRENT_SECTION = section;

  hide($("catalog"));
  show($("panelView"));
  $("pageTitle").textContent = "Раздел программы";

  $("panelTitle").textContent = section.title;
  $("panelShort").textContent = (MODE === "parent")
    ? "Коротко и по делу — для родителей."
    : "Материалы и подходы — для педагогов.";

  // Вкладки: Содержание / PDF
  setActiveTab("content");

  const content = $("tab-content");
  const pdf = $("tab-pdf");

  const bullets = (MODE === "parent" ? section.parent : section.teacher) || [];
  content.innerHTML = `
    <div><b>Режим:</b> ${MODE === "parent" ? "Родителям" : "Педагогам"}</div>
    <div style="margin-top:10px;"><b>Ключевые пункты:</b></div>
    <ul>${bullets.map(x => `<li>${x}</li>`).join("")}</ul>
    <div style="margin-top:12px;">
      <button class="btn" id="modeSwitchBtn">Переключить режим</button>
    </div>
  `;

  content.querySelector("#modeSwitchBtn").onclick = () => {
    MODE = (MODE === "parent") ? "teacher" : "parent";
    localStorage.setItem("mode", MODE);
    openSection(CURRENT_SECTION);
  };

  pdf.innerHTML = `
    <div class="short">Полный текст — в PDF программе.</div>
    <a class="btn btn-primary" href="${PROGRAM.pdfUrl}" target="_blank" rel="noopener">Открыть PDF</a>
  `;

  // MAX back button
  if (window.WebApp && window.WebApp.BackButton) {
    window.WebApp.BackButton.show();
    window.WebApp.BackButton.onClick(closeSection);
  }
}

function closeSection() {
  show($("catalog"));
  hide($("panelView"));
  $("pageTitle").textContent = PROGRAM?.title || "Программа просвещения родителей";

  if (window.WebApp && window.WebApp.BackButton) {
    window.WebApp.BackButton.hide();
  }
}

function setActiveTab(name) {
  document.querySelectorAll(".tab2").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === name);
  });
  ["content","pdf"].forEach(t => {
    const el = $("tab-" + t);
    if (!el) return;
    if (t === name) show(el); else hide(el);
  });
}

function ensureTabHandlers() {
  document.querySelectorAll(".tab2").forEach(btn => {
    btn.onclick = () => setActiveTab(btn.dataset.tab);
  });
}

function renderAll() {
  if (!PROGRAM) return;
  renderCatalog();
  // если пользователь был внутри раздела — оставим как есть
}

async function main() {
  if (window.WebApp && window.WebApp.ready) window.WebApp.ready();

  PROGRAM = await loadProgram();

  // Подготовим вкладки во "внутреннем" экране
  ensureTabHandlers();

  $("backBtn").onclick = closeSection;

  renderAll();
}

main();
