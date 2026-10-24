import {DawgKennel} from './dawg-kennel.js';
import {STAMPS,updatePassport} from './passport.js';
import {LivingTradeGame,validLivingTrade,TRADE_PERKS} from './living-trade.js';
import {freshSeed} from './world.js';
import {PackRenderer} from './pack-renderer.js';
import {MazeGame,GOODS,DISTRICTS} from './engine.js';
import {ArcadeRenderer,THEMES} from './renderer.js';
import {MobileControls} from './mobile.js';
import {isTimed,dailyChallenge,seededRandom,medalFor,dailyResult,advanceGame} from './mobile-core.js';
import {snapshotMaze,restoreMaze} from './checkpoint.js';
import {ArcadePack,PACK_MODES} from './arcade-pack.js';
import {makeBackup,parseBackup,applyBackup} from './progress-backup.js';
import {validKennel} from './dawg-career.js';
function freshMaze(mode='classic',daily=null){const seed=mode==='daily'?daily.seed:freshSeed();return new MazeGame(mode,seededRandom(seed),{...(daily||{}),worldSeed:seed});}
function isMaze(value=mode){return ['classic','rush','daily'].includes(value);}
const $=id=>document.getElementById(id);
const money=n=>(n<0?'−':'')+'$'+Math.abs(Math.round(n)).toLocaleString('en-US');
const padded=n=>String(Math.floor(n)).padStart(6,'0');
let storageAvailable=true,restoringBackup=false,otherTabActive=false;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem('dawg-v1-'+key))??fallback;}catch{return fallback;}};
const write=(key,value)=>{if(restoringBackup||otherTabActive)return;try{localStorage.setItem('dawg-v1-'+key,JSON.stringify(value));}catch{storageAvailable=false;$('saveNote').textContent='SAVING UNAVAILABLE IN THIS BROWSER';}};
// Keep the raw copy of a stored section that fails validation before the game replaces it with a fresh one.
function keepDamaged(key,valid){if(restoringBackup||otherTabActive)return false;try{const raw=localStorage.getItem('dawg-v1-'+key);if(raw===null)return false;let value;try{value=JSON.parse(raw);}catch{}if(value===null||value!==undefined&&valid(value))return false;if(localStorage.getItem('dawg-v1-damaged-'+key)===null)localStorage.setItem('dawg-v1-damaged-'+key,raw);return true;}catch{return false;}}
// Only the newest tab saves: an older tab stops writing so its stale state cannot overwrite newer progress.
const tabId=Math.random().toString(36).slice(2),tabChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('dawg-v1-active-tab'):null;
if(tabChannel){tabChannel.onmessage=e=>{if(!e.data||e.data.claim===tabId||otherTabActive)return;otherTabActive=true;pauseForInterruption('PAUSED · OPEN IN ANOTHER TAB');document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('tabDialog').showModal();};tabChannel.unref?.();tabChannel.postMessage({claim:tabId});}
let records=read('records',{classic:0,rush:0,trade:null,runs:0});
if(!records||typeof records!=='object')records={classic:0,rush:0,trade:null,runs:0};
let passport=read('passport',null);
let mode='classic',game=freshMaze(),trade=null,quantity=1,soundEnabled=read('sound',false),audioContext,confirmAction=null,scoreRecorded=false;
const face=new Image();face.src='assets/dawg-head-v2.webp';
const canvas=$('maze'),renderer=new ArcadeRenderer(canvas,face),cityRenderer=new PackRenderer($('cityCanvas'),face);let lastCityFrame=0;
let lastTime=0,toastUntil=0,blinkTime=0,lastProfileSave=0,musicBeat=0,nextMusicBeat=0,lastHud=0;
let focused=false,profileDirty=false,countdownUntil=0,wakeLock=null,runOutcome=null;
let challenge=dailyChallenge(),dailyRecords=read('daily',{});
if(!dailyRecords||typeof dailyRecords!=='object'||Array.isArray(dailyRecords))dailyRecords={};
const savedPrefs=read('settings',{}),prefs={controls:savedPrefs?.controls==='pad'?'pad':'stick',hand:savedPrefs?.hand==='left'?'left':'right',haptics:savedPrefs?.haptics!==false,fx:savedPrefs?.fx==='low'?'low':'auto'};
const BADGES=[{id:'dots',target:100,name:'Block cleaner',desc:'Collect 100 coins'},{id:'caught',target:5,name:'Pack leader',desc:'Catch 5 rivals'},{id:'loot',target:3,name:'Bag chaser',desc:'Grab 3 gold bags'},{id:'clears',target:3,name:'City legend',desc:'Clear 3 districts'},{id:'dashes',target:25,name:'Fast & furrious',desc:'Use dash 25 times'},{id:'profitable',target:1,name:'Self-made DAWG',desc:'Finish a profitable hustle'}];
const savedProfile=read('profile',{}),profile={rep:0,dots:0,caught:0,loot:0,clears:0,dashes:0,profitable:0,theme:'district'};
for(const k of Object.keys(profile)){if(k!=='theme'&&Number.isFinite(savedProfile?.[k])&&savedProfile[k]>=0)profile[k]=Math.floor(savedProfile[k]);}
if(savedProfile?.theme in THEMES&&profile.rep>=THEMES[savedProfile.theme].unlock)profile.theme=savedProfile.theme;
renderer.setTheme(profile.theme);
const kennelDamaged=keepDamaged('kennel',validKennel);
const kennel=new DawgKennel({read,write,open:openDialog,play:selectMode,announce,appearanceChanged:()=>{drawMaze();if(pack.kind==='story')pack.renderStory();else if(pack.game&&pack.kind)pack.renderer.draw(pack.game,pack.kind,performance.now());if(trade)cityRenderer.city(trade,performance.now());}});
const mobile=new MobileControls({direction,dash,pause:togglePause,exit:returnToArcade,settings:()=>openDialog('settingsDialog'),rotate:()=>pauseForInterruption('PAUSED · SCREEN ROTATED')},prefs);
const pack=new ArcadePack(face,{read,write,prefs,prepare:(kind,g,force=false)=>kennel.prepare(kind,g,force),sound,soundOn:()=>soundEnabled,soundToggle:()=>$('soundButton').click(),confirm,best:kind=>records[kind]||0,record:(kind,score,rep)=>{kennel.record(kind,score);records[kind]=Math.max(records[kind]||0,score);records.runs=(records.runs||0)+1;write('records',records);awardPassport();if(rep){earnRep(rep);profileDirty=true;renderProgress();saveProfile();}}});
renderer.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches||prefs.fx==='low';
function sound(freq=440,length=.08,type='sine',gain=.035){if(!soundEnabled)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();const o=audioContext.createOscillator(),g=audioContext.createGain();o.type=type;o.frequency.setValueAtTime(freq,audioContext.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*.6),audioContext.currentTime+length);g.gain.setValueAtTime(gain,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+length);o.connect(g);g.connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+length);}catch{}}
function updateSound(){$('settingsSound').textContent=soundEnabled?'ON':'OFF';$('settingsSound').setAttribute('aria-pressed',String(soundEnabled));$('soundButton').innerHTML=`♫ <span>${soundEnabled?'ON':'OFF'}</span>`;$('soundButton').setAttribute('aria-label',`Turn sound ${soundEnabled?'off':'on'}`);$('soundButton').title=`Turn sound ${soundEnabled?'off':'on'}`;}
$('soundButton').onclick=()=>{soundEnabled=!soundEnabled;write('sound',soundEnabled);updateSound();sound(660,.15);};updateSound();
function drawMaze(){renderer.draw(game,performance.now());}
function updateHud(){mobile.sync(game,mode,!!countdownUntil);$('quickPlayButton').innerHTML=(game.status==='ready'?'PLAY NOW':game.status==='over'?'RUN IT BACK':'RESUME RUN')+' <span>↗</span>'; const palette=renderer.palette(game);document.documentElement.style.setProperty('--world',palette.color);document.documentElement.style.setProperty('--world-secondary',palette.secondary);$('districtName').textContent=game.district.name.toUpperCase();$('districtSector').textContent='SECTOR '+String(game.level).padStart(2,'0');const ready=game.dashCooldown<=0;$('dashLabel').textContent=ready?'DASH READY':`RECHARGING ${game.dashCooldown.toFixed(1)}s`;$('dashCharge').style.width=(1-game.dashCooldown/game.dashRecharge)*100+'%';$('dashButton').classList.toggle('ready',ready);$('dashButton').disabled=!ready||!['playing','ready'].includes(game.status);$('liveIntel').textContent=game.loot?`GOLD BAG LIVE · ${Math.ceil(game.loot.time)}s left. Get it for +${game.loot.value} points.`:game.power>0?`BEAST MODE · ${game.power.toFixed(1)}s. Stack rival catches for bigger bonuses.`:'Gold bags appear after 80 and 160 pickups. Grab each one before its 12-second timer runs out.';$('score').textContent=padded(game.score);$('levelLabel').textContent=isTimed(mode)?'TIME LEFT':'LEVEL';$('level').textContent=isTimed(mode)?`${Math.ceil(game.time)}s`:String(game.level).padStart(2,'0');$('livesLabel').textContent=isTimed(mode)?'HIT PENALTY':'LIVES';$('lives').textContent=isTimed(mode)?'−150':Array(game.lives).fill('♥').join(' ');const progress=Math.round((1-game.pellets.size/game.total)*100);$('progressPercent').textContent=progress+'%';$('progressFill').style.width=progress+'%';$('powerFlash').hidden=game.power<=0||game.status!=='playing';$('powerFlash').querySelector('span').textContent=game.power.toFixed(1)+'s';$('pauseButton').disabled=!['playing','paused'].includes(game.status);$('pauseButton').textContent=game.status==='paused'?'▷':'Ⅱ';$('pauseButton').setAttribute('aria-label',game.status==='paused'?'Resume game':'Pause game');$('gameStatus').textContent=({ready:'READY WHEN YOU ARE',playing:game.power>0?'BEAST MODE · GO GET THEM':'DAWG IS ON THE MOVE',paused:'TAKE A BREATHER',over:'ANOTHER NIGHT. ANOTHER RUN.',level:'BLOCK CLEARED. KEEP IT MOVING.'})[game.status];}
function overlay(badge,title,text,button,hint='ARROW KEYS / WASD / SWIPE'){$('overlay').hidden=false;$('overlayBadge').textContent=badge;$('overlayTitle').innerHTML=title;$('overlayText').textContent=text;$('playButton').innerHTML=button+' <span>↗</span>';$('overlayHint').textContent=hint;}
function showState(){
 updateHud();$('overlay').classList.remove('results');$('runRecap').hidden=true;$('overlayHome').hidden=true;
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
  $('runRecap').hidden=false;$('overlayHome').hidden=!mobile.active;
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
 kennel.record(mode,game.score);records[mode]=Math.max(records[mode]||0,game.score);records.runs=(records.runs||0)+1;write('records',records);awardPassport();write('mazeRun',null);updateBest();releaseWakeLock();
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
 if(mobile.coarse()){if(focused)setFocus(false);mobile.enter();}
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
function selectMode(next){
 if(!['classic','rush','daily','trade',...PACK_MODES].includes(next)||next===mode)return;
 const change=()=>{
  if(isMaze()){cancelCountdown();game.pause();saveProfile();saveCheckpoint();releaseWakeLock();}
  if(mobile.active)mobile.exit();if(focused)setFocus(false);pack.exit();mode=next;
  $('dailyBrief').hidden=next!=='daily';$('mobileLaunch').hidden=!isMaze();$('arcadePanel').hidden=!isMaze();$('tradePanel').hidden=next!=='trade';
  document.querySelectorAll('[data-mode]').forEach(b=>{const on=b.dataset.mode===next;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
  pack.select(PACK_MODES.includes(next)?next:null);
  if(next==='trade'){if(!trade)loadTrade();renderTrade();}
  else if(PACK_MODES.includes(next)){const panel=$(next==='story'?'storyPanel':'packPanel');panel.setAttribute('aria-labelledby','tab-'+next);}
  else{$('arcadePanel').setAttribute('aria-labelledby','tab-'+next);if(game.mode!==next)newArcade();else{setLaunchText();renderDaily();updateBest();showState();}}
 };
 if(isMaze(next)&&game.mode!==next&&['playing','paused','level'].includes(game.status))confirm('Switch your maze challenge?','This replaces your saved maze run. Your personal records stay saved.','SWITCH MODE ↗',change);else change();
}

document.querySelectorAll('[data-mode]').forEach(b=>{b.onclick=()=>selectMode(b.dataset.mode);b.addEventListener('keydown',e=>{const tabs=[...document.querySelectorAll('[data-mode]')],i=tabs.indexOf(b);if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length;tabs[next].focus();}});});
const keyDirections={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
function direction(dir){if(!isMaze()||document.querySelector('dialog[open]'))return;if(game.status==='ready'&&!countdownUntil)play();if(game.status==='playing'||countdownUntil)game.direction(dir);}
window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||!isMaze()||e.ctrlKey||e.metaKey||e.altKey)return;const dir=keyDirections[e.key]||keyDirections[e.key.toLowerCase()];if(dir){e.preventDefault();direction(dir);}else if((e.key==='Shift'||e.key.toLowerCase()==='e')&&!e.repeat){e.preventDefault();dash();}else if(e.key==='Escape'&&mobile.active){returnToArcade();}else if(e.key==='Escape'&&focused){setFocus(false);}else if(e.code==='Space'||e.key.toLowerCase()==='p'){if(e.code==='Space'&&e.target.tagName==='BUTTON')return;e.preventDefault();if(!e.repeat)togglePause();}});
document.querySelectorAll('[data-dir]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();direction(b.dataset.dir);});b.onclick=()=>direction(b.dataset.dir);});
let pointerStart=null;
canvas.addEventListener('pointerdown',e=>{if(pointerStart)return;pointerStart={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!pointerStart||pointerStart.id!==e.pointerId)return;const dx=e.clientX-pointerStart.x,dy=e.clientY-pointerStart.y;if(Math.max(Math.abs(dx),Math.abs(dy))<12)return;direction(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');pointerStart={id:e.pointerId,x:e.clientX,y:e.clientY};});
const release=e=>{if(pointerStart?.id===e.pointerId)pointerStart=null;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseForInterruption('PAUSED · WELCOME BACK WHEN READY');});
window.addEventListener('blur',()=>pauseForInterruption('PAUSED · YOUR RUN IS SAFE'));
function openDialog(id){pack.pause();if(isMaze()){cancelCountdown();if(game.status==='playing')game.pause();showState();saveCheckpoint();releaseWakeLock();}if(id==='settingsDialog')renderSettings();$(id).showModal();}
$('helpButton').onclick=()=>openDialog('helpDialog');$('recordsButton').onclick=()=>{$('achievementsContent').innerHTML=`<div class="badge-grid">${badgesHTML()}</div>`;$('recordsContent').innerHTML=`<div class="record-row"><span>01 / Maze Munch</span><strong>${padded(records.classic||0)}</strong></div><div class="record-row"><span>02 / 60-Second Rush</span><strong>${padded(records.rush||0)}</strong></div><div class="record-row"><span>03 / Street Hustle</span><strong>${records.trade===null||records.trade===undefined?'—':money(records.trade)}</strong></div><div class="record-row"><span>Daily Run / all-time</span><strong>${padded(records.daily||0)}</strong></div>${[['flappy','Flappy DAWG'],['cross','DAWG Cross'],['snake','Neon Snake'],['runner','DAWG Dash'],['story','After Hours']].map(([id,name])=>`<div class="record-row"><span>${name}</span><strong>${padded(records[id]||0)}</strong></div>`).join('')}<div class="record-row"><span>Completed runs</span><strong>${records.runs||0}</strong></div>`;openDialog('recordsDialog');};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
function validSavedTrade(s){return s?.version===1&&validLivingTrade(s.state);}
function loadTrade(){if(keepDamaged('trade',validSavedTrade))announce('Street Hustle save was damaged. A new campaign started; the old copy was kept.');const saved=read('trade',null);const valid=validSavedTrade(saved);trade=new LivingTradeGame(valid?saved.state:null);enrollTrade(!valid);saveTrade();}
function enrollTrade(fresh=false){cityRenderer.character=kennel.prepare('trade',trade,fresh);if(fresh){trade.cash+=trade.career.cash;trade.world.contract.reward=Math.round(trade.world.contract.reward*(1+trade.career.order));if(trade.career.cash)trade.log('Career Hustle bonus: +$'+trade.career.cash+' starting cash.');}}
function saveTrade(){write('trade',{version:1,state:trade.save()});}
function renderTrade(){const finished=trade.status==='over',over=trade.blocked;renderLivingTrade();$('tradeNotice').hidden=over||trade.day!==30;$('tradeCostNote').hidden=!trade.costEstimated;$('sellAllButton').disabled=over||trade.used===0;$('citySceneTitle').textContent=DISTRICTS[trade.district].name;$('citySceneDesc').textContent=DISTRICTS[trade.district].desc;$('cityRoute').innerHTML=DISTRICTS.map((d,i)=>`<button class="route-stop ${i===trade.district?'current':''}" data-route="${i}" ${over||i===trade.district||trade.day>=30?'disabled':''} aria-label="Travel to ${d.name}, one night"><i></i>${d.name}</button>`).join('');$('tradeDay').innerHTML=`${String(trade.day).padStart(2,'0')}<span>/ 30</span>`;$('tradeCash').textContent=money(trade.cash);$('tradeWorth').textContent=money(trade.netWorth);$('tradeDebt').textContent=money(trade.debt);$('tradeBag').textContent=`${trade.used} / ${trade.capacity}`;$('safeBalance').textContent=money(trade.bank);$('marketName').textContent=DISTRICTS[trade.district].name;$('heatText').textContent=Math.round(trade.heat)+'%';$('heatFill').style.width=trade.heat+'%';$('tradeEvent').textContent=trade.event;
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
 cityRenderer.reduced=renderer.reduced;cityRenderer.city(trade,performance.now());
}
function renderMarketIntel(){const i=Math.max(0,Math.min(5,Number($('intelGood').value)||0)),quotes=trade.world.markets.map(m=>m.prices[i]),lo=Math.min(...quotes),hi=Math.max(...quotes),basis=trade.averageCost(i);$('marketIntel').innerHTML=DISTRICTS.map((d,j)=>{const m=trade.world.markets[j],difference=m.prices[i]-basis;return `<article class="intel-place"><h4>${d.name}</h4><b>${money(m.prices[i])}</b><em>${m.prices[i]===lo?'LOWEST QUOTE':m.prices[i]===hi?'HIGHEST QUOTE':'CURRENT QUOTE'}</em><small>${m.stock[i]} units available</small><small>${trade.bag[i]?`${difference>=0?'+':'−'}${money(Math.abs(difference))} / unit vs your cost`:'No units in your bag'}</small><button data-intel="${j}" ${trade.blocked||j===trade.district||trade.day>=30?'disabled':''}>${j===trade.district?'YOU ARE HERE':'TRAVEL · '+Math.round(trade.travelRisk(j)*100)+'% RISK'}</button></article>`;}).join('');}
$('intelGood').addEventListener('change',()=>{if(trade)renderMarketIntel();});
$('marketIntel').addEventListener('click',e=>{const b=e.target.closest('[data-intel]');if(b&&!b.disabled)tradeAction(()=>trade.travel(Number(b.dataset.intel)));});
$('tradePerks').addEventListener('click',e=>{const b=e.target.closest('[data-perk]');if(!b||b.disabled)return;const p=TRADE_PERKS.find(p=>p.id===b.dataset.perk);if(p)confirm('Equip '+p.name+'?',p.description+' Costs '+money(p.cost)+' from your carried cash. This upgrade lasts for the current campaign.','EQUIP ↗',()=>tradeAction(()=>trade.buyPerk(p.id)));});
$('streetWire').onclick=()=>tradeAction(()=>trade.talk());
$('deliverOrder').onclick=()=>tradeAction(()=>trade.deliver());
$('encounterOptions').addEventListener('click',e=>{const b=e.target.closest('[data-encounter]');if(b&&!b.disabled)tradeAction(()=>trade.resolve(b.dataset.encounter));});
function tradeAction(fn){const before=trade.logs[0];const result=fn();saveTrade();renderTrade();if(trade.world.pending)$('tradeEncounter').scrollIntoView({behavior:renderer.reduced?'auto':'smooth',block:'center'});$('marketFeedback').textContent=trade.logs[0]!==before?trade.logs[0].message:'No trade made. Check your cash, bag space, and selected quantity.';if(result!==false&&result!==0)sound(360,.055);}
$('marketRows').addEventListener('click',e=>{const buy=e.target.closest('[data-buy]'),sell=e.target.closest('[data-sell]');if(buy&&!buy.disabled)tradeAction(()=>trade.buy(Number(buy.dataset.buy),quantity));if(sell&&!sell.disabled)tradeAction(()=>trade.sell(Number(sell.dataset.sell),quantity));});
$('districts').addEventListener('click',e=>{const b=e.target.closest('[data-district]');if(b&&!b.disabled)tradeAction(()=>trade.travel(Number(b.dataset.district)));});
document.querySelectorAll('[data-qty]').forEach(b=>b.onclick=()=>{quantity=b.dataset.qty==='max'?'max':Number(b.dataset.qty);document.querySelectorAll('[data-qty]').forEach(a=>{a.classList.toggle('selected',a===b);a.setAttribute('aria-pressed',String(a===b));});});
$('sellAllButton').onclick=()=>confirm('Sell your whole bag?',`Sell ${trade.used} units at this market for ${money(trade.inventoryValue)}. This keeps your run going.`,'SELL ALL ↗',()=>tradeAction(()=>trade.sellAll()));
$('repayButton').onclick=()=>tradeAction(()=>trade.repay());$('depositButton').onclick=()=>tradeAction(()=>trade.deposit());$('withdrawButton').onclick=()=>tradeAction(()=>trade.withdraw());$('upgradeButton').onclick=()=>tradeAction(()=>trade.upgrade());
function finishTrade(){if(trade.status==='over')return;if(!trade.finish())return;kennel.record('trade',trade.netWorth,{day:trade.day});if(trade.netWorth>0){profile.profitable++;earnRep(100+Math.min(500,Math.floor(trade.netWorth/100)));profileDirty=true;checkBadges();renderProgress();saveProfile();}records.trade=records.trade==null?trade.netWorth:Math.max(records.trade,trade.netWorth);records.runs=(records.runs||0)+1;write('records',records);awardPassport();saveTrade();renderTrade();$('tradeFinished').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});sound(720,.2);}
$('cashoutButton').onclick=()=>confirm('Call it a night?',`Your stash will sell at today's prices, savings will be withdrawn, and debt will be paid as far as possible. Final net worth: ${money(trade.netWorth)}. This ends the run.`,'CASH OUT ↗',finishTrade);
function freshTrade(){trade=new LivingTradeGame();enrollTrade(true);saveTrade();renderTrade();$('marketFeedback').textContent='New hustle. Start with a small buy, then travel to find a better price.';$('tradePanel').scrollIntoView({behavior:'smooth',block:'start'});}
const restartTrade=()=>trade?.status==='over'?freshTrade():confirm('A new night. A new hustle.','Your current Street Hustle progress will be replaced. Your completed records will stay saved.','NEW HUSTLE ↗',freshTrade);
$('newTradeButton').onclick=restartTrade;$('againTradeButton').onclick=freshTrade;
function processEvents(){
 for(const event of game.events){
  renderer.event(event,game);if(event.type==='dash')mobile.haptic(12);if(event.type==='power')mobile.haptic(18);if(event.type==='eat'||event.type==='loot')mobile.haptic([12,20,12]);if(event.type==='hit')mobile.haptic([30,25,20]);if(event.type==='interrupted'){releaseWakeLock();saveCheckpoint();toast('PAUSED · READY WHEN YOUR DEVICE IS');}
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
  const prior=game.status;if(!countdownUntil)advanceGame(game,dt);processEvents();if(prior!==game.status)showState();
  if(now-lastHud>80){updateHud();lastHud=now;}renderer.draw(game,now);if(now>toastUntil)$('gameToast').classList.remove('visible');
  if(soundEnabled&&game.status==='playing'&&now>=nextMusicBeat){const notes=game.power>0?[220,330,440,660,440,330,277,415]:[110,165,220,165,131,196,262,196];sound(notes[musicBeat++%8],.12,'triangle',.009);nextMusicBeat=now+(game.power>0?180:260);}
 }
 if(PACK_MODES.includes(mode))pack.frame(now);
 if(mode==='trade'&&trade&&!document.hidden&&now-lastCityFrame>83){cityRenderer.reduced=renderer.reduced;if(!cityRenderer.reduced)cityRenderer.city(trade,now);lastCityFrame=now;}
 if(now-lastProfileSave>2000){saveProfile();saveCheckpoint();lastProfileSave=now;}
 requestAnimationFrame(frame);
}
function dash(){if(!isMaze()||countdownUntil||document.querySelector('dialog[open]'))return;if(game.status==='ready'){play();return;}game.dash();}
$('dashButton').onclick=dash;
function saveProfile(){if(!profileDirty)return;write('profile',profile);profileDirty=false;}
let achievementTimer=0;
function announce(message){$('achievementToast').querySelector('strong').textContent=message;$('achievementToast').hidden=false;clearTimeout(achievementTimer);achievementTimer=setTimeout(()=>$('achievementToast').hidden=true,3800);}
function earnRep(amount){const before=profile.rep;profile.rep+=amount;for(const t of Object.values(THEMES))if(t.unlock>before&&t.unlock<=profile.rep)announce(t.name+' unlocked');}
const earnedBadges=new Set(BADGES.filter(b=>profile[b.id]>=b.target).map(b=>b.id));
function checkBadges(){for(const b of BADGES)if(profile[b.id]>=b.target&&!earnedBadges.has(b.id)){earnedBadges.add(b.id);announce('Badge unlocked: '+b.name);}}
function badgesHTML(){return BADGES.map(b=>`<div class="badge ${profile[b.id]>=b.target?'earned':''}"><b>${profile[b.id]>=b.target?'✦ UNLOCKED':'◇ IN PROGRESS'}</b>${b.name}<small style="display:block;margin-top:6px;font-size:8px;line-height:1.6">${b.desc} · ${Math.min(profile[b.id],b.target)}/${b.target}</small></div>`).join('');}
function awardPassport(){const result=updatePassport(passport,records);passport=result.state;write('passport',passport);if(result.reward){earnRep(result.reward);profileDirty=true;$('passportReward').textContent=(result.completed?'CITY LEGEND · ':result.unlocked.map(s=>s.name).join(' · ')+' · ')+'+'+result.reward+' REP';renderProgress();saveProfile();}else renderPassport();}
function renderPassport(){const owned=passport?.stamps||[];$('passportCount').textContent=owned.length+' / '+STAMPS.length+(passport?.complete?' ✦':'');$('passportStamps').innerHTML=STAMPS.map(m=>{const earned=owned.includes(m.id),best=Math.max(0,records[m.id]||0),pct=Math.min(100,best/m.target*100),goal=m.id==='story'?'Finish any ending':m.id==='trade'?'Finish with '+money(m.target)+' net worth':m.target.toLocaleString()+' points in one completed run';return `<button class="passport-stamp ${earned?'earned':''}" data-passport="${m.id}" aria-label="${m.game}: ${earned?'stamp earned':goal}. Open game."><i>${earned?'✓':m.icon}</i><b>${m.game}</b><small>${earned?m.name+' · STAMP EARNED':goal}</small><div class="passport-track"><span style="width:${earned?100:pct}%"></span></div><small>${earned?'100 REP CLAIMED':m.id==='story'?'YOUR NEXT STORY AWAITS':'BEST '+(m.id==='trade'?money(records.trade||0):best.toLocaleString())+' · +100 REP'}</small></button>`;}).join('');}
$('passportStamps').addEventListener('click',e=>{const b=e.target.closest('[data-passport]');if(!b)return;selectMode(b.dataset.passport);if(mode===b.dataset.passport)$(mode==='story'?'storyPanel':mode==='trade'?'tradePanel':PACK_MODES.includes(mode)?'packPanel':'mobileLaunch').scrollIntoView({behavior:renderer.reduced?'auto':'smooth',block:'start'});});
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
function setFocus(on){if(on&&mobile.coarse()){mobile.enter();return;}focused=on;document.body.classList.toggle('focus-mode',on);$('exitFocus').hidden=!on;$('focusButton').setAttribute('aria-label',on?'Exit focused game view':'Enter focused game view');canvas.focus({preventScroll:true});}
$('focusButton').onclick=()=>setFocus(!focused);$('exitFocus').onclick=()=>setFocus(false);
$('cityRoute').addEventListener('click',e=>{const b=e.target.closest('[data-route]');if(b&&!b.disabled)tradeAction(()=>trade.travel(Number(b.dataset.route)));});
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
 $('hapticsToggle').textContent=prefs.haptics?'ON':'OFF';$('hapticsToggle').setAttribute('aria-pressed',String(prefs.haptics));updateSound();
}
function saveSettings(){write('settings',prefs);mobile.applyPrefs();renderer.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches||prefs.fx==='low';pack.renderer.reduced=renderer.reduced;pack.storyRenderer.reduced=renderer.reduced;if(mode==='story')pack.renderStory();renderSettings();}
$('quickPlayButton').onclick=play;$('overlayHome').onclick=returnToArcade;$('launchSettings').onclick=()=>openDialog('settingsDialog');$('launchHelp').onclick=()=>openDialog('helpDialog');
$('helpSettings').onclick=()=>{$('helpDialog').close();openDialog('settingsDialog');};
$('backupButton').onclick=()=>openDialog('backupDialog');
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
$('hapticsToggle').onclick=()=>{prefs.haptics=!prefs.haptics;saveSettings();mobile.haptic(15);};
document.querySelectorAll('[data-setting]').forEach(b=>b.onclick=()=>{prefs[b.dataset.setting]=b.dataset.value;saveSettings();});
window.addEventListener('pagehide',()=>{saveProfile();saveCheckpoint();releaseWakeLock();});
$('tabReload').onclick=()=>location.reload();$('tabDialog').addEventListener('cancel',e=>e.preventDefault());
// A page restored from the back/forward cache may hold stale progress, so reload it to read and claim the latest save.
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
const restored=restoreMaze(read('mazeRun',null));
if(restored){game=restored.game;mode=game.mode;if(restored.challenge)challenge=restored.challenge;document.querySelectorAll('[data-mode]').forEach(b=>{const selected=b.dataset.mode===mode;b.classList.toggle('active',selected);b.setAttribute('aria-selected',String(selected));});$('arcadePanel').setAttribute('aria-labelledby','tab-'+mode);}
document.querySelectorAll('[data-mode]').forEach(b=>b.tabIndex=b.dataset.mode===mode?0:-1);
renderer.character=kennel.prepare(mode,game);
$('dailyBrief').hidden=mode!=='daily';setLaunchText();renderDaily();renderSettings();awardPassport();renderProgress();updateBest();showState();requestAnimationFrame(frame);
if(kennelDamaged)announce('Saved DAWG roster was damaged and has been reset; the old copy was kept.');
