// The hostel mess: three meals a day (breakfast, lunch, dinner: there is no evening snack) and a menu for every weekday (Monday = 0), what a guest pays, and
// how a menu turns into what you see on the steel plate (roti, sabji, dal, rice, sweet, curd, salad,
// papad...). One source for the mess boards, the OneStop app, the counters and the plates.

/** meal windows (campus hours) and what a guest from another hostel pays; the mess card of your own hostel is free */
export const MEALS = [
  { id: 'breakfast', name: 'Breakfast', from: 7.5, to: 9.5, price: 50 },
  { id: 'lunch', name: 'Lunch', from: 12.25, to: 14.0, price: 75 },
  { id: 'dinner', name: 'Dinner', from: 19.75, to: 21.75, price: 75 },
];
/** Sunday's dinner is the special thali */
export const SPECIAL_PRICE = 90;
export const isSpecial = (mealId, weekday) => mealId === 'dinner' && weekday === 6;
export const priceOf = (mealId, weekday) => (isSpecial(mealId, weekday) ? SPECIAL_PRICE : MEALS.find((m) => m.id === mealId)?.price ?? 75);
export const mealName = (mealId, weekday) => (isSpecial(mealId, weekday) ? 'Special thali' : MEALS.find((m) => m.id === mealId)?.name ?? 'Meal');
export const mealNow = (h) => MEALS.find((m) => h >= m.from && h < m.to) || null;
export const nextMeal = (h) => MEALS.find((m) => h < m.from) || MEALS[0];

// [breakfast, lunch, dinner] for Monday ... Sunday
export const MENU = [
  [['Aloo Paratha', 'Curd', 'Pickle', 'Tea / Coffee', 'Banana'], ['Rajma', 'Aloo Gobi', 'Plain Rice', 'Roti', 'Salad', 'Curd', 'Papad'], ['Paneer Butter Masala', 'Dal Tadka', 'Jeera Rice', 'Roti', 'Kheer', 'Salad', 'Papad']],
  [['Poha', 'Boiled Egg', 'Bread & Butter', 'Tea'], ['Kadhi Pakora', 'Bhindi Fry', 'Plain Rice', 'Roti', 'Salad', 'Papad'], ['Egg Curry / Dum Aloo', 'Dal', 'Rice', 'Roti', 'Salad', 'Curd']],
  [['Idli', 'Sambar', 'Coconut Chutney', 'Coffee'], ['Chana Masala', 'Jeera Aloo', 'Rice', 'Roti', 'Buttermilk', 'Salad', 'Papad'], ['Chicken Curry / Paneer Bhurji', 'Dal', 'Rice', 'Roti', 'Gulab Jamun', 'Salad']],
  [['Puri', 'Aloo Sabzi', 'Sprouts', 'Milk'], ['Dal Makhani', 'Mix Veg', 'Rice', 'Roti', 'Papad', 'Salad', 'Curd'], ['Chole', 'Jeera Rice', 'Roti', 'Onion Salad', 'Curd', 'Papad']],
  [['Upma', 'Bread & Jam', 'Omelette', 'Tea'], ['Fish Curry / Paneer Masala', 'Aloo Bhaji', 'Rice', 'Roti', 'Salad', 'Papad'], ['Veg Kofta', 'Dal Fry', 'Rice', 'Roti', 'Custard', 'Salad']],
  [['Masala Dosa', 'Sambar', 'Chutney', 'Coffee'], ['Veg Biryani', 'Raita', 'Salan', 'Papad', 'Salad'], ['Chole Bhature', 'Chatpate Aloo', 'Dal Tadka', 'Plain Rice', 'Roti', 'Fryums', 'Masala Lemonade']],
  [['Chole Kulche', 'Lassi', 'Tea'], ['Khichdi', 'Aloo Fry', 'Papad', 'Curd', 'Pickle'], ['Special Thali', 'Paneer Butter Masala', 'Chicken Curry / Paneer', 'Dal Tadka', 'Jeera Rice', 'Roti', 'Gulab Jamun', 'Ice Cream', 'Curd', 'Salad', 'Papad']],
];
export const mealIndex = (mealId) => MEALS.findIndex((m) => m.id === mealId);
export const menuItems = (mealId, weekday) => MENU[((weekday % 7) + 7) % 7][Math.max(0, mealIndex(mealId))];
/** the menu as one line, for boards */
export const messMenu = (mealId, weekday) => menuItems(mealId, weekday).join(', ');

// ---------------------------------------------------------------- what is on the plate
const RULES = [
  ['sweet', /kheer|gulab|jamun|custard|ice cream|jalebi|halwa|sweet|banana/i],
  ['curd', /curd|raita|lassi|buttermilk|milk/i],
  ['salad', /salad|sprouts/i],
  ['papad', /papad|fryums/i],
  ['pickle', /pickle|chutney/i],
  ['rice', /rice|pulao|biryani|khichdi|poha|upma|maggi/i],
  ['roti', /roti|paratha|puri|bhature|kulche|dosa|bread|idli|pav|kulcha/i],
  ['dal', /dal|sambar|kadhi|salan/i],
  ['drink', /tea|coffee|lemonade/i],
  ['snack', /samosa|pakora|tikki|vada|omelette|egg\b|boiled/i],
];
export function kindOf(item) {
  if (/^special thali$/i.test(item.trim())) return 'title';
  for (const [k, re] of RULES) if (re.test(item)) return k;
  return 'sabji';
}
const BREADS = /bhature|kulche|kulcha|pav|puri/i, CURRY = /chole|chana|rajma|aloo|bhaji|sabzi|dal|sambar/i;
/** gravy colours for the sabji katori */
const GRAVY = [[/paneer|butter|makhani/i, '#c9531d'], [/chicken|fish/i, '#a5401a'], [/rajma/i, '#7c2a1c'], [/chana|chole/i, '#a85f1c'], [/egg/i, '#c46a24'], [/aloo|jeera|bhaji|fry|chatpate/i, '#c99a3f'], [/gobi|bhindi|mix veg|kofta|sabzi|bhurji/i, '#6f8a35']];
export const gravyColor = (item) => (GRAVY.find(([re]) => re.test(item)) || [0, '#b5651d'])[1];

/** the items to draw on the plate for a menu: [{kind, name}] in serving order (rice, roti, dal, sabji, then the small things) */
export function platePlan(items, mealId = 'lunch') {
  const out = [];
  const add = (kind, name) => out.push({ kind, name });
  // "Chole Kulche", "Pav Bhaji": a bread and a curry on one line
  items = items.flatMap((i) => (BREADS.test(i) && CURRY.test(i) ? [i.replace(BREADS, '').trim() + ' curry', i.match(BREADS)[0]] : [i]));
  const byKind = (k) => items.filter((i) => kindOf(i) === k);
  const meal = mealId === 'lunch' || mealId === 'dinner';
  for (const r of byKind('rice')) { add('rice', r); break; }
  for (const r of byKind('roti')) { add('roti', r); break; }
  for (const d of byKind('dal')) add('dal', d);
  for (const s of byKind('sabji')) add('sabji', s);
  if (mealId === 'breakfast') for (const s of byKind('snack')) add('snack', s);
  for (const k of ['curd', 'salad', 'papad', 'pickle']) for (const i of byKind(k)) { if (mealId === 'breakfast' && k === 'curd' && /milk|lassi/i.test(i)) continue; add(k, i); break; }
  for (const s of byKind('sweet')) { if (meal || /banana/i.test(s) === false) add('sweet', s); break; }
  return out.slice(0, 11);
}
