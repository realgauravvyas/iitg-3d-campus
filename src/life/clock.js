// Campus time: day number, weekday, decimal hour (IST), adjustable speed.
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const SPEEDS = [
  { id: 'pause', name: 'Paused', k: 0 },
  { id: 'real', name: 'Real time', k: 1 },
  { id: 'x10', name: '1 min = 10 min', k: 10 },
  { id: 'x20', name: '1 min = 20 min', k: 20 },
  { id: 'x60', name: '1 min = 1 hour', k: 60 },
];

export function fmtHour(h) {
  h = ((h % 24) + 24) % 24;
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`;
}

export class CampusClock {
  constructor(saved = {}) {
    const now = new Date();
    const ist = new Date(now.getTime() + (5.5 * 60 + now.getTimezoneOffset()) * 60000);
    this.day = saved.day ?? 0;                       // days since the save started
    this.startWeekday = saved.startWeekday ?? ((ist.getDay() + 6) % 7); // Monday = 0
    this.hour = saved.hour ?? (ist.getHours() + ist.getMinutes() / 60);
    this.month = ist.getMonth();                     // 0 = January (drives the weather)
    this.speedId = saved.speedId || 'x20';
    this.listeners = [];
    this.jumpers = [];
  }
  get k() { return (SPEEDS.find((s) => s.id === this.speedId) || SPEEDS[3]).k; }
  get weekday() { return (this.startWeekday + this.day) % 7; }
  get dayName() { return DAYS[this.weekday]; }
  get weekend() { return this.weekday >= 5; }
  /** absolute campus time in hours, useful for timers */
  get abs() { return this.day * 24 + this.hour; }
  label() { return `${this.dayName.slice(0, 3)} ${fmtHour(this.hour)}`; }

  update(dt) {
    if (!this.k) return;
    this.advance((dt * this.k) / 3600);
  }
  advance(hours) {
    const before = this.hour;
    this.hour += hours;
    while (this.hour >= 24) { this.hour -= 24; this.day++; }
    for (const f of this.listeners) f(before, this.hour);
    if (hours > 0.4) for (const f of this.jumpers) f();
  }
  /** set the time of day directly (jumps: everybody on campus is re-placed) */
  set(h) {
    h = ((h % 24) + 24) % 24;
    if (h < this.hour - 0.01) this.day++;          // going "back" means the next day
    this.hour = h;
    for (const f of this.jumpers) f();
  }
  onJump(f) { this.jumpers.push(f); }
  /** Jump forward to a given hour (today if still ahead, else tomorrow). */
  skipTo(h, onDay = null) {
    let d = h - this.hour;
    if (d <= 0) d += 24;
    if (onDay !== null) { const wd = this.weekday; let days = (onDay - wd + 7) % 7; if (days === 0 && h <= this.hour) days = 7; d = days * 24 + (h - this.hour); }
    this.advance(d);
  }
  onTick(f) { this.listeners.push(f); }
  save() { return { day: this.day, startWeekday: this.startWeekday, hour: this.hour, speedId: this.speedId }; }
  /** true if `h` lies in [a, b) (wrapping past midnight) */
  static within(h, a, b) { return a <= b ? h >= a && h < b : h >= a || h < b; }
}
