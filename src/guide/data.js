// The catalogue behind the Game Guide (F1) and the Info panel (I): for every place, thing and system,
// what is there, what you can do, and what does not work. It is plain data (no game code), so
// tools/gen-features.mjs turns the very same entries into FEATURES.md for the repository.
//
// A feature is [status, text, keys?, note?]:
//   'works'   it is in the game and does what it says
//   'partial' it is there but limited (the note says how)
//   'no'      it is not in the game (so nobody looks for it)
// keys are key caps joined with '|' ("E", "Shift|N").
import { MEALS, mealNow, nextMeal, priceOf, mealName } from '../mess/menu.js';

export const STATUS = { works: { label: 'Works' }, partial: { label: 'Limited' }, no: { label: 'Not in the game' } };

export const CATEGORIES = [
  { id: 'start', name: 'Start here', blurb: 'How to play, the guide itself and the limits of the game' },
  { id: 'move', name: 'Getting around', blurb: 'On foot, cycles, buses, boats, drones, gates' },
  { id: 'stay', name: 'Hostels & food', blurb: 'Where you live, eat and hang out' },
  { id: 'learn', name: 'Learning & work', blurb: 'Lectures, labs, library, halls, offices' },
  { id: 'play', name: 'Sports & fitness', blurb: 'The pool, grounds, courts, gym and SAC' },
  { id: 'services', name: 'Services & security', blurb: 'Hospital, guest house, staff homes, guards' },
  { id: 'nature', name: 'Lakes & landmarks', blurb: 'Water, views, circles and photo spots' },
  { id: 'apps', name: 'Phone, PCs & money', blurb: 'OneStop, IITG OS, rupees, the planner' },
  { id: 'life', name: 'Campus life', blurb: 'People, animals, events, jobs and time' },
];

const W = 'works', P = 'partial', N = 'no';

export const TOPICS = [
  // ================================================================ start
  { id: 'overview', cat: 'start', name: 'Overview', auto: true, blurb: 'IITG 3D is an explorable, living IIT Guwahati campus. This guide lists every place and thing in it, what you can do there, and what is not in the game.' },
  { id: 'limits', cat: 'start', name: 'What does not work', auto: true, blurb: 'Every feature that works only in part, or is not in the game, gathered in one list, so you never look for something that is not there.' },
  { id: 'basics', cat: 'start', name: 'How to play', kicker: 'Controls and ideas', blurb: 'Walk out of your hostel and explore. Everything you can use shows a key next to it: press <b>E</b> to use it, <b>I</b> to learn about it, <b>O</b> for your phone.',
    feats: [
      [W, 'Move and look around', 'W|A|S|D', 'Click the view to lock the mouse; Esc frees it. A gamepad and an on-screen joystick work too.'],
      [W, 'Use what is in front of you: enter buildings, order food, sit, work, play, borrow a cycle', 'E'],
      [W, 'Learn about the place or thing you are near or looking at, and what works there', 'I'],
      [W, 'Your phone: OneStop (gates, mess coupons, timetable, Campus Live)', 'O'],
      [W, 'The campus map, with fast travel', 'M'],
      [W, 'The planner: timetable, events, jobs, money and weather', 'Tab'],
      [W, 'The journal: progress, achievements and your photos', 'J'],
      [W, 'This guide', 'F1'],
      [W, 'Your character: the creator changes your face, hair, beard, glasses, clothes, shoes and cycle; the character has eyes with lids and lashes, brows, a nose, lips, ears, hands with fingers and nails, a belt and trainers with laces', 'P'],
      [W, 'Sprint, jump, fly', 'Shift|Space|F'],
      [W, 'Your progress, look and settings are saved by themselves', null, 'In this browser. The menu can export a backup file to move them elsewhere.'],
      [N, 'Playing with other people online', null, 'Everyone else on campus is simulated.'],
      [N, 'Saving to the cloud', null, 'Use the menu’s backup if you want to carry your progress to another browser.'],
    ],
    tips: ['Press <kbd class="key">T</kbd> for a campus tour if you want the stories first.', 'The key hints in the corner change with what you are doing; <kbd class="key">H</kbd> hides them.'],
    see: ['info-key', 'tours', 'wallet'] },
  { id: 'info-key', cat: 'start', name: 'Info (I)', kicker: 'Learn about anything', blurb: 'Press <b>I</b> and a panel tells you about the building or thing you are inside, near, or looking at: what it is, what is there, what you can do, and what does not work. Keep it open and it follows you as you walk.',
    feats: [
      [W, 'Shows the entry for the building you are inside, or the one you are looking at', 'I'],
      [W, 'Shows what E would do right now, and the opening hours where the game has them'],
      [W, 'Opens the matching page of this guide', 'F1'],
      [W, 'Follows you: walk on and it changes to what you are near'],
      [P, 'Small scenery such as single trees and lamp posts', null, 'They have no entry; you get the nearest place instead.'],
    ], see: ['basics', 'overview'] },
  { id: 'campus', cat: 'start', name: 'The campus', kicker: 'IIT Guwahati · North Guwahati, Assam', blurb: 'About 270 hectares of hills, lakes and buildings on the north bank of the Brahmaputra, rebuilt from open map, elevation and satellite data. The shapes, names, roads and lakes are real; the insides, people and routines are made up to give the campus a life.',
    feats: [
      [W, 'Walk, cycle, ride, row or fly anywhere inside the wall', 'W|A|S|D'],
      [W, 'Every building can be entered', 'E', 'Hostels, halls, offices and homes have interiors made for their type.'],
      [W, 'A full day: lectures, meals, sport, clubs, events, night life and weather'],
      [P, 'Real buildings and real heights', null, 'Footprints are from maps; heights are estimated; interiors are typical layouts, not the real floor plans.'],
      [P, 'The real timetable, menu and people', null, 'They are made up to feel right.'],
      [N, 'The world beyond the gates as a playable area', null, 'The market, villages and river outside are there to look at and walk to.'],
    ], see: ['basics', 'gates'] },

  // ================================================================ getting around
  { id: 'walking', cat: 'move', name: 'On foot', kicker: 'The default way', blurb: 'Walk, run, jump and even fly. Step up kerbs and steps; swim in the lakes and the pool.',
    feats: [
      [W, 'Walk and sprint', 'W|A|S|D|Shift'],
      [W, 'Jump, and step up onto kerbs, steps, flower beds and plinths', 'Space', 'Up to 75 cm; higher things are walls.'],
      [W, 'Fly: lift off, go up and down, boost', 'F|Space|C|Shift', 'Press F again to land.'],
      [W, 'Swim in the lakes and the pool', 'W|A|S|D', 'Hold Shift to swim fast.'],
      [W, 'Wave, dance, cheer, clap', '1|2|3|4'],
      [W, 'Sit on benches, chairs, steps of the stands and the grass circles', 'E'],
      [W, 'Knock over dustbins, cones, flower pots and boards by running into them; kick footballs'],
      [N, 'Walking through walls, fences or across lakes'],
      [N, 'Leaving the campus except through an open gate', null, 'Scan OneStop at the gate first.'],
    ], see: ['bicycle', 'gates', 'knockables'] },
  { id: 'bicycle', cat: 'move', name: 'Bicycle', kicker: 'Your own, or borrow one', blurb: 'Press B for your own cycle. Every cycle stand has cycles you can borrow. Ask a passing cyclist for a lift on the carrier.',
    feats: [
      [W, 'Get on or off your own bicycle', 'B'],
      [W, 'Borrow any parked bicycle from a stand', 'E'],
      [W, 'Ring the bell', 'R'],
      [W, 'Ride in the green cycle lanes of the two-lane roads'],
      [W, 'Ask a cyclist for a lift (you ride on the carrier)', 'E'],
      [W, 'Guided cycle ride round the campus, and races against the clock', 'Y|L'],
      [W, 'Your bicycle’s look is yours to change', 'P'],
      [P, 'Cycles on sports grounds, courts and the View Point', null, 'They are not allowed: the fences and gates stop them.'],
      [P, 'Taking a cycle inside a building', null, 'Get off first; the door asks you to.'],
    ], see: ['cycle-shop', 'tours'] },
  { id: 'campus-bus', cat: 'move', name: 'Campus bus', kicker: 'IITG DUTY', blurb: 'The white IITG buses with the yellow-green stripe and the name of the institute on the side. Ride the campus bus tour from the front seat, or look at the shuttles stopping at the bus stands.',
    feats: [
      [W, 'Ride the campus bus tour: it starts at the IITG Bus Stop, stops at each bus shelter and tells you the story', 'T'],
      [W, 'Change the camera (driver, window, outside), skip to the next stop, speed up', 'V|X|]'],
      [W, 'Get off at any moment', 'E'],
      [W, 'Shuttle buses run between the bus stands, stopping for people and gates'],
      [P, 'Boarding a shuttle', null, 'Only the tour bus can be ridden.'],
    ], see: ['tours', 'bus-stop'], where: { busstop: 1 } },
  { id: 'vehicles', cat: 'move', name: 'Rides & vehicles', kicker: 'E-rickshaws, autos, taxis, scooters', blurb: 'Hop into an e-rickshaw or an auto, take a taxi home, ride the free campus buggy, or rent a scooty, scooter or motorbike at a cycle shop.',
    feats: [
      [W, 'Campus buggy (free), e-rickshaw and auto (a fare), taxi (a fare, and home for the night)', 'E'],
      [W, 'Rent a scooty (₹60), scooter (₹80) or motorbike (₹150) at a cycle shop and ride it round campus', 'E'],
      [W, 'Drive for the pizza and ambulance jobs', null, 'See Jobs.'],
      [W, 'Get out at any moment: E, or the Get off button on the screen', 'E', 'A car or scooter that is moving brakes to a stop and you get out by yourself, even if you hold the throttle. An e-rickshaw, buggy, auto or taxi lets you off on the kerb side, clear of walls and other vehicles, and does not pick you up again for a few seconds, so a second press of E cannot hop you straight back in.'],
      [W, 'Vehicles keep left, stop for people and gates, and go round the roundabouts'],
      [N, 'Driving on the sports grounds or into a lake', null, 'They are kept off.'],
      [N, 'Buying a car or a motorbike'],
    ], see: ['cycle-shop', 'jobs'] },
  { id: 'boats', cat: 'move', name: 'Boats', kicker: 'Rowing boats and speedboats', blurb: 'The jetty on the IITG Lake (the academic lake) has rowing boats and a speedboat moored beside it. Row out, cross the lake, and step out on the jetty or on any shore (or swim ashore from the middle). The other lakes have no boats.',
    feats: [
      [W, 'Take a rowing boat or a speedboat from the IITG Lake jetty', 'E'],
      [W, 'Row or throttle, steer, go anywhere on the lake', 'W|A|S|D'],
      [W, 'Get out at the jetty or on any shore; in the middle of the lake press E (or the Get out button) and you dive in and swim ashore', 'E', 'There is always a way out.'],
      [N, 'Fishing, or boats on the Brahmaputra'],
    ], see: ['lakes'], where: { jetty: 1 } },
  { id: 'drone', cat: 'move', name: 'Drone', kicker: 'Photos and video from the air', blurb: 'Launch a drone with G and fly it over the campus: first-person or chase view, with a live heads-up display.',
    feats: [
      [W, 'Fly, climb and descend, turn and tilt the camera', 'W|A|S|D|Space|C'],
      [W, 'First-person or chase view', 'V'],
      [W, 'Take a photo, or record a video', 'Enter|R'],
      [W, 'Bring it home, or land and stop', 'X|G'],
      [W, 'Battery, altitude, speed, distance and GPS on the screen'],
      [P, 'Flying inside buildings', null, 'The drone stays outdoors.'],
    ], see: ['camera', 'tours'] },
  { id: 'tours', cat: 'move', name: 'Campus tours', kicker: 'Bus · walk · cycle · drone', blurb: 'The same stops and stories four ways: the campus bus, on foot, by cycle, or by drone. A voice tells you about each place, with subtitles.',
    feats: [
      [W, 'Choose a tour: bus, on foot, by cycle or by drone', 'T'],
      [W, 'Faster or slower, pause, skip to the next stop, change the view', '[|]|Space|X|V'],
      [W, 'A guided bicycle ride, where you pedal and follow the route', 'Y'],
      [W, 'Stop any time', 'E'],
      [P, 'Every building on the route', null, 'Buses stay on the through-roads; walking and cycling tours go closer.'],
    ], see: ['campus-bus', 'drone'] },
  { id: 'gates', cat: 'move', name: 'Gates', kicker: 'Main Gate · KV Gate · Khokha Gate', blurb: 'The Main Gate (Agiathuri) is open day and night, with its sandstone name stones in English, Assamese and Hindi, banded bollards and potted palms. The KV Gate (the Lothia Baghicha Gate on the campus map) stands where the road from the circle past the Kendriya Vidyalaya meets the PWD Road, by the sub post office; it has a brown IITG signboard, a steel gate on a tall pillar, the IIT sub post office built on to its wall and a cement guard post that was 3D printed. The Khokha Gate has two big steel gates between brick pillars, a boundary wall all round and a gravel path lined with parked cycles. KV and Khokha are open 6 AM to 10 PM. At each gate there is a desk with a OneStop QR machine, set on the verge beside the road (the road itself stays clear), where you scan in or out: it is the only way the gates keep a record, nobody writes you in or out. The Main Gate has a domed guard room and a small brick guard post with a guard on a chair.',
    hours: 'Main Gate 24 × 7 · others 6 AM – 10 PM',
    feats: [
      [W, 'Scan your QR at the gate desk, beside the road, to make your entry or exit (it only records the entry: the gate itself is just a gate)', 'E|O', 'The only record: no guard writes you in or out.'],
      [W, 'Say where you are going (Khokha, City or Others); the GateLog keeps your out and in times'],
      [W, 'At the KV Gate: the 3D-printed cement guard post with two guards and their registers, the sub post office, and the campus map board beside the post'],
      [W, 'At the Main Gate: a small brick guard post with a guard on a chair, and the domed guard room'],
      [W, 'Guards at every gate, with cabins and a clear paved apron'],
      [W, 'The Khokha Gate’s steel gates swing open at 6 AM and shut at 10 PM'],
      [P, 'Khokha Gate', null, 'On foot or by cycle only.'],
      [N, 'The other two gates on the map (A.S.E.B and a south gate)', null, 'They are shown on the campus map and stay closed.'],
    ], see: ['onestop', 'security'], where: { gate: 'Main Gate' } },
  { id: 'bus-stop', cat: 'move', name: 'Bus stops', kicker: 'The IITG Bus Stop and the bus shelters', blurb: 'The IITG Bus Stop, between the Technology Incubation Centre and the Technology Park, is where every campus bus starts: a gantry over the stand road, a covered platform with bays 1 to 4, a timetable and an enquiry counter. Shelters with benches stand beside the roads (never on the carriageway or a junction) as the other stops; a guard and a bus stop stand at the circle by the IITG Lake as well.',
    feats: [[W, 'See the buses standing in their bays at the IITG Bus Stop; the bus tour starts there', 'T'], [W, 'People wait on the benches; sitters sit properly'], [W, 'Marked on the maps with a bus sign'], [P, 'Riding the shuttles', null, 'Only the bus tour is rideable.']], see: ['campus-bus', 'techpark'], where: { lm: 'busstop' } },
  { id: 'cycle-shop', cat: 'move', name: 'Cycle shop', kicker: 'Buy · repair · rent', blurb: 'Four tin-shed cycle shops: new cycles out front, tyres on the wall, and an uncle mending an upturned cycle.',
    feats: [
      [W, 'Buy a new cycle (₹5,500)', 'E'],
      [W, 'Get your cycle checked and its tyres pumped, free', 'E'],
      [W, 'Rent a scooty, scooter or motorbike; it goes back to the shop when you get off', 'E'],
      [N, 'Repairs that cost money, or spare parts'],
    ], see: ['bicycle', 'vehicles'] },
  { id: 'roads-signs', cat: 'move', name: 'Finding your way', kicker: 'Signs, maps and routes', blurb: 'Fingerposts at the junctions give names and distances, “You are here” map boards show the whole campus in the style of the printed campus map, and Q draws the way to your objective.',
    feats: [
      [W, 'Fingerposts with destination names and distances at junctions'],
      [W, 'Campus map boards at the gates and big junctions, with a red “You are here” marker and an index, lit by three lamps and glowing after dark', null, 'Drawn from the game’s own map data.'],
      [W, 'Road signs (speed limit 30, no horn, school ahead) and zebra crossings'],
      [W, 'The main through-roads where there is room are two-lane roads with a flowered median with small trees, and a green cycle lane on each side; the loop round the Serpentine Lake and the roads to the View Point stay single'],
      [W, 'Show or hide the route to your objective', 'Q', 'The first walkthrough shows it by itself; one press of Q hides it, another shows it again.'],
      [W, 'The minimap and the full map, where you can click to travel', 'M'],
    ], see: ['basics'] },

  // ================================================================ hostels & food
  { id: 'hostel', cat: 'stay', name: 'Hostel', kicker: 'Residence hall · fifteen hostels', blurb: 'Your home on campus: a guarded door with a OneStop machine, a lobby, the mess, a common room, your room, and a canteen upstairs at night. Fifteen hostels, named after rivers; Subansiri, Dhansiri and Disang are girls’ hostels.',
    where: { myHostel: 1 },
    feats: [
      [W, 'Scan in and out at the door with OneStop', 'E', 'The sliding door opens; a visitor signs the register instead.'],
      [W, 'The mess: pay or show your mess card, take a plate, be served, eat, go for seconds, return the plate', 'E', 'See “Hostel mess”.'],
      [W, 'The common room: watch the cricket highlights on the TV, play table tennis', 'E'],
      [W, 'Your room: sleep or nap (skips time, restores energy), study at your desk', 'E', 'Your own hostel, or a friend’s room in a hostel of your own kind.'],
      [W, 'The canteen on the 2nd floor, 6 PM to 2 AM', 'E'],
      [W, 'The facilities wing (the door on the east wall of the lobby): a library, a gym, a music room and a TV room', 'E', 'See “Hostel facilities wing”.'],
      [W, 'The wash area in the mess: three basins with mirrors, a tap over each that you turn on and off with E (the water runs, splashes and sounds)', 'E'],
      [W, 'Notice board and security desk in the lobby'],
      [W, 'Outside: covered cycle stand with a solar roof, guard cabin, murals, sit-outs, a roof with solar panels and heaters'],
      [P, 'Visiting another hostel', null, 'A boys’ hostel: scan your OneStop QR at the door. A girls’ hostel: write your name in the register at the security desk (for the mess or the canteen); QR is only for its own residents. Common areas and the canteen only, never the rooms, at any time except 2 to 6 AM.'],
      [W, 'Each hostel has its own volleyball court, basketball court and cricket practice pitch beside it'],
      [N, 'Going into other students’ rooms, or seeing every floor'],
    ], has: ['Lobby', 'Mess hall', 'Common room', 'Your room', 'Canteen (2nd floor)', 'Security desk', 'Brahmaputra', 'Lohit', 'Dihing', 'Manas', 'Umiam', 'Barak', 'Kameng', 'Gaurang', 'Siang', 'Kapili', 'Dibang', 'Disang (girls)', 'Subansiri (girls)', 'Dhansiri (girls)', 'Married Scholars'],
    tips: ['Your hostel is chosen in OneStop; the game starts outside its door.', 'Boys’ hostels: visitors scan the QR machine at the door. Girls’ hostels: everyone who does not live there signs the register at the desk.'], see: ['mess', 'hostel-canteen', 'onestop'] },
  { id: 'hostel-wing', cat: 'stay', name: 'Hostel facilities wing', kicker: 'Library · gym · music room · TV room', blurb: 'Every hostel has a floor of its own for them, reached by the door on the east wall of the lobby: a library with shelves, reading tables, a librarian’s desk and catalogue computers; a gym with treadmills, bikes, benches, racks, dumbbells and machines; a music room with a drum kit, guitars, amps, a piano and an Indian corner; and a TV room with sofas, bean bags, a big TV and a vending machine.',
    hours: 'Library 8 AM–2 AM · Gym 6–9 AM and 4–10 PM · Music and TV rooms: evenings',
    feats: [
      [W, 'Study at a reading table, issue or return a book at the desk', 'E'],
      [W, 'Work out: reps challenge, exercise bike, treadmill', 'E'],
      [W, 'Jam with the music club on the drums and guitars', 'E'],
      [W, 'Watch the cricket highlights on the big TV, play carrom, buy chips from the vending machine', 'E'],
      [W, 'Students use every room: studying, lifting, playing, watching and cheering'],
    ], see: ['hostel'] },
  { id: 'mess', cat: 'stay', name: 'Hostel mess', kicker: 'Breakfast · lunch · dinner', blurb: 'Students queue in the mess at meal times: they pay at the counter, take a steel plate, line up at the serving counter, carry the plate to a long table, eat, some go back for more, and return the plate. You do the same.',
    hours: 'Breakfast 7:30–9:30 · Lunch 12:15–2 · Dinner 7:45–9:45',
    feats: [
      [W, 'Show your mess card at the mess counter (your own hostel: free), or pay as a guest', 'E', 'Guest coupons: ₹50 breakfast, ₹75 lunch, ₹75 dinner, ₹90 the Sunday special thali.'],
      [W, 'Pay in cash or by UPI, at the counter or in the OneStop app (Food → Buy a guest coupon)', 'O'],
      [W, 'Take a steel plate from the stack', 'E'],
      [W, 'Hand in your coupon at the serving counter: the servers fill the plate item by item', 'E', 'Roti, sabji, dal, rice, curd, salad, papad, and a sweet where the menu has one.'],
      [W, 'Carry the plate to any free seat, sit and eat (Space eats faster); energy and XP go up', 'E'],
      [W, 'Ask for seconds: rice, dal and sabji, free', 'E'],
      [W, 'Return your plate at the rack by the west wall', 'E'],
      [W, 'A moving queue of students: the crowd follows the meal times and the day'],
      [W, 'The day’s menu is on the board and in OneStop (Food), different for each weekday'],
      [P, 'Choosing what goes on the plate', null, 'The menu of the day decides it.'],
      [N, 'Skipping the queue, mess committees, rebates for leave'],
    ], tips: ['Sunday dinner is the special thali (₹90 for a guest).', 'Go at the start of a meal for a short queue.'], see: ['hostel', 'onestop', 'wallet'] },
  { id: 'hostel-canteen', cat: 'stay', name: 'Hostel canteen', kicker: '2nd floor · 6 PM – 2 AM', blurb: 'The night canteen on the second floor of each hostel: noodles, rolls, chai and cold coffee, plastic chairs, cricket on the TV, and students up late.',
    hours: '6 PM – 2 AM',
    feats: [
      [W, 'Go up the stairs from the lobby', 'E'],
      [W, 'Order at the counter: noodles, rolls, fried rice, omelette, chai, cold coffee', 'E', 'Cold coffee gives extra time in your next study session or exam.'],
      [W, 'Sit at a table with the students', 'E'],
      [P, 'Visitors from the other hostels', null, 'They must have signed the register at the door.'],
    ], see: ['hostel'] },
  { id: 'foodcourt', cat: 'stay', name: 'Food Court', kicker: 'Near the sports complex', blurb: 'Five counters (Pizza Corner, Sandwich Bar, Ice Cream Parlour, Momo House, Café), tables and chairs, and a late-night rush.',
    hours: 'About 10 AM – 11 PM',
    feats: [[W, 'Order at any counter', 'E'], [W, 'Sit and eat at the tables', 'E'], [W, 'A crowd at lunch and in the evening']], where: { lm: 'foodcourt' } },
  { id: 'chai-stall', cat: 'stay', name: 'Lake View Tea Stall', kicker: 'Chai · samosa · bun omelette', blurb: 'The tea kiosk by the academic lake, with a tin roof, kulhad chai, tables and friends chatting.',
    feats: [[W, 'Buy kulhad chai, lemon tea, samosa, bun omelette', 'E'], [W, 'Sit on the chairs at the stall', 'E']], where: { stall: 'Lake View Tea Stall' } },
  { id: 'street-food', cat: 'stay', name: 'Food carts and stalls', kicker: 'Momos · noodles · juice · rolls · pani puri', blurb: 'Small stalls along the lakeside and the market: Momo Point, Noodles & Chai, Fresh Juice, Roll Corner, carts of pani puri and fruit.',
    feats: [[W, 'Buy food and drinks; each restores some energy', 'E'], [W, 'Pay with cash or card', 'E'], [P, 'Menus', null, 'Fixed for each stall.']], see: ['wallet'] },
  { id: 'lake-stalls', cat: 'stay', name: 'Lakeside food stalls', kicker: 'Evening by the IITG Lake', blurb: 'Stalls by the lake where students meet in the evening.', feats: [[W, 'Buy food and drinks', 'E'], [W, 'Sit on the lakeside benches', 'E']], where: { lm: 'foodstalls' } },
  { id: 'cafe', cat: 'stay', name: 'Cafe Coffee Day', kicker: 'Coffee · brownies', blurb: 'A small coffee pavilion of its own on the lawn beside the library complex, with outdoor tables and umbrellas.',
    feats: [[W, 'Buy a cappuccino, cold coffee or a brownie', 'E', 'Coffee gives extra time in your next study session or exam.'], [W, 'Sit at the outdoor tables', 'E']], where: { stall: 'cafe' } },
  { id: 'chain-outlets', cat: 'stay', name: 'Domino’s Pizza and KFC', kicker: 'Side by side by the Food Court', blurb: 'Two outlets next to each other on the lawn in front of the Food Court, each with a counter, a menu and a table.',
    feats: [[W, 'Order pizza, garlic bread and desserts, or a chicken burger, wings and fries', 'E'], [W, 'Sit at the table and eat', 'E']], where: { lm: 'foodcourt' } },
  { id: 'pizza-corner', cat: 'stay', name: 'Pizza Corner', kicker: 'At the Market Complex', blurb: 'Pizzas and garlic bread, and the place to start a pizza delivery shift.',
    feats: [[W, 'Order pizza', 'E'], [W, 'Work a delivery shift: earn money', 'E']], see: ['jobs'], where: { stall: 'pizzeria' } },
  { id: 'market', cat: 'stay', name: 'Market Complex', kicker: 'Shops · ATM · bank', blurb: 'The daily-needs market near the Main Gate: a general store, stationery and xerox, a pharmacy, a bakery, mobile recharge, fruit and vegetables, an ATM, the bank branch, and carts outside.',
    hours: 'Shops about 8 AM – 10 PM',
    feats: [
      [W, 'Buy from the shops: water, biscuits, umbrella (opens by itself in rain), notebook, medicine, cake, recharge', 'E'],
      [W, 'Use the ATM: collect pocket money, withdraw cash on the card, pay the card bill, pay back a friend', 'E'],
      [W, 'The post office and the railway reservation counter are buildings you can enter', 'E'],
      [P, 'Banking', null, 'The ATM works; the bank branch is a building with an office inside.'],
    ], see: ['wallet', 'atm'], where: { lm: 'shopping' } },
  { id: 'atm', cat: 'stay', name: 'ATM', kicker: 'Cash, card, loans', blurb: 'A cash machine in a small cabin.', feats: [[W, 'Collect the weekly pocket money from home (₹3,000)', 'E'], [W, 'Withdraw ₹500, ₹2,000 or ₹5,000 on the credit card', 'E'], [W, 'Pay the credit card bill, pay back a friend', 'E'], [W, 'Switch between cash and card for payments', 'E']], see: ['wallet'], where: { stall: 'atm' } },

  // ================================================================ learning & work
  { id: 'lhc', cat: 'learn', name: 'Lecture Hall Complex', kicker: 'Lectures · exams', blurb: 'The big lecture theatres where first-year and institute-wide courses are taught: raked seating, a platform, a board and a projector screen, and two exits.',
    hours: 'Lectures Mon–Fri, 9 AM – 1 PM and 2 – 5 PM', where: { lm: 'lhc' },
    feats: [
      [W, 'Take a seat and attend the lecture: slides appear, then a three-question quiz', 'E', 'Your marks feed your CPI; XP goes up.'],
      [W, 'Write the end-semester exam: eight questions against the clock', 'E'],
      [W, 'The timetable is in OneStop, and the room follows it'],
      [P, 'Lecture topics', null, 'A set of courses repeats; they are not the real syllabi.'],
      [N, 'Choosing courses, attendance or grade sheets'],
    ], see: ['onestop', 'academic'] },
  { id: 'academic', cat: 'learn', name: 'Academic complex', kicker: 'Departments · labs', blurb: 'The interconnected blocks (the Cores) holding most departments, labs and faculty cabins. As in the photographs, the ground floor stands on a podium: a broad flight of grey stone steps climbs to a concrete portico and a glass entrance bay under the institute’s name, between stepped planters, with a curved red-brick bed of red flowers in front.',
    where: { lm: 'academic' },
    feats: [
      [W, 'Chemistry lab: do the titration experiment', 'E'],
      [W, 'Physics: the pendulum experiment', 'E'],
      [W, 'Computer lab: coding practice at a PC', 'E'],
      [W, 'Read the department notice board; watch students in labs and professors in their cabins'],
      [P, 'The real departments and their rooms', null, 'One typical layout is used for every block.'],
    ], see: ['lhc', 'library'] },
  { id: 'library', cat: 'learn', name: 'Central Library', kicker: 'Lakshminath Bezbaroa Central Library', blurb: 'Marble floors, tall shelves, reading tables with lamps, an issue and return counter, and students studying; busiest late at night before exams.',
    hours: 'Open long hours; busiest 8 PM – 1 AM', where: { lm: 'library' },
    feats: [
      [W, 'Study at a reading table: a short revision quiz (marks and XP)', 'E'],
      [W, 'Borrow up to three books for 14 days and return them at the counter; ₹2 a day fine per late book', 'E'],
      [W, 'Sit at any table or chair', 'E'],
      [W, 'The Computer Centre is alongside, with its own door round the side'],
      [P, 'Reading a borrowed book', null, 'Borrowing is tracked; the books have no text.'],
    ], see: ['computer-centre', 'cafe'] },
  { id: 'computer-centre', cat: 'learn', name: 'Computer Centre', kicker: 'PCs · internet · printing', blurb: 'Rows of workstations, a help desk and a printer. Sit at a free PC and use IITG OS: a real desktop with a browser, YouTube, Notepad, Paint and more.',
    hours: '8 AM – midnight', where: { poi: 'Computer Centre' },
    feats: [
      [W, 'Sit at a free PC and use IITG OS (windows, start menu, taskbar)', 'E'],
      [W, 'Scan in at the machine by the glass door', 'E'],
      [P, 'Real websites and YouTube on the PC', null, 'They need the game started with launch.bat; the online preview blocks outside sites.'],
      [P, 'Printing', null, 'The help desk is there; nothing prints.'],
    ], see: ['iitg-os'] },
  { id: 'admin', cat: 'learn', name: 'Administrative Building', kicker: 'Director · Deans · offices', blurb: 'The offices of the institute: a reception and enquiry desk, staff at their desks, and the flag lawn in front.',
    hours: 'Office hours 9 AM – 5:30 PM', where: { lm: 'admin' },
    feats: [[W, 'Ask at the enquiry desk: scholarships, the ATM, campus jobs', 'E'], [W, 'Visit the flag lawn with its flagpole and circular path'], [N, 'Meeting the Director or filling forms']], see: ['flag-lawn'] },
  { id: 'workshop', cat: 'learn', name: 'Mechanical Workshop', kicker: 'Machining · welding', blurb: 'The central workshop where first-years learn machining, welding and fabrication.', feats: [[W, 'Go in and look round', 'E'], [N, 'Using the machines']], where: { lm: 'workshop' } },
  { id: 'techpark', cat: 'learn', name: 'Technology Park', kicker: 'Start-ups · research · industry', blurb: 'The research park on the former east cricket ground (the campus has one cricket ground now): five new buildings round a paved plaza with flower beds, benches, lamps, a steel sculpture and a name wall, just north of the IITG Bus Stop.',
    feats: [[W, 'Walk the plaza and go into any of the buildings', 'E'], [W, 'Look at the sculpture and the name wall']], see: ['tic', 'bus-stop'], where: { lm: 'techpark' } },
  { id: 'tic', cat: 'learn', name: 'Technology Incubation Centre', kicker: 'Start-ups', blurb: 'Where start-ups born at IIT Guwahati are incubated.', feats: [[W, 'Go in: an office floor with desks', 'E'], [N, 'Running or joining a start-up']], where: { lm: 'tic' } },
  { id: 'kv-school', cat: 'learn', name: 'Kendriya Vidyalaya', kicker: 'School for the campus children', blurb: 'The school in its own building, with a classroom, a flag with the Ashoka Chakra, a mural wall, pupils and teachers.',
    hours: 'School Mon–Fri, about 7:45 AM – 1:30 PM',
    feats: [[W, 'Go into the classroom and sit at the back to listen to the lesson', 'E'], [W, 'Pupils and teachers follow the school day, with gates and a guard'], [N, 'Playing with the children or joining classes']], where: { lm: 'kv' } },
  { id: 'conference', cat: 'learn', name: 'Conference Centre', kicker: 'AI Confluence · seminars', blurb: 'A carpeted hall with padded chairs, a stage, a podium, standees, a ceiling projector and a pull-down screen. The AI Confluence talks happen here.',
    where: { lm: 'conference' }, hours: 'Seminars Fridays 4 PM · AI Confluence Thursdays 10 AM – 5 PM',
    feats: [
      [W, 'Sit and watch the aftermovie or the talk on the big screen', 'E'],
      [W, 'Presenter PC on the podium: sign in (user iitg, password iitg) and whatever you open fills the big screen', 'E', 'A web browser, YouTube, Notepad, Paint and the rest of IITG OS.'],
      [W, 'Present / share your screen: show a real window or browser tab of your computer on the big screen, as when a laptop is plugged into the projector (a YouTube tab that plays properly, slides, a document)', 'E', 'The browser asks what to share; press the button again to stop. Needs the game started with launch.bat; an online preview may not allow screen sharing.'],
      [P, 'The film and real websites on the screen', null, 'They need the game started with launch.bat.'],
      [W, 'Exit doors at the front, beside the stage'],
    ], see: ['iitg-os', 'auditorium'] },
  { id: 'auditorium', cat: 'learn', name: 'Dr. Bhupen Hazarika Auditorium', kicker: 'Films · shows · events', blurb: 'A wide wooden stage with red drapes, a huge screen, warm wood panelling, acoustic panels, dark seats on red-carpeted tiers and exits at the front.',
    where: { lm: 'auditorium' },
    feats: [
      [W, 'Take a seat and watch the IIT Guwahati film on a screen that fills the whole stage opening', 'E'],
      [W, 'Presenter PC on the podium: sign in (user iitg, password iitg) and show anything from the internet or YouTube on the big screen', 'E'],
      [W, 'Present / share your screen from the podium: a window or tab of your own computer appears on the big screen', 'E'],
      [W, 'A full house for events; two ground-level exits'],
      [P, 'The film, YouTube and websites', null, 'They need the game started with launch.bat.'],
      [N, 'Booking the hall, or performing on the stage'],
    ], see: ['iitg-os', 'events'] },

  // ================================================================ sports & fitness
  { id: 'pool', cat: 'play', name: 'Swimming Pool', kicker: 'The pool complex', blurb: 'A standard 25 m × 12.5 m pool with six lanes (a semi-Olympic pool, not a hostel-sized one) in a walled compound with a gate, girls’ and boys’ changing rooms, toilets, showers, a first-aid and lifeguard room, lockers, starting blocks with lane numbers, backstroke flags, depth marks, rescue rings, a stand for spectators, floodlights, a rules board and a scoreboard.',
    hours: 'Posted 6–9 AM and 4–8 PM', where: { lm: 'pool' },
    feats: [
      [W, 'Change into a swimming costume and back again in the girls’ or boys’ changing room', 'E', 'The lifeguard reminds you if you jump in wearing street clothes.'],
      [W, 'Swim: a proper front crawl, face down, or tread water', 'W|A|S|D|Shift'],
      [W, 'Take a rinse shower, use the lockers, toilets and first-aid room', 'E'],
      [W, 'Scan in and out at the OneStop machine at the gate', 'E'],
      [W, 'The inter-hostel aquatics meet, 4 to 7 PM: swimmers in their hostels’ caps warm up, dive at the whistle, race a length, and the scoreboard shows the result'],
      [W, 'Swimmers rest on the pool edge, take their marks and dive'],
      [P, 'Opening hours', null, 'They are on the rules board; the gate stays open for you at any time.'],
      [N, 'Diving from the starting blocks yourself, or taking part in the race'],
    ], see: ['onestop', 'lakes'] },
  { id: 'gym', cat: 'play', name: 'General Gym', kicker: 'Weights · cardio · lockers', blurb: 'Mirrors, treadmills, exercise bikes, cross-trainers, squat racks with plates, a cable station, lat pull-downs, a leg press, kettlebells, a punching bag, yoga mats, a reception desk, trainers, and a locker room by the door. About thirty-five people use it through the day.',
    hours: 'Busiest 6–9:30 AM and 5–10 PM', where: { lm: 'gym' },
    feats: [
      [W, 'Work out: a reps challenge (at the bench, the squat rack or the bike)', 'E'],
      [W, 'Run on a treadmill for 28 seconds (energy down, XP up)', 'E'],
      [W, 'Change into gym wear in the locker room, and back', 'E'],
      [W, 'Students on the treadmills, benches and mats follow the gym hours'],
      [N, 'Personal training or a membership'],
    ], see: ['sac'] },
  { id: 'sac', cat: 'play', name: 'Student Activity Centre', kicker: 'Clubs · dance · music', blurb: 'Club rooms and activity spaces for the student Gymkhana: a dance floor with mirrors, a music corner (drum kit, keyboard, amps) and posters of the clubs and fests.',
    hours: 'Clubs 5 – 9:30 PM', where: { lm: 'sac' },
    feats: [
      [W, 'Join the dance club practice (a rhythm game, with an original rock track)', 'E'],
      [W, 'Jam with the music club (a rhythm game with a live band)', 'E'],
      [W, 'Posters of the coding, robotics, dance, music, photography and astronomy clubs, Techniche and Alcheringa'],
      [W, 'The New SAC is alongside, with more halls'],
      [N, 'Joining a club for good, or club elections'],
    ] },
  { id: 'cricket', cat: 'play', name: 'Cricket Ground', kicker: 'Matches · the Techniche and Alcheringa stages', blurb: 'The campus has one cricket ground. Inter-hostel matches are played on it, and at its far end stands the permanent open-air concert stage, facing the middle, with a lighting truss: its lights and LED wall come on for the Techniche and Alcheringa Pronites. (Every hostel also has its own small cricket practice pitch.)',
    hours: 'Matches about 4:15 – 6:30 PM', where: { lm: 'cricket' },
    feats: [
      [W, 'Join a match and bat: swap in for a player', 'E'],
      [W, 'The Inter-hostel Cricket Final on Wednesdays (Friday: Techniche Pronite, Sunday: Alcheringa Pronite)'],
      [W, 'The open-air concert stage: walk up onto it; its truss lights work during the concerts'],
      [P, 'Bowling or fielding yourself', null, 'You bat.'],
    ], see: ['events'] },
  { id: 'athletics', cat: 'play', name: 'Athletics Track & Football Ground', kicker: 'Running · football', blurb: 'The main sports ground with a running track with lanes and stands with stone steps (and a stair at each end) to watch from. Inter-hostel sports and Spirit events happen here.',
    where: { lm: 'athletics' },
    feats: [[W, 'Race the 100 m sprint on the track', 'E'], [W, 'Climb the stands and watch', 'E'], [W, 'Join the football match in the evening', 'E']], see: ['football', 'events'] },
  { id: 'football', cat: 'play', name: 'Football ground', kicker: 'Blue vs Red', blurb: 'A pitch for evening matches.', hours: 'About 4:15 – 6:45 PM',
    feats: [[W, 'Swap in for a player and play: pass, shoot and score', 'E'], [W, 'Kick the footballs lying about by running into them']], see: ['knockables'], where: { field: 'soccer' } },
  { id: 'courts', cat: 'play', name: 'Courts', kicker: 'Tennis · basketball · volleyball', blurb: 'Two fenced courts of each sport by the sports ground, with walk-in gates only; and every hostel has its own volleyball court, basketball court and cricket practice pitch beside it (Dihing’s basketball court is a wall court with a tall fence, a backboard wall and washing hung on lines).',
    feats: [[W, 'Tennis and volleyball: swap in for a player (rallies)', 'E'], [W, 'Basketball: a shootout', 'E'], [N, 'Cycles or vehicles inside']], where: { field: 'tennis' } },
  { id: 'childpark', cat: 'play', name: 'Children’s Park', kicker: 'For the campus children', blurb: 'A park with a play area, for the children of the residential area.', feats: [[W, 'Walk in and watch the children play'], [N, 'Using the swings and slides']], where: { lm: 'childpark' } },
  { id: 'sports-building', cat: 'play', name: 'Sports building', kicker: 'Indoor sports', blurb: 'An indoor sports building.', feats: [[W, 'Go in and look round', 'E']] },

  // ================================================================ services & security
  { id: 'hospital', cat: 'services', name: 'IITG Hospital', kicker: 'OPD · pharmacy · ambulance', blurb: 'The campus hospital for students, staff and their families: a reception and OPD, a doctor’s cabin, a ward, a pharmacy and an ambulance bay.',
    hours: 'OPD 9 AM – 1 PM and 3 – 7 PM · pharmacy 9 AM – 9 PM · emergency always', where: { lm: 'hospital' },
    feats: [
      [W, 'See the doctor for a check-up: free for students, energy back to at least 70%', 'E'],
      [W, 'Buy medicine at the pharmacy: paracetamol, ORS, glucose biscuits, bandages', 'E'],
      [W, 'Volunteer as the ambulance driver: a paid job', 'E'],
      [W, 'A ward with beds, and staff on duty'],
      [N, 'Being admitted, or real prescriptions'],
    ], see: ['jobs'] },
  { id: 'guesthouse', cat: 'services', name: 'Guest House', kicker: 'Visitors’ rooms', blurb: 'The institute guest house beside the lake, with a reception and a sofa lounge.', where: { lm: 'guesthouse' },
    feats: [[W, 'Ask about a room at the reception', 'E'], [W, 'Sit in the lounge', 'E'], [N, 'Booking or staying a night']] },
  { id: 'transit', cat: 'services', name: 'Transit Complex', kicker: 'Transit accommodation', blurb: 'Transit accommodation on the eastern side of campus.', feats: [[W, 'Ask at the reception', 'E']], where: { lm: 'transit' } },
  { id: 'quarters', cat: 'services', name: 'Staff quarters', kicker: 'A–F type houses', blurb: 'Houses for faculty and staff families: the row opposite the entrance of Subansiri Hostel, and the colonies at the edges of the campus. There are no quarters scattered along the roads in the middle of the campus.',
    feats: [[W, 'Go in and sit with a campus family for tea and a chat', 'E'], [W, 'Families, children and pets follow the day'], [N, 'Living in a staff home for a night']] },
  { id: 'bungalow', cat: 'services', name: 'Director’s Bungalow', kicker: 'The white house below the View Point', blurb: 'The Director’s residence: a grand house with a columned portico, two wings and a dome in a walled garden with a fountain, flower beds, fruit trees, a gazebo, a swimming pool and a black car. A guard post at the gate, two guards on chairs, a register.', feats: [[W, 'Look at it through the fence: the garden, the fountain, the fruit trees'], [W, 'Ask the guard for an appointment (Monday to Friday, 10 AM to 5:30 PM): the gate and the house open for an hour', 'E'], [W, 'Go in: a drawing room with a chandelier, the Director at the desk, tea and biscuits', 'E'], [N, 'Going in without an appointment', null, 'Visitors by appointment only.']] },
  { id: 'security', cat: 'services', name: 'Security', kicker: 'Guards and cabins', blurb: 'Guards and cabins at every gate, hostel door and compound gate, at the big buildings, the colonies and the traffic circles. Shifts change at 6, 2 and 10.',
    feats: [[W, 'Talk to a guard', 'E'], [W, 'Sign the visitors’ register at the security desk of a girls’ hostel (every visitor to it)'], [W, 'Guards ride to their shifts and sit or stand in their cabins']], see: ['gates'] },
  { id: 'building', cat: 'services', name: 'Institute building', kicker: 'Building', blurb: 'An institute building. Every building can be entered with E at its wall; it has an office floor with desks and a notice board.', feats: [[W, 'Go inside and look round', 'E']] },

  // ================================================================ lakes & landmarks
  { id: 'lakes', cat: 'nature', name: 'Lakes', kicker: 'IITG Lake · Serpentine Lake · Guest House Lake', blurb: 'One of the things that make IITG so green: lakes with lotus and lily pads, reeds and shrubs on the banks, shade trees, benches, and a jetty with boats on the IITG Lake.',
    where: { lm: 'lake' },
    feats: [
      [W, 'Swim in the lakes', 'W|A|S|D'],
      [W, 'Row or speed across the IITG Lake from its jetty (no boats on the other lakes)', 'E'],
      [W, 'Sit on the lakeside benches; the IITG Lake is fenced all round except at the boat jetty, with a forest of trees behind the fence'],
      [W, 'Lotus, reeds, ducks with their duck house, egrets flying home at dusk'],
      [W, 'After dark, couples on the benches and along the railing, now and then a proposal with a red rose'],
      [N, 'Fishing'],
    ], see: ['boats', 'wildlife'] },
  { id: 'viewpoint', cat: 'nature', name: 'View Point', kicker: 'The lookout on the hill', blurb: 'A lookout on the top of the highest hill, at the end of a winding forest trail more than two kilometres long. The trail is for people on foot only: cycles and vehicles are stopped at its foot, and the forest is very dense. On a clear day you see across the campus lakes to the Brahmaputra. A railing runs round the top, with walk-in gates and a register at the entry.',
    where: { lm: 'viewpoint' },
    feats: [
      [W, 'Walk up the winding trail through the forest (more than 2 km from the nearest road): distance posts every 300 m, log benches to rest on', 'W|A|S|D'],
      [W, 'Scan in at the entry machine; scan out when you leave', 'E'],
      [W, 'Sit on the benches and look out'],
      [W, 'At most sixteen visitors at a time; guards at the gates'],
      [N, 'Cycles', null, 'Not allowed on the View Point or on the trail up to it.'],
    ] },
  { id: 'rhino-circle', cat: 'nature', name: 'Rhino Circle and the roundabouts', kicker: 'Traffic islands', blurb: 'The Rhino Circle on the road in from the Main Gate has a rhino and calf standing on a round stone plinth on its island. The Gym Circle and Core 5 Circle are plain islands with lawns, shrubs, flowers and a lamp post. The Lake Circle, at the junction nearest the IITG Lake, is a roundabout with an island of flowers (no statue): the air-quality board on two posts, a guard’s booth, a bus stop and the duck house stand round it.',
    feats: [[W, 'Traffic goes round the roundabouts, keeping left'], [W, 'Step onto an island (it is a low kerb)'], [W, 'The rhino statue, for a photo', 'K']], where: { circle: 1 }, see: ['photo-point'] },
  { id: 'flag-lawn', cat: 'nature', name: 'Flag lawn', kicker: 'Beside the Administrative Building', blurb: 'An open mown lawn with a circular path, a flagpole with the national flag (with the Ashoka Chakra) on a raised plinth, and no trees.', feats: [[W, 'Walk up the steps to the flag plinth'], [W, 'Photograph the flag', 'K']], see: ['admin'] },
  { id: 'photo-point', cat: 'nature', name: 'IITG letters', kicker: 'The photo point', blurb: 'Big IITG letters at one place in the campus: stand beside them for a photo.', feats: [[W, 'Take a photo', 'K']], see: ['camera'] },
  { id: 'benches', cat: 'nature', name: 'Benches and seats', kicker: 'Everywhere', blurb: 'Benches along the lakes, the View Point and the sit-outs, chairs at stalls, porches and guard cabins, and circles of friends on the grass.', feats: [[W, 'Sit down; move or press E to get up', 'E'], [W, 'Sit with the students on the grass circles', 'E'], [P, 'Chairs someone is sitting in', null, 'You cannot sit on those.']], see: ['walking'] },
  { id: 'knockables', cat: 'nature', name: 'Knockable things', kicker: 'Dustbins · cones · pots · boards · footballs', blurb: 'Dustbins, traffic cones, flower pots at the doors, yellow A-frame boards at busy entrances and footballs lying about. Walk or ride into them and they tip or roll; a sweeper puts them back a minute later.',
    feats: [[W, 'Knock over dustbins, cones, flower pots and boards by walking, cycling or driving into them'], [W, 'Kick a football: run into it and it rolls away'], [W, 'They are put back after a minute']], see: ['football'] },
  { id: 'murals', cat: 'nature', name: 'Murals', kicker: 'Painted walls', blurb: 'Painted walls across the campus: graffiti on each hostel with only that hostel’s own name or Assam words and a slogan about Assam (bands of gamosa, a japi in each corner, the word অসম), big scenes of Assam (the Brahmaputra at dusk, Kaziranga’s rhinos, a tea garden, Bihu dancers, the great hornbill, the Saraighat bridge), themed walls at the SAC, gym, food court and KV, and folk-art panels on some quarters.',
    feats: [[W, 'Look at them, and photograph them', 'K'], [W, 'Graffiti on many more walls, in several styles: bubble pieces, neon on brick, stencils, walls of tags, a rhino, circuits, a robot, the campus skyline'], [W, 'The graffiti wall (the house beside the Alcheringa board) is repainted for the event that is running: Alcheringa, Techniche, the AI Confluence, the cricket final, sports day, convocation, orientation, the club fair']], see: ['camera'] },

  // ================================================================ phone, PCs & money
  { id: 'onestop', cat: 'apps', name: 'OneStop', kicker: 'The campus app on your phone', blurb: 'Your entry pass and campus companion: it knows your name, hostel, roll number and room, scans the QR machines at gates and doors, keeps the GateLog, shows the timetable and the mess menu, sells guest coupons and tells you what is going on everywhere (Campus Live).',
    feats: [
      [W, 'Open the phone anywhere', 'O', 'Or press E at a machine to scan.'],
      [W, 'Scan in and out at every gate, the boys’ hostel doors, the pool, the View Point, the Central Library and the Computer Centre', 'E', 'A girls’ hostel has no QR for visitors: they sign the register at its desk.'],
      [W, 'GateLog: where you went out and came in, and for how long'],
      [W, 'Time Table: today’s lectures'],
      [W, 'Food: the mess menu for every meal of the day, your coupons, and Buy a guest coupon (paid by UPI)'],
      [W, 'Campus Live: what is on now at the lectures, messes, canteens, library, pool, gym, SAC, grounds, hospital and gates'],
      [W, 'My QR, and your profile (name, hostel, roll number, room)'],
      [N, 'Real notifications, or a connection to the real OneStop'],
    ], see: ['gates', 'mess'] },
  { id: 'iitg-os', cat: 'apps', name: 'IITG OS', kicker: 'The desktop on the PCs', blurb: 'A full desktop with a boot and sign-in screen, a start menu, a taskbar with a clock, and windows you can drag, resize, minimise and maximise. On the presenter PCs in the halls the user is iitg and the password is iitg.',
    feats: [
      [W, 'Apps: Browser, YouTube, Files, Notepad (save, open, download), Paint, Calculator, Photos & Videos, Terminal, Settings, Clock, Task Manager, Snake'],
      [W, 'Your camera photos and videos appear in Photos & Videos, with download'],
      [W, 'Computer Centre PCs, and the presenter PCs in the auditorium and Conference Centre'],
      [P, 'Real websites and YouTube', null, 'The game must be started with launch.bat (its small local server does the fetching). Opened as a plain file, the PC searches and reads Wikipedia; the online preview blocks outside sites.'],
    ], see: ['computer-centre', 'auditorium', 'conference'] },
  { id: 'wallet', cat: 'apps', name: 'Money', kicker: 'Rupees, card, UPI, friends', blurb: 'You start with ₹10,000 in cash and a credit card with a ₹25,000 limit. UPI pays from the account behind your card. When you are short, friends lend you money.',
    feats: [
      [W, 'Pay in cash, by card or by UPI; the planner and the ATM switch between them'],
      [W, 'Borrow from a friend when you run short (up to ₹20,000) and pay back at the ATM or in the planner'],
      [W, 'Pocket money from home arrives each week (₹3,000, collect it at the ATM)'],
      [W, 'Earn with campus jobs'],
      [N, 'Interest, bank statements or real payments'],
    ], see: ['atm', 'jobs'] },
  { id: 'planner', cat: 'apps', name: 'Planner', kicker: 'Tab', blurb: 'Today’s timetable, this week’s events, your wallet, food delivery, campus jobs, quick travel to places, and the time and weather controls.',
    feats: [[W, 'Today’s schedule and the week’s events, with “Skip to it”', 'Tab'], [W, 'Order food on your phone: a rider brings it to your hostel gate'], [W, 'Quick travel to places'], [W, 'Clock speed and weather']], see: ['events', 'jobs'] },
  { id: 'camera', cat: 'apps', name: 'Camera', kicker: 'Photos and video', blurb: 'Press K to take out your camera: your body is hidden so nothing is in the way. Photos are PNG; videos are MP4 with the game’s sound.',
    feats: [[W, 'Take a photo, or record a video', 'K'], [W, 'Change filter and time of day', 'F|[|]'], [W, 'Zoom', 'Wheel'], [W, 'Download from the Journal, or from Photos & Videos on a PC', 'J']], see: ['drone', 'iitg-os'] },
  { id: 'journal', cat: 'apps', name: 'Journal', kicker: 'J', blurb: 'Your progress: places found, hostels visited, achievements, meals, lectures, distance cycled, animals seen, your CPI and rank, and a gallery of your photos and videos.',
    feats: [[W, 'See landmarks and travel to them', 'J'], [W, 'Fifty achievements to earn'], [W, 'Your photos and videos, with download']] },

  // ================================================================ campus life
  { id: 'people', cat: 'life', name: 'People', kicker: 'Students, staff, guards, families', blurb: 'About two thousand students and the people who run the campus, each following a day: to class, to the mess, to the grounds, back to the hostel, with rush hours, groups of friends, couples at night, staff shifts and guards at every gate.',
    feats: [[W, 'Talk to a person near you: every kind of person (students, guards, professors, the Director, mess workers, stall owners, kids, visitors...) has more than a hundred things to say, and none repeats until all are said; some depend on the time, the weather, the meal, the events and the place', 'E', 'A guard, a professor, a shopkeeper, a student.'], [W, 'Ask a passing cyclist for a lift', 'E'], [W, 'A quiet campus late at night'], [N, 'Conversations that go anywhere']], see: ['security'] },
  { id: 'wildlife', cat: 'life', name: 'Animals', kicker: 'Dogs, cats, birds and more', blurb: 'Campus dogs and cats, squirrels, mongooses, ducks with their duck house, kingfishers, mynas, pigeons, kites, egrets flying home at dusk, and golden jackals at night.',
    feats: [[W, 'Feed a dog or a cat: biscuits, ₹10', 'E'], [W, 'Spot animals for your journal'], [N, 'Cows and peacocks']], see: ['lakes'] },
  { id: 'events', cat: 'life', name: 'Events', kicker: 'Every week', blurb: 'A week of events: the Freshers’ Orientation (Mon), Club Fair (Tue), Inter-hostel Cricket Final (Wed), AI Confluence (Thu), Techniche Pronite (Fri), Spirit Sports Day (Sat morning), Convocation and Alcheringa Pronite (Sun).',
    feats: [[W, 'See what is on, and jump to it', 'Tab'], [W, 'Go along: concerts, talks, matches and ceremonies have their own activities'], [W, 'The map marks live events with a star', 'M']], see: ['planner'] },
  { id: 'jobs', cat: 'life', name: 'Jobs and races', kicker: 'Earn money, beat the clock', blurb: 'Two campus jobs pay money and XP, and three races test your route knowledge.',
    feats: [[W, 'Pizza delivery from the Pizza Corner', 'E'], [W, 'Ambulance duty from the hospital', 'E'], [W, 'Race: Late for class, to the mess, to the library', 'L']], see: ['wallet'] },
  { id: 'time-weather', cat: 'life', name: 'Time and weather', kicker: 'IST, the seasons', blurb: 'The campus clock runs on Indian Standard Time. Everything follows it: lectures, meals, gates, sport, the crowd, the lights and the sky.',
    feats: [[W, 'Next time of day: morning, noon, afternoon, golden hour, night, dawn', 'N'], [W, 'Time and weather controls', 'Shift|N'], [W, 'Clock speed from paused to one minute an hour'], [W, 'Clear, cloudy, overcast, rain, thunderstorm, mist, fog, or Auto (the Guwahati seasons)']], see: ['planner'] },
];

// ---------------------------------------------------------------- what is going on right now (the Info panel and the guide read these)
const fmtH = (h) => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh >= 12 && hh < 24 ? 'PM' : 'AM'}`; };
const within = (h, a, b) => h >= a && h < b;
const open = (on, openText, closedText, note) => ({ pill: on ? openText : closedText, tone: on ? 'ok' : 'no', note });
export const LIVE = {
  hostel: (g) => { const m = mealNow(g.clock.hour), h = g.clock.hour; return m ? { pill: `${mealName(m.id, g.clock.weekday)} now`, tone: 'live', note: `${mealName(m.id, g.clock.weekday)} is being served until ${fmtH(m.to)}.` } : { pill: `Next: ${nextMeal(h).name.toLowerCase()} ${fmtH(nextMeal(h).from)}`, tone: 'live' }; },
  mess: (g) => { const m = mealNow(g.clock.hour); return m ? { pill: `${mealName(m.id, g.clock.weekday)} · guest ₹${priceOf(m.id, g.clock.weekday)}`, tone: 'live', note: 'The mess is open. Your own hostel: show the mess card (free).' } : { pill: 'Closed', tone: 'no', note: `Next: ${nextMeal(g.clock.hour).name.toLowerCase()} at ${fmtH(nextMeal(g.clock.hour).from)}.` }; },
  'hostel-canteen': (g) => open(g.clock.hour >= 18 || g.clock.hour < 2, 'Open now', 'Closed', 'Open 6 PM to 2 AM.'),
  library: (g) => open(g.clock.hour >= 8 || g.clock.hour < 2, 'Open', 'Closed'),
  'computer-centre': (g) => open(g.clock.hour >= 8, 'Open', 'Opens at 8 AM'),
  pool: (g) => { const h = g.clock.hour, posted = within(h, 6, 9) || within(h, 16, 20); return { pill: within(h, 16, 19) && !g.clock.weekend ? 'Aquatics meet now' : posted ? 'Posted: open' : 'Posted: closed', tone: posted ? 'ok' : 'no', note: 'Posted timings: 6–9 AM and 4–8 PM.' }; },
  gym: (g) => open(within(g.clock.hour, 6, 9.5) || within(g.clock.hour, 16.5, 22), 'Busy now', 'Quiet now'),
  hospital: (g) => { const h = g.clock.hour; return open(within(h, 9, 13) || within(h, 15, 19), 'OPD open', 'OPD closed', 'Emergency and ambulance: always.'); },
  lhc: (g) => { const h = g.clock.hour, on = !g.clock.weekend && (within(h, 9, 13) || within(h, 14, 17)); return open(on, 'Lectures on', g.clock.weekend ? 'No lectures today' : 'No lecture now'); },
  sac: (g) => open(within(g.clock.hour, 17, 21.5), 'Clubs on', 'Quiet now'),
  foodcourt: (g) => open(within(g.clock.hour, 10, 23), 'Open', 'Closed'),
  market: (g) => open(within(g.clock.hour, 8, 22), 'Shops open', 'Shops closed'),
  admin: (g) => open(!g.clock.weekend && within(g.clock.hour, 9, 17.5), 'Office hours', 'Closed'),
  'kv-school': (g) => open(!g.clock.weekend && within(g.clock.hour, 7.8, 13.5), 'School on', 'School is out'),
  gates: (g) => { const day = within(g.clock.hour, 6, 22); return { pill: day ? 'All open' : 'Main Gate only', tone: day ? 'ok' : 'live', note: day ? 'The Main Gate, the KV Gate and the Khokha Gate are open.' : 'Only the Main Gate is open at night.' }; },
  campus: (g) => ({ pill: `${g.clock.dayName} ${fmtH(g.clock.hour)}`, tone: 'live' }),
};

// ---------------------------------------------------------------- lookups
const byId = new Map(TOPICS.map((t) => [t.id, t]));
export const topicById = (id) => byId.get(id) || null;
export const allTopics = () => TOPICS;
export const topicsByCat = (cat) => TOPICS.filter((t) => t.cat === cat);
export function statusCounts(t) {
  const c = { works: 0, partial: 0, no: 0 };
  for (const tp of t ? [t] : TOPICS) for (const f of tp.feats || []) c[f[0]]++;
  return c;
}
export function searchTopics(q, filter = 'all') {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return TOPICS.filter((t) => {
    if (filter === 'limits' && !t.auto && !(t.feats || []).some((f) => f[0] !== 'works')) return false;
    if (!words.length) return true;
    const hay = `${t.name} ${t.kicker || ''} ${t.blurb} ${(t.feats || []).map((f) => `${f[1]} ${f[3] || ''}`).join(' ')} ${(t.has || []).join(' ')} ${(t.tips || []).join(' ')}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
export const GUIDE = { STATUS, CATEGORIES, TOPICS };
void MEALS;
