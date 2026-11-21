// 反抗之战 · 核心逻辑（不依赖 DOM，可单独放进 Node 跑模拟）
var BAL = {
  startMoney: 600, startFollow: 1200, startStealth: 55,
  startP: 50, startG: 100,
  winShare: 6/7, loseShare: 1/7,
  armyBase: 60, armyK: 1.22,
  techBase: 140, techK: 1.30,
  printBase: 90, printK: 1.20,
  netBase: 160, netK: 1.22,
  aidBase: 240, aidK: 1.28
};

function newState(){
  return {
    t:0, money:BAL.startMoney, follow:BAL.startFollow, stealth:BAL.startStealth,
    army:0, tech:0, print:0, net:0, aid:0,
    P:BAL.startP, G:BAL.startG,
    curfew:0, assaultCd:0, over:0, speed:1, evTimer:26
  };
}

function shareOf(s){ return s.P / (s.P + s.G); }

function costOf(s, k){
  var base, kk;
  if(k==='army'){base=BAL.armyBase; kk=BAL.armyK;}
  else if(k==='tech'){base=BAL.techBase; kk=BAL.techK;}
  else if(k==='print'){base=BAL.printBase; kk=BAL.printK;}
  else if(k==='net'){base=BAL.netBase; kk=BAL.netK;}
  else {base=BAL.aidBase; kk=BAL.aidK;}
  return Math.floor(base * Math.pow(kk, s[k]));
}

function buy(s, k){
  if(k === 'aid' && s.tech < 5) return false;
  var c = costOf(s, k);
  if(s.money < c) return false;
  s.money -= c;
  s[k] += 1;
  if(k==='army') s.P += 5;
  if(k==='tech') s.P += 3;
  return true;
}

function assault(s){
  if(s.assaultCd > 0 || s.over) return false;
  if(s.follow < 400) return false;
  s.follow = Math.max(200, s.follow * 0.70);
  s.stealth = Math.max(3, s.stealth - 22);
  s.G = s.G * 0.62;
  s.assaultCd = 55;
  return true;
}

// 每帧推进 dt 游戏秒
function tick(s, dt){
  if(s.over) return;
  s.t += dt;

  // 隐蔽度自然回升
  s.stealth = Math.min(100, s.stealth + (0.30 + 0.16 * s.net) * dt);

  var sh = shareOf(s);
  var sf = 0.25 + 0.75 * (s.stealth / 100);   // 隐蔽度对增长的放大

  // 追随者
  var dF = (0.85 + 0.55 * s.print) * Math.pow(s.follow, 0.42) * sf;
  dF -= s.G * 0.0016 * (1 - s.stealth / 100);  // 政府镇压
  if(s.stealth < 22) dF -= Math.pow(s.follow, 0.42) * 0.55;  // 暴露后的清洗
  s.follow = Math.max(60, s.follow + dF * dt);

  // 资金
  var inc = 0.45 * Math.pow(s.follow, 0.62) * (1 + 0.40 * s.aid);
  if(s.curfew > 0){ inc *= 0.6; s.curfew -= dt; }
  s.money += inc * dt;

  // 民众战力
  s.P += 0.14 * s.army * (1 + 0.55 * s.tech) * dt;

  // 政府战力：你越强，它动员越狠
  var gRate = 0.30 + 5.5 * Math.pow(sh, 3);
  if(sh > 0.78) gRate += 2.0;
  s.G += gRate * dt;

  if(s.assaultCd > 0) s.assaultCd -= dt;

  // 事件
  s.evTimer -= dt;
  if(s.evTimer <= 0){
    s.evTimer = 20 + Math.random() * 14;
    s.pendingEvent = true;
  }

  var nowShare = shareOf(s);
  if(nowShare >= BAL.winShare){ s.over = 2; }
  else if(nowShare <= BAL.loseShare){ s.over = 1; }
}

// 事件表（会被 UI 每帧消费 pendingEvent）
var EVENTS = [
  {id:'raid',   w:3, txt:'大搜捕：当局夜间扫荡街区', cls:'bad',  run:function(s){
      s.stealth = Math.max(3, s.stealth - 12); s.follow *= 0.94; }},
  {id:'curfew', w:2, txt:'宵禁：城市断网停电，进账变慢', cls:'bad', run:function(s){
      s.curfew = 22; }},
  {id:'prop',   w:2, txt:'宣传战：官方媒体抹黑运动', cls:'bad', run:function(s){
      s.G *= 1.035; }},
  {id:'help',   w:3, txt:'国际声援：外部物资偷偷运到', cls:'good', run:function(s){
      s.money += 380 + 320 * Math.random(); }},
  {id:'strike', w:2, txt:'工人罢工：工厂停摆，队伍扩大', cls:'good', run:function(s){
      s.follow *= 1.08; s.stealth = Math.min(100, s.stealth + 6); }},
  {id:'spy',    w:1, txt:'内部有叛徒告密，据点暴露', cls:'bad', run:function(s){
      s.stealth = Math.max(3, s.stealth - 20); }},
  {id:'loot',   w:2, txt:'缴获军火库：资金大涨，当局补给受损', cls:'good', run:function(s){
      s.money *= 1.12; s.G *= 0.97; }}
];

function pickEvent(){
  var tot = 0, i;
  for(i=0;i<EVENTS.length;i++) tot += EVENTS[i].w;
  var r = Math.random() * tot;
  for(i=0;i<EVENTS.length;i++){ r -= EVENTS[i].w; if(r <= 0) return EVENTS[i]; }
  return EVENTS[0];
}
