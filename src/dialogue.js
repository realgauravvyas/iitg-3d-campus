// Talking to people (E). Every kind of person has more than a hundred things to say: their own lines (dialogue_a/b/c.js) and
// the lines everybody can say about the moment: the time, the weather, the meal, the events, the bus, the place you are in.
// Nobody repeats a line until they have said what they have to say (a shuffled bag per role, and a short memory per person).
import { mulberry32 } from './util.js';
import { fmtHour, DAYS } from './life/clock.js';
import { MEALS, mealNow, nextMeal, messMenu } from './mess/menu.js';
import { environment } from './life/environment.js';
import * as A from './dialogue_a.js';
import * as B from './dialogue_b.js';
import * as C from './dialogue_c.js';

export const LINES = { ...A, ...B, ...C };

/** what is said about the place you are in, by landmark */
const PLACE = {
  library: ['The library is just there. It stays open until two in the night.', 'Quiet now, we are close to the library.'],
  hospital: ['The hospital is close, in case of anything. The emergency never closes.', 'Please keep the noise down, the hospital is near.'],
  lhc: ['The Lecture Hall Complex is right here. The big lectures are held in it.', 'The LHC canteen is near, the best place for a quick tea.'],
  academic: ['The Academic Complex is the big block with the Cores. Everyone is lost in it in the first week.'],
  admin: ['The Administrative Building, with the flag lawn in front. Beautiful in the morning.'],
  auditorium: ['The auditorium is just here. A wooden stage, red drapes. They show films on Fridays.'],
  conference: ['The Conference Centre is near. The AI Confluence is held in it.'],
  sac: ['The Student Activity Centre: clubs, music, dance. You can hear the guitar from the road in the evening.'],
  newsac: ['The New SAC is next to us, for the fest practice and the clubs.'],
  gym: ['The gym is near. The mornings are quieter than the evenings.'],
  pool: ['The swimming pool is near. It is open six to nine in the morning and four to eight in the evening.'],
  athletics: ['The athletics track is next to us. The evening runners fill it at half past five.'],
  cricket: ['The cricket ground is near, with the concert stage at the edge. The lights come on for the Pronites.'],
  lake: ['The lake is just there. Evenings are the best, with the lights on the water.'],
  serpentine: ['This is the Serpentine Lake. It winds round the north-west of the campus. Quiet and green.'],
  foodcourt: ['The Food Court is near. Pizza, sandwiches, ice cream, momos and a cafe.'],
  shopping: ['The Market Complex is near, with the bank, the ATM, the shops and the eateries.'],
  guesthouse: ['The Guest House is near, by the lake. The parents like it better than the hostels.'],
  tic: ['The Technology Incubation Centre is next to us. A few start-ups started here.'],
  techpark: ['The Technology Park is here, on the old east cricket ground. Start-ups and research in new buildings.'],
  busstop: ['This is the IITG Bus Stop. Every campus bus starts here.'],
  transit: ['The Transit Complex is near. Visitors stay here for a few days.'],
  viewpoint: ['The View Point is on the top of the hill. A long walk of two and a half kilometres on foot.'],
  childpark: ['This is the Children\'s Park. The little ones fill it in the evening.'],
  workshop: ['The Mechanical Workshop is near. You can hear the machines.'],
  core5: ['Core 5 is the western block of the Academic Complex.'],
};

const n = (x) => Math.round(x);

/** things anyone can say about the moment: (c) => a sentence, or null when it does not fit now */
export const SHARED = [
  (c) => `It is ${c.time} on a ${c.day} already. ${c.part === 'night' ? 'Time to sleep soon.' : c.part === 'morning' ? 'The day is young.' : c.part === 'afternoon' ? 'The afternoon goes slowly here.' : 'The evening is the best part of the day.'}`,
  (c) => (c.rain > 0.4 ? 'It is raining hard. Take an umbrella, and watch the puddles on the road.' : null),
  (c) => (c.rain > 0.1 && c.rain <= 0.4 ? 'A little drizzle. It will pass in a while.' : null),
  (c) => (c.rain <= 0.1 && c.temp >= 32 ? `It is ${n(c.temp)} degrees and humid. Drink plenty of water and keep to the shade.` : null),
  (c) => (c.rain <= 0.1 && c.temp <= 16 ? `Only ${n(c.temp)} degrees. This is the cold of Assam: a shawl, and a hot cup of tea.` : null),
  (c) => (c.rain <= 0.1 && c.temp > 16 && c.temp < 32 ? `A pleasant ${n(c.temp)} degrees. A good day to walk by the lake.` : null),
  (c) => (c.part === 'morning' && c.fog ? 'There is fog on the lake this morning. You can hear the cycle bells before you see anyone.' : null),
  (c) => (c.meal ? `The mess is serving ${c.meal.name.toLowerCase()} now, until ${fmtHour(c.meal.to)}. Today it is ${c.menu}.` : null),
  (c) => (!c.meal ? `The next meal in the mess is ${c.next.name.toLowerCase()} at ${fmtHour(c.next.from)}.` : null),
  (c) => (c.h >= 17.5 || c.h < 2 ? 'The hostel canteen on the second floor is open from six in the evening until two at night.' : null),
  (c) => (c.day === 'Sunday' ? 'It is Sunday: dinner is the special thali in the messes. Ninety rupees for a guest.' : null),
  (c) => (c.day === 'Monday' ? 'Monday again. Even the dogs look sleepy on a Monday.' : null),
  (c) => (c.day === 'Friday' ? 'It is Friday. The campus is already thinking of the weekend.' : null),
  (c) => (c.day === 'Saturday' ? 'It is Saturday. Many go to the city, and the campus is a little quieter.' : null),
  (c) => (c.weekend ? 'The weekend is slow here. The lake is full of people with books and no plan.' : 'It is a working day. The lecture halls are full and the library fills up by the evening.'),
  (c) => (c.event ? `${c.event.name} is on now at ${c.event.where}. You should go and see it.` : null),
  (c) => (c.nextEv ? `Coming up: ${c.nextEv.d.name} at ${fmtHour(c.nextEv.d.from)}, at ${c.nextEv.d.where}.` : null),
  (c) => (c.event && /Pronite/.test(c.event.name) ? 'The Pronite is on. You can hear the music from the road, and see the lights over the ground.' : null),
  (c) => (c.part === 'evening' ? 'The sports grounds fill up at this hour, and the tea stalls fill after them.' : null),
  (c) => (c.part === 'night' && c.h >= 22 ? 'The library and the hostel canteens are the only places awake now.' : null),
  (c) => `The campus buses start at the IITG Bus Stop, every twenty minutes between seven in the morning and ten at night.${c.busIn != null ? ` The next one leaves in about ${c.busIn} minutes.` : ''}`,
  (c) => (c.h >= 21 && c.h < 22.2 ? 'The KV Gate and the Khokha Gate close at ten. The Main Gate never closes.' : null),
  (c) => (c.h >= 5.5 && c.h < 7 ? 'The KV Gate and the Khokha Gate open at six in the morning.' : null),
  (c) => (c.place ? c.place : null),
  (c) => (c.hostel ? `Which hostel are you in? ${c.hostel}? Every hostel here is named after a river of the North East.` : null),
  (c) => (c.coins != null && c.coins < 300 ? 'Careful with the money, the month is long. The mess is free with the card, and the tea is cheap.' : null),
  (c) => (c.coins != null && c.coins > 15000 ? 'You seem to be doing well. Treat a friend to a tea, it is a good habit.' : null),
  (c) => (c.chats > 12 ? 'You talk to everyone on this campus, do you not? That is a good way to learn it.' : null),
  (c) => (c.aqi != null ? `The air quality board by the lake reads about ${c.aqi} today. ${c.aqi < 60 ? 'Fresh, as it should be here.' : 'A bit hazy, but fine for a walk.'}` : null),
  (c) => 'The boats are on the IITG lake only. Twenty rupees for a rowing boat and sixty for the speedboat, from the jetty.',
  (c) => 'The trail to the View Point is on foot only, about two and a half kilometres, uphill through the forest. Go early and carry water.',
  (c) => 'On the two-lane roads the green strip on each side is for cycles. The cars keep to the middle.',
  (c) => 'The cycles on the stands can be borrowed. Put it back where you found it, please.',
  (c) => 'The OneStop app on your phone has the mess menu, the gate log and your QR. Try it.',
  (c) => 'Keep the campus clean: the green bin is for wet waste and the blue for dry.',
  (c) => 'The dogs and the cats here are friendly. A biscuit is ten rupees from the stall, and they will remember you.',
  (c) => 'The swimming pool is open from six to nine in the morning and from four to eight in the evening.',
  (c) => 'The library is open until two in the night, and the Computer Centre is close to it.',
  (c) => 'The gym is open from six in the morning to ten at night. The treadmills are the first to go.',
  (c) => 'The hospital OPD is open until five in the afternoon. The emergency never closes.',
  (c) => 'If you are lost, look for the green fingerposts at the junctions. They show the names and the distance.',
  (c) => 'The Technology Park is the new cluster of buildings on the old east cricket ground, north of the bus stop.',
  (c) => 'The campus has one cricket ground now. The big stage for the Pronites stands at its edge.',
  (c) => 'The lake circle has a bus stop, a guard post and the air quality board. It is the junction north of the IITG lake.',
  (c) => 'The IITG lake has a fence all round except at the jetty, and trees all round it. The boats go from the jetty only.',
];

/** the facts of the moment that the shared lines use */
function context(g, p) {
  const h = g.clock.hour, W = g.world;
  let place = null, bd = 150;
  for (const l of W.landmarks || []) { const d = Math.hypot(l.wx - p.x, l.wz - p.z); if (d < bd && PLACE[l.id]) { bd = d; place = PLACE[l.id]; } }
  const meal = mealNow(h), wd = g.clock.weekday;
  let busIn = null;
  if (h >= 7 && h < 22) busIn = Math.round((20 - ((h - 7) * 60) % 20) % 20) || 20;
  let temp = 28, aqi = null;
  try { const e = environment(g); temp = e.temp; aqi = e.aqi; } catch { /* the environment meter is optional */ }
  const hostel = g.progress?.profile?.hostel ? (W.landmark(g.progress.profile.hostel)?.name || '').replace(' Hostel', '') : '';
  return {
    g, p, h, time: fmtHour(h), day: DAYS[wd] || '', weekend: wd >= 5,
    part: h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21.5 ? 'evening' : 'night',
    rain: g.weather?.state?.rain ?? 0, fog: (g.weather?.state?.fog ?? 0) > 4, temp, aqi,
    meal, menu: meal ? messMenu(meal.id, wd) : '', next: nextMeal(h),
    event: g.events?.current?.() || null, nextEv: (() => { const e = g.events?.next?.(); return e && e.inHours < 12 ? e : null; })(),
    busIn, place: place ? place[Math.floor(Math.random() * place.length)] : null,
    hostel, coins: g.progress?.coins, chats: g.progress?.stats?.chats || 0,
  };
}

export class Talker {
  constructor(game) { this.g = game; this.bags = new Map(); this.rnd = mulberry32(2025); }
  /** how many things a role can say: its own lines and the shared ones */
  static count(role) { return (LINES[role] || LINES.student).length + SHARED.length; }
  /** the next line for this person; `role` picks the voice */
  say(p, role) {
    const own = LINES[role] || LINES.student;
    let bag = this.bags.get(role);
    const refill = () => {
      bag = [...own.keys(), ...SHARED.map((_, i) => -1 - i)];
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      this.bags.set(role, bag);
    };
    if (!bag || !bag.length) refill();
    const recent = (p.said ||= []);
    const c = context(this.g, p);
    for (let tries = 0; tries < bag.length + own.length + SHARED.length; tries++) {
      if (!bag.length) refill();
      const t = bag.pop();
      if (recent.includes(t) && bag.length) { bag.unshift(t); continue; }       // this person said it a moment ago: put it at the back
      const line = t >= 0 ? own[t] : SHARED[-1 - t](c);
      if (!line) continue;
      recent.push(t); if (recent.length > 12) recent.shift();
      return line;
    }
    return own[Math.floor(this.rnd() * own.length)];
  }
}

export { MEALS };
