// 反抗之战 · 界面层（Canvas 渲染 / DOM 事件 / 主循环 / 存档）
//=================== UI ===================
var S = newState();
var SAVE_KEY = 'wygame_remake_v1';

function fmt(n){
  n = Math.floor(n);
  if(n >= 1e9) return (n/1e9).toFixed(2) + 'B';
  if(n >= 1e6) return (n/1e6).toFixed(2) + 'M';
  if(n >= 1e4) return (n/1e3).toFixed(1) + 'k';
  return String(n);
}

var UPS = [
  {k:'army',  name:'地下武装', ds:'每级提升战斗力基底'},
  {k:'tech',  name:'技术小组', ds:'战力倍率'},
  {k:'print', name:'地下印刷', ds:'追随者增长'},
  {k:'net',   name:'隐蔽网络', ds:'隐蔽恢复速度'},
  {k:'aid',   name:'国际支援', ds:'资金倍率'}
];

function aidLocked(s){ return s.tech < 5; }

function descOf(k, lv){
  if(k==='army')  return '基底 ×' + Math.sqrt(lv+1).toFixed(2) + ' → ×' + Math.sqrt(lv+2).toFixed(2);
  if(k==='tech')  return '倍率 +' + (45*lv).toFixed(0) + '% → +' + (45*(lv+1)).toFixed(0) + '%';
  if(k==='print') return '增长系数 ' + (0.55*lv).toFixed(2) + ' → ' + (0.55*(lv+1)).toFixed(2);
  if(k==='net')   return '恢复 ' + (0.16*lv).toFixed(2) + '/s → ' + (0.16*(lv+1)).toFixed(2) + '/s';
  return '资金 ' + (40*lv).toFixed(0) + '% → ' + (40*(lv+1)).toFixed(0) + '%';
}

// --- 地图 ---
var canvas = document.getElementById('map');
var ctx = canvas.getContext('2d');
var TILES = [];
var hexR = 15;

function rnd(seed){ // 简单确定性随机
  var x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function buildMap(){
  TILES = [];
  var W = Math.sqrt(3) * hexR, H = hexR * 1.5;
  // 三块大陆的锚点（轴向坐标）
  var ANC = [ {x:-6.2, y:-1.5, r:4.6}, {x:5.4, y:2.4, r:4.2}, {x:0.8, y:6.4, r:3.4} ];
  for(var q=-14;q<=14;q++){
    for(var r=-14;r<=14;r++){
      var x = W * (q + r/2), y = H * r;
      var n1 = rnd(q*3 + r*7), n2 = rnd(q*11 - r*5);
      var best = 9, bi = 0;
      for(var i=0;i<ANC.length;i++){
        var a = ANC[i];
        var ax = W * (a.x + a.y/2), ay = H * a.y;
        var d = Math.hypot(x - ax, (y - ay) * 1.15) / (W * a.r);
        if(d < best){ best = d; bi = i; }
      }
      // 海岸线扰动
      var coast = best + 0.16 * (n1 - 0.5) + 0.10 * Math.sin(q * 0.9 + r * 0.6) + 0.08 * (n2 - 0.5);
      if(coast < 1.0){
        var thr = 0.05 + 0.52 * coast + 0.41 * n1;
        if(thr > 0.97) thr = 0.97;
        TILES.push({ ox:x, oy:y, thr:thr, seed:n1, coast:coast });
      }
    }
  }
}

function lerp(a,b,t){ return a + (b-a)*t; }

function drawMap(share){
  var prog = (share - BAL.loseShare) / (BAL.winShare - BAL.loseShare);
  prog = prog < 0 ? 0 : (prog > 1 ? 1 : prog);
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var cssW = canvas.clientWidth, cssH = Math.round(cssW * 0.64);
  if(canvas.width !== Math.round(cssW*dpr) || canvas.height !== Math.round(cssH*dpr)){
    canvas.width = Math.round(cssW*dpr); canvas.height = Math.round(cssH*dpr);
  }
  canvas.style.height = cssH + 'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cssW,cssH);

  // 背景
  var bg = ctx.createRadialGradient(cssW*0.5, cssH*0.5, 10, cssW*0.5, cssH*0.5, cssW*0.85);
  bg.addColorStop(0,'#0b1017'); bg.addColorStop(1,'#07090d');
  ctx.fillStyle = bg; ctx.fillRect(0,0,cssW,cssH);

  var scale = Math.min(cssW / (Math.sqrt(3)*hexR*27), cssH / (hexR*1.5*26));
  ctx.save();
  ctx.translate(cssW/2, cssH/2);
  ctx.scale(scale, scale);

  var gov = [148, 32, 40], lib = [26, 214, 196];
  for(var i=0;i<TILES.length;i++){
    var t = TILES[i];
    var local = (prog - t.thr) / 0.14;
    local = local < 0 ? 0 : (local > 1 ? 1 : local);
    var rr = lerp(gov[0], lib[0], local) | 0;
    var gg = lerp(gov[1], lib[1], local) | 0;
    var bb = lerp(gov[2], lib[2], local) | 0;
    // 未解放区域偏暗
    var lum = 0.55 + 0.45 * local + 0.12 * t.seed;
    var col = 'rgb(' + ((rr*lum)|0) + ',' + ((gg*lum)|0) + ',' + ((bb*lum)|0) + ')';

    ctx.beginPath();
    for(var k=0;k<6;k++){
      var ang = Math.PI/180 * (60*k);
      var px = t.ox + hexR*0.94*Math.cos(ang);
      var py = t.oy + hexR*0.94*Math.sin(ang);
      if(k===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    if(local > 0.72){
      ctx.strokeStyle = 'rgba(120,255,240,' + (0.10 + 0.22*local) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  ctx.restore();

  // 边框渐隐
  var vg = ctx.createRadialGradient(cssW*0.5, cssH*0.5, cssW*0.32, cssW*0.5, cssH*0.5, cssW*0.78);
  vg.addColorStop(0,'rgba(7,9,13,0)'); vg.addColorStop(1,'rgba(7,9,13,.92)');
  ctx.fillStyle = vg; ctx.fillRect(0,0,cssW,cssH);
}

// --- UI 渲染 ---
var el = {
  money: document.getElementById('sMoney'),
  follow: document.getElementById('sFollow'),
  stealth: document.getElementById('sStealth'),
  clock: document.getElementById('sClock'),
  statFollow: document.getElementById('statFollow'),
  statStealth: document.getElementById('statStealth'),
  pbfill: document.getElementById('pbfill'),
  pl: document.getElementById('pl'),
  gl: document.getElementById('gl'),
  ratio: document.getElementById('ratioTxt'),
  ops: document.getElementById('ops'),
  log: document.getElementById('log'),
  over: document.getElementById('over'),
  ovTitle: document.getElementById('ovTitle'),
  ovSub: document.getElementById('ovSub'),
  ovStats: document.getElementById('ovStats'),
  btnAssault: document.getElementById('btnAssault')
};

var opEls = {};
UPS.forEach(function(u){
  var d = document.createElement('div');
  d.className = 'op';
  d.innerHTML = '<div class="top"><span class="nm">' + u.name + '</span><span class="lv">Lv 0</span></div>' +
                '<div class="ds"></div><div class="cs"></div>';
  d.addEventListener('click', function(){
    if(buy(S, u.k)) pushLog('升级 ' + u.name + ' → Lv ' + S[u.k], 'good');
  });
  el.ops.appendChild(d);
  opEls[u.k] = d;
});

function pushLog(txt, cls){
  var s = document.createElement('span');
  if(cls) s.className = cls;
  s.textContent = txt;
  el.log.insertBefore(s, el.log.firstChild);
  while(el.log.children.length > 14) el.log.removeChild(el.log.lastChild);
}

function clockStr(t){
  var m = Math.floor(t/60), sc = Math.floor(t%60);
  return m + ':' + (sc<10?'0':'') + sc;
}

var lastDraw = 0;
function render(){
  var sh = shareOf(S);
  el.money.textContent = fmt(S.money);
  el.follow.textContent = fmt(S.follow);
  el.stealth.textContent = Math.round(S.stealth);
  el.clock.textContent = clockStr(S.t);

  el.statStealth.className = 'stat' + (S.stealth < 30 ? ' warn' : (S.stealth > 70 ? ' good' : ''));
  el.statFollow.className = 'stat';

  var pct = (sh - BAL.loseShare) / (BAL.winShare - BAL.loseShare) * 100;
  pct = Math.max(0, Math.min(100, pct));
  el.pbfill.style.width = pct + '%';
  el.pl.textContent = '民众 ' + (sh*100).toFixed(1) + '%';
  el.gl.textContent = '政府 ' + ((1-sh)*100).toFixed(1) + '%';
  el.ratio.textContent = '6:1 → 现在 ' + (S.P / S.G).toFixed(2) + ':1';

  for(var i=0;i<UPS.length;i++){
    var u = UPS[i], d = opEls[u.k], c = costOf(S, u.k);
    d.querySelector('.lv').textContent = 'Lv ' + S[u.k];
    d.querySelector('.ds').textContent = descOf(u.k, S[u.k]);
    d.querySelector('.cs').textContent = fmt(c) + ' 资金';
    var locked = (u.k === 'aid' && aidLocked(S));
    var can = S.money >= c && !locked;
    d.className = 'op ' + (can ? 'can' : 'dis');
    if(locked){
      d.querySelector('.ds').textContent = '需 技术小组 Lv5 解锁';
      d.querySelector('.cs').textContent = '锁定';
    }
  }

  if(S.assaultCd > 0){
    el.btnAssault.textContent = '整备中 ' + Math.ceil(S.assaultCd) + 's';
    el.btnAssault.className = 'cd';
  } else {
    el.btnAssault.textContent = '总攻（瘫痪镇压 +38%）';
    el.btnAssault.className = '';
  }

  var now = performance.now();
  if(now - lastDraw > 90){ lastDraw = now; drawMap(sh); }

  if(S.over){
    S.speed = 0;
    showOver();
  }
}

var overShown = false;
function showOver(){
  if(overShown) return;
  overShown = true;
  var win = S.over === 2;
  el.ovTitle.textContent = win ? '取得胜利' : '运动失败';
  el.ovTitle.style.color = win ? '#18e0c8' : '#ff6b6b';
  el.ovSub.textContent = win
    ? '黑铁当局的控制瓦解了。街区升起了自己的旗帜。'
    : '镇压超出了你们的承受能力，组织被连根拔起。';
  el.ovStats.textContent = '坚持 ' + clockStr(S.t) + '　·　最终比例 ' + (S.P/S.G).toFixed(2) + ':1　·　追随者 ' + fmt(S.follow);
  el.over.classList.remove('hide');
}

function restart(){
  S = newState();
  overShown = false;
  el.over.classList.add('hide');
  el.log.innerHTML = '';
  localStorage.removeItem(SAVE_KEY);
  setSpeed(1);
  pushLog('行动开始。黑铁当局已经注意到你们了。', 'dim');
}

document.getElementById('btnReset').addEventListener('click', function(){
  if(confirm('确定重新开始？')) restart();
});

document.getElementById('ovBtn').addEventListener('click', restart);

el.btnAssault.addEventListener('click', function(){
  if(assault(S)) pushLog('总攻发动：镇压体系被撕开缺口', 'go');
  else pushLog('总攻条件不足（需 400 追随者，且无冷却）', 'dim');
});

function setSpeed(v){
  S.speed = v;
  var btns = document.querySelectorAll('#speed button');
  for(var i=0;i<btns.length;i++){
    btns[i].className = (Number(btns[i].dataset.sp) === v) ? 'on' : '';
  }
}
document.getElementById('speed').addEventListener('click', function(e){
  var b = e.target.closest('button');
  if(!b) return;
  setSpeed(Number(b.dataset.sp));
});

// --- 存档 ---
function save(){
  try{
    var o = {};
    for(var k in S) o[k] = S[k];
    localStorage.setItem(SAVE_KEY, JSON.stringify(o));
  }catch(e){}
}
function load(){
  try{
    var raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    var o = JSON.parse(raw);
    if(!o || typeof o.P !== 'number') return false;
    for(var k in S) if(k in o) S[k] = o[k];
    return true;
  }catch(e){ return false; }
}

// --- 主循环 ---
var last = performance.now();
var acc = 0;
function loop(now){
  var real = (now - last) / 1000; last = now;
  if(real > 0.5) real = 0.5;
  var gdt = real * (S.speed || 0);
  if(gdt > 0){
    // 分步推进，保证事件不丢
    var step = Math.min(gdt, 0.1);
    var left = gdt;
    while(left > 0){
      var d = Math.min(left, step);
      tick(S, d);
      left -= d;
      if(S.pendingEvent){
        S.pendingEvent = false;
        var ev = pickEvent();
        ev.run(S);
        pushLog(ev.txt, ev.cls);
      }
      if(S.over) break;
    }
  }
  render();
  acc += real;
  if(acc > 6){ acc = 0; save(); }
  requestAnimationFrame(loop);
}

// 初始化
buildMap();
if(load()){
  overShown = S.over ? false : overShown;
  if(S.over){ overShown = false; }
  pushLog('已读取上次的进度。', 'dim');
  setSpeed(S.speed || 1);
} else {
  pushLog('行动开始。黑铁当局已经注意到你们了。', 'dim');
  pushLog('先用资金扩充地下武装，战力比达到 6:1 就能推翻它。', 'dim');
  setSpeed(1);
}
if(S.speed === 0 && !S.over) S.speed = 1;
render();
requestAnimationFrame(loop);
window.addEventListener('resize', function(){ lastDraw = 0; });
