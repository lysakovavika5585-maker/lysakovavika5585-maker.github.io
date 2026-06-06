(function () {
  const style = document.createElement("style");
  style.textContent = `
    .quiz-panel{margin-top:20px;padding:24px;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.93);box-shadow:var(--shadow)}
    .quiz-head{display:flex;align-items:center;justify-content:space-between;gap:16px}
    .quiz-head h3{margin-bottom:0}.quiz-actions{display:flex;flex-wrap:wrap;gap:10px}.quiz-list{display:grid;gap:14px;margin-top:16px}
    .quiz-item{padding:16px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
    .quiz-question{display:grid;grid-template-columns:34px 1fr;gap:12px;align-items:center;margin-bottom:12px}
    .quiz-question span{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;color:#fff;font-size:13px;font-weight:850;background:var(--teal)}
    .quiz-item p{margin-bottom:12px;color:#2c3949;line-height:1.58}.quiz-options{display:grid;gap:8px}
    .quiz-option{display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:start;padding:10px;border:1px solid var(--line);border-radius:8px;cursor:pointer;background:#fbfcfd}
    .quiz-option input{margin-top:4px}.quiz-input{width:100%;min-height:42px;padding:0 12px;border:1px solid var(--line);border-radius:8px;outline:none}
    .quiz-input:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(0,109,119,.14)}.quiz-feedback{min-height:22px;margin-top:10px;color:var(--muted);font-size:14px;font-weight:800}
    .quiz-item.correct{border-color:rgba(77,124,63,.65);background:#f4fbf2}.quiz-item.incorrect{border-color:rgba(200,85,61,.65);background:#fff8f6}
    .quiz-item.correct .quiz-feedback{color:var(--green)}.quiz-item.incorrect .quiz-feedback{color:var(--coral)}
    .quiz-result{min-height:26px;margin-top:16px;font-weight:850}.quiz-result.success{color:var(--green)}.quiz-result.needs-work{color:var(--coral)}
    @media(max-width:620px){.quiz-panel{padding:18px}.quiz-head{align-items:stretch;flex-direction:column}.quiz-question{grid-template-columns:30px 1fr}}
  `;
  document.head.appendChild(style);

  const originalRenderActiveCard = renderActiveCard;
  renderActiveCard = function () {
    originalRenderActiveCard();
    ensureQuizPanel();
    renderMiniTest();
  };

  function ensureQuizPanel() {
    if (!document.querySelector(".quiz-panel")) {
      const checkPanel = document.querySelector(".check-panel");
      if (!checkPanel) return;
      checkPanel.insertAdjacentHTML(
        "afterend",
        `
          <article class="quiz-panel" aria-label="Мини-тест по вопросу">
            <div class="quiz-head">
              <div>
                <p class="eyebrow">Мини-тест</p>
                <h3>Проверка знаний</h3>
              </div>
              <div class="quiz-actions">
                <button id="resetQuizBtn" class="ghost-button" type="button">Очистить</button>
                <button id="checkQuizBtn" class="primary-button" type="button">Проверить</button>
              </div>
            </div>
            <div id="quizList" class="quiz-list"></div>
            <div id="quizResult" class="quiz-result" aria-live="polite"></div>
          </article>
        `
      );
    }
    const checkButton = document.querySelector("#checkQuizBtn");
    const resetButton = document.querySelector("#resetQuizBtn");
    if (checkButton && !checkButton.dataset.quizBound) {
      checkButton.addEventListener("click", checkMiniTest);
      checkButton.dataset.quizBound = "true";
    }
    if (resetButton && !resetButton.dataset.quizBound) {
      resetButton.addEventListener("click", resetMiniTest);
      resetButton.dataset.quizBound = "true";
    }
  }

  function renderMiniTest() {
    const card = getActiveCard();
    const quizList = document.querySelector("#quizList");
    const quizResult = document.querySelector("#quizResult");
    if (!card || !quizList || !quizResult) return;
    quizList.innerHTML = buildMiniTest(card).map(renderQuizTask).join("");
    quizResult.textContent = "";
    quizResult.className = "quiz-result";
  }

  function buildMiniTest(card) {
    const sectionsWithLists = card.sections.filter((section) => section.items.filter((item) => item.list).length >= 2);
    const meaningfulSections = card.sections.filter((section) => section.heading && section.items.length);
    const tasks = [];

    tasks.push({
      type: "choice",
      question: "Какая формулировка лучше всего передает главную суть билета?",
      options: buildOptions(
        card.essence || getFirstParagraph(card),
        state.cards.filter((item) => item.id !== card.id).map((item) => item.essence || item.title)
      ),
    });

    const section = sectionsWithLists[0] || meaningfulSections[1] || meaningfulSections[0];
    if (section) {
      const correctItems = section.items.filter((item) => item.list).slice(0, 4).map((item) => item.text);
      const fallback = section.items.find((item) => !item.list)?.text || section.heading;
      tasks.push({
        type: "choice",
        question: `Что относится к блоку “${section.heading}”?`,
        options: buildOptions(correctItems[0] || fallback, getDistractors(card, section.heading)),
      });
    }

    if (card.related.length) {
      const correctRelated = state.cards.find((item) => item.id === card.related[0]);
      if (correctRelated) {
        tasks.push({
          type: "choice",
          question: "С каким билетом этот вопрос связан сильнее всего?",
          options: buildOptions(
            `${correctRelated.number}. ${correctRelated.title}`,
            state.cards.filter((item) => item.id !== card.id && item.id !== correctRelated.id).map((item) => `${item.number}. ${item.title}`)
          ),
        });
      }
    }

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

    const secondSection = meaningfulSections.find((item) => item.heading !== "Суть вопроса" && item.heading.length > 4);
    if (secondSection) {
      tasks.push({
        type: "blank",
        question: "Впиши название смыслового блока из ответа.",
        text: `Один из важных блоков этого билета: “${blankLine()}”.`,
        answer: secondSection.heading,
      });
    }

    if (card.terms.length >= 2) {
      tasks.push({
        type: "blank",
        question: "Впиши ключевой термин билета.",
        text: `Ключевой термин, который нужно обязательно упомянуть: ${blankLine()}.`,
        answer: card.terms[0],
      });
    }

    return tasks.slice(0, 6).map((task, index) => ({ ...task, id: `${card.id}-quiz-${index}` }));
  }

  function renderQuizTask(task, index) {
    if (task.type === "blank") {
      return `
        <section class="quiz-item" data-type="blank" data-answer="${escapeHtml(task.answer)}">
          <div class="quiz-question"><span>${index + 1}</span><strong>${escapeHtml(task.question)}</strong></div>
          <p>${escapeHtml(task.text)}</p>
          <input class="quiz-input" type="text" placeholder="Впиши ответ" autocomplete="off" />
          <div class="quiz-feedback"></div>
        </section>
      `;
    }
    return `
      <section class="quiz-item" data-type="choice" data-answer="${task.options.findIndex((option) => option.correct)}">
        <div class="quiz-question"><span>${index + 1}</span><strong>${escapeHtml(task.question)}</strong></div>
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
    const fallback = ["Планирование, организация, мотивация и контроль", "Влияние внешней и внутренней среды", "Рациональное использование ресурсов", "Принятие и исполнение управленческих решений"];
    while (options.length < 4) options.push(fallback[options.length - 1]);
    return shuffle(options.map((text, index) => ({ text, correct: index === 0 })));
  }

  function getDistractors(card, currentHeading) {
    return [
      ...card.sections.filter((section) => section.heading !== currentHeading).flatMap((section) => section.items.map((item) => item.text)),
      ...state.cards.filter((item) => item.id !== card.id).map((item) => item.title),
    ];
  }

  function getFirstParagraph(card) {
    return card.sections.flatMap((section) => section.items).find((item) => !item.list && item.text.length > 70)?.text || card.essence || card.title;
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
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, 210);
  }

  function shuffle(items) {
    return items.map((item, index) => ({ item, sort: Math.sin(index + item.text.length) })).sort((a, b) => a.sort - b.sort).map(({ item }) => item);
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
    const result = document.querySelector("#quizResult");
    result.textContent = `Результат: ${correct} из ${quizItems.length}.`;
    result.className = `quiz-result ${correct === quizItems.length ? "success" : "needs-work"}`;
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
    const result = document.querySelector("#quizResult");
    result.textContent = "";
    result.className = "quiz-result";
  }

  function normalizeAnswer(value) {
    return value.toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/gi, " ").trim();
  }
})();
