/**
 * FinanzApp — Chart rendering (Canvas API, no dependencies)
 */
const Charts = {
  PALETTE: [
    '#7c3aed','#10b981','#f43f5e','#f59e0b','#06b6d4',
    '#8b5cf6','#3b82f6','#ec4899','#14b8a6','#84cc16',
    '#f97316','#6366f1','#a855f7','#2dd4bf','#fb923c'
  ],

  /* ── Helpers ──────────────────────────────────────────── */

  _setup(canvas) {
    const dpr  = window.devicePixelRatio || 1;
    const w    = canvas.clientWidth  || canvas.parentElement?.clientWidth || 300;
    const h    = canvas.clientHeight || canvas.parentElement?.clientHeight || 200;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w, h };
  },

  _shortNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return Math.round(n).toString();
  },

  /* ── Donut / Pie ──────────────────────────────────────── */

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{label, value, color}>} data
   * @param {boolean} isDark
   */
  drawDonut(canvas, data, isDark = true) {
    const { ctx, w, h } = this._setup(canvas);
    const cx = w / 2;
    const cy = h / 2;
    const r  = Math.min(cx, cy) * 0.82;
    const ir = r * 0.58;            // inner radius (hole)

    ctx.clearRect(0, 0, w, h);

    const emptyColor = isDark ? '#1e1e35' : '#e0e3ee';
    const textColor  = isDark ? '#f0f0ff' : '#0d0d1a';
    const subColor   = isDark ? '#8080a8' : '#5a5a78';

    if (!data || data.length === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = emptyColor;
      ctx.lineWidth   = r - ir;
      ctx.stroke();
      ctx.fillStyle = subColor;
      ctx.font      = '14px Inter, sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Sin datos', cx, cy);
      return;
    }

    const total = data.reduce((s, d) => s + d.value, 0);
    let angle = -Math.PI / 2;
    const gap  = 0.03;

    data.forEach((item, i) => {
      const slice = (item.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle + gap, angle + slice - gap);
      ctx.closePath();
      ctx.fillStyle = item.color || this.PALETTE[i % this.PALETTE.length];
      ctx.fill();
      angle += slice;
    });

    // Donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, ir, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? '#111120' : '#ffffff';
    ctx.fill();

    // Center label
    const top = data[0];
    const pct = Math.round((top.value / total) * 100);
    ctx.fillStyle    = textColor;
    ctx.font         = `bold 18px Inter, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pct + '%', cx, cy - 8);
    ctx.fillStyle = subColor;
    ctx.font      = '11px Inter, sans-serif';
    ctx.fillText(top.label.length > 10 ? top.label.slice(0,10)+'…' : top.label, cx, cy + 12);
  },

  /* ── Bar Chart ────────────────────────────────────────── */

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {string[]} labels
   * @param {number[]} incomeData
   * @param {number[]} expenseData
   * @param {boolean} isDark
   */
  drawBar(canvas, labels, incomeData, expenseData, isDark = true) {
    const { ctx, w, h } = this._setup(canvas);

    const pad    = { top: 20, right: 10, bottom: 36, left: 44 };
    const cw     = w - pad.left - pad.right;
    const ch     = h - pad.top  - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    const allVals = [...incomeData, ...expenseData];
    const maxVal  = Math.max(...allVals, 1);
    const gridColor  = isDark ? '#1e1e35' : '#e0e3ee';
    const labelColor = isDark ? '#8080a8' : '#5a5a78';

    // Y-axis grid lines & labels
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = pad.top + ch - (i / steps) * ch;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + cw, y);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth   = 1;
      ctx.stroke();

      ctx.fillStyle    = labelColor;
      ctx.font         = '10px Inter, sans-serif';
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(this._shortNum(maxVal * i / steps), pad.left - 5, y);
    }

    const n          = labels.length;
    const groupW     = cw / n;
    const barW       = Math.min(groupW * 0.32, 18);
    const barGap     = 3;

    labels.forEach((label, i) => {
      const cx  = pad.left + i * groupW + groupW / 2;

      // Income bar
      const ih = Math.max((incomeData[i] / maxVal) * ch, 2);
      const iy = pad.top + ch - ih;
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(cx - barW - barGap, iy, barW, ih, [3, 3, 0, 0]);
      } else {
        ctx.rect(cx - barW - barGap, iy, barW, ih);
      }
      ctx.fill();

      // Expense bar
      const eh = Math.max((expenseData[i] / maxVal) * ch, 2);
      const ey = pad.top + ch - eh;
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(cx + barGap, ey, barW, eh, [3, 3, 0, 0]);
      } else {
        ctx.rect(cx + barGap, ey, barW, eh);
      }
      ctx.fill();

      // X label
      ctx.fillStyle    = labelColor;
      ctx.font         = '10px Inter, sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, cx, pad.top + ch + 6);
    });
  },
};
