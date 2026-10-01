// Sports manager: which games are on where and when; join points for the player and
// for students heading out to play; drawing all the players.
import { CricketGame, battingActivity, NetPractice } from './cricket.js';
import { FootballGame, footballActivity } from './football.js';
import { BasketballCourt, VolleyCourt, Track, GroundLife, shootoutActivity, sprintActivity, rallyActivity } from './others.js';

const on = (h, ranges) => ranges.some(([a, b]) => h >= a && h < b);
const EVENING = [[16.3, 18.9]];

export class Sports {
  constructor(game) {
    this.g = game;
    const W = game.world;
    this.slots = [];
    const add = (f, kind, when, make, joinLabel, joinAct, radius) => this.slots.push({ f, kind, when, make, game: null, joinLabel, joinAct, radius });
    const cricketFields = W.fieldsOf('cricket').filter((f) => !f.practice).sort((a, b) => b.len * b.wid - a.len * a.wid);
    // each hostel's own cricket pitch: a batter, a bowler and a fielder at the nets in the evening
    for (const f of W.fieldsOf('cricket')) if (f.practice) add(f, 'practice', (h, we) => on(h, we ? [[7, 10], [16, 19.5]] : [[16.4, 19]]), () => new NetPractice(game, f), null, null, 0);
    cricketFields.forEach((f, i) => {
      add(f, 'cricket', (h, we, ev) => ev.cricket === f || on(h, we ? [[7.5, 11], [15.5, 18.6]] : [[16.2, 18.6]]),
        () => new CricketGame(game, f, { teams: i ? ['Kapili', 'Siang'] : ['Brahmaputra', 'Lohit'], big: this.eventBig(f) }), 'Join the cricket match (bat)', (gm) => battingActivity(gm, this), Math.min(f.len, f.wid) / 2);
      add(f, 'ground', (h, we, ev) => !ev.concertOn?.(f) && on(h, [[6, 19]]), () => new GroundLife(game, f), null, null, 0);
    });
    for (const f of [...W.fieldsOf('soccer'), ...W.fieldsOf('hockey')])
      add(f, 'football', (h, we) => on(h, we ? [[8, 11], ...EVENING] : EVENING), () => new FootballGame(game, f), 'Join the football match', (gm) => footballActivity(gm), Math.max(f.len, f.wid) / 2);
    for (const f of W.fieldsOf('basketball'))
      add(f, 'basketball', (h) => on(h, f.gen ? EVENING : [[7, 9], [16, 21.5]]), () => new BasketballCourt(game, f), 'Basketball shootout', (gm) => shootoutActivity(gm), 12);
    // people play in the evening (and a few in the afternoon); walk up and swap in for a player
    for (const f of W.fieldsOf('volleyball')) add(f, 'volleyball', (h, we) => on(h, we ? [[15, 18.8]] : [[16.4, 18.8]]) || (f.i % 4 === 0 && on(h, [[14.5, 16.4]])), () => new VolleyCourt(game, f, 'volleyball'), 'Swap in and play volleyball', (gm) => rallyActivity(gm), 6);
    for (const f of W.fieldsOf('tennis')) add(f, 'tennis', (h) => on(h, [[6.5, 8.5], [16.3, 18.8]]) || (f.i % 2 === 0 && on(h, [[15, 16.3]])), () => new VolleyCourt(game, f, 'tennis'), 'Swap in and play tennis', (gm) => rallyActivity(gm), 8);
    const ath = W.fieldsOf('athletics')[0];
    if (ath) {
      this.track = new Track(game, ath);
      this.trackSlot = { f: ath, kind: 'track' };
    }
    this.eventState = {};
    // join points (always available; games start when you arrive if they are not on)
    for (const s of this.slots) {
      if (!s.joinLabel) continue;
      const p = W.fieldPoint(s.f, 0, 0);
      game.interact.add({
        x: p.x, z: p.z, r: s.radius + 6, prio: -1,
        label: () => (s.game ? `${s.joinLabel} · swap in for a player` : `${s.joinLabel} (friends will join you)`),
        ok: () => (game.mode === 'walk' ? true : 'get off first'),
        when: () => !game.activity.active,
        run: () => { if (!s.game) s.game = s.make(); game.acts.g.activity.start(s.joinAct(s.game)); },
      });
    }
    if (ath) {
      const p = W.fieldPoint(ath, this.track.straight - 100, -(this.track.R + 3));
      game.interact.add({ x: p.x, z: p.z, r: 10, label: 'Race the 100 m sprint', run: () => { this.sprint = sprintActivity(this.track); game.activity.start(this.sprint); } });
    }
  }

  eventBig(f) { return this.g.events?.cricketFinal?.(f) || false; }

  /** where a student heading out "to play" should walk to */
  joinPoint(p, rnd) {
    const live = this.slots.filter((s) => s.game && s.kind !== 'ground');
    const s = live.length ? live[Math.floor(rnd() * live.length)] : this.slots[Math.floor(rnd() * this.slots.length)];
    if (!s) return null;
    const a = rnd() * Math.PI * 2, R = Math.min(s.f.len, s.f.wid) / 2 + 2;
    return { ...this.g.world.fieldPoint(s.f, Math.cos(a) * R, Math.sin(a) * R), field: s.f };
  }

  update(dt) {
    const g = this.g, h = g.clock.hour, we = g.clock.weekend;
    const ev = g.events?.sportsState?.() || {};
    const cam = g.camera.position;
    const inside = g.interior?.active;
    const rain = g.weather.state.rain > 0.35;
    for (const s of this.slots) {
      const want = !rain && s.when(h, we, ev);
      const playing = g.activity.cur && s.game && ['cricket', 'football', 'hoops', 'tennis', 'volleyball'].includes(g.activity.cur.name) && g.activity.cur.t >= 0 && (this.activeGame === s.game || s.game.manual);
      if (want && !s.game) s.game = s.make();
      if (!want && s.game && !playing && !(g.activity.cur && g.activity.cur._sportGame === s.game)) { s.game.dispose?.(); s.game = null; }
      if (!s.game) continue;
      const d = Math.hypot(s.f.cx - cam.x, s.f.cz - cam.z);
      s.game.near = d < 120;
      // far-away games only tick slowly (they are too far to see)
      if (inside) continue;
      if (d < 450 || s.game === this.activeGame) s.game.update(dt);
      s.game.setVisible?.(d < 450);
    }
    if (this.track) {
      const n = rain ? 0 : on(h, [[5.5, 8]]) ? 14 : on(h, [[16.8, 19.6]]) ? 12 : on(h, [[8, 16.8]]) ? 3 : on(h, [[19.6, 21.5]]) ? 5 : 0;
      this.track.update(dt, ev.sportsDay ? 0 : n);
    }
    const a = g.activity.cur;
    this.activeGame = a && (a.name === 'cricket' || a.name === 'football' || a.name === 'hoops') ? this.slots.find((s) => s.game && (a.cg === s.game || s.game.you || s.game.player))?.game : null;
  }

  draw(crowd) {
    if (this.g.interior?.active) return;
    for (const s of this.slots) if (s.game) s.game.draw(crowd);
    this.track?.draw(crowd);
    const a = this.g.activity.cur;
    if (a && a.draw) a.draw(crowd);
  }
}
