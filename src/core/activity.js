// Activities take over the game for a while (meals, lectures, exams, labs, sports,
// jobs, movies...). An activity is an object with optional hooks:
//   start(), update(dt) -> false when finished, camera(cam, dt) -> true if it placed the
//   camera, end(cancelled), hud (string title), cancelable (default true), keepMoving
//   (player keeps walking/driving under the activity, e.g. jobs).
export class ActivityManager {
  constructor(game) {
    this.g = game;
    this.cur = null;
  }
  get active() { return !!this.cur; }
  /** true when the activity has taken over the controls (player movement paused) */
  get exclusive() { return !!this.cur && !this.cur.keepMoving; }
  is(name) { return this.cur && this.cur.name === name; }

  start(act) {
    if (this.cur) this.stop(true);
    this.cur = act;
    act.g = this.g;
    act.t = 0;
    act.done = false;
    this.g.input.exitLock();
    act.start?.();
    if (act.hud) this.g.ui.actBar(act.hud, act.cancelable !== false);
  }

  update(dt) {
    const a = this.cur;
    if (!a) return;
    a.t += dt;
    const r = a.update?.(dt);
    if (r === false || a.done) this.stop(false);
  }

  camera(cam, dt) { return this.cur?.camera ? this.cur.camera(cam, dt) : false; }

  stop(cancelled = true) {
    const a = this.cur;
    if (!a) return;
    this.cur = null;
    a.end?.(cancelled);
    this.g.ui.actBar(null);
    this.g.ui.actPanel(null);
  }
}
