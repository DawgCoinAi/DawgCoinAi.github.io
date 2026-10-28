import {DawgKennel} from './dawg-kennel.js';
import {STAMPS,updatePassport} from './passport.js';
import {LivingTradeGame,validLivingTrade,TRADE_PERKS} from './living-trade.js';
import {freshSeed,worldLook} from './world.js';
import {sceneFor} from './scene-loader.js';
import {HustleChat,hustleCast} from './hustle-chat.js';
import {LOOKS as CITY_LOOKS} from './hustle-drive.js';
import {GameSheet} from './game-sheet.js';
import {Discoveries} from './discoveries.js';
import {createQuickGame} from './pack-checkpoint.js';
import {PackRenderer} from './pack-renderer.js';
import {MazeGame,GOODS,DISTRICTS} from './engine.js';
import {ArcadeRenderer,THEMES} from './renderer.js';
import {MobileControls} from './mobile.js';
import {isTimed,dailyChallenge,seededRandom,medalFor,dailyResult,advanceGame} from './mobile-core.js';
import {snapshotMaze,restoreMaze} from './checkpoint.js';
import {ArcadePack,PACK_MODES} from './arcade-pack.js';
import {makeBackup,parseBackup,applyBackup} from './progress-backup.js';
import {validKennel,DISCIPLINES} from './dawg-career.js';
import {freshArcade,validArcade,wallFor,settleUnlocks,addRun,mergeServer,statsOf,localDay,xpForLevel,levelOf,currentStreak} from './unlocks.js';
import {ResultsSheet,medalState} from './results.js';
import {Onboarding,needsOnboarding} from './onboarding.js';
import {Cloud} from './cloud.js';
import {Rankings,challengeLink} from './rankings.js';
import {Shell,fmt as fmtNum,unlockProgress} from './shell.js';
import {music} from './arcade-music.js';
import {ShareSheet,drawScoreCard,shareBase,playLink,gamePage,readPlayLink,fmt} from './share.js';
import {GAME_IDS,VIEWS,VIEW_LABEL,canSwitchView,gameById,viewFor,nextView,viewAria,relativeTurn} from './games.js';
import {heatLabel} from './difficulty.js';
import {Curveballs} from './curveballs.js';
function freshMaze(mode='classic',daily=null){const seed=mode==='daily'?daily.seed:freshSeed();return new MazeGame(mode,seededRandom(seed),{...(daily||{}),worldSeed:seed});}
function isMaze(value=mode){return ['classic','rush','daily'].includes(value);}
const $=id=>document.getElementById(id);
const money=n=>(n<0?'−':'')+'$'+Math.abs(Math.round(n)).toLocaleString('en-US');
const padded=n=>String(Math.floor(n)).padStart(6,'0');
let storageAvailable=true,restoringBackup=false,otherTabActive=false;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem('dawg-v1-'+key))??fallback;}catch{return fallback;}};
const write=(key,value)=>{if(restoringBackup||otherTabActive)return;try{localStorage.setItem('dawg-v1-'+key,JSON.stringify(value));cloud.touch(key);}catch{storageAvailable=false;$('saveNote').textContent='SAVING UNAVAILABLE IN THIS BROWSER';}};
// Cloud saves: newer progress from another device replaces this one, then the page reloads
// so every module starts from the synced copy. Writes stop first so stale state cannot win.
const cloud=new Cloud({onPulled:()=>{if(sessionStorage.getItem('dawg-cloud-reload'))return;try{sessionStorage.setItem('dawg-cloud-reload','1');}catch{}restoringBackup=true;location.reload();},onStatus:(...a)=>{renderAccount(...a);if(a[0]==='online'&&!socialStarted){socialStarted=true;rankings.sync().then(()=>{rankings.handleChallenge();rankings.handlePlayer();if(shell.view==='play')renderHero();});}},onServer:data=>{mergeServer(arcade,data);settleUnlocks(arcade,records);write('arcade',arcade);renderLocks();}});
// Keep the raw copy of a stored section that fails validation before the game replaces it with a fresh one.
function keepDamaged(key,valid){if(restoringBackup||otherTabActive)return false;try{const raw=localStorage.getItem('dawg-v1-'+key);if(raw===null)return false;let value;try{value=JSON.parse(raw);}catch{}if(value===null||value!==undefined&&valid(value))return false;if(localStorage.getItem('dawg-v1-damaged-'+key)===null)localStorage.setItem('dawg-v1-damaged-'+key,raw);return true;}catch{return false;}}
// Only the newest tab saves: an older tab stops writing so its stale state cannot overwrite newer progress.
const tabId=Math.random().toString(36).slice(2),tabChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('dawg-v1-active-tab'):null;
if(tabChannel){tabChannel.onmessage=e=>{if(!e.data||e.data.claim===tabId||otherTabActive)return;otherTabActive=true;pauseForInterruption('PAUSED · OPEN IN ANOTHER TAB');document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('tabDialog').showModal();};tabChannel.unref?.();tabChannel.postMessage({claim:tabId});}
let records=read('records',{classic:0,rush:0,trade:null,runs:0});
if(!records||typeof records!=='object')records={classic:0,rush:0,trade:null,runs:0};
let passport=read('passport',null);
// Arcade XP, play time, streak days and unlocked games for the play walls.
let arcade=read('arcade',null);if(!validArcade(arcade))arcade=freshArcade();
let mode='classic',game=freshMaze(),trade=null,quantity=1,soundEnabled=read('sound',false),audioContext,confirmAction=null,scoreRecorded=false;
const face=new Image();face.src='assets/dawg-head-v2.webp';
const canvas=$('maze'),renderer=new ArcadeRenderer(canvas,face),cityRenderer=new PackRenderer($('cityCanvas'),face);let lastCityFrame=0;
let lastTime=0,toastUntil=0,blinkTime=0,lastProfileSave=0,musicBeat=0,nextMusicBeat=0,lastHud=0;
let focused=false,profileDirty=false,countdownUntil=0,wakeLock=null,runOutcome=null;
let challenge=dailyChallenge(),dailyRecords=read('daily',{});
if(!dailyRecords||typeof dailyRecords!=='object'||Array.isArray(dailyRecords))dailyRecords={};
const savedPrefs=read('settings',{}),prefs={controls:savedPrefs?.controlsChosen&&savedPrefs.controls==='stick'?'stick':'pad',controlsChosen:savedPrefs?.controlsChosen===true,hand:savedPrefs?.hand==='left'?'left':'right',haptics:savedPrefs?.haptics!==false,fx:savedPrefs?.fx==='low'?'low':'auto',curveballs:savedPrefs?.curveballs==='off'?'off':'on',volume:Number.isFinite(savedPrefs?.volume)?Math.min(1,Math.max(0,savedPrefs.volume)):.8,cameras:Object.fromEntries(Object.entries(savedPrefs?.cameras||{}).filter(([id,view])=>canSwitchView(id)&&VIEWS.includes(view)))};
const BADGES=[{id:'dots',target:100,name:'Block cleaner',desc:'Collect 100 coins'},{id:'caught',target:5,name:'Pack leader',desc:'Catch 5 rivals'},{id:'loot',target:3,name:'Bag chaser',desc:'Grab 3 gold bags'},{id:'clears',target:3,name:'City legend',desc:'Clear 3 districts'},{id:'dashes',target:25,name:'Fast & furrious',desc:'Use dash 25 times'},{id:'profitable',target:1,name:'Self-made DAWG',desc:'Finish a profitable hustle'}];
const savedProfile=read('profile',{}),profile={rep:0,dots:0,caught:0,loot:0,clears:0,dashes:0,profitable:0,theme:'district'};
for(const k of Object.keys(profile)){if(k!=='theme'&&Number.isFinite(savedProfile?.[k])&&savedProfile[k]>=0)profile[k]=Math.floor(savedProfile[k]);}
if(savedProfile?.theme in THEMES&&profile.rep>=THEMES[savedProfile.theme].unlock)profile.theme=savedProfile.theme;
renderer.setTheme(profile.theme);
const kennelDamaged=keepDamaged('kennel',validKennel);
const kennel=new DawgKennel({read,write,open:openDialog,play:selectMode,announce,appearanceChanged:()=>{drawMaze();if(pack.kind==='story')pack.renderStory();else if(pack.game&&pack.kind)pack.renderer.draw(pack.game,pack.kind,performance.now());if(trade)drawCity(performance.now());}});
const mobile=new MobileControls({direction,dash,pause:togglePause,exit:returnToArcade,settings:()=>openDialog('settingsDialog'),rotate:()=>pauseForInterruption('PAUSED · SCREEN ROTATED')},prefs);
const pack=new ArcadePack(face,{read,write,prefs,share:(id,score,o)=>shareRun(id,score,o),prepare:(kind,g,force=false)=>kennel.prepare(kind,g,force),sound,soundOn:()=>soundEnabled,soundToggle:()=>$('soundButton').click(),confirm,best:kind=>records[kind]||0,record:(kind,score,rep)=>{const prevBest=records[kind]||0;finishRun(kind,score,kind==='runner'?pack.game?.coins||0:0);queueResults(kind,score,kind==='story'?{prevBest,detail:'ending: '+(pack.story?.result?.title||'').toLowerCase(),again:'NEW EPISODE ↻'}:{prevBest,detail:pack.statLine().toLowerCase()});kennel.record(kind,score);records[kind]=Math.max(records[kind]||0,score);records.runs=(records.runs||0)+1;write('records',records);awardPassport();if(rep){earnRep(rep);profileDirty=true;renderProgress();saveProfile();}}});
renderer.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches||prefs.fx==='low';
function sound(freq=440,length=.08,type='sine',gain=.035){if(!soundEnabled)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();const o=audioContext.createOscillator(),g=audioContext.createGain();o.type=type;o.frequency.setValueAtTime(freq,audioContext.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*.6),audioContext.currentTime+length);g.gain.setValueAtTime(Math.max(.0011,gain*(prefs.volume??.8)),audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+length);o.connect(g);g.connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+length);}catch{}}
function updateSound(){$('settingsSound').textContent=soundEnabled?'ON':'OFF';$('settingsSound').setAttribute('aria-pressed',String(soundEnabled));$('soundButton').innerHTML=`♫ <span>${soundEnabled?'ON':'OFF'}</span>`;$('soundButton').setAttribute('aria-label',`Turn sound ${soundEnabled?'off':'on'}`);$('soundButton').title=`Turn sound ${soundEnabled?'off':'on'}`;}
$('soundButton').onclick=()=>{soundEnabled=!soundEnabled;write('sound',soundEnabled);updateSound();sound(660,.15);};updateSound();
function drawMaze(){renderer.draw(game,performance.now());}
function updateHud(){mobile.sync(game,mode,!!countdownUntil);$('quickPlayButton').innerHTML=(game.status==='ready'?'PLAY NOW':game.status==='over'?'RUN IT BACK':'RESUME RUN')+' <span>↗</span>'; const palette=renderer.palette(game);document.documentElement.style.setProperty('--world',palette.color);document.documentElement.style.setProperty('--world-secondary',palette.secondary);$('districtName').textContent=game.district.name.toUpperCase();$('districtSector').textContent='SECTOR '+String(game.level).padStart(2,'0');const ready=game.dashCooldown<=0;$('dashLabel').textContent=ready?'DASH READY':`RECHARGING ${game.dashCooldown.toFixed(1)}s`;$('dashCharge').style.width=(1-game.dashCooldown/game.dashRecharge)*100+'%';$('dashButton').classList.toggle('ready',ready);$('dashButton').disabled=!ready||!['playing','ready'].includes(game.status);$('liveIntel').textContent=game.loot?`GOLD BAG LIVE · ${Math.ceil(game.loot.time)}s left. Get it for +${game.loot.value} points.`:game.power>0?`BEAST MODE · ${game.power.toFixed(1)}s. Stack rival catches for bigger bonuses.`:'Gold bags appear after 80 and 160 pickups. Grab each one before its 12-second timer runs out.';$('score').textContent=padded(game.score);$('levelLabel').textContent=isTimed(mode)?'TIME LEFT':'LEVEL';$('level').textContent=isTimed(mode)?`${Math.ceil(game.time)}s`:String(game.level).padStart(2,'0');$('livesLabel').textContent=isTimed(mode)?'HIT PENALTY':'LIVES';$('lives').textContent=isTimed(mode)?'−150':Array(game.lives).fill('♥').join(' ');const progress=Math.round((1-game.pellets.size/game.total)*100);$('progressPercent').textContent=progress+'%';$('progressFill').style.width=progress+'%';$('powerFlash').hidden=game.power<=0||game.status!=='playing';$('powerFlash').querySelector('span').textContent=game.power.toFixed(1)+'s';$('pauseButton').disabled=!['playing','paused'].includes(game.status);$('pauseButton').textContent=game.status==='paused'?'▷':'Ⅱ';$('pauseButton').setAttribute('aria-label',game.status==='paused'?'Resume game':'Pause game');$('gameStatus').textContent=({ready:'READY WHEN YOU ARE',playing:game.power>0?'BEAST MODE · GO GET THEM':'DAWG IS ON THE MOVE',paused:'TAKE A BREATHER',over:'ANOTHER NIGHT. ANOTHER RUN.',level:'BLOCK CLEARED. KEEP IT MOVING.'})[game.status];}
function overlay(badge,title,text,button,hint='ARROW KEYS / WASD / SWIPE'){$('overlay').hidden=false;$('overlayBadge').textContent=badge;$('overlayTitle').innerHTML=title;$('overlayText').textContent=text;$('playButton').innerHTML=button+' <span>↗</span>';$('overlayHint').textContent=hint;}
function showState(){
 updateHud();$('overlay').classList.remove('results');$('runRecap').hidden=true;$('mazeShare').hidden=true;$('overlayHome').hidden=true;
 if(countdownUntil){$('overlay').hidden=true;$('countdownLayer').hidden=false;return;}
 $('countdownLayer').hidden=true;
 if(game.status==='playing'){$('overlay').hidden=true;return;}
 if(game.status==='ready')overlay(mode==='daily'?challenge.name.toUpperCase():isTimed(mode)?'60 SECONDS. MAKE THEM COUNT.':"PLAYER ONE, YOU'RE UP",isTimed(mode)?'FULL SEND.<br>NO LIMITS.':'LET THE<br>DAWG OUT.',mode==='daily'?challenge.description:isTimed(mode)?'One minute. Infinite attitude.':'Big eyes. Bigger appetite.',"LET'S PLAY",mobile.coarse()?'JOYSTICK / SWIPE / TAP TO DASH':'ARROW KEYS / WASD / SHIFT TO DASH');
 if(game.status==='paused'){overlay('YOUR RUN IS SAFE','PAWS<br>FOR A SEC.','Ready when you are.','KEEP GOING',mobile.coarse()?'YOUR RUN SAVES ON THIS DEVICE':'SPACE / P TO RESUME');$('overlayHome').hidden=!mobile.active;}
 if(game.status==='level')overlay('CLEAN SWEEP · +500 POINTS','BLOCK<br>CONQUERED.',`${game.district.name} cleared. New streets. Bigger challenges.`,'NEXT DISTRICT',isTimed(mode)?`${Math.ceil(game.time)} SECONDS REMAINING`:'KEEP THE STREAK ALIVE');
 if(game.status==='over'){
  recordArcade();$('overlay').classList.add('results');
  overlay(runOutcome?.newBest?'NEW PERSONAL BEST':isTimed(mode)?"TIME'S UP, DAWG.":'THE PACK CAUGHT UP.',`${game.score.toLocaleString()}<span class="score-unit"> POINTS</span>`,mode==='daily'?challenge.name+' · '+challenge.day:'Another night. Another story.','PLAY AGAIN','ONE MORE SHOT AT YOUR BEST');
  const medals=['NO MEDAL YET','BRONZE MEDAL','SILVER MEDAL','GOLD MEDAL'];
  const next=challenge.targets.find(n=>n>game.score);
  const note=mode==='daily'?`${medals[medalFor(game.score,challenge.targets)]}${runOutcome?.reward?' · +'+runOutcome.reward+' REP':next?' · '+(next-game.score)+' TO NEXT MEDAL':' · CITY CONQUERED'}`:runOutcome?.newBest?'✦ YOU SET THE SCORE TO BEAT':`${Math.max(0,(records[mode]||0)-game.score)} POINTS FROM YOUR PERSONAL BEST`;
  $('runRecap').innerHTML=`<div class="recap-stat"><strong>${game.stats.dots}</strong><span>COINS</span></div><div class="recap-stat"><strong>${game.stats.caught}</strong><span>RIVALS</span></div><div class="recap-stat"><strong>${game.stats.loot}</strong><span>GOLD BAGS</span></div><div class="recap-medal">${note}</div>`;
  $('runRecap').hidden=false;$('mazeShare').hidden=!(game.score>0);$('overlayHome').hidden=!mobile.active;
 }
}
function recordArcade(){
 if(scoreRecorded)return;scoreRecorded=true;
 const best=mode==='daily'?(dailyRecords[challenge.day]?.best||0):(records[mode]||0);
 runOutcome={newBest:game.score>best,reward:0};
 if(mode==='daily'){
  const result=dailyResult(dailyRecords[challenge.day],game.score,challenge.targets);dailyRecords[challenge.day]=result.record;runOutcome.reward=result.reward;
  for(const key of Object.keys(dailyRecords).sort().slice(0,-14))delete dailyRecords[key];
  write('daily',dailyRecords);if(result.reward){earnRep(result.reward);profileDirty=true;renderProgress();saveProfile();}renderDaily();
 }
 {const prevBest=mode==='daily'?(dailyRecords[challenge.day]?.best||0):(records[mode]||0);finishRun(mode,game.score);queueResults(mode,game.score,{prevBest,detail:`${game.stats.dots} coins · ${game.stats.caught} rivals · ${game.stats.loot} gold bags`});}kennel.record(mode,game.score);records[mode]=Math.max(records[mode]||0,game.score);records.runs=(records.runs||0)+1;write('records',records);awardPassport();write('mazeRun',null);updateBest();releaseWakeLock();
}
function updateBest(){const best=mode==='daily'?(dailyRecords[challenge.day]?.best||0):(records[mode]||0);$('bestScore').textContent=padded(best);$('recordSubtitle').textContent=mode==='daily'?"TODAY'S PERSONAL BEST":best>0?'THE SCORE TO SETTLE TONIGHT.':'EVERY LEGEND STARTS AT ZERO.';}
function newArcade(){
 cancelCountdown();challenge=dailyChallenge();game=freshMaze(mode,mode==='daily'?challenge:null);renderer.character=kennel.prepare(mode,game,true);
 renderer.reset();scoreRecorded=false;runOutcome=null;write('mazeRun',null);setLaunchText();renderDaily();updateBest();showState();drawMaze();
}
function play(){
 if(document.querySelector('dialog[open]')||countdownUntil||!isMaze())return;
 if(game.status==='over')newArcade();
 if(game.status==='level'){game.nextLevel();game.pause();}
 // Every device plays the maze in the full-screen session (3D corridors on capable devices).
 if(focused)setFocus(false);mobile.enter();
 if(game.status==='playing')return;
 renderer.character=kennel.prepare(mode,game,game.status==='ready');
 countdownUntil=performance.now()+1800;$('countdownNumber').textContent='3';sound(440,.08);showState();canvas.focus({preventScroll:true});
}
$('playButton').onclick=play;
function togglePause(){
 if(!isMaze()||document.querySelector('dialog[open]'))return;
 if(countdownUntil){cancelCountdown();game.status='paused';}
 else if(game.status==='playing')game.pause();else if(game.status==='paused'){play();return;}
 saveProfile();saveCheckpoint();releaseWakeLock();showState();
}
$('pauseButton').onclick=togglePause;
function confirm(title,text,label,action){pack.pause();cancelCountdown();if(game.status==='playing')game.pause();if(isMaze())showState();saveCheckpoint();releaseWakeLock();$('confirmTitle').textContent=title;$('confirmText').textContent=text;$('acceptConfirm').textContent=label;confirmAction=action;$('confirmDialog').showModal();}
$('acceptConfirm').onclick=()=>{const action=confirmAction;confirmAction=null;$('confirmDialog').close();action?.();};$('cancelConfirm').onclick=()=>{$('confirmDialog').close();confirmAction=null;};
$('restartButton').onclick=()=>{if(game.status==='ready'||game.status==='over')newArcade();else confirm('Fresh start?','This resets the current maze run and its score.','RESTART RUN ↗',newArcade);};
// A free run from a shared link: opening a link to a game you haven't unlocked lets you play it
// once on this device. When that run ends, the game's normal play wall applies again.
let trial=null;try{trial=JSON.parse(localStorage.getItem('dawg-trial')||'null');}catch{}if(!GAME_IDS.includes(trial))trial=null;
function trialsUsed(){try{const v=JSON.parse(localStorage.getItem('dawg-trials')||'[]');return Array.isArray(v)?v:[];}catch{return [];}}
function grantTrial(id){if(!GAME_IDS.includes(id)||wallFor(id,arcade,records).open||trialsUsed().includes(id))return false;trial=id;try{localStorage.setItem('dawg-trial',JSON.stringify(id));}catch{}announce('FREE RUN · '+(gameById(id)?.title||id).toUpperCase()+' IS YOURS TO TRY ONCE');return true;}
function wallOf(id){return trial===id||activeMatch?.game===id?{open:true,reason:activeMatch?.game===id?'match':'trial',routes:[]}:wallFor(id,arcade,records);}
// A match with a friend: the game is set up on the match's seed, so both players get the same
// course, and the first run that finishes is sent as this player's score. Matches open their game
// even if it's still locked for this player.
let activeMatch=null,lastRunSeconds=0;
function playMatch(m){for(const d of document.querySelectorAll('dialog[open]'))d.close();shell.show('play');
 if(m.game==='chess'){activeMatch=null;if(mode!=='chess'){activeMatch={id:m.id,game:'chess',player:m.player};selectMode('chess');activeMatch=null;}pack.chess.playOnline(m,(n,a)=>rankings.rpc(n,a));$('chessPanel').scrollIntoView?.({behavior:'smooth',block:'start'});return;}
 activeMatch={id:m.id,game:m.game,player:m.player,seed:m.seed};
 const start=()=>{if(mode!==m.game)return;if(isMaze(m.game)){cancelCountdown();game=new MazeGame(m.game,seededRandom(m.seed),{worldSeed:m.seed});renderer.character=kennel.prepare(mode,game,true);renderer.reset();scoreRecorded=false;runOutcome=null;write('mazeRun',null);setLaunchText();updateBest();showState();drawMaze();play();}
  else{pack.games[m.game]=createQuickGame(m.game,m.seed);pack.select(m.game);pack.play();}
  announce('MATCH VS '+String(m.player).toUpperCase()+' · SAME COURSE');};
 if(mode===m.game)start();else{selectMode(m.game);setTimeout(start,60);}}
async function submitMatch(kind,score){const m=activeMatch;if(!m||m.game!==kind)return;activeMatch=null;
 try{const r=await rankings.rpc('submit_match_score',{p_id:m.id,p_score:Math.max(0,Math.floor(score)||0),p_seconds:Math.max(1,lastRunSeconds)});
  const vs=String(m.player).toUpperCase();announce(r.outcome==='win'?`MATCH WON VS ${vs} · ${fmt(r.my_score)} TO ${fmt(r.their_score)}`:r.outcome==='loss'?`${vs} WINS THE MATCH · ${fmt(r.their_score)} TO ${fmt(r.my_score)}`:r.outcome==='draw'?`MATCH DRAWN WITH ${vs}`:`MATCH SCORE IN · ${fmt(r.my_score)} · WAITING ON ${vs}`);rankings.refreshBadge();}
 catch(error){announce(error.message);}}
function endTrial(id){trial=null;try{localStorage.removeItem('dawg-trial');localStorage.setItem('dawg-trials',JSON.stringify([...trialsUsed().filter(x=>x!==id),id].slice(-20)));}catch{}
 if(wallFor(id,arcade,records).open)return;renderLocks();
 // Back to an open game, with the one you tried showing what it takes to unlock it.
 setTimeout(()=>{selectMode('classic');selectMode(id);},0);}
function selectMode(next){
 if(!GAME_IDS.includes(next))return;if(next===mode){if(shell.preview){shell.preview=null;renderHero();}return;}const wall=wallOf(next);if(!wall.open){shell.preview=next;renderHero();scrollToHero();return;}shell.preview=null;
 const change=()=>{if(document.body.classList.contains('story-focus'))storyFocus(false);
  if(isMaze()){cancelCountdown();game.pause();saveProfile();saveCheckpoint();releaseWakeLock();}
  if(mobile.active)mobile.exit();if(focused)setFocus(false);pack.exit();curve.clear();mode=next;
  $('dailyBrief').hidden=next!=='daily';$('mobileLaunch').hidden=!isMaze();$('arcadePanel').hidden=!isMaze();$('tradePanel').hidden=next!=='trade';
  document.querySelectorAll('[data-mode]').forEach(b=>{const on=b.dataset.mode===next;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  pack.select(PACK_MODES.includes(next)?next:null);
  if(next==='trade'){if(!trade)loadTrade();renderTrade();}
  else if(PACK_MODES.includes(next)){const panel=$(next==='story'?'storyPanel':next==='chess'?'chessPanel':'packPanel');panel.setAttribute('aria-labelledby','tab-'+next);}
  else{$('arcadePanel').setAttribute('aria-labelledby','tab-'+next);if(game.mode!==next)newArcade();else{setLaunchText();renderDaily();updateBest();showState();}}
  renderHero();scrollToHero();
 };
 if(isMaze(next)&&game.mode!==next&&['playing','paused','level'].includes(game.status))confirm('Switch your maze challenge?','This replaces your saved maze run. Your personal records stay saved.','SWITCH MODE ↗',change);else change();
}

document.querySelectorAll('[data-mode]').forEach(b=>{b.onclick=()=>selectMode(b.dataset.mode);b.addEventListener('keydown',e=>{const tabs=[...document.querySelectorAll('[data-mode]')],i=tabs.indexOf(b);if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length;tabs[next].focus();}});});
const keyDirections={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
// 3D maze: runs in the full-screen session; the 2D board stays for the page view and as fallback.
const maze3d={gpu:null,state:'canvas'};
async function upgradeMaze3D(){if(maze3d.state!=='canvas')return;if(typeof WebGL2RenderingContext==='undefined'){maze3d.state='unsupported';return;}maze3d.state='loading';
 try{const {ThreeMaze}=await import('./maze-3d.js');const gpu=new ThreeMaze($('arcadePanel'),()=>{maze3d.state='failed';maze3d.gpu=null;document.body.classList.remove('maze-3d');canvas.style.opacity='';});await gpu.init();if(gpu.ready){maze3d.gpu=gpu;maze3d.state='ready';}else maze3d.state='failed';}catch{maze3d.state='failed';}}
function mazeViewLabel(){const b=$('mazeView');b.textContent=VIEW_LABEL[viewFor(mode,prefs.cameras)];b.setAttribute('aria-label',viewAria(mode,prefs.cameras));}
function drawMaze3D(){mazeViewLabel();const flat=viewFor(mode,prefs.cameras)==='2d',on=mobile.active&&isMaze(),gpu=maze3d.gpu,live=!!(on&&gpu?.ready&&!flat);if(on&&!flat)upgradeMaze3D();document.body.classList.toggle('maze-3d',live);$('mazeView').hidden=!(live||on&&flat&&maze3d.state!=='failed');if(gpu?.view)gpu.view.hidden=!live;if(!live)return false;
 const view=viewFor(mode,prefs.cameras);gpu.setCamera(view);
 try{return gpu.draw(game,renderer.character,renderer.reduced);}catch{gpu.fail();return false;}}
// Corridors feel far faster from the inside, so first person moves everyone at 75% speed.
const FIRST_PERSON_PACE=.62;
function mazeFirstPerson(){return mobile.active&&isMaze()&&maze3d.gpu?.ready&&viewFor(mode,prefs.cameras)==='first';}
function toggleMazeView(){if(!isMaze())return;prefs.cameras={...prefs.cameras,[mode]:nextView(mode,prefs.cameras)};saveSettings();}
$('mazeView').onclick=toggleMazeView;
// Maze curveballs share the pack games' rules: announced, timed, presentation and input only.
const curve=new Curveballs({target:()=>$('maze')?.parentElement,enabled:()=>prefs.curveballs!=='off',reduced:()=>renderer.reduced,cue:(kind,m)=>{if(kind==='warn')sound(520,.12,'square',.03);else if(kind==='start')sound(m.time>1?880:m.time<1?220:660,.35,'sawtooth',.03);else sound(440,.15,'triangle',.025);}});let curveGame=null;
function direction(dir){if(!isMaze()||document.querySelector('dialog[open]'))return;if(game.status==='ready'&&!countdownUntil)play();if(game.status==='playing'||countdownUntil){const g=game,first=mazeFirstPerson();curve.route(dir,d=>{if(g===game)g.direction(first?relativeTurn(g.player.dir,d):d);});}}
window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||!isMaze()||e.ctrlKey||e.metaKey||e.altKey)return;const dir=keyDirections[e.key]||keyDirections[e.key.toLowerCase()];if(dir){e.preventDefault();direction(dir);}else if((e.key==='Shift'||e.key.toLowerCase()==='e')&&!e.repeat){e.preventDefault();dash();}else if(e.key.toLowerCase()==='v'&&!e.repeat&&mobile.active){e.preventDefault();toggleMazeView();}else if(e.key==='Escape'&&mobile.active){returnToArcade();}else if(e.key==='Escape'&&focused){setFocus(false);}else if(e.code==='Space'||e.key.toLowerCase()==='p'){if(e.code==='Space'&&e.target.tagName==='BUTTON')return;e.preventDefault();if(!e.repeat)togglePause();}});
document.querySelectorAll('[data-dir]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();direction(b.dataset.dir);});b.onclick=()=>direction(b.dataset.dir);});
let pointerStart=null;
canvas.addEventListener('pointerdown',e=>{if(pointerStart)return;pointerStart={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!pointerStart||pointerStart.id!==e.pointerId)return;const dx=e.clientX-pointerStart.x,dy=e.clientY-pointerStart.y;if(Math.max(Math.abs(dx),Math.abs(dy))<12)return;direction(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');pointerStart={id:e.pointerId,x:e.clientX,y:e.clientY};});
const release=e=>{if(pointerStart?.id===e.pointerId)pointerStart=null;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseForInterruption('PAUSED · WELCOME BACK WHEN READY');});
window.addEventListener('blur',()=>pauseForInterruption('PAUSED · YOUR RUN IS SAFE'));
function openDialog(id){pack.pause();if(isMaze()){cancelCountdown();if(game.status==='playing')game.pause();showState();saveCheckpoint();releaseWakeLock();}if(id==='settingsDialog')renderSettings();$(id).showModal();}
$('helpButton').onclick=()=>openDialog('helpDialog');$('recordsButton').onclick=()=>{$('achievementsContent').innerHTML=`<div class="badge-grid">${badgesHTML()}</div>`;$('recordsContent').innerHTML=`<div class="record-row"><span>01 / Maze Munch</span><strong>${padded(records.classic||0)}</strong></div><div class="record-row"><span>02 / 60-Second Rush</span><strong>${padded(records.rush||0)}</strong></div><div class="record-row"><span>03 / Street Hustle</span><strong>${records.trade===null||records.trade===undefined?'—':money(records.trade)}</strong></div><div class="record-row"><span>Daily Run / all-time</span><strong>${padded(records.daily||0)}</strong></div>${[['flappy','Flappy DAWG'],['cross','DAWG Cross'],['snake','Neon Snake'],['runner','DAWG Dash'],['story','After Hours']].map(([id,name])=>`<div class="record-row"><span>${name}</span><strong>${padded(records[id]||0)}</strong></div>`).join('')}<div class="record-row"><span>Completed runs</span><strong>${records.runs||0}</strong></div>`;openDialog('recordsDialog');};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
// Street Hustle's scene: the 3D street when it's available, otherwise the 2D city.
const cityScene=sceneFor($('cityCanvas')),hustleChat=new HustleChat();
function drawCity(now){if(!trade)return;const seed=trade.world.seed+trade.district*771;const anchors=cityScene({seed,district:trade.district,look:CITY_LOOKS[trade.district],title:$('citySceneTitle').textContent,tint:worldLook(seed).glow,rain:/rain/i.test($('cityWeather').textContent),dawg:cityRenderer.character,reduced:renderer.reduced,cast:hustleCast(trade)});if(!anchors)cityRenderer.city(trade,now);hustleChat.place(anchors||null);}
// Travel is a drive: a short playable run across town (hustle-drive-3d.js) whose outcome feeds the
// trip. Skipped, turned off, or without WebGL, the trip plays exactly as before.
let hustleDriving=false;
const driveOn=()=>{try{return localStorage.getItem('dawg-hustle-drive')!=='off';}catch{return true;}};
function travelTo(dest){if(!trade||trade.blocked||hustleDriving||!Number.isInteger(dest)||dest===trade.district||trade.day>=30)return;
 if(!driveOn()||typeof WebGL2RenderingContext==='undefined'){tradeAction(()=>trade.travel(dest));return;}
 hustleDriving=true;const t=trade,day=t.day;
 import('./hustle-drive-3d.js').then(m=>m.driveTo({plan:m.drivePlanFor(t,dest),reduced:renderer.reduced,quality:prefs.fx==='low'?'low':undefined,sound:soundEnabled,volume:prefs.volume??.8})).catch(()=>null).then(outcome=>{hustleDriving=false;if(trade!==t||t.day!==day)return;tradeAction(()=>t.travel(dest,outcome));});}
function renderDriveToggle(){const on=driveOn();$('driveToggle').textContent=on?'🚗 Drive between districts · ON':'🚗 Drive between districts · OFF (instant travel)';$('driveToggle').setAttribute('aria-pressed',String(on));}
$('driveToggle').onclick=()=>{try{localStorage.setItem('dawg-hustle-drive',driveOn()?'off':'on');}catch{}renderDriveToggle();};
function validSavedTrade(s){return s?.version===1&&validLivingTrade(s.state);}
function loadTrade(){if(keepDamaged('trade',validSavedTrade))announce('Street Hustle save was damaged. A new campaign started; the old copy was kept.');const saved=read('trade',null);const valid=validSavedTrade(saved);trade=new LivingTradeGame(valid?saved.state:null);enrollTrade(!valid);saveTrade();}
function enrollTrade(fresh=false){cityRenderer.character=kennel.prepare('trade',trade,fresh);if(fresh){trade.cash+=trade.career.cash;trade.world.contract.reward=Math.round(trade.world.contract.reward*(1+trade.career.order));if(trade.career.cash)trade.log('Career Hustle bonus: +$'+trade.career.cash+' starting cash.');}}
function saveTrade(){write('trade',{version:1,state:trade.save()});}
function renderTrade(){const finished=trade.status==='over',over=trade.blocked;renderLivingTrade();renderDriveToggle();$('tradeNotice').hidden=over||trade.day!==30;$('tradeCostNote').hidden=!trade.costEstimated;$('sellAllButton').disabled=over||trade.used===0;$('citySceneTitle').textContent=DISTRICTS[trade.district].name;$('citySceneDesc').textContent=DISTRICTS[trade.district].desc;$('cityRoute').innerHTML=DISTRICTS.map((d,i)=>`<button class="route-stop ${i===trade.district?'current':''}" data-route="${i}" ${over||i===trade.district||trade.day>=30?'disabled':''} aria-label="Travel to ${d.name}, one night"><i></i>${d.name}</button>`).join('');$('tradeDay').innerHTML=`${String(trade.day).padStart(2,'0')}<span>/ 30</span>`;$('tradeCash').textContent=money(trade.cash);$('tradeWorth').textContent=money(trade.netWorth);$('tradeDebt').textContent=money(trade.debt);$('tradeBag').textContent=`${trade.used} / ${trade.capacity}`;$('safeBalance').textContent=money(trade.bank);$('marketName').textContent=DISTRICTS[trade.district].name;$('heatText').textContent=Math.round(trade.heat)+'%';$('heatFill').style.width=trade.heat+'%';$('tradeEvent').textContent=trade.event;
 $('marketRows').innerHTML=GOODS.map((g,i)=>{const ratio=Math.round((trade.prices[i]/g.base-1)*100),low=ratio<=0;return `<div class="market-row"><div class="good-info"><span class="good-icon" style="color:${g.color}">${g.icon}</span><div><strong>${g.name}</strong><small style="color:${low?'#a3c764':'#dca07a'}">${low?'↘':'↗'} ${Math.abs(ratio)}% VS BASE</small><small class="stock-level">${trade.stock[i]} IN LOCAL STOCK</small></div></div><span class="market-price">${money(trade.prices[i])}${priceSpark(i)}</span><span class="stash-count">${trade.bag[i]}${trade.bag[i]?`<small class="cost-basis ${trade.prices[i]>=trade.averageCost(i)?'gain':'loss'}">AVG ${money(trade.averageCost(i))}<br>${trade.prices[i]>=trade.averageCost(i)?'+':'−'}${money(Math.abs(trade.prices[i]-trade.averageCost(i)))} / UNIT</small>`:''}</span><div class="trade-actions"><button data-buy="${i}" aria-label="Buy ${g.name}" ${over||trade.stock[i]===0||trade.cash<trade.prices[i]||trade.used>=trade.capacity?'disabled':''}>BUY</button><button data-sell="${i}" aria-label="Sell ${g.name}" ${over||!trade.bag[i]?'disabled':''}>SELL</button></div></div>`;}).join('');
 $('districts').innerHTML=DISTRICTS.map((d,i)=>`<button class="district ${i===trade.district?'current':''}" data-district="${i}" ${over||i===trade.district||trade.day>=30?'disabled':''}><span>${d.name}<small>${i===trade.district?'YOU ARE HERE':`${Math.round(trade.travelRisk(i)*100)}% ENCOUNTER RISK`}</small></span><span>${i===trade.district?'HERE':'↗'}</span></button>`).join('');
 $('tradeLog').replaceChildren();trade.logs.forEach(l=>{const row=document.createElement('div');row.className='log-row';const label=document.createElement('span');label.textContent=`NIGHT ${String(l.day).padStart(2,'0')}`;row.append(label,document.createTextNode(l.message));$('tradeLog').append(row);});
 $('repayButton').disabled=over||trade.cash<=0||trade.debt<=0;$('depositButton').disabled=over||trade.cash<=0;$('withdrawButton').disabled=over||trade.bank<=0;$('upgradeButton').disabled=over||trade.cash<1200||trade.capacity>=90;$('upgradeButton').textContent=trade.capacity>=90?'Bag maxed · 90 slots':'Bigger bag · $1,200';$('cashoutButton').disabled=over;$('cashoutButton').innerHTML=trade.day===30?'FINAL NIGHT · CASH OUT <span>↗</span>':'CASH OUT & FINISH <span>↗</span>';$('tradeFinished').hidden=!finished;if(finished){$('tradeResultTitle').textContent=trade.netWorth>=20000?'The block knows your name.':trade.netWorth>=0?'Came up. Cashed out.':'The city got this round.';$('tradeResultScore').textContent=money(trade.netWorth);$('tradeResultText').textContent=`Final net worth after ${trade.day} ${trade.day===1?'night':'nights'}. ${trade.debt>0?`${money(trade.debt)} debt remains.`:'Debt cleared. Respect earned.'}`;}}
function priceSpark(i){const values=trade.world.history.map(h=>h[i]),lo=Math.min(...values),hi=Math.max(...values),points=values.map((v,j)=>`${2+j*50/Math.max(1,values.length-1)},${14-(v-lo)/Math.max(1,hi-lo)*12}`).join(' ');return `<svg class="price-trend" viewBox="0 0 54 16" role="img" aria-label="Your last ${values.length} visited market prices"><polyline points="${points}" fill="none" stroke="#b8a2df" stroke-width="1.5"/></svg>`;}
function renderLivingTrade(){
 const w=trade.world,c=w.contract,encounter=trade.encounter();renderMarketIntel();
 $('tradePerks').innerHTML=TRADE_PERKS.map(p=>`<div class="trade-perk"><h4>${p.name}</h4><p>${p.description}</p><button data-perk="${p.id}" ${trade.blocked||trade.hasPerk(p.id)||trade.cash<p.cost?'disabled':''}>${trade.hasPerk(p.id)?'✓ EQUIPPED':money(p.cost)+' · EQUIP'}</button></div>`).join('');
 $('cityWeather').textContent=trade.cityWeather.toUpperCase()+' · '+w.reputation+' LOCAL REP · CITY '+w.seed.toString(36).toUpperCase();
 $('tradeNews').textContent=w.news;
 const tip=w.lastTalk===trade.day?trade.logs.find(l=>l.day===trade.day&&l.message.startsWith('Street wire:')):null;$('wireReport').hidden=!tip;$('wireReport').textContent=tip?.message||'';
 $('tradeRivals').textContent=w.rivals.map(r=>trade.rivalName(r)+' → '+DISTRICTS[r.district].name).join(' · ');
 $('streetWire').disabled=trade.blocked||w.lastTalk===trade.day;
 $('streetWire').textContent=w.lastTalk===trade.day?'WIRE CHECKED TONIGHT':'ASK THE STREET WIRE ↗';
 $('orderTitle').textContent=c.quantity+' '+GOODS[c.good].name+' → '+DISTRICTS[c.destination].name;
 $('orderDetail').textContent=c.status==='done'?'Delivered. Your contact will have a new lead next night.':c.status==='expired'?'This order expired. A new contact will arrive next night.':`Pays ${money(c.reward)} total · deliver by night ${c.deadline} · ${trade.bag[c.good]} / ${c.quantity} in your bag. Orders consume the goods and add 12 local reputation.`;
 $('deliverOrder').disabled=trade.blocked||c.status!=='open'||trade.day>c.deadline||trade.district!==c.destination||trade.bag[c.good]<c.quantity;
 $('tradeEncounter').hidden=!encounter;
 $('encounterOptions').replaceChildren();
 if(encounter){$('encounterTitle').textContent=encounter.title;$('encounterText').textContent=encounter.text;for(const option of encounter.options){const b=document.createElement('button'),title=document.createElement('strong'),detail=document.createElement('small');b.dataset.encounter=option.id;b.disabled=!!option.disabled;title.textContent=option.label;detail.textContent=option.detail;b.append(title,detail);$('encounterOptions').append(b);}}
 hustleChat.render(trade);cityRenderer.reduced=renderer.reduced;drawCity(performance.now());
}
function renderMarketIntel(){const i=Math.max(0,Math.min(5,Number($('intelGood').value)||0)),quotes=trade.world.markets.map(m=>m.prices[i]),lo=Math.min(...quotes),hi=Math.max(...quotes),basis=trade.averageCost(i);$('marketIntel').innerHTML=DISTRICTS.map((d,j)=>{const m=trade.world.markets[j],difference=m.prices[i]-basis;return `<article class="intel-place"><h4>${d.name}</h4><b>${money(m.prices[i])}</b><em>${m.prices[i]===lo?'LOWEST QUOTE':m.prices[i]===hi?'HIGHEST QUOTE':'CURRENT QUOTE'}</em><small>${m.stock[i]} units available</small><small>${trade.bag[i]?`${difference>=0?'+':'−'}${money(Math.abs(difference))} / unit vs your cost`:'No units in your bag'}</small><button data-intel="${j}" ${trade.blocked||j===trade.district||trade.day>=30?'disabled':''}>${j===trade.district?'YOU ARE HERE':'TRAVEL · '+Math.round(trade.travelRisk(j)*100)+'% RISK'}</button></article>`;}).join('');}
$('intelGood').addEventListener('change',()=>{if(trade)renderMarketIntel();});
$('marketIntel').addEventListener('click',e=>{const b=e.target.closest('[data-intel]');if(b&&!b.disabled)travelTo(Number(b.dataset.intel));});
$('tradePerks').addEventListener('click',e=>{const b=e.target.closest('[data-perk]');if(!b||b.disabled)return;const p=TRADE_PERKS.find(p=>p.id===b.dataset.perk);if(p)confirm('Equip '+p.name+'?',p.description+' Costs '+money(p.cost)+' from your carried cash. This upgrade lasts for the current campaign.','EQUIP ↗',()=>tradeAction(()=>trade.buyPerk(p.id)));});
$('streetWire').onclick=()=>tradeAction(()=>trade.talk());
$('deliverOrder').onclick=()=>tradeAction(()=>trade.deliver());
$('encounterOptions').addEventListener('click',e=>{const b=e.target.closest('[data-encounter]');if(b&&!b.disabled)tradeAction(()=>trade.resolve(b.dataset.encounter));});
function tradeAction(fn){const before=trade.logs[0];const result=fn();saveTrade();renderTrade();if(trade.world.pending)$('tradeEncounter').scrollIntoView({behavior:renderer.reduced?'auto':'smooth',block:'center'});$('marketFeedback').textContent=trade.logs[0]!==before?trade.logs[0].message:'No trade made. Check your cash, bag space, and selected quantity.';if(result!==false&&result!==0)sound(360,.055);}
$('marketRows').addEventListener('click',e=>{const buy=e.target.closest('[data-buy]'),sell=e.target.closest('[data-sell]');if(buy&&!buy.disabled)tradeAction(()=>trade.buy(Number(buy.dataset.buy),quantity));if(sell&&!sell.disabled)tradeAction(()=>trade.sell(Number(sell.dataset.sell),quantity));});
$('districts').addEventListener('click',e=>{const b=e.target.closest('[data-district]');if(b&&!b.disabled)travelTo(Number(b.dataset.district));});
document.querySelectorAll('[data-qty]').forEach(b=>b.onclick=()=>{quantity=b.dataset.qty==='max'?'max':Number(b.dataset.qty);document.querySelectorAll('[data-qty]').forEach(a=>{a.classList.toggle('selected',a===b);a.setAttribute('aria-pressed',String(a===b));});});
$('sellAllButton').onclick=()=>confirm('Sell your whole bag?',`Sell ${trade.used} units at this market for ${money(trade.inventoryValue)}. This keeps your run going.`,'SELL ALL ↗',()=>tradeAction(()=>trade.sellAll()));
$('repayButton').onclick=()=>tradeAction(()=>trade.repay());$('depositButton').onclick=()=>tradeAction(()=>trade.deposit());$('withdrawButton').onclick=()=>tradeAction(()=>trade.withdraw());$('upgradeButton').onclick=()=>tradeAction(()=>trade.upgrade());
function finishTrade(){if(trade.status==='over')return;if(!trade.finish())return;queueResults('trade',trade.netWorth,{prevBest:records.trade||0,unit:'NET WORTH',format:money,detail:'night '+trade.day,again:'NEW CAMPAIGN ↻'});finishRun('trade',trade.netWorth);kennel.record('trade',trade.netWorth,{day:trade.day});if(trade.netWorth>0){profile.profitable++;earnRep(100+Math.min(500,Math.floor(trade.netWorth/100)));profileDirty=true;checkBadges();renderProgress();saveProfile();}records.trade=records.trade==null?trade.netWorth:Math.max(records.trade,trade.netWorth);records.runs=(records.runs||0)+1;write('records',records);awardPassport();saveTrade();renderTrade();$('tradeFinished').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});sound(720,.2);}
$('cashoutButton').onclick=()=>confirm('Call it a night?',`Your stash will sell at today's prices, savings will be withdrawn, and debt will be paid as far as possible. Final net worth: ${money(trade.netWorth)}. This ends the run.`,'CASH OUT ↗',finishTrade);
function freshTrade(){trade=new LivingTradeGame();enrollTrade(true);saveTrade();renderTrade();$('marketFeedback').textContent='New hustle. Start with a small buy, then travel to find a better price.';$('tradePanel').scrollIntoView({behavior:'smooth',block:'start'});}
const restartTrade=()=>trade?.status==='over'?freshTrade():confirm('A new night. A new hustle.','Your current Street Hustle progress will be replaced. Your completed records will stay saved.','NEW HUSTLE ↗',freshTrade);
$('newTradeButton').onclick=restartTrade;$('againTradeButton').onclick=freshTrade;
function processEvents(){
 for(const event of game.events){
  renderer.event(event,game);maze3d.gpu?.event(event,game);if(event.type==='dash')mobile.haptic(12);if(event.type==='power')mobile.haptic(18);if(event.type==='eat'||event.type==='loot')mobile.haptic([12,20,12]);if(event.type==='hit')mobile.haptic([30,25,20]);if(event.type==='heat'){toast(heatLabel(event.tier));sound(560+event.tier*110,.2,'square',.028);mobile.haptic([10,30,10]);}if(event.type==='interrupted'){releaseWakeLock();saveCheckpoint();toast('PAUSED · READY WHEN YOUR DEVICE IS');}
  if(event.type==='pellet'){profile.dots++;earnRep(1);if(game.pellets.size%2===0)sound(240+game.pellets.size%3*80,.035,'sine',.018);}
  if(event.type==='power'){profile.dots++;earnRep(5);sound(880,.22,'triangle');toast('BEAST MODE · THE HUNTER IS YOU');}
  if(event.type==='eat'){profile.caught++;earnRep(25);sound(600,.15,'square',.018);toast(`${event.combo>1?event.combo+'× COMBO · ':''}RIVAL CAUGHT · +${event.bonus}`);}
  if(event.type==='dash'){profile.dashes++;sound(190,.18,'sawtooth',.018);}
  if(event.type==='loot'){profile.loot++;earnRep(30);sound(1050,.22,'triangle');toast(`BAG SECURED · +${event.bonus}`);}
  if(event.type==='lootSpawn'){sound(750,.12,'triangle');toast('GOLD BAG DROP · YOU HAVE 12 SECONDS');}
  if(event.type==='hit'){sound(130,.28,'sawtooth',.025);toast(isTimed(mode)?'CAUGHT · −150 POINTS':'CAUGHT · KEEP YOUR HEAD UP');}
  if(event.type==='level'){profile.clears++;earnRep(100);sound(1000,.3,'triangle');}
  if(event.type==='over')sound(180,.4,'triangle');
 }
 if(game.events.length){profileDirty=true;checkBadges();renderProgress();}
 game.events=[];
}
function toast(text){$('gameToast').textContent=text;$('gameToast').classList.add('visible');toastUntil=performance.now()+1800;}
function frame(now){
 const dt=lastTime?(now-lastTime)/1000:0;lastTime=now;blinkTime=now/1000;
 if(countdownUntil){const remaining=countdownUntil-now;if(remaining<=0){countdownUntil=0;game.start();sound(880,.13);showState();requestWakeLock();}else $('countdownNumber').textContent=String(Math.ceil(remaining/600));}
 if(isMaze()){
  const prior=game.status;if(game!==curveGame){curveGame=game;curve.reset();}curve.tick(dt,game.status==='playing'&&!countdownUntil);game.pace=mazeFirstPerson()?FIRST_PERSON_PACE:1;if(!countdownUntil)advanceGame(game,dt*curve.timeScale);if(game.status==='over')curve.clear();processEvents();if(prior!==game.status)showState();
  if(now-lastHud>80){updateHud();lastHud=now;}if(drawMaze3D())canvas.style.opacity='0';else{canvas.style.opacity='';renderer.draw(game,now);}if(now>toastUntil)$('gameToast').classList.remove('visible');
 }
 if(PACK_MODES.includes(mode))pack.frame(now);
 if(mode==='trade'&&trade&&!document.hidden&&!hustleDriving&&now-lastCityFrame>83){cityRenderer.reduced=renderer.reduced;drawCity(now);lastCityFrame=now;}
 trackPlay(now,dt);
 if(isMaze()){const on=game.status==='playing'&&soundEnabled&&!document.hidden;if(on){music.setTrack(mode);music.setVolume(prefs.volume??.8);}music.setPlaying(on);}else if(mode==='trade'&&!hustleDriving)music.setPlaying(false);
 if(now-lastProfileSave>2000){saveProfile();saveCheckpoint();lastProfileSave=now;}
 requestAnimationFrame(frame);
}
function dash(){if(!isMaze()||countdownUntil||document.querySelector('dialog[open]'))return;if(game.status==='ready'){play();return;}game.dash();}
$('dashButton').onclick=dash;
function saveProfile(){if(!profileDirty)return;write('profile',profile);profileDirty=false;}
let achievementTimer=0;
// Play time counts only while a run is live (or, for the menu games, while the player is
// interacting) and the page is visible. Leaving a game mid-run still banks the time.
let runClock={game:null,seconds:0,startedAt:0},lastInput=-1e9;
for(const type of ['pointerdown','keydown'])window.addEventListener(type,()=>{lastInput=performance.now();},{passive:true,capture:true});
function activeGame(now){if(document.hidden||document.querySelector('dialog[open]'))return null;if(isMaze())return game.status==='playing'?mode:null;if(mode==='trade'||mode==='story'||mode==='chess')return now-lastInput<30000?mode:null;return pack.game?.status==='playing'?mode:null;}
function trackPlay(now,dt){const id=activeGame(now);if(!id)return;if(runClock.game!==id){if(runClock.game&&runClock.seconds>=5)finishRun(runClock.game,0);runClock={game:id,seconds:0,startedAt:Date.now()};}runClock.seconds+=Math.min(.25,Math.max(0,dt));
 if((id==='trade'||id==='story'||id==='chess')&&runClock.seconds>=120)finishRun(id,0);}
function finishRun(kind,score,gold=0){
 const mine=runClock.game===kind,seconds=mine?Math.round(runClock.seconds):0,startedAt=mine?runClock.startedAt:Date.now();runClock={game:null,seconds:0,startedAt:0};lastRunSeconds=seconds;
 const run={game:kind,score:Math.max(0,Math.floor(score)||0),target:DISCIPLINES.find(d=>d.id===kind)?.target||1000,seconds,gold},xp=addRun(arcade,run),opened=settleUnlocks(arcade,records);write('arcade',arcade);
 cloud.recordRun({game:kind,day:localDay(),startedAt:new Date(startedAt).toISOString(),endedAt:new Date(Math.max(Date.now(),startedAt)).toISOString(),seconds,score:run.score,xp,gold});
 renderLocks();for(const id of opened)announce('UNLOCKED · '+(gameById(id)?.title||id).toUpperCase()+' ↗');
 lastRun={kind,xp};if(run.score>0&&kind!=='story'&&kind!=='trade')showInsight(kind,run.score);renderToday();
}
function renderLocks(){shell.cards(id=>wallOf(id));const lv=$('accountLevel');if(lv)lv.textContent='LV '+levelOf(arcade.xp);if(shell.preview&&wallOf(shell.preview).open){shell.preview=null;}}
// Bring the hero into view after picking a game further down the page.
function scrollToHero(){const hero=$('playHero');if(!hero.getBoundingClientRect)return;const top=hero.getBoundingClientRect().top;if(top<0||top>window.innerHeight*.5)$('playHero').scrollIntoView({behavior:renderer.reduced?'auto':'smooth',block:'start'});}
function showWall(id,wall){
 $('wallTitle').textContent=(gameById(id)?.title||id)+' is locked';const list=$('wallRoutes');list.replaceChildren();
 for(const r of wall.routes){const row=document.createElement('div');row.className='wall-route'+(r.done?' done':'');const head=document.createElement('header'),label=document.createElement('span'),left=document.createElement('small'),bar=document.createElement('div'),fill=document.createElement('i');
  label.textContent=r.label;left.textContent=r.done?'DONE':r.left.toUpperCase();bar.className='bar';fill.style.setProperty('--p',Math.min(100,Math.round(r.have/r.need*100))+'%');bar.append(fill);head.append(label,left);row.append(head,bar);list.append(row);}
 const s=statsOf(arcade);$('wallStats').textContent='LEVEL '+s.level+' · '+arcade.xp+' XP · '+s.minutes+' MIN PLAYED · BEST STREAK '+s.streak+' DAY'+(s.streak===1?'':'S');openDialog('wallDialog');
}
function renderAccount(status=cloud.status,detail='',account=cloud.account()){
 const st=$('accountStatus');if(!st)return;st.dataset.state=status;const dot=$('cloudDot');if(dot)dot.dataset.state=status;st.textContent=status==='online'?(account?.guest?'● CLOUD SAVE ON · GUEST':'● CLOUD SAVE ON · '+account?.email):status==='syncing'?'● SYNCING…':'● OFFLINE · PROGRESS SAVED ON THIS DEVICE'+(detail?' ('+detail+')':'');
 const s=statsOf(arcade),next=xpForLevel(s.level+1);$('accountSummary').textContent='Level '+s.level+' · '+arcade.xp+'/'+next+' XP · '+s.minutes+' min played · best streak '+s.streak+' day'+(s.streak===1?'':'s')+'.';
 $('accountGuest').hidden=!!account&&!account.guest;$('accountMember').hidden=!account||account.guest;$('accountDelete').disabled=!account;
 if(account?.pendingEmail)$('accountNote').textContent='Check '+account.pendingEmail+' and open the link to finish saving your progress.';
}
function announce(message,label=/^UNLOCKED/.test(message)?'NEW GAME OPEN':/unlocked$/i.test(message)||/^Badge unlocked/.test(message)?'STREET REP EARNED':'DAWG ARCADE'){const small=$('achievementToast').querySelector('small');if(small)small.textContent=label;$('achievementToast').querySelector('strong').textContent=message;$('achievementToast').hidden=false;clearTimeout(achievementTimer);achievementTimer=setTimeout(()=>$('achievementToast').hidden=true,3800);}
function earnRep(amount){const before=profile.rep;profile.rep+=amount;for(const t of Object.values(THEMES))if(t.unlock>before&&t.unlock<=profile.rep)announce(t.name+' unlocked');}
const earnedBadges=new Set(BADGES.filter(b=>profile[b.id]>=b.target).map(b=>b.id));
function checkBadges(){for(const b of BADGES)if(profile[b.id]>=b.target&&!earnedBadges.has(b.id)){earnedBadges.add(b.id);announce('Badge unlocked: '+b.name);}}
function badgesHTML(){return BADGES.map(b=>`<div class="badge ${profile[b.id]>=b.target?'earned':''}"><b>${profile[b.id]>=b.target?'✦ UNLOCKED':'◇ IN PROGRESS'}</b>${b.name}<small style="display:block;margin-top:6px;font-size:8px;line-height:1.6">${b.desc} · ${Math.min(profile[b.id],b.target)}/${b.target}</small></div>`).join('');}
function awardPassport(){const result=updatePassport(passport,records);passport=result.state;write('passport',passport);if(result.reward){earnRep(result.reward);profileDirty=true;$('passportReward').textContent=(result.completed?'CITY LEGEND · ':result.unlocked.map(s=>s.name).join(' · ')+' · ')+'+'+result.reward+' REP';renderProgress();saveProfile();}else renderPassport();}
function renderPassport(){const owned=passport?.stamps||[];$('passportCount').textContent=owned.length+' / '+STAMPS.length+(passport?.complete?' ✦':'');$('passportStamps').innerHTML=STAMPS.map(m=>{const earned=owned.includes(m.id),best=Math.max(0,records[m.id]||0),pct=Math.min(100,best/m.target*100),goal=m.id==='story'?'Finish any ending':m.id==='trade'?'Finish with '+money(m.target)+' net worth':m.target.toLocaleString()+' points in one completed run';return `<button class="passport-stamp ${earned?'earned':''}" data-passport="${m.id}" aria-label="${m.game}: ${earned?'stamp earned':goal}. Open game."><i>${earned?'✓':m.icon}</i><b>${m.game}</b><small>${earned?m.name+' · STAMP EARNED':goal}</small><div class="passport-track"><span style="width:${earned?100:pct}%"></span></div><small>${earned?'100 REP CLAIMED':m.id==='story'?'YOUR NEXT STORY AWAITS':'BEST '+(m.id==='trade'?money(records.trade||0):best.toLocaleString())+' · +100 REP'}</small></button>`;}).join('');}
$('passportStamps').addEventListener('click',e=>{const b=e.target.closest('[data-passport]');if(!b)return;selectMode(b.dataset.passport);if(mode===b.dataset.passport)$(mode==='story'?'storyPanel':mode==='chess'?'chessPanel':mode==='trade'?'tradePanel':PACK_MODES.includes(mode)?'packPanel':'mobileLaunch').scrollIntoView({behavior:renderer.reduced?'auto':'smooth',block:'start'});});
function renderProgress(){
 renderPassport();
 const rep=profile.rep,next=Object.values(THEMES).find(t=>t.unlock>rep);
 $('rankName').textContent=rep>=3000?'After Hours Legend':rep>=1800?'City Royalty':rep>=900?'Pack Leader':rep>=300?'Street Regular':'Fresh on the block';
 $('xpText').textContent=rep.toLocaleString()+' REP';$('nextUnlock').textContent=next?`${next.unlock-rep} TO ${next.name.toUpperCase()}`:'ALL COLORS UNLOCKED';$('xpFill').style.width=(next?Math.min(100,rep/next.unlock*100):100)+'%';
 $('missionList').innerHTML=BADGES.slice(0,3).map(b=>`<div class="mission-item ${profile[b.id]>=b.target?'complete':''}"><div class="mission-title">${b.name}<span>${profile[b.id]>=b.target?'✓':Math.min(profile[b.id],b.target)+' / '+b.target}</span></div><small>${b.desc}</small><div class="progress-track"><i style="width:${Math.min(100,profile[b.id]/b.target*100)}%"></i></div></div>`).join('');
 $('themeGrid').innerHTML=Object.entries(THEMES).map(([id,t])=>`<button data-theme="${id}" class="theme-swatch ${id===profile.theme?'selected':''} ${rep<t.unlock?'locked':''}" style="--swatch:${t.color};--swatch-bg:${t.color}20" title="${t.name}${rep<t.unlock?' · '+t.unlock+' rep required':''}" aria-label="${t.name}${rep<t.unlock?' locked, '+t.unlock+' rep required':''}" aria-pressed="${id===profile.theme}" ${rep<t.unlock?'disabled':''}>${rep<t.unlock?'<span>◇</span>':''}</button>`).join('');
 $('lockerThemes').innerHTML=Object.entries(THEMES).map(([id,t])=>`<button class="locker-theme ${id===profile.theme?'selected':''}" data-theme="${id}" aria-pressed="${id===profile.theme}" ${rep<t.unlock?'disabled':''}><span class="theme-chip" style="--swatch:${t.color}"></span><span><strong>${t.name}</strong><small>${rep<t.unlock?t.unlock+' REP TO UNLOCK':id===profile.theme?'EQUIPPED':'READY TO EQUIP'}</small></span></button>`).join('');
 $('lockerBadges').innerHTML=badgesHTML();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-theme]');if(!b||b.disabled)return;const id=b.dataset.theme;if(!(id in THEMES)||profile.rep<THEMES[id].unlock)return;const inLocker=!!b.closest('dialog');profile.theme=id;profileDirty=true;renderer.setTheme(id);renderProgress();saveProfile();sound(660,.12);const match=document.querySelector(`#${inLocker?'lockerThemes':'themeGrid'} [data-theme="${id}"]`);match?.focus({preventScroll:true});});
$('lockerButton').onclick=()=>{renderProgress();openDialog('lockerDialog');};
// Full-screen focus for the story games: only the panel stays, the rest of the arcade waits.
function storyFocus(on,panelId){const panel=panelId&&$(panelId);document.querySelectorAll('.is-focus').forEach(p=>p.classList.remove('is-focus'));document.body.classList.toggle('story-focus',!!on);if(on&&panel)panel.classList.add('is-focus');$('storyFocusExit').hidden=!on;window.scrollTo({top:0,behavior:'instant'});}
document.querySelectorAll('[data-focus]').forEach(b=>b.onclick=()=>storyFocus(true,b.dataset.focus));$('storyFocusExit').onclick=()=>storyFocus(false);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('story-focus')&&!document.querySelector('dialog[open]'))storyFocus(false);});
function setFocus(on){if(on&&mobile.coarse()){mobile.enter();return;}focused=on;document.body.classList.toggle('focus-mode',on);$('exitFocus').hidden=!on;$('focusButton').setAttribute('aria-label',on?'Exit focused game view':'Enter focused game view');canvas.focus({preventScroll:true});}
$('focusButton').onclick=()=>setFocus(!focused);$('exitFocus').onclick=()=>setFocus(false);
$('cityRoute').addEventListener('click',e=>{const b=e.target.closest('[data-route]');if(b&&!b.disabled)travelTo(Number(b.dataset.route));});
function cancelCountdown(){countdownUntil=0;$('countdownLayer').hidden=true;}
function pauseForInterruption(message){
 pack.pause();
 if(!isMaze())return;
 if(game.status==='playing'||countdownUntil){cancelCountdown();game.pause();if(game.status==='ready')game.status='paused';showState();toast(message);saveProfile();saveCheckpoint();releaseWakeLock();}
}
function returnToArcade(){cancelCountdown();game.pause();if(mobile.active)mobile.exit();if(focused)setFocus(false);saveProfile();saveCheckpoint();releaseWakeLock();showState();setLaunchText();}
function saveCheckpoint(){if(!isMaze())return;if(['playing','paused','level'].includes(game.status))write('mazeRun',snapshotMaze(game,challenge));}
function requestWakeLock(){if(!mobile.active||!navigator.wakeLock)return;navigator.wakeLock.request('screen').then(lock=>{if(game.status!=='playing')lock.release();else wakeLock=lock;}).catch(()=>{});}
function releaseWakeLock(){if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null;}}
function setLaunchText(){
 const titles={classic:'Maze Munch',rush:'60-Second Rush',daily:'Daily Run',trade:'Street Hustle'};
 $('launchTitle').textContent=titles[mode];$('modeTitle').innerHTML=mode==='daily'?'A new day.<br>A new dare.':mode==='rush'?'One minute.<br>All mayhem.':'Own the<br>after hours.';$('modeDescription').textContent=mode==='daily'?challenge.description:isTimed(mode)?'The clock is ticking. Stack points, chase combos, and leave your best score in the dust.':"A hungry DAWG. A maze full of loot. Four rivals who really don't want you to win.";$('riskRule').textContent=isTimed(mode)?'Hits cost 150 points. Keep going until the clock hits zero.':'Three lives. Fresh districts. An endless night.';$('launchDescription').textContent=mode==='daily'?challenge.description:mode==='rush'?'60 seconds. Chase your next personal best.':'Clear the block. Outrun the pack.';
}
function renderDaily(){
 const d=dailyRecords[challenge.day],best=d?.best||0;
 $('dailyName').textContent=challenge.name;$('dailyDescription').textContent=challenge.description;$('dailyDate').textContent=challenge.day;$('dailyBest').textContent='BEST '+best.toLocaleString();
 $('dailyMedals').innerHTML=challenge.targets.map((target,i)=>`<div class="daily-medal ${best>=target?'earned':''}"><b>${['◆','✦','★'][i]}</b><span>${['BRONZE','SILVER','GOLD'][i]}</span><span>${target.toLocaleString()}</span></div>`).join('');
}
function renderSettings(){
 document.querySelectorAll('[data-setting]').forEach(b=>b.setAttribute('aria-pressed',String(prefs[b.dataset.setting]===b.dataset.value)));
 $('settingsVolume').value=String(Math.round((prefs.volume??.8)*100));$('hapticsToggle').textContent=prefs.haptics?'ON':'OFF';$('hapticsToggle').setAttribute('aria-pressed',String(prefs.haptics));updateSound();
}
function saveSettings(){write('settings',prefs);mobile.applyPrefs();renderer.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches||prefs.fx==='low';pack.renderer.reduced=renderer.reduced;pack.storyRenderer.reduced=renderer.reduced;if(mode==='story')pack.renderStory();renderSettings();}
$('quickPlayButton').onclick=play;$('overlayHome').onclick=returnToArcade;$('launchSettings').onclick=()=>openDialog('settingsDialog');$('launchHelp').onclick=()=>openDialog('helpDialog');
$('helpSettings').onclick=()=>{$('helpDialog').close();openDialog('settingsDialog');};
$('backupButton').onclick=()=>openDialog('backupDialog');
$('accountButton').onclick=()=>{renderAccount();openDialog('accountDialog');};
// Rankings and friends; the board opens on the game being played.
var socialStarted=false;const shareSheet=new ShareSheet({openDialog});
// App shell: Play / Rankings / Friends / Me. Switching views pauses nothing; games run full-screen.
const shell=new Shell({onView:v=>{rankings.openView(v);if(v==='me')renderMe();if(v==='play')renderHero();}});
const rankings=new Rankings({onSocial:()=>renderToday(),cloud,kennel,records:()=>records,stats:()=>statsOf(arcade),confirm,openDialog,announce,shell,currentGame:()=>mode,share:o=>shareSheet.open(o),play:(id,o={})=>{if(o.trial)grantTrial(id);for(const d of document.querySelectorAll('dialog[open]'))d.close();shell.show('play');if(id===mode)renderHero();else selectMode(id);window.scrollTo({top:0});}});
// Tapping a game opens its sheet: a live demo of it playing itself, how to play, and Play.
rankings.onMatch=m=>playMatch(m);pack.io.matchesChanged=()=>rankings.refreshBadge();
const gameSheet=new GameSheet({best:id=>records[id]||0,wall:id=>wallOf(id),
 play:id=>{if(mode!==id)selectMode(id);$('heroPlay').click();},board:id=>{if(mode!==id)selectMode(id);$('heroBoard').click();},
 demo:(host,id)=>{let d=null,dead=false;import('./game-demo.js').then(({GameDemo})=>{if(!dead)d=new GameDemo(host,id,{face,character:pack.renderer.character||renderer.character,view:viewFor(id,prefs.cameras)==='2d'?'2d':'third'});}).catch(()=>{});return {dispose(){dead=true;d?.dispose();}};}});
document.querySelectorAll('.game-card[data-mode]').forEach(b=>b.addEventListener('click',()=>gameSheet.open(b.dataset.mode)));
// Features introduce themselves as they're earned: after runs, levels, streaks and unlocks.
const discoveries=new Discoveries({
 ctx:()=>({runs:records.runs||0,level:levelOf(arcade.xp),minutes:Math.floor(arcade.seconds/60),streak:currentStreak(arcade.days||[],localDay()).days,bests:GAME_IDS.filter(id=>(records[id]||0)>0).length,open:GAME_IDS.filter(id=>!!arcade.unlocked[id]||(records[id]||0)>0),hasName:!!rankings.profile?.name,hasEmail:!!cloud.user?.email,owner:!!rankings.owner}),
 busy:()=>!!document.querySelector('dialog[open]')||document.body.classList.contains('pack-session')||mobile.active||(isMaze()&&game.status==='playing')||shell.view!=='play'&&shell.view!=='me',
 go:where=>{const me=()=>shell.show('me');
  if(where==='kennel')$('kennelButton').click();else if(where==='atelier'){$('kennelButton').click();kennel.selectTab?.('fashion');}else if(where==='league')$('leagueButton').click();
  else if(where==='share'){const best=GAME_IDS.filter(id=>(records[id]||0)>0).sort((a,b)=>records[b]-records[a])[0];if(best)shareRun(best,records[best],{best:true});}
  else if(where==='rankings')shell.show('rankings');else if(where==='friends')shell.show('friends');else if(where==='cloud'){me();$('meAccount').click();}
  else if(where==='passport'){me();$('passportPanel').open=true;$('passportPanel').scrollIntoView?.({behavior:'smooth',block:'start'});}else if(where==='owner'){me();$('ownerTools').scrollIntoView?.({behavior:'smooth',block:'start'});}
  else if(where==='library'){shell.show('play');document.querySelector('.lib-group')?.scrollIntoView?.({behavior:'smooth',block:'start'});}
  else if(GAME_IDS.includes(where)){shell.show('play');selectMode(where);scrollToHero();}}});
discoveries.renderList();$('resultsDialog').addEventListener('close',()=>discover());const discover=()=>{clearTimeout(discover.t);discover.t=setTimeout(()=>discoveries.check(),1500);};

// Play hero: the selected game with its best, weekly rank and top friend.
function renderHero(){const id=shell.preview||mode;if(shell.preview&&!wallOf(shell.preview).open){shell.hero(shell.preview,{wall:wallOf(shell.preview),best:records[shell.preview]||0});}else{shell.preview=null;shell.hero(mode,{best:mode==='daily'?(dailyRecords[challenge.day]?.best||0):records[mode]||0,bestLabel:mode==='trade'?(records.trade>0?money(records.trade):'—'):null});}
 shell.heroSocial(rankings.api?'loading':undefined);const want=id;rankings.heroStats(id).then(s=>{if(s&&(shell.preview||mode)===want)shell.heroSocial(s);});}
$('heroPlay').onclick=()=>{if(shell.preview)return;if(isMaze())play();else if(mode==='trade'||mode==='story'||mode==='chess')$(mode==='trade'?'tradePanel':mode==='chess'?'chessPanel':'storyPanel').scrollIntoView({behavior:'smooth',block:'start'});else pack.play();};
$('meSettings').onclick=()=>openDialog('settingsDialog');$('meHelp').onclick=()=>openDialog('helpDialog');$('meBackup').onclick=()=>openDialog('backupDialog');$('meDelete').onclick=()=>{renderAccount();openDialog('accountDialog');$('accountDelete').focus();};$('meAccount').onclick=()=>{renderAccount();openDialog('accountDialog');};
$('meBests').addEventListener('click',e=>{const id=e.target.closest('[data-game]')?.dataset.game;if(id){shell.show('play');if(id===mode)renderHero();else selectMode(id);}});
function renderMe(){const s=statsOf(arcade);shell.me({level:s.level,xp:arcade.xp,next:xpForLevel(s.level+1),prev:xpForLevel(s.level),minutes:s.minutes,streak:s.streak,runs:records.runs||0,records,stamps:(passport?.stamps?.length||0)+'/'+STAMPS.length,rank:null});rankings.renderIdentity();
 const rankTile=$('meStats').lastElementChild?.querySelector('b');if(rankings.api&&rankTile){rankTile.classList.add('loading');rankings.rpc('my_level_rank').then(r=>{rankTile.textContent=r?.place?'#'+fmtNum(r.place):'—';}).catch(()=>{rankTile.textContent='—';}).finally(()=>rankTile.classList.remove('loading'));}}
// Results sheet: one game-over screen for every game. It opens a moment after the run ends so
// the crash or finish can land, then fills in where the run sits socially once it's uploaded.
var lastRun=null,resultsTimer=0;
const results=new ResultsSheet({openDialog,reduced:()=>renderer.reduced,
 onRematch:r=>{if(!wallOf(r.game).open){selectMode(r.game);return;}if(isMaze(r.game))play();else if(r.game==='trade')$('againTradeButton').click();else if(r.game==='story')pack.story.newNight();else if(r.game==='chess')pack.chess.newGame();else pack.play();},
 onHome:r=>{if(isMaze(r.game))returnToArcade();else pack.exit();shell.show('play');window.scrollTo({top:0});},
 onShare:r=>{const m=medalState(r.score,r.targets);shareRun(r.game,r.score,{best:r.best,medal:m.earned?m.label:'',detail:r.detail});},
 onChallenge:r=>rankings.pickFriend(r.game),
 onName:name=>rankings.setName(name)});
function medalTargets(id){if(id==='daily')return challenge.targets;const quick=pack.targets(id);if(quick)return quick;const t=DISCIPLINES.find(d=>d.id===id)?.target||1000;return [Math.round(t*.25),Math.round(t*.6),t];}
// The locked game closest to opening, with its quickest route.
function nextUnlock(){let best=null;for(const id of GAME_IDS){const w=wallFor(id,arcade,records);if(w.open)continue;const pct=unlockProgress(w);if(!best||pct>best.pct){const r=[...w.routes].sort((a,b)=>b.have/Math.max(1,b.need)-a.have/Math.max(1,a.need))[0];best={id,title:gameById(id)?.title||id,pct,left:r?r.left:''};}}return best;}
function levelInfo(){const s=statsOf(arcade),prev=xpForLevel(s.level),next=xpForLevel(s.level+1);return {level:s.level,pct:Math.min(100,Math.round((arcade.xp-prev)/Math.max(1,next-prev)*100)),text:`LEVEL ${s.level} · ${fmtNum(Math.max(0,next-arcade.xp))} XP TO LEVEL ${s.level+1}`};}
function queueResults(kind,score,opts={}){if(trial===kind)endTrial(kind);if(activeMatch?.game===kind)submitMatch(kind,score);clearTimeout(resultsTimer);resultsTimer=setTimeout(()=>showResults(kind,score,opts),kind==='trade'||kind==='story'?200:900);}
function showResults(kind,score,{prevBest=0,detail='',unit,format,again,title}={}){
 results.show({game:kind,score,unit,format,again,title,best:score>0&&score>prevBest,targets:medalTargets(kind),detail,xp:lastRun?.kind===kind?lastRun.xp:0,level:levelInfo(),unlock:nextUnlock(),askName:!!rankings.api&&!rankings.profile?.name,canChallenge:kind!=='story'});}
function showInsight(kind,score){rankings.insight(kind,score).then(lines=>{if(results.run?.game===kind)results.social(lines);});}
// Today rail: the daily run, your streak, the next unlock and any challenge waiting.
function renderToday(){discover();const items=[],st=currentStreak(arcade.days||[],localDay()),dbest=dailyRecords[challenge.day]?.best||0,m=medalState(dbest,challenge.targets);
 items.push({id:'daily',icon:'✦',title:'Daily Run · '+challenge.name,sub:dbest?`Best ${fmtNum(dbest)} · `+(m.next?`${fmtNum(m.toNext)} to ${['bronze','silver','gold'][m.earned]}`:'gold earned'):'New today. Same maze for everyone.',tone:dbest?'':'hot'});
 items.push({id:'streak',icon:'🔥',title:st.days?`${st.days}-day streak`:'Start a streak',sub:st.today?'Kept today ✓':st.days?'Play today to keep it alive':'Play any game today',tone:st.days&&!st.today?'warn':''});
 const u=nextUnlock();if(u)items.push({id:'unlock:'+u.id,icon:'🔓',title:'Next: '+u.title,sub:u.left,pct:u.pct});
 const waiting=(rankings.challenges||[]).filter(c=>c.direction==='in'&&!c.beaten).length;if(waiting)items.unshift({id:'challenges',icon:'⚔',title:`${waiting} challenge${waiting>1?'s':''} waiting`,sub:'Beat their score',tone:'hot'});
 shell.today(items,id=>{if(id==='challenges'){rankings.tab='inbox';shell.show('friends');}else if(id==='daily'){if(mode==='daily'){shell.preview=null;renderHero();scrollToHero();}else selectMode('daily');}else if(id==='streak'){scrollToHero();$('heroPlay').focus({preventScroll:true});}else if(id.startsWith('unlock:'))selectMode(id.slice(7));});}
// First visit: meet your DAWG, pick a name, jump into a first game.
const onboarding=new Onboarding({kennel,openDialog:id=>$(id).showModal(),avatar:(cv,d)=>rankings.avatar(cv,d),onName:name=>rankings.setName(name),
 onDawg:()=>{renderer.character=kennel.prepare(mode,game,true);rankings.renderIdentity();},
 onPick:id=>{shell.show('play');if(id!==mode)selectMode(id);else renderHero();if(isMaze(id))play();else pack.play();}});
// Score sharing: a card with the player's DAWG, and a link that challenges friends (or just opens the game).
function shareRun(id,score,{best=false,medal='',detail='',text=''}={}){const title=gameById(id)?.title||id,code=rankings.profile?.code,url=code?challengeLink(gamePage(id,shareBase()),id,score,code):playLink(id,shareBase());
 shareSheet.open({title:'Share your score',text:text||`I scored ${fmt(score)} in ${title} on the DAWG Arcade 🐶 Can you beat it?`,url,filename:`dawg-arcade-${id}-${Math.floor(score)}.png`,card:cv=>drawScoreCard(cv,{game:id,score,best,medal,detail,player:rankings.profile?.name||kennel.active?.name,dawg:kennel.active})});}
$('mazeShare').onclick=()=>{if(game.status!=='over')return;shareRun(mode,game.score,{best:!!runOutcome?.newBest,medal:$('runRecap').querySelector('.recap-medal')?.textContent.replace('✦ ','')||'',detail:`${game.stats.dots} coins · ${game.stats.caught} rivals · ${game.stats.loot} gold bags`});};
const accountAction=async(task,done)=>{const note=$('accountNote');if(!cloud.client){note.textContent='Cloud saves are offline right now. Your progress is safe on this device.';return;}note.textContent='Working…';try{await task();note.textContent=done;}catch(error){note.textContent=error?.message||'Something went wrong. Try again.';}renderAccount();};
$('accountForm').addEventListener('submit',e=>{e.preventDefault();const email=$('accountEmail').value.trim();accountAction(()=>cloud.saveWithEmail(email),'Check '+email+' and open the link to finish saving your progress.');});
$('accountSignIn').onclick=()=>{const email=$('accountEmail').value.trim();if(!email){$('accountNote').textContent='Enter your email above, then press this again.';$('accountEmail').focus();return;}accountAction(()=>cloud.signInWithEmail(email),'Check '+email+' for your sign-in link. That account’s progress will replace this device’s.');};
$('accountSignOut').onclick=()=>accountAction(()=>cloud.signOut(),'Signed out. You’re playing as a new guest on this device.');
$('accountDelete').onclick=()=>confirm('Delete your cloud data?','This removes your saves, runs and unlocks from our database. Progress on this device stays unless you clear it.','DELETE CLOUD DATA',()=>{openDialog('accountDialog');accountAction(()=>cloud.deleteData(),'Your cloud data was deleted.');});
$('exportProgress').onclick=()=>{
 try{saveProfile();saveCheckpoint();pack.saveRuns();const backup=makeBackup(localStorage),skipped=backup.skipped||[],blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='DAWG-save-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('backupStatus').textContent='Backup downloaded. Keep it to move your progress to another browser or computer.'+(skipped.length?' Damaged sections were left out: '+skipped.join(', ')+'.':'');}
 catch(e){$('backupStatus').textContent=e.message;}
};
$('importProgress').onclick=()=>{ $('backupFile').value='';$('backupFile').click();};
$('backupFile').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{if(file.size>1_000_000)throw new Error('Choose a DAWG backup smaller than 1 MB.');const backup=parseBackup(await file.text());$('backupDialog').close();$('settingsDialog').close();confirm('Restore this backup?',`This replaces progress on this browser with ${Object.keys(backup.saves).length} saved sections. Export your current progress first if you want to keep it.`,'RESTORE & RELOAD ↗',()=>{try{applyBackup(localStorage,backup);restoringBackup=true;location.reload();}catch(error){$('backupStatus').textContent=error.message;openDialog('backupDialog');}});}
 catch(error){$('backupStatus').textContent=error.message;}
});
$('settingsDone').onclick=()=>$('settingsDialog').close();$('settingsSound').onclick=()=>$('soundButton').click();
$('settingsVolume').addEventListener('change',e=>{prefs.volume=Math.min(1,Math.max(0,Number(e.target.value)/100));saveSettings();sound(660,.1);});
$('hapticsToggle').onclick=()=>{prefs.haptics=!prefs.haptics;saveSettings();mobile.haptic(15);};
document.querySelectorAll('[data-setting]').forEach(b=>b.onclick=()=>{prefs[b.dataset.setting]=b.dataset.value;if(b.dataset.setting==='controls')prefs.controlsChosen=true;saveSettings();});
window.addEventListener('pagehide',()=>{saveProfile();saveCheckpoint();releaseWakeLock();});
$('tabReload').onclick=()=>location.reload();$('tabDialog').addEventListener('cancel',e=>e.preventDefault());
// A page restored from the back/forward cache may hold stale progress, so reload it to read and claim the latest save.
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
const restored=restoreMaze(read('mazeRun',null));
if(restored&&!wallFor(restored.game.mode,arcade,records).open)arcade.unlocked[restored.game.mode]='played';if(settleUnlocks(arcade,records).length||restored)write('arcade',arcade);renderLocks();
cloud.start();setTimeout(()=>{try{sessionStorage.removeItem('dawg-cloud-reload');}catch{}},15000);
if(restored){game=restored.game;mode=game.mode;if(restored.challenge)challenge=restored.challenge;document.querySelectorAll('[data-mode]').forEach(b=>{const selected=b.dataset.mode===mode;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});$('arcadePanel').setAttribute('aria-labelledby','tab-'+mode);}
// Short buzz on navigation taps, for players who keep vibration on.
document.addEventListener('click',e=>{if(prefs.haptics&&e.target.closest?.('.app-nav button,.game-card,.today-card')&&typeof navigator.vibrate==='function'){try{navigator.vibrate(8);}catch{}}});
renderer.character=kennel.prepare(mode,game);
$('dailyBrief').hidden=mode!=='daily';setLaunchText();renderDaily();renderSettings();awardPassport();renderProgress();updateBest();showState();requestAnimationFrame(frame);
// ?play=<game> links open straight to that game.
const linked=readPlayLink(globalThis.location?.search||'');if(linked){const u=new URL(location.href);u.searchParams.delete('play');history.replaceState(null,'',u.pathname+u.search+u.hash);grantTrial(linked);if(linked!==mode)selectMode(linked);}
rankings.renderIdentity();renderHero();renderToday();shell.initial();
if(needsOnboarding(records,Onboarding.seen())&&!linked)onboarding.start();
if(kennelDamaged)announce('Saved DAWG roster was damaged and has been reset; the old copy was kept.');
