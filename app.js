"use strict";

// Static guide. No accounts, personal data or server-side storage.
const SOURCE_PDF = "https://irzar.ru/wp-content/uploads/2024/12/programma-prosveshheniya-roditelej.pdf";
const APP = document.getElementById("app");
const launchFromTelegram = /(?:^|[&#])tgWebApp(?:Data|Version|Platform|StartParam)=/.test(location.hash);
const store = {
  get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* Optional storage. */ } }
};
const requestedMode = new URLSearchParams(location.search).get("mode");
const state = { mode: requestedMode === "teacher" || (requestedMode !== "parent" && store.get("mode") === "teacher") ? "teacher" : "parent", program: null, family: null,
  loading: true, age: "all", goal: "all", group: "all", search: "" };
let bridge = null;
let bridgeRegistered = false;
let loadNumber = 0;
let historyIndex = 0;
try { history.replaceState({ navigatorIndex: 0 }, ""); } catch (_) { /* Hash links still work. */ }
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = String(text);
  return el;
}
function add(parent, ...children) { children.filter(Boolean).forEach(child => parent.append(child)); return parent; }
function safeUrl(value) {
  if (typeof value !== "string") return "#guide";
  if (value.startsWith("#") || /^(?:assets|data)\/[\w./-]+$/.test(value)) return value;
  try { const url = new URL(value, location.href); return /^(https?:)$/.test(url.protocol) ? url.href : "#guide"; }
  catch (_) { return "#guide"; }
}
function link(label, href, className = "text-link") {
  const el = node("a", className, label); el.href = safeUrl(href);
  if (/^https?:/i.test(el.getAttribute("href"))) { el.target = "_blank"; el.rel = "noopener noreferrer"; }
  return el;
}
function button(label, handler, className = "button") {
  const el = node("button", className, label); el.type = "button"; el.addEventListener("click", handler); return el;
}
function list(items, ordered = false) {
  const el = node(ordered ? "ol" : "ul", ordered ? "steps" : "plain-list");
  (Array.isArray(items) ? items : []).forEach(item => el.append(node("li", "", item))); return el;
}
function route() {
  try {
    const raw = location.hash.slice(1);
    if (/(?:^|&)(?:tgWebApp|WebApp|maxWebApp)(?:Data|Version|Platform|StartParam)=/i.test(raw)) return { view: "home", id: "" };
    const parts = (raw || "home").split("?")[0].split("/").map(decodeURIComponent);
    return { view: parts[0], id: parts[1] || "" };
  }
  catch (_) { return { view: "home", id: "" }; }
}
function go(view) { location.hash = view; }
function back() {
  if (historyIndex > 0) { history.back(); return; }
  const view = route().view;
  go(view === "scenario" ? "situations" : view === "game" ? "games" : view === "section" ? "guide" : "home");
}
function setupBridge() {
  if (!bridge) {
    const telegram = window.Telegram && window.Telegram.WebApp;
    bridge = launchFromTelegram ? telegram : telegram && telegram.initData ? telegram : window.WebApp || telegram;
  }
  if (!bridge) return;
  if (!bridgeRegistered) {
    try { if (typeof bridge.ready === "function") bridge.ready(); } catch (_) { /* Browser fallback. */ }
    try { if (bridge.BackButton && typeof bridge.BackButton.onClick === "function") { bridge.BackButton.onClick(back); bridgeRegistered = true; } } catch (_) { /* Visible navigation stays available. */ }
  }
  updateBridge();
}
function updateBridge() {
  if (!bridge || !bridge.BackButton) return;
  const method = route().view === "home" ? "hide" : "show";
  try { if (typeof bridge.BackButton[method] === "function") bridge.BackButton[method](); } catch (_) { /* Optional SDK. */ }
}
function heading(kicker, title, description) {
  const el = add(node("header", "page-heading"), node("p", "eyebrow", kicker), node("h1", "", title));
  if (description) el.append(node("p", "lead", description)); return el;
}
function backLink(label, target) { return link("← " + label, "#" + target, "back-link"); }
function pdfLink(label = "Открыть программу · PDF ↗") { return link(label, state.program && state.program.pdfUrl || SOURCE_PDF, "button button-outline"); }
function teacherNote(text = "Для беседы с семьёй: предложите выбрать один посильный шаг. На следующей встрече обсудите, что получилось, без оценок и сравнения детей.") {
  return add(node("aside", "teacher-note"), node("span", "eyebrow", "Педагогу на заметку"), node("p", "", text));
}
function errorPanel(kind) {
  const box = node("div", "notice error-notice"); box.setAttribute("role", "alert");
  add(box, node("h2", "", "Материалы пока не загрузились"), node("p", "", "Проверьте соединение и попробуйте ещё раз. Остальные разделы остаются доступны."), button("Попробовать ещё раз", loadData, "button button-primary"));
  if (kind === "program") box.append(link("Открыть первоисточник в PDF ↗", SOURCE_PDF)); return box;
}
function scenarioEntries() { return Object.entries(state.family && state.family.scenarios || {}); }
function gameEntries() { return Object.entries(state.family && state.family.games || {}); }
function scenarioCard(id, item, index) {
  const card = link("", "#scenario/" + encodeURIComponent(id), "scenario-card");
  const group = (state.family.groups || {})[item.group];
  return add(card, node("div", "card-top", group && group.title || "Семейная ситуация"), node("h3", "", item.title), node("p", "", item.intro),
    add(node("div", "card-bottom"), node("span", "card-number", String(index + 1).padStart(2, "0")), node("span", "card-arrow", "↗")));
}
function renderHome() {
  const view = add(node("div", "home-view"), heading("ПОДДЕРЖКА НА КАЖДЫЙ ДЕНЬ", state.mode === "parent" ? "Рядом с ребёнком." : "В диалоге с семьёй.", state.mode === "parent" ?
    "Для семей с детьми 2–7 лет. Понятные шаги для непростых моментов. Немного игры, больше контакта — без гонки за идеальным родительством." : "Ситуации и игры для семей с детьми 2–7 лет, идеи для разговора с родителями и ориентиры программы."),
    add(node("div", "intro-strip"), node("span", "intro-symbol", "01 /"), node("p", "", "Выберите знакомую ситуацию. Попробуйте один шаг сегодня — этого достаточно для начала.")),
    add(node("div", "section-heading"), add(node("div"), node("h2", "", "С чего начнём?"), node("p", "muted", "Идеи для вашего следующего шага."))));
  if (!state.family) view.append(errorPanel("family"));
  else {
    const cards = node("div", "scenario-grid");
    scenarioEntries().slice(0, 6).forEach(([id, item], index) => cards.append(scenarioCard(id, item, index))); view.append(cards);
    const feature = node("section", "game-feature");
    add(feature, add(node("div"), node("p", "eyebrow", "НЕБОЛЬШОЙ СЕМЕЙНЫЙ РИТУАЛ"), node("h2", "", "5 минут вместе"), node("p", "", "Поговорить, подвигаться или спокойно побыть рядом. Выберите возраст и настроение — найдём игру без сложной подготовки."), link("Подобрать игру →", "#games", "button button-primary")));
    const mark = add(node("div", "play-mark"), node("span", "play-circle", "5"), node("span", "play-caption", "минут\nдруг для друга")); mark.setAttribute("aria-hidden", "true"); add(feature, mark); view.append(feature);
  }
  add(view, add(node("section", "guide-feature"), node("p", "eyebrow", "ОСНОВА И ОРИЕНТИРЫ"), node("h2", "", "Просвещение родителей — простыми словами"), node("p", "", "Тематический путеводитель для семьи и педагога. Отдельно — полный текст программы, чтобы обратиться к первоисточнику."),
    add(node("div", "button-row"), link("Открыть путеводитель →", "#guide", "button button-primary"), pdfLink()))); return view;
}
function searchControl(label, placeholder, onChange) {
  const input = node("input", "search-input"); input.type = "search"; input.id = "material-search"; input.value = state.search; input.placeholder = placeholder; input.autocomplete = "off";
  input.addEventListener("input", () => { state.search = input.value; onChange(); });
  const labelEl = node("label", "field-label", label); labelEl.htmlFor = input.id; return add(node("div", "search-control"), labelEl, input);
}
function chips(label, entries, selected, onChange) {
  const wrap = add(node("fieldset", "filter-group"), node("legend", "field-label", label)); const row = node("div", "chip-row");
  Object.entries(entries).forEach(([value, text]) => {
    const el = button(text, () => {
      const keyboard = document.activeElement === el;
      onChange(value);
      if (keyboard) {
        const replacement = Array.from(APP.querySelectorAll(".chip")).find(chip => chip.dataset.filterLabel === label && chip.dataset.filterValue === value);
        if (replacement) replacement.focus({ preventScroll: true });
      }
    }, "chip" + (value === selected ? " active" : ""));
    el.dataset.filterLabel = label; el.dataset.filterValue = value;
    el.setAttribute("aria-pressed", String(value === selected)); row.append(el);
  });
  return add(wrap, row);
}
function emptyState(reset) { return add(node("div", "empty-state"), node("h2", "", "Пока ничего не нашлось"), node("p", "", "Попробуйте другое слово или уберите часть фильтров."), button("Сбросить поиск и фильтры", reset, "button button-outline")); }
function renderSituations() {
  const view = add(node("div"), heading("ОТ ЗНАКОМОЙ СИТУАЦИИ — К ДЕЙСТВИЮ", "Что происходит дома?", "Выберите тему или найдите нужную карточку по слову."));
  if (!state.family) return add(view, errorPanel("family"));
  const results = node("div"); const count = node("p", "result-count"); count.setAttribute("role", "status");
  const groups = { all: "Все ситуации" }; Object.entries(state.family.groups || {}).forEach(([id, group]) => { groups[id] = group.title; });
  const refresh = () => {
    results.replaceChildren(); const q = state.search.trim().toLocaleLowerCase("ru");
    const matches = scenarioEntries().filter(([, item]) => (state.group === "all" || item.group === state.group) && (!q || [item.title, item.intro, ...(item.steps || []), ...(item.phrases || [])].join(" ").toLocaleLowerCase("ru").includes(q)));
    count.textContent = "Найдено ситуаций: " + matches.length;
    if (!matches.length) results.append(emptyState(() => { state.search = ""; state.group = "all"; render(); }));
    else { const grid = node("div", "scenario-grid"); matches.forEach(([id, item], index) => grid.append(scenarioCard(id, item, index))); results.append(grid); }
  };
  add(view, add(node("div", "filter-panel"), searchControl("Поиск по ситуациям", "Например: одеваться, ждать, не получается", refresh), chips("Тема", groups, state.group, value => { state.group = value; render(); })), count, results); refresh(); return view;
}
function ageNote(item) {
  const rows = Object.entries(item.age_notes || {}).filter(([, value]) => value); if (!rows.length) return null;
  const box = add(node("section", "age-notes"), node("h2", "", "С учётом возраста"));
  rows.forEach(([id, text]) => add(box, add(node("div", "age-note"), node("h3", "", state.family.ages[id] || id), node("p", "", text)))); return box;
}
function sourceNote(item) {
  const box = add(node("aside", "source-note"), node("h2", "", "Как это связано с программой"));
  const sections = (item.source_sections || []).map(id => (state.family.programSections || {})[id] || id);
  return add(box, node("p", "", sections.length ? sections.join(" · ") : "Игра, общение и поддержка семьи в воспитании ребёнка."), node("p", "muted", "Карточка подготовлена редакцией навигатора. Это практическое дополнение, а не дословный текст или официальное приложение к программе."), link("Первоисточник программы · PDF ↗", state.family.programUrl || SOURCE_PDF));
}
function missingView() { return add(node("div", "empty-state"), node("h1", "", "Такой карточки нет"), node("p", "", "Возможно, ссылка изменилась. Нужный материал можно выбрать в каталоге."), link("На главную", "#home", "button button-primary")); }
function renderScenario(id) {
  if (!state.family) return errorPanel("family"); const item = Object.hasOwn(state.family.scenarios, id) ? state.family.scenarios[id] : null; if (!item) return missingView();
  const group = (state.family.groups || {})[item.group];
  const view = add(node("article", "reading-view"), backLink("К ситуациям", "situations"), heading(group && group.title || "СЕМЕЙНАЯ СИТУАЦИЯ", item.title, item.intro), add(node("section", "reading-block"), node("h2", "", "Что можно попробовать"), list(item.steps, true)));
  if (item.phrases && item.phrases.length) { const box = add(node("section", "phrases-block"), node("h2", "", "Слова, на которые можно опереться")); item.phrases.forEach(text => box.append(node("blockquote", "", text))); view.append(box); }
  if (item.game) add(view, add(node("section", "small-game"), node("p", "eyebrow", "ПОПРОБУЙТЕ ВМЕСТЕ"), node("h2", "", "Маленькая игра"), node("p", "", item.game)));
  add(view, ageNote(item));
  if (item.support) add(view, add(node("aside", "support-note"), node("h2", "", "Когда стоит обратиться за поддержкой"), node("p", "", item.support)));
  if (state.mode === "teacher") view.append(teacherNote());
  return add(view, sourceNote(item), link("Выбрать игру для семьи →", "#games", "button button-primary"));
}
function gameCard(id, item) {
  const ages = (item.ages || []).map(age => state.family.ages[age] || age).join(" · ");
  return add(link("", "#game/" + encodeURIComponent(id), "game-card"), node("p", "eyebrow", state.family.goals[item.goal] || "Игра вместе"), node("h2", "", item.title), node("p", "game-meta", item.duration || "5 минут"), node("p", "muted", ages), node("span", "text-link", "Как играть →"));
}
function renderGames() {
  const view = add(node("div"), heading("ИГРОТЕКА ДЛЯ СЕМЬИ", "5 минут вместе", "Возраст — ориентир, а не проверка навыков. Выбирайте посильное, меняйте правила и останавливайтесь, если ребёнок устал."));
  if (!state.family) return add(view, errorPanel("family"));
  const results = node("div"); const count = node("p", "result-count"); count.setAttribute("role", "status");
  const refresh = () => {
    const q = state.search.trim().toLocaleLowerCase("ru"); const matches = gameEntries().filter(([, item]) => (state.age === "all" || (item.ages || []).includes(state.age)) && (state.goal === "all" || item.goal === state.goal) && (!q || [item.title, item.materials, ...(item.steps || [])].join(" ").toLocaleLowerCase("ru").includes(q)));
    count.textContent = "Подходит игр: " + matches.length; results.replaceChildren();
    if (!matches.length) results.append(emptyState(() => { state.search = ""; state.age = "all"; state.goal = "all"; render(); }));
    else { const grid = node("div", "games-grid"); matches.forEach(([id, item]) => grid.append(gameCard(id, item))); results.append(grid); }
  };
  add(view, add(node("div", "filter-panel"), chips("Возраст ребёнка", { all: "Любой возраст", ...state.family.ages }, state.age, value => { state.age = value; render(); }), chips("Для чего играем?", { all: "Любая задача", ...state.family.goals }, state.goal, value => { state.goal = value; render(); }), searchControl("Найти игру", "Название, предмет или действие", refresh)), count, results); refresh(); return view;
}
function renderGame(id) {
  if (!state.family) return errorPanel("family"); const item = Object.hasOwn(state.family.games, id) ? state.family.games[id] : null; if (!item) return missingView();
  const view = add(node("article", "reading-view"), backLink("В игротеку", "games"), heading(state.family.goals[item.goal] || "Игра вместе", item.title, "Время вместе важнее правильного результата."),
    add(node("div", "game-details"), add(node("div"), node("span", "eyebrow", "ВРЕМЯ"), node("p", "", item.duration || "5 минут")), add(node("div"), node("span", "eyebrow", "ПОНАДОБИТСЯ"), node("p", "", item.materials || "Только ваше внимание"))), add(node("section", "reading-block"), node("h2", "", "Как играть"), list(item.steps, true)));
  if (item.question) add(view, add(node("section", "phrases-block"), node("h2", "", "Вопрос для разговора"), node("blockquote", "", item.question)));
  add(view, ageNote(item)); if (state.mode === "teacher") view.append(teacherNote("Предложите семье одну игру с учётом возраста и её запроса. Не превращайте совместную игру в домашнее задание с обязательным отчётом."));
  return add(view, sourceNote(item), backLink("Подобрать другую игру", "games"));
}
function renderGuide() {
  const view = add(node("div"), heading("ПРОСВЕЩЕНИЕ РОДИТЕЛЕЙ", "Тематический путеводитель", "Как поддерживать ребёнка и сотрудничать с детским садом: восемь удобных входов в большую тему."), add(node("section", "source-banner"), node("p", "eyebrow", "ПЕРВОИСТОЧНИК"), node("h2", "", "Программа просвещения родителей"), node("p", "", "ИРЗАР, 2024 · 225 страниц"), pdfLink(), node("p", "source-caption", "Открывается на сайте института. Большой PDF-файл может загружаться дольше обычной страницы.")));
  if (!state.program) return add(view, errorPanel("program"));
  add(view, add(node("aside", "editorial-note"), node("h2", "", "Что важно знать"), node("p", "", state.program.editorialNotice || "Восемь тем ниже — редакционная группировка навигатора, а не официальное оглавление программы. Карточки и игры — наши практические дополнения; они не выдаются за официально одобренное приложение.")));
  const grid = node("div", "guide-grid");
  state.program.sections.forEach((section, index) => { const preview = state.mode === "parent" ? section.parent : section.teacher;
    grid.append(add(link("", "#section/" + encodeURIComponent(section.id), "guide-card"), node("span", "guide-number", String(index + 1).padStart(2, "0")), node("h2", "", section.title), node("p", "", section.summary || (preview || [])[0] || ""), node("span", "text-link", "Разобраться →"))); });
  view.append(grid); if (state.mode === "teacher") view.append(teacherNote("Путеводитель помогает выбрать тему разговора. Содержание и план просвещения для своей организации сверяйте с первоисточником и реальными запросами семей.")); return view;
}
function renderSection(id) {
  if (!state.program) return errorPanel("program"); const section = state.program.sections.find(item => item.id === id); if (!section) return missingView();
  const view = add(node("article", "reading-view"), backLink("К путеводителю", "guide"), heading("ТЕМА ПУТЕВОДИТЕЛЯ", section.title, section.summary), add(node("section", "reading-block"), node("h2", "", state.mode === "parent" ? "Коротко о главном" : "Ориентиры для работы с семьёй"), list(state.mode === "parent" ? section.parent : section.teacher)));
  if (state.mode === "teacher") view.append(teacherNote(section.teacherAction));
  else if (section.familyAction) add(view, add(node("aside", "small-game"), node("p", "eyebrow", "ОДИН ШАГ НА СЕГОДНЯ"), node("p", "", section.familyAction)));
  const refs = (section.officialRefs || []).map(ref => ref.label).join(" · ");
  add(view, add(node("aside", "source-note"), node("h2", "", "Не заменяет первоисточник"), node("p", "", "Это краткий редакционный ориентир, а не полный текст раздела программы. Нумерация карточек относится только к этому путеводителю."), refs ? node("p", "", refs) : null,
    link("Открыть в программе · PDF ↗", (state.program.pdfUrl || SOURCE_PDF) + (section.sourcePage ? "#page=" + section.sourcePage : ""), "button button-outline")));
  return add(view, link("Перейти к жизненным ситуациям →", "#situations", "button button-primary"));
}
function render() {
  document.querySelectorAll("[data-mode]").forEach(el => { const active = el.dataset.mode === state.mode; el.classList.toggle("active", active); el.setAttribute("aria-pressed", String(active)); });
  const current = route(); const navView = current.view === "scenario" ? "situations" : current.view === "game" ? "games" : current.view === "section" ? "guide" : current.view;
  document.querySelectorAll("[data-nav]").forEach(el => { if (el.dataset.nav === navView) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current"); });
  APP.setAttribute("aria-busy", String(state.loading));
  if (state.loading) { const loading = node("div", "loading-state", "Готовим материалы…"); loading.setAttribute("role", "status"); APP.replaceChildren(loading); return; }
  const views = { home: renderHome, situations: renderSituations, games: renderGames, guide: renderGuide };
  let content;
  if (current.view === "scenario") content = renderScenario(current.id); else if (current.view === "game") content = renderGame(current.id); else if (current.view === "section") content = renderSection(current.id); else content = Object.hasOwn(views, current.view) ? views[current.view]() : missingView();
  APP.replaceChildren(content); const title = APP.querySelector("h1"); document.title = (title ? title.textContent + " · " : "") + "Родительский навигатор"; updateBridge();
}
async function getJSON(path) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
  try { const response = await fetch(path + "?v=20261021", { signal: controller.signal, cache: "no-cache" }); if (!response.ok) throw new Error("HTTP " + response.status); return await response.json(); } finally { clearTimeout(timeout); }
}
async function loadData() {
  const number = ++loadNumber; state.loading = true; render();
  const result = await Promise.allSettled([getJSON("data/program.json"), getJSON("data/family.json")]);
  if (number !== loadNumber) return;
  state.program = result[0].status === "fulfilled" && result[0].value && Array.isArray(result[0].value.sections) ? result[0].value : null;
  const family = result[1].status === "fulfilled" ? result[1].value : null;
  state.family = family && family.scenarios && family.games && family.ages && family.goals ? family : null;
  state.loading = false; render();
}
document.querySelectorAll("[data-mode]").forEach(el => el.addEventListener("click", () => { state.mode = el.dataset.mode === "teacher" ? "teacher" : "parent"; store.set("mode", state.mode); render(); }));
document.querySelector(".skip-link").addEventListener("click", event => { event.preventDefault(); document.getElementById("main").focus(); });
window.addEventListener("hashchange", () => {
  if (history.state && Number.isInteger(history.state.navigatorIndex)) historyIndex = history.state.navigatorIndex;
  else { historyIndex += 1; try { history.replaceState({ navigatorIndex: historyIndex }, ""); } catch (_) { /* Optional history metadata. */ } }
  state.search = ""; render(); window.scrollTo(0, 0); document.getElementById("main").focus({ preventScroll: true });
});
window.addEventListener("load", setupBridge, { once: true });
const sdkScript = document.querySelector('script[src*="max-web-app"]'); if (sdkScript) sdkScript.addEventListener("load", setupBridge, { once: true });
if (launchFromTelegram && !(window.Telegram && window.Telegram.WebApp)) {
  const telegramSDK = document.createElement("script");
  telegramSDK.src = "https://telegram.org/js/telegram-web-app.js";
  telegramSDK.async = true;
  telegramSDK.addEventListener("load", setupBridge, { once: true });
  document.head.append(telegramSDK);
}
setupBridge(); loadData();
