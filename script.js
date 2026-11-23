
const $ = id => document.getElementById(id);

const STORAGE_KEY = "estudaMais_v1";
const ACCESS_KEY = "estudaMais_accessibility_v1";

const palette = ["#326bc0", "#2e987a", "#8166c5", "#d96e9b", "#d69a36", "#4c9eaa"];
const defaults = ["Matemática", "Geografia", "História", "Biologia", "Física", "Química", "Português"];

let highlightMarks = [];
let db = loadDB();
let currentSubject = db.currentSubject || "Matemática";
let editingFlash = null;

let timerRemaining = 1500;
let timerInterval = null;
let calcExpression = "";
let mapConnectFrom = null;

function blankSubject() {
  return {
    texts: [],
    topics: [],
    ideas: [],
    mapTopic: "",
    flashcards: [],
    highlight: "",
    mapConnections: []
  };
}

function loadDB() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
      subjects: {},
      currentSubject: "Matemática",
      tasks: []
    };
  } catch {
    return { subjects: {}, currentSubject: "Matemática", tasks: [] };
  }
}

function ensureSubject(name) {
  if (!db.subjects[name]) db.subjects[name] = blankSubject();

  // Mantém compatibilidade com matérias criadas em versões anteriores.
  const subject = db.subjects[name];
  subject.texts ||= [];
  subject.topics ||= [];
  subject.ideas ||= [];
  subject.flashcards ||= [];
  subject.mapConnections ||= [];

  return subject;
}

function data() {
  return ensureSubject(currentSubject);
}

function save() {
  db.currentSubject = currentSubject;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  $("saveStatus").textContent = "Salvo neste dispositivo";
}

function toast(message) {
  const t = $("toast");
  t.textContent = message;
  t.classList.add("show");

  setTimeout(() => t.classList.remove("show"), 2200);
}

function safeText(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

/* MATÉRIAS */

function renderSubjects() {
  const nav = $("subjectNav");
  nav.replaceChildren();

  Object.keys(db.subjects).forEach((name, i) => {
    const b = document.createElement("button");

    b.className = "subject-link" + (name === currentSubject ? " active" : "");
    b.innerHTML = `
      <span class="subject-dot" style="--subject-color:${palette[i % palette.length]}"></span>
      ${safeText(name)}
    `;

    b.onclick = () => {
      currentSubject = name;
      editingFlash = null;
      save();
      renderAll();
    };

    nav.append(b);
  });

  $("subjectTitle").textContent = currentSubject;
}

function switchTab(tab) {
  document.querySelectorAll(".tab").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });

  document.querySelectorAll(".tab-panel").forEach(p => {
    p.classList.toggle("active", p.id === `panel-${tab}`);
  });
}

document.querySelectorAll(".tab").forEach(b => {
  b.addEventListener("click", () => switchTab(b.dataset.tab));
});

$("subjectForm").addEventListener("submit", e => {
  e.preventDefault();

  const name = $("newSubject").value.trim();

  if (!name) return;

  if (db.subjects[name]) {
    toast("Essa matéria já existe.");
    return;
  }

  db.subjects[name] = blankSubject();
  currentSubject = name;
  $("newSubject").value = "";

  save();
  renderAll();
  toast("Matéria adicionada!");
});

/* TEXTOS */

$("textForm").addEventListener("submit", e => {
  e.preventDefault();

  data().texts.unshift({
    id: crypto.randomUUID(),
    title: $("textTitle").value.trim(),
    body: $("textBody").value.trim()
  });

  $("textForm").reset();

  save();
  renderTexts();
  toast("Texto salvo na matéria!");
});

function renderTexts() {
  const root = $("textList");
  root.replaceChildren();

  if (!data().texts.length) {
    root.innerHTML = '<p class="muted">Ainda não há textos nesta matéria.</p>';
    return;
  }

  data().texts.forEach(t => {
    const el = document.createElement("article");
    el.className = "item-card";

    el.innerHTML = `
      <h3>${safeText(t.title)}</h3>
      <p>${safeText(t.body)}</p>
      <div class="item-actions">
        <button class="small-btn" data-action="open">Abrir no marca-texto</button>
        <button class="small-btn danger" data-action="delete">Apagar</button>
      </div>
    `;

    el.querySelector('[data-action="open"]').onclick = () => {
      $("highlightEditor").value = t.body;
      $("highlightPreview").textContent = t.body;
      switchTab("materiais");
      $("highlightEditor").scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    };

    el.querySelector('[data-action="delete"]').onclick = () => {
      if (confirm("Apagar este texto?")) {
        data().texts = data().texts.filter(x => x.id !== t.id);
        save();
        renderTexts();
      }
    };

    root.append(el);
  });
}

/* MARCA-TEXTO */

const editor = $("highlightEditor");

function showHighlight() {
  const preview = $("highlightPreview");
  const value = editor.value;

  if (!value) {
    preview.textContent = "Seu texto destacado aparecerá aqui.";
    return;
  }

  const marks = highlightMarks
    .filter(m => m.start >= 0 && m.end <= value.length && m.end > m.start)
    .sort((a, b) => a.start - b.start);

  let cursor = 0;
  let html = "";

  marks.forEach(m => {
    if (m.start < cursor) return;

    html += safeText(value.slice(cursor, m.start));

    html += `
      <mark style="background:${m.color};padding:2px 0;border-radius:3px">
        ${safeText(value.slice(m.start, m.end))}
      </mark>
    `;

    cursor = m.end;
  });

  html += safeText(value.slice(cursor));
  preview.innerHTML = html;
}

editor.addEventListener("input", () => {
  highlightMarks = [];
  showHighlight();
});

document.querySelectorAll("[data-color]").forEach(b => {
  b.addEventListener("click", () => {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    if (start === end) {
      toast("Selecione primeiro o trecho que deseja destacar.");
      editor.focus();
      return;
    }

    highlightMarks.push({
      start,
      end,
      color: b.dataset.color
    });

    showHighlight();
    toast("Trecho destacado na prévia!");
  });
});

$("clearHighlight").onclick = () => {
  highlightMarks = [];
  showHighlight();
};

$("saveHighlight").onclick = () => {
  data().highlight = editor.value;
  data().highlightMarks = highlightMarks;

  save();
  toast("Texto destacado salvo nesta matéria!");
};

/* RESUMOS */

$("generateTopics").onclick = () => {
  const source = $("summarySource").value.trim();

  if (!source) {
    toast("Cole um texto para organizar.");
    return;
  }

  const sentences = source
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 12);

  const unique = [...new Set(sentences)].slice(0, 15);

  data().topics = unique.map(text => ({
    id: crypto.randomUUID(),
    text
  }));

  save();
  renderTopics();
  toast("Tópicos organizados! Você pode editar cada um.");
};

$("clearTopics").onclick = () => {
  if (!data().topics.length) return;

  if (confirm("Apagar todos os tópicos desta matéria?")) {
    data().topics = [];
    save();
    renderTopics();
  }
};

$("topicForm").onsubmit = e => {
  e.preventDefault();

  const text = $("newTopic").value.trim();

  if (!text) return;

  data().topics.push({
    id: crypto.randomUUID(),
    text
  });

  $("newTopic").value = "";

  save();
  renderTopics();
};

function renderTopics() {
  const root = $("topicList");
  root.replaceChildren();

  data().topics.forEach(t => {
    const row = document.createElement("div");
    row.className = "topic-item";

    row.innerHTML = `
      <span class="topic-bullet">✦</span>
      <input aria-label="Editar tópico" value="${safeText(t.text)}">
      <button class="small-btn danger">Apagar</button>
    `;

    const input = row.querySelector("input");

    input.onchange = () => {
      t.text = input.value.trim();
      save();
    };

    row.querySelector("button").onclick = () => {
      data().topics = data().topics.filter(x => x.id !== t.id);
      save();
      renderTopics();
    };

    root.append(row);
  });
}

/* MAPA MENTAL */

$("mapTopic").addEventListener("input", () => {
  data().mapTopic = $("mapTopic").value;
  $("centralNode").textContent = data().mapTopic || "Seu tema central";
  save();
});

$("addIdea").onclick = () => {
  const value = $("mapIdea").value.trim();

  if (!value) {
    $("mapIdea").focus();
    return;
  }

  data().ideas.push({
    id: crypto.randomUUID(),
    text: value
  });

  $("mapIdea").value = "";

  save();
  renderMap();
};

$("mapIdea").onkeydown = e => {
  if (e.key === "Enter") {
    e.preventDefault();
    $("addIdea").click();
  }
};

$("clearIdeas").onclick = () => {
  if (data().ideas.length && confirm("Limpar as ideias deste mapa?")) {
    data().ideas = [];
    data().mapConnections = [];
    save();
    renderMap();
  }
};

function renderMap() {
  $("mapTopic").value = data().mapTopic || "";
  $("centralNode").textContent = data().mapTopic || "Seu tema central";

  const root = $("ideaList");
  root.replaceChildren();

  data().ideas.forEach((idea, index) => {
    if (!idea.position) {
      idea.position = {
        x: 12 + (index % 3) * 29,
        y: 12 + Math.floor(index / 3) * 26
      };
    }

    const node = document.createElement("div");
    node.className = "idea-node";
    node.dataset.id = idea.id;

    node.style.left = idea.position.x + "%";
    node.style.top = idea.position.y + "%";

    node.innerHTML = `
      <span class="idea-text">${safeText(idea.text)}</span>
      <button class="small-btn connect-btn" type="button">Conectar</button>
      <button class="small-btn" type="button" aria-label="Apagar ideia">×</button>
    `;

    node.querySelector(".connect-btn").onclick = () => {
      selectMapConnection(idea.id, node);
    };

    node.querySelector('[aria-label="Apagar ideia"]').onclick = () => {
      data().ideas = data().ideas.filter(x => x.id !== idea.id);

      data().mapConnections = (data().mapConnections || []).filter(c =>
        c.from !== idea.id && c.to !== idea.id
      );

      save();
      renderMap();
    };

    makeDraggable(node, idea);
    root.append(node);
  });

  const center = $("centralNode");

  center.onclick = () => selectMapConnection("center", center);
  center.title = "Clique para selecionar como ponto de conexão";

  drawMapLines();
}

function selectMapConnection(id, el) {
  if (mapConnectFrom === null) {
    mapConnectFrom = id;

    document.querySelectorAll(".idea-node, .central-node").forEach(n => {
      n.classList.remove("selected-connect");
    });

    el.classList.add("selected-connect");
    toast("Agora escolha o segundo tópico para conectar.");
    return;
  }

  if (mapConnectFrom === id) {
    mapConnectFrom = null;
    el.classList.remove("selected-connect");
    return;
  }

  const pair = {
    from: mapConnectFrom,
    to: id
  };

  data().mapConnections = data().mapConnections || [];

  const exists = data().mapConnections.some(c =>
    (c.from === pair.from && c.to === pair.to) ||
    (c.from === pair.to && c.to === pair.from)
  );

  if (!exists) {
    data().mapConnections.push(pair);
  }

  mapConnectFrom = null;

  document.querySelectorAll(".idea-node, .central-node").forEach(n => {
    n.classList.remove("selected-connect");
  });

  save();
  drawMapLines();
  toast("Conexão adicionada!");
}

function makeDraggable(node, idea) {
  let pointer = null;
  let startX = 0;
  let startY = 0;
  let origX = 0;
  let origY = 0;

  node.addEventListener("pointerdown", e => {
    if (e.target.closest("button")) return;

    pointer = e.pointerId;
    node.setPointerCapture(pointer);

    startX = e.clientX;
    startY = e.clientY;
    origX = idea.position.x;
    origY = idea.position.y;

    e.preventDefault();
  });

  node.addEventListener("pointermove", e => {
    if (pointer !== e.pointerId) return;

    const rect = $("mindmap").getBoundingClientRect();

    idea.position.x = Math.max(
      0,
      Math.min(82, origX + (e.clientX - startX) / rect.width * 100)
    );

    idea.position.y = Math.max(
      0,
      Math.min(88, origY + (e.clientY - startY) / rect.height * 100)
    );

    node.style.left = idea.position.x + "%";
    node.style.top = idea.position.y + "%";

    drawMapLines();
  });

  node.addEventListener("pointerup", e => {
    if (pointer !== e.pointerId) return;

    pointer = null;
    save();
  });
}

function drawMapLines() {
  const svg = $("mapLines");
  const map = $("mindmap");

  if (!svg || !map) return;

  svg.replaceChildren();

  const r = map.getBoundingClientRect();

  svg.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);

  const point = id => {
    const el = id === "center"
      ? $("centralNode")
      : document.querySelector(`.idea-node[data-id="${CSS.escape(id)}"]`);

    if (!el) return null;

    const b = el.getBoundingClientRect();

    return {
      x: b.left - r.left + b.width / 2,
      y: b.top - r.top + b.height / 2
    };
  };

  (data().mapConnections || []).forEach(c => {
    const a = point(c.from);
    const b = point(c.to);

    if (!a || !b) return;

    const line = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );

    line.setAttribute("x1", a.x);
    line.setAttribute("y1", a.y);
    line.setAttribute("x2", b.x);
    line.setAttribute("y2", b.y);

    svg.append(line);
  });
}

window.addEventListener("resize", drawMapLines);

/* FLASHCARDS */

$("flashForm").onsubmit = e => {
  e.preventDefault();

  const front = $("flashFront").value.trim();
  const back = $("flashBack").value.trim();

  if (editingFlash) {
    const card = data().flashcards.find(c => c.id === editingFlash);

    if (card) {
      card.front = front;
      card.back = back;
    }

    editingFlash = null;
  } else {
    data().flashcards.unshift({
      id: crypto.randomUUID(),
      front,
      back
    });
  }

  $("flashForm").reset();
  $("flashSubmit").textContent = "＋ Criar flashcard";
  $("cancelFlashEdit").classList.add("hidden");

  save();
  renderFlashcards();
  toast("Flashcard salvo!");
};

$("cancelFlashEdit").onclick = () => {
  editingFlash = null;
  $("flashForm").reset();
  $("flashSubmit").textContent = "＋ Criar flashcard";
  $("cancelFlashEdit").classList.add("hidden");
};

function renderFlashcards() {
  const root = $("flashList");
  root.replaceChildren();

  if (!data().flashcards.length) {
    root.innerHTML = '<p class="muted">Crie seu primeiro cartão de revisão.</p>';
    return;
  }

  data().flashcards.forEach(card => {
    const el = document.createElement("article");
    el.className = "flash-card";

    el.innerHTML = `
      <span class="flash-label">PERGUNTA</span>
      <div class="flash-content">${safeText(card.front)}</div>
      <span class="flash-hint">Toque para revelar a resposta</span>
      <div class="item-actions">
        <button class="small-btn" data-edit>Editar</button>
        <button class="small-btn danger" data-delete>Apagar</button>
      </div>
    `;

    let revealed = false;

    el.addEventListener("click", e => {
      if (e.target.closest("button")) return;

      revealed = !revealed;

      el.querySelector(".flash-label").textContent =
        revealed ? "RESPOSTA" : "PERGUNTA";

      el.querySelector(".flash-content").textContent =
        revealed ? card.back : card.front;

      el.querySelector(".flash-hint").textContent =
        revealed ? "Toque para voltar à pergunta" : "Toque para revelar a resposta";
    });

    el.querySelector("[data-edit]").onclick = () => {
      editingFlash = card.id;

      $("flashFront").value = card.front;
      $("flashBack").value = card.back;

      $("flashSubmit").textContent = "Salvar alterações";
      $("cancelFlashEdit").classList.remove("hidden");

      $("flashFront").focus();
    };

    el.querySelector("[data-delete]").onclick = () => {
      if (confirm("Apagar este flashcard?")) {
        data().flashcards = data().flashcards.filter(c => c.id !== card.id);
        save();
        renderFlashcards();
      }
    };

    root.append(el);
  });
}

/* TEMPORIZADOR E ALARME */

function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function updateTimer() {
  $("timerDisplay").textContent = formatTime(timerRemaining);
}

let alarmContext = null;
let alarmOscillators = [];

function beep() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    alarmContext = new AC();

    const now = alarmContext.currentTime;

    [0, .55, 1.1, 1.65, 2.2, 2.75, 3.3, 3.85, 4.4].forEach((delay, i) => {
      const osc = alarmContext.createOscillator();
      const gain = alarmContext.createGain();

      osc.connect(gain);
      gain.connect(alarmContext.destination);

      osc.type = "sine";
      osc.frequency.value = i % 2 ? 880 : 660;

      gain.gain.setValueAtTime(.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(.22, now + delay + .04);
      gain.gain.setValueAtTime(.22, now + delay + .25);
      gain.gain.exponentialRampToValueAtTime(.0001, now + delay + .48);

      osc.start(now + delay);
      osc.stop(now + delay + .5);

      alarmOscillators.push(osc);
    });
  } catch (error) {
    console.warn("Não foi possível tocar o alarme:", error);
  }
}

function stopAlarm() {
  try {
    alarmOscillators.forEach(o => o.stop());
  } catch {}

  alarmOscillators = [];

  if (alarmContext) {
    alarmContext.close().catch(() => {});
    alarmContext = null;
  }
}

function finishTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerRemaining = 0;

  updateTimer();

  $("timerStatus").textContent = "Tempo encerrado! Faça uma pausa.";
  $("timerAlert").hidden = false;
  $("closeTimerAlert").focus();

  beep();

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Estuda+ — tempo encerrado", {
      body: "Seu período de concentração terminou. Faça uma pausa!"
    });
  }
}

$("closeTimerAlert").onclick = () => {
  $("timerAlert").hidden = true;
  stopAlarm();
};

$("timerAlert").addEventListener("click", e => {
  if (e.target === $("timerAlert")) {
    $("closeTimerAlert").click();
  }
});

$("timerStart").onclick = () => {
  if (timerInterval) return;

  if (timerRemaining <= 0) {
    timerRemaining =
      Number($("timerMinutes").value || 25) * 60 +
      Number($("timerSeconds").value || 0);
  }

  if (timerRemaining <= 0) {
    toast("Escolha um tempo válido.");
    return;
  }

  $("timerStatus").textContent = "Tempo de concentração em andamento.";

  timerInterval = setInterval(() => {
    timerRemaining--;
    updateTimer();

    if (timerRemaining <= 0) {
      finishTimer();
    }
  }, 1000);

  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
};

$("timerPause").onclick = () => {
  clearInterval(timerInterval);
  timerInterval = null;
  $("timerStatus").textContent = "Temporizador pausado.";
};

$("timerReset").onclick = () => {
  clearInterval(timerInterval);
  timerInterval = null;

  $("timerAlert").hidden = true;
  stopAlarm();

  timerRemaining = Math.max(
    0,
    Number($("timerMinutes").value || 0) * 60 +
    Number($("timerSeconds").value || 0)
  );

  updateTimer();
  $("timerStatus").textContent = "Temporizador reiniciado.";
};

$("timerMinutes").onchange = $("timerSeconds").onchange = () => {
  if (!timerInterval) {
    timerRemaining = Math.max(
      0,
      Math.min(180, Number($("timerMinutes").value) || 0) * 60 +
      Math.min(59, Number($("timerSeconds").value) || 0)
    );

    updateTimer();
  }
};

/* ACESSIBILIDADE E LEITURA EM VOZ ALTA */

const defaultAccess = {
  font: "lexend",
  size: 17,
  spacing: .05,
  line: 1.8,
  bg: "#fffdf5",
  color: "#24364b",
  speed: .9
};

let access = {
  ...defaultAccess,
  ...(JSON.parse(localStorage.getItem(ACCESS_KEY) || "{}"))
};

function applyAccess() {
  document.body.classList.remove(
    "reader-lexend",
    "reader-arial",
    "reader-verdana",
    "reader-opendyslexic",
    "reader-dark"
  );

  document.body.classList.add("reader-" + access.font);

  document.body.style.setProperty("--reader-bg", access.bg);
  document.body.style.setProperty("--reader-color", access.color);
  document.body.style.setProperty("--reader-size", access.size + "px");
  document.body.style.setProperty("--reader-spacing", access.spacing + "em");
  document.body.style.setProperty("--reader-line", access.line);

  if (access.bg === "#202b3a") {
    document.body.classList.add("reader-dark");
  }

  $("readerFont").value = access.font;
  $("readerSize").value = access.size;
  $("fontSizeValue").textContent = access.size + "px";

  $("letterSpace").value = access.spacing;
  $("letterSpaceValue").textContent =
    String(access.spacing.toFixed(2)).replace(".", ",") + "em";

  $("lineHeight").value = access.line;
  $("lineHeightValue").textContent =
    access.line.toFixed(1).replace(".", ",");

  $("readerBackground").value = access.bg;
  $("readerColor").value = access.color;

  $("speakSpeed").value = access.speed;
  $("speedValue").textContent =
    access.speed.toFixed(1).replace(".", ",") + "x";

  localStorage.setItem(ACCESS_KEY, JSON.stringify(access));
}

$("readerFont").onchange = e => {
  access.font = e.target.value;
  applyAccess();
};

$("readerSize").oninput = e => {
  access.size = +e.target.value;
  applyAccess();
};

$("letterSpace").oninput = e => {
  access.spacing = +e.target.value;
  applyAccess();
};

$("lineHeight").oninput = e => {
  access.line = +e.target.value;
  applyAccess();
};

$("readerBackground").onchange = e => {
  access.bg = e.target.value;
  applyAccess();
};

$("readerColor").onchange = e => {
  access.color = e.target.value;
  applyAccess();
};

$("speakSpeed").oninput = e => {
  access.speed = +e.target.value;
  applyAccess();

  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    speakCurrent();
  }
};

$("resetAccessibility").onclick = () => {
  access = { ...defaultAccess };
  applyAccess();
  toast("Preferências restauradas.");
};

/* RÉGUA DE LEITURA */

let rulerOn = false;

$("readingGuide").onclick = () => {
  rulerOn = !rulerOn;

  $("readingRuler").hidden = !rulerOn;

  $("readingGuide").textContent = rulerOn
    ? "Desativar régua de leitura"
    : "Ativar régua de leitura";
};

document.addEventListener("mousemove", e => {
  if (rulerOn) {
    $("readingRuler").style.top =
      Math.max(0, Math.min(window.innerHeight - 54, e.clientY - 27)) + "px";
  }
});

/* LEITURA EM VOZ ALTA */

let speechText = "";

function speakCurrent() {
  if (!speechText.trim() || !("speechSynthesis" in window)) {
    toast("A leitura em voz alta não está disponível neste navegador.");
    return;
  }

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(speechText);

  utterance.lang = "pt-BR";
  utterance.rate = access.speed;

  speechSynthesis.speak(utterance);
}

$("speakStart").onclick = () => {
  speechText = $("speakText").value.trim();
  speakCurrent();
};

$("speakPause").onclick = () => {
  if (speechSynthesis.speaking) {
    speechSynthesis.pause();
  }
};

$("speakResume").onclick = () => {
  speechSynthesis.resume();
};

$("speakStop").onclick = () => {
  speechSynthesis.cancel();
};

/* CALCULADORA */

function calculate(expr) {
  let i = 0;
  const s = expr.replace(/\s/g, "");

  function number() {
    let start = i;

    while (i < s.length && /[0-9.]/.test(s[i])) i++;

    if (start === i) throw Error();

    const n = Number(s.slice(start, i));

    if (!Number.isFinite(n)) throw Error();

    return n;
  }

  function factor() {
    if (s[i] === "+") {
      i++;
      return factor();
    }

    if (s[i] === "-") {
      i++;
      return -factor();
    }

    if (s[i] === "(") {
      i++;
      const n = add();

      if (s[i++] !== ")") throw Error();

      return n;
    }

    return number();
  }

  function mul() {
    let n = factor();

    while (s[i] === "*" || s[i] === "/") {
      const op = s[i++];
      const b = factor();

      if (op === "/" && b === 0) throw Error();

      n = op === "*" ? n * b : n / b;
    }

    return n;
  }

  function add() {
    let n = mul();

    while (s[i] === "+" || s[i] === "-") {
      const op = s[i++];
      const b = mul();

      n = op === "+" ? n + b : n - b;
    }

    return n;
  }

  const result = add();

  if (i !== s.length || !Number.isFinite(result)) {
    throw Error();
  }

  return result;
}

function updateCalc() {
  $("calcDisplay").value = calcExpression || "0";
}

$("calcKeys").onclick = e => {
  const b = e.target.closest("button[data-key]");

  if (!b) return;

  const k = b.dataset.key;

  if (k === "C") {
    calcExpression = "";
  } else if (k === "=") {
    try {
      calcExpression = String(
        Number(calculate(calcExpression).toFixed(10))
      );
    } catch {
      calcExpression = "";
      $("calcDisplay").value = "Erro";
      return;
    }
  } else if (calcExpression.length < 40) {
    calcExpression += k;
  }

  updateCalc();
};

/* MODO FOCO */

$("focusBtn").onclick = () => {
  document.body.classList.toggle("focus-mode");

  $("focusBtn").textContent =
    document.body.classList.contains("focus-mode")
      ? "Sair do foco"
      : "Modo foco";
};

/* INICIALIZAÇÃO */

function renderAll() {
  renderSubjects();
  renderTexts();
  renderTopics();
  renderMap();
  renderFlashcards();

  editor.value = data().highlight || "";
  highlightMarks = data().highlightMarks || [];

  showHighlight();
}

Object.keys(db.subjects).forEach(ensureSubject);
defaults.forEach(name => ensureSubject(name));
ensureSubject(currentSubject);

save();
renderAll();
updateTimer();
applyAccess();
