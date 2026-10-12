// インク表現のエンジン
//  - InkCloud     : WebGL で描く、ふわっと広がり漂う水彩インク（ヒーローなどの背景）
//  - InkTransition: インクが広がって画面が切り替わるページ遷移（最初の読み込みは雫が落ちてから広がる）
//  - sprites      : 要素をインクの形で表示するためのマスク画像（CSS mask 用）
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= WebGL 共通 ================= */
  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const NOISE = `
    precision highp float;
    uniform vec2 uRes;
    uniform float uTime;
    float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}
    float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);
      for(int i=0;i<5;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}
  `;

  // 漂うインク雲。uCenter のまわりに、uGrow に合わせて咲くように広がる
  const CLOUD_FRAG = NOISE + `
    uniform vec2 uCenter;
    uniform float uScale;
    uniform float uGrow;
    uniform float uAlpha;
    uniform vec2 uMouse;
    void main(){
      vec2 uv=gl_FragCoord.xy/uRes;
      float asp=uRes.x/uRes.y;
      vec2 p=(uv-uCenter)*vec2(asp,1.)/uScale;
      vec2 m=p-uMouse;
      p+=vec2(-m.y,m.x)*exp(-dot(m,m)*5.)*.35;
      float t=uTime*.045;
      vec2 q=vec2(fbm(p*1.3+vec2(0.,t)),fbm(p*1.3+vec2(5.2,1.3)-t));
      vec2 r=vec2(fbm(p*1.5+3.*q+vec2(1.7,9.2)+t*1.3),fbm(p*1.5+3.*q+vec2(8.3,2.8)-t));
      float f=fbm(p*1.1+2.4*r);
      float d=length(p)+(r.x-.5)*.55;
      float edge=uGrow*(.95+(f-.5)*.9);
      float body=1.-smoothstep(edge*.45,edge,d);
      float dens=body*smoothstep(.06,.52,f+body*.32);
      vec3 c1=vec3(.83,.93,.99);
      vec3 c2=vec3(.56,.80,.96);
      vec3 c3=vec3(.36,.60,.91);
      vec3 gray=vec3(.667);
      vec3 col=mix(c1,c2,smoothstep(.35,.7,r.y));
      col=mix(col,c3,smoothstep(.58,.92,f)*.65);
      col=mix(col,gray,smoothstep(.62,.82,q.x)*.3);
      float streak=smoothstep(.6,.72,fbm(vec2(p.x*1.1,p.y*7.)+r*2.));
      col=mix(col,vec3(1.),streak*.45);
      float a=dens*uAlpha;
      gl_FragColor=vec4(col*a,a);
    }
  `;

  // 画面切り替えのにじみ。座標はすべて CSS の px（左上が原点）
  //  - uOrigin から、輪郭 radius(θ) のインクが広がる。内側は次の画面、外側は今の画面（uPaper=1 なら白い紙）
  //  - 最初の読み込みでは、手前から落ちてくる雫（uDrop…）と、着地の波紋（uRip…）も描く
  const BLOOM_FRAG = NOISE + `
    uniform vec2 uView;
    uniform vec2 uOrigin;
    uniform float uR;
    uniform float uW;
    uniform float uPaper;
    uniform float uK[8];
    uniform float uA[8];
    uniform float uPh[8];
    uniform vec2 uDrop;
    uniform float uDropR;
    uniform float uDropA;
    uniform float uDropSoft;
    uniform float uShadow;
    uniform float uRipR;
    uniform float uRipA;
    float radius(float th){
      float s=0.;
      for(int i=0;i<8;i++) s+=uA[i]*sin(uK[i]*th+uPh[i]);
      return uR*(1.+s);
    }
    vec4 over(vec4 dst, vec3 c, float a){ return vec4(c*a+dst.rgb*(1.-a), a+dst.a*(1.-a)); }
    void main(){
      vec2 px=vec2(gl_FragCoord.x, uRes.y-gl_FragCoord.y)/uRes*uView;
      float unit=min(uView.x,uView.y);
      vec2 p=px-uOrigin;
      float d=length(p);
      float th=atan(p.y,p.x);
      vec2 n=p/unit;
      vec4 col=vec4(0.);

      // インクの輪郭（細かなゆらぎは見た目だけ。切り替えの境目はこれより内側にある）
      float rr=radius(th);
      float fine=fbm(vec2(th*4.,d/unit*3.)+uTime*.15);
      float edge=rr+(fine-.5)*uW*.22;
      float outer=smoothstep(edge-1.2,edge+1.2,d);

      // 白い紙（最初の読み込み）
      col=over(col, vec3(1.), outer*uPaper);

      // 着地点の影：雫が近づくほど小さく濃くなる
      vec2 sh=p/(14.+40.*(1.-uShadow));
      col=over(col, vec3(.52,.68,.84), exp(-dot(sh,sh)*1.6)*uShadow*.28*uPaper);

      // インク：外のふちが濃く、内側へ向かって紙ににじむように薄くなる
      float cloud=fbm(n*2.2+vec2(0.,uTime*.04));
      float soak=smoothstep(rr-uW, rr-.3*uW, d+(cloud-.5)*uW*.5);
      float aInk=soak*(1.-outer)*.95;
      vec3 ink=mix(vec3(.80,.92,.99),vec3(.47,.70,.94),smoothstep(.35,.75,cloud));
      ink=mix(ink,vec3(.667),smoothstep(.58,.8,fbm(n*1.6+7.))*.3);
      float pool=smoothstep(edge-uW*.2,edge,d)*(1.-outer);
      ink=mix(ink,vec3(.40,.62,.90),pool*.5);
      float wisp=smoothstep(.55,.7,fbm(vec2(n.x*1.4,n.y*5.)+cloud*1.5));
      ink=mix(ink,vec3(1.),wisp*.35);
      col=over(col, ink, aInk);

      // 着地の波紋
      float ring=exp(-pow((d-uRipR)/(3.+uRipR*.08),2.));
      col=over(col, vec3(.55,.78,.96), ring*uRipA);

      // 落ちてくる雫：手前ではぼけて大きく、奥へ行くほど小さくくっきり
      vec2 q=(px-uDrop)/max(uDropR,.001);
      float dd=length(q);
      float body=1.-smoothstep(1.-uDropSoft,1.+uDropSoft,dd);
      vec3 dc=mix(vec3(.90,.96,1.),vec3(.63,.835,.97),smoothstep(.1,1.,dd));
      dc=mix(dc,vec3(.42,.66,.91),smoothstep(.72,1.,dd)*.55);
      vec2 h=q-vec2(-.34,-.40);
      vec2 c2=q-vec2(.22,.46);
      dc=mix(dc,vec3(1.),clamp(exp(-dot(h,h)*14.)+exp(-dot(c2,c2)*9.)*.45,0.,1.));
      col=over(col, dc, body*uDropA);

      gl_FragColor=col;
    }
  `;

  function createGL(canvas, frag) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return null;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = {};
    return {
      gl,
      set(name, ...v) {
        if (!(name in u)) u[name] = gl.getUniformLocation(prog, name);
        if (u[name] == null) return;
        v.length === 1 ? gl.uniform1f(u[name], v[0]) : gl.uniform2f(u[name], v[0], v[1]);
      },
      setv(name, arr) {
        if (!(name in u)) u[name] = gl.getUniformLocation(prog, name);
        if (u[name] != null) gl.uniform1fv(u[name], new Float32Array(arr));
      },
      draw() { gl.drawArrays(gl.TRIANGLES, 0, 3); },
      resize(scale) {
        const r = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(r.width * scale));
        canvas.height = Math.max(1, Math.round(r.height * scale));
        gl.viewport(0, 0, canvas.width, canvas.height);
        return r;
      }
    };
  }

  /* ================= 漂うインク（背景） ================= */
  // opts: center(w) => [x, y]（0〜1、y は下から）, scale(w), alpha, mouse, delay
  function InkCloud(canvas, opts) {
    const g = createGL(canvas, CLOUD_FRAG);
    if (!g) { canvas.classList.add('is-fallback'); return; }
    const RES = 0.5;  // 半分の解像度で描いて CSS で拡大（にじみが柔らかくなる）
    let rect, running = false, raf = 0, visible = true;
    const start0 = performance.now() + (opts.delay || 0);
    const mouse = { x: 9, y: 9, tx: 9, ty: 9 };
    const center = () => opts.center(rect.width);
    function resize() { rect = g.resize(RES); }
    function frame(now) {
      const t = (now - start0) / 1000;
      const grow = reduceMotion ? 1 : Math.min(1, Math.max(0, t / 3.2));
      const eased = 1 - Math.pow(1 - grow, 3);
      mouse.x += (mouse.tx - mouse.x) * .05;
      mouse.y += (mouse.ty - mouse.y) * .05;
      const c = center();
      g.set('uRes', canvas.width, canvas.height);
      g.set('uTime', 40 + Math.max(0, t));
      g.set('uCenter', c[0], c[1]);
      g.set('uScale', opts.scale(rect.width));
      g.set('uGrow', .05 + eased * .95);
      g.set('uAlpha', opts.alpha);
      g.set('uMouse', mouse.x, mouse.y);
      g.gl.clearColor(0, 0, 0, 0);
      g.gl.clear(g.gl.COLOR_BUFFER_BIT);
      g.draw();
      if (running) raf = requestAnimationFrame(frame);
    }
    const start = () => { if (running || reduceMotion) return; running = true; raf = requestAnimationFrame(frame); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    resize();
    frame(reduceMotion ? start0 + 10000 : performance.now());
    if (!reduceMotion) {
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; visible && !document.hidden ? start() : stop(); }).observe(canvas);
      document.addEventListener('visibilitychange', () => (document.hidden || !visible ? stop() : start()));
    }
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); if (!running) frame(performance.now()); }, 150); });
    if (opts.mouse && window.matchMedia('(hover: hover)').matches) {
      canvas.parentElement.addEventListener('pointermove', (e) => {
        const c = center(), asp = rect.width / rect.height, s = opts.scale(rect.width);
        mouse.tx = (((e.clientX - rect.left) / rect.width) - c[0]) * asp / s;
        mouse.ty = ((1 - (e.clientY - rect.top) / rect.height) - c[1]) / s;
      });
      canvas.parentElement.addEventListener('pointerleave', () => { mouse.tx = mouse.ty = 9; });
    }
  }

  /* ================= 画面切り替え ================= */
  // にじみの輪郭。シェーダーと同じ式で、次の画面を切り抜く形（clip-path）も作る
  const K = [2, 3, 4, 5, 7, 9, 13, 17];
  const AMP = [0.07, 0.06, 0.05, 0.04, 0.03, 0.025, 0.018, 0.012];
  const SUM_A = AMP.reduce((a, b) => a + b, 0);
  function shape() {
    return {
      a: AMP.map((v) => v * (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.3)),
      ph: K.map(() => Math.random() * Math.PI * 2),
      sp: K.map((k) => (Math.random() - 0.5) * 0.6 / Math.sqrt(k))
    };
  }
  const radiusAt = (sh, ph, R, th) => {
    let s = 0;
    for (let i = 0; i < K.length; i++) s += sh.a[i] * Math.sin(K[i] * th + ph[i]);
    return R * (1 + s);
  };

  const easeOut = (x) => 1 - Math.pow(1 - x, 1.8);

  const InkTransition = {
    canvas: null, g: null,
    ensure() {
      if (this.g) return this.g;
      const c = document.createElement('canvas');
      c.className = 'ink-transition';
      c.setAttribute('aria-hidden', 'true');
      c.hidden = true;
      document.body.appendChild(c);
      this.canvas = c;
      this.g = createGL(c, BLOOM_FRAG);
      if (!this.g) { c.remove(); this.canvas = null; }
      return this.g;
    },
    // にじみを1回再生する
    //  origin: {x, y}（ビューポートの px） / paper: 外側を白い紙にする / drop: 先に雫を落とす
    //  onClip(polygon): 次の画面を見せる範囲（clip-path の polygon）。onImpact: 雫が着地した時
    play({ origin, duration = 1500, paper = false, drop = false, onClip, onImpact, done }) {
      const g = this.ensure();
      if (!g || reduceMotion) { onImpact && onImpact(); done && done(); return false; }
      const c = this.canvas;
      c.hidden = false;
      c.classList.toggle('is-cover', paper);
      const vw = window.innerWidth, vh = window.innerHeight;
      const r = g.resize(Math.min(1, 900 / Math.max(vw, 1)) * Math.min(window.devicePixelRatio || 1, 1.5));
      const unit = Math.min(vw, vh);
      const maxD = Math.max(...[[0, 0], [vw, 0], [0, vh], [vw, vh]].map(([x, y]) => Math.hypot(x - origin.x, y - origin.y)));
      const W = Math.min(220, Math.max(70, Math.max(vw, vh) * 0.14));
      const Rend = (maxD + W + 24) / (1 - SUM_A);
      const sh = shape();
      g.set('uRes', c.width, c.height);
      g.set('uView', r.width, r.height);
      g.set('uOrigin', origin.x, origin.y);
      g.set('uW', W);
      g.set('uPaper', paper ? 1 : 0);
      g.setv('uK', K);
      g.setv('uA', sh.a);

      // 雫：奥行き z が 1（目の前）から 28（紙の上）まで、だんだん速く落ちる
      const DROP = drop ? 950 : 0;
      const R0 = Math.min(420, Math.max(170, unit * 0.46));
      const off = { x: -vw * 0.16, y: vh * 0.34 };
      const RIP = 520;

      const t0 = performance.now();
      let impacted = !drop;
      if (!drop && onImpact) onImpact();
      const step = (now) => {
        const t = now - t0;
        // 雫
        if (t < DROP) {
          const x = t / DROP;
          const z = 1 + 27 * Math.pow(x, 2.3);
          g.set('uDrop', origin.x + off.x / z, origin.y + off.y / z);
          g.set('uDropR', R0 / z);
          g.set('uDropSoft', Math.min(0.85, 0.05 + 0.8 / z));
          g.set('uDropA', Math.min(0.92, 0.18 + 0.8 * x));
          g.set('uShadow', Math.pow(x, 1.6));
        } else {
          g.set('uDropA', 0);
          g.set('uShadow', drop ? Math.max(0, 1 - (t - DROP) / 200) : 0);
          if (!impacted) { impacted = true; onImpact && onImpact(); }
        }
        // 波紋
        const tr = (t - DROP) / RIP;
        g.set('uRipR', drop && tr > 0 ? 6 + 110 * easeOut(Math.min(1, tr)) : 0);
        g.set('uRipA', drop && tr > 0 && tr < 1 ? 0.7 * (1 - tr) : 0);
        // にじみ
        const x = Math.min(1, Math.max(0, (t - DROP) / duration));
        const R = easeOut(x) * Rend;
        const tt = t / 1000;
        const ph = sh.ph.map((p, i) => p + sh.sp[i] * tt);
        g.set('uR', R);
        g.setv('uPh', ph);
        g.set('uTime', 30 + tt);
        g.gl.clearColor(0, 0, 0, 0);
        g.gl.clear(g.gl.COLOR_BUFFER_BIT);
        g.draw();
        if (onClip) {
          // 境目は輪郭より内側（インクが濃いところ）に置いて、継ぎ目を隠す
          const pts = [];
          for (let i = 0; i < 120; i++) {
            const th = (i / 120) * Math.PI * 2 - Math.PI;
            const rc = Math.max(0, radiusAt(sh, ph, R, th) - 0.3 * W);
            pts.push(`${(origin.x + Math.cos(th) * rc).toFixed(1)}px ${(origin.y + Math.sin(th) * rc).toFixed(1)}px`);
          }
          onClip(`polygon(${pts.join(',')})`);
        }
        if (x < 1) requestAnimationFrame(step);
        else { c.hidden = true; done && done(); }
      };
      requestAnimationFrame(step);
      return true;
    }
  };

  /* ================= マスク画像（CSS 用） ================= */
  // 値ノイズ（CPU 版）
  function makeNoise(seed) {
    const h = (x, y) => {
      let n = (x * 374761393 + y * 668265263 + seed * 982451653) | 0;
      n = (n ^ (n >>> 13)) * 1274126177;
      return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    };
    const noise = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    return (x, y, oct = 4) => {
      let s = 0, amp = .5, f = 1;
      for (let i = 0; i < oct; i++) { s += amp * noise(x * f, y * f); f *= 2.03; amp *= .5; }
      return s;
    };
  }
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // インクが広がっていく様子を横並びのコマにしたマスク（白＝見える）
  function inkSprite({ frames = 18, size = 192, seed = 1, ox = 0, oy = 0 }) {
    const c = document.createElement('canvas');
    c.width = frames * size; c.height = size;
    const ctx = c.getContext('2d');
    const fbm = makeNoise(seed);
    const img = ctx.createImageData(size, size);
    // コマ間で共通の値を先に計算
    const N = new Float32Array(size * size), T = new Float32Array(size * size), D = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const px = (x / size) * 2 - 1 - ox, py = (y / size) * 2 - 1 - oy;
      const d = Math.hypot(px, py), ang = Math.atan2(py, px);
      const i = y * size + x;
      D[i] = d;
      N[i] = fbm(px * 1.8 + 7, py * 1.8 + 3);
      T[i] = fbm(Math.cos(ang) * 3 + 11, Math.sin(ang) * 3 + d * 1.6, 3);
    }
    const maxD = Math.hypot(1 + Math.abs(ox), 1 + Math.abs(oy));
    for (let k = 0; k < frames; k++) {
      const q = k / (frames - 1);
      const r = (1 - Math.pow(1 - q, 2.2)) * (maxD + .5) / .7;
      for (let i = 0; i < size * size; i++) {
        const e = r * (.74 + .48 * N[i]) + (T[i] - .5) * .3 * r;
        const a = k === frames - 1 ? 1 : 1 - smooth(e - .1, e + .02, D[i]);
        const o = i * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
        img.data[o + 3] = a * 255;
      }
      ctx.putImageData(img, k * size, 0);
    }
    return c;
  }

  // セクションのつなぎ目に使う、筆でなでたようなインクのふち（下側がインク）
  function inkEdge({ width = 1400, height = 140, seed = 3 }) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    const ctx = c.getContext('2d');
    const fbm = makeNoise(seed);
    const img = ctx.createImageData(width, height);
    for (let x = 0; x < width; x++) {
      const base = height * (.55 + (fbm(x / 260, 1.3) - .5) * .7);
      const streak = Math.pow(fbm(x / 9, 4.2, 2), 3) * height * .9;   // 細いすじ
      for (let y = 0; y < height; y++) {
        const edge = base - streak * smooth(height * .2, height * .9, base);
        const wob = (fbm(x / 40, y / 30, 3) - .5) * 14;
        const a = smooth(edge - 6 + wob, edge + 10 + wob, y);
        const o = (y * width + x) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
        img.data[o + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // canvas を blob URL にして CSS 変数として登録
  function register(name, canvas) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) { resolve(null); return; }
        const url = URL.createObjectURL(blob);
        document.documentElement.style.setProperty(name, `url(${url})`);
        resolve(url);
      });
    });
  }

  const SPRITE_FRAMES = 18;
  let spritesReady = null;
  function prepareMasks() {
    if (spritesReady) return spritesReady;
    spritesReady = Promise.all([
      register('--ink-sprite-a', inkSprite({ frames: SPRITE_FRAMES, seed: 5 })),
      register('--ink-sprite-b', inkSprite({ frames: SPRITE_FRAMES, seed: 9, ox: -.55, oy: .5 })),
      register('--ink-blot', (() => {  // 広がりきる前のインクのしみ（装飾用）
        const c = document.createElement('canvas');
        c.width = c.height = 320;
        const fbm = makeNoise(21), ctx = c.getContext('2d'), img = ctx.createImageData(320, 320);
        for (let y = 0; y < 320; y++) for (let x = 0; x < 320; x++) {
          const px = x / 160 - 1, py = y / 160 - 1, d = Math.hypot(px, py), ang = Math.atan2(py, px);
          const e = .62 + (fbm(px * 1.8 + 7, py * 1.8 + 3) - .5) * .5 + (fbm(Math.cos(ang) * 3, Math.sin(ang) * 3 + d, 3) - .5) * .25;
          const o = (y * 320 + x) * 4;
          img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
          img.data[o + 3] = (1 - smooth(e - .12, e + .01, d)) * 255;
        }
        ctx.putImageData(img, 0, 0);
        return c;
      })()),
      register('--ink-edge', inkEdge({}))
    ]).then(() => document.documentElement.classList.add('ink-masks'));
    return spritesReady;
  }

  window.Ink = { InkCloud, InkTransition, prepareMasks, reduceMotion, SPRITE_FRAMES };
})();
