/**
 * FinanzApp — Data Layer (localStorage)
 */
const DB = {
  KEYS: {
    TRANSACTIONS: 'fa_transactions',
    CATEGORIES:   'fa_categories',
    SETTINGS:     'fa_settings',
  },

  DEFAULT_CATEGORIES: {
    expense: [
      { id: 'food',          name: 'Alimentación',   icon: '🍔', color: '#f43f5e' },
      { id: 'transport',     name: 'Transporte',      icon: '🚗', color: '#f59e0b' },
      { id: 'housing',       name: 'Vivienda',        icon: '🏠', color: '#06b6d4' },
      { id: 'entertainment', name: 'Entretenimiento', icon: '🎬', color: '#8b5cf6' },
      { id: 'health',        name: 'Salud',           icon: '💊', color: '#10b981' },
      { id: 'education',     name: 'Educación',       icon: '📚', color: '#3b82f6' },
      { id: 'clothes',       name: 'Ropa',            icon: '👕', color: '#ec4899' },
      { id: 'tech',          name: 'Tecnología',      icon: '💻', color: '#6366f1' },
      { id: 'sports',        name: 'Deporte',         icon: '⚽', color: '#14b8a6' },
      { id: 'beauty',        name: 'Belleza',         icon: '💄', color: '#d946ef' },
      { id: 'pets',          name: 'Mascotas',        icon: '🐾', color: '#78716c' },
      { id: 'gifts',         name: 'Regalos',         icon: '🎁', color: '#fb923c' },
      { id: 'services',      name: 'Servicios',       icon: '💡', color: '#84cc16' },
      { id: 'other-exp',     name: 'Otros',           icon: '💸', color: '#94a3b8' },
    ],
    income: [
      { id: 'salary',      name: 'Salario',     icon: '💼', color: '#10b981' },
      { id: 'freelance',   name: 'Freelance',   icon: '🖥',  color: '#06b6d4' },
      { id: 'business',    name: 'Negocio',     icon: '🏪', color: '#f59e0b' },
      { id: 'investment',  name: 'Inversiones', icon: '📈', color: '#8b5cf6' },
      { id: 'rental',      name: 'Alquiler',    icon: '🏡', color: '#3b82f6' },
      { id: 'bonus',       name: 'Bonos',       icon: '🎯', color: '#f43f5e' },
      { id: 'gifts-in',    name: 'Regalos',     icon: '🎁', color: '#fb923c' },
      { id: 'other-inc',   name: 'Otros',       icon: '💰', color: '#94a3b8' },
    ]
  },

  DEFAULT_SETTINGS: {
    theme:       'dark',
    currency:    '$',
    userName:    '',
    pin:         null,
    savingsGoal: 0,
  },

  /* ── Transactions ─────────────────────────────────────── */

  getTransactions() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.TRANSACTIONS)) || [];
    } catch { return []; }
  },

  saveTransactions(list) {
    localStorage.setItem(this.KEYS.TRANSACTIONS, JSON.stringify(list));
  },

  addTransaction(data) {
    const list = this.getTransactions();
    const tx = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...data,
      createdAt: Date.now(),
    };
    list.push(tx);
    this.saveTransactions(list);
    return tx;
  },

  updateTransaction(id, updates) {
    const list = this.getTransactions();
    const idx  = list.findIndex(t => t.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updatedAt: Date.now() };
    this.saveTransactions(list);
    return list[idx];
  },

  deleteTransaction(id) {
    const list = this.getTransactions();
    const next = list.filter(t => t.id !== id);
    this.saveTransactions(next);
    return next.length < list.length;
  },

  /* ── Categories ───────────────────────────────────────── */

  getCategories() {
    try {
      const stored = JSON.parse(localStorage.getItem(this.KEYS.CATEGORIES));
      if (stored && stored.expense && stored.income) return stored;
    } catch { /* fall through */ }
    this.saveCategories(this.DEFAULT_CATEGORIES);
    return JSON.parse(JSON.stringify(this.DEFAULT_CATEGORIES));
  },

  saveCategories(cats) {
    localStorage.setItem(this.KEYS.CATEGORIES, JSON.stringify(cats));
  },

  addCategory(type, data) {
    const cats  = this.getCategories();
    const entry = { id: `cat_${Date.now()}`, ...data };
    cats[type].push(entry);
    this.saveCategories(cats);
    return entry;
  },

  deleteCategory(type, id) {
    const cats = this.getCategories();
    cats[type] = cats[type].filter(c => c.id !== id);
    this.saveCategories(cats);
  },

  /* ── Settings ─────────────────────────────────────────── */

  getSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(this.KEYS.SETTINGS));
      return { ...this.DEFAULT_SETTINGS, ...(stored || {}) };
    } catch { return { ...this.DEFAULT_SETTINGS }; }
  },

  saveSettings(patch) {
    const current = this.getSettings();
    const updated = { ...current, ...patch };
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  },

  /* ── Helpers ──────────────────────────────────────────── */

  getByMonth(year, month) {
    return this.getTransactions().filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  },

  clearAll() {
    Object.values(this.KEYS).forEach(k => localStorage.removeItem(k));
  },
};
