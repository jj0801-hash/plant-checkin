// @AI_GENERATED
// 解锁角色的动画：映射表（角色 id → 动作类型）和舞台构建。纯 JS，无外部库。
// 动作用 CSS 关键帧（css/anim.css）完成：在现有的角色图片上做移动、旋转、缩放，再加表情符号做特效，不需要新美术。
// 只在已解锁角色的详情弹窗里使用；未解锁的角色不会走到这里。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Anim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- 植物：14 类动作，t 是类型，fx 是该类型下的变体（颜色、表情符号、数量等）----
  var PLANT = {
    // 射手类：向僵尸发射东西
    peashooter:     { t: 'shoot', fx: 'pea' },
    repeater:       { t: 'shoot', fx: 'pea2' },
    snow_pea:       { t: 'shoot', fx: 'ice' },
    split_pea:      { t: 'shoot', fx: 'split' },
    puff_shroom:    { t: 'shoot', fx: 'spore' },
    fume_shroom:    { t: 'shoot', fx: 'fume' },
    scaredy_shroom: { t: 'shy',   fx: 'spore' },
    sea_shroom:     { t: 'shoot', fx: 'spore' },
    cactus:         { t: 'shoot', fx: 'spike' },
    starfruit:      { t: 'shoot', fx: 'star' },
    torchwood:      { t: 'shoot', fx: 'fire' },
    // 投手类：抛物线
    cabbage_pult:   { t: 'lob', fx: '🥬' },
    kernel_pult:    { t: 'lob', fx: '🌽' },
    melon_pult:     { t: 'lob', fx: '🍉' },
    winter_melon:   { t: 'lob', fx: '🧊' },
    cattail:        { t: 'lob', fx: '🌿' },
    cob_cannon:     { t: 'lob', fx: '🚀' },
    // 爆炸与范围类
    cherry_bomb:    { t: 'boom', fx: '🍒' },
    doom_shroom:    { t: 'boom', fx: '☠️' },
    gloom_shroom:   { t: 'boom', fx: '💚' },
    jalapeno:       { t: 'flame', fx: '🔥' },
    ice_shroom:     { t: 'freeze', fx: '❄️' },
    squash:         { t: 'smash', fx: '💨' },
    tangle_kelp:    { t: 'grab', fx: '🌿' },
    blover:         { t: 'wind', fx: '💨' },
    // 陷阱：僵尸走过来才弹出
    potato_mine:    { t: 'pop', fx: '💥' },
    spikeweed:      { t: 'pop', fx: '🗡️' },
    spikerock:      { t: 'pop', fx: '🗡️' },
    // 生产阳光
    sunflower:      { t: 'sun', fx: '☀️' },
    twin_sunflower: { t: 'sun', fx: '☀️☀️' },
    marigold:       { t: 'sun', fx: '🪙' },
    // 防御：僵尸撞上来
    wall_nut:       { t: 'guard', fx: 'hit' },
    tall_nut:       { t: 'guard', fx: 'hit' },
    pumpkin:        { t: 'guard', fx: 'hit' },
    garlic:         { t: 'guard', fx: 'stink' },
    // 辅助：发光、唤醒、吸铁
    lily_pad:       { t: 'glow', fx: '💧' },
    plantern:       { t: 'glow', fx: '✨' },
    flower_pot:     { t: 'glow', fx: '🌱' },
    coffee_bean:    { t: 'glow', fx: '⚡' },
    magnet_shroom:  { t: 'pull', fx: '🔩' }
  };

  // ---- 僵尸：每只一个技能动画 ----
  var ZOMBIE = {
    zombie_normal:    { t: 'walk' },
    zombie_newspaper: { t: 'rage' },
    zombie_jack:      { t: 'box' },
    zombie_dancer:    { t: 'dance' },
    zombie_cone:      { t: 'armor', fx: 'cone' },
    zombie_bucket:    { t: 'armor', fx: 'bucket' },
    zombie_digger:    { t: 'dig' },
    zombie_pole:      { t: 'vault' },
    zombie_balloon:   { t: 'float' },
    zombie_football:  { t: 'charge' },
    zombie_boss:      { t: 'boss' }
  };

  // 每一类动作在 css/anim.css 里都有对应的 .a-<类型>；新增类型时两边都要加（单元测试会检查）
  var PLANT_TYPES = ['shoot', 'lob', 'boom', 'flame', 'freeze', 'smash', 'grab', 'wind', 'pop', 'sun', 'guard', 'glow', 'pull', 'shy'];
  var ZOMBIE_TYPES = ['walk', 'rage', 'box', 'dance', 'armor', 'dig', 'vault', 'float', 'charge', 'boss'];
  var FALLBACK = { plant: { t: 'glow', fx: '✨' }, zombie: { t: 'walk' } };

  // 取某个角色的动作；表里没有的（以后新增的内容包角色）用默认的轻柔动作，不会出错
  function spec(kind, id) {
    var table = kind === 'zombie' ? ZOMBIE : PLANT;
    return table[id] || FALLBACK[kind === 'zombie' ? 'zombie' : 'plant'];
  }

  // ---------- 舞台：按类型创建需要的特效元素 ----------
  // 每个特效是 [类名, 文字]，类名要与 css/anim.css 里对应动作的选择器一致（p1/p2/p3、b1/b2/b3、f1..f5 等）。
  var SHOOT_SHAPES = { pea: 'pea', pea2: 'pea', ice: 'ice', split: 'pea', spore: 'spore', fume: 'fume', spike: 'spike', star: 'star', fire: '' };
  function plantFx(sp) {
    var fx = sp.fx;
    switch (sp.t) {
      case 'shoot':
        if (fx === 'star') return [['star s1 p1', '⭐'], ['star s2 p1', '⭐'], ['star s2 p2', '⭐'], ['star s2 p3', '⭐'], ['star s1 p2', '⭐']];
        if (fx === 'fire') return [['fire p1', '🔥'], ['fire p2', '🔥'], ['fire p3', '🔥']];
        var shape = SHOOT_SHAPES[fx] || 'pea', list = [[shape + ' dot p1', ''], [shape + ' dot p2', ''], [shape + ' dot p3', '']];
        if (fx === 'pea2') return [[shape + ' dot p1', ''], [shape + ' dot p1 q', ''], [shape + ' dot p2', ''], [shape + ' dot p2 q', '']];
        if (fx === 'split') return [[shape + ' dot p1', ''], [shape + ' dot p2', ''], [shape + ' dot back p1', ''], [shape + ' dot back p3', '']];
        return list;
      case 'lob':   return [['p1', fx], ['p2', fx], ['hit', '💥']];
      case 'boom':  return [['big b1', fx === '🍒' ? '💥' : fx === '☠️' ? '💀' : '☁️'], ['b2', fx], ['b3', fx]];
      case 'flame': return [['f1', fx], ['f2', fx], ['f3', fx], ['f4', fx], ['f5', fx]];
      case 'freeze': return [['wave', ''], ['snow', fx]];
      case 'smash': return [['', fx]];
      case 'grab':  return [['', fx]];
      case 'wind':  return [['w1', fx], ['w2', fx], ['w3', fx]];
      case 'pop':   return [['big', fx]];
      case 'sun':   return fx === '☀️☀️' ? [['u1', '☀️'], ['u2', '☀️'], ['u3', '☀️'], ['u1 t2', '☀️']] : [['u1', fx], ['u2', fx], ['u3', fx]];
      case 'guard': return [['', fx === 'stink' ? '💨' : '💢']];
      case 'glow':  return [['halo', ''], ['g1', fx], ['g2', fx]];
      case 'pull':  return [['', fx], ['m2', '🔧'], ['m3', '🔩']];
      case 'shy':   return [['spore dot p1', ''], ['spore dot p2', '']];
    }
    return [];
  }
  function zombieFx(sp) {
    switch (sp.t) {
      case 'walk':   return [['d1', '👣'], ['d2', '👣']];
      case 'rage':   return [['paper', '📰'], ['steam', '💢'], ['dust', '💨']];
      case 'box':    return [['note', '🎵'], ['note2', '🎶'], ['bang', '💥']];
      case 'dance':  return [['', '🎵'], ['n2', '🎶'], ['n3', '✨']];
      case 'armor':  return [['ball dot b1', ''], ['ball dot b2', ''], ['ball dot b3', ''], ['clang', sp.fx === 'bucket' ? '🔔' : '💥'], ['clang c2', sp.fx === 'bucket' ? '🔔' : '💥'], ['clang c3', sp.fx === 'bucket' ? '🔔' : '💥']];
      case 'dig':    return [['d1', '🟫'], ['d2', '🟫'], ['d3', '🌱']];
      case 'vault':  return [['', '💨']];
      case 'float':  return [['balloon', '🎈'], ['cloud', '☁️']];
      case 'charge': return [['k1', '💨'], ['k2', '💨'], ['k3', '💨']];
      case 'boss':   return [['orb dot', ''], ['stomp', '💥']];
    }
    return [];
  }

  function reducedMotion() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // 构建一个舞台。kind: 'plant' | 'zombie'。art: { hero: 角色图片地址, foe: 目标僵尸图片地址（植物用）}。
  // 返回 { el, replay, still }：el 是舞台元素；replay() 从头播放；still 为 true 表示系统要求减少动态效果，没有播放。
  function stage(kind, id, art, doc) {
    doc = doc || document;
    var sp = spec(kind, id), isZ = kind === 'zombie';
    function mk(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
    var el = mk('div', 'anim ' + (isZ ? 'z ' : '') + 'a-' + sp.t + (sp.fx && /^[a-z]+$/.test(sp.fx) && (sp.t === 'armor') ? ' ' + sp.fx : ''));
    el.setAttribute('data-anim', sp.t); el.setAttribute('aria-hidden', 'true');
    var hero = mk('img', 'hero'); hero.src = art.hero; hero.alt = '';
    el.appendChild(hero);
    if (isZ && sp.t === 'dance') {                                            // 舞王：两边各一个伴舞（同一张图）
      var f1 = mk('img', 'foe f1'); f1.src = art.hero; f1.alt = ''; el.appendChild(f1);
      var f2 = mk('img', 'foe f2'); f2.src = art.hero; f2.alt = ''; el.appendChild(f2);
    } else if (!isZ && art.foe) {
      var foe = mk('img', 'foe'); foe.src = art.foe; foe.alt = ''; el.appendChild(foe);
    }
    if (isZ && sp.t === 'vault') el.appendChild(mk('div', 'fence'));
    (isZ ? zombieFx(sp) : plantFx(sp)).forEach(function (f) { el.appendChild(mk('span', 'fx ' + f[0], f[1])); });
    var still = reducedMotion();
    if (still) el.appendChild(mk('span', 'hint', '系统关闭了动画'));
    function replay() {
      if (still) return;
      el.classList.remove('play');
      void el.offsetWidth;                                                    // 强制重新计算样式，让动画从头开始
      el.classList.add('play');
    }
    return { el: el, replay: replay, still: still, spec: sp };
  }

  return { PLANT: PLANT, ZOMBIE: ZOMBIE, PLANT_TYPES: PLANT_TYPES, ZOMBIE_TYPES: ZOMBIE_TYPES, spec: spec, FALLBACK: FALLBACK, stage: stage, plantFx: plantFx, zombieFx: zombieFx, reducedMotion: reducedMotion };
});
// @AI_GENERATED: end
