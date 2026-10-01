// The stylesheet of IITG OS, the desktop on the Computer Centre's PCs (injected once).
export const VW = 1280, VH = 720;

export function injectStyle() {
  if (document.getElementById('os-css')) return;
  const st = document.createElement('style');
  st.id = 'os-css';
  st.textContent = `
#pc-layer { position: fixed; inset: 0; z-index: 45; pointer-events: auto; }
#pc-screen { position: absolute; overflow: hidden; background: #000; box-shadow: 0 0 40px rgba(120,170,255,0.18); }
#pc-desk { position: absolute; left: 0; top: 0; width: ${VW}px; height: ${VH}px; transform-origin: 0 0; font: 13px "Segoe UI", "Hind", system-ui, sans-serif; color: #1f2430; user-select: none; overflow: hidden; }
#pc-present { position: fixed; top: 64px; left: 50%; transform: translateX(-50%); z-index: 47; display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 12px; background: rgba(12,20,24,0.9); color: #f2ecd9; font: 13px "Segoe UI", system-ui, sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
#pc-present button { appearance: none; border: 0; border-radius: 9px; padding: 8px 14px; font: 600 14px "Segoe UI", system-ui, sans-serif; color: #fff; background: #1f6fe5; cursor: pointer; }
#pc-present button:hover { background: #3a84f2; }
#pc-present button.on { background: #d0342c; }
#pc-present span { opacity: 0.85; max-width: 320px; line-height: 1.3; }
#pc-hint { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 46; padding: 8px 14px; border-radius: 10px; background: rgba(12,20,24,0.8); color: #f2ecd9; font: 13px "Segoe UI", system-ui, sans-serif; pointer-events: none; }

.os { position: absolute; inset: 0; overflow: hidden; color-scheme: light; --accent: #7a2630; --accent2: #b3343f; --glass: rgba(24,30,42,0.86); }
.os * { box-sizing: border-box; }
.os button { font-family: inherit; }
.os input, .os textarea, .os select { font-family: inherit; user-select: text; }
.os .wall { position: absolute; inset: 0; background-size: cover; background-position: center; }
.os .wall.w-dusk { background: radial-gradient(ellipse at 74% 78%, #ffd98a 0%, #f08a4b 9%, transparent 30%), linear-gradient(180deg, #241a4d 0%, #6a2c6b 34%, #d8545a 62%, #f39a4c 78%, #2a1838 78.2%, #4a2a57 100%); }
.os .wall.w-campus { background: radial-gradient(ellipse at 20% 15%, rgba(255,255,255,0.35), transparent 40%), linear-gradient(160deg, #1f6f4a 0%, #2f8a5a 35%, #7fbf7f 62%, #dfe9c6 100%); }
.os .wall.w-night { background: radial-gradient(circle at 78% 22%, #fff3c9 0 2.2%, rgba(255,243,201,0.3) 3%, transparent 9%), radial-gradient(ellipse at 50% 120%, #1f3a7a 0%, transparent 60%), linear-gradient(180deg, #050a1c 0%, #0f1c44 60%, #22366d 100%); }
.os .wall.w-maroon { background: radial-gradient(ellipse at 30% 20%, #b3343f 0%, #7a2630 45%, #3f1219 100%); }
.os .wall.w-blue { background: radial-gradient(ellipse at 30% 20%, #3b6ea5 0%, #1c3557 55%, #10213a 100%); }
.os .stars i { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: #fff; opacity: .7; }

/* desktop icons */
.os .icons { position: absolute; left: 14px; top: 12px; bottom: 52px; display: grid; grid-auto-flow: column; grid-template-rows: repeat(6, 92px); grid-auto-columns: 92px; gap: 4px; align-content: start; }
.os .dico { width: 88px; padding: 6px 4px; border-radius: 6px; display: flex; flex-direction: column; align-items: center; gap: 4px; color: #fff; text-align: center; font-size: 12px; text-shadow: 0 1px 3px rgba(0,0,0,0.85); cursor: default; border: 1px solid transparent; }
.os .dico:hover { background: rgba(255,255,255,0.14); }
.os .dico.sel { background: rgba(120,170,255,0.32); border-color: rgba(160,200,255,0.6); }
.os .tile { width: 42px; height: 42px; border-radius: 11px; display: grid; place-items: center; color: #fff; font-size: 22px; line-height: 1; box-shadow: 0 2px 6px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.3); flex: none; }
.os .tile.sm { width: 24px; height: 24px; border-radius: 6px; font-size: 14px; }
.os .tile.lg { width: 56px; height: 56px; border-radius: 14px; font-size: 30px; }

/* windows */
.os .wins { position: absolute; left: 0; top: 0; right: 0; bottom: 40px; pointer-events: none; }
.os .win { position: absolute; display: flex; flex-direction: column; background: #f6f7f9; border-radius: 9px; box-shadow: 0 10px 34px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.35); overflow: hidden; pointer-events: auto; min-width: 260px; min-height: 160px; }
.os .win.inactive { box-shadow: 0 6px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.25); }
.os .win.max { border-radius: 0; }
.os .win.min { display: none; }
.os .win .tb { height: 32px; flex: none; display: flex; align-items: center; gap: 8px; padding: 0 0 0 8px; background: linear-gradient(#eef0f4, #e1e5ec); border-bottom: 1px solid #c9ced8; cursor: default; }
.os .win.inactive .tb { background: #eceef2; color: #7b8494; }
.os .win .tb .tt { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; font-weight: 600; }
.os .win .tb button { width: 42px; height: 32px; border: 0; background: none; font-size: 14px; color: #3a4252; cursor: pointer; }
.os .win .tb button:hover { background: rgba(0,0,0,0.08); }
.os .win .tb button.cl:hover { background: #e0483f; color: #fff; }
.os .win .body { flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; min-height: 0; background: #fff; }
.os .win .body > * { flex: 1; min-height: 0; display: flex; flex-direction: column; min-width: 0; }
.os .win .body > .fx, .os .win .body > .set { flex-direction: row; }
.os .win .body > .term { display: block; }
.os .paint .bar { flex-wrap: wrap; row-gap: 4px; }
.os .win .rs { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.os .win .rs::after { content: ''; position: absolute; right: 3px; bottom: 3px; width: 9px; height: 9px; border-right: 2px solid #9aa2b1; border-bottom: 2px solid #9aa2b1; }
.os.dragging iframe, .os.dragging video { pointer-events: none; }

/* taskbar */
.os .task { position: absolute; left: 0; right: 0; bottom: 0; height: 40px; display: flex; align-items: center; gap: 4px; padding: 0 8px; background: var(--glass); backdrop-filter: blur(10px); border-top: 1px solid rgba(255,255,255,0.12); color: #e8ebf2; z-index: 500; }
.os .task .startb { width: 36px; height: 32px; border: 0; border-radius: 8px; background: none; display: grid; place-items: center; cursor: pointer; }
.os .task .startb:hover, .os .task .startb.on { background: rgba(255,255,255,0.14); }
.os .task .logo { width: 22px; height: 22px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ff8a93, var(--accent2) 45%, var(--accent)); box-shadow: 0 0 0 2px rgba(255,255,255,0.85) inset; position: relative; }
.os .task .logo::after { content: ''; position: absolute; left: 6px; top: 6px; width: 10px; height: 10px; background: #fff; clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.os .task .search { width: 190px; height: 28px; border-radius: 14px; border: 0; background: rgba(255,255,255,0.14); color: #fff; padding: 0 12px; font-size: 12.5px; outline: none; }
.os .task .search::placeholder { color: #c3c9d6; }
.os .task .apps { flex: 1; display: flex; gap: 3px; margin-left: 6px; overflow: hidden; }
.os .tbtn { height: 32px; min-width: 40px; max-width: 150px; padding: 0 8px; border: 0; border-radius: 6px; background: none; color: #e8ebf2; display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; position: relative; }
.os .tbtn:hover { background: rgba(255,255,255,0.12); }
.os .tbtn.on { background: rgba(255,255,255,0.2); }
.os .tbtn.on::after, .os .tbtn.open::after { content: ''; position: absolute; left: 30%; right: 30%; bottom: 1px; height: 3px; border-radius: 2px; background: #6fb1ff; }
.os .tbtn.open:not(.on)::after { background: #9aa6bd; left: 40%; right: 40%; }
.os .tbtn span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.os .tray { display: flex; align-items: center; gap: 10px; font-size: 12px; padding: 0 4px; }
.os .tray .clk { text-align: right; line-height: 1.2; cursor: pointer; padding: 2px 6px; border-radius: 6px; }
.os .tray .clk:hover { background: rgba(255,255,255,0.12); }

/* start menu */
.os .start { position: absolute; left: 8px; bottom: 46px; width: 460px; height: 470px; border-radius: 12px; background: rgba(28,34,48,0.96); backdrop-filter: blur(14px); box-shadow: 0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.1); color: #e9edf5; z-index: 600; display: none; flex-direction: column; padding: 14px; gap: 10px; }
.os .start.on { display: flex; }
.os .start input { height: 32px; border-radius: 16px; border: 0; background: rgba(255,255,255,0.13); color: #fff; padding: 0 14px; font-size: 13px; outline: none; }
.os .start h4 { margin: 4px 4px 0; font-size: 12px; letter-spacing: .05em; color: #aeb7ca; font-weight: 600; }
.os .start .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
.os .start .app { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 8px 2px; border-radius: 8px; font-size: 11.5px; cursor: pointer; text-align: center; }
.os .start .app:hover { background: rgba(255,255,255,0.12); }
.os .start .foot { margin-top: auto; display: flex; align-items: center; gap: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.12); }
.os .start .foot .av { width: 32px; height: 32px; border-radius: 50%; background: var(--accent2); color: #fff; display: grid; place-items: center; font-weight: 700; }
.os .start .foot b { flex: 1; font-weight: 600; font-size: 13px; }
.os .start .foot button { border: 0; background: rgba(255,255,255,0.1); color: #fff; border-radius: 7px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
.os .start .foot button:hover { background: rgba(255,255,255,0.22); }
.os .start .res .item { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 8px; cursor: pointer; }
.os .start .res .item:hover { background: rgba(255,255,255,0.12); }

/* menus, dialogs, toasts */
.os .ctx { position: absolute; z-index: 700; min-width: 180px; background: #fff; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.15); padding: 4px; color: #1f2430; }
.os .ctx div { padding: 6px 14px; border-radius: 5px; cursor: default; font-size: 12.5px; }
.os .ctx div:hover { background: #dde8fb; }
.os .ctx hr { border: 0; border-top: 1px solid #dfe3ea; margin: 3px 4px; }
.os .modal { position: absolute; inset: 0; z-index: 800; background: rgba(0,0,0,0.35); display: grid; place-items: center; }
.os .dlg { width: 360px; background: #fff; border-radius: 10px; box-shadow: 0 14px 44px rgba(0,0,0,0.5); padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; color: #1f2430; }
.os .dlg h3 { margin: 0; font-size: 15px; }
.os .dlg p { margin: 0; font-size: 13px; color: #4a5568; }
.os .dlg input { height: 32px; border: 1.5px solid #c5ccd8; border-radius: 6px; padding: 0 10px; font-size: 13.5px; outline: none; }
.os .dlg input:focus { border-color: #4b86e8; }
.os .dlg .row { display: flex; gap: 8px; justify-content: flex-end; }
.os .btn { height: 30px; padding: 0 14px; border: 1px solid #c5ccd8; border-radius: 6px; background: #f3f5f9; color: #1f2430; font-size: 12.5px; cursor: pointer; }
.os .btn:hover { background: #e7ecf5; }
.os .btn.pri { background: #2f6fe0; border-color: #2f6fe0; color: #fff; }
.os .btn.pri:hover { background: #3d7cf0; }
.os .btn.red { background: #d63b32; border-color: #d63b32; color: #fff; }
.os .toasts { position: absolute; right: 12px; bottom: 50px; display: flex; flex-direction: column; gap: 8px; z-index: 650; pointer-events: none; }
.os .otoast { background: var(--glass); color: #fff; padding: 9px 14px; border-radius: 8px; font-size: 12.5px; box-shadow: 0 6px 20px rgba(0,0,0,0.4); animation: otin .25s ease-out; max-width: 300px; }
@keyframes otin { from { transform: translateX(30px); opacity: 0; } }
.os .cal { position: absolute; right: 8px; bottom: 46px; width: 260px; padding: 14px; border-radius: 12px; background: rgba(28,34,48,0.96); color: #e9edf5; box-shadow: 0 12px 40px rgba(0,0,0,0.55); z-index: 600; display: none; }
.os .cal.on { display: block; }
.os .cal h3 { margin: 0; font-size: 26px; font-weight: 500; }
.os .cal small { color: #aeb7ca; }

/* boot and login */
.os .boot { position: absolute; inset: 0; background: #06080d; z-index: 900; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; color: #dfe4ef; transition: opacity .5s; }
.os .boot .logo { width: 84px; height: 84px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ff8a93, var(--accent2) 45%, var(--accent)); box-shadow: 0 0 0 4px rgba(255,255,255,0.85) inset, 0 0 40px rgba(179,52,63,0.5); position: relative; }
.os .boot .logo::after { content: ''; position: absolute; left: 25px; top: 25px; width: 34px; height: 34px; background: #fff; clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.os .boot .spin { width: 26px; height: 26px; border: 3px solid rgba(255,255,255,0.25); border-top-color: #fff; border-radius: 50%; animation: pcspin .8s linear infinite; }
@keyframes pcspin { to { transform: rotate(360deg); } }
.os .lock { position: absolute; inset: 0; z-index: 850; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #fff; backdrop-filter: blur(16px) brightness(0.7); background: rgba(10,14,22,0.35); }
.os .lock.on { display: flex; }
.os .lock .clock { position: absolute; top: 70px; text-align: center; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
.os .lock .clock b { display: block; font-size: 86px; font-weight: 300; line-height: 1; }
.os .lock .av { width: 96px; height: 96px; border-radius: 50%; background: var(--accent2); display: grid; place-items: center; font-size: 42px; font-weight: 700; box-shadow: 0 0 0 4px rgba(255,255,255,0.7); }
.os .lock h2 { margin: 4px 0 0; font-size: 22px; font-weight: 500; }
.os .lock input { width: 230px; height: 34px; border-radius: 17px; border: 0; padding: 0 16px; background: rgba(255,255,255,0.22); color: #fff; font-size: 14px; outline: none; text-align: center; }
.os .lock input::placeholder { color: #d7deea; }
.os .lock small { opacity: .8; }
.os .lock .sticky { position: absolute; right: 60px; bottom: 90px; width: 168px; padding: 12px 14px; background: #f6e27a; color: #3b3200; font-size: 13px; line-height: 1.45; transform: rotate(3deg); box-shadow: 0 8px 20px rgba(0,0,0,0.4); font-family: 'Segoe Print', 'Comic Sans MS', 'Hind', sans-serif; }
.os .lock.shake > input { animation: oslockshake .4s; }
@keyframes oslockshake { 20%, 60% { transform: translateX(-9px); } 40%, 80% { transform: translateX(9px); } }

/* shared app pieces */
.os .bar { display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: #f1f3f7; border-bottom: 1px solid #d9dde6; flex: 0 0 auto; min-height: 34px; box-sizing: border-box; }
.os .bar button, .os .tool { height: 26px; min-width: 26px; padding: 0 9px; border: 1px solid transparent; border-radius: 5px; background: none; color: #2a3140; font-size: 12.5px; cursor: pointer; }
.os .bar button:hover, .os .tool:hover { background: #e2e7f0; }
.os .bar button.on { background: #d7e3fa; border-color: #a9c1f0; }
.os .bar button:disabled { opacity: .4; cursor: default; }
.os .bar .sp { flex: 1; }
.os .bar .sep { width: 1px; height: 18px; background: #cfd5e0; margin: 0 3px; }
.os .status { height: 22px; flex: none; padding: 0 10px; display: flex; align-items: center; gap: 14px; font-size: 11.5px; color: #5b6475; background: #f1f3f7; border-top: 1px solid #d9dde6; }

/* browser */
.os .br .tabs { display: flex; align-items: flex-end; gap: 2px; height: 34px; padding: 0 8px; background: #dee1e6; flex: none; }
.os .br .tab { display: flex; align-items: center; gap: 8px; width: 210px; height: 28px; padding: 0 8px 0 10px; background: #cfd3da; border-radius: 8px 8px 0 0; font-size: 12px; white-space: nowrap; overflow: hidden; cursor: default; }
.os .br .tab.on { background: #fff; }
.os .br .tab i { width: 15px; height: 15px; border-radius: 3px; background: #7a2630; flex: none; }
.os .br .tab i.spin { border: 2px solid #1a73e8; border-right-color: transparent; border-radius: 50%; background: none; animation: pcspin .7s linear infinite; }
.os .br .tab span { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.os .br .tab b { width: 18px; height: 18px; border-radius: 50%; text-align: center; line-height: 17px; font-weight: 400; color: #5f6368; }
.os .br .tab b:hover { background: rgba(0,0,0,0.12); }
.os .br .plus { width: 26px; height: 26px; border: 0; background: none; font-size: 18px; color: #3c4043; cursor: pointer; border-radius: 50%; margin-bottom: 2px; }
.os .br .plus:hover { background: rgba(0,0,0,0.1); }
.os .br .nav { display: flex; align-items: center; gap: 6px; height: 38px; padding: 0 8px; background: #fff; border-bottom: 1px solid #dadce0; flex: none; }
.os .br .nav button { width: 28px; height: 28px; border: 0; border-radius: 50%; background: none; font-size: 15px; color: #5f6368; cursor: pointer; }
.os .br .nav button:hover { background: #f1f3f4; }
.os .br .nav button:disabled { color: #c4c7c5; cursor: default; background: none; }
.os .br .url { flex: 1; height: 28px; border: 0; border-radius: 14px; background: #f1f3f4; padding: 0 14px; font-size: 13px; color: #202124; outline: none; }
.os .br .url:focus { background: #fff; box-shadow: 0 0 0 2px #1a73e8 inset; }
.os .br .prog { height: 2px; background: #1a73e8; width: 0; transition: width .4s; flex: none; }
.os .br .marks { display: flex; gap: 4px; padding: 3px 8px; background: #fff; border-bottom: 1px solid #e6e8ec; flex: none; }
.os .br .marks button { border: 0; background: none; border-radius: 12px; padding: 3px 10px; font-size: 12px; color: #3c4043; cursor: pointer; display: flex; align-items: center; gap: 5px; }
.os .br .marks button:hover { background: #eef0f3; }
.os .br .marks i { width: 13px; height: 13px; border-radius: 3px; display: inline-block; }
.os .br .view { flex: 1; position: relative; background: #fff; min-height: 0; }
.os .br .view iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: #fff; }
.os .page { position: absolute; inset: 0; overflow: auto; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 26px 20px; color: #202124; user-select: text; }
.os .page h1 { font: 500 42px "Segoe UI", "Hind", sans-serif; margin: 6px 0 0; color: #3c4043; }
.os .page h2 { font: 500 22px "Segoe UI", "Hind", sans-serif; margin: 0; }
.os .page .search { width: 540px; max-width: 90%; height: 42px; border: 1px solid #dfe1e5; border-radius: 22px; padding: 0 20px; font-size: 15px; outline: none; }
.os .page .search:focus { box-shadow: 0 1px 8px rgba(32,33,36,0.28); border-color: transparent; }
.os .page .tiles { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; max-width: 720px; }
.os .page .tl { width: 100px; display: flex; flex-direction: column; align-items: center; gap: 7px; cursor: pointer; font-size: 12px; color: #3c4043; text-align: center; padding: 8px 2px; border-radius: 8px; }
.os .page .tl:hover { background: #f1f3f4; }
.os .page .err { max-width: 620px; align-self: flex-start; margin-left: 40px; display: flex; flex-direction: column; gap: 12px; padding-top: 60px; }
.os .page .err p { margin: 0; font-size: 14px; color: #5f6368; line-height: 1.55; }
.os .page .note { max-width: 640px; font-size: 12.5px; color: #5f6368; text-align: center; line-height: 1.5; }
.os .page .card { width: 640px; max-width: 94%; background: #f8f9fb; border: 1px solid #e3e7ee; border-radius: 10px; padding: 14px 16px; }
.os .page .card h3 { margin: 0 0 6px; font-size: 15px; }
.os .page .card p { margin: 3px 0; font-size: 13px; color: #4a5568; line-height: 1.5; }
.os .page a, .os .page .lnk { color: #1a56c4; cursor: pointer; }
.os .wiki { position: absolute; inset: 0; overflow: auto; padding: 18px 34px 40px; font: 15px/1.65 Georgia, "Linux Libertine", serif; color: #202122; user-select: text; background: #fff; }
.os .wiki h1 { font: 400 30px/1.25 Georgia, serif; border-bottom: 1px solid #a2a9b1; margin: 0 0 10px; padding-bottom: 4px; }
.os .wiki h2 { font: 400 22px/1.3 Georgia, serif; border-bottom: 1px solid #a2a9b1; margin: 22px 0 8px; padding-bottom: 3px; }
.os .wiki h3, .os .wiki h4 { font-family: "Segoe UI", sans-serif; margin: 14px 0 4px; }
.os .wiki a[data-w], .os .wiki a[data-go], .os .wiki a[data-a] { color: #0645ad; cursor: pointer; text-decoration: none; }
.os .wiki a[data-w]:hover, .os .wiki a[data-go]:hover { text-decoration: underline; }
.os .wiki img { max-width: 100%; height: auto; }
.os .wiki figure { margin: 8px 0 8px 16px; float: right; clear: right; max-width: 260px; font: 12.5px/1.4 "Segoe UI", sans-serif; background: #f8f9fa; border: 1px solid #c8ccd1; padding: 4px; }
.os .wiki table { border-collapse: collapse; font: 13px/1.45 "Segoe UI", sans-serif; }
.os .wiki table.infobox { float: right; clear: right; margin: 4px 0 12px 18px; width: 290px; background: #f8f9fa; border: 1px solid #a2a9b1; }
.os .wiki td, .os .wiki th { padding: 3px 6px; vertical-align: top; }
.os .wiki sup { font-size: 11px; }
.os .wiki ul, .os .wiki ol { padding-left: 24px; }

/* youtube */
.os .yt { background: #fff; }
.os .yt .top { display: flex; align-items: center; gap: 12px; padding: 8px 14px; border-bottom: 1px solid #e5e5e5; flex: none; }
.os .yt .brand { display: flex; align-items: center; gap: 6px; font-size: 18px; font-weight: 700; letter-spacing: -0.5px; cursor: pointer; }
.os .yt .brand i { width: 30px; height: 21px; border-radius: 6px; background: #e62117; position: relative; display: inline-block; }
.os .yt .brand i::after { content: ''; position: absolute; left: 12px; top: 5px; border-left: 9px solid #fff; border-top: 5.5px solid transparent; border-bottom: 5.5px solid transparent; }
.os .yt .q { flex: 1; max-width: 560px; height: 32px; border: 1px solid #ccc; border-radius: 16px 0 0 16px; padding: 0 14px; font-size: 14px; outline: none; }
.os .yt .go { height: 32px; width: 54px; border: 1px solid #ccc; border-left: 0; border-radius: 0 16px 16px 0; background: #f8f8f8; cursor: pointer; font-size: 15px; }
.os .yt .chips { display: flex; gap: 8px; padding: 8px 14px; flex: none; overflow: hidden; }
.os .yt .chips button { border: 0; background: #f1f1f1; border-radius: 8px; padding: 6px 12px; font-size: 12.5px; cursor: pointer; white-space: nowrap; }
.os .yt .chips button:hover { background: #e2e2e2; }
.os .yt .feed { flex: 1; overflow: auto; padding: 6px 14px 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px 12px; align-content: start; }
.os .yt .vc { cursor: pointer; }
.os .yt .vc .th { position: relative; aspect-ratio: 16 / 9; border-radius: 9px; overflow: hidden; background: #d9d9d9; }
.os .yt .vc .th img { width: 100%; height: 100%; object-fit: cover; display: block; }
.os .yt .vc .th em { position: absolute; right: 5px; bottom: 5px; background: rgba(0,0,0,0.8); color: #fff; font-size: 11px; padding: 1px 4px; border-radius: 3px; font-style: normal; }
.os .yt .vc b { display: block; margin-top: 7px; font-size: 13px; line-height: 1.3; font-weight: 600; max-height: 34px; overflow: hidden; }
.os .yt .vc small { color: #606060; font-size: 12px; display: block; margin-top: 2px; }
.os .yt .watch { flex: 1; display: flex; flex-direction: column; overflow: auto; padding: 10px 14px; gap: 8px; min-height: 0; }
.os .yt .player { position: relative; width: 100%; aspect-ratio: 16 / 9; max-height: calc(100% - 70px); background: #000; border-radius: 10px; overflow: hidden; flex: none; align-self: center; }
.os .yt .player iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.os .yt .player .msg { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; color: #e8e8e8; padding: 20px; font-size: 13.5px; line-height: 1.6; }
.os .yt .watch h2 { margin: 2px 0 0; font-size: 16px; }
.os .yt .empty { grid-column: 1 / -1; text-align: center; color: #606060; padding: 30px 10px; line-height: 1.6; }

/* notepad, paint, calc, terminal, files, settings ... */
.os .np textarea { flex: 1; border: 0; outline: none; resize: none; padding: 10px 12px; font: 14px "Consolas", "Courier New", monospace; color: #1a1f2b; background: #fff; user-select: text; }
.os .calc { background: #202632; padding: 10px; gap: 8px; color: #fff; }
.os .calc .disp { background: #171c26; border-radius: 8px; padding: 10px 12px; text-align: right; min-height: 78px; display: flex; flex-direction: column; justify-content: flex-end; }
.os .calc .disp small { color: #9aa6bd; min-height: 16px; font-size: 13px; }
.os .calc .disp b { font-size: 34px; font-weight: 400; overflow: hidden; }
.os .calc .keys { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.os .calc .keys button { border: 0; border-radius: 8px; background: #303847; color: #fff; font-size: 18px; cursor: pointer; }
.os .calc .keys button:hover { background: #3a4456; }
.os .calc .keys button.op { background: #3b4a66; }
.os .calc .keys button.eq { background: #2f6fe0; }
.os .paint .canvasbox { flex: 1; overflow: auto; background: #8c93a3; padding: 10px; }
.os .paint canvas { background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: crosshair; touch-action: none; }
.os .paint .sw { width: 18px; height: 18px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.3); cursor: pointer; padding: 0; }
.os .paint .sw.on { outline: 2px solid #2f6fe0; outline-offset: 1px; }
.os .term { background: #0c1016; color: #d5e2f0; font: 13px "Consolas", "Courier New", monospace; padding: 8px 10px; overflow: auto; user-select: text; }
.os .term .ln { white-space: pre-wrap; word-break: break-word; }
.os .term .pr { display: flex; gap: 6px; }
.os .term input { flex: 1; background: none; border: 0; outline: none; color: #fff; font: inherit; }
.os .fx { flex-direction: row !important; }
.os .fx .side { width: 150px; background: #f1f3f7; border-right: 1px solid #d9dde6; padding: 8px 4px; flex: none; overflow: auto; }
.os .fx .side div { padding: 6px 10px; border-radius: 5px; cursor: default; font-size: 12.5px; display: flex; align-items: center; gap: 7px; }
.os .fx .side div:hover { background: #e2e7f0; }
.os .fx .side div.on { background: #d3e1fb; }
.os .fx .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.os .fx .list { flex: 1; overflow: auto; padding: 8px; display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 8px; align-content: start; }
.os .fx .fi { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 8px 4px; border-radius: 6px; font-size: 12px; text-align: center; border: 1px solid transparent; word-break: break-all; }
.os .fx .fi:hover { background: #eef2fa; }
.os .fx .fi.sel { background: #d3e1fb; border-color: #9dbcf0; }
.os .fx .fi img { width: 84px; height: 62px; object-fit: cover; border-radius: 4px; background: #ddd; }
.os .fx .empty { grid-column: 1 / -1; color: #7b8494; padding: 30px; text-align: center; }
.os .ph { background: #14171e; color: #eee; }
.os .ph .stage { flex: 1; display: grid; place-items: center; min-height: 0; padding: 10px; position: relative; }
.os .ph .stage img, .os .ph .stage video { max-width: 100%; max-height: 100%; border-radius: 4px; }
.os .ph .strip { display: flex; gap: 6px; padding: 6px 8px; overflow-x: auto; background: #0e1015; flex: none; }
.os .ph .strip img, .os .ph .strip video { width: 74px; height: 52px; object-fit: cover; border-radius: 4px; opacity: .7; cursor: pointer; flex: none; border: 2px solid transparent; }
.os .ph .strip .on { opacity: 1; border-color: #6fb1ff; }
.os .ph .bar { background: #1b1f29; border-color: #2a3040; color: #eee; }
.os .ph .bar button { color: #eee; }
.os .ph .bar button:hover { background: #2a3040; }
.os .set { flex-direction: row !important; }
.os .set .side { width: 170px; background: #f1f3f7; border-right: 1px solid #d9dde6; padding: 10px 6px; flex: none; }
.os .set .side div { padding: 8px 12px; border-radius: 6px; cursor: default; }
.os .set .side div:hover { background: #e2e7f0; }
.os .set .side div.on { background: #d3e1fb; font-weight: 600; }
.os .set .pane { flex: 1; padding: 16px 20px; overflow: auto; display: flex; flex-direction: column; gap: 12px; }
.os .set h2 { margin: 0 0 4px; font-size: 20px; font-weight: 500; }
.os .set .walls { display: flex; gap: 10px; flex-wrap: wrap; }
.os .set .wl { width: 120px; height: 68px; border-radius: 8px; cursor: pointer; border: 3px solid transparent; position: relative; overflow: hidden; }
.os .set .wl.on { border-color: #2f6fe0; }
.os .set .wl span { position: absolute; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); color: #fff; font-size: 11px; padding: 2px 6px; }
.os .set .kv { display: grid; grid-template-columns: 150px 1fr; gap: 6px 10px; font-size: 13px; }
.os .set .kv b { color: #5b6475; font-weight: 600; }
.os .set input[type=range] { width: 260px; }
.os .set .chips { display: flex; gap: 6px; flex-wrap: wrap; }
.os .tm table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.os .tm th { text-align: left; padding: 6px 10px; background: #f1f3f7; border-bottom: 1px solid #d9dde6; font-weight: 600; }
.os .tm td { padding: 6px 10px; border-bottom: 1px solid #eef0f4; }
.os .tm td .btn { white-space: nowrap; height: 26px; padding: 0 10px; }
.os .tm .meter { height: 8px; border-radius: 4px; background: #e6e9f0; overflow: hidden; }
.os .tm .meter i { display: block; height: 100%; background: #4b86e8; }
.os .clockapp { align-items: center; justify-content: center; gap: 10px; background: #12161f; color: #fff; }
.os .clockapp canvas { width: 180px; height: 180px; }
.os .clockapp b { font-size: 40px; font-weight: 300; }
.os .snake { background: #0e1a12; align-items: center; justify-content: center; color: #cfe8d6; gap: 6px; }
.os .snake canvas { border: 2px solid #2f5a3a; border-radius: 4px; }
`;
  document.head.appendChild(st);
}
