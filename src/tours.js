import * as THREE from 'three';
import { ribbon } from './scene/roads.js';
import { FILTERS } from './route.js';
import { makeStops } from './bus.js';
import { canvasTexture, fmtDist } from './util.js';
import { mealNow, nextMeal } from './interiors/templates.js';

/** Glowing chevron ribbon along the roads to a target, plus a light beacon on it. */
export class RouteGuide {
  constructor(game) {
    this.g = game;
    this.tex = canvasTexture(64, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,196,60,0.95)';
      for (const y0 of [8, 72]) {
        g.beginPath(); g.moveTo(8, y0 + 40); g.lineTo(32, y0 + 10); g.lineTo(56, y0 + 40); g.lineTo(56, y0 + 54); g.lineTo(32, y0 + 24); g.lineTo(8, y0 + 54); g.closePath(); g.fill();
      }
    });
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -6 });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.renderOrder = 5;
    game.scene.add(this.mesh);
    const bg = new THREE.CylinderGeometry(2.2, 2.2, 160, 20, 1, true).translate(0, 80, 0);
    this.beacon = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xffc84a, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(6, 0.25, 6, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc84a, fog: false }));
    game.scene.add(this.beacon, this.ring);
    this.target = null;
    this.timer = 0;
    this.pts = null;
    this.clear();
  }

  set(x, z, name) {
    // aim for the reachable road point in front of the place, not the middle of a building
    const snap = this.g.graph.nearestOnNetwork(x, z, FILTERS.bike);
    if (snap && (snap.d > 8 || this.g.world.buildingAt(x, z))) { x = snap.x; z = snap.z; }
    this.target = { x, z, name };
    this.timer = 0;
    const y = this.g.world.heightAt(x, z);
    this.beacon.position.set(x, y, z); this.ring.position.set(x, y + 0.4, z);
    this.beacon.visible = this.ring.visible = this.mesh.visible = true;
  }

  clear() {
    this.target = null;
    this.beacon.visible = this.ring.visible = this.mesh.visible = false;
    this.pts = null;
  }

  distance(from) { return this.target ? Math.hypot(this.target.x - from.x, this.target.z - from.z) : Infinity; }

  update(dt, from) {
    if (!this.target) return;
    const t = performance.now() / 1000;
    this.tex.offset.y = -t * 0.9;
    this.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
    this.beacon.material.opacity = 0.16 + Math.sin(t * 2) * 0.06;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 1.2;
    const { graph, world } = this.g;
    const a = graph.nearestNode(from.x, from.z, FILTERS.bike, true), b = graph.nearestNode(this.target.x, this.target.z, FILTERS.bike, true);
    const p = graph.path(a, b, FILTERS.bike);
    const pts = [[from.x, from.z]];
    if (p) for (const q of p.pts) pts.push(q);
    pts.push([this.target.x, this.target.z]);
    // drop the first road node if it is behind us
    if (pts.length > 3) {
      const [x0, z0] = pts[0], [x1, z1] = pts[1], [x2, z2] = pts[2];
      if ((x1 - x0) * (x2 - x1) + (z1 - z0) * (z2 - z1) < 0) pts.splice(1, 1);
    }
    this.pts = pts;
    const B = { p: [], n: [], u: [] };
    ribbon(world, pts, 1.3, 0.42, B, 1.3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(B.u, 2));
    this.mesh.geometry.dispose();
    this.mesh.geometry = g;
    this.pathLen = p ? p.len : this.distance(from);
  }
}

const BIKE_TOUR_IDS = ['admin', 'auditorium', 'library', 'lhc', 'academic', 'workshop', 'lake', 'athletics', 'pool', 'hospital',
  'guesthouse', 'serpentine', 'shopping', 'siang', 'brahmaputra', 'manas', 'subansiri', 'newsac'];

export class BikeTour {
  constructor(game, guide) {
    this.g = game; this.guide = guide; this.active = false;
  }

  start() {
    const { world, graph, player, ui, audio } = this.g;
    const stops = makeStops(world, BIKE_TOUR_IDS);
    let start = 0, bd = Infinity;
    stops.forEach((s, i) => { const d = Math.hypot(s.x - player.pos.x, s.z - player.pos.z); if (d < bd) { bd = d; start = i; } });
    const tour = graph.tour(stops, FILTERS.bike, { loop: false, start });
    this.stops = tour.order;
    this.idx = 0;
    this.active = true;
    this.go();
    ui.toast(`Guided bicycle tour: ${this.stops.length} stops, about ${fmtDist(tour.length)}. Follow the golden arrows.`, 'info');
    audio.speak(`Guided cycle tour started. First stop: ${this.stops[0].name}.`);
  }

  go() {
    const s = this.stops[this.idx];
    this.guide.set(s.x, s.z, s.name);
    this.g.ui.tourPanel(true, { title: 'Bicycle tour', stop: s.name, i: this.idx + 1, n: this.stops.length });
  }

  stop(msg) {
    this.active = false;
    this.guide.clear();
    this.g.ui.tourPanel(false);
    if (msg) this.g.ui.toast(msg, 'info');
  }

  update(dt) {
    if (!this.active) return;
    const p = this.g.player.pos;
    const s = this.stops[this.idx];
    const d = this.guide.distance(p);
    this.g.ui.tourTick(fmtDist(this.guide.pathLen && d > 30 ? this.guide.pathLen : d));
    if (d < 20) {
      const { ui, audio, progress } = this.g;
      for (const l of s.lms) progress.discover(l, true);
      audio.stopChime();
      ui.card(s.name, s.lms.map((l) => l.desc).join(' '), s.lms[0].kind, `Stop ${this.idx + 1} of ${this.stops.length}`);
      audio.speak(`${s.name}. ${s.lms[0].desc}`);
      this.idx++;
      if (this.idx >= this.stops.length) {
        progress.unlock('bike_tour');
        this.stop('Bicycle tour complete. Great ride!');
        return;
      }
      this.go();
    }
  }
}

/** Timed race to the Lecture Hall Complex, the classic IITG morning sprint. */
export class LateForClass {
  constructor(game, guide) { this.g = game; this.guide = guide; this.active = false; }

  /** where you are late for, right now: a class, your mess before it closes, or the library */
  pickTarget() {
    const { world, player, clock, progress } = this.g;
    const h = clock.hour, P = player.pos;
    const far = (l) => l && Math.hypot(l.wx - P.x, l.wz - P.z) > 120;
    // weekday timetable: classes 8:00-12:55 and 14:00-17:30; lunch in between
    const classOn = !clock.weekend && ((h >= 7.6 && h < 12.9) || (h >= 13.9 && h < 17.5));
    const nm = nextMeal(h);
    const meal = mealNow(h) || (nm.from > h && nm.from - h < 0.6 ? nm : null);
    const home = world.landmark(progress.profile.hostel) || world.landmarks.find((l) => l.kind === 'hostel');
    if (meal && !classOn && far(home)) return { lm: home, title: `${meal.name} ends soon!`, say: `${meal.name} at the ${home.name} mess ends soon. Hurry!`, done: `Made it for ${meal.name.toLowerCase()}` };
    if (classOn) {
      // the nearest teaching block that is far enough to be a race (never the one you are standing at)
      const blocks = ['lhc', 'academic', 'core5', 'workshop'].map((id) => world.landmark(id)).filter(far)
        .sort((a, b) => Math.hypot(a.wx - P.x, a.wz - P.z) - Math.hypot(b.wx - P.x, b.wz - P.z));
      if (blocks.length) {
        const l = blocks[0], slot = Math.ceil(h + 0.05);
        return { lm: l, title: 'Late for class!', say: `You are late for your ${slot > 12 ? slot - 12 : slot} o'clock class at the ${l.name}!`, done: 'Made it to class' };
      }
    }
    const lib = world.landmark('library'), fc = world.landmark('foodcourt');
    if (h >= 20 || h < 2) {
      if (h >= 22.5 || h < 1) { if (far(fc)) return { lm: fc, title: 'Night canteen closes at 1!', say: 'Your friends are ordering noodles at the night canteen at the Food Court. Hurry before it shuts!', done: 'Made it before closing' }; }
      if (far(lib)) return { lm: lib, title: 'Library closes at 2 am!', say: 'Your study group is waiting at the Central Library. Hurry!', done: 'Made it to the library' };
    }
    if (h >= 2 && h < 6) return { lm: far(home) ? home : lib, title: 'Time to get some sleep!', say: 'It is very late. Get back to your hostel!', done: 'Home safe' };
    // evening: your team is waiting at the grounds
    const g = [world.landmark('athletics'), world.landmark('cricket'), world.landmark('newsac')].filter(far)[0] || (far(home) ? home : lib);
    return { lm: g, title: g.kind === 'sports' ? 'Match starting!' : 'Running late!', say: `Your friends are waiting at the ${g.name}. Hurry!`, done: 'Made it in time' };
  }

  start() {
    const { world, graph, player, ui, audio, progress } = this.g;
    const tgt = this.pickTarget();
    const dest = tgt.lm;
    this.info = tgt;
    const a = graph.nearestNode(player.pos.x, player.pos.z, FILTERS.bike, true), b = graph.nearestNode(dest.wx, dest.wz, FILTERS.bike, true);
    const p = graph.path(a, b, FILTERS.bike);
    const len = (p ? p.len : 600) + 40;
    this.limit = Math.round(len / 6.0 + 20);
    this.t = this.limit;
    this.dest = dest;
    this.active = true;
    this.guide.set(dest.wx, dest.wz, dest.name);
    const best = progress.best[dest.id];
    ui.challenge(true, dest.name, this.limit, best, tgt.title);
    audio.speak(`${tgt.say} You have ${this.limit} seconds.`);
  }

  stop() { this.active = false; this.guide.clear(); this.g.ui.challenge(false); }

  update(dt) {
    if (!this.active) return;
    const { ui, audio, progress, player } = this.g;
    this.t -= dt;
    ui.challengeTick(Math.max(0, this.t));
    if (this.guide.distance(player.pos) < 20) {
      const used = this.limit - this.t;
      const prev = progress.best[this.dest.id];
      if (!prev || used < prev) progress.best[this.dest.id] = Math.round(used * 10) / 10;
      progress.unlock('late_class');
      progress.save();
      ui.toast(`${this.info?.done || 'Made it'} with ${Math.ceil(this.t)} s to spare! (${used.toFixed(1)} s)`, 'gold');
      audio.achievement();
      this.stop();
    } else if (this.t <= 0) {
      ui.toast(this.info?.title?.startsWith('Late for class') ? 'Too late! The professor has already taken attendance. Press L to try again.' : 'Too late this time. Press L to try again.', 'warn');
      audio.tone(220, 0.6, { type: 'sawtooth', gain: 0.1, slideTo: 110 });
      this.stop();
    }
  }
}
