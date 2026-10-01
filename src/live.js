// "Campus Live": what is going on right now at each place, read from the running campus (the clock, the
// timetable, the mess windows, the events calendar and the people inside each building). It feeds the
// OneStop phone and the Info panel.
import { lectureFor } from './activities/content.js';
import { mealNow, nextMeal, priceOf, mealName } from './mess/menu.js';
import { fmtHour } from './life/clock.js';

const inside = (g, lm) => { const s = g.world.site(lm); return s ? g.life.insideOf(s).size : 0; };
const within = (h, a, b) => h >= a && h < b;

/** rows: { place, tag: 'live'|'open'|'closed'|'soon', head, detail, count? } */
export function campusLive(g) {
  const c = g.clock, h = c.hour, wd = c.weekday, weekend = c.weekend, rows = [];
  const row = (place, tag, head, detail, count) => rows.push({ place, tag, head, detail, count });

  // lectures: the Lecture Hall Complex and the Academic Complex
  if (!weekend && (within(h, 9, 13) || within(h, 14, 17))) {
    const slot = Math.floor(h), L = lectureFor(wd, slot, 'lhc'), A = lectureFor(wd, slot, 'academic'), nx = slot + 1 === 13 ? 14 : slot + 1;
    row('Lecture Hall Complex', 'live', `${fmtHour(slot)} · ${L.title}`, nx < 17 ? `Next at ${fmtHour(nx)}: ${lectureFor(wd, nx, 'lhc').title}` : 'Last lecture of the day', inside(g, 'lhc'));
    row('Academic Complex', 'live', `Labs and tutorials · ${A.title}`, 'Chemistry and physics labs, the computer lab, faculty cabins', inside(g, 'academic'));
  } else if (weekend) row('Lecture Hall Complex', 'closed', 'No lectures at the weekend', 'Classes are Monday to Friday, 9 AM to 5 PM');
  else if (within(h, 13, 14)) row('Lecture Hall Complex', 'soon', 'Lunch break', `Lectures resume at ${fmtHour(14)}: ${lectureFor(wd, 14, 'lhc').title}`);
  else row('Lecture Hall Complex', h < 9 ? 'soon' : 'closed', h < 9 ? `First lecture at ${fmtHour(9)}` : 'Classes are over for today', `Next: ${lectureFor(wd, 9, 'lhc').title} at ${fmtHour(9)}`);

  // the messes
  const m = mealNow(h);
  if (m) row('Hostel messes', 'live', `${mealName(m.id, wd)} is being served`, `Until ${fmtHour(m.to)} · your hostel's mess card is free, a guest coupon is ₹${priceOf(m.id, wd)}`);
  else { const n = nextMeal(h); row('Hostel messes', 'soon', `Next: ${mealName(n.id, wd)} at ${fmtHour(n.from)}`, `Guest coupon ₹${priceOf(n.id, wd)}`); }
  row('Hostel canteens', h >= 18 || h < 2 ? 'open' : 'soon', h >= 18 || h < 2 ? 'Open on the 2nd floor of each hostel' : 'Open from 6 PM to 2 AM', 'Noodles, rolls, chai and cold coffee');

  // events
  const ev = g.events.current(), nx = g.events.next();
  if (ev) row(ev.where, 'live', `${ev.name} is on`, `Until ${fmtHour(ev.to)}`);
  if (nx && (!ev || nx.d.id !== ev.id)) row(nx.d.where, 'soon', `Next: ${nx.d.name}`, `${nx.inHours < 20 ? `today at ${fmtHour(nx.d.from)}` : 'tomorrow'}`);

  // the library, the Computer Centre, the sports side
  row('Central Library', 'open', within(h, 20, 24) || h < 1.5 ? 'Busiest now: night study' : 'Open', 'Reading tables, issue and return desk', inside(g, 'library'));
  row('Computer Centre', within(h, 8, 24) ? 'open' : 'closed', within(h, 8, 24) ? 'Open · PCs with internet' : 'Opens at 8 AM', 'Open 8 AM to midnight');
  row('Swimming Pool', within(h, 6, 9) || within(h, 16, 20) ? (within(h, 16, 19) && !weekend ? 'live' : 'open') : 'closed', within(h, 16, 19) && !weekend ? 'Inter-hostel aquatics meet' : within(h, 6, 9) || within(h, 16, 20) ? 'Open for swimming' : 'Closed', 'Open 6 to 9 AM and 4 to 8 PM · costume and cap');
  row('Gym', within(h, 6, 9.5) || within(h, 16.5, 22) ? 'live' : 'open', within(h, 6, 9.5) || within(h, 16.5, 22) ? 'Busy now' : 'Quiet now', 'Weights, treadmills, stretching');
  row('Student Activity Centre', within(h, 17, 21.5) ? 'live' : 'open', within(h, 17, 21.5) ? 'Dance and music club practice' : 'Club rooms open', 'Dance, music, drama, photography, robotics');
  row('Sports grounds', within(h, 16.3, 19) ? 'live' : 'open', within(h, 16.3, 19) ? 'Matches on the grounds' : 'Open', 'Cricket, football, hockey, tennis, basketball, volleyball');
  row('Hospital', within(h, 9, 13) || within(h, 15, 19) ? 'open' : 'closed', within(h, 9, 13) || within(h, 15, 19) ? 'OPD open' : 'OPD closed: emergency only', 'OPD 9 AM to 1 PM and 3 to 7 PM');
  // gates
  const day = h >= 6 && h < 22;
  row('Gates', 'open', 'Main Gate open, day and night', day ? 'KV Gate and Khokha Gate open' : 'KV Gate and Khokha Gate closed until 6 AM');
  return rows;
}
