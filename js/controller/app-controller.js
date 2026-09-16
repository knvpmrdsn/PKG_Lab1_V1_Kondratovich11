(function (global) {
  'use strict';
  class AppController {
    constructor(view) {
      this.view = view; this.rgb = [80, 120, 220]; this.activeModel = 'RGB'; this.warning = false;
      this.opts = { illuminant: 'D65', gamut: 'clip', cmykAlgorithm: 'GCR', cmykStrength: 1 };
      this.bind(); this.render();
    }
    bind() {
      document.getElementById('models').addEventListener('input', e => {
        if (!e.target.matches('input[data-model]')) return;
        const model = e.target.dataset.model, idx = +e.target.dataset.index;
        this.activeModel = model; this.view.setActiveModel(model);
        const values = this.getModelValues(model); values[idx] = Number(e.target.value);
        const result = ColorMath.convertFrom(model, values, this.opts); this.rgb = result.rgb; this.warning = result.warning; this.render(model);
      });
      document.getElementById('models').addEventListener('click', e => { const b = e.target.closest('.use-model'); if (b) { this.activeModel = b.dataset.model; this.view.setActiveModel(this.activeModel); } });
      document.getElementById('illuminant').addEventListener('change', e => { this.opts.illuminant = e.target.value; this.reinterpretActive(); });
      document.getElementById('gamut').addEventListener('change', e => { this.opts.gamut = e.target.value; this.reinterpretActive(); });
      document.getElementById('cmyk-alg').addEventListener('change', e => { this.opts.cmykAlgorithm = e.target.value; this.render(); });
      document.getElementById('cmyk-strength').addEventListener('input', e => { this.opts.cmykStrength = Number(e.target.value) / 100; document.getElementById('strength-label').textContent = e.target.value + '%'; this.render(); });
      document.getElementById('native-picker').addEventListener('input', e => { this.activeModel = 'RGB'; this.rgb = ColorMath.hexToRgb(e.target.value); this.warning = false; this.render(); });
      document.getElementById('hex').addEventListener('change', e => { try { this.activeModel = 'RGB'; this.rgb = ColorMath.hexToRgb(e.target.value); this.warning = false; this.render(); } catch (err) { this.view.setWarning(true, err.message); } });
      document.getElementById('copy-hex').addEventListener('click', async () => { try { await navigator.clipboard.writeText(ColorMath.rgbToHex(this.rgb)); const b = document.getElementById('copy-hex'); const old = b.textContent; b.textContent = 'Скопировано'; setTimeout(() => b.textContent = old, 900); } catch (_) { } });
      document.getElementById('run-tests').addEventListener('click', () => {
        const button = document.getElementById('run-tests');

        console.log('[LAB1] Кнопка «Запустить снова» нажата');

        button.disabled = true;
        button.textContent = 'Проверка…';

        setTimeout(() => {
          if (typeof window.runColorTests === 'function') {
            window.runColorTests(true);
          }

          button.textContent = '✓ Проверено';

          setTimeout(() => {
            button.textContent = 'Запустить снова';
            button.disabled = false;
          }, 1200);
        }, 50);
      });
    }
    getModelValues(model) { return this.view.modelEls[model].map(x => Number(x.number.value)); }
    reinterpretActive() { const vals = this.getModelValues(this.activeModel); const r = ColorMath.convertFrom(this.activeModel, vals, this.opts); this.rgb = r.rgb; this.warning = r.warning; this.render(this.activeModel); }
    render(sourceModel) {
      const all = ColorMath.allFromRgb(this.rgb, this.opts); this.view.setActiveModel(this.activeModel); this.view.setValues(all, sourceModel || this.activeModel);
      const hex = ColorMath.rgbToHex(this.rgb); this.view.setPreview(this.rgb, hex);
      this.view.setMatrix(ColorMath.buildRgbXyzMatrices(this.opts.illuminant));
      this.view.setWarning(this.warning, `Цвет вышел за границы sRGB. Применена стратегия «${this.opts.gamut === 'clip' ? 'Clipping — обрезание' : 'Scaling — пропорциональное сжатие цветности'}».`);
      this.updateGradients(all);
    }
    updateGradients(all) {
      const steps = 14;
      for (const [model, channels] of Object.entries(this.view.modelEls)) {
        const base = all[model].slice();
        channels.forEach((ch, idx) => {
          const min = Number(ch.range.min), max = Number(ch.range.max), colors = [];
          for (let s = 0; s <= steps; s++) {
            const vals = base.slice(); vals[idx] = min + (max - min) * s / steps;
            let rgb;
            try { rgb = ColorMath.convertFrom(model, vals, this.opts).rgb; } catch (_) { rgb = this.rgb; }
            colors.push(`${ColorMath.rgbToHex(rgb)} ${(s / steps * 100).toFixed(1)}%`);
          }
          ch.wrap.style.background = `linear-gradient(90deg,${colors.join(',')})`;
        });
      }
    }
  }
  global.AppController = AppController;
})(window);
