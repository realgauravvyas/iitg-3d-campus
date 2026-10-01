import * as THREE from 'three';
import { World, ELEV0 } from './world.js';
import { buildTerrain } from './scene/terrain.js';
import { buildBuildings } from './scene/buildings.js';
import { buildRoads } from './scene/roads.js';
import { planDualRoads, buildDualRoads } from './scene/dualroads.js';
import { planHillForest, buildHillTrail } from './scene/hilltrail.js';
import { buildTechPark, buildBusTerminus } from './scene/techpark.js';
import { buildWater } from './scene/water.js';
import { buildVegetation } from './scene/vegetation.js';
import { DrawDist } from './scene/drawdist.js';
import { buildProps } from './scene/props.js';
import { buildSky, TIME_PRESETS, formatTime } from './scene/sky.js';
import { RoadGraph, FILTERS } from './route.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { UI } from './ui.js';
import { Player, orbitCamera } from './player.js';
import { BikeRide } from './bike.js';
import { BusTour } from './bus.js';
import { DroneMode } from './drone.js';
import { Traffic } from './traffic.js';
import { Progress } from './progress.js';
import { RouteGuide, BikeTour, LateForClass } from './tours.js';
import { DEFAULT_LOOK } from './avatar.js';
import { loadImage, nextFrame, clamp, closestOnRing, fmtDist } from './util.js';
import { CampusClock } from './life/clock.js';
import { Weather } from './scene/weather.js';
import { Screens } from './screens.js';
import { PostFX } from './postfx.js';
import { buildGrass } from './scene/grass.js';
import { buildStalls } from './scene/stalls.js';
import { buildLandmarks, letterSpots } from './scene/landmarks.js';
import { rhinoSpot, addRoundabout, planCircles, buildIslands, lakeJunction } from './scene/roundabout.js';
import { planLakeCircle } from './scene/lakecircle.js';
import { raiseAcademicFloor, buildAcademicFront } from './scene/acfront.js';
import { PLAN } from './plan_data.js';
import { buildViewpoint } from './scene/viewpoint.js';
import { buildBungalow } from './scene/bungalow.js';
import { buildBusStops, planBusStands } from './scene/busstops.js';
import { applyPlan } from './scene/planfacts.js';
import { buildCourts, sportsAreas, pruneCourts, paintOverCourts, fenceOutlines, dropQuartersOnGrounds, dropQuartersNear } from './scene/courts.js';
import { CrowdRenderer } from './crowd/people.js';
import { BikeRenderer } from './crowd/bikes.js';
import { AnimalRenderer } from './crowd/animals.js';
import { Venues } from './life/venues.js';
import { CampusLife } from './life/campus.js';
import { StreetLife } from './life/street.js';
import { Wildlife } from './life/wildlife.js';
import { environment } from './life/environment.js';
import { U } from './scene/shared.js';
import { Interactions } from './core/interact.js';
import { ActivityManager } from './core/activity.js';
import { ActivityRegistry } from './activities/index.js';
import { Interiors } from './interiors/manager.js';
import { Sports } from './sports/index.js';
import { EventManager } from './events/index.js';
import { Jobs } from './jobs.js';
import { Drive } from './vehicle.js';
import { Boats } from './boat.js';
import { Capture } from './capture.js';
import { Avoid } from './life/avoid.js';
import { SplashFX } from './scene/splash.js';
import { CampusTour } from './tour.js';
import { Neighbourhood, planSchool } from './life/neighbourhood.js';
import { Commuters } from './life/commute.js';
import { Music } from './music.js';
import { Polish } from './polish.js';
import { buildFestive } from './scene/festive.js';
import { Knockables, seedKnockables } from './scene/knock.js';
import { buildSignage } from './scene/signage.js';
import { planMurals } from './scene/murals.js';
import { planPool, buildPool } from './scene/pool.js';
import { markPlace } from './scene/entrances.js';
import { OneStop } from './onestop.js';
import { GameGuide } from './guide/guide.js';
import { MessPlayer } from './mess/player.js';
import { makePlacer } from './scene/placement.js';
import { makeBoardsTwoSided } from './scene/bidir.js';
import { fitBuildingsToWall } from './scene/fit.js';
import { buildLakeside, planLakeForest } from './scene/lakeside.js';
import { planLawns, paintLawns, designLawns, buildLawnShrubs } from './scene/lawns.js';
import { buildDoors } from './scene/doors.js';
import { LakeCouples } from './life/couples.js';
import { buildSideDoor } from './scene/sidedoor.js';
import { buildOutside } from './scene/outside.js';
import { Transport, rideFare } from './transport.js';
import { buildCycleShops } from './scene/cycleshops.js';
import { buildInfrastructure } from './scene/infrastructure.js';
import { mealNow, nextMeal } from './interiors/templates.js';
import { fmtHour } from './life/clock.js';

const ROAD_W = { primary: 9, secondary: 8, tertiary: 7.5, unclassified: 7, residential: 6.5, service: 4.5, living_street: 5, track: 3.5, cycleway: 3, footway: 2.2, path: 2.2, pedestrian: 4, steps: 2 };

class Game {
  constructor() {
    this.mode = 'title';
    this.time = 0;
  }

  async init() {
    const DATA = JSON.parse(document.getElementById('campus-data').textContent);
    const canvas = document.getElementById('c');
    this.progress = new Progress(this);
    this.ui = new UI(this);
    this.input = new Input(canvas);
    this.audio = new SoundEngine();
    this.audio.volume = this.progress.settings.volume ?? 0.8;
    Object.assign(this.audio.vol, this.progress.settings.vol || {});
    this.audio.muted = !!this.progress.settings.muted;
    this.audio.subtitles = this.progress.settings.subtitles ?? true;
    this.audio.onSubtitle = (t) => this.ui.subtitle(t);
    this.music = new Music(this.audio);
    this.input.remap = { ...(this.progress.settings.keys || {}) };
    const quality = this.progress.settings.quality || 'medium';
    this.quality = quality;
    const step = async (f, msg) => { this.ui.loading(f, msg); await nextFrame(); };

    await step(0.04, 'Starting the renderer…');
    // alpha: the canvas is see-through only where a video screen is (the YouTube player sits behind it)
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'low', powerPreference: 'high-performance', alpha: true }));
    renderer.setClearAlpha(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.6;
    renderer.shadowMap.enabled = quality !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.progress.settings.fov || 62, 1, 0.1, 22000);
    this.fill = new THREE.DirectionalLight(0xfff1e0, 0.35);
    this.fill.position.set(0.4, 0.6, 1);
    this.camera.add(this.fill, this.fill.target);
    this.fill.target.position.set(0, 0, -1);
    this.scene.add(this.camera);
    this.resize();
    window.addEventListener('resize', () => this.resize());

    await step(0.1, 'Reading the campus map (OpenStreetMap + Overture)…');
    // two courts of each sport (tennis, basketball, volleyball) are enough
    this.quartersRemoved = dropQuartersOnGrounds(DATA);       // no staff quarters on the playgrounds
    this.wallFit = fitBuildingsToWall(DATA);                    // buildings that crossed the campus wall are trimmed to the inside of it
    { const kv = DATA.gates.find((q) => q.name === 'KV Gate'), au = DATA.landmarks.find((l) => l.id === 'auditorium');
      this.quartersRemoved += dropQuartersNear(DATA, [...(kv ? [[kv.x, kv.y, 38]] : []), ...(au ? [[au.x, au.y, 45]] : [])]); }
    const pruned = pruneCourts(DATA.fields);
    DATA.fields = pruned.fields;
    // the Rhino Circle: the road in from the Main Gate goes round a roundabout island
    // ... and, from the campus master plan, roundabouts at three more junctions
    this.islands = [];
    // ... and the circle by the academic lake (the junction nearest its shore): a roundabout with an island of flowers, no statue
    const lj = lakeJunction(DATA);
    const circles = lj ? [...PLAN.roundabouts, { x: lj.x, y: lj.y, island: 5.5, name: 'Lake Circle', flowers: true }] : PLAN.roundabouts;
    for (const c of planCircles(DATA, circles)) {
      const r = addRoundabout(DATA, c.x, c.y, c.R, c.kind, c.w, c.name);
      this.islands.push({ x: c.x, z: -c.y, r, ang: c.ang, name: c.name, rhino: !!c.rhino, flowers: !!c.flowers, R: c.R, w: c.w });
    }
    this.rhinoAt = this.islands.find((i) => i.rhino) || null;
    if (!this.rhinoAt) { const rs = rhinoSpot(DATA); if (rs) { this.rhinoAt = { x: rs.x, z: -rs.y, ang: rs.ang, r: addRoundabout(DATA, rs.x, rs.y, 16, rs.kind, Math.min(8, rs.w || 7), 'Rhino Circle'), rhino: true, name: 'Rhino Circle' }; this.islands.push(this.rhinoAt); } }
    this.world = new World(DATA);
    this.world.islands = this.islands;
    this.env = this.world;
    this.planFacts = applyPlan(this.world);          // staff-quarter types, post office, treatment plants...
    this.graph = new RoadGraph(DATA.graph);
    this.dualInfo = planDualRoads(this.world, this.graph);     // the main roads with room become two-lane roads with a median and cycle lanes
    this.roadInfo = this.graph.classify(this.world);
    this.placer = makePlacer(this.world, this.graph);      // where things may stand: off every road and path, off each other
    planLawns(this.world);                                  // the mown lawns in front of the big buildings
    this.avoid = new Avoid(this);
    this.outside = buildOutside(this);
    this.scene.add(this.outside.group);
    const [groundImg, mask] = await Promise.all([loadImage(window.__GROUND__), loadImage(window.__MASK__)]);
    const ground0 = pruned.removed.length ? paintOverCourts(groundImg, DATA.ground.bounds, pruned.removed) : groundImg;
    const ground = paintLawns(ground0, DATA.ground.bounds, this.world.lawns || []);      // the lawns: bright, mown
    this.ui.prepareMaps(ground);

    await step(0.18, 'Raising the hills (SRTM elevation)…');
    this.terrain = buildTerrain(this.world, ground, mask);
    this.scene.add(this.terrain.group);
    await step(0.28, `Constructing ${this.world.buildings.length} buildings…`);
    planMurals(this.world, this.graph);           // walls kept plain for the murals (painted in signage)
    raiseAcademicFloor(this.world);                       // the Academic Complex stands on a podium: a grand flight of steps (scene/acfront.js) leads up to it
    this.buildings = buildBuildings(this.world);
    this.scene.add(this.buildings.group);
    await step(0.38, 'Laying roads and footpaths…');
    this.scene.add(buildRoads(this.world, this.graph).group);
    this.dualRoads = buildDualRoads(this);
    this.scene.add(this.dualRoads.group);
    this.water = buildWater(this.world);
    this.scene.add(this.water.group);
    this.splash = new SplashFX(this.scene);
    await step(0.46, 'Planting trees where the satellites see them (ESA WorldCover)…');
    this.school = planSchool(this.world, this.graph);
    // the flag lawn in front of the Administrative Building: open lawn, no trees
    {
      const adm = this.world.site('admin');
      if (adm) {
        // Centre of the existing circular footpath (OSM graph nodes 43/44/45),
        // east of Admin. The entrance normal points at the side driveway instead.
        const x = -133.55, z = -68.9;
        this.world.flagSpot = { x, z, nx: adm.nx, nz: adm.nz };
        (this.world.clearings ||= []).push({ x, z, r: 15.5 });
      }
    }
    // no trees growing through the "IITG" letter signs (lakefront and auditorium) or on the Rhino Circle
    for (const I of this.islands) (this.world.clearings ||= []).push({ x: I.x, z: I.z, r: I.r + 1.5 });
    for (const sp of Object.values(letterSpots(this.world))) (this.world.clearings ||= []).push({ x: sp.x, z: sp.z, r: 11 });
    // courts and pitches: no trees on them (grass is kept off them too)
    this.world.sportsAreas = sportsAreas(this.world);
    for (const a of this.world.sportsAreas) (this.world.clearings ||= []).push({ x: a.cx, z: a.cz, r: 0, area: a });
    this.world.fenceOutlines = fenceOutlines(this.world);
    // the View Point: a railing round the top, walk-in gates only (no cycles), a register at the entry
    { const vp = this.world.landmark('viewpoint'); if (vp) { const ring = []; for (let k = 0; k < 32; k++) { const a = (k / 32) * Math.PI * 2; ring.push([vp.wx + Math.cos(a) * 26, vp.wz + Math.sin(a) * 26]); } this.world.fenceOutlines.push({ f: { kind: 'viewpoint', cx: vp.wx, cz: vp.wz }, ring, h: 1.1, style: 'rail', vp: true }); } }
    planPool(this.world);                          // the swimming pool's wall and paving (before the paths are marked)
    this.roadInfo.courtPaths = this.graph.markCourts(this.world.fenceOutlines);
    // keep the play area of the Children's Park open
    for (const f of this.world.fields) if (f.kind === 'park' && /Children/i.test(f.name || '')) (this.world.clearings ||= []).push({ x: f.cx, z: f.cz, r: Math.min(f.len || 40, f.wid || 30) / 2 + 4 });
    // every gate has a clear paved apron (the Main Gate's reaches 30 m in, 26 m out, 15 m to each side)
    for (const gt of this.world.gates) {
      if (gt.closed) continue;
      const ox = Math.cos(gt.angle), oz = -Math.sin(gt.angle);
      const a = gt.main ? { cx: gt.wx - ox * 2, cz: gt.wz - oz * 2, ax: ox, az: oz, hl: 30, hw: 17 } : { cx: gt.wx, cz: gt.wz, ax: ox, az: oz, hl: 14, hw: 10 };
      (this.world.clearings ||= []).push({ x: a.cx, z: a.cz, r: 0, area: a });
    }
    // the bus stands (from the master plan) keep a little clearing too
    this.busStandSpots = planBusStands(this.world, this.graph);
    for (const s of this.busStandSpots) (this.world.clearings ||= []).push({ x: s.x, z: s.z, r: 5 });
    planLakeCircle(this.world, this.graph, this.busStandSpots);   // the air-quality board, the guard's booth and the duck house at the lake circle
    // the IITG Bus Stop (its stand, platform and buses) and the old cricket ground, now the Technology Park: no random trees
    { const bs = this.world.landmark('busstop'), tp = this.world.landmark('techpark');
      if (bs) (this.world.clearings ||= []).push({ x: bs.wx, z: bs.wz - 6, r: 0, area: { cx: bs.wx, cz: bs.wz - 6, ax: 1, az: 0, hl: 52, hw: 19 } });
      if (tp) (this.world.clearings ||= []).push({ x: tp.wx, z: tp.wz - 50, r: 0, area: { cx: 784, cz: tp.wz - 50, ax: 1, az: 0, hl: 62, hw: 72 } }); }
    // the Director's Bungalow and its walled garden (scene/bungalow.js): no random trees inside it (it has its own fruit trees)
    { const bb = this.world.buildings.filter((q) => q.area > 150 && Math.hypot((q.x0 + q.x1) / 2 + 160, (q.z0 + q.z1) / 2 + 318) < 30).sort((p, q) => q.area - p.area)[0];
      if (bb) (this.world.clearings ||= []).push({ x: (bb.x0 + bb.x1) / 2, z: (bb.z0 + bb.z1) / 2, r: 46 }); }
    designLawns(this);                                       // shrubs, Ashoka rows, a big tree and a pine on each lawn (clears the random trees off them)
    this.lakeForest = planLakeForest(this.world, this.graph, this);   // the forest round the IITG Lake
    this.hillForest = planHillForest(this.world, this.graph);       // the dense forest on the View Point hill, round its winding foot trail
    this.veg = buildVegetation(this.world, quality, this.graph);
    this.scene.add(this.veg.group);
    this.scene.add(buildLawnShrubs(this).group);
    this.grass = buildGrass(this.world, ground, this.terrain.map, quality, this.graph);
    if (this.grass) this.scene.add(this.grass.mesh);
    await step(0.56, 'Street lamps, gates, chai stalls and the market…');
    this.props = buildProps(this.world, this.graph);
    this.scene.add(this.props.group);
    this.stallsObj = buildStalls(this.world, this.graph);
    this.scene.add(this.stallsObj.group);
    this.props.stalls = this.stallsObj.stalls;
    this.landmarksObj = buildLandmarks(this);
    this.acFront = buildAcademicFront(this);
    this.islandsObj = buildIslands(this);
    this.scene.add(this.islandsObj.group);
    this.scene.add(this.landmarksObj.group);
    this.courts = buildCourts(this);
    this.scene.add(this.courts.group);
    await step(0.62, 'Lighting the sky over the Brahmaputra…');
    this.sky = buildSky(renderer, this.scene, quality);
    this.clock = new CampusClock(this.progress.clock || {});
    if (!this.progress.clock && !(this.clock.hour > 6 && this.clock.hour < 17.2)) this.clock.hour = 8.4;
    this.weather = new Weather(this, quality);
    this.sky.setWeather(this.weather.state);
    this.sky.setHour(this.clock.hour);
    await step(0.68, 'Waking up the campus…');
    const shadows = quality !== 'low';
    this.crowd = new CrowdRenderer(this.scene, { shadows, nearDist: quality === 'high' ? 55 : 40, maxDist: quality === 'low' ? 220 : 340, nearCap: 760, farCap: 3400 });
    this.bikesR = new BikeRenderer(this.scene, this.crowd.pal, 900, shadows);
    this.animalsR = new AnimalRenderer(this.scene, shadows);
    this.interact = new Interactions(this);
    this.activity = new ActivityManager(this);
    this.acts = new ActivityRegistry(this);
    await step(0.74, 'Getting you ready (and your bicycle)…');
    this.player = new Player(this, this.progress.look || DEFAULT_LOOK);
    this.bike = new BikeRide(this);
    this.busTour = new BusTour(this);
    this.tour = new CampusTour(this);
    this.drone = new DroneMode(this);
    this.guide = new RouteGuide(this);
    this.bikeTour = new BikeTour(this, this.guide);
    this.challengeRun = new LateForClass(this, this.guide);
    this.drive = new Drive(this);
    this.boats = new Boats(this);
    this.capture = new Capture(this);
    this.screens = new Screens(this);
    // the Computer Centre (beside the Central Library): its own interior with PCs you can use
    { const cc = this.world.pois.find((q) => /Computer Centre/i.test(q.name)); let b = cc && this.world.buildingAt(cc.wx, cc.wz);
      if (cc && !b) b = this.world.buildingsNear(cc.wx, cc.wz).filter((q) => q.area > 80).sort((a, c) => Math.hypot((a.x0 + a.x1) / 2 - cc.wx, (a.z0 + a.z1) / 2 - cc.wz) - Math.hypot((c.x0 + c.x1) / 2 - cc.wx, (c.z0 + c.z1) / 2 - cc.wz))[0];
      // on the map the Computer Centre sits inside the Central Library's complex: then the library stays
      // the library and the Computer Centre has its own door on the far side, with a board over it
      if (b && !b.site) { b.computerCentre = true; b.display = 'Computer Centre'; this.computerCentre = b; }
      else if (b) this.computerCentre = buildSideDoor(this, b, 'COMPUTER CENTRE', 'Computer Centre', 'computer'); }
    this.interiors = this.interior = new Interiors(this);
    this.onestop = new OneStop(this);             // the campus entry app, its QR machines and the automatic gates (added below, built at the end)
    this.lakeside = buildLakeside(this);          // lotus in the lakes, reeds, the IITG Lake's railing, benches and trees
    this.poolObj = buildPool(this);               // the swimming pool complex (its doors and showers are interactive)
    // two places that are easy to miss get an entrance arch, a guard, a roadside signboard and a map marker
    if (this.computerCentre?.b) { const c = this.computerCentre; markPlace(this, { id: 'computercentre', name: 'Computer Centre', kind: 'academic', desc: 'The Computer Centre: rows of PCs with internet, a printing desk and a help desk, in the Central Library complex. Its glass door is round the side of the library building.', door: { x: c.x, z: c.z, yaw: c.yaw }, color: '#1f3a5f', sub: 'PCs · Internet · Printing' }); }
    // (the café is just the pavilion: a landmark on the map and in the journal, with no gateway, no guard and no machine)
    { const cafe = (this.stallsObj?.stalls || []).find((q) => q.name === 'Cafe Coffee Day'); if (cafe && !this.world.landmark('campuscafe')) { const y = this.world.heightAt(cafe.x, cafe.z); this.world.landmarks.push({ id: 'campuscafe', name: 'Cafe Coffee Day', kind: 'food', desc: 'The coffee and snacks café on the lawn by the library complex: cold coffee, sandwiches and outdoor tables under umbrellas.', x: cafe.x, y: -cafe.z, z: y + 30, wx: cafe.x, wz: cafe.z, wy: y }); } }
    await step(0.8, 'Students heading to class…');
    this.traffic = new Traffic(this);
    this.venues = new Venues(this);
    // not a headcount of the real ~8000: just enough students (and the staff that go with them) for the
    // campus to look naturally busy, with most people indoors at any time
    const pop = { low: 1800, medium: 2400, high: 2800 }[quality] || 2400;
    const crowdK = this.progress.settings.crowd ?? 1;
    this.life = new CampusLife(this, Math.round(pop * crowdK));
    this.street = new StreetLife(this, Math.round(({ low: 48, medium: 72, high: 96 }[quality] || 72) * crowdK));
    this.hood = new Neighbourhood(this, this.school);
    this.couples = new LakeCouples(this);          // after dark: couples by the IITG Lake and the Serpentine
    this.knock = new Knockables(this);
    this.doors = buildDoors(this);                 // an entrance on every building: doors, canopies, steps, name boards
    this.signage = buildSignage(this);
    // traffic cones round the construction site (none on any road)
    if (this.street.site) { const s = this.street.site; for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; const x = s.x + Math.cos(a) * 11, z = s.z + Math.sin(a) * 9; if (!this.world.buildingAt(x, z)) this.knock.add('cone', x, z, a); } }
    seedKnockables(this);                                    // pots at the doors, boards at the entrances, footballs to kick
    this.knock.build();
    this.techPark = buildTechPark(this);                       // the plaza of the Technology Park (on the old east cricket ground)
    this.scene.add(this.techPark.group);
    this.busTerminus = buildBusTerminus(this);                 // the IITG Bus Stop: where every campus bus starts
    this.scene.add(this.busTerminus.group);
    this.hillTrail = buildHillTrail(this);                     // the fenced foot-only corridor, the board at its foot, the distance posts
    this.scene.add(this.hillTrail.group);
    this.viewpoint = buildViewpoint(this);
    this.scene.add(this.viewpoint.group);
    this.bungalow = buildBungalow(this);
    this.onestop.build();                         // every machine, gate and door has been asked for by now
    this.boardsTwoSided = makeBoardsTwoSided(this.scene);   // every upright board reads the right way round from both sides
    this.scene.add(this.bungalow.group);
    this.scene.add(this.signage.group);
    this.cycleShops = buildCycleShops(this);
    this.polish = new Polish(this);
    this.festive = buildFestive(this);
    this.infra = buildInfrastructure(this);
    this.transport = new Transport(this);
    this.commute = new Commuters(this, Math.round(({ low: 48, medium: 72, high: 96 }[quality] || 72) * crowdK));
    this.clock.onJump(() => { this.life.reset(); this.weather.pick(false); });
    await step(0.86, 'Setting up matches, fests and wildlife…');
    this.sports = new Sports(this);
    this.events = new EventManager(this);
    this.jobs = new Jobs(this);
    this.wildlife = new Wildlife(this, this.animalsR);
    this.postfx = new PostFX(renderer, this.scene, this.camera, quality);
    this.postfx.keepOutOfAO(this.crowd.group, this.bikesR.mesh, ...Object.values(this.animalsR.species).map((s) => s.mesh), ...(this.grass ? [this.grass.mesh] : []));
    await step(0.94, 'Planning the campus bus route…');
    this.busTour.plan();
    this.venues.addBusStops?.(this.busTour.stopSpots?.() || []);
    this.busStops = buildBusStops(this, this.busStandSpots);
    this.spawnPoint();
    this.mess = new MessPlayer(this);                // your side of the hostel mess: pay, plate, serving counter, eating
    this.gameGuide = new GameGuide(this);          // the Game Guide (F1) and the Info panel (I)
    this.ui.wire();
    this.gameGuide.wire();
    this.ui.applyAccess();
    this.bindUI();
    this.bindBikes();

    await step(0.97, 'Getting the graphics ready…');
    this.prewarm();
    // what never moves does not need its matrices worked out again every frame (about four thousand objects: the trees alone are eighteen hundred)
    this.scene.updateMatrixWorld(true);
    for (const c of this.scene.children) if (['trees', 'buildings', 'roads', 'dual-roads', 'terrain', 'outside', 'lawn-shrubs', 'lakeside', 'islands'].includes(c.name)) c.traverse((o) => { o.matrixAutoUpdate = false; });
    this.drawDist = new DrawDist(this.scene);               // small static things beyond their distance are not drawn (a few hundred draw calls in the open)

    const roadKm = DATA.roads.reduce((s, r) => s + r.pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - r.pts[i - 1][0], p[1] - r.pts[i - 1][1]) : 0), 0), 0) / 1000;
    this.ui.ready([
      [DATA.meta.areaHa, 'hectares'], [this.world.buildings.length, 'buildings'], [(this.veg.count / 1000).toFixed(1) + 'k', 'trees'], [this.life.people.length + this.street.people.length, 'people'],
    ]);
    void roadKm;
    this.center = new THREE.Vector3((this.world.bbox.x0 + this.world.bbox.x1) / 2, 40, (this.world.bbox.z0 + this.world.bbox.z1) / 2);
    this.last = performance.now();
    renderer.setAnimationLoop(() => this.frame());
    window.__game = this;
    // title music: browsers only allow sound after a click or a key press on the page
    const titleMusic = () => { if (this.mode !== 'title') return; this.audio.start(); this.audio.setVolume(this.audio.volume); this.music.play('title'); };
    window.addEventListener('pointerdown', titleMusic, { once: true });
    window.addEventListener('keydown', titleMusic, { once: true });
    const mb = document.getElementById('music-btn');
    if (mb) mb.onclick = (e) => { e.stopPropagation(); this.audio.start(); if (this.music.theme === 'title') { this.music.play(null); mb.textContent = '♪ Title music'; } else { this.music.play('title'); mb.textContent = '♪ Music on'; } };
  }

  /** the frame-rate counter of the Display settings: every half second, frames per second, the average and worst frame time, and how far the detail has been cut */
  fpsMeter(raw) {
    const on = !!this.progress.settings.fps;
    if (on !== this._fpsOn) { this._fpsOn = on; this.ui.fpsText(on ? 'measuring…' : null); }
    if (!on || raw > 1000) return;
    this._fpsN = (this._fpsN || 0) + 1; this._fpsT = (this._fpsT || 0) + raw; this._fpsMax = Math.max(this._fpsMax || 0, raw);
    if (this._fpsT < 500) return;
    const ms = this._fpsT / this._fpsN;
    this.ui.fpsText(`${Math.round(1000 / ms)} fps · ${ms.toFixed(1)} ms a frame · worst ${Math.round(this._fpsMax)} ms · detail ${Math.round((this.geoScale ?? 1) * 100)}% · sharpness ${Math.round((this.resScale ?? 1) * 100)}%`);
    this._fpsN = this._fpsT = this._fpsMax = 0;
  }

  /** draw everything once, with everything switched on, behind the loading screen: every shader is compiled and every buffer is uploaded now, so
   *  nothing hitches the first time it comes into view (a new shader compiling used to cost 40 ms in the middle of a walk) */
  prewarm() {
    const saved = [];
    try {
      this.scene.traverse((o) => { if (o.isMesh || o.isLine || o.isPoints) { saved.push([o, o.visible, o.frustumCulled, o.layers.mask]); o.visible = true; o.frustumCulled = false; o.layers.mask = 1; } });
      this.camera.position.set(this.player.pos.x, this.player.pos.y + 3, this.player.pos.z);
      this.camera.updateMatrixWorld();
      this.postfx.render(0);
    } catch (e) { console.warn('prewarm', e); }
    finally { for (const [o, v, f, m] of saved) { o.visible = v; o.frustumCulled = f; o.layers.mask = m; } }
  }

  /** the render resolution follows the machine: if the frames keep coming in slower than ~45 fps the picture is drawn at a lower
   *  resolution (down to 55 %) so the frame rate stays even instead of stuttering; it never climbs back past the level that was too much */
  adaptRes(raw) {
    if (raw > 120 || !this.postfx || this.mode === 'loading') return;                    // a hitch (loading, a tab switch) is not a measurement
    this._ema = (this._ema ?? 16.7) * 0.96 + raw * 0.04;
    this._adaptT = (this._adaptT || 0) + raw;
    const slow = this._ema > 33;                       // far too slow: react faster and in bigger steps
    if (this._adaptT < (slow ? 1200 : 2500)) return;
    this._adaptT = 0;
    const s = this.resScale ?? 1, ceil = this.resCeil ?? 1, geo = this.geoScale ?? 1;
    const setGeo = (v) => { this.geoScale = +v.toFixed(3); if (this.veg) this.veg.bias = this.geoScale; if (this.drawDist) this.drawDist.bias = this.geoScale; };
    if (this._ema > 22 && geo > 0.55) { setGeo(Math.max(0.55, geo * (slow ? 0.8 : 0.88))); this._calm = 0; }                       // draw things nearer first: nobody sees the difference
    else if (this._ema > 22 && s > 0.55) { this.resCeil = Math.min(ceil, +(s * 0.93).toFixed(3)); this.resScale = Math.max(0.55, +(s * 0.86).toFixed(3)); this._calm = 0; this.resize(); }
    else if (this._ema < 17.4 && (s < ceil || geo < 1)) {
      if (++this._calm >= 12) { this._calm = 0; if (s < ceil) { this.resScale = Math.min(ceil, +(s * 1.08).toFixed(3)); this.resize(); } else setGeo(Math.min(1, geo * 1.1)); }
    }
    else this._calm = 0;
  }

  resize() {
    const q = this.progress.settings.quality || 'medium';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'medium' ? 1.25 : 1) * (this.resScale ?? 1));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    if (this.ui) this.ui.tapeW = 0;
    if (this.postfx) this.postfx.resize();
  }

  applyQuality(q) {
    this.progress.settings.quality = q;
    this.progress.save();
    this.ui.toast('Reloading with the new graphics setting…', 'info');
    setTimeout(() => location.reload(), 400);
  }

  /** put the player just outside a hostel's door, looking at it (the hostel chosen in OneStop) */
  spawnAtHostel(lm = this.progress.profile.hostel) {
    const s = this.world.site(lm);
    if (!s) return false;
    let x = s.ex + s.nx * 6.5, z = s.ez + s.nz * 6.5;
    if (!this.world.insideCampus(x, z) || this.world.buildingAt(x, z)) { x = s.ex + s.nx * 3.5; z = s.ez + s.nz * 3.5; }
    const n = this.graph.nearestOnNetwork(x, z, FILTERS.walk);
    if (n && n.d < 10) { x = n.x; z = n.z; }
    const yaw = Math.atan2(s.ex - x, s.ez - z);
    this.player.spawn(x, z, yaw); this.player.camYaw = yaw;
    return true;
  }

  spawnPoint() {
    // OneStop is set up: the game starts outside your hostel
    if (this.progress.profile.setup && this.spawnAtHostel()) return;
    // first time here: arrive through the Main Gate like every new student
    const mg = this.world.gates.find((g) => g.main);
    if (mg && !this.progress.flags?.onboarded) {
      const cx = (this.world.bbox.x0 + this.world.bbox.x1) / 2, cz = (this.world.bbox.z0 + this.world.bbox.z1) / 2;
      let x = mg.wx, z = mg.wz;
      for (let k = 0; k < 20 && (!this.world.insideCampus(x, z) || this.world.distToBoundary(x, z) < 14); k++) { const dx = cx - x, dz = cz - z, L = Math.hypot(dx, dz) || 1; x += (dx / L) * 3; z += (dz / L) * 3; }
      const n = this.graph.nearestOnNetwork(x, z, FILTERS.walk);
      if (n) { x = n.x; z = n.z; }
      const rh = this.world.landmark('rhino');
      const yaw = rh ? Math.atan2(rh.wx - x, rh.wz - z) : Math.atan2(cx - x, cz - z);
      this.player.spawn(x, z, yaw); this.player.camYaw = yaw;
      return;
    }
    // coming back: continue where you left off
    const lp = this.progress.lastPos;
    if (lp && this.world.insideCampus(lp[0], lp[1])) { this.player.spawn(lp[0], lp[1], lp[2] || 0); this.player.camYaw = lp[2] || 0; return; }
    const admin = this.world.landmarks.find((l) => l.id === 'admin') || this.world.landmarks[0];
    const near = this.graph.nearestOnNetwork(admin.wx, admin.wz);
    const dx = admin.wx - near.x, dz = admin.wz - near.z, L = Math.hypot(dx, dz) || 1;
    const x = near.x - (dx / L) * 5, z = near.z - (dz / L) * 5;
    this.player.spawn(x, z, Math.atan2(dx, dz));
    this.player.camYaw = Math.atan2(dx, dz);
  }

  bindUI() {
    document.querySelectorAll('[data-start]').forEach((b) => (b.onclick = () => this.start(b.dataset.start)));
    document.getElementById('b-pass').onclick = () => this.onestop.open('profile');
    window.addEventListener('keydown', (e) => {
      if (this.mode === 'title' && e.code === 'Enter' && !document.getElementById('menu').hidden && !this.onestop?.isOpen()) this.start('walk');
      if (e.code === 'KeyO' && this.mode === 'title' && !document.getElementById('menu').hidden && !this.onestop?.isOpen() && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) this.onestop.open('profile');
      if (e.code === 'F1') { e.preventDefault(); if (!document.getElementById('guide').hidden) this.ui.closeAll(); else if (this.mode !== 'title' || !document.getElementById('menu').hidden) this.gameGuide.open(this.mode !== 'title' && this.gameGuide.infoOpen ? this.gameGuide.last?.id : undefined); }
      if (e.code === 'Escape' && this.mode === 'title' && this.onestop?.isOpen()) { this.onestop.close(); return; }     // the OneStop form on the title screen
      if (e.code === 'KeyU' && this.screens?.cur) this.screens.unmute();
      if (e.code === 'Escape' && this.mode !== 'title') {
        if (this.activity.active) {
          if (!this.ui.pressActKey('Escape') && this.activity.cur.cancelable !== false) this.activity.stop(true);
          return;
        }
        if (this.mode === 'camera') { this.setMode('walk'); return; }
        if (this.ui.anyOpen()) this.ui.closeAll();
        else if (!this.input.locked) { this.ui.openPause(); this.input.exitLock(); }
      }
    });
  }

  /** borrow any parked bicycle from a cycle stand */
  /** a student cycling past: ask to ride on the carrier */
  cyclistNear(x, z) {
    let best = null, bd = 3.2;
    for (const p of this.life.travelers) { if (p.mode !== 'bike' || p.partner) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
    for (const p of this.street.people) { if (!p.out || p.bike == null || p.lead || p.friends) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  startLift(p) {
    this.lift = { p, t: 0 };
    p.pauseT = 1.2;
    p.pillionYou = true;
    this.setMode('lift');
    this.ui.toast('"Hop on! Where are you headed?" Ride along on the carrier. E to get off.', 'info', 'Got a lift');
  }

  /** get out of whatever you are in (the E key and the Get off button): one way out for every vehicle, and it always works */
  getOut() {
    const m = this.mode;
    if (m === 'ride') { if (this.transport.ride) this.transport.endRide(); else this.setMode('walk'); }
    else if (m === 'drive') {
      if (Math.abs(this.drive.speed) < 3) this.setMode('walk');
      else if (!this.drive.exiting) { this.drive.exiting = true; this.ui.toast('Braking to a stop. You get out as soon as the vehicle stops.', 'info', 'Vehicle'); }
    }
    else if (m === 'boat') this.boats.getOut();
    else if (m === 'lift') this.endLift('"Bye! See you around."');
    else if (m === 'bike' || m === 'bus' || m === 'tour') this.setMode('walk');
  }

  endLift(msg) {
    const L = this.lift;
    if (!L) return;
    this.lift = null;
    L.p.pillionYou = false;
    if (this.mode === 'lift') this.setMode('walk');
    const p = L.p, yaw = p.yaw || 0;
    this.player.spawn(p.x + Math.cos(yaw) * 1.2, p.z - Math.sin(yaw) * 1.2, yaw);
    if (msg) this.ui.toast(msg, 'info');
  }

  bindBikes() {
    // ask a cyclist for a lift on the carrier
    this.interact.provider((pos, inside) => {
      if (inside || this.mode !== 'walk' || this.activity.active) return null;
      const p = this.cyclistNear(pos.x, pos.z);
      if (!p) return null;
      return [{ x: p.x, z: p.z, r: 3.2, prio: 0.1, label: 'Ask for a lift on the carrier', run: () => this.startLift(p) }];
    });
    // your delivery rider at the hostel gate
    this.interact.provider((pos, inside) => {
      if (inside || this.mode !== 'walk') return null;
      const v = this.transport.myOrder;
      if (!v || !v.atStop) return null;
      const p = v.model.group.position;
      return [{ x: p.x, z: p.z, r: 3.5, prio: 1, label: `Collect your ${v.order.item} from the ${v.order.brand} rider`, run: () => this.transport.collect(v) }];
    });
    // feed a dog or a cat
    this.interact.provider((pos, inside) => {
      if (inside || this.mode !== 'walk' || this.activity.active) return null;
      const a = this.wildlife.feedable(pos.x, pos.z);
      if (!a) return null;
      return [{ x: a.x, z: a.z, r: 2.6, label: a.kind === 'dog' ? 'Feed the dog some biscuits · ₹10' : 'Give the cat a biscuit · ₹10', run: () => this.wildlife.feed(a) }];
    });
    // sit on any bench, at a café table, or on the grass with a circle of friends
    const V = this.venues;
    this.seatSpots = [...V.benches, ...V.chai.filter((s) => s.seat), ...(V.circles || []), ...(this.hood.seatsOut || []), ...(this.lakeside?.seats || [])];      // benches, café chairs, the grass circles, and every other chair (porches, guard booths, the lifeguard's)
    this.interact.provider((pos, inside) => {
      if (inside || this.mode !== 'walk' || this.activity.active) return null;
      let best = null, bd = 1.4;
      for (const s of this.seatSpots) {
        if (Math.abs(s.x - pos.x) > 1.4 || Math.abs(s.z - pos.z) > 1.4 || (s.taken && s.taken !== 'player')) continue;
        if (s.chair && this.hood.people.some((p) => p.visible && Math.hypot(p.x - s.x, p.z - s.z) < 0.6)) continue;      // somebody is sitting on it
        const d = Math.hypot(s.x - pos.x, s.z - pos.z);
        if (d < bd) { bd = d; best = s; }
      }
      if (!best) return null;
      const s = best;
      return [{ x: s.x, z: s.z, r: 1.4, prio: 0.2, label: s.circle ? 'Sit down with them on the grass' : s.seat ? 'Take a seat' : 'Sit on the bench', run: () => { s.taken = 'player'; this.acts.run('sit', { seat: { x: s.x, y: this.world.heightAt(s.x, s.z), z: s.z, yaw: s.yaw }, interior: null, spot: s, ground: !!s.circle }); } }];
    });
    // climb the stands at the grounds and watch
    this.interact.provider((pos, inside) => {
      if (inside || this.mode !== 'walk' || this.activity.active) return null;
      for (const st of this.courts.stands) {
        if (Math.hypot(st.cx - pos.x, st.cz - pos.z) > 45) continue;
        let best = null, bd = 2.4;
        for (const s of st.seats) { if (s.row !== 0) continue; const d = Math.hypot(s.x - pos.x, s.z - pos.z); if (d < bd) { bd = d; best = s; } }
        if (!best) continue;
        const up = st.seats.filter((s) => s.row === 3 || s.row === 2).sort((a, b) => Math.hypot(a.x - best.x, a.z - best.z) - Math.hypot(b.x - best.x, b.z - best.z))[0] || best;
        return [{ x: best.x, z: best.z, r: 2.4, prio: 0.3, label: 'Climb the stands and watch', run: () => this.acts.run('sit', { seat: { x: up.x, y: up.y, z: up.z, yaw: up.yaw }, interior: null }) }];
      }
      return null;
    });
    // hop into an e-rickshaw, a campus buggy, an auto or a taxi that has stopped
    this.interact.provider((pos, inside) => {
      if (inside || this.mode !== 'walk') return null;
      const v = this.transport.liftNear(pos.x, pos.z);
      if (!v) return null;
      const p = v.model.group.position;
      const fare = `₹${rideFare(v)}`;
      const what = { erick: `Hop into the e-rickshaw · ${fare}`, buggy: 'Ride the campus buggy · free', auto: `Take the auto · ${fare}`, taxi: v.state === 'out' ? `Take the taxi home · ${fare}` : `Ask the taxi for a ride · ${fare}` }[v.kind];
      return [{ x: p.x, z: p.z, r: 4.5, label: what, run: () => this.transport.startRide(v) }];
    });
    this.interact.provider((pos, inside) => {
      if (inside || this.mode !== 'walk') return null;
      const pb = this.props.nearestParked(pos.x, pos.z, 2.0);
      if (!pb) return null;
      return [{ x: pb.x, z: pb.z, r: 1.6, prio: -0.6, label: 'Borrow this bicycle from the stand', run: () => this.bike.borrow(pb) }];
    });
  }

  /** the game begins: first time, with the OneStop form (name, hostel, roll no., room); the game then starts outside your hostel */
  start(what) {
    if (this.onestop?.busy) return;
    if (!this.progress.profile.setup && !this.progress.flags.passSkipped && this.mode === 'title') { this.onestop.openSetup(() => this.begin(what)); return; }
    this.begin(what);
  }
  begin(what) {
    this.audio.start();
    this.audio.setVolume(this.audio.volume);
    this.ui.showTitle(false);
    this.input.wantLock = !this.ui.touch;
    this.mode = 'walk';
    this.ui.setMode('walk');
    if (what === 'bus') this.setMode('bus');
    else if (what === 'tour') this.ui.openTourPick();
    else if (what === 'bike') this.startBikeTour();
    else if (what === 'drone') this.setMode('drone');
    else if (what === 'custom') this.setMode('custom');
    else if (what === 'planner') this.ui.openPlanner();
    else this.ui.toast(this.ui.touch ? 'Use the joystick to move and drag on the right to look around.' : 'Click the view to look around. Press E near doors, shops and people. Tab opens the campus planner.', 'info', 'Welcome to IIT Guwahati');
  }

  /** what should be playing: the title theme, calm music while exploring, tense music in a race */
  updateMusic(force = false) {
    if (!this.audio.ctx) return;
    const S = this.progress.settings;
    this.musicWant = this.pickMusic();
    const want = this.mode === 'title' ? 'title' : S.bgm === false ? null : this.musicWant;
    if (force || want !== this.music.theme) this.music.play(want);
  }

  /** what should be playing now: races and jobs are tense, matches get the quick Bihu tune, the
   *  Student Activity Centre rocks during dance practice, otherwise day / evening / night music
   *  (quiet indoors, where the halls have their own sound) */
  pickMusic() {
    const a = this.activity.cur, h = this.clock.hour;
    if (this.challengeRun?.active || this.jobs?.job) return 'tense';
    if (a && ['football', 'cricket', 'tennis', 'volleyball', 'hoops', 'sprint'].includes(a.name)) return 'sport';
    if (a && a.name === 'dance') return 'rock';
    if (this.interior?.active) {
      const k = this.interior.kind;
      if (k === 'sac' && h >= 17 && h < 21.5) return 'rock';
      if (k === 'gym' && (h < 9.5 || h >= 16.5)) return 'rock';
      if (k === 'library' || k === 'computer') return 'study';
      if (k === 'hostel' && mealNow(h)) return 'mess';
      return null;
    }
    if (this.weather.state.rain > 0.3 && h >= 5) return 'rain';
    if (h >= 5 && h < 9) return 'morning';
    return h >= 5 && h < 16.5 ? 'day' : h >= 16.5 && h < 19.5 ? 'evening' : 'night';
  }

  toTitle() {
    this.gameGuide?.hideInfo();
    this.activity.stop(true);
    if (this.interior.active) this.interior.exit();
    this.setMode('walk');
    this.mode = 'title';
    this.input.exitLock();
    this.ui.showTitle(true);
  }

  setMode(m) {
    const prev = this.mode;
    if (prev === m) return;
    if (prev === 'bike' && this.bike.riding) this.bike.dismount();
    if (prev === 'bus') this.busTour.stop();
    if (prev === 'tour') this.tour.stop();
    if (prev === 'ride' && this.transport.ride) this.transport.endRide();
    if (prev === 'lift' && this.lift) this.endLift();
    if (prev === 'drone' && this.drone.active) this.drone.finish();
    if (prev === 'drive' && this.drive.active) { this.drive.stop(); if (this.jobs.job) this.jobs.end('You left the vehicle. Shift ended.'); }
    if (prev === 'boat' && this.boats.active) this.boats.stop();
    if (prev === 'camera') this.capture.stopHandheld();
    if (prev === 'custom') this.player.avatar.root.visible = true;
    if (m !== 'bike' && this.challengeRun.active) this.challengeRun.stop();
    this.mode = m;
    this.player.avatar.J.head.visible = true;
    this.camera.userData.orbitInit = false;
    if (m === 'bike') this.bike.mount();
    if (m === 'bus') this.busTour.start();
    if (m === 'tour') this.tour.start();
    if (m === 'drone') this.drone.start();
    if (m === 'camera') this.capture.startHandheld();
    if (m === 'custom') {
      this.customPrev = 'walk';
      this.mode = 'custom';
      this.input.exitLock();
      this.customFixed = null;
      this.ui.openCustom();
    }
    this.ui.setMode(m === 'walk' && this.player.flying ? 'fly' : m);
    this.ui.crosshair(false);
    if (!['ride', 'lift', 'bike', 'drive', 'boat'].includes(m)) this.ui.getOutButton('');          // (the Get off button belongs to the vehicles)
  }

  endCustom() {
    if (this.mode === 'custom') { this.mode = 'walk'; this.ui.setMode('walk'); }
    this.progress.look = this.player.avatar.look;
    this.progress.save();
  }

  setLook(look) {
    // girls live in the girls' hostels (Subansiri, Dhansiri, Disang), boys in the others
    const was = this.player.avatar.look.body, pr = this.progress.profile;
    if (look.body && look.body !== was) {
      const girlsH = ['subansiri', 'dhansiri', 'disang'];
      if (look.body === 'female' && !girlsH.includes(pr.hostel)) { pr.hostel = 'subansiri'; this.ui.toast('Your hostel is now Subansiri Hostel.', 'info'); }
      if (look.body !== 'female' && girlsH.includes(pr.hostel)) { pr.hostel = 'brahmaputra'; this.ui.toast('Your hostel is now Brahmaputra Hostel.', 'info'); }
    }
    this.player.setLook(look);
    this.progress.look = this.player.avatar.look;
    this.progress.save();
    if (this.bike.bike && !this.bike.riding) { const vis = this.bike.bike.group.visible; this.bike.ensureBike(); if (vis) this.bike.placeParked(); }
  }

  /** the gym's locker room: change into gym wear and back (not saved: your own clothes come back) */
  toggleGymWear() {
    const look = this.player.avatar.look;
    if (this.swimSaved) { this.ui.toast('Change out of your swimwear first (the pool changing rooms).', 'warn', 'Locker room'); return; }
    if (this.gymSaved) { this.player.setLook(this.gymSaved); this.gymSaved = null; this.ui.toast('Back in your clothes. Your bag was in the locker.', 'info', 'Locker room'); return; }
    this.gymSaved = { ...look };
    this.player.setLook({ ...look, top: 'tshirt', topColor: '#2b3a55', bottom: look.body === 'female' ? 'leggings' : 'shorts', bottomColor: '#1c1c1c', shoes: 'running', shoesColor: '#f2f0ea', backpack: false, cap: false });
    this.ui.toast('Changed into gym wear: a T-shirt, shorts and running shoes.', 'info', 'Locker room');
  }

  /** campus tour: 'bus', 'walk', 'bike' or 'drone' */
  startTour(kind) {
    this.activity.stop(true);
    if (this.interior.active) { this.interior.exit().then(() => this.startTour(kind)); return; }
    if (this.bikeTour.active) this.bikeTour.stop();
    if (this.challengeRun.active) this.challengeRun.stop();
    this.setMode('walk');
    if (kind === 'bus') { this.setMode('bus'); return; }
    this.tour.prepare(kind);
    this.setMode('tour');
  }

  /** a taxi out of the Main Gate: home for a while, back the next morning */
  async goHome() {
    this.ui.fade?.(true);
    await new Promise((r) => setTimeout(r, 900));
    this.clock.skipTo(8.5);
    const mg = this.world.gates.find((g) => g.main) || this.world.gates[0];
    const n = this.graph.nearestOnNetwork(mg.wx, mg.wz);
    const cx = (this.world.bbox.x0 + this.world.bbox.x1) / 2, cz = (this.world.bbox.z0 + this.world.bbox.z1) / 2;
    let x = n ? n.x : mg.wx, z = n ? n.z : mg.wz;
    for (let k = 0; k < 30 && !this.world.insideCampus(x, z); k++) { const dx = cx - x, dz = cz - z, L = Math.hypot(dx, dz) || 1; x += (dx / L) * 3; z += (dz / L) * 3; }
    this.player.spawn(x + (cx - x) * 0.01, z + (cz - z) * 0.01, Math.atan2(cx - x, cz - z));
    this.progress.eat?.(40, 'home food');
    this.ui.fade?.(false);
    this.ui.toast('You spent the night at home. The taxi has brought you back to the Main Gate.', 'info', 'Back on campus');
  }

  startBikeTour() {
    if (this.bikeTour.active) { this.bikeTour.stop('Bicycle tour ended'); return; }
    if (this.challengeRun.active) this.challengeRun.stop();
    if (this.mode !== 'bike') this.setMode('walk'), this.setMode('bike');
    this.bikeTour.start();
  }

  startChallenge() {
    if (this.bikeTour.active) this.bikeTour.stop();
    if (this.mode !== 'bike') this.setMode('walk'), this.setMode('bike');
    this.challengeRun.start();
  }

  async fastTravel(x, z, snap = false) {
    this.activity.stop(true);
    if (this.interior.active) await this.interior.exit();
    if (this.mode !== 'walk') this.setMode('walk');
    if (snap || this.world.buildingAt(x, z) || this.world.waterAt(x, z)) {
      const n = this.graph.nearestOnNetwork(x, z);
      if (n) { x = n.x; z = n.z; }
    }
    this.player.spawn(x, z, this.player.heading);
    this.camera.userData.orbitInit = false;
    this.audio.whoosh();
    this.ui.toast(this.world.describeLocation(x, z), 'info', 'Travelled to');
  }

  onRoad(x, z) {
    const n = this.graph.nearestOnNetwork(x, z);
    return !!n && n.d < (ROAD_W[n.e.kind] || 4) / 2 + 0.3;
  }

  // ------------------------------------------------------------------ frame
  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.adaptRes(now - this.last);
    this.fpsMeter(now - this.last);
    this.last = now;
    this.time += dt;
    const overlay = this.ui.anyOpen() && this.mode !== 'custom';
    if (!overlay) this.clock.update(dt);
    U.uTime.value += dt;
    this.weather.update(dt, this.camera);
    this.sky.setWeather(this.weather.state);
    this.sky.setHour(this.clock.hour);
    this.avoid.begin();
    this.input.pollPad();
    this.saveT = (this.saveT ?? 120) - dt;
    if (this.saveT <= 0) { this.saveT = 120; if (this.mode !== 'title') this.progress.save(); }
    this.musicT = (this.musicT || 0) - dt;
    if (this.musicT <= 0) { this.musicT = 1; this.updateMusic(); }
    if (this.mode === 'title') this.titleCam(dt);
    else if (!overlay) this.update(dt);
    const co = window.__camOverride;
    if (co) { this.camera.position.set(co.x, co.y, co.z); this.camera.lookAt(co.tx, co.ty, co.tz); this.focus = new THREE.Vector3(co.tx, co.ty, co.tz); }
    const inside = this.interior.active;
    { // near plane: 0.1 m when you are on the ground, further out the higher the camera is (title, drone, tour)
      const cp = this.camera.position;
      const hAbove = inside ? 0 : cp.y - (this.world.heightAt(cp.x, cp.z) || 0);
      const nearWant = inside ? 0.08 : THREE.MathUtils.clamp((hAbove - 3) * 0.045, 0.12, 14);
      if (Math.abs(nearWant - this.camera.near) > this.camera.near * 0.08) { this.camera.near = nearWant; this.camera.updateProjectionMatrix(); }
    }
    this.sky.update(dt, this.focus || this.player.pos, this.camera, inside ? 0 : this.weather.flash);
    this.water.update(dt);
    this.splash.update(dt);
    this.veg.update(this.time, this.camera, this.sky);
    this.drawDist.update(this.camera);
    if (this.grass) {
      const p = this.player.pos;
      this.grass.update(this.camera, { x: p.x, z: p.z, r: this.mode === 'bike' ? 1.3 : 0.8 }, inside ? -1e6 : this.world.heightAt(this.camera.position.x, this.camera.position.z));
    }
    this.props.updateLabels(this.camera, this.progress.discovered);
    const night = this.sky.state.night;
    this.fill.intensity = (this.mode === 'custom' ? 1.3 : inside ? 0.25 : 0.35) * (1 - (inside ? 0 : night * 0.6));
    this.buildings.setNight(night, this.clock.hour);
    this.props.setNight(night, dt, this.clock.hour);
    this.courts?.setNight(night, this.clock.hour);
    this.stallsObj.setNight(night);
    this.signage.setNight?.(night);
    this.landmarksObj.update(dt, night, this);
    // the living campus
    if (!overlay || this.mode === 'title') {
      this.life.update(dt);
      this.street.update(dt);
      this.hood.update(dt);
      this.couples.update(dt);
      this.poolObj?.update(dt, performance.now() / 1000);
      this.onestop?.update(dt);
      this.commute.update(dt);
      this.transport.update(dt);
      this.sports.update(dt);
      this.events.update(dt);
      this.wildlife.update(dt);
      this.interior.update(dt);
      this.jobs.update(dt);
    }
    this.crowd.begin(this.camera, this.time);
    this.bikesR.begin();
    if (!inside) {
      this.life.draw(this.crowd, this.bikesR);
      this.street.draw(this.crowd, this.bikesR);
      this.hood.draw(this.crowd);
      this.couples.draw(this.crowd);
      this.commute.draw(this.crowd, this.bikesR);
      this.transport.draw(this.crowd);
      this.cycleShops.draw(this.crowd);
      this.boats.updateNpc(dt, this.crowd);
      this.festive.drawRush(this.crowd);
      this.sports.draw(this.crowd);
      this.courts.draw(this.crowd, this);
      this.viewpoint.draw(this.crowd);
      this.busStops?.draw(this.crowd);
      this.busTerminus?.draw(this.crowd);
      this.bungalow.draw(this.crowd);
      this.events.draw(this.crowd);
      this.jobs.draw(this.crowd);
      this.traffic.draw(this.crowd, this.bikesR);
      this.busTour.drawPeople?.(this.crowd);
    } else this.interior.drawPeople(this.crowd);
    this.crowd.end();
    this.bikesR.end();
    this.wildlife.draw();
    this.capture.update();
    this.postfx.setLook({ night: inside ? 0 : night, gold: inside ? 0 : this.sky.state.gold, dark: inside ? 0 : this.weather.state.dark, inside, filter: this.mode === 'camera' || this.mode === 'drone' ? this.photoFilter || 'none' : 'none' });
    this.postfx.render(this.time);
    this.screens.update(this.camera);
    this.capture.afterRender();
    this.input.endFrame();
  }

  titleCam(dt) {
    this.titleA = (this.titleA ?? 0.6) + dt * 0.035;
    const c = this.center;
    this.camera.position.set(c.x + Math.cos(this.titleA) * 950, 430, c.z + Math.sin(this.titleA) * 950);
    this.camera.lookAt(c.x + Math.cos(this.titleA + 1.2) * 120, 30, c.z + Math.sin(this.titleA + 1.2) * 120);
    this.focus = new THREE.Vector3(c.x, 40, c.z);
    this.traffic.update(dt, this.camera, []);
    this.progress.update(dt, this.camera);
  }

  update(dt) {
    const { input, ui, player, audio, progress } = this;
    const world = this.world;
    const act = this.activity;
    this.input.wantLock = !ui.touch && this.mode !== 'custom' && !(act.exclusive && !act.cur.camera);
    // global keys
    if (!input.typing) {
      if (input.hit('KeyM')) { input.exitLock(); ui.openMap(); return; }
      if (input.hit('KeyJ')) { input.exitLock(); ui.openJournal(); return; }
      if (input.hit('Tab')) { input.exitLock(); ui.openPlanner(); return; }
      if (input.hit('KeyP') && this.mode !== 'custom' && !act.active) { this.setMode('custom'); return; }
      if (input.hit('KeyH')) ui.toggleKeys();
      if (input.hit('KeyZ')) ui.toast(audio.toggleMute() ? 'Sound off' : 'Sound on', 'info');
      if (input.hit('KeyI')) { this.gameGuide.toggleInfo(); }
      // N: the next time of day (morning, noon, afternoon, golden hour, night, dawn); Shift+N: weather
      if (input.hit('KeyO') && !act.active && !this.interior.active && (this.mode === 'walk' || this.mode === 'bike')) { input.exitLock(); const k = this.onestop.nearest(this.mode === 'bike' ? 5 : 3.2); if (k) this.onestop.scanAt(k); else this.onestop.open('home'); return; }
      if (input.hit('KeyN') && !act.active) {
        if (input.down('ShiftLeft') || input.down('ShiftRight')) { input.exitLock(); ui.openPlanner(true); return; }
        const order = [...TIME_PRESETS].sort((a, b) => a.t - b.t), h = this.clock.hour;
        const next = order.find((p) => p.t > h + 0.05) || order[0];
        this.clock.set(next.t);
        ui.toast(`${next.name} · ${formatTime(next.t)}`, 'info', 'Time of day');
      }
    }
    const m = this.mode;
    let prompt = '';
    if (act.exclusive) {
      act.update(dt);
      ui.pollActKeys(input);
    } else if (m === 'walk') {
      if (input.hit('KeyB')) { if (!this.interior.active) this.setMode('bike'); return; }
      if (input.hit('KeyT') && !this.interior.active) { this.ui.openTourPick(); return; }
      if (input.hit('KeyG') && !this.interior.active) { this.setMode('drone'); return; }
      if (input.hit('KeyY') && !this.interior.active) { this.startBikeTour(); return; }
      if (input.hit('KeyL') && !this.interior.active) { this.startChallenge(); return; }
      if (input.hit('KeyK')) { this.setMode('camera'); return; }
      if (input.hit('KeyV')) { player.view = player.view === 'first' ? 'third' : 'first'; }
      for (const [k, e] of [['Digit1', 'wave'], ['Digit2', 'dance'], ['Digit3', 'cheer'], ['Digit4', 'clap']]) if (input.hit(k)) player.emote = player.emote === e ? null : e;
      player.update(dt);
      ui.setMode(player.swimming ? 'swim' : player.flying ? 'fly' : 'walk');
      if (player.swimming && world.waterAt(player.pos.x, player.pos.z)?.kind === 'pool') {
        progress.unlock('pool');
        // in street clothes: the lifeguard blows the whistle once (the changing rooms are by the gate)
        if (!this.swimSaved && !this._poolWarned) { this._poolWarned = true; audio.tone?.(3000, 0.3, { type: 'square', gain: 0.04 }); ui.toast('"Swimming costume and cap only, please! Change in the changing rooms by the gate."', 'warn', 'Lifeguard'); }
      } else if (!player.swimming) this._poolWarned = false;
    } else if (m === 'bike') {
      if (input.hit('KeyB', 'KeyE')) { this.setMode('walk'); return; }
      if (input.hit('KeyT')) { this.ui.openTourPick(); return; }
      if (input.hit('KeyG')) { this.setMode('walk'); this.setMode('drone'); return; }
      if (input.hit('KeyY')) { this.startBikeTour(); }
      if (input.hit('KeyL')) { this.startChallenge(); }
      if (input.hit('KeyV')) this.bike.view = this.bike.view === 'first' ? 'third' : 'first';
      this.bike.update(dt);
    } else if (m === 'bus') {
      if (input.hit('KeyE', 'KeyT')) { this.setMode('walk'); return; }
      this.busTour.update(dt);
    } else if (m === 'tour') {
      if (input.hit('KeyE', 'KeyT')) { this.setMode('walk'); return; }
      this.tour.update(dt);
    } else if (m === 'lift') {
      const L = this.lift, p = L?.p;
      if (!p) { this.setMode('walk'); return; }
      L.t += dt;
      if (input.hit('KeyE')) { this.endLift('"Bye! See you around."'); return; }
      // they got where they were going (or stopped riding)
      const riding = p.state ? p.state === 'travel' && p.mode === 'bike' : p.out && p.bike != null;
      if (!riding && L.t > 2) { this.endLift('"Here we are - thanks for the company!"'); return; }
      const yaw = p.yaw || 0, bx = p.x - Math.sin(yaw) * 0.5, bz = p.z - Math.cos(yaw) * 0.5;
      player.pos.set(bx, (p.y ?? world.heightAt(p.x, p.z)) + 0.42, bz);
      player.heading = yaw;
      player.avatar.root.position.copy(player.pos);
      player.avatar.root.rotation.set(0, yaw, 0);
      player.avatar.animate({ type: 'sit' }, dt);
      player.look?.(input, -0.4, 1.3);
    } else if (m === 'ride') {
      if (!this.transport.ride) { this.setMode('walk'); return; }                 // (a seat with no ride behind it: you are never left stuck in it)
      if (input.hit('KeyE')) { this.getOut(); return; }
      player.look?.(input, -0.6, 1.4);
    } else if (m === 'drone') {
      if (input.hit('KeyG')) {
        if (this.drone.leaving) { this.drone.finish(); this.setMode('walk'); return; }
        this.drone.land();
        ui.toast('Drone returning to you. Press G again to stop immediately.', 'info');
      }
      if (input.hit('Enter') || input.clicked) this.capture.snap('drone');
      if (input.hit('KeyR')) this.capture.toggleVideo();
      if (this.drone.active) this.drone.update(dt);
    } else if (m === 'drive') {
      if (input.hit('KeyE') && !this.jobs.nearTarget?.()) this.getOut();
      if (this.mode !== 'drive') return;
      if (this.drive.exiting && Math.abs(this.drive.speed) < 3) { this.setMode('walk'); return; }       // stopped: out you get, whatever keys are held
      this.drive.update(dt);
    } else if (m === 'boat') {
      this.boats.update(dt);
    } else if (m === 'camera') {
      if (input.hit('KeyK')) { this.setMode('walk'); return; }
      this.capture.updateHandheld(dt);
    } else if (m === 'custom') {
      player.heading += input.dx * 0.01;
      player.avatar.root.rotation.set(0, player.heading, 0);
      player.avatar.animate({ type: 'idle' }, dt);
    }
    if (act.active && !act.exclusive) { act.update(dt); ui.pollActKeys(input); }

    // things you can press E at
    const p = player.pos;
    if (!act.exclusive && m === 'walk' && !player.flying) prompt = this.interact.update(p, player.heading, true);
    else this.interact.current = null;

    // progress, energy
    if ((m === 'walk' || m === 'bike') && !this.interior.active) {
      this.discT = (this.discT || 0) - dt;
      if (this.discT < 0) { this.discT = 0.25; progress.discoverNear(p.x, p.z); }
      progress.collectNear(p, player.flying ? 3 : 2.3);
      this.walked = (this.walked || 0) + player.speed * dt;
      if (this.walked > 15) progress.unlock('first_steps');
      if (this.sky.state.night > 0.6 && player.speed > 0.5) progress.addStat('nightTime', dt);
      if (this.weather.state.rain > 0.3 && player.speed > 0.5) progress.addStat('rainTime', dt);
      const vp = world.landmark('viewpoint');
      if (vp && Math.hypot(vp.wx - p.x, vp.wz - p.z) < 12) progress.unlock('viewpoint');
    }
    const effort = m === 'bike' ? this.bike.speed * 0.012 : m === 'walk' ? (player.speed > 5 ? 0.06 : player.speed * 0.006) : 0;
    progress.tire(effort * dt * (this.clock.k >= 20 ? 3 : 1));
    if (progress.energy < 12 && !this._hungry) { this._hungry = true; ui.toast('You are running low on energy. Eat at a mess, a canteen or grab a chai!', 'warn', 'Hungry'); }
    if (progress.energy > 30) this._hungry = false;
    progress.update(dt, this.camera);
    this.viewpoint?.update();
    this.guide.update(dt, m === 'drive' ? this.drive.pos : p);
    this.polish.update(dt);
    this.gameGuide?.update(dt);
    this.knock.update(dt);
    this.festive.update();
    this.bikeTour.update(dt);
    this.challengeRun.update(dt);

    // traffic reacts to you and to the tour bus
    const obstacles = [];
    const pv = m === 'drive' ? this.drive.pos : p;
    if ((m === 'walk' || m === 'bike' || m === 'drive') && !this.interior.active && pv.y - world.heightAt(pv.x, pv.z) < 3) obstacles.push({ x: pv.x, z: pv.z, r: m === 'drive' ? 1.6 : m === 'bike' ? 0.8 : 0.5, player: true });
    if (m === 'bus' && this.busTour.bus) obstacles.push({ x: this.busTour.bus.group.position.x, z: this.busTour.bus.group.position.z, r: 1.6 });
    const npc = this.traffic.update(dt, this.camera, obstacles);

    // camera
    const cam = this.camera;
    if (!(act.active && act.camera(cam, dt))) {
      if (m === 'walk') player.updateCamera(cam, dt);
      else if (m === 'bike') this.bike.updateCamera(cam, dt);
      else if (m === 'bus') this.busTour.updateCamera(cam, dt);
      else if (m === 'tour') this.tour.updateCamera(cam, dt);
      else if (m === 'ride') this.transport.rideCamera(cam, dt);
      else if (m === 'lift') orbitCamera(world, cam, new THREE.Vector3(player.pos.x, player.pos.y + 1.2, player.pos.z), player.heading + player.camYaw, Math.max(0.12, player.camPitch * 0.8), 4.5, dt);
      else if (m === 'drone' && this.drone.active) this.drone.updateCamera(cam, dt);
      else if (m === 'drive') this.drive.updateCamera(cam, dt);
      else if (m === 'boat') this.boats.updateCamera(cam, dt);
      else if (m === 'camera') this.capture.cameraHandheld(cam);
      else if (m === 'custom') this.customCam(dt);
      else player.updateCamera(cam, dt);
    }
    this.focus = m === 'drone' ? this.drone.pos : m === 'tour' ? this.tour.pos : m === 'ride' && this.transport.ride ? this.transport.ride.v.model.group.position : m === 'bus' && this.busTour.bus ? this.busTour.bus.group.position : m === 'drive' ? this.drive.pos : p;
    ui.crosshair(m === 'walk' && player.view === 'first' && !act.exclusive);

    // HUD
    const dir = cam.getWorldDirection(new THREE.Vector3());
    const heading = ((Math.atan2(dir.x, -dir.z) * 180) / Math.PI + 360) % 360;
    this.locT = (this.locT || 0) - dt;
    if (this.locT < 0) {
      this.locT = 0.3;
      this.locName = this.interior.active ? this.interior.plan.name : world.describeLocation(this.focus.x, this.focus.z);
      if (!this.interior.active) this.updateWaterTrees();
    }
    const speed = m === 'bike' ? this.bike.speed : m === 'bus' ? this.busTour.v : m === 'tour' ? this.tour.v : m === 'ride' && this.transport.ride ? this.transport.ride.v.v : m === 'drone' ? Math.hypot(this.drone.vel.x, this.drone.vel.z) : m === 'drive' ? this.drive.speed : player.speed;
    const alt = this.interior.active ? 0 : this.focus.y - world.heightAt(this.focus.x, this.focus.z);
    ui.hud({ loc: this.locName || '', heading, y: this.interior.active ? world.heightAt(this.interior.outside.x, this.interior.outside.z) : this.focus.y, hour: this.clock.hour, day: this.clock.dayName, weather: this.interior.active ? 'indoors' : this.weather.state.name, speed, alt, mode: m === 'walk' && player.flying ? 'fly' : m });
    ui.wallet(progress);
    this.hudT = (this.hudT || 0) - dt;
    if (this.hudT <= 0) {
      this.hudT = 1;
      ui.envMeter(environment(this));
      ui.ticker(this.tickerText());
    }
    if (!this.interior.active) {
      const markers = [];
      if (this.busTour.active && this.busTour.bus) markers.push({ x: this.busTour.bus.group.position.x, z: this.busTour.bus.group.position.z, color: '#b3262f', r: 8 });
      if (this.bike.bike && this.bike.bike.group.visible && !this.bike.riding) markers.push({ x: this.bike.pos.x, z: this.bike.pos.z, color: '#c89b3c', r: 6 });
      for (const e of this.events.live.values()) if (this.events.isOn(e.d)) markers.push({ x: e.p.x, z: e.p.z, color: '#e3b85a', r: 9, star: true });
      ui.minimap(dt, this.focus, heading, {
        span: m === 'drone' ? clamp(300 + alt * 3, 300, 1400) : m === 'bus' ? 600 : m === 'tour' ? (this.tour.kind === 'drone' ? 900 : 520) : m === 'drive' ? 520 : player.flying ? clamp(380 + alt * 2.5, 380, 1600) : 380,
        route: m === 'tour' ? this.tour.routeAhead() : this.guide.pts, target: this.guide.target, markers,
      });
    }
    // context prompt
    if (!prompt && !act.exclusive) {
      if (m === 'walk' && this.bike.nearPlayer()) prompt = '<kbd>B</kbd> Ride your bicycle';
      else if (m === 'walk' && !this.interior.active && player.speed < 0.2 && this.time % 40 < 4 && !this.bikeTour.active) prompt = '<kbd>B</kbd> Bicycle &nbsp; <kbd>T</kbd> Bus &nbsp; <kbd>G</kbd> Drone &nbsp; <kbd>K</kbd> Camera &nbsp; <kbd>Tab</kbd> Planner';

    }
    if (!(m === 'drive' && this.jobs.job) && !(m === 'boat')) ui.prompt(prompt);
    ui.getOutButton({ ride: 'Get off', lift: 'Hop off', bike: 'Get off', drive: 'Get out', boat: 'Get out' }[m] || '');
    const cur = this.interact.current;
    if (cur && prompt && !this.progress.settings.calm) {
      const v = new THREE.Vector3(cur.x, (cur.y ?? (this.interior.active ? player.pos.y : world.heightAt(cur.x, cur.z))) + 2.1, cur.z).project(cam);
      ui.anchorPrompt(v.z < 1 && Math.abs(v.x) < 0.85 && Math.abs(v.y) < 0.85 ? v : null);
    } else ui.anchorPrompt(null);

    // audio
    const inside = this.interior.active;
    audio.update(dt, {
      altitude: inside ? 0 : cam.position.y - world.heightAt(cam.position.x, cam.position.z),
      airSpeed: m === 'drone' ? this.drone.vel.length() : player.flying ? Math.hypot(player.vel.x, player.vel.y, player.vel.z) : 0,
      nearWater: inside ? 0 : this.nearWater || 0, treeDensity: inside ? 0 : this.treeDensity || 0.3,
      mode: m, speed, onRoad: m === 'bike' ? this.onRoadCached(p) : true,
      inside: inside || (m === 'bus' && this.busTour.view === 'window'), fpv: this.drone.view === 'fpv',
      thrust: this.drone.thrust, night: this.sky.state.night, npc,
    });
    audio.ambience({ rain: this.weather.state.rain, inside, crowd: inside ? this.interior.count() : Math.min(40, this.crowd.near.n) });
    if (m !== 'drive') audio.siren?.(!!this.traffic.ambD2 && this.traffic.ambD2 < 60 * 60);
  }

  tickerText() {
    const c = this.clock, h = c.hour;
    const bits = [];
    const meal = mealNow(h);
    if (meal) bits.push(`<b>Now:</b> ${meal.name} at the hostel messes`);
    else if (h >= 9 && h < 13 && !c.weekend) bits.push('<b>Now:</b> classes in the Lecture Hall Complex');
    else if (h >= 14 && h < 17 && !c.weekend) bits.push('<b>Now:</b> labs and classes');
    else if (h >= 16.3 && h < 19) bits.push('<b>Now:</b> sports on the grounds · clubs at the SAC');
    else if (h >= 21.75 || h < 1) bits.push('<b>Now:</b> library and night canteens open');
    const cur = this.events.current();
    if (cur) bits.unshift(`<b>Live:</b> ${cur.name} · ${cur.where}`);
    const nx = this.events.next();
    if (nx && nx.inHours < 30) bits.push(`<b>Next:</b> ${nx.d.name}${nx.inHours < 20 ? ` at ${fmtHour(nx.d.from)}` : ' tomorrow'}`);
    else if (!meal) { const nm = nextMeal(h); bits.push(`<b>Next:</b> ${nm.name} at ${fmtHour(nm.from)}`); }
    return bits.join(' &nbsp;·&nbsp; ');
  }

  onRoadCached(p) {
    this.roadT = (this.roadT || 0) - 1;
    if (this.roadT < 0) { this.roadT = 10; this._onRoad = this.onRoad(p.x, p.z); }
    return this._onRoad;
  }

  updateWaterTrees() {
    const c = this.camera.position;
    let best = Infinity;
    const tmp = { d: 0, x: 0, z: 0 };
    for (const w of this.world.water) {
      if (c.x < w.x0 - 80 || c.x > w.x1 + 80 || c.z < w.z0 - 80 || c.z > w.z1 + 80) continue;
      const d = this.world.waterAt(c.x, c.z) === w ? 0 : closestOnRing(c.x, c.z, w.rings[0], tmp).d;
      best = Math.min(best, d);
    }
    this.nearWater = clamp(1 - best / 70, 0, 1);
    const P = this.veg.positions;
    let n = 0;
    for (let i = 0; i < P.length; i += 2) if (Math.abs(P[i] - c.x) < 40 && Math.abs(P[i + 1] - c.z) < 40) n++;
    this.treeDensity = clamp(n / 45, 0, 1);
  }

  customCam(dt) {
    const p = this.player.pos;
    const cam = this.camera;
    const s = this.player.scale;
    const f = new THREE.Vector3(Math.sin(this.player.heading), 0, Math.cos(this.player.heading));
    const want = new THREE.Vector3(p.x, p.y + 1.15 * s, p.z).addScaledVector(f, 3.1);
    if (!this.camInit) { cam.position.copy(want); this.camInit = true; }
    if (!this.customFixed) { this.customFixed = want.clone(); }
    cam.position.lerp(this.customFixed, 1 - Math.exp(-6 * dt));
    const right = new THREE.Vector3().subVectors(p, cam.position).cross(new THREE.Vector3(0, 1, 0)).normalize();
    const shift = window.innerWidth > 760 ? 0.85 : 0;
    cam.lookAt(p.x + right.x * shift, p.y + 1.0 * s, p.z + right.z * shift);
  }
}

const game = new Game();
game.init().catch((e) => {
  console.error(e.stack || e);
  const m = document.getElementById('loadmsg');
  if (m) m.textContent = `Could not start: ${e.message}. Try a browser with WebGL 2 (Chrome, Edge, Firefox).`;
});
export { ELEV0 };
