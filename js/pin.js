/**
 * FinanzApp — PIN management
 */
const PIN = {
  _input:     '',
  _onSuccess: null,

  /* ── Lock Screen (app startup) ────────────────────────── */

  init(hasPin, onSuccess) {
    this._onSuccess = onSuccess;
    if (!hasPin) {
      document.getElementById('pin-screen').style.display = 'none';
      document.getElementById('app').classList.remove('hidden');
      onSuccess();
      return;
    }

    this._input = '';
    document.getElementById('pin-screen').style.display = 'flex';
    document.getElementById('app').classList.add('hidden');

    this._bindKeys(
      '#pin-screen .pin-key',
      '#pin-delete',
      'pin-dots',
      () => this._verify()
    );
  },

  _verify() {
    const settings = DB.getSettings();
    if (this._input === settings.pin) {
      document.getElementById('pin-screen').style.display = 'none';
      document.getElementById('app').classList.remove('hidden');
      if (this._onSuccess) this._onSuccess();
    } else {
      this._showError('pin-error', 'PIN incorrecto');
      this._shakeDots('pin-dots');
      this._input = '';
      this._fillDots('pin-dots', 0);
    }
  },

  /* ── Setup Flow (settings modal) ─────────────────────── */

  setupFlow: {
    _step:     'enter',    // 'enter' | 'confirm'
    _first:    '',
    _input:    '',

    init() {
      this._step  = 'enter';
      this._first = '';
      this._input = '';
      PIN._fillDots('pin-setup-dots', 0);

      document.getElementById('pin-setup-title').textContent = 'Configurar PIN';
      document.getElementById('pin-setup-desc').textContent  = 'Ingresa un PIN de 4 dígitos';

      // Remove-PIN button visibility
      const settings   = DB.getSettings();
      const removeBtn  = document.getElementById('remove-pin-btn');
      removeBtn.classList.toggle('hidden', !settings.pin);
      removeBtn.onclick = () => {
        DB.saveSettings({ pin: null });
        document.getElementById('pin-status').textContent = 'No configurado';
        document.getElementById('modal-pin-setup').classList.add('hidden');
        App.showToast('PIN eliminado', 'success');
      };

      PIN._bindKeys(
        '#modal-pin-setup .pin-key',
        '#pin-setup-del',
        'pin-setup-dots',
        () => this._advance()
      );
    },

    _advance() {
      if (this._step === 'enter') {
        this._first = this._input;
        this._input = '';
        this._step  = 'confirm';
        PIN._fillDots('pin-setup-dots', 0);
        document.getElementById('pin-setup-title').textContent = 'Confirmar PIN';
        document.getElementById('pin-setup-desc').textContent  = 'Repite el PIN para confirmar';
      } else {
        if (this._input === this._first) {
          DB.saveSettings({ pin: this._input });
          document.getElementById('pin-status').textContent = 'Configurado ✓';
          document.getElementById('modal-pin-setup').classList.add('hidden');
          App.showToast('PIN configurado', 'success');
        } else {
          PIN._fillDots('pin-setup-dots', 0);
          PIN._shakeDots('pin-setup-dots');
          this._input = '';
          this._first = '';
          this._step  = 'enter';
          document.getElementById('pin-setup-title').textContent = 'Configurar PIN';
          document.getElementById('pin-setup-desc').textContent  = 'Los PINs no coinciden. Intenta de nuevo';
        }
      }
    },
  },

  /* ── Shared helpers ───────────────────────────────────── */

  _bindKeys(keySelector, delSelector, dotsId, onComplete) {
    // Remove old listeners by cloning
    document.querySelectorAll(keySelector).forEach(btn => {
      const fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
    });
    const delBtn = document.querySelector(delSelector);
    if (delBtn) {
      const fresh = delBtn.cloneNode(true);
      delBtn.parentNode.replaceChild(fresh, delBtn);
    }

    // Reference to appropriate _input field
    const flow = keySelector.includes('modal-pin-setup') ? this.setupFlow : this;

    document.querySelectorAll(keySelector).forEach(btn => {
      const key = btn.dataset.key ?? btn.dataset.skey;
      if (key === undefined) return;
      btn.addEventListener('click', () => {
        if (flow._input.length >= 4) return;
        flow._input += key;
        this._fillDots(dotsId, flow._input.length);
        if (flow._input.length === 4) setTimeout(onComplete, 180);
      });
    });

    const freshDel = document.querySelector(delSelector);
    if (freshDel) {
      freshDel.addEventListener('click', () => {
        flow._input = flow._input.slice(0, -1);
        this._fillDots(dotsId, flow._input.length);
      });
    }
  },

  _fillDots(dotsId, count) {
    const container = document.getElementById(dotsId);
    if (!container) return;
    container.querySelectorAll('.pin-dot').forEach((dot, i) => {
      dot.classList.toggle('filled', i < count);
    });
  },

  _shakeDots(dotsId) {
    const container = document.getElementById(dotsId);
    if (!container) return;
    container.classList.add('shake');
    setTimeout(() => container.classList.remove('shake'), 500);
  },

  _showError(elId, msg) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
  },
};
