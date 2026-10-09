const views = {
  action: {
    file: 'live-board', title: 'Feel every down.',
    description: 'The field. The possession. The play that changes everything. A live game visualization, not a video broadcast.',
    alt: 'Football Action View rendering New England 29, Buffalo 26, with real final player stats and recent plays from October 4, 2026',
    platform: 'MAC SERVER · WEB BOARD', name: 'Action View',
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

const celebrateButton = document.querySelector('#celebrate-button');
celebrateButton.hidden = false;
const roomDemo = document.querySelector('#room-demo');
const demoStatus = document.querySelector('#demo-status');
let celebrationTimer;
celebrateButton.addEventListener('click', () => {
  clearTimeout(celebrationTimer);
  roomDemo.classList.add('celebrating');
  demoStatus.textContent = 'Touchdown! An illustration of team-color lights and a screen takeover, not a recorded event. No devices triggered.';
  celebrateButton.innerHTML = 'Run it back <span aria-hidden="true">↗</span>';
  celebrationTimer = setTimeout(() => {
    roomDemo.classList.remove('celebrating');
    demoStatus.textContent = 'Ready for the next big moment. This demo is silent and controls no devices.';
  }, 5500);
});
