(() => {
  const story = document.querySelector('.aere-story');
  const map = story.querySelector('.aere-map');
  const world = document.querySelector('#aere-world');
  const ring = document.querySelector('#aere-radius');
  const pressure = document.querySelector('#aere-pressure');
  const trail = document.querySelector('#aere-trail');
  const birth = document.querySelector('#aere-birth');
  const narrow = matchMedia('(max-width:800px)');
  const centerX = 235, centerY = 149;
  const birthMinute = 49 * 60; // Aug 25, 03:00, relative to Aug 23, 02:00.
  const scale = .298;
  const kmPerDegree = 111.195;
  const kmPerLongitude = kmPerDegree * Math.cos(24 * Math.PI / 180);
  const points = AERE_FIXES.map(([minute, lon, lat, hpa, radius]) => ({
    minute,
    x: 18 + (lon - 114.9) * kmPerLongitude * scale,
    y: 33 + (27.8 - lat) * kmPerDegree * scale,
    hpa,
    radius: radius * scale,
  }));
  const duration = points.at(-1).minute;
  const vertex = (point, i) => (i ? 'L' : 'M') + point.x.toFixed(2) + ' ' + point.y.toFixed(2);
  let pending = false;

  function paint(progress) {
    const time = duration * progress;
    let next = 1;
    while (next < points.length - 1 && points[next].minute < time) next++;
    const a = points[next - 1], b = points[next];
    const fraction = (time - a.minute) / (b.minute - a.minute);
    const mix = key => a[key] + fraction * (b[key] - a[key]);
    const position = {x: mix('x'), y: mix('y')};
    world.setAttribute('transform', `translate(${(centerX - position.x).toFixed(2)} ${(centerY - position.y).toFixed(2)})`);
    ring.setAttribute('r', mix('radius').toFixed(2));
    const label = Math.round(mix('hpa')) + ' hPa';
    if (pressure.textContent !== label) pressure.textContent = label;
    trail.setAttribute('d', points.slice(0, next).map(vertex).join(' ') + ' ' + vertex(position, next));
    birth.classList.toggle('is-visible', time >= birthMinute && time < birthMinute + 240);
  }

  function update() {
    pending = false;
    if (!story.getClientRects().length) return;
    const box = story.getBoundingClientRect();
    const pinnedTop = parseFloat(getComputedStyle(map).top);
    const travel = Math.max(1, box.height - map.offsetHeight - (narrow.matches ? 20 : 0));
    paint(Math.max(0, Math.min(1, (pinnedTop - box.top) / travel)));
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  }

  function arrange() {
    // Put the map before the story on mobile so it can pin while text scrolls.
    if (narrow.matches) story.prepend(map);
    else story.append(map);
    schedule();
  }
  narrow.addEventListener('change', arrange);
  addEventListener('scroll', schedule, {passive: true});
  addEventListener('resize', schedule);
  addEventListener('hashchange', schedule);
  new ResizeObserver(schedule).observe(story);
  arrange();
})();
