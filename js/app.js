/**
 * FinanzApp — Main application logic
 */
const App = {

  state: {
    view:            'home',
    transactions:    [],
    categories:      {},
    settings:        {},
    filterMonth:     new Date().getMonth(),
    filterYear:      new Date().getFullYear(),
    filterType:      'all',
    editingId:       null,
    txType:          'expense',
    selectedCat:     null,
    chartType:       'donut',
    catTabType:      'expense',
    statsPeriod:     'this-month',
    searchQuery:     '',
    deferredPrompt:  null,
  },

  /* ── Bootstrap ───────────────────────────────────────── */

  init() {
    this.state.settings    = DB.getSettings();
    this.state.categories  = DB.getCategories();
    this.state.transactions = DB.getTransactions();

    this._applyTheme(this.state.settings.theme);

    PIN.init(!!this.state.settings.pin, () => this._start());
  },

  _start() {
    this._bindNav();
    this._bindDashboard();
    this._bindTxForm();
    this._bindFilters();
    this._bindSearch();
    this._bindStats();
    this._bindSettings();
    this._bindCatModal();
    this._bindPinModal();

    this._updateGreeting();
    document.getElementById('date-input').value = this._todayStr();
    document.getElementById('amount-symbol').textContent = this.state.settings.currency;

    this._loadSettingsUI();
    this.renderDashboard();
    this._initInstallPrompt();

    // Handle URL shortcuts (e.g. ?action=add-expense)
    const action = new URLSearchParams(location.search).get('action');
    if (action === 'add-expense') this._openTxModal(null, 'expense');
    if (action === 'add-income')  this._openTxModal(null, 'income');
  },

  /* ── Theme ───────────────────────────────────────────── */

  _applyTheme(theme) {
    document.body.className = theme === 'light' ? 'light' : 'dark';
    document.getElementById('theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
    const dmToggle = document.getElementById('dark-mode-toggle');
    if (dmToggle) dmToggle.checked = theme !== 'light';
    const meta = document.getElementById('meta-theme-color');
    if (meta) meta.content = theme === 'dark' ? '#070711' : '#f2f3f8';
    this.state.settings.theme = theme;
  },

  _updateGreeting() {
    const h   = new Date().getHours();
    const greet = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    const name  = this.state.settings.userName;
    document.getElementById('greeting').textContent = name ? `${greet}, ${name} 👋` : `${greet} 👋`;
  },

  /* ── Navigation ──────────────────────────────────────── */

  _bindNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this._navigate(btn.dataset.view));
    });
    document.getElementById('fab-add').addEventListener('click', () => this._openTxModal());
    document.getElementById('theme-toggle').addEventListener('click', () => {
      const next = this.state.settings.theme === 'dark' ? 'light' : 'dark';
      this._applyTheme(next);
      DB.saveSettings({ theme: next });
      this._redrawCharts();
    });
    document.getElementById('see-all-btn').addEventListener('click', () => this._navigate('transactions'));
  },

  _navigate(view) {
    this.state.view = view;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));

    switch (view) {
      case 'home':         this.renderDashboard();  break;
      case 'transactions': this.renderTransactions(); break;
      case 'stats':        this.renderStats();       break;
      case 'settings':     this._loadSettingsUI();   break;
    }
  },

  /* ── Dashboard ───────────────────────────────────────── */

  _bindDashboard() {
    document.querySelectorAll('.pill-toggle .pill-btn[data-chart]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pill-toggle .pill-btn[data-chart]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.chartType = btn.dataset.chart;
        this._renderMainChart();
      });
    });
  },

  renderDashboard() {
    this.state.transactions = DB.getTransactions();
    this.state.settings     = DB.getSettings();

    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth();

    const monthly = this.state.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    const income  = monthly.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = monthly.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;
    const cur     = this.state.settings.currency;

    document.getElementById('balance-amount').textContent = this._fmt(balance, cur);
    document.getElementById('total-income').textContent   = this._fmt(income, cur);
    document.getElementById('total-expense').textContent  = this._fmt(expense, cur);

    const balEl = document.getElementById('balance-amount');
    balEl.classList.toggle('negative', balance < 0);
    balEl.classList.toggle('positive', balance >= 0);

    const periodLabel = now.toLocaleDateString('es', { month: 'long', year: 'numeric' });
    document.getElementById('balance-period').textContent = periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1);

    this._renderSavings(income - expense, this.state.settings.savingsGoal, cur);
    this._renderMainChart();

    const recent = [...this.state.transactions]
      .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0) || b.createdAt - a.createdAt)
      .slice(0, 6);
    this._renderTxList('recent-transactions', recent);
  },

  _renderSavings(savings, goal, cur) {
    const card = document.getElementById('savings-card');
    if (!goal || goal <= 0) { card.style.display = 'none'; return; }
    card.style.display = 'block';

    const pct  = Math.round((savings / goal) * 100);
    const safe = Math.min(Math.max(pct, 0), 100);

    document.getElementById('savings-percent').textContent   = pct + '%';
    document.getElementById('savings-progress').style.width = safe + '%';
    document.getElementById('savings-current').textContent   = this._fmt(Math.max(savings, 0), cur);
    document.getElementById('savings-goal-display').textContent = this._fmt(goal, cur);

    const bar = document.getElementById('savings-progress');
    bar.style.background = pct < 30 ? '#f43f5e' : pct < 70 ? '#f59e0b' : '#10b981';
  },

  _renderMainChart() {
    const canvas = document.getElementById('main-chart');
    if (!canvas.clientWidth) return;  // not visible yet
    const isDark = this.state.settings.theme !== 'light';

    if (this.state.chartType === 'donut') {
      const now    = new Date();
      const monthly = this.state.transactions.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && t.type === 'expense';
      });
      const pieData = this._groupByCategory(monthly, 'expense');
      Charts.drawDonut(canvas, pieData, isDark);
      this._renderLegend('chart-legend', pieData);

    } else {
      const { labels, incomes, expenses } = this._last6Months();
      Charts.drawBar(canvas, labels, incomes, expenses, isDark);
      document.getElementById('chart-legend').innerHTML = `
        <div class="legend-item"><span class="legend-dot" style="background:#10b981"></span>Ingresos</div>
        <div class="legend-item"><span class="legend-dot" style="background:#f43f5e"></span>Gastos</div>`;
    }
  },

  _redrawCharts() {
    if (this.state.view === 'home')  this._renderMainChart();
    if (this.state.view === 'stats') this.renderStats();
  },

  /* ── Transactions List ───────────────────────────────── */

  _renderTxList(containerId, transactions) {
    const el  = document.getElementById(containerId);
    if (!el) return;
    const cur  = this.state.settings.currency;
    const cats = [
      ...(this.state.categories.expense || []),
      ...(this.state.categories.income  || []),
    ];

    if (!transactions.length) {
      el.innerHTML = `<div class="empty-state">
        <span class="empty-icon">📋</span>
        <p>No hay movimientos</p>
        <p class="empty-sub">Toca + para agregar uno</p>
      </div>`;
      return;
    }

    // Group by date
    const groups = {};
    transactions.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });
    const dates = Object.keys(groups).sort((a, b) => (b > a ? 1 : -1));

    el.innerHTML = dates.map(date => {
      const txs   = groups[date];
      const delta = txs.reduce((s, t) => t.type === 'income' ? s + t.amount : s - t.amount, 0);
      const sign  = delta >= 0 ? '+' : '';
      const cls   = delta >= 0 ? 'income' : 'expense';
      const label = this._dateLabel(date);

      return `<div class="tx-group">
        <div class="tx-group-header">
          <span>${label}</span>
          <span class="tx-day-total ${cls}">${sign}${this._fmt(delta, cur)}</span>
        </div>
        ${txs.map(t => this._txItemHTML(t, cats, cur)).join('')}
      </div>`;
    }).join('');

    el.querySelectorAll('.tx-item').forEach(item => {
      item.addEventListener('click', () => this._openTxModal(item.dataset.id));
    });
  },

  _txItemHTML(t, cats, cur) {
    const cat   = cats.find(c => c.name === t.category || c.id === t.category);
    const icon  = cat?.icon  || (t.type === 'income' ? '💰' : '💸');
    const color = cat?.color || (t.type === 'income' ? '#10b981' : '#f43f5e');
    const sign  = t.type === 'income' ? '+' : '-';
    return `
      <div class="tx-item" data-id="${t.id}">
        <div class="tx-icon" style="background:${color}22;color:${color}">${icon}</div>
        <div class="tx-info">
          <div class="tx-category">${t.category}</div>
          ${t.description ? `<div class="tx-desc">${this._esc(t.description)}</div>` : ''}
        </div>
        <span class="tx-amount ${t.type}">${sign}${this._fmt(t.amount, cur)}</span>
      </div>`;
  },

  /* ── Transactions Page ───────────────────────────────── */

  renderTransactions() {
    this.state.transactions = DB.getTransactions();
    this.state.categories   = DB.getCategories();

    const d = new Date(this.state.filterYear, this.state.filterMonth);
    const label = d.toLocaleDateString('es', { month: 'long', year: 'numeric' });
    document.getElementById('filter-month-label').textContent =
      label.charAt(0).toUpperCase() + label.slice(1);

    let filtered = this.state.transactions.filter(t => {
      const td = new Date(t.date);
      return td.getFullYear() === this.state.filterYear && td.getMonth() === this.state.filterMonth;
    });

    if (this.state.filterType !== 'all') {
      filtered = filtered.filter(t => t.type === this.state.filterType);
    }
    if (this.state.searchQuery) {
      const q = this.state.searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.category.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
      );
    }

    const cur     = this.state.settings.currency;
    const income  = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    document.getElementById('filter-income').textContent  = this._fmt(income, cur);
    document.getElementById('filter-expense').textContent = this._fmt(expense, cur);

    const bal = document.getElementById('filter-balance');
    bal.textContent = this._fmt(income - expense, cur);
    bal.style.color = income - expense >= 0 ? 'var(--green)' : 'var(--red)';

    this._renderTxList('all-transactions', filtered);
  },

  _bindFilters() {
    document.getElementById('prev-month').addEventListener('click', () => {
      this.state.filterMonth--;
      if (this.state.filterMonth < 0) { this.state.filterMonth = 11; this.state.filterYear--; }
      this.renderTransactions();
    });
    document.getElementById('next-month').addEventListener('click', () => {
      this.state.filterMonth++;
      if (this.state.filterMonth > 11) { this.state.filterMonth = 0; this.state.filterYear++; }
      this.renderTransactions();
    });
    document.querySelectorAll('.type-chips .chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.type-chips .chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.filterType = btn.dataset.type;
        this.renderTransactions();
      });
    });
  },

  _bindSearch() {
    document.getElementById('search-toggle').addEventListener('click', () => {
      const bar = document.getElementById('search-bar');
      bar.classList.toggle('hidden');
      if (!bar.classList.contains('hidden')) document.getElementById('search-input').focus();
    });
    document.getElementById('search-input').addEventListener('input', e => {
      this.state.searchQuery = e.target.value.trim();
      this.renderTransactions();
    });
  },

  /* ── Transaction Form (Modal) ────────────────────────── */

  _bindTxForm() {
    document.getElementById('modal-tx-close').addEventListener('click', () => this._closeTxModal());
    document.getElementById('modal-transaction').addEventListener('click', e => {
      if (e.target === e.currentTarget) this._closeTxModal();
    });

    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.txType = btn.dataset.type;
        this._renderCatSelector();
      });
    });

    document.getElementById('save-tx-btn').addEventListener('click', () => this._saveTx());
    document.getElementById('delete-tx-btn').addEventListener('click', () => this._deleteTx());

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
    });
  },

  _openTxModal(editId = null, forceType = null) {
    this.state.editingId = editId;
    const isEdit = !!editId;

    document.getElementById('modal-tx-title').textContent = isEdit ? 'Editar Movimiento' : 'Nuevo Movimiento';
    document.getElementById('delete-tx-btn').classList.toggle('hidden', !isEdit);

    if (isEdit) {
      const tx = this.state.transactions.find(t => t.id === editId);
      if (!tx) return;
      this.state.txType    = tx.type;
      this.state.selectedCat = tx.category;
      document.getElementById('amount-input').value = tx.amount;
      document.getElementById('date-input').value   = tx.date;
      document.getElementById('desc-input').value   = tx.description || '';
    } else {
      this.state.txType    = forceType || 'expense';
      this.state.selectedCat = null;
      document.getElementById('amount-input').value = '';
      document.getElementById('date-input').value   = this._todayStr();
      document.getElementById('desc-input').value   = '';
    }

    document.querySelectorAll('.type-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.type === this.state.txType)
    );
    this._renderCatSelector();
    document.getElementById('modal-transaction').classList.remove('hidden');
    setTimeout(() => document.getElementById('amount-input').focus(), 100);
  },

  _closeTxModal() {
    document.getElementById('modal-transaction').classList.add('hidden');
    this.state.editingId = null;
  },

  _renderCatSelector() {
    const cats = (this.state.categories[this.state.txType] || []);
    const sel  = document.getElementById('category-selector');
    sel.innerHTML = cats.map(c => `
      <button class="cat-chip ${this.state.selectedCat === c.name ? 'selected' : ''}" data-cat="${this._esc(c.name)}">
        <span>${c.icon}</span><span>${this._esc(c.name)}</span>
      </button>`).join('');

    sel.querySelectorAll('.cat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        sel.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        this.state.selectedCat = chip.dataset.cat;
      });
    });
  },

  _saveTx() {
    const amount = parseFloat(document.getElementById('amount-input').value);
    const date   = document.getElementById('date-input').value;
    const desc   = document.getElementById('desc-input').value.trim();
    const cat    = this.state.selectedCat;

    if (!amount || amount <= 0) { this.showToast('Ingresa un monto válido', 'error'); return; }
    if (!date)   { this.showToast('Selecciona una fecha', 'error');   return; }
    if (!cat)    { this.showToast('Selecciona una categoría', 'error'); return; }

    const data = { type: this.state.txType, category: cat, amount, date, description: desc };

    if (this.state.editingId) {
      DB.updateTransaction(this.state.editingId, data);
      this.showToast('Movimiento actualizado', 'success');
    } else {
      DB.addTransaction(data);
      this.showToast('Movimiento registrado ✓', 'success');
    }

    this.state.transactions = DB.getTransactions();
    this._closeTxModal();
    this._navigate(this.state.view);   // re-render current view
  },

  _deleteTx() {
    if (!this.state.editingId) return;
    if (!confirm('¿Eliminar este movimiento?')) return;
    DB.deleteTransaction(this.state.editingId);
    this.state.transactions = DB.getTransactions();
    this._closeTxModal();
    this.showToast('Movimiento eliminado', 'info');
    this._navigate(this.state.view);
  },

  /* ── Stats ───────────────────────────────────────────── */

  _bindStats() {
    document.getElementById('stats-period').addEventListener('change', e => {
      this.state.statsPeriod = e.target.value;
      this.renderStats();
    });

    document.querySelectorAll('.pill-toggle .pill-btn[data-cat-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pill-toggle .pill-btn[data-cat-type]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.catTabType = btn.dataset.catType;
        this.renderStats();
      });
    });
  },

  renderStats() {
    this.state.transactions = DB.getTransactions();
    const txs    = this._filterByPeriod(this.state.transactions, this.state.statsPeriod);
    const cur    = this.state.settings.currency;
    const isDark = this.state.settings.theme !== 'light';

    const income  = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    document.getElementById('stats-income').textContent  = this._fmt(income, cur);
    document.getElementById('stats-expense').textContent = this._fmt(expense, cur);
    document.getElementById('stats-savings').textContent = this._fmt(income - expense, cur);
    document.getElementById('stats-count').textContent   = txs.length;

    // Bar chart — last 6 months
    const { labels, incomes, expenses } = this._last6Months();
    const barCanvas = document.getElementById('bar-chart');
    if (barCanvas.clientWidth) Charts.drawBar(barCanvas, labels, incomes, expenses, isDark);

    // Donut — by category
    const catTxs  = txs.filter(t => t.type === this.state.catTabType);
    const pieData = this._groupByCategory(catTxs, this.state.catTabType);
    const pieCanvas = document.getElementById('pie-chart');
    if (pieCanvas.clientWidth) Charts.drawDonut(pieCanvas, pieData, isDark);

    // Legend
    this._renderLegend('stats-legend', pieData, true);

    // Top categories
    const total   = pieData.reduce((s, d) => s + d.value, 0);
    const topEl   = document.getElementById('top-categories');
    topEl.innerHTML = pieData.slice(0, 5).map((d, i) => {
      const pct = total > 0 ? (d.value / total * 100) : 0;
      return `<div class="top-cat-item">
        <span class="top-cat-rank">#${i + 1}</span>
        <div class="top-cat-info">
          <span class="top-cat-name">${this._esc(d.label)}</span>
          <div class="top-cat-bar"><div class="top-cat-fill" style="width:${pct.toFixed(1)}%;background:${d.color}"></div></div>
        </div>
        <span class="top-cat-amount">${this._fmt(d.value, cur)}</span>
      </div>`;
    }).join('') || '<p class="empty-sub" style="padding:16px 8px">Sin datos en este período</p>';
  },

  _filterByPeriod(txs, period) {
    const now = new Date();
    return txs.filter(t => {
      const d = new Date(t.date);
      switch (period) {
        case 'this-month':  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        case 'last-month': {
          const lm = new Date(now.getFullYear(), now.getMonth() - 1);
          return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth();
        }
        case 'last-3': { const c = new Date(now); c.setMonth(c.getMonth() - 3); return d >= c; }
        case 'last-6': { const c = new Date(now); c.setMonth(c.getMonth() - 6); return d >= c; }
        case 'this-year': return d.getFullYear() === now.getFullYear();
        default: return true;
      }
    });
  },

  _last6Months() {
    const labels = [], incomes = [], expenses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      const y = d.getFullYear(), m = d.getMonth();
      labels.push(d.toLocaleDateString('es', { month: 'short' }));
      const mo = this.state.transactions.filter(t => { const td = new Date(t.date); return td.getFullYear() === y && td.getMonth() === m; });
      incomes.push(mo.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
      expenses.push(mo.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
    }
    return { labels, incomes, expenses };
  },

  _groupByCategory(txs, type) {
    const map  = {};
    txs.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    const cats = this.state.categories[type] || [];
    return Object.entries(map)
      .map(([name, value]) => {
        const cat = cats.find(c => c.name === name || c.id === name);
        return { label: name, value, color: cat?.color || Charts.PALETTE[Math.floor(Math.random() * Charts.PALETTE.length)] };
      })
      .sort((a, b) => b.value - a.value);
  },

  _renderLegend(elId, data, showPct = false) {
    const el    = document.getElementById(elId);
    if (!el) return;
    const total = data.reduce((s, d) => s + d.value, 0);
    const cur   = this.state.settings.currency;
    el.innerHTML = data.slice(0, 8).map(d => {
      const right = showPct && total > 0
        ? `<span class="legend-value">${Math.round(d.value / total * 100)}%</span>`
        : `<span class="legend-value">${this._fmt(d.value, cur)}</span>`;
      return `<div class="legend-item">
        <span class="legend-color" style="background:${d.color}"></span>
        <span class="legend-label">${this._esc(d.label)}</span>
        ${right}
      </div>`;
    }).join('');
  },

  /* ── Settings ────────────────────────────────────────── */

  _loadSettingsUI() {
    const s = DB.getSettings();
    document.getElementById('user-name').value         = s.userName   || '';
    document.getElementById('currency-select').value   = s.currency   || '$';
    document.getElementById('savings-goal-input').value = s.savingsGoal || '';
    document.getElementById('dark-mode-toggle').checked = s.theme !== 'light';
    document.getElementById('pin-status').textContent   = s.pin ? 'Configurado ✓' : 'No configurado';
    document.getElementById('amount-symbol').textContent = s.currency  || '$';
  },

  _bindSettings() {
    document.getElementById('user-name').addEventListener('change', e => {
      DB.saveSettings({ userName: e.target.value });
      this.state.settings = DB.getSettings();
      this._updateGreeting();
    });

    document.getElementById('currency-select').addEventListener('change', e => {
      DB.saveSettings({ currency: e.target.value });
      this.state.settings = DB.getSettings();
      document.getElementById('amount-symbol').textContent = e.target.value;
      if (this.state.view === 'home') this.renderDashboard();
    });

    document.getElementById('dark-mode-toggle').addEventListener('change', e => {
      const theme = e.target.checked ? 'dark' : 'light';
      this._applyTheme(theme);
      DB.saveSettings({ theme });
      this.state.settings = DB.getSettings();
      this._redrawCharts();
    });

    document.getElementById('save-goal-btn').addEventListener('click', () => {
      const goal = parseFloat(document.getElementById('savings-goal-input').value) || 0;
      DB.saveSettings({ savingsGoal: goal });
      this.state.settings = DB.getSettings();
      this.showToast('Meta de ahorro guardada', 'success');
      if (this.state.view === 'home') this.renderDashboard();
    });

    // Export
    document.getElementById('export-csv').addEventListener('click', () => {
      Export.toCSV(DB.getTransactions(), this.state.settings.currency);
      this.showToast('CSV exportado', 'success');
    });
    document.getElementById('export-excel').addEventListener('click', () => {
      Export.toExcel(DB.getTransactions(), this.state.settings.currency);
      this.showToast('Excel exportado', 'success');
    });
    document.getElementById('export-json').addEventListener('click', () => {
      Export.toJSON({ transactions: DB.getTransactions(), categories: DB.getCategories(), settings: DB.getSettings() });
      this.showToast('Backup creado', 'success');
    });

    document.getElementById('import-json').addEventListener('click', () =>
      document.getElementById('import-file').click()
    );
    document.getElementById('import-file').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await Export.fromJSON(file);
        if (data.transactions) DB.saveTransactions(data.transactions);
        if (data.categories)   DB.saveCategories(data.categories);
        this.state.transactions = DB.getTransactions();
        this.state.categories   = DB.getCategories();
        this._loadSettingsUI();
        this.renderDashboard();
        this.showToast('Datos importados correctamente', 'success');
      } catch (err) {
        this.showToast('Error: ' + err.message, 'error');
      }
      e.target.value = '';
    });

    document.getElementById('clear-data-btn').addEventListener('click', () => {
      if (!confirm('¿Eliminar TODOS los datos? Esta acción no se puede deshacer.')) return;
      DB.clearAll();
      this.state.transactions = [];
      this.state.categories   = DB.getCategories();
      this.state.settings     = DB.getSettings();
      this._loadSettingsUI();
      this.renderDashboard();
      this.showToast('Datos eliminados', 'info');
    });
  },

  /* ── Categories Modal ────────────────────────────────── */

  _bindCatModal() {
    document.getElementById('manage-categories-btn').addEventListener('click', () => {
      this.state.categories = DB.getCategories();
      this.state.catTabType = 'expense';
      document.querySelectorAll('[data-cat-tab]').forEach(b =>
        b.classList.toggle('active', b.dataset.catTab === 'expense')
      );
      this._renderCatGrid();
      document.getElementById('modal-categories').classList.remove('hidden');
    });

    document.getElementById('cat-modal-close').addEventListener('click', () =>
      document.getElementById('modal-categories').classList.add('hidden')
    );
    document.getElementById('modal-categories').addEventListener('click', e => {
      if (e.target === e.currentTarget) document.getElementById('modal-categories').classList.add('hidden');
    });

    document.querySelectorAll('[data-cat-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-cat-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.catTabType = btn.dataset.catTab;
        this._renderCatGrid();
      });
    });

    document.getElementById('add-cat-btn').addEventListener('click', () => {
      const emoji = (document.getElementById('new-cat-emoji').value.trim() || '🏷');
      const name  = document.getElementById('new-cat-name').value.trim();
      if (!name) { this.showToast('Escribe un nombre', 'error'); return; }
      DB.addCategory(this.state.catTabType, {
        name, icon: emoji,
        color: Charts.PALETTE[Math.floor(Math.random() * Charts.PALETTE.length)]
      });
      this.state.categories = DB.getCategories();
      this._renderCatGrid();
      document.getElementById('new-cat-emoji').value = '';
      document.getElementById('new-cat-name').value  = '';
      this.showToast('Categoría agregada', 'success');
    });
  },

  _renderCatGrid() {
    const cats = (this.state.categories[this.state.catTabType] || []);
    const grid = document.getElementById('categories-grid');
    grid.innerHTML = cats.map(c => `
      <div class="cat-manage-item">
        <span class="cat-manage-icon">${c.icon}</span>
        <span class="cat-manage-name">${this._esc(c.name)}</span>
        <button class="cat-delete-btn" data-id="${c.id}" data-t="${this.state.catTabType}">✕</button>
      </div>`).join('');

    grid.querySelectorAll('.cat-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        DB.deleteCategory(btn.dataset.t, btn.dataset.id);
        this.state.categories = DB.getCategories();
        this._renderCatGrid();
        this.showToast('Categoría eliminada', 'info');
      });
    });
  },

  /* ── PIN Setup Modal ─────────────────────────────────── */

  _bindPinModal() {
    document.getElementById('pin-setup-btn').addEventListener('click', () => {
      PIN.setupFlow.init();
      document.getElementById('modal-pin-setup').classList.remove('hidden');
    });
    document.getElementById('pin-setup-close').addEventListener('click', () =>
      document.getElementById('modal-pin-setup').classList.add('hidden')
    );
    document.getElementById('modal-pin-setup').addEventListener('click', e => {
      if (e.target === e.currentTarget) document.getElementById('modal-pin-setup').classList.add('hidden');
    });
  },

  /* ── Toast ───────────────────────────────────────────── */

  showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${this._esc(msg)}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  /* ── PWA Install Prompt ──────────────────────────────── */

  _initInstallPrompt() {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this.state.deferredPrompt = e;
      setTimeout(() => this._showInstallBanner(), 4000);
    });
    window.addEventListener('appinstalled', () => this.showToast('¡App instalada! 🎉', 'success'));
  },

  _showInstallBanner() {
    if (!this.state.deferredPrompt) return;
    const banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.innerHTML = `
      <div class="install-banner-content">
        <span class="install-icon">📲</span>
        <div class="install-text">
          <strong>Instalar FinanzApp</strong>
          <span>Accede desde tu pantalla de inicio</span>
        </div>
      </div>
      <div class="install-actions">
        <button class="btn btn-outline install-later">Después</button>
        <button class="btn btn-primary install-now">Instalar</button>
      </div>`;
    document.body.appendChild(banner);

    banner.querySelector('.install-now').addEventListener('click', async () => {
      this.state.deferredPrompt.prompt();
      await this.state.deferredPrompt.userChoice;
      this.state.deferredPrompt = null;
      banner.remove();
    });
    banner.querySelector('.install-later').addEventListener('click', () => banner.remove());
    setTimeout(() => banner.remove(), 12000);
  },

  /* ── Helpers ─────────────────────────────────────────── */

  _fmt(amount, cur = '$') {
    return `${cur}${Math.abs(amount).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  _todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  _dateLabel(dateStr) {
    const today     = this._todayStr();
    const yesterday = (() => { const d = new Date(); d.setDate(d.getDate()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
    if (dateStr === today)     return 'Hoy';
    if (dateStr === yesterday) return 'Ayer';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  },

  _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
};

/* ── Entry Point ──────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  App.init();

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.info('[SW] Registered, scope:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err));
  }
});
