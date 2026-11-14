(() => {
  const chart = document.querySelector('.pressure-stage .contours');
  if (!chart) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  function svg(name, attrs = {}) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    return element;
  }
  const fieldLayer = svg('g', {class: 'weather-field'});
  const labelLayer = svg('g', {class: 'weather-labels'});
  const levels = Array.from({length: 22}, (_, i) => 948 + 4 * i);
  const lines = levels.map(level => {
    const path = svg('path', {class: 'weather-isobar'});
    const label = svg('text', {class: 'pressure-label'});
    label.textContent = level;
    fieldLayer.append(path);
    labelLayer.append(label);
    return {path, label, level};
  });
  function makeCenter(symbol, type) {
    const group = svg('g', {class: 'weather-center ' + type});
    const letter = svg('text', {class: 'pressure-center', y: -3});
    const value = svg('text', {class: 'weather-center-value', y: 16});
    letter.textContent = symbol;
    group.append(letter, value);
    return {group, value};
  }
  const highMarker = makeCenter('H', 'weather-high');
  const lowMarker = makeCenter('L', 'weather-low');
  chart.querySelectorAll('.isobar-lines, .pressure-label, .pressure-center').forEach(el => el.remove());
  chart.append(fieldLayer, labelLayer, highMarker.group, lowMarker.group);

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const sceneDuration = 34;
  const period = 2 * sceneDuration;
  const width = 520, height = 380, step = 5;
  const cols = width / step + 1, rows = height / step + 1;
  const grid = new Float64Array(cols * rows);
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => { const k = clamp(x); return k * k * (3 - 2 * k); };
  const progress = (t, from, to) => smooth((t - from) / (to - from));
  let time = 0;
  let previous = null;
  let frame = null;
  let onscreen = true;

  // The high, cyclone and trough all contribute to one scalar pressure field.
  function buildField(t, tropical) {
    const phase = 2 * Math.PI * t / sceneDuration;
    const departure = progress(t, 5, 24);
    const returnWest = progress(t, 20, 34);
    const incoming = progress(t, 1, 17);
    const crossing = progress(t, 10, 27);
    const leaving = progress(t, 19, 34);
    const active = progress(t, 0, 6) * (1 - progress(t, 24, 34));
    const strength = 14 + 28 * progress(t, 5, 21);
    const hx = 255 + (tropical ? 470 * (progress(t, 3, 16) - progress(t, 19, 34)) : 535 * departure);
    const hx2 = -300 + 555 * returnWest;
    const hy = 190 + 13 * Math.sin(phase);
    const approach = progress(t, 1, 16);
    const north = progress(t, 16, 31);
    const lx = tropical ? 667 - 470 * approach : -205 + 438 * incoming + 114 * crossing + 421 * leaving;
    const ly = tropical ? 509 - 319 * approach - 367 * north : 278 - 90 * incoming - 37 * crossing - 52 * leaving;
    const tilt = -.58 + .55 * progress(t, 4, 22) + .17 * Math.sin(phase * 2);
    const hTilt = -.26 + .33 * Math.sin(phase);
    const lobes = [];
    const add = (amp, x, y, rx, ry, angle) => {
      const c = Math.cos(angle), s = Math.sin(angle);
      const a = 1 / (rx * rx), b = 1 / (ry * ry);
      lobes.push({amp,x,y,xx:a*c*c+b*s*s,xy:2*c*s*(a-b),yy:a*s*s+b*c*c});
    };
    // Both scenes start and end on the same high-pressure field.
    const eastHigh = tropical ? 1 : 1 - progress(t, 15, 30);
    const westHigh = tropical ? 0 : progress(t, 20, 33);
    add(24 * eastHigh, hx, hy, 176, 118, hTilt);
    add(24 * westHigh, hx2, hy, 176, 118, hTilt);
    add(3.4 * eastHigh, hx - 85, hy + 45, 125, 180, hTilt);
    add(3.4 * westHigh, hx2 - 85, hy + 45, 125, 180, hTilt);

    const at = (x, y) => {
      let value = 1009 + (x - 260) * .009 + (270 - y) * .010
        + 1.6 * Math.sin(x / 145 + y / 118 + phase);
      for (const g of lobes) {
        const u = x - g.x, v = y - g.y;
        value += g.amp * Math.exp(-(g.xx*u*u + g.xy*u*v + g.yy*v*v));
      }
      return value;
    };
    if (tropical) {
      const corePressure = 1005 - 60 * progress(t, 2, 16) + 42 * progress(t, 16, 31);
      const anomaly = (corePressure - at(lx, ly)) * active;
      // Compact, nearly circular core with a wider, shallow outer circulation.
      add(anomaly * .78, lx, ly, 65, 63, phase);
      add(anomaly * .22, lx, ly, 132, 121, tilt);
    } else {
      add(-strength * active, lx, ly, 98 + 12*Math.sin(phase), 75, tilt);
      add(-9 * active, lx - 74, ly + 84, 155, 34, -.87 + .23*Math.sin(phase));
      add(-5.4 * active, lx + 104, ly + 21, 135, 45, tilt + .2);
      add(5.8 * active, lx + 76, ly + 148, 180, 63, -.21);
    }
    return {at, highs: tropical ? [[hx, hy]] : [[hx, hy], [hx2, hy]], low: [lx, ly], active};
  }

  function extrema(at, [x, y], sign) {
    let value = at(x, y);
    for (const distance of [12, 6, 3, 1.5]) {
      const ox = x, oy = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const a = ox + dx * distance, b = oy + dy * distance;
        const candidate = at(a, b);
        if ((candidate - value) * sign > 0) { x = a; y = b; value = candidate; }
      }
    }
    return {x, y, value};
  }

  function placeCenter(marker, point, intensity) {
    const {x, y, value} = point;
    const edge = Math.min(x, width-x, y, height-y);
    marker.group.style.opacity = intensity * smooth(edge / 32);
    marker.group.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
    const number = String(Math.round(value));
    if (marker.value.textContent !== number) marker.value.textContent = number;
  }

  function render(elapsed) {
    const cycle = elapsed % period;
    const {at, highs, low, active} = buildField(cycle % sceneDuration, cycle >= sceneDuration);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      grid[y * cols + x] = at(x * step, y * step);
    }
    const geometry = levels.map(() => []);
    const candidates = levels.map(() => null);
    for (let row = 0; row < rows - 1; row++) for (let col = 0; col < cols - 1; col++) {
      const index = row * cols + col;
      const a = grid[index], b = grid[index+1], c = grid[index+cols+1], d = grid[index+cols];
      const from = Math.max(0, Math.ceil((Math.min(a,b,c,d) - levels[0]) / 4));
      const to = Math.min(levels.length-1, Math.floor((Math.max(a,b,c,d) - levels[0]) / 4));
      for (let k = from; k <= to; k++) {
        const v = levels[k], points = [];
        const x = col * step, y = row * step;
        if ((a < v) !== (b < v)) points[0] = [x+step*(v-a)/(b-a), y];
        if ((b < v) !== (c < v)) points[1] = [x+step, y+step*(v-b)/(c-b)];
        if ((d < v) !== (c < v)) points[2] = [x+step*(v-d)/(c-d), y+step];
        if ((a < v) !== (d < v)) points[3] = [x, y+step*(v-a)/(d-a)];
        const edges = points.filter(Boolean);
        const segment = (p, q) => {
          geometry[k].push('M'+p[0].toFixed(2)+' '+p[1].toFixed(2)+'L'+q[0].toFixed(2)+' '+q[1].toFixed(2));
          if (v % 8 !== 0) return;
          const px=(p[0]+q[0])/2, py=(p[1]+q[1])/2;
          if (px<40 || px>width-40 || py<34 || py>height-34) return;
          const score = Math.abs(py - (v < 1008 ? 105 : 242)) + .19*Math.abs(px-(k%3 === 0 ? 135 : 340));
          if (!candidates[k] || score < candidates[k].score) candidates[k] = {x:px,y:py,score};
        };
        if (edges.length === 2) segment(edges[0], edges[1]);
        // The bilinear saddle decides which branches join.
        else if (edges.length === 4) {
          if ((a-v)*(c-v) >= (b-v)*(d-v)) { segment(points[0],points[1]); segment(points[2],points[3]); }
          else { segment(points[0],points[3]); segment(points[1],points[2]); }
        }
      }
    }
    const high = highs.find(([x]) => x > 20 && x < width-20);
    const highPoint = high ? extrema(at, high, 1) : null;
    const lowPoint = extrema(at, low, -1);
    const occupied = [highPoint, lowPoint].filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const {path,label} = lines[i];
      path.setAttribute('d', geometry[i].join(''));
      const pos = candidates[i];
      const visible = pos && occupied.every(p => Math.abs(p.x-pos.x)>41 || Math.abs(p.y-pos.y)>20);
      label.style.opacity = visible ? 1 : 0;
      if (visible) {
        label.setAttribute('x', pos.x.toFixed(1));
        label.setAttribute('y', pos.y.toFixed(1));
        occupied.push(pos);
      }
    }
    if (highPoint) placeCenter(highMarker, highPoint, smooth((highPoint.value-1018)/7));
    else highMarker.group.style.opacity = 0;
    placeCenter(lowMarker, lowPoint, active * smooth((1009-lowPoint.value)/8));
  }

  function tick(now) {
    if (previous !== null) time += Math.min(now - previous, 50) / 1000;
    previous = now;
    render(time);
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    const reduce = reducedMotion.matches;
    const running = !reduce && onscreen && !document.hidden && !chart.closest('#home').hidden;
    chart.dataset.running = running ? 'true' : 'false';
    if (running && frame === null) frame = requestAnimationFrame(tick);
    if (!running && frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
      previous = null;
    }
    // Respect the operating system's motion preference with a static high.
    if (reduce) render(0);
    else if (!running) render(time);
  }

  reducedMotion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  const observer = new MutationObserver(sync);
  observer.observe(chart.closest('#home'), { attributes: true, attributeFilter: ['hidden'] });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { onscreen = entry.isIntersecting; sync(); }).observe(chart);
  }
  render(0);
  sync();
})();

