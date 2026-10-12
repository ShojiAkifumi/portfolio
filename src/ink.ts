// インク表現のエンジン
//  - InkCloud     : WebGL で描く、ふわっと広がり漂う水彩インク（ヒーローなどの背景）
//  - InkTransition: インクが広がって画面が切り替わるページ遷移（最初の読み込みは雫が落ちてから広がる）
//  - sprites      : 要素をインクの形で表示するためのマスク画像（CSS mask 用）

export const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ================= WebGL 共通 ================= */
const VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
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
const CLOUD_FRAG =
  NOISE +
  `
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

// 画面切り替えのにじみ（以前の2段階の切り替えと同じ色・形）
//  ノイズは JS と同じ乱数表（uLut）から作り、JS 側で求めた「次の画面が見える範囲」（uRc）とぴったり重なるようにする
//  - 座標 p は画面の高さを 1 とした単位（上向きが +y）。uR が大きくなるほどにじみが広がる
//  - 最初の読み込みでは、外側を白い紙（uPaper=1）にしてにじみで現し、トップでは先に手前から雫を落とす
const BLOOM_FRAG = `
  precision highp float;
  uniform vec2 uRes;
  uniform vec2 uView;
  uniform vec2 uOrigin;
  uniform float uR;
  uniform float uPaper;
  uniform float uInk;
  uniform sampler2D uLut;
  uniform sampler2D uRc;
  uniform float uRcN;
  uniform float uRcMax;
  uniform vec2 uDrop;
  uniform float uDropR;
  uniform float uDropA;
  uniform float uDropSoft;
  uniform float uShadow;
  uniform sampler2D uDropTex;
  uniform float uHasTex;
  float hash(vec2 i){return texture2D(uLut,(mod(i,256.)+.5)/256.).r;}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}
  float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);
    for(int i=0;i<5;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}
  float rcAt(float k){
    float i=floor(k), f=k-i;
    vec4 a=texture2D(uRc,vec2((mod(i,uRcN)+.5)/uRcN,.5));
    vec4 b=texture2D(uRc,vec2((mod(i+1.,uRcN)+.5)/uRcN,.5));
    float ra=(a.r*255.*256.+a.g*255.)/65535.;
    float rb=(b.r*255.*256.+b.g*255.)/65535.;
    return mix(ra,rb,f)*uRcMax;
  }
  vec4 over(vec4 dst, vec3 c, float a){ return vec4(c*a+dst.rgb*(1.-a), a+dst.a*(1.-a)); }
  void main(){
    vec2 px=vec2(gl_FragCoord.x, uRes.y-gl_FragCoord.y)/uRes*uView;
    vec2 p=vec2(px.x-uOrigin.x, uOrigin.y-px.y)/uView.y;
    float d=length(p);
    vec2 dir=d>0.?p/d:vec2(1.,0.);
    float n=fbm(p*1.25+3.1);
    float ten=mix(.5,fbm(dir*2.4+d*1.6),smoothstep(0.,.4,d));
    float fine=fbm(p*6.);
    float e1=uR*(.6+.75*n)+(ten-.5)*.42*uR+(fine-.5)*.08*uR;
    // 輪郭はくっきりさせず、外へ向かってふわっと消える
    float outer=smoothstep(e1-.1,e1+.08,d);
    // 次の画面が見える範囲の境目（JS の clip-path と同じ）。そのすぐ内側までインクを重ねて継ぎ目を隠す
    float th=atan(p.y,p.x);
    float rc=rcAt((th+3.14159265)/6.28318531*uRcN);
    float band=(1.-outer)*smoothstep(rc-.16,rc-.01,d);
    float cloud=fbm(p*2.2+vec2(n*2.,ten));
    vec3 ink=mix(vec3(.80,.92,.99),vec3(.47,.70,.94),smoothstep(.35,.75,cloud));
    ink=mix(ink,vec3(.667),smoothstep(.58,.8,fbm(p*1.6+7.))*.4);
    // ふちは濃くせず、白っぽく淡くする
    float rim=smoothstep(e1-.22,e1+.04,d);
    ink=mix(ink,vec3(.86,.94,1.),rim*.55);
    float wisp=smoothstep(.55,.7,fbm(vec2(p.x*1.4,p.y*5.)+cloud*1.5));
    ink=mix(ink,vec3(1.),wisp*.4);
    // 全体を少し淡く
    ink=mix(ink,vec3(1.),.12);
    band*=(1.-rim*.55)*.84*uInk;

    vec4 col=vec4(0.);
    col=over(col, vec3(1.), outer*uPaper);
    // 着地点の影：雫が近づくほど小さく濃くなる
    vec2 q0=(px-uOrigin)/(14.+40.*(1.-uShadow));
    col=over(col, vec3(.52,.68,.84), exp(-dot(q0,q0)*1.6)*uShadow*.28*uPaper);
    col=over(col, ink, band*.94);
    // 落ちてくる雫：ロゴと同じ水彩のにじみ。手前ではぼけて大きく、奥へ行くほど小さくくっきり
    vec2 q=(px-uDrop)/max(uDropR,.001);
    if(uHasTex>.5){
      vec2 tuv=q*.37+.5;
      if(uDropA>0.&&tuv.x>0.&&tuv.x<1.&&tuv.y>0.&&tuv.y<1.){
        vec4 t=texture2D(uDropTex,tuv,uDropSoft*7.);
        // 色の鮮やかさを少し落とす
        t.rgb=mix(t.rgb,vec3(dot(t.rgb,vec3(.299,.587,.114))),.35);
        // 濃さを半分に（白い紙の上で、色が半分ほどの淡さになる）
        t*=.5;
        col=vec4(t.rgb*uDropA+col.rgb*(1.-t.a*uDropA), t.a*uDropA+col.a*(1.-t.a*uDropA));
      }
    }else{
      float dd=length(q);
      float body=1.-smoothstep(1.-uDropSoft,1.+uDropSoft,dd);
      vec3 dc=mix(vec3(.80,.91,.99),vec3(.63,.835,.97),smoothstep(.1,1.,dd));
      col=over(col, dc, body*uDropA*.5);
    }
    gl_FragColor=col;
  }
`;

export interface GL {
  gl: WebGLRenderingContext;
  set(name: string, ...v: number[]): void;
  seti(name: string, v: number): void;
  draw(): void;
  resize(scale: number): DOMRect;
}

function createGL(canvas: HTMLCanvasElement, frag: string): GL | null {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const vs = sh(gl.VERTEX_SHADER, VERT),
    fs = sh(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u: Record<string, WebGLUniformLocation | null> = {};
  return {
    gl,
    set(name: string, ...v: number[]) {
      if (!(name in u)) u[name] = gl.getUniformLocation(prog, name);
      const loc = u[name];
      if (loc == null) return;
      v.length === 1 ? gl.uniform1f(loc, v[0]) : gl.uniform2f(loc, v[0], v[1]);
    },
    seti(name: string, v: number) {
      if (!(name in u)) u[name] = gl.getUniformLocation(prog, name);
      const loc = u[name];
      if (loc != null) gl.uniform1i(loc, v);
    },
    draw() {
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    resize(scale: number) {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * scale));
      canvas.height = Math.max(1, Math.round(r.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      return r;
    },
  };
}

/* ================= 漂うインク（背景） ================= */
// opts: center(w) => [x, y]（0〜1、y は下から）, scale(w), alpha, mouse, delay
export interface CloudOptions {
  center: (w: number) => [number, number];
  scale: (w: number) => number;
  alpha: number;
  mouse: boolean;
  delay?: number;
}

export function InkCloud(canvas: HTMLCanvasElement, opts: CloudOptions): void {
  const gl0 = createGL(canvas, CLOUD_FRAG);
  if (!gl0) {
    canvas.classList.add("is-fallback");
    return;
  }
  const g = gl0;
  const RES = 0.5; // 半分の解像度で描いて CSS で拡大（にじみが柔らかくなる）
  let rect: DOMRect,
    running = false,
    raf = 0,
    visible = true;
  const start0 = performance.now() + (opts.delay || 0);
  const mouse = { x: 9, y: 9, tx: 9, ty: 9 };
  const center = () => opts.center(rect.width);
  function resize() {
    rect = g.resize(RES);
  }
  function frame(now: number) {
    const t = (now - start0) / 1000;
    const grow = reduceMotion ? 1 : Math.min(1, Math.max(0, t / 3.2));
    const eased = 1 - Math.pow(1 - grow, 3);
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    const c = center();
    g.set("uRes", canvas.width, canvas.height);
    g.set("uTime", 40 + Math.max(0, t));
    g.set("uCenter", c[0], c[1]);
    g.set("uScale", opts.scale(rect.width));
    g.set("uGrow", 0.05 + eased * 0.95);
    g.set("uAlpha", opts.alpha);
    g.set("uMouse", mouse.x, mouse.y);
    g.gl.clearColor(0, 0, 0, 0);
    g.gl.clear(g.gl.COLOR_BUFFER_BIT);
    g.draw();
    if (running) raf = requestAnimationFrame(frame);
  }
  const start = () => {
    if (running || reduceMotion) return;
    running = true;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };
  resize();
  frame(reduceMotion ? start0 + 10000 : performance.now());
  if (!reduceMotion) {
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      visible && !document.hidden ? start() : stop();
    }).observe(canvas);
    document.addEventListener("visibilitychange", () => (document.hidden || !visible ? stop() : start()));
  }
  let rt = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => {
      resize();
      if (!running) frame(performance.now());
    }, 150);
  });
  const parent = canvas.parentElement;
  if (opts.mouse && parent && window.matchMedia("(hover: hover)").matches) {
    parent.addEventListener("pointermove", (e) => {
      const c = center(),
        asp = rect.width / rect.height,
        s = opts.scale(rect.width);
      mouse.tx = (((e.clientX - rect.left) / rect.width - c[0]) * asp) / s;
      mouse.ty = (1 - (e.clientY - rect.top) / rect.height - c[1]) / s;
    });
    parent.addEventListener("pointerleave", () => {
      mouse.tx = mouse.ty = 9;
    });
  }
}

/* ================= 画面切り替え ================= */
// シェーダーと JS で共通の乱数表（256×256）
const LUT = (() => {
  const t = new Uint8Array(256 * 256);
  let x = 2463534242;
  for (let i = 0; i < t.length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    t[i] = (x >>> 0) & 255;
  }
  return t;
})();
const lutHash = (x: number, y: number) => LUT[(((y % 256) + 256) % 256) * 256 + (((x % 256) + 256) % 256)] / 255;
function lutNoise(x: number, y: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const a = lutHash(xi, yi),
    b = lutHash(xi + 1, yi),
    c = lutHash(xi, yi + 1),
    d = lutHash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a + (d - c - b + a) * u) * v;
}
function lutFbm(x: number, y: number) {
  let v = 0,
    a = 0.5;
  for (let i = 0; i < 5; i++) {
    v += a * lutNoise(x, y);
    // GLSL の m*p（mat2(1.6,1.2,-1.2,1.6) は列ごとの指定）
    const nx = 1.6 * x - 1.2 * y,
      ny = 1.2 * x + 1.6 * y;
    x = nx;
    y = ny;
    a *= 0.5;
  }
  return v;
}

const RAYS = 128;
// 画面の中心から放射状に、それぞれの点に「次の画面が見え始める広がり R」を求めておく
//  シェーダーの e2 = e1 - .36 - .25n が d を超える条件を R について解いたもの
interface Arrival {
  T: Float32Array;
  S: number;
  step: number;
  dMax: number;
  rEnd: number;
}
function arrival(ox: number, oy: number, vw: number, vh: number): Arrival {
  const corners = [
    [0, 0],
    [vw, 0],
    [0, vh],
    [vw, vh],
  ].map(([x, y]) => Math.hypot(x - ox, y - oy) / vh);
  const dMax = Math.max(...corners) + 0.04;
  const step = 0.01,
    S = Math.ceil(dMax / step) + 1;
  const T = new Float32Array(RAYS * S);
  let tMax = 0;
  for (let k = 0; k < RAYS; k++) {
    const th = (k / RAYS) * Math.PI * 2 - Math.PI,
      cx = Math.cos(th),
      cy = Math.sin(th);
    for (let j = 0; j < S; j++) {
      const d = j * step,
        px = cx * d,
        py = cy * d;
      const n = lutFbm(px * 1.25 + 3.1, py * 1.25 + 3.1);
      const ten = 0.5 + (lutFbm(cx * 2.4 + d * 1.6, cy * 2.4 + d * 1.6) - 0.5) * smooth(0, 0.4, d);
      const fine = lutFbm(px * 6, py * 6);
      const g = 0.6 + 0.75 * n + (ten - 0.5) * 0.42 + (fine - 0.5) * 0.08;
      const t = g > 0.02 ? (d + 0.36 + 0.25 * n) / g : 1e3;
      T[k * S + j] = t;
      if (t < 1e3) tMax = Math.max(tMax, t);
    }
  }
  return { T, S, step, dMax, rEnd: tMax + 0.02 };
}
// 広がり R のとき、各方向で次の画面が途切れずに見えている距離
function reach(A: Arrival, R: number, out: Float32Array) {
  for (let k = 0; k < RAYS; k++) {
    const o = k * A.S;
    let j = 0;
    while (j < A.S && A.T[o + j] < R) j++;
    if (j >= A.S) {
      out[k] = A.dMax + 0.05;
      continue;
    }
    if (j === 0) {
      out[k] = 0;
      continue;
    }
    const t0 = A.T[o + j - 1],
      t1 = A.T[o + j];
    out[k] = (j - 1 + Math.min(1, Math.max(0, (R - t0) / Math.max(1e-6, t1 - t0)))) * A.step;
  }
  return out;
}

const easeOut = (x: number) => 1 - Math.pow(1 - x, 2.4);

export interface PlayOptions {
  origin: { x: number; y: number };
  duration?: number;
  drop?: boolean;
  bleed?: boolean;
  paper?: boolean;
  onClip?: (polygon: string) => void;
  onImpact?: () => void;
  done?: () => void;
}

export const InkTransition = {
  canvas: null as HTMLCanvasElement | null,
  g: null as GL | null,
  rcTex: null as WebGLTexture | null,
  dropReady: Promise.resolve(false) as Promise<boolean>,
  ensure(): GL | null {
    if (this.g) return this.g;
    const c = document.createElement("canvas");
    c.className = "ink-transition";
    c.setAttribute("aria-hidden", "true");
    c.hidden = true;
    document.body.appendChild(c);
    this.canvas = c;
    const g = createGL(c, BLOOM_FRAG);
    this.g = g;
    if (!g) {
      c.remove();
      this.canvas = null;
      return null;
    }
    const gl = g.gl;
    const tex = (unit: number, w: number, h: number, format: number, data: Uint8Array) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, format, w, h, 0, format, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    tex(0, 256, 256, gl.LUMINANCE, LUT);
    this.rcTex = tex(1, RAYS, 1, gl.RGBA, new Uint8Array(RAYS * 4));
    // 雫の画像（ロゴのにじみ）。読み込めるまでは丸い雫で代わりに描く
    this.dropReady = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        gl.activeTexture(gl.TEXTURE2);
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        g.set("uHasTex", 1);
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = "/images/ink-drop.png";
    });
    g.seti("uLut", 0);
    g.seti("uRc", 1);
    g.seti("uDropTex", 2);
    g.set("uHasTex", 0);
    g.set("uRcN", RAYS);
    return g;
  },
  // 雫の画像を先に読み込んでおく（最大 ms ミリ秒待つ）
  preload(ms: number): Promise<unknown> {
    if (!this.ensure() || reduceMotion) return Promise.resolve();
    return Promise.race([this.dropReady, new Promise((r) => setTimeout(r, ms))]);
  },
  // にじみを1回再生する
  //  origin: {x, y}（ビューポートの px） / drop: 先に雫を落とす / bleed: false ならにじみを広げない
  //  paper: 外側を白い紙で覆う（bleed: false なら、雫の着地後に duration かけてふわっと消す）
  //  onClip(polygon): 次の画面を見せる範囲（clip-path の polygon）。onImpact: 雫が着地した時
  //  最初の読み込みは paper: true（トップは drop: true）
  play({
    origin,
    duration = 1700,
    drop = false,
    bleed = true,
    paper = false,
    onClip,
    onImpact,
    done,
  }: PlayOptions): boolean {
    const g = this.ensure();
    if (!g || reduceMotion) {
      onImpact && onImpact();
      done && done();
      return false;
    }
    const gl = g.gl,
      c = this.canvas as HTMLCanvasElement;
    c.hidden = false;
    c.classList.toggle("is-cover", drop || paper);
    const vw = window.innerWidth,
      vh = window.innerHeight;
    const r = g.resize(Math.min(1, 900 / Math.max(vw, 1)) * Math.min(window.devicePixelRatio || 1, 1.5));
    const A = arrival(origin.x, origin.y, r.width, r.height);
    const rc = new Float32Array(RAYS),
      bytes = new Uint8Array(RAYS * 4);
    const rcMax = A.dMax + 0.1;
    g.set("uRes", c.width, c.height);
    g.set("uView", r.width, r.height);
    g.set("uOrigin", origin.x, origin.y);
    g.set("uPaper", paper ? 1 : 0);
    g.set("uInk", bleed ? 1 : 0);
    g.set("uRcMax", rcMax);

    // 雫：奥行き z が 1（目の前）から 14.5（着地点）まで、0.2秒でだんだん速く落ちる
    const DROP = drop ? 200 : 0;
    const unit = Math.min(vw, vh);
    const R0 = Math.min(420, Math.max(170, unit * 0.46));
    const off = { x: -vw * 0.16, y: vh * 0.34 };

    const t0 = performance.now();
    let impacted = !drop;
    if (!drop && onImpact) onImpact();
    const step = (now: number) => {
      const t = now - t0;
      if (t < DROP) {
        const x = t / DROP;
        const z = 1 + 13.5 * Math.pow(x, 2.3);
        g.set("uDrop", origin.x + off.x / z, origin.y + off.y / z);
        g.set("uDropR", R0 / z);
        g.set("uDropSoft", Math.min(0.85, 0.05 + 0.8 / z));
        g.set("uDropA", Math.min(0.92, 0.18 + 0.8 * x));
        g.set("uShadow", Math.pow(x, 1.6));
      } else if (drop && !bleed) {
        // 着地したら、少し広がりながらふわっと消える
        const f = Math.min(1, (t - DROP) / duration);
        g.set("uDrop", origin.x + off.x / 14.5, origin.y + off.y / 14.5);
        g.set("uDropR", (R0 / 14.5) * (1 + 0.35 * easeOut(f)));
        g.set("uDropSoft", 0.05 + 0.25 * f);
        g.set("uDropA", 0.92 * (1 - f) * (1 - f));
        g.set("uShadow", Math.max(0, 1 - f * 2));
        if (!impacted) {
          impacted = true;
          onImpact && onImpact();
        }
      } else {
        g.set("uDropA", 0);
        g.set("uShadow", drop ? Math.max(0, 1 - (t - DROP) / 200) : 0);
        if (!impacted) {
          impacted = true;
          onImpact && onImpact();
        }
      }

      // にじみ
      const x = Math.min(1, Math.max(0, (t - DROP) / duration));
      if (paper && !bleed) g.set("uPaper", 1 - x * x * (3 - 2 * x));
      const R = easeOut(x) * A.rEnd;
      g.set("uR", R);
      reach(A, R, rc);
      for (let k = 0; k < RAYS; k++) {
        const v = Math.round(Math.min(1, rc[k] / rcMax) * 65535);
        bytes[k * 4] = v >> 8;
        bytes[k * 4 + 1] = v & 255;
      }
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.rcTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, RAYS, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      g.draw();
      if (onClip) {
        const pts: string[] = [];
        for (let k = 0; k < RAYS; k++) {
          const th = (k / RAYS) * Math.PI * 2 - Math.PI,
            d = rc[k] * r.height;
          pts.push(`${(origin.x + Math.cos(th) * d).toFixed(1)}px ${(origin.y - Math.sin(th) * d).toFixed(1)}px`);
        }
        onClip(`polygon(${pts.join(",")})`);
      }
      if (x < 1) requestAnimationFrame(step);
      else {
        c.hidden = true;
        done && done();
      }
    };
    requestAnimationFrame(step);
    return true;
  },
};

/* ================= マスク画像（CSS 用） ================= */
// 値ノイズ（CPU 版）
function makeNoise(seed: number) {
  const h = (x: number, y: number) => {
    let n = (x * 374761393 + y * 668265263 + seed * 982451653) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      xf = x - xi,
      yf = y - yi;
    const u = xf * xf * (3 - 2 * xf),
      v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi),
      b = h(xi + 1, yi),
      c = h(xi, yi + 1),
      d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x: number, y: number, oct = 4) => {
    let s = 0,
      amp = 0.5,
      f = 1;
    for (let i = 0; i < oct; i++) {
      s += amp * noise(x * f, y * f);
      f *= 2.03;
      amp *= 0.5;
    }
    return s;
  };
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// インクが広がっていく様子を横並びのコマにしたマスク（白＝見える）
// 2D の canvas を用意する
function canvas2d(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas が使えません");
  return { c, ctx };
}

function inkSprite({ frames = 18, size = 192, seed = 1, ox = 0, oy = 0 }) {
  const { c, ctx } = canvas2d(frames * size, size);
  const fbm = makeNoise(seed);
  const img = ctx.createImageData(size, size);
  // コマ間で共通の値を先に計算
  const N = new Float32Array(size * size),
    T = new Float32Array(size * size),
    D = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = (x / size) * 2 - 1 - ox,
        py = (y / size) * 2 - 1 - oy;
      const d = Math.hypot(px, py),
        ang = Math.atan2(py, px);
      const i = y * size + x;
      D[i] = d;
      N[i] = fbm(px * 1.8 + 7, py * 1.8 + 3);
      T[i] = fbm(Math.cos(ang) * 3 + 11, Math.sin(ang) * 3 + d * 1.6, 3);
    }
  const maxD = Math.hypot(1 + Math.abs(ox), 1 + Math.abs(oy));
  for (let k = 0; k < frames; k++) {
    const q = k / (frames - 1);
    const r = ((1 - Math.pow(1 - q, 2.2)) * (maxD + 0.5)) / 0.7;
    for (let i = 0; i < size * size; i++) {
      const e = r * (0.74 + 0.48 * N[i]) + (T[i] - 0.5) * 0.3 * r;
      const a = k === frames - 1 ? 1 : 1 - smooth(e - 0.1, e + 0.02, D[i]);
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
  const { c, ctx } = canvas2d(width, height);
  const fbm = makeNoise(seed);
  const img = ctx.createImageData(width, height);
  for (let x = 0; x < width; x++) {
    const base = height * (0.55 + (fbm(x / 260, 1.3) - 0.5) * 0.7);
    const streak = Math.pow(fbm(x / 9, 4.2, 2), 3) * height * 0.9; // 細いすじ
    for (let y = 0; y < height; y++) {
      const edge = base - streak * smooth(height * 0.2, height * 0.9, base);
      const wob = (fbm(x / 40, y / 30, 3) - 0.5) * 14;
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
function register(name: string, canvas: HTMLCanvasElement): Promise<string | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      const url = URL.createObjectURL(blob);
      document.documentElement.style.setProperty(name, `url(${url})`);
      resolve(url);
    });
  });
}

export const SPRITE_FRAMES = 18;
let spritesReady: Promise<void> | null = null;
export function prepareMasks(): Promise<void> {
  if (spritesReady) return spritesReady;
  spritesReady = Promise.all([
    register("--ink-sprite-a", inkSprite({ frames: SPRITE_FRAMES, seed: 5 })),
    register("--ink-sprite-b", inkSprite({ frames: SPRITE_FRAMES, seed: 9, ox: -0.55, oy: 0.5 })),
    register(
      "--ink-blot",
      (() => {
        // 広がりきる前のインクのしみ（装飾用）
        const { c, ctx } = canvas2d(320, 320);
        const fbm = makeNoise(21),
          img = ctx.createImageData(320, 320);
        for (let y = 0; y < 320; y++)
          for (let x = 0; x < 320; x++) {
            const px = x / 160 - 1,
              py = y / 160 - 1,
              d = Math.hypot(px, py),
              ang = Math.atan2(py, px);
            const e =
              0.62 +
              (fbm(px * 1.8 + 7, py * 1.8 + 3) - 0.5) * 0.5 +
              (fbm(Math.cos(ang) * 3, Math.sin(ang) * 3 + d, 3) - 0.5) * 0.25;
            const o = (y * 320 + x) * 4;
            img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
            img.data[o + 3] = (1 - smooth(e - 0.12, e + 0.01, d)) * 255;
          }
        ctx.putImageData(img, 0, 0);
        return c;
      })(),
    ),
    register("--ink-edge", inkEdge({})),
  ]).then(() => document.documentElement.classList.add("ink-masks"));
  return spritesReady;
}
