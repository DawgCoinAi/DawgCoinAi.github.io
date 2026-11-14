// Street Hustle's session and phone. The game is a city you drive (hustle-world-3d.js, loaded on
// demand); everything you used to do in panels happens on an in-world phone that slides up when
// you pull over: market, messages, map, bank, garage. This module owns the session (full screen
// in, back out), the phone's tabs, and turns what happens on the road (pulled up at a dealer,
// busted, resprayed) into the trade engine's own actions. Without WebGL the phone is the game.
import {GOODS,DISTRICTS} from './engine.js';
import {immersive} from './immersive.js';
import {FEATS,CHAPTERS,dailyContract} from './living-trade.js';
import {STOPS,NODES,EDGES,ALLEYS,BEACH,XS,ZS,districtAt} from './hustle-world.js';
import {wantedStars} from './hustle-drive.js';
import {WEATHER} from './world.js';

const $=id=>document.getElementById(id);
const CONTACTS=['Lou','Mags','Dex','Sunny','Bishop','Coco','Ziggy','Nash'];
const COLORS=['#ffc861','#ff5fc8','#5ee7ff','#fff6e0','#b9ff5e'];
// Who you're dealing with tonight.
export function contactName(w){const c=w.contract;return CONTACTS[Math.abs((w.seed>>>0)+c.deadline*7+c.good*13+c.destination*31)%CONTACTS.length];}
export function encounterSpeaker(trade){const p=trade.world.pending;return !p?null:p.kind==='toll'?'Knuckles · corner crew':p.kind==='stop'?'Officer Bramble':p.kind==='favor'?'Promoter Pip':contactName(trade.world);}
// Today's date key (local), which seeds the daily drop.
export function todayKey(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
// Is there an order you could run right now: goods on board, deadline alive, drop-off elsewhere?
export function runnableOrder(trade){const c=trade.world.contract;return c.status==='open'&&trade.day<=c.deadline&&trade.day<30&&trade.district!==c.destination&&trade.bag[c.good]>=c.quantity?c:null;}

export class Hustle {
 constructor({game,act,save,money,settings}){this.game=game;this.act=act;this.save=save;this.money=money;this.settings=settings;this.world=null;this.live=false;this.loading=false;this.session=false;this.open=true;this.tab='market';this.seen=null;this.busted=false;this.newsFor='';
  document.querySelectorAll('[data-hp-tab]').forEach(b=>{b.onclick=()=>this.show(b.dataset.hpTab);});
  $('hustlePhoneToggle').onclick=()=>this.toggle();$('hustleExit').onclick=()=>this.exit();$('resprayButton').onclick=()=>this.respray();$('hustleMap').addEventListener('click',e=>this.mapTap(e));
  $('dailyDeliver').onclick=()=>{const t=this.game();if(t&&this.canDeal())this.act(()=>t.deliverDaily(todayKey()));};}
 info(){const t=this.game(),w=t.world;return {seed:w.seed,day:t.day,heat:t.heat,weather:w.weather,district:t.district,cash:t.cash,used:t.used,capacity:t.capacity,pending:w.pending?.kind||null};}
 get sim(){return this.live?this.world.sim:null;}
 // ── Session: full screen in the car, and back out to the arcade ───────────────────────────
 enter(){const t=this.game();if(!t||this.session)return;this.session=true;immersive.enter();this.scroll=globalThis.window?.scrollY||0;document.body.classList.add('hustle-session');document.documentElement.classList.add('hustle-session');
  if(this.world){this.world.setSound(this.settings().sound,this.settings().volume);this.world.pause(false);}else this.start();this.refresh();}
 exit(){if(!this.session)return;this.session=false;immersive.exit();document.body.classList.remove('hustle-session');document.documentElement.classList.remove('hustle-session');this.park();this.world?.pause(true);try{window.scrollTo(0,this.scroll||0);}catch{}this.refresh();}
 start(){const t=this.game();if(!t||this.loading||this.world)return;if(typeof WebGL2RenderingContext==='undefined'){this.setOpen(true);return;}
  this.loading=true;this.setOpen(false);const s=this.settings();
  import('./hustle-world-3d.js').then(m=>{if(this.game()!==t){this.loading=false;return;}const world=this.world=new m.HustleWorld({host:$('hustleStage'),info:this.info(),spot:t.world.spot||null,quality:s.quality,reduced:s.reduced,sound:s.sound,volume:s.volume,on:(type,data)=>this.event(type,data)});
   return world.ready.then(ok=>{this.loading=false;if(this.world!==world)return;if(!ok){world.dispose();this.world=null;this.live=false;this.setOpen(true);this.refresh();return;}this.live=true;if(!this.session)world.pause(true);this.refresh();
    // Parked at your dealer: let the city land first, then the phone slides up.
    if(world.sim.parked!==null)setTimeout(()=>{if(this.world===world&&world.sim.parked!==null&&!this.open&&this.session)this.setOpen(true,this.game().world.pending?null:'market');},s.reduced?300:2900);});}).catch(e=>{console.warn('Street Hustle city unavailable',e);this.loading=false;this.world=null;this.live=false;this.setOpen(true);this.refresh();});}
 // A new campaign: a new city state, parked at the first dealer.
 reset(){this.world?.dispose();this.world=null;this.live=false;this.loading=false;this.seen=null;this.busted=false;if(this.session)this.start();else this.setOpen(true);}
 park(){const t=this.game(),sim=this.sim;if(t&&sim&&!sim.chase&&t.setSpot(sim.spot()))this.save();}
 refresh(){const t=this.game();if(t)this.render(t);}
 // ── The phone ──────────────────────────────────────────────────────────────────────────────
 canClose(){const t=this.game();return this.live&&!!t&&!t.world.pending&&t.status==='playing';}
 setOpen(open,tab){const t=this.game();if(!open&&!this.canClose()&&!this.loading)open=true;this.open=open;$('tradePanel').classList.toggle('phone-open',open);$('hustlePhoneToggle').setAttribute('aria-expanded',String(open));if(tab)this.show(tab);
  const w=this.world;if(!w||!this.live)return;const was=w.phone;w.setPhone(open);
  // Pulling away with an order on board starts the delivery clock.
  if(was&&!open&&t){const c=runnableOrder(t);if(c&&!w.sim.run&&!w.sim.chase)w.sim.startRun(c.destination);this.park();}}
 toggle(){if(this.open)this.setOpen(false);else this.world?.askPhone();}
 show(tab){this.tab=tab;$('hustlePhone').dataset.tab=tab;document.querySelectorAll('[data-hp-tab]').forEach(b=>{const on=b.dataset.hpTab===tab;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));});if(tab==='msgs')$('hustleMsgDot').hidden=true;if(tab==='map')this.drawMap();$('hustlePhoneBody').scrollTop=0;}
 // Where you can do business: at your district's dealer (anywhere, when there's no city to drive).
 canDeal(){const sim=this.sim;if(!sim)return true;const s=sim.parked!==null?STOPS[sim.parked]:null;return !!s&&s.kind==='market'&&s.district===this.game().district;}
 atGarage(){const sim=this.sim;if(!sim)return true;return sim.parked!==null&&STOPS[sim.parked].kind==='garage';}
 gps(stopId){const w=this.world;if(!w||!this.live||!STOPS[stopId])return;w.setGps(stopId);if(this.canClose()){this.setOpen(false);w.banner('GPS SET · '+STOPS[stopId].name.toUpperCase(),'go');}this.drawMap();}
 // An instant trip (drive switched off): the car is simply at the new dealer.
 moved(){const sim=this.sim,t=this.game();if(!sim||!t)return;sim.teleport(t.district);sim.parked=t.district;sim.leaving=null;this.world.sync(this.info());this.park();this.refresh();}
 respray(){const t=this.game(),sim=this.sim;if(!t||!t.canRespray()||!this.atGarage())return;if(sim&&!sim.respray()){$('resprayText').textContent='They watched you roll in. Lose them first.';return;}this.act(()=>t.respray());this.world?.card('paid',['PAW & SPRAY','FRESH PAINT','New colour, clean plates. Heat −35 and the patrols lose interest for a while.']);}
 // ── What the road reports ──────────────────────────────────────────────────────────────────
 event(type,data){const t=this.game(),w=this.world;if(!t||!w)return;const sim=w.sim;
  if(type==='failed'){w.dispose();this.world=null;this.live=false;this.loading=false;this.setOpen(true);this.refresh();return;}
  if(type==='exit'){this.exit();return;}
  if(type==='spot'){if(t.setSpot(data))this.save();return;}
  if(type==='closePhone'){this.setOpen(false);return;}
  if(type==='phone'){const s=data.stop;this.setOpen(true,data.tab||(s?(s.kind==='garage'?'garage':this.canDeal()?'market':'map'):this.tab==='market'?'map':this.tab));this.refresh();return;}
  if(type==='busted'){this.busted=true;this.act(()=>t.pulledOver(sim.bustOutcome()));w.card('busted',['BUSTED','PULLED OVER','Lights in the mirror. Whatever you picked up on the road is gone. Deal with the patrol.'],[],5200);this.setOpen(true);this.refresh();return;}
  if(type==='parked'){const s=data.stop;
   if(s.kind==='garage'){this.setOpen(true,'garage');this.refresh();return;}
   if(s.district!==t.district&&t.day<30&&!t.blocked){const from=t.district,out=sim.arrive();this.act(()=>t.travel(s.district,out));const d=t.world.lastDrive||{};
    w.card(out.result,['NIGHT '+String(t.day).padStart(2,'0')+' · '+(WEATHER[t.world.weather]||'').toUpperCase(),DISTRICTS[s.district].name.toUpperCase(),out.result==='escaped'?'You shook the cruisers on the way in. Heat cools and the crews keep their distance.':'Clean run from '+DISTRICTS[from].name+'. Nobody looked twice.'],
     [['ROAD CASH','+'+this.money(d.cash||0)],['NEAR MISSES',String(out.nearMisses)],...(out.express?[['EXPRESS','+'+this.money(out.express)]]:[]),['BUMPS',String(out.crashes)]],5200);}
   else if(s.district!==t.district&&t.day>=30)w.banner('FINAL NIGHT · YOUR DEALER IS IN '+DISTRICTS[t.district].name.toUpperCase(),'hot');
   const c=t.world.contract,drop=c.status==='open'&&t.district===c.destination&&t.bag[c.good]>=c.quantity&&this.canDeal();this.setOpen(true,t.world.pending?null:drop?'msgs':this.canDeal()?'market':'map');this.refresh();}}
 // ── Everything on the phone that the trade state decides ───────────────────────────────────
 render(t){const w=t.world,c=w.contract,over=t.status==='over',enc=t.encounter(),who=contactName(w),money=this.money,sim=this.sim;
  // Settled the patrol stop: back on the road with a head start.
  if(this.busted&&!w.pending){this.busted=false;sim?.release();}
  this.world?.sync(this.info());const deal=this.canDeal();
  const phone=$('hustlePhone');phone.dataset.mode=over?'finished':enc?'encounter':'apps';phone.dataset.live=String(this.live||this.loading);phone.dataset.deal=String(deal);if((over||enc)&&!this.open)this.setOpen(true);
  $('hustlePhoneToggle').hidden=!this.live;$('hustlePhoneToggle').disabled=!this.canClose();
  $('hustlePhoneClock').textContent='NIGHT '+String(t.day).padStart(2,'0')+' / 30';const stars=wantedStars(t.heat);$('hustleStars').textContent='★'.repeat(stars);$('hustleDebt').textContent=money(t.debt);
  $('hustleMarketKicker').textContent=deal?'YOUR DEALER · OPEN':'PULL UP IN '+DISTRICTS[t.district].name.toUpperCase()+' TO TRADE';
  // Your contact's order, in their words.
  $('hustleContactName').textContent=who+' · contact';const good=GOODS[c.good].name,dest=DISTRICTS[c.destination].name,have=t.bag[c.good];
  $('hustleContactText').textContent=c.status==='done'?'Pleasure doing business. I’ll have something new for you tomorrow night.':c.status==='expired'?'You missed the drop. No hard feelings… new lead tomorrow.':
   t.district===c.destination?(have>=c.quantity?`You made it. ${c.quantity} ${good}, right? Hand it over: ${money(c.reward)} is yours.`:`I’m here in ${dest}. Still need ${c.quantity} ${good}; you’ve got ${have}.`):`Need ${c.quantity} ${good} in ${dest} by night ${c.deadline}. Pays ${money(c.reward)}. You’ve got ${have}.`+(have>=c.quantity?' Beat the clock for an express bonus.':'');
  if(w.news!==this.newsFor){if(this.newsFor&&this.tab!=='msgs')$('hustleMsgDot').hidden=false;this.newsFor=w.news;}
  $('encounterWho').textContent=enc?encounterSpeaker(t):'';
  // The spray shop.
  const cost=t.resprayCost,sprayed=w.lastSpray===t.day,at=this.atGarage();$('resprayButton').disabled=!at||!t.canRespray();$('resprayButton').textContent=sprayed?'SPRAYED TONIGHT':'RESPRAY · '+money(cost);
  $('resprayText').textContent=sprayed?'Fresh paint is still drying. Come back tomorrow night.':!at?'Pull up at a pink Paw & Spray marker. New paint takes 35 heat off and shakes any cruiser that didn’t see you roll in.':t.cash<cost?'New paint takes 35 heat off. You’re short tonight: it’s '+money(cost)+'.':'New paint, clean plates: heat −35. Once a night.';
  $('hustleCoverLine').textContent=over?'Campaign finished at '+money(t.netWorth)+' net worth. Start a new hustle to drive again.':'Night '+t.day+' of 30 · '+money(t.netWorth)+' net worth · '+t.chapter.name+' · parked in '+DISTRICTS[sim?districtAt(sim.x,sim.z):t.district].name+'.';$('hustleEnter').textContent=t.day>1||w.spot?'BACK TO THE CAR ↗':'GET IN THE CAR ↗';
  // The ladder, today's drop and the feats.
  const ch=t.chapter,prev=CHAPTERS[ch.index].rep,span=ch.next?CHAPTERS[ch.index+1].rep-prev:1;$('hustleRank').textContent=ch.name.toUpperCase()+' · '+w.reputation+' REP';$('hustleRankFill').style.width=(ch.next?Math.round((w.reputation-prev)/span*100):100)+'%';$('hustleRankNext').textContent=ch.next?ch.toNext+' TO '+ch.next.toUpperCase():'TOP OF THE CITY';
  const day=todayKey(),dc=dailyContract(day),done=w.daily===day;$('dailyText').textContent=done?'Today’s drop is delivered. A new one lands tomorrow, the same for every hustler in town.':`${dc.quantity} ${GOODS[dc.good].name} to ${DISTRICTS[dc.destination].name}. Pays ${money(dc.reward)} and 6 rep. You’ve got ${t.bag[dc.good]}.`;$('dailyDeliver').hidden=done;$('dailyDeliver').disabled=!deal||!t.canDeliverDaily(day);
  const got=t.feats;$('hustleFeatCount').textContent='FEATS · '+got.length+' / '+FEATS.length;$('hustleFeats').innerHTML=FEATS.map(f=>`<div class="hp-feat ${got.includes(f.id)?'got':''}"><i>${got.includes(f.id)?'✓':'·'}</i><div><strong>${f.name}</strong><small>${f.text}</small></div></div>`).join('');
  // Feats and rank-ups that just landed: a toast on the road, a line on the phone.
  for(const e of (t.events||[]).splice(0)){if(e.type==='feat'){const f=FEATS.find(x=>x.id===e.id);this.world?.pop('FEAT · '+f.name.toUpperCase(),'feat');this.onFeat?.(e.id,f);}if(e.type==='chapter')this.world?.banner('RANK UP · '+e.name.toUpperCase(),'go');}
  this.payout(t);if(this.tab==='map')this.drawMap();}
 // A payout card when a contact order lands (not on load).
 payout(t){const c=t.world.contract,order=c.status==='done'?c.deadline+'|'+c.good+'|'+c.reward:'';if(this.seen===null){this.seen=order;return;}if(order&&order!==this.seen)this.world?.card('paid',['JOB DONE · '+contactName(t.world).toUpperCase(),'+'+this.money(c.reward),`${c.quantity} ${GOODS[c.good].name} delivered. +12 rep, and the street knows you deliver.`],[],5200);this.seen=order;}
 // ── The map app: the whole city, north up. Tap a marker to set the GPS. ──────────────────
 mapView(){const c=$('hustleMap'),w=c.width,h=c.height,x0=BEACH.x0-56,x1=XS[4]+34,z0=ZS[0]-34,z1=ZS[4]+34,k=Math.min(w/(x1-x0),h/(z1-z0));return {c,w,h,k,ox:(w-(x1-x0)*k)/2-x0*k,oz:(h-(z1-z0)*k)/2-z0*k};}
 drawMap(){const t=this.game();if(!t)return;const {c,w,h,k,ox,oz}=this.mapView(),x=c.getContext('2d');if(!x)return;const X=v=>v*k+ox,Z=v=>v*k+oz,sim=this.sim,cn=t.world.contract;
  x.clearRect(0,0,w,h);x.fillStyle='#0c1424';x.fillRect(0,0,w,h);x.fillStyle='#123a55';x.fillRect(0,0,X(BEACH.x0),h);x.fillStyle='#6b5b3e';x.fillRect(X(BEACH.x0),0,(BEACH.x1-BEACH.x0)*k,h);
  const zones=[[-105,-105,105,105],[0,-300,300,0],[-290,-300,0,0],[0,0,300,300],[-290,0,0,300]];x.globalAlpha=.16;[1,2,3,4,0].forEach(d=>{const [a,b,e,f]=zones[d];x.fillStyle=COLORS[d];x.fillRect(X(a),Z(b),(e-a)*k,(f-b)*k);});x.globalAlpha=1;
  x.lineCap='round';x.strokeStyle='#ffffff30';x.lineWidth=14*k;x.beginPath();for(const e of EDGES){const a=NODES[e.a],b=NODES[e.b];x.moveTo(X(a.x),Z(a.z));x.lineTo(X(b.x),Z(b.z));}x.stroke();
  x.strokeStyle='#ffffff1c';x.lineWidth=5*k;x.beginPath();for(const a of ALLEYS){x.moveTo(X(a.x0),Z(a.z0));x.lineTo(X(a.x1),Z(a.z1));}x.stroke();x.strokeStyle='#6dff9a99';x.lineWidth=14*k;x.beginPath();x.moveTo(X(XS[1]),Z(ZS[4]));x.lineTo(X(XS[2]),Z(ZS[4]));x.stroke();
  x.textAlign='center';x.textBaseline='middle';x.font='800 '+Math.round(w*.03)+'px system-ui,sans-serif';
  const label=[[0,-42],[150,-218],[-150,-218],[150,84],[-150,84]];DISTRICTS.forEach((d,i)=>{x.fillStyle=COLORS[i];x.globalAlpha=.9;x.fillText(d.name.toUpperCase(),X(label[i][0]),Z(label[i][1]));x.globalAlpha=1;});
  x.font='700 '+Math.round(w*.021)+'px system-ui,sans-serif';x.fillStyle='#8fb6c8';x.save();x.translate(X(BEACH.x0-28),Z(0));x.rotate(-Math.PI/2);x.fillText('DOG BAY',0,0);x.restore();x.fillStyle='#9dffb8';x.fillText('TUNNEL',X(-70),Z(ZS[4]+22));
  if(sim&&sim.gps!==null&&this.world.routePts){x.strokeStyle='#ffd34a';x.lineWidth=5;x.lineJoin='round';x.setLineDash([10,7]);x.beginPath();this.world.routePts.forEach((p,i)=>i?x.lineTo(X(p.x),Z(p.z)):x.moveTo(X(sim.x),Z(sim.z)));x.stroke();x.setLineDash([]);}
  for(const s of STOPS){const col=s.kind==='market'?COLORS[s.district]:'#ff5fc8',px=X(s.x),pz=Z(s.z),r=w*.03,target=sim?.gps===s.id;if(target){x.strokeStyle='#ffd34a';x.lineWidth=4;x.beginPath();x.arc(px,pz,r+6,0,7);x.stroke();}
   x.fillStyle='#0b0f1e';x.beginPath();x.arc(px,pz,r,0,7);x.fill();x.strokeStyle=col;x.lineWidth=3;x.stroke();x.fillStyle=col;x.font='900 '+Math.round(r*1.2)+'px system-ui,sans-serif';x.fillText(s.kind==='market'?'$':'✦',px,pz+1);
   if(s.kind==='market'){const tags=[];if(s.district===t.district)tags.push('YOUR DEALER');if(cn.status==='open'&&cn.destination===s.district)tags.push('DROP · NIGHT '+cn.deadline);for(const rv of t.world.rivals)if(rv.district===s.district)tags.push(t.rivalName(rv).toUpperCase());
    x.font='700 '+Math.round(w*.019)+'px system-ui,sans-serif';tags.slice(0,3).forEach((tag,i)=>{x.fillStyle=i===0&&s.district===t.district?'#fff':tag.startsWith('DROP')?'#ffd34a':'#ff9ad5';x.fillText(tag,px,pz+r+11+i*w*.024);});}}
  if(sim){const px=X(sim.x),pz=Z(sim.z);x.save();x.translate(px,pz);x.rotate(sim.h);x.fillStyle='#fff';x.strokeStyle='#0b0f1e';x.lineWidth=3;x.beginPath();x.moveTo(0,-13);x.lineTo(9,10);x.lineTo(0,5);x.lineTo(-9,10);x.closePath();x.stroke();x.fill();x.restore();}}
 mapTap(e){if(!this.live)return;const {c,k,ox,oz,w}=this.mapView(),r=c.getBoundingClientRect?.();if(!r||!r.width)return;const mx=(e.clientX-r.left)*w/r.width,mz=(e.clientY-r.top)*c.height/r.height,wx=(mx-ox)/k,wz=(mz-oz)/k;let best=null,bd=46;for(const s of STOPS){const d=Math.hypot(s.x-wx,s.z-wz);if(d<bd){bd=d;best=s;}}if(best)this.gps(best.id);}
}
