/* =============================================
   CVDL Moodle — app.js
   Live search + topic filter + modal
   ============================================= */

(async () => {
  /* ── DOM refs ── */
  const searchInput     = document.getElementById('search-input');
  const searchClear     = document.getElementById('search-clear');
  const searchStats     = document.getElementById('search-stats');
  const questionCount   = document.getElementById('question-count');
  const questionsEl     = document.getElementById('questions-container');
  const filtersEl       = document.getElementById('filters-section');
  const loadingState    = document.getElementById('loading-state');
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
  let activeTopics = new Set();   // empty = show all
  let currentQuery = '';

  /* ── Load data ── */
  try {
    const res = await fetch('./questions.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allQuestions = await res.json();
  } catch (err) {
    loadingState.innerHTML = `<p style="color:#f43f5e">⚠ Failed to load questions.json — ${err.message}</p>`;
    return;
  }

  loadingState.remove();
  questionCount.textContent = `${allQuestions.length} question${allQuestions.length !== 1 ? 's' : ''}`;
  buildTopicPills();
  render();

  /* ── Build topic filter pills ── */
  function buildTopicPills() {
    const topics = [...new Set(allQuestions.map(q => q.topic))];

    const allPill = document.createElement('button');
    allPill.className = 'topic-pill active';
    allPill.dataset.topic = '__all__';
    allPill.textContent = 'All topics';
    allPill.addEventListener('click', () => {
      activeTopics.clear();
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
        // if none selected, treat as all
        allPill.classList.toggle('active', activeTopics.size === 0);
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

  /* ── Main render ── */
  function render() {
    const query  = currentQuery.trim().toLowerCase();
    const tokens = query.split(/\s+/).filter(Boolean);   // multi-word support

    const filtered = allQuestions.filter(q => {
      // topic filter
      if (activeTopics.size > 0 && !activeTopics.has(q.topic)) return false;
      // text filter (all tokens must match somewhere)
      if (tokens.length === 0) return true;
      const haystack = [
        q.question,
        q.topic,
        q.text_answer,
        q.correct_answer,
        ...Object.values(q.options)
      ].join(' ').toLowerCase();
      return tokens.every(t => haystack.includes(t));
    });

    // clear cards (keep loading/empty placeholders untouched)
    questionsEl.querySelectorAll('.q-card').forEach(c => c.remove());
    emptyState.hidden = filtered.length > 0;

    if (filtered.length === 0) {
      updateStats(0, query);
      return;
    }

    updateStats(filtered.length, query);

    filtered.forEach((q, i) => {
      const card = buildCard(q, tokens);
      card.style.animationDelay = `${i * 30}ms`;
      questionsEl.appendChild(card);
    });
  }

  /* ── Highlight helper ── */
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
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ── Build a question card ── */
  function buildCard(q, tokens) {
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
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(q); }});
    return card;
  }

  /* ── Stats bar ── */
  function updateStats(count, query) {
    if (!query) {
      searchStats.textContent = '';
      return;
    }
    searchStats.innerHTML = `Showing <span class="highlight-count">${count}</span> result${count !== 1 ? 's' : ''} for "<strong>${escapeHtml(query)}</strong>"`;
  }

  /* ── Modal ── */
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

    // Use text_answer as explanation if it differs from the option text
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
    // Focus search on any printable key (Ctrl+F shortcut feel)
    if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  /* ── Auto-focus search on load ── */
  searchInput.focus();
})();
