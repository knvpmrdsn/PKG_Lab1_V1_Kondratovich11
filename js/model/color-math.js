(function (global) {
  'use strict';

  const EPS = 1e-12;

  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function degNorm(h) { h %= 360; return h < 0 ? h + 360 : h; }
  function round(x, n = 4) { const p = 10 ** n; return Math.round((x + Number.EPSILON) * p) / p; }

  function matMul3(A, B) {
    return [
      A[0][0]*B[0] + A[0][1]*B[1] + A[0][2]*B[2],
      A[1][0]*B[0] + A[1][1]*B[1] + A[1][2]*B[2],
      A[2][0]*B[0] + A[2][1]*B[1] + A[2][2]*B[2]
    ];
  }

  function inv3(m) {
    const a=m[0][0], b=m[0][1], c=m[0][2];
    const d=m[1][0], e=m[1][1], f=m[1][2];
    const g=m[2][0], h=m[2][1], i=m[2][2];
    const A=e*i-f*h, B=-(d*i-f*g), C=d*h-e*g;
    const D=-(b*i-c*h), E=a*i-c*g, F=-(a*h-b*g);
    const G=b*f-c*e, H=-(a*f-c*d), I=a*e-b*d;
    const det=a*A+b*B+c*C;
    if (Math.abs(det) < EPS) throw new Error('Матрица вырождена');
    return [[A/det,D/det,G/det],[B/det,E/det,H/det],[C/det,F/det,I/det]];
  }

  const PRIMARIES = Object.freeze({
    r: {x: 0.64, y: 0.33},
    g: {x: 0.30, y: 0.60},
    b: {x: 0.15, y: 0.06}
  });

  // Only chromaticities of reference illuminants are stored. Transition matrices are NOT stored:
  // they are rebuilt from primary chromaticities + selected white point every time the illuminant changes.
  const ILLUMINANTS = Object.freeze({
    D65: {name:'D65 — средний дневной свет', x:0.31270, y:0.32900},
    D50: {name:'D50 — тёплый дневной свет', x:0.34567, y:0.35850},
    E:   {name:'E — равноэнергетический', x:1/3, y:1/3}
  });

  function xyToXYZ(x, y, Y = 1) {
    if (y <= 0) throw new Error('Координата y точки белого должна быть > 0');
    return [x * Y / y, Y, (1 - x - y) * Y / y];
  }

  function buildRgbXyzMatrices(illuminant = 'D65') {
    const wp = ILLUMINANTS[illuminant];
    if (!wp) throw new Error('Неизвестный стандарт освещения: ' + illuminant);
    const R = xyToXYZ(PRIMARIES.r.x, PRIMARIES.r.y, 1);
    const G = xyToXYZ(PRIMARIES.g.x, PRIMARIES.g.y, 1);
    const B = xyToXYZ(PRIMARIES.b.x, PRIMARIES.b.y, 1);
    const P = [[R[0],G[0],B[0]],[R[1],G[1],B[1]],[R[2],G[2],B[2]]];
    const W = xyToXYZ(wp.x, wp.y, 1);
    const S = matMul3(inv3(P), W);
    const rgbToXyz = [
      [P[0][0]*S[0], P[0][1]*S[1], P[0][2]*S[2]],
      [P[1][0]*S[0], P[1][1]*S[1], P[1][2]*S[2]],
      [P[2][0]*S[0], P[2][1]*S[1], P[2][2]*S[2]]
    ];
    return { rgbToXyz, xyzToRgb: inv3(rgbToXyz), whiteXYZ: W.map(v=>v*100), whiteXY:{x:wp.x,y:wp.y} };
  }

  function srgbDecode8(v) {
    const n = clamp(v,0,255)/255;
    return n <= 0.04045 ? n/12.92 : ((n+0.055)/1.055) ** 2.4;
  }
  function srgbEncode01(v) {
    return v <= 0.0031308 ? 12.92*v : 1.055*(Math.max(v,0) ** (1/2.4))-0.055;
  }

  function gamutMapLinear(rgb, strategy='clip') {
    const outOfGamut = rgb.some(v => v < -1e-9 || v > 1+1e-9);
    if (!outOfGamut) return {rgb: rgb.slice(), changed:false};
    if (strategy === 'clip') return {rgb: rgb.map(v=>clamp(v,0,1)), changed:true};

    // Scaling: uniformly compress chroma toward a neutral point. This scales all channel
    // deviations by one common factor, instead of independently clipping channels.
    const anchor = clamp(0.2126*rgb[0] + 0.7152*rgb[1] + 0.0722*rgb[2], 0, 1);
    let t = 1;
    for (const v of rgb) {
      const d = v - anchor;
      if (d > 0) t = Math.min(t, (1-anchor)/d);
      else if (d < 0) t = Math.min(t, (0-anchor)/d);
    }
    t = clamp(t,0,1);
    return {rgb: rgb.map(v=>clamp(anchor + t*(v-anchor),0,1)), changed:true};
  }

  function rgbToXyz(rgb, illuminant='D65') {
    const {rgbToXyz} = buildRgbXyzMatrices(illuminant);
    return matMul3(rgbToXyz, rgb.map(srgbDecode8)).map(v=>v*100);
  }

  function xyzToRgb(xyz, illuminant='D65', strategy='clip') {
    const {xyzToRgb} = buildRgbXyzMatrices(illuminant);
    const linear = matMul3(xyzToRgb, xyz.map(v=>v/100));
    const mapped = gamutMapLinear(linear, strategy);
    return {
      rgb: mapped.rgb.map(v=>clamp(srgbEncode01(v)*255,0,255)),
      outOfGamut: mapped.changed,
      linearRaw: linear,
      strategy
    };
  }

  const delta = 6/29;
  function labF(t) { return t > delta**3 ? Math.cbrt(t) : t/(3*delta*delta) + 4/29; }
  function labFinv(t) { return t > delta ? t**3 : 3*delta*delta*(t-4/29); }

  function xyzToLab(xyz, illuminant='D65') {
    const w = buildRgbXyzMatrices(illuminant).whiteXYZ;
    const fx=labF(xyz[0]/w[0]), fy=labF(xyz[1]/w[1]), fz=labF(xyz[2]/w[2]);
    return [116*fy-16, 500*(fx-fy), 200*(fy-fz)];
  }
  function labToXyz(lab, illuminant='D65') {
    const w = buildRgbXyzMatrices(illuminant).whiteXYZ;
    const fy=(lab[0]+16)/116, fx=fy+lab[1]/500, fz=fy-lab[2]/200;
    return [w[0]*labFinv(fx), w[1]*labFinv(fy), w[2]*labFinv(fz)];
  }

  function smoothstep(a,b,x){ if(a===b)return x<a?0:1; const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
  function rgbToCmyk(rgb, algorithm='GCR', strength=1) {
    const [r,g,b]=rgb.map(v=>clamp(v,0,255)/255);
    let c=1-r, m=1-g, y=1-b;
    const gray=Math.min(c,m,y), s=clamp(strength,0,1);
    let k;
    if (algorithm === 'UCR') {
      // UCR acts mainly in dark/neutral regions. gray≈1 means a deep shadow.
      const shadowWeight=smoothstep(0.45,0.85,gray);
      k=gray*s*shadowWeight;
    } else {
      // GCR replaces the common CMY component through the whole tonal range.
      k=gray*s;
    }
    c-=k; m-=k; y-=k;
    return [clamp(c,0,1),clamp(m,0,1),clamp(y,0,1),clamp(k,0,1)];
  }
  function cmykToRgb(cmyk) {
    let [c,m,y,k]=cmyk.map(v=>clamp(v,0,1));
    return [1-Math.min(1,c+k),1-Math.min(1,m+k),1-Math.min(1,y+k)].map(v=>v*255);
  }

  function rgbToHex(rgb) { return '#'+rgb.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('').toUpperCase(); }
  function hexToRgb(hex) {
    const m=/^#?([0-9a-f]{6})$/i.exec(hex.trim()); if(!m) throw new Error('HEX должен иметь вид #RRGGBB');
    return [parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16)];
  }

  function convertFrom(model, values, options={}) {
    const illum=options.illuminant||'D65', gamut=options.gamut||'clip';
    switch(model){
      case 'RGB': return {rgb:values.slice(), warning:false};
      case 'CMYK': return {rgb:cmykToRgb(values.map(v=>v/100)), warning:false};
      case 'LAB': { const r=xyzToRgb(labToXyz(values,illum),illum,gamut); return {rgb:r.rgb,warning:r.outOfGamut}; }
      default: throw new Error('Неизвестная модель '+model);
    }
  }

  function allFromRgb(rgb, options={}) {
    const illum=options.illuminant||'D65', alg=options.cmykAlgorithm||'GCR', strength=options.cmykStrength ?? 1;
    const xyz=rgbToXyz(rgb,illum);
    const cmyk=rgbToCmyk(rgb,alg,strength), lab=xyzToLab(xyz,illum);
    return {
      RGB: rgb.slice(),
      CMYK: cmyk.map(v=>v*100),
      LAB: lab
    };
  }

  global.ColorMath={clamp,round,PRIMARIES,ILLUMINANTS,buildRgbXyzMatrices,rgbToXyz,xyzToRgb,xyzToLab,labToXyz,
    rgbToCmyk,cmykToRgb,rgbToHex,hexToRgb,convertFrom,allFromRgb};
})(window);
