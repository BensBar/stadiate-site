const views = {
  action: {
    file: 'live-board', title: 'Feel every down.',
    description: 'The field. The possession. The play that changes everything. A live game visualization, not a video broadcast.',
    alt: 'Football Action View rendering New England 29, Buffalo 26, with real final player stats and recent plays from October 4, 2026',
    platform: 'MAC SERVER · WEB BOARD', name: 'Game view',
  },
  multiview: {
    file: 'multiview', title: 'One screen. All your games.',
    description: 'Keep an eye on the whole slate with team-colored scoreboards. Pick a native multiview on Apple TV or configure each board through the hub.',
    alt: 'Four NFL scoreboards showing real final results from October 4, 2026',
    platform: 'APPLE TV OR MAC SERVER', name: 'Multiview',
  },
  art: {
    file: 'art-terrace', title: 'The score becomes part of the scene.',
    description: 'A sunlit terrace, a night café, a painter’s scorebook. Live game data belongs to the painting, not a box on top of it.',
    alt: 'Mediterranean terrace with real October 3–4, 2026 final sports scores inscribed into marble and ceramic surfaces',
    platform: 'APPLE TV OR MAC SERVER', name: 'Art View',
  },
  ticker: {
    file: 'command-ticker', title: 'Let the whole slate roll.',
    description: 'A continuous procession of team colors, scores, and game clocks. Built for the screen you can’t help glancing at.',
    alt: 'Stadiate ticker with large scrolling team-colored NFL score cards',
    platform: 'APPLE TV OR MAC SERVER', name: 'Ticker',
  },
};

const artScenes = {
  terrace: { title: 'Terrazza dei Limoni', alt: 'Sunlit Mediterranean terrace with game scores inscribed into marble pedestals and a ceramic pot' },
  nocturne: { title: 'Notte Stellata', alt: 'Star-filled Mediterranean night with live scores on a café chalkboard, wall plaque, and ceramic vase' },
  ukiyoe: { title: 'A new wave', alt: 'Japanese-inspired print with Mount Fuji, blue waves, and game scores in a paper cartouche' },
  italian: { title: 'Il Libro dei Punteggi', alt: 'Italian still life with game scores lettered onto the pages of an open book' },
  neon: { title: 'Neon nights', alt: 'Nighttime neon artwork with glowing sports scores incorporated into the scene' },
  botanical: { title: 'In full bloom', alt: 'Botanical artwork with game scores lettered into its illustrated composition' },
};

const boardImage = document.querySelector('#board-image');
const boardExpand = document.querySelector('#board-expand');
document.querySelector('.view-picker').hidden = false;
document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    const view = views[button.dataset.view];
    document.querySelectorAll('[data-view]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    boardImage.src = `assets/shots/${view.file}.jpg`;
    boardImage.alt = view.alt;
    document.querySelector('#board-title').textContent = view.title;
    document.querySelector('#board-description').textContent = view.description;
    document.querySelector('#board-platform').textContent = view.platform;
    boardExpand.href = boardImage.src;
    boardExpand.dataset.caption = `${view.name} — current Stadiate web board rendering real October 3–4, 2026 final results. Not recorded live.`;
    boardExpand.setAttribute('aria-label', `Enlarge ${view.name} screenshot`);
  });
});

const artImage = document.querySelector('#art-image');
const artExpand = document.querySelector('#art-expand');
const artButtons = [...document.querySelectorAll('[data-art]')];
document.querySelector('.art-picker').hidden = false;
artButtons.forEach((button, index) => {
  button.addEventListener('click', () => {
    const scene = artScenes[button.dataset.art];
    artButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    artImage.src = `assets/shots/art-${button.dataset.art}.jpg`;
    artImage.alt = scene.alt;
    document.querySelector('#art-title').textContent = scene.title;
    document.querySelector('#art-count').textContent = `${String(index + 1).padStart(2, '0')} / 06`;
    artExpand.href = artImage.src;
    artExpand.dataset.caption = `${scene.title} — Stadiate Art View rendering real October 3–4, 2026 final scores.`;
    artExpand.setAttribute('aria-label', `Enlarge ${scene.title} Art View`);
  });
});

const lightbox = document.querySelector('#lightbox');
let lightboxTrigger;
document.querySelectorAll('[data-lightbox]').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || typeof lightbox.showModal !== 'function') return;
    event.preventDefault();
    lightboxTrigger = link;
    document.querySelector('#lightbox-image').src = link.href;
    document.querySelector('#lightbox-image').alt = link.querySelector('img').alt;
    document.querySelector('#lightbox-caption').textContent = link.dataset.caption;
    lightbox.showModal();
  });
});
document.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', (event) => {
  if (event.target !== lightbox) return;
  const bounds = lightbox.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) lightbox.close();
});
lightbox.addEventListener('close', () => lightboxTrigger?.focus());

(() => {
  const T = window.STADIATE_TEAMS;
  if (!T) return;
  const ALL = [...T.nfl.map(t => ({ ...t, lg: 'nfl' })), ...T.ncaaf.map(t => ({ ...t, lg: 'ncaaf' }))];
  const find = (name) => ALL.find(t => t.n === name);
  const $ = (s, r = document) => r.querySelector(s);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- ribbon ---------- */
  const rib = $('#ribbon');
  const mix = ALL.slice().sort((x, y) => (x.c1 > y.c1 ? 1 : -1));
  for (let k = 0; k < 2; k++) mix.forEach(t => {
    const im = new Image(); im.src = t.img; im.alt = ''; im.loading = 'lazy'; im.width = 72; im.height = 72; rib.appendChild(im);
  });

  /* ---------- audio (synthesized, no files) ---------- */
  let ac, master, noise, soundOn = true;
  function audio() {
    if (!soundOn) return null;
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.3;
      const comp = ac.createDynamicsCompressor();
      master.connect(comp).connect(ac.destination);
      noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function crowd(dur = 2.8, peak = 0.9) {
    const a = audio(); if (!a) return;
    const t = a.currentTime, src = a.createBufferSource(); src.buffer = noise; src.loop = true;
    const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1000; bp.Q.value = 0.5;
    const g = a.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.25); g.gain.setTargetAtTime(peak * 0.55, t + 0.7, 0.6); g.gain.setTargetAtTime(0, t + dur - 0.9, 0.35);
    const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 4.7; lg.gain.value = 0.12; lfo.connect(lg).connect(g.gain);
    src.connect(bp).connect(g).connect(master); src.start(t); lfo.start(t); src.stop(t + dur + 0.6); lfo.stop(t + dur + 0.6);
  }
  function tone(freqs, start, dur, type = 'sawtooth', vol = 0.18, cutoff = 1300, vib = 0) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + start, lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 2;
    const g = a.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.05);
    g.gain.setValueAtTime(vol, t + dur - 0.15); g.gain.linearRampToValueAtTime(0, t + dur);
    lp.connect(g).connect(master);
    freqs.forEach(f => {
      const o = a.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 12;
      if (vib) { const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = 6; lg.gain.value = vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur); }
      o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    });
  }
  const SND = {
    horn() { tone([110, 138.6, 164.8], 0, 1.9, 'sawtooth', 0.2, 900); tone([220], 0, 1.9, 'square', 0.04, 1600); },
    fanfare() { [[523.25, 0, .16], [659.25, .16, .16], [783.99, .32, .16], [1046.5, .48, .7]].forEach(([f, s, d]) => tone([f, f / 2], s, d, 'square', 0.07, 2600)); },
    chime() { tone([659.25, 987.77], 0, 0.5, 'triangle', 0.16, 4000); tone([783.99, 1174.66], 0.18, 0.8, 'triangle', 0.16, 4000); },
    trombone() { [[233.08, 0, .5], [220, .5, .5], [207.65, 1, .5], [196, 1.5, 1.4]].forEach(([f, s, d], i) => tone([f], s, d, 'sawtooth', 0.14, 1100, i === 3 ? 5 : 0)); },
  };
  const sndBtn = $('#snd');
  sndBtn.onclick = () => {
    soundOn = !soundOn; sndBtn.setAttribute('aria-pressed', soundOn);
    sndBtn.textContent = soundOn ? '🔊 Sound on' : '🔇 Sound off';
    if (!soundOn && ac) ac.suspend();
  };

  /* ---------- confetti ---------- */
  const cv = $('#confetti'), cx = cv.getContext('2d');
  let parts = [], raf = 0;
  function burst(n, colors, power = 1) {
    if (reduced) return;
    const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = r.width * dpr; cv.height = r.height * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = r.width / 900;
    for (let i = 0; i < n; i++) {
      const fromSide = i % 3 === 0, left = i % 2;
      parts.push({
        x: fromSide ? (left ? 0 : r.width) : r.width * (0.35 + Math.random() * 0.3), y: fromSide ? r.height * 0.7 : r.height * 0.32,
        vx: fromSide ? (left ? 1 : -1) * (4 + Math.random() * 8) * k * power : (Math.random() - 0.5) * 14 * k * power,
        vy: -(5 + Math.random() * 9) * k * power, w: (5 + Math.random() * 6) * k + 2, h: (9 + Math.random() * 8) * k + 3,
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, ph: Math.random() * 6, c: colors[i % colors.length], life: 0,
      });
    }
    const H = r.height, W = r.width;
    if (!raf) raf = requestAnimationFrame(function loop() {
      cx.clearRect(0, 0, W, H);
      parts = parts.filter(p => p.y < H + 30 && p.life < 420);
      for (const p of parts) {
        p.life++; p.vy += 0.22 * k; p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx + Math.sin(p.life / 9 + p.ph) * 0.8; p.y += p.vy; p.r += p.vr;
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.scale(1, Math.abs(Math.cos(p.life / 7 + p.ph)) + 0.15);
        cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
      }
      raf = parts.length ? requestAnimationFrame(loop) : 0;
      if (!raf) cx.clearRect(0, 0, W, H);
    });
  }

  /* ---------- the room ---------- */
  $('#room-demo').hidden = false;
  const room = $('#room-scene'), sel = $('#team'), cap = $('#demo-status');
  const chips = [...document.querySelectorAll('#timeline li')];
  const groups = [['NFL', T.nfl.map(t => ({ ...t, lg: 'nfl' }))], ['College football', T.ncaaf.map(t => ({ ...t, lg: 'ncaaf' }))]];
  groups.forEach(([label, list]) => {
    const og = document.createElement('optgroup'); og.label = label;
    list.forEach(t => { const o = document.createElement('option'); o.value = t.n; o.textContent = t.n; og.appendChild(o); });
    sel.appendChild(og);
  });
  let team, rival, timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  function setTeam(name) {
    team = find(name); sel.value = team.n;
    const pool = ALL.filter(t => t.lg === team.lg && t.n !== team.n);
    rival = pool[Math.floor(Math.random() * pool.length)];
    room.style.setProperty('--c1', team.c1); room.style.setProperty('--c2', team.c2);
    document.querySelectorAll('.ev:not(.rival)').forEach(b => { b.style.setProperty('--c1', team.c1); b.style.setProperty('--c2', team.c2); });
    timeline.style.setProperty('--c1', team.c1);
    $('#tv-l').src = team.img; $('#tv-l').alt = team.n; $('#tv-r').src = rival.img; $('#tv-r').alt = rival.n;
    $('#badge-img').src = team.img; $('#badge-txt').textContent = `Following ${team.n} vs ${rival.n}`;
  }
  const timeline = $('#timeline');
  sel.onchange = () => { setTeam(sel.value); play('td'); };

  const EV = {
    td: { word: 'TOUCHDOWN', flashes: 10, sound: () => { SND.horn(); crowd(3.2, 1); }, confetti: 200, cheer: true,
      cap: t => `<strong>${t.n} touchdown.</strong> Lamps flashed in team colors, the goal horn sounded, the framed art TV on the wall lit up with a celebration (your main game stayed on), and the couch jumped up. That’s the whole room reacting.` },
    fg: { word: 'FIELD GOAL', flashes: 4, sound: () => { SND.chime(); crowd(1.8, 0.6); }, confetti: 70, cheer: true,
      cap: t => `<strong>Three points for ${t.n}.</strong> A smaller moment can get a smaller celebration: a quick pulse and a cheer.` },
    win: { word: 'VICTORY', flashes: 16, sound: () => { SND.fanfare(); SND.horn(); crowd(4.2, 1); }, confetti: 360, cheer: true,
      cap: t => `<strong>${t.n} win!</strong> Full stadium mode: a long light show, the fanfare, and confetti, with the framed art TV celebrating on the side wall.` },
    rival: { word: 'UGH.', flashes: 0, sound: () => SND.trombone(), confetti: 0, sad: true,
      cap: t => `<strong>${t.n} scored on you.</strong> Not every score is a party. With custom rules, the room can react to the other team too, like dimming for a moment of silence.` },
  };
  function reset() {
    timers.forEach(clearTimeout); timers = [];
    room.classList.remove('tko-on', 'cheer', 'boom', 'sad', 'shake');
    chips.forEach(c => c.classList.remove('on'));
    room.style.setProperty('--c1', team.c1); room.style.setProperty('--c2', team.c2);
  }
  function play(kind, silent) {
    reset();
    const e = EV[kind], who = e.sad ? rival : team;
    $('#tko-img').src = who.img; $('#tko-txt').textContent = e.word;
    cap.innerHTML = e.cap(who);
    chips[0].classList.add('on');
    if (e.sad) {
      room.classList.add('sad');
      room.style.setProperty('--c1', '#3a4466'); room.style.setProperty('--c2', '#222838');
      room.style.setProperty('--lit', 0.08);
      later(100, () => chips[1].classList.add('on'));
      later(150, () => { if (!silent) e.sound(); chips[2].classList.add('on'); });
      later(300, () => { room.classList.add('tko-on'); chips[3].classList.add('on'); });
      later(3400, () => { room.classList.remove('tko-on', 'sad'); room.style.setProperty('--lit', 0.3); room.style.setProperty('--c1', team.c1); room.style.setProperty('--c2', team.c2); });
      later(5200, () => chips.forEach(c => c.classList.remove('on')));
      return;
    }
    later(90, () => chips[1].classList.add('on'));
    for (let i = 0; i < e.flashes; i++) later(90 + i * 230, () => {
      const odd = i % 2;
      room.style.setProperty('--c1', odd ? team.c2 : team.c1); room.style.setProperty('--c2', odd ? team.c1 : team.c2);
      room.style.setProperty('--lit', odd ? 0.55 : 1);
    });
    later(180, () => { if (!silent) e.sound(); room.classList.add('boom'); chips[2].classList.add('on'); });
    later(280, () => { room.classList.add('tko-on'); chips[3].classList.add('on'); });
    later(380, () => {
      if (e.cheer) room.classList.add('cheer');
      if (!reduced) room.classList.add('shake');
      burst(e.confetti, [team.c1, team.c2, '#f7dc95', '#ffffff'], kind === 'win' ? 1.25 : 1);
      chips[4].classList.add('on');
    });
    const end = 90 + e.flashes * 230;
    later(end + 100, () => { room.style.setProperty('--c1', team.c1); room.style.setProperty('--c2', team.c2); room.style.setProperty('--lit', 0.6); room.classList.remove('shake'); });
    later(end + 1400, () => { room.classList.remove('boom', 'cheer'); room.style.setProperty('--lit', 0.4); });
    later(end + 2000, () => room.classList.remove('tko-on'));
    later(end + 3600, () => { room.style.setProperty('--lit', 0.3); chips.forEach(c => c.classList.remove('on')); });
  }
  document.querySelectorAll('.ev').forEach(b => (b.onclick = () => play(b.dataset.ev)));
  setTeam('Atlanta Falcons');

  // Silent preview the first time the room scrolls into view.
  let previewed = false;
  new IntersectionObserver((ents, io) => {
    if (ents[0].isIntersecting && !previewed && !reduced) { previewed = true; io.disconnect(); setTimeout(() => play('td', true), 500); }
  }, { threshold: 0.6 }).observe(room);

  /* ---------- gallery ---------- */
  const gal = $('#gallery');
  function renderGallery(tab) {
    gal.innerHTML = '';
    const list = tab === 'nfl' ? T.nfl.map(t => ({ ...t, lg: 'nfl' })) : T.ncaaf.map(t => ({ ...t, lg: 'ncaaf' })).filter(t => tab !== 'sec' || t.conf === 'SEC');
    list.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'tile'; b.style.setProperty('--c', t.c1); b.style.animationDelay = `${Math.min(i * 18, 500)}ms`;
      b.innerHTML = `${t.rank ? `<span class="rk">#${t.rank}</span>` : ''}<img src="${t.img}" alt="" loading="lazy" width="384" height="384"><b>${t.lg === 'nfl' ? t.s : t.n}</b><small>${t.lg === 'nfl' ? t.n.replace(' ' + t.s, '') : t.m}</small>`;
      b.setAttribute('aria-label', `Light the room for ${t.n}`);
      b.onclick = () => {
        setTeam(t.n);
        room.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
        setTimeout(() => play('td'), reduced ? 0 : 650);
      };
      gal.appendChild(b);
    });
  }
  document.querySelectorAll('.tabs button').forEach(b => (b.onclick = () => {
    document.querySelectorAll('.tabs button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    renderGallery(b.dataset.tab);
  }));
  renderGallery('nfl');

  /* ---------- scroll reveals ---------- */
  const rio = new IntersectionObserver(ents => ents.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } }), { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => rio.observe(el));
})();
