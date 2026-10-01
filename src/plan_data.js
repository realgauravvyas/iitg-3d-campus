// Facts read off IIT Guwahati's 2011 master plan (with contours) and the OpenStreetMap data, in map
// coordinates (metres, x east, y north). The plan itself is not part of the game: it was only used as
// a reference, lined up with the map by tools/plan/register.py (~2-5 m on the roads), and checked
// against the satellite image and the map data. Things drawn as "proposed" in the plan (new
// quarters, proposed hostels, lakes that were never dug) are left out.
export const PLAN = {
  // roundabouts at road junctions (island radius in m); the first is the Rhino Circle by the Main Gate
  roundabouts: [
    { x: -598.6, y: 665.0, island: 12.1, name: 'Rhino Circle', rhino: true },
    { x: 337.3, y: 214.9, island: 8.5, name: 'Gym Circle' },
    { x: -458.8, y: -368.5, island: 7.0, name: 'Core 5 Circle' },
    { x: 714.8, y: 378.5, island: 6.0, name: 'Transit Circle' },
  ],
  // bus stands of the campus bus service
  busStands: [[-629.2, 670.4], [-442.7, 770.8], [-177.7, 915.2], [26.3, 987.4], [199.7, 725.9], [-12.3, 589.6], [480.5, 135.0], [132.7, -13.8]],
  // staff quarters: where the plan marks each type (A = senior faculty ... F = staff flats)
  quarters: {
    A: [[191.9, 1171.8]],
    B: [[105.5, 1132.1], [172.5, 1044.6], [152.5, 995.7], [101.2, 977.4], [47.8, 1073.5], [148.1, 1218.8], [161.6, 1135.3]],
    C: [[-264.3, 1016.6], [-205.6, 928.4], [-268.2, 1087.4], [-230.1, 1103.7], [-200.4, 1080.1], [-152.5, 1036.9], [-117.8, 1026.8]],
    D: [[-413.8, 816.4], [-418.2, 689.2], [-483.3, 676.0], [-572.5, 550.0], [-596.1, 526.4], [-548.6, 469.0]],
    E: [[-457.0, 569.9], [-497.6, 626.2], [-724.7, 304.7], [-750.6, 345.9]],
    F: [[-97.6, 344.8], [-97.2, 388.7], [-97.3, 432.4], [-100.4, 499.2], [-100.3, 545.9], [-102.2, 591.3], [-109.4, 647.6], [-111.3, 710.2], [-126.0, 756.5], [-233.2, 747.4], [-241.6, 775.5], [-165.2, 783.4], [-147.9, 975.6]],
  },
  // places (the school and the post office are OpenStreetMap buildings, the rest from the plan)
  kv: { x: 190.8, y: -584.2 },
  postOffice: { x: 181.2, y: -674.7 },
  reservation: { x: 174.5, y: -640.0 },
  waterTreatment: { x: -19.5, y: -458.0 },
  sewageTreatment: { x: 907.0, y: 5.0 },
  // the plan numbers the hostels in the order they were built
  hostelNumbers: { manas: 1, dihing: 2, kapili: 3, siang: 4, kameng: 5, barak: 6, umiam: 7, dibang: 8, brahmaputra: 9 },
};
