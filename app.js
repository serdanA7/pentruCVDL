/* =============================================
   CVDL Moodle — app.js
   Live search + topic filter + tabs (Q&A / Theory) + modal
   ============================================= */

(async () => {
  /* ── DOM refs ── */
  const searchInput     = document.getElementById('search-input');
  const searchClear     = document.getElementById('search-clear');
  const searchStats     = document.getElementById('search-stats');
  const itemCount       = document.getElementById('item-count');
  const tabQBtn         = document.getElementById('tab-questions');
  const tabTBtn         = document.getElementById('tab-theory');
  const tabQCount       = document.getElementById('tab-q-count');
  const tabTCount       = document.getElementById('tab-t-count');
  const panelQuestions  = document.getElementById('panel-questions');
  const panelTheory     = document.getElementById('panel-theory');
  const questionsEl     = document.getElementById('questions-container');
  const theoryEl        = document.getElementById('theory-container');
  const filtersEl          = document.getElementById('filters-section');
  const filtersToggle       = document.getElementById('filters-toggle');
  const filtersActiveCount  = document.getElementById('filters-active-count');
  const loadingQ        = document.getElementById('loading-questions');
  const emptyState      = document.getElementById('empty-state');
  const modalOverlay    = document.getElementById('modal-overlay');
  const modalClose      = document.getElementById('modal-close');
  const modalTopic      = document.getElementById('modal-topic');
  const modalQid        = document.getElementById('modal-qid');
  const modalTitle      = document.getElementById('modal-title');
  const modalOptions    = document.getElementById('modal-options');
  const modalAnswerText = document.getElementById('modal-answer-text');
  const modalExplain    = document.getElementById('modal-explanation');

  /* ── State ── */
  let allQuestions = [];
  let allConcepts  = [];
  let activeTopics = new Set();
  let currentQuery = '';
  let activeMode   = 'questions';   // 'questions' | 'theory'

  /* ── Load data in parallel ── */
  const [qRes, tRes] = await Promise.allSettled([
    fetch('./questions.json'),
    fetch('./theory.json')
  ]);

  if (qRes.status === 'fulfilled' && qRes.value.ok) {
    allQuestions = await qRes.value.json();
  } else {
    loadingQ.innerHTML = `<p style="color:#f43f5e">⚠ Failed to load questions.json</p>`;
  }

  if (tRes.status === 'fulfilled' && tRes.value.ok) {
    const data = await tRes.value.json();
    allConcepts = data.concepts || [];
  }

  loadingQ.remove();

  tabQCount.textContent = allQuestions.length;
  tabTCount.textContent = allConcepts.length;
  updateHeaderCount();
  buildTopicPills();
  render();

  /* ── Filters toggle ── */
  filtersToggle.addEventListener('click', () => {
    const isOpen = filtersToggle.getAttribute('aria-expanded') === 'true';
    filtersToggle.setAttribute('aria-expanded', !isOpen);
    filtersEl.hidden = isOpen;
  });

  function updateActiveCount() {
    const n = activeTopics.size;
    if (n > 0) {
      filtersActiveCount.textContent = n;
      filtersActiveCount.hidden = false;
    } else {
      filtersActiveCount.hidden = true;
    }
  }

  /* ── Tab switching ── */
  tabQBtn.addEventListener('click', () => switchMode('questions'));
  tabTBtn.addEventListener('click', () => switchMode('theory'));

  function switchMode(mode) {
    activeMode = mode;
    activeTopics.clear();

    tabQBtn.classList.toggle('active', mode === 'questions');
    tabTBtn.classList.toggle('active', mode === 'theory');
    tabQBtn.setAttribute('aria-selected', mode === 'questions');
    tabTBtn.setAttribute('aria-selected', mode === 'theory');

    panelQuestions.hidden = mode !== 'questions';
    panelTheory.hidden    = mode !== 'theory';

    // Reset filter panel state
    filtersEl.innerHTML = '';
    filtersEl.hidden = true;
    filtersToggle.setAttribute('aria-expanded', 'false');
    filtersActiveCount.hidden = true;
    buildTopicPills();

    // Reset search
    searchInput.value = '';
    currentQuery = '';
    searchClear.hidden = true;

    updateHeaderCount();
    render();
    searchInput.focus();
  }

  function updateHeaderCount() {
    if (activeMode === 'questions') {
      itemCount.textContent = `${allQuestions.length} question${allQuestions.length !== 1 ? 's' : ''}`;
    } else {
      itemCount.textContent = `${allConcepts.length} concept${allConcepts.length !== 1 ? 's' : ''}`;
    }
  }

  /* ── Build topic filter pills (mode-aware) ── */
  function buildTopicPills() {
    const source = activeMode === 'questions' ? allQuestions : allConcepts;
    const topics = [...new Set(source.map(x => x.topic))].sort();

    const allPill = document.createElement('button');
    allPill.className = 'topic-pill active';
    allPill.dataset.topic = '__all__';
    allPill.textContent = 'All topics';
    allPill.addEventListener('click', () => {
      activeTopics.clear();
      updateActiveCount();
      document.querySelectorAll('.topic-pill').forEach(p => p.classList.remove('active'));
      allPill.classList.add('active');
      render();
    });
    filtersEl.appendChild(allPill);

    topics.forEach(topic => {
      const pill = document.createElement('button');
      pill.className = 'topic-pill';
      pill.dataset.topic = topic;
      pill.textContent = topic;
      pill.addEventListener('click', () => {
        if (activeTopics.has(topic)) {
          activeTopics.delete(topic);
          pill.classList.remove('active');
        } else {
          activeTopics.add(topic);
          pill.classList.add('active');
        }
        allPill.classList.toggle('active', activeTopics.size === 0);
        updateActiveCount();
        render();
      });
      filtersEl.appendChild(pill);
    });
  }

  /* ── Live search ── */
  searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value;
    searchClear.hidden = currentQuery.length === 0;
    render();
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    currentQuery = '';
    searchClear.hidden = true;
    searchInput.focus();
    render();
  });

  /* ── Main render dispatcher ── */
  function render() {
    if (activeMode === 'questions') renderQuestions();
    else                            renderTheory();
  }

  /* ── Render questions ── */
  function renderQuestions() {
    const tokens = getTokens();
    const filtered = allQuestions.filter(q => {
      if (activeTopics.size > 0 && !activeTopics.has(q.topic)) return false;
      if (!tokens.length) return true;
      const hay = [q.question, q.topic, q.text_answer, q.correct_answer,
                   ...Object.values(q.options)].join(' ').toLowerCase();
      return tokens.every(t => hay.includes(t));
    });

    questionsEl.querySelectorAll('.q-card').forEach(c => c.remove());
    emptyState.hidden = filtered.length > 0;
    updateStats(filtered.length, currentQuery.trim());

    filtered.forEach((q, i) => {
      const card = buildQCard(q, tokens);
      card.style.animationDelay = `${i * 25}ms`;
      questionsEl.appendChild(card);
    });
  }

  /* ── Render theory ── */
  function renderTheory() {
    const tokens = getTokens();
    const filtered = allConcepts.filter(c => {
      if (activeTopics.size > 0 && !activeTopics.has(c.topic)) return false;
      if (!tokens.length) return true;
      const hay = [c.name, c.topic, ...c.bullets].join(' ').toLowerCase();
      return tokens.every(t => hay.includes(t));
    });

    theoryEl.querySelectorAll('.t-card').forEach(c => c.remove());
    emptyState.hidden = filtered.length > 0;
    updateStats(filtered.length, currentQuery.trim());

    filtered.forEach((c, i) => {
      const card = buildTCard(c, tokens);
      card.style.animationDelay = `${i * 25}ms`;
      // Auto-expand when searching
      if (tokens.length > 0) card.classList.add('open');
      theoryEl.appendChild(card);
    });
  }

  /* ── Build question card ── */
  function buildQCard(q, tokens) {
    const card = document.createElement('article');
    card.className = 'q-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Question ${q.question_id}: ${q.question}`);

    const optionsHtml = Object.entries(q.options).map(([key, val]) => `
      <li class="q-option">
        <span class="opt-key">${key})</span>
        <span>${highlight(val, tokens)}</span>
      </li>`).join('');

    card.innerHTML = `
      <div class="q-card-header">
        <span class="q-id">#${q.question_id}</span>
        <span class="q-topic">${escapeHtml(q.topic)}</span>
      </div>
      <p class="q-text">${highlight(q.question, tokens)}</p>
      <ul class="q-options">${optionsHtml}</ul>
      <div class="q-card-footer">
        <span class="q-hint">Click to reveal answer</span>
        <span class="q-arrow">→</span>
      </div>
    `;

    card.addEventListener('click', () => openModal(q));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(q); }
    });
    return card;
  }

  /* ── Build theory card (collapsible) ── */
  function buildTCard(concept, tokens) {
    const card = document.createElement('article');
    card.className = 't-card';

    const bulletsHtml = concept.bullets.map(b => `
      <li class="t-bullet"><span>${highlight(b, tokens)}</span></li>`).join('');

    card.innerHTML = `
      <div class="t-card-header" role="button" tabindex="0" aria-expanded="false">
        <div class="t-card-left">
          <span class="t-name">${highlight(concept.name, tokens)}</span>
          <span class="t-topic">${highlight(concept.topic, tokens)}</span>
        </div>
        <svg class="t-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="t-body">
        <ul class="t-bullets">${bulletsHtml}</ul>
      </div>
    `;

    const header = card.querySelector('.t-card-header');
    const toggle = () => {
      card.classList.toggle('open');
      header.setAttribute('aria-expanded', card.classList.contains('open'));
    };
    header.addEventListener('click', toggle);
    header.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });

    return card;
  }

  /* ── Stats bar ── */
  function updateStats(count, query) {
    if (!query) { searchStats.textContent = ''; return; }
    const noun = activeMode === 'questions' ? 'question' : 'concept';
    searchStats.innerHTML = `Showing <span class="highlight-count">${count}</span> ${noun}${count !== 1 ? 's' : ''} for "<strong>${escapeHtml(query)}</strong>"`;
  }

  /* ── Helpers ── */
  function getTokens() {
    return currentQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  }

  function highlight(text, tokens) {
    if (!tokens.length) return escapeHtml(text);
    let result = escapeHtml(text);
    tokens.forEach(t => {
      const re = new RegExp(`(${escapeRegex(t)})`, 'gi');
      result = result.replace(re, '<mark>$1</mark>');
    });
    return result;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ── Modal (questions only) ── */
  function openModal(q) {
    modalTopic.textContent = q.topic;
    modalQid.textContent   = `#${q.question_id}`;
    modalTitle.textContent = q.question;

    modalOptions.innerHTML = Object.entries(q.options).map(([key, val]) => `
      <li class="modal-option ${key === q.correct_answer ? 'correct' : ''}">
        <span class="opt-key">${key})</span>
        <span>${escapeHtml(val)}</span>
      </li>`).join('');

    modalAnswerText.textContent = `${q.correct_answer.toUpperCase()} — ${q.text_answer}`;

    const answerOption = q.options[q.correct_answer] || '';
    const explanation  = q.text_answer !== answerOption ? q.text_answer : '';
    modalExplain.textContent = explanation;
    modalExplain.style.display = explanation ? 'block' : 'none';

    modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    modalClose.focus();
  }

  function closeModal() {
    modalOverlay.hidden = true;
    document.body.style.overflow = '';
    searchInput.focus();
  }

  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modalOverlay.hidden) closeModal();
    if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  /* ── Auto-focus search on load ── */
  searchInput.focus();
})();
