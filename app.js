const state = {
  cards: [],
  filtered: [],
  activeId: null,
  theme: "Все",
  mode: "learn",
  progress: JSON.parse(localStorage.getItem("gos-progress") || "{}"),
  examId: null,
  examSeconds: 15 * 60,
  examRunning: false,
  examTimerId: null,
};

const els = {
  doneCount: document.querySelector("#doneCount"),
  totalCount: document.querySelector("#totalCount"),
  searchInput: document.querySelector("#searchInput"),
  themeTabs: document.querySelector("#themeTabs"),
  questionList: document.querySelector("#questionList"),
  questionNumber: document.querySelector("#questionNumber"),
  questionTheme: document.querySelector("#questionTheme"),
  questionTitle: document.querySelector("#questionTitle"),
  questionEssence: document.querySelector("#questionEssence"),
  termRow: document.querySelector("#termRow"),
  logicText: document.querySelector("#logicText"),
  relatedLinks: document.querySelector("#relatedLinks"),
  answerPanel: document.querySelector("#answerPanel"),
  answerContent: document.querySelector("#answerContent"),
  briefContent: document.querySelector("#briefContent"),
  checkList: document.querySelector("#checkList"),
  quizList: document.querySelector("#quizList"),
  quizResult: document.querySelector("#quizResult"),
  revealBtn: document.querySelector("#revealBtn"),
  collapseBtn: document.querySelector("#collapseBtn"),
  resetCheckBtn: document.querySelector("#resetCheckBtn"),
  resetQuizBtn: document.querySelector("#resetQuizBtn"),
  checkQuizBtn: document.querySelector("#checkQuizBtn"),
  shuffleBtn: document.querySelector("#shuffleBtn"),
  connectionMap: document.querySelector("#connectionMap"),
  reviewList: document.querySelector("#reviewList"),
  examTitle: document.querySelector("#examTitle"),
  examTimer: document.querySelector("#examTimer"),
  examNumber: document.querySelector("#examNumber"),
  examTheme: document.querySelector("#examTheme"),
  examPrompt: document.querySelector("#examPrompt"),
  startExamBtn: document.querySelector("#startExamBtn"),
  pauseExamBtn: document.querySelector("#pauseExamBtn"),
  resetExamBtn: document.querySelector("#resetExamBtn"),
  examBriefBtn: document.querySelector("#examBriefBtn"),
  examAnswerBtn: document.querySelector("#examAnswerBtn"),
  examBriefPanel: document.querySelector("#examBriefPanel"),
  examBriefContent: document.querySelector("#examBriefContent"),
  hideExamBriefBtn: document.querySelector("#hideExamBriefBtn"),
};

const statusLabels = {
  known: "Знаю",
  learning: "Учу",
  repeat: "Повторить",
};

fetch("questions.json?v=20260613-exam", { cache: "no-store" })
  .then((response) => response.json())
  .then((cards) => {
    state.cards = cards;
    state.activeId = cards[0]?.id;
    state.filtered = cards;
    renderAll();
  });

function renderAll() {
  applyFilter();
  renderThemes();
  renderList();
  renderActiveCard();
  renderMap();
  renderReview();
  renderExam();
  renderScore();
}

function applyFilter() {
  const query = els.searchInput.value.trim().toLowerCase();
  state.filtered = state.cards.filter((card) => {
    const inTheme = state.theme === "Все" || card.theme === state.theme;
    const haystack = [card.title, card.theme, card.essence, card.terms.join(" ")].join(" ").toLowerCase();
    return inTheme && (!query || haystack.includes(query));
  });
}

function renderThemes() {
  const themes = ["Все", ...new Set(state.cards.map((card) => card.theme))];
  els.themeTabs.innerHTML = themes
    .map((theme) => {
      const active = theme === state.theme ? " active" : "";
      return `<button class="theme-tab${active}" type="button" data-theme="${escapeHtml(theme)}">${escapeHtml(theme)}</button>`;
    })
    .join("");
}

function renderList() {
  els.questionList.innerHTML = state.filtered
    .map((card) => {
      const active = card.id === state.activeId ? " active" : "";
      const status = state.progress[card.id] || "";
      const label = status ? ` · ${statusLabels[status]}` : "";
      return `
        <button class="question-item${active}" type="button" data-id="${card.id}">
          <span class="num">${card.number}</span>
          <span>
            <strong>${escapeHtml(card.title)}</strong>
            <span>${escapeHtml(card.theme)}${label}</span>
          </span>
        </button>
      `;
    })
    .join("");

  if (!state.filtered.length) {
    els.questionList.innerHTML = '<div class="empty">Ничего не найдено. Попробуй другое слово или тему.</div>';
  }
}

function renderActiveCard() {
  const card = getActiveCard();
  if (!card) return;

  els.questionNumber.textContent = `Вопрос ${card.number}`;
  els.questionTheme.textContent = card.theme;
  els.questionTitle.textContent = card.title;
  els.questionEssence.textContent = card.essence || "Открой ответ и собери вопрос по смысловым блокам.";
  els.termRow.innerHTML = card.terms.map((term) => `<span class="term">${escapeHtml(term)}</span>`).join("");

  const related = card.related.map((id) => state.cards.find((item) => item.id === id)).filter(Boolean);
  els.logicText.textContent = buildLogicText(card, related);
  els.relatedLinks.innerHTML = related
    .map((item) => `<button class="related-link" type="button" data-id="${item.id}">${item.number}. ${escapeHtml(shortTitle(item.title))}</button>`)
    .join("");

  els.answerContent.innerHTML = card.sections.map(renderSection).join("");
  els.briefContent.innerHTML = renderBrief(card);
  els.checkList.innerHTML = buildCheckQuestions(card).map(renderCheckQuestion).join("");
  els.quizList.innerHTML = buildMiniTest(card).map(renderQuizTask).join("");
  els.quizResult.textContent = "";
  els.quizResult.className = "quiz-result";
  setAnswerVisibility(false);
  updateStatusButtons();
}

function renderBrief(card) {
  const points = buildBriefPoints(card);
  const terms = card.terms.slice(0, 6);
  return `
    <p class="brief-lead">${escapeHtml(card.essence || getFirstParagraph(card))}</p>
    <ol class="brief-list">
      ${points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
    </ol>
    ${
      terms.length
        ? `<div class="brief-terms">${terms.map((term) => `<span class="term">${escapeHtml(term)}</span>`).join("")}</div>`
        : ""
    }
  `;
}

function buildBriefPoints(card) {
  const points = [];

  card.sections.forEach((section) => {
    const listItem = section.items.find((item) => item.list && item.text.length > 12)?.text;
    const paragraph = section.items.find((item) => !item.list && item.text.length > 55)?.text;
    const candidate = listItem || paragraph;
    if (!candidate) return;
    points.push(`${section.heading}: ${candidate}`);
  });

  if (!points.length && card.essence) points.push(card.essence);

  return uniqueTexts(points.map(compactText)).slice(0, 6);
}

function renderSection(section) {
  const blocks = [];
  let list = [];

  section.items.forEach((item) => {
    if (item.list) {
      list.push(`<li>${escapeHtml(item.text)}</li>`);
      return;
    }
    if (list.length) {
      blocks.push(`<ul>${list.join("")}</ul>`);
      list = [];
    }
    blocks.push(`<p>${escapeHtml(item.text)}</p>`);
  });

  if (list.length) blocks.push(`<ul>${list.join("")}</ul>`);

  return `
    <section class="section-block">
      <h4>${escapeHtml(section.heading)}</h4>
      ${blocks.join("")}
    </section>
  `;
}

function buildCheckQuestions(card) {
  const questions = [];
  const firstMeaningful = card.sections
    .flatMap((section) => section.items.filter((item) => !item.list).map((item) => item.text))
    .filter((text) => text.length > 80);
  const listSections = card.sections.filter((section) => section.items.filter((item) => item.list).length >= 2);

  questions.push({
    question: "Сформулируй главную идею билета своими словами.",
    answer: card.essence || firstMeaningful[0] || "Назови определение, цель и ключевую логику вопроса.",
  });

  card.sections.slice(0, 4).forEach((section) => {
    const bullets = section.items.filter((item) => item.list).slice(0, 5).map((item) => item.text);
    const paragraph = section.items.find((item) => !item.list && item.text.length > 60)?.text;
    if (bullets.length >= 2) {
      questions.push({
        question: `Перечисли ключевые пункты блока “${section.heading}”.`,
        answer: bullets.join("; "),
      });
    } else if (paragraph) {
      questions.push({
        question: `Объясни блок “${section.heading}” без подсказки.`,
        answer: paragraph,
      });
    }
  });

  if (card.terms.length) {
    questions.push({
      question: `Раскрой термины: ${card.terms.slice(0, 4).join(", ")}.`,
      answer: "Проверь себя по полному ответу: эти термины должны прозвучать в определении, признаках или примерах билета.",
    });
  }

  const related = card.related
    .slice(0, 2)
    .map((id) => state.cards.find((item) => item.id === id))
    .filter(Boolean);
  if (related.length) {
    questions.push({
      question: "С каким соседним билетом связан этот вопрос и почему?",
      answer: related.map((item) => `${item.number}. ${item.title}`).join("; "),
    });
  }

  listSections.slice(0, 1).forEach((section) => {
    const items = section.items.filter((item) => item.list).slice(0, 6).map((item) => item.text);
    questions.push({
      question: `Восстанови список из блока “${section.heading}” по памяти.`,
      answer: items.join("; "),
    });
  });

  const unique = [];
  const seen = new Set();
  questions.forEach((item) => {
    const key = item.question;
    if (!seen.has(key) && item.answer) {
      seen.add(key);
      unique.push(item);
    }
  });
  return unique.slice(0, 7);
}

function renderCheckQuestion(item, index) {
  return `
    <details class="check-item">
      <summary>
        <span>${index + 1}</span>
        <strong>${escapeHtml(item.question)}</strong>
      </summary>
      <p>${escapeHtml(item.answer)}</p>
    </details>
  `;
}

function buildMiniTest(card) {
  const sectionsWithLists = card.sections.filter((section) => section.items.filter((item) => item.list).length >= 2);
  const meaningfulSections = card.sections.filter((section) => section.heading && section.items.length);
  const paragraphSections = meaningfulSections.filter((section) => section.items.some((item) => !item.list && item.text.length > 70));
  const tasks = [];

  const blankSource = getFirstParagraph(card);
  const term = pickBlankTerm(blankSource, card.terms);
  if (term) {
    tasks.push({
      type: "blank",
      question: "Заполни пропуск в определении.",
      text: makeBlankText(blankSource, term),
      answer: term,
    });
  }

  sectionsWithLists.slice(0, 3).forEach((section) => {
    const correctItems = section.items.filter((item) => item.list).slice(0, 4).map((item) => item.text);
    const fallback = section.items.find((item) => !item.list)?.text || section.heading;
    tasks.push({
      type: "choice",
      question: `Что относится к блоку “${section.heading}”?`,
      options: buildOptions(correctItems[0] || fallback, getDistractors(card, section.heading)),
    });
  });

  paragraphSections.slice(0, 2).forEach((section) => {
    const correct = section.items.find((item) => !item.list && item.text.length > 70)?.text;
    if (!correct) return;
    tasks.push({
      type: "choice",
      question: `Какое утверждение верно для раздела “${section.heading}”?`,
      options: buildOptions(correct, getDistractors(card, section.heading)),
    });
  });

  return tasks.slice(0, 6).map((task, index) => ({ ...task, id: `${card.id}-quiz-${index}` }));
}

function renderQuizTask(task, index) {
  if (task.type === "blank") {
    return `
      <section class="quiz-item" data-quiz-id="${task.id}" data-type="blank" data-answer="${escapeHtml(task.answer)}">
        <div class="quiz-question">
          <span>${index + 1}</span>
          <strong>${escapeHtml(task.question)}</strong>
        </div>
        <p>${escapeHtml(task.text)}</p>
        <input class="quiz-input" type="text" placeholder="Впиши ответ" autocomplete="off" />
        <div class="quiz-feedback"></div>
      </section>
    `;
  }

  return `
    <section class="quiz-item" data-quiz-id="${task.id}" data-type="choice" data-answer="${task.options.findIndex((option) => option.correct)}">
      <div class="quiz-question">
        <span>${index + 1}</span>
        <strong>${escapeHtml(task.question)}</strong>
      </div>
      <div class="quiz-options">
        ${task.options
          .map(
            (option, optionIndex) => `
              <label class="quiz-option">
                <input type="radio" name="${task.id}" value="${optionIndex}" />
                <span>${escapeHtml(option.text)}</span>
              </label>
            `
          )
          .join("")}
      </div>
      <div class="quiz-feedback"></div>
    </section>
  `;
}

function buildOptions(correct, distractors) {
  const trimmedCorrect = cleanOption(correct);
  const pool = distractors.map(cleanOption).filter((item) => item && item !== trimmedCorrect);
  const options = [trimmedCorrect, ...pool.slice(0, 3)].slice(0, 4);
  while (options.length < 4) {
    options.push(["Планирование, организация, мотивация и контроль", "Влияние внешней и внутренней среды", "Рациональное использование ресурсов", "Принятие и исполнение управленческих решений"][options.length - 1]);
  }
  return shuffle(options.map((text, index) => ({ text, correct: index === 0 })));
}

function getDistractors(card, currentHeading) {
  const fromOtherSections = card.sections
    .filter((section) => section.heading !== currentHeading)
    .flatMap((section) => section.items.map((item) => item.text));
  const fromOtherCards = state.cards.filter((item) => item.id !== card.id).map((item) => item.title);
  return [...fromOtherSections, ...fromOtherCards];
}

function getFirstParagraph(card) {
  return (
    card.sections
      .flatMap((section) => section.items)
      .find((item) => !item.list && item.text.length > 70)?.text ||
    card.essence ||
    card.title
  );
}

function pickBlankTerm(text, terms) {
  const normalizedText = text.toLowerCase();
  return terms.find((term) => normalizedText.includes(term.toLowerCase())) || terms[0] || "";
}

function makeBlankText(text, answer) {
  const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const replaced = text.replace(new RegExp(escaped, "i"), blankLine());
  return replaced === text ? `${blankLine()} — важное понятие в этом билете.` : replaced;
}

function blankLine() {
  return "__________";
}

function cleanOption(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 210);
}

function shuffle(items) {
  return items
    .map((item, index) => ({ item, sort: Math.sin(index + item.text.length) }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

function checkMiniTest() {
  const quizItems = [...document.querySelectorAll(".quiz-item")];
  let correct = 0;

  quizItems.forEach((item) => {
    const feedback = item.querySelector(".quiz-feedback");
    const type = item.dataset.type;
    let isCorrect = false;
    let expected = item.dataset.answer || "";

    if (type === "choice") {
      const selected = item.querySelector("input[type='radio']:checked");
      isCorrect = Boolean(selected && selected.value === expected);
      expected = item.querySelector(`input[value="${expected}"]`)?.nextElementSibling?.textContent || "";
    } else {
      const value = normalizeAnswer(item.querySelector(".quiz-input")?.value || "");
      isCorrect = value && normalizeAnswer(expected).includes(value);
    }

    item.classList.toggle("correct", isCorrect);
    item.classList.toggle("incorrect", !isCorrect);
    feedback.textContent = isCorrect ? "Верно" : `Проверь: ${expected}`;
    if (isCorrect) correct += 1;
  });

  els.quizResult.textContent = `Результат: ${correct} из ${quizItems.length}.`;
  els.quizResult.className = `quiz-result ${correct === quizItems.length ? "success" : "needs-work"}`;
}

function resetMiniTest() {
  document.querySelectorAll(".quiz-item").forEach((item) => {
    item.classList.remove("correct", "incorrect");
    item.querySelectorAll("input[type='radio']").forEach((input) => {
      input.checked = false;
    });
    const textInput = item.querySelector(".quiz-input");
    if (textInput) textInput.value = "";
    const feedback = item.querySelector(".quiz-feedback");
    if (feedback) feedback.textContent = "";
  });
  els.quizResult.textContent = "";
  els.quizResult.className = "quiz-result";
}

function normalizeAnswer(value) {
  return value.toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/gi, " ").trim();
}

function renderMap() {
  els.connectionMap.innerHTML = state.cards
    .map((card) => {
      const related = card.related
        .slice(0, 3)
        .map((id) => state.cards.find((item) => item.id === id)?.number)
        .filter(Boolean)
        .join(", ");
      const active = card.id === state.activeId ? " active" : "";
      return `
        <button class="map-node${active}" type="button" data-id="${card.id}">
          <span class="node-top">
            <span>Вопрос ${card.number}</span>
            <span>${escapeHtml(card.theme)}</span>
          </span>
          <strong>${escapeHtml(card.title)}</strong>
          <span class="node-links">Связан с: ${related}</span>
        </button>
      `;
    })
    .join("");
}

function renderReview() {
  const queue = state.cards
    .filter((card) => ["repeat", "learning"].includes(state.progress[card.id]))
    .sort((a, b) => statusWeight(state.progress[a.id]) - statusWeight(state.progress[b.id]) || a.number - b.number);

  els.reviewList.innerHTML = queue
    .map((card) => {
      const status = state.progress[card.id];
      return `
        <button class="review-item" type="button" data-id="${card.id}">
          <span class="${status}">${statusLabels[status]}</span>
          <strong>${card.number}. ${escapeHtml(card.title)}</strong>
          <span>${escapeHtml(card.terms.slice(0, 5).join(" · "))}</span>
        </button>
      `;
    })
    .join("");

  if (!queue.length) {
    els.reviewList.innerHTML = '<div class="empty">Пока нет вопросов в очереди. Отметь карточки как “Учу” или “Повторить”.</div>';
  }
}

function renderExam() {
  const card = state.cards.find((item) => item.id === state.examId);
  els.examTimer.textContent = formatTime(state.examSeconds);
  els.examTimer.classList.toggle("warning", state.examSeconds <= 60);
  els.pauseExamBtn.textContent = state.examRunning ? "Пауза" : "Продолжить";

  if (!card) {
    els.examTitle.textContent = "Случайный билет";
    els.examNumber.textContent = "Билет не выбран";
    els.examTheme.textContent = state.theme === "Все" ? "Все темы" : state.theme;
    els.examPrompt.textContent = "Запусти тренировку: сайт вытянет случайный вопрос, а таймер поможет отрепетировать устный ответ.";
    els.examBriefPanel.hidden = true;
    els.examBriefContent.innerHTML = "";
    return;
  }

  els.examTitle.textContent = card.title;
  els.examNumber.textContent = `Вопрос ${card.number}`;
  els.examTheme.textContent = card.theme;
  els.examPrompt.textContent = card.essence || "Сформулируй определение, ключевые элементы и вывод по билету.";
  els.examBriefContent.innerHTML = renderBrief(card);
}

function startExamRound() {
  const pool = state.filtered.length ? state.filtered : state.cards;
  const next = pool[Math.floor(Math.random() * pool.length)];
  if (!next) return;

  state.examId = next.id;
  state.examSeconds = 15 * 60;
  state.examRunning = true;
  els.examBriefPanel.hidden = true;
  ensureExamTimer();
  renderExam();
}

function toggleExamTimer() {
  if (!state.examId) return;
  state.examRunning = !state.examRunning;
  ensureExamTimer();
  renderExam();
}

function resetExamTimer() {
  state.examSeconds = 15 * 60;
  state.examRunning = Boolean(state.examId);
  ensureExamTimer();
  renderExam();
}

function ensureExamTimer() {
  if (state.examTimerId) clearInterval(state.examTimerId);
  state.examTimerId = null;
  if (!state.examRunning) return;

  state.examTimerId = setInterval(() => {
    state.examSeconds = Math.max(0, state.examSeconds - 1);
    if (state.examSeconds === 0) {
      state.examRunning = false;
      clearInterval(state.examTimerId);
      state.examTimerId = null;
    }
    renderExam();
  }, 1000);
}

function showExamBrief() {
  const card = state.cards.find((item) => item.id === state.examId);
  if (!card) return;
  els.examBriefPanel.hidden = false;
  els.examBriefContent.innerHTML = renderBrief(card);
}

function openExamAnswer() {
  if (!state.examId) return;
  selectCard(state.examId, "learn");
  setAnswerVisibility(true);
}

function renderScore() {
  const known = state.cards.filter((card) => state.progress[card.id] === "known").length;
  els.doneCount.textContent = known;
  els.totalCount.textContent = state.cards.length;
}

function buildLogicText(card, related) {
  if (!related.length) return "Начни с сути вопроса, затем перейди к терминам и проверь себя по ответу.";
  const names = related.slice(0, 2).map((item) => `“${shortTitle(item.title)}”`).join(" и ");
  return `Этот билет лучше учить вместе с ${names}: общие термины помогут не зубрить ответ отдельно, а собрать его в цепочку.`;
}

function selectCard(id, mode = state.mode) {
  state.activeId = id;
  switchMode(mode);
  renderAll();
  document.querySelector(".workspace").scrollIntoView({ behavior: "smooth", block: "start" });
}

function switchMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active-view"));
  document.querySelector(`#${mode}View`).classList.add("active-view");
}

function setAnswerVisibility(show) {
  els.answerPanel.hidden = !show;
  els.revealBtn.textContent = show ? "Ответ открыт" : "Открыть ответ";
}

function updateStatusButtons() {
  const status = state.progress[state.activeId];
  document.querySelectorAll(".status-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.status === status);
  });
}

function saveProgress(id, status) {
  if (state.progress[id] === status) {
    delete state.progress[id];
  } else {
    state.progress[id] = status;
  }
  localStorage.setItem("gos-progress", JSON.stringify(state.progress));
  renderList();
  renderMap();
  renderReview();
  renderScore();
  updateStatusButtons();
}

function getActiveCard() {
  return state.cards.find((card) => card.id === state.activeId) || state.cards[0];
}

function statusWeight(status) {
  return status === "repeat" ? 0 : 1;
}

function shortTitle(title) {
  return title.length > 58 ? `${title.slice(0, 55)}...` : title;
}

function compactText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);
}

function uniqueTexts(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.searchInput.addEventListener("input", renderAll);

els.themeTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-theme]");
  if (!button) return;
  state.theme = button.dataset.theme;
  renderAll();
});

document.addEventListener("click", (event) => {
  const cardButton = event.target.closest("[data-id]");
  if (cardButton && !cardButton.classList.contains("status-button")) {
    selectCard(cardButton.dataset.id, "learn");
  }
});

document.querySelectorAll(".mode-button").forEach((button) => {
  button.addEventListener("click", () => switchMode(button.dataset.mode));
});

document.querySelectorAll(".status-button").forEach((button) => {
  button.addEventListener("click", () => saveProgress(state.activeId, button.dataset.status));
});

els.revealBtn.addEventListener("click", () => setAnswerVisibility(true));
els.collapseBtn.addEventListener("click", () => setAnswerVisibility(false));
els.resetCheckBtn.addEventListener("click", () => {
  document.querySelectorAll(".check-item[open]").forEach((item) => item.removeAttribute("open"));
});
els.checkQuizBtn.addEventListener("click", checkMiniTest);
els.resetQuizBtn.addEventListener("click", resetMiniTest);
els.startExamBtn.addEventListener("click", startExamRound);
els.pauseExamBtn.addEventListener("click", toggleExamTimer);
els.resetExamBtn.addEventListener("click", resetExamTimer);
els.examBriefBtn.addEventListener("click", showExamBrief);
els.examAnswerBtn.addEventListener("click", openExamAnswer);
els.hideExamBriefBtn.addEventListener("click", () => {
  els.examBriefPanel.hidden = true;
});

els.shuffleBtn.addEventListener("click", () => {
  const pool = state.filtered.length ? state.filtered : state.cards;
  const next = pool[Math.floor(Math.random() * pool.length)];
  if (next) selectCard(next.id, "learn");
});
