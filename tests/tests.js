(function (global) {
  'use strict';

  function close(a, b, tol) { return Math.abs(a - b) <= tol; }
  function vecClose(a, b, tol) { return a.length === b.length && a.every((x, i) => close(x, b[i], tol)); }
  function assert(cond, msg) { if (!cond) throw new Error(msg); }

  function test(name, input, expected, fn) {
    const started = performance.now();
    console.log('%c[LAB1 TEST] ▶ ' + name, 'font-weight:bold');
    console.log('  Вход:', input);
    console.log('  Ожидается:', expected);
    try {
      const actual = fn();
      const ms = (performance.now() - started).toFixed(2);
      console.log('  Получено:', actual);
      console.log('%c  ✓ PASS (' + ms + ' ms)', 'color:green;font-weight:bold');
      return { name, ok: true, input, expected, actual, time: ms };
    } catch (e) {
      const ms = (performance.now() - started).toFixed(2);
      console.error('  ✗ FAIL (' + ms + ' ms): ' + e.message);
      return { name, ok: false, input, expected, actual: null, msg: e.message, time: ms };
    }
  }

  function runColorTests(show = false) {
    console.groupCollapsed('%cЛабораторная №1 — автоматические тесты цветовой математики', 'font-weight:bold;font-size:14px');
    console.log('Тестовый запуск начат:', new Date().toLocaleTimeString());

    const T = [];

    T.push(test(
      'RGB(255,0,0) → LAB D65',
      'RGB = [255, 0, 0], illuminant = D65',
      'LAB ≈ [53.2408, 80.0925, 67.2032]',
      () => {
        const lab = ColorMath.xyzToLab(ColorMath.rgbToXyz([255, 0, 0], 'D65'), 'D65');
        assert(vecClose(lab, [53.2408, 80.0925, 67.2032], 0.03), `получено ${lab.map(x => x.toFixed(4)).join(', ')}`);
        return lab.map(x => x.toFixed(4));
      }
    ));

    T.push(test(
      'RGB(255,0,0) → CMYK',
      'RGB = [255, 0, 0], algorithm = GCR',
      'CMYK = [0, 100, 100, 0] %',
      () => {
        const c = ColorMath.rgbToCmyk([255, 0, 0], 'GCR', 1).map(x => x * 100);
        assert(vecClose(c, [0, 100, 100, 0], 1e-9), `получено ${c.join(', ')}`);
        return c.map(x => x.toFixed(4) + ' %');
      }
    ));

    T.push(test(
      'RGB → XYZ → RGB, D65',
      'RGB = [12, 137, 244]',
      'После обратного преобразования RGB ≈ исходному',
      () => {
        const src = [12, 137, 244];
        const xyz = ColorMath.rgbToXyz(src, 'D65');
        const back = ColorMath.xyzToRgb(xyz, 'D65', 'clip').rgb;
        assert(vecClose(src, back, 0.02), `получено ${back.join(', ')}`);
        return { XYZ: xyz.map(x => x.toFixed(4)), RGB: back.map(x => x.toFixed(4)) };
      }
    ));

    T.push(test(
      'LAB → XYZ → LAB, D50',
      'LAB = [62, 24, -38], illuminant = D50',
      'После обратного преобразования LAB ≈ исходному',
      () => {
        const src = [62, 24, -38];
        const xyz = ColorMath.labToXyz(src, 'D50');
        const back = ColorMath.xyzToLab(xyz, 'D50');
        assert(vecClose(src, back, 1e-8), `получено ${back.join(', ')}`);
        return { XYZ: xyz.map(x => x.toFixed(4)), LAB: back.map(x => x.toFixed(4)) };
      }
    ));

    T.push(test(
      'Динамический расчёт матрицы RGB → XYZ',
      'Стандарт освещения = D65',
      'Диагональные коэффициенты sRGB/D65',
      () => {
        const M = ColorMath.buildRgbXyzMatrices('D65').rgbToXyz;
        assert(close(M[0][0], 0.41239, 0.0002) && close(M[1][1], 0.71517, 0.0002) && close(M[2][2], 0.95053, 0.0003), 'матрица отличается от ожидаемой sRGB/D65');
        return M.map(row => row.map(x => x.toFixed(6)));
      }
    ));

    T.push(test(
      'Смена D65 → D50 меняет матрицу',
      'Сравнение RGB→XYZ для D65 и D50',
      'Матрицы должны отличаться',
      () => {
        const a = ColorMath.buildRgbXyzMatrices('D65').rgbToXyz;
        const b = ColorMath.buildRgbXyzMatrices('D50').rgbToXyz;
        assert(Math.abs(a[0][0] - b[0][0]) > 1e-4, 'матрицы не пересчитались');
        return { D65: a[0][0].toFixed(6), D50: b[0][0].toFixed(6) };
      }
    ));

    T.push(test(
      'GCR заменяет серую составляющую',
      'RGB = [160,160,160], GCR, сила = 100%',
      'CMY ≈ 0, K > 0',
      () => {
        const c = ColorMath.rgbToCmyk([160, 160, 160], 'GCR', 1);
        assert(c[3] > 0.3 && c[0] < 1e-9 && c[1] < 1e-9 && c[2] < 1e-9, `CMYK=${c}`);
        return c.map(x => (x * 100).toFixed(2) + ' %');
      }
    ));

    T.push(test(
      'UCR и GCR дают различное количество K',
      'RGB = [160,160,160], сила = 100%',
      'UCR K < GCR K',
      () => {
        const u = ColorMath.rgbToCmyk([160, 160, 160], 'UCR', 1);
        const g = ColorMath.rgbToCmyk([160, 160, 160], 'GCR', 1);
        assert(u[3] < g[3], 'UCR K должен быть меньше GCR K');
        return { UCR_K: (u[3] * 100).toFixed(2) + ' %', GCR_K: (g[3] * 100).toFixed(2) + ' %' };
      }
    ));

    const passed = T.filter(x => x.ok).length;
    const total = T.length;
    const failed = total - passed;
    console.log('Результат:', passed + '/' + total, 'пройдено. Ошибок:', failed);
    console.table(T.map(x => ({ Тест: x.name, Результат: x.ok ? 'PASS' : 'FAIL', 'Время_мс': x.time })));
    console.groupEnd();

    const box = document.getElementById('test-results');
    if (box) {
      box.innerHTML = `<strong>${passed}/${total} тестов пройдено</strong>` +
        T.map(x => `<div class="test ${x.ok ? 'ok' : 'bad'}">${x.ok ? '✓' : '✗'} ${x.name}${x.msg ? ' — ' + x.msg : ''}</div>`).join('');
      if (show) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const results = document.getElementById('test-results');

      if (results) {
        results.textContent = `Проверено: ${passed}/${total} тестов · Ошибок: ${failed}`;
      }
    }
    return { passed, total, results: T };
  }

  global.runColorTests = runColorTests;
})(window);
