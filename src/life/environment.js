// Environment meter: temperature, humidity, PM2.5 / AQI and CO2 for where you are.
// Based on Guwahati climate normals (min / max temperature and humidity by month) and
// typical seasonal PM2.5, adjusted for time of day, weather, surroundings and indoors.
const TMIN = [10.5, 12.5, 16.6, 20.3, 22.8, 24.9, 25.6, 25.6, 24.8, 22.0, 16.8, 12.1];
const TMAX = [23.6, 26.7, 30.0, 31.0, 31.4, 31.9, 32.1, 32.3, 31.7, 30.5, 28.0, 25.0];
const RH = [78, 70, 60, 70, 78, 83, 84, 84, 84, 82, 80, 80];
const PM = [95, 80, 55, 40, 30, 22, 20, 20, 24, 38, 65, 90];   // µg/m³, city background

/** Indian National AQI sub-index for PM2.5 */
export function aqiPM25(pm) {
  const B = [[0, 30, 0, 50], [31, 60, 51, 100], [61, 90, 101, 200], [91, 120, 201, 300], [121, 250, 301, 400], [251, 500, 401, 500]];
  for (const [c0, c1, i0, i1] of B) if (pm <= c1) return Math.round(i0 + ((pm - c0) * (i1 - i0)) / (c1 - c0));
  return 500;
}

export function environment(game) {
  const { clock, weather, world } = game;
  const m = clock.month, h = clock.hour;
  const w = weather.state;
  // diurnal temperature: minimum near 5:30, maximum near 14:30
  const lo = TMIN[m], hi = TMAX[m];
  let k;
  if (h >= 5.5 && h <= 14.5) k = 0.5 - 0.5 * Math.cos((Math.PI * (h - 5.5)) / 9);
  else { const hh = h > 14.5 ? h - 14.5 : h + 9.5; k = Math.exp(-hh / 5.5) * 1.0; }
  let temp = lo + (hi - lo) * k;
  temp -= w.rain * 3.2 + w.dark * 1.5 + (w.fog > 4 ? 1.2 : 0);
  let rh = RH[m] + (1 - k) * 8 - k * 8 + w.rain * 14 + (w.fog > 4 ? 10 : 0);
  rh = Math.max(35, Math.min(99, rh));
  // PM2.5: rain washes it out, mornings/evenings trap it, trees and lakes help, gates/market add traffic
  let pm = PM[m] * 0.7;
  pm *= 1 - Math.min(0.55, w.rain * 0.6);
  pm *= h < 9 || h > 18 ? 1.18 : 0.9;
  const p = game.focus || game.player.pos;
  let local = 1;
  if (!game.interior?.active && world) {
    const near = (list, r) => list.some((q) => Math.hypot(q.wx - p.x, q.wz - p.z) < r);
    if (near(world.gates.filter((g) => !g.closed), 120)) local += 0.18;
    if (world.site('shopping') && Math.hypot(world.site('shopping').ex - p.x, world.site('shopping').ez - p.z) < 120) local += 0.12;
    local -= (game.nearWater || 0) * 0.15 + (game.treeDensity || 0) * 0.12;
  }
  pm *= local;
  let co2 = 418 + (local - 1) * 150 + (h < 7 ? 12 : 0);
  if (game.interior?.active) {
    const n = game.interior.count();
    const vol = game.interior.plan.W * game.interior.plan.D * game.interior.plan.H;
    co2 = 450 + (n * 42000) / vol;
    pm *= 0.7;
    temp = Math.min(temp, 28) + (n / vol) * 40;
    rh = Math.max(45, rh - 10);
  }
  const feels = temp + (rh > 55 && temp > 24 ? (temp - 24) * (rh - 55) / 60 : 0);
  return {
    temp: Math.round(temp), feels: Math.round(feels), rh: Math.round(rh),
    pm: Math.round(pm), aqi: aqiPM25(pm), co2: Math.round(co2 / 5) * 5,
  };
}
