const $ = s => document.querySelector(s);
let lang = 'en';
const tr = key => COPY[lang][key];
const pick = value => value[lang === 'zh' ? 1 : 0];
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sortedProjects = [...PROJECTS].sort((a,b) => b.date.localeCompare(a.date));

function activateOptionalImage(img) {
  img.onload = () => { img.hidden = false; };
  img.onerror = () => { img.hidden = true; };
  if (img.complete) img.hidden = img.naturalWidth === 0;
}

function renderWorks() {
  const openIds = new Set([...document.querySelectorAll('.work[open]')].map(x => x.dataset.id));
  let year = '';
  $('#work-list').innerHTML = sortedProjects.map(p => {
    let heading = '';
    if (year !== p.date.slice(0,4)) { year = p.date.slice(0,4); heading = `<div class="year-label">${year}</div>`; }
    return heading + `<details class="work" id="project-${p.id}" data-id="${p.id}" ${openIds.has(p.id) ? 'open' : ''}><summary><span class="work-date">${p.date.replace('-','.')} ${p.end ? '– '+p.end.slice(5) : ''}</span><div><span class="work-type ${p.award ? 'award-label' : ''}">${p.award ? '✧ ' : ''}${tr(p.category)}${p.ongoing ? `<span class="in-progress">${tr('progress')}</span>` : ''}</span><h3>${esc(pick(p.title))}</h3><div class="tags">${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div></div><span class="expand-icon" aria-hidden="true">+</span></summary><div class="work-body"><p><strong>${esc(pick(p.org))}</strong></p>${p.recognition ? `<p class="award-label">✧ ${esc(pick(p.recognition))}</p>` : ''}<p>${esc(pick(p.body))}</p>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="text-link">${tr('projectLink')}</a>` : ''}</div></details>`;
  }).join('');
}

function render() {
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  document.querySelectorAll('[data-i]').forEach(el => { el.innerHTML = tr(el.dataset.i); });
  $('#language').textContent = lang === 'en' ? '中文' : 'EN';
  $('#language').setAttribute('aria-label', lang === 'en' ? 'Switch to Chinese' : '切換為英文');
  $('#about-copy').innerHTML = tr('aboutParagraphs').map(p => `<p>${p}</p>`).join('');
  $('#timeline').innerHTML = MILESTONES.map(m => `<a class="milestone" href="#works/${m.target}"><small>${m.date}</small><strong>${pick(m.title)}</strong><p>${pick(m.desc)}</p><span class="milestone-arrow" aria-hidden="true">↗</span></a>`).join('');
  $('#hobby-grid').innerHTML = HOBBIES.map(h => `<article class="hobby-card"><div class="hobby-art"><svg viewBox="0 0 120 100" aria-hidden="true">${h.art}</svg><img src="${esc(h.image || `assets/photos/${h.id}.jpg`)}" alt="${esc(pick(h.title))}" loading="lazy"></div><div class="hobby-text"><span class="eyebrow">${h.date}</span><h2>${pick(h.title)}</h2><p>${pick(h.text)}</p>${h.url ? `<a class="text-link" href="${h.url}" target="_blank" rel="noopener noreferrer">${pick(h.link)}</a>` : ''}</div></article>`).join('');
  $('#reserved-hobbies').innerHTML = [4,5].map(n => `<article class="reserved-card"><span>0${n} / +</span><h3>${tr('reserved')}</h3><p>${tr('reservedDesc')}</p></article>`).join('');
  $('#photo-grid').innerHTML = PHOTOS.map(p => `<figure><div class="photo-slot"><span>${p.number}</span><small>${tr('photosSoon')}</small><img src="${esc(p.src)}" alt="${esc(pick(p.title))}" loading="lazy"></div><figcaption>${pick(p.title)}</figcaption></figure>`).join('');
  $('#education').innerHTML = lang === 'en' ? '<article><small>2022 — 2026</small><h2>National Yang Ming Chiao Tung University</h2><p>B.S. in Computer Science · GPA 3.95 / 4.30</p></article><article><small>JAN — JUN 2026</small><h2>Technical University of Denmark</h2><p>Exchange student · Grade average 10.0 / 12.0</p></article>' : '<article><small>2022 — 2026</small><h2>國立陽明交通大學</h2><p>資訊工程學士 · GPA 3.95 / 4.30</p></article><article><small>2026 年 1–6 月</small><h2>丹麥科技大學</h2><p>交換學生 · 平均成績 10.0 / 12.0</p></article>';
  document.querySelectorAll('.hobby-art img,.photo-slot img').forEach(activateOptionalImage);
  renderWorks(); route(false);
}

function route(move = true) {
  const [requested, target] = location.hash.slice(1).split('/');
  const id = ['home','works','hobby','photos','cv'].includes(requested) ? requested : 'home';
  document.querySelectorAll('.page').forEach(p => { p.hidden = p.id !== id; });
  document.querySelectorAll('.masthead nav a').forEach(a => {
    if (a.hash === '#'+id) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
  });
  document.querySelectorAll('.work.targeted').forEach(el => el.classList.remove('targeted'));
  if (id === 'works' && PROJECTS.some(p => p.id === target)) {
    const work = document.getElementById('project-'+target);
    work.open = true; work.classList.add('targeted');
    if (move) requestAnimationFrame(() => { work.scrollIntoView({block:'start'}); work.querySelector('summary').focus({preventScroll:true}); });
  } else if (move) {
    window.scrollTo({top:0,behavior:'instant'});
    $('#main').focus({preventScroll:true});
  }
  document.title = `${tr('displayName')} · ${id === 'home' ? 'Weather, Data & Curiosity' : id === 'cv' ? 'Curriculum Vitae' : tr(id)}`;
}

$('#language').onclick = () => {
  lang = lang === 'en' ? 'zh' : 'en';
  render();
};
addEventListener('hashchange', () => route());
activateOptionalImage($('#profile-image'));
render();
