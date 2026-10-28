import {TradeGame,GOODS,DISTRICTS,validTradeState} from './engine.js';
import {freshSeed,seededRandom,shuffle,pick,WEATHER} from './world.js';
import {validDriveOutcome,RESULTS as DRIVE_RESULTS,DRIVE_CASH_CAP} from './hustle-drive.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const integer=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
const clone=v=>JSON.parse(JSON.stringify(v));
const names=['Velvet Vee','Moxie','Uncle Bones','Pixel','Goldie','Riff','Tango','Miss Miso'];
const trends=['Festival demand','Warehouse surplus','Courier slowdown','Tourist weekend','Night-market sale'];
export const TRADE_PERKS=[{id:'scout',name:'Route scout',cost:900,description:'Reduce encounter risk by 6 percentage points on every trip (minimum 4%).'},{id:'quiet',name:'Low-profile kit',cost:1200,description:'Buying and selling generate 40% less heat for the rest of this campaign.'},{id:'courier',name:'Trusted courier',cost:1400,description:'Contact orders pay 15% more, including your current open order.'}];
export function validLivingTrade(s){
 if(!validTradeState(s))return false;if(s.world===undefined)return true;const w=s.world;
 if(!w||w.version!==1||!integer(w.seed,1,0xffffffff)||!integer(w.randomState,0,0xffffffff)||!integer(w.weather,0,4)||!integer(w.reputation,0,999)||!integer(w.lastTalk,0,30))return false;
 if(!Array.isArray(w.markets)||w.markets.length!==5||!w.markets.every(m=>m&&Array.isArray(m.stock)&&m.stock.length===6&&m.stock.every(n=>integer(n,0,180))&&Array.isArray(m.prices)&&m.prices.length===6&&m.prices.every(n=>integer(n,1,100000))&&Array.isArray(m.pressure)&&m.pressure.length===6&&m.pressure.every(n=>Number.isFinite(n)&&n>=-.5&&n<=.5)))return false;
 if(!w.markets[s.district].prices.every((p,i)=>p===s.prices[i]))return false;
 if(!Array.isArray(w.rivals)||w.rivals.length!==3||!w.rivals.every(r=>r&&integer(r.name,0,names.length-1)&&integer(r.district,0,4)&&integer(r.good,0,5)&&['buyer','seller','collector'].includes(r.style)))return false;
 if(w.upgrades!==undefined&&(!Array.isArray(w.upgrades)||w.upgrades.length>3||new Set(w.upgrades).size!==w.upgrades.length||!w.upgrades.every(id=>TRADE_PERKS.some(p=>p.id===id))))return false;
 const e=w.event;if(!e||!integer(e.kind,0,4)||!integer(e.district,0,4)||!integer(e.good,0,5)||!integer(e.remaining,1,4))return false;
 const p=w.pending;if(p!==null&&(!p||!['toll','favor','flash','stop'].includes(p.kind)||!integer(p.amount,0,Number.MAX_SAFE_INTEGER)||!integer(p.good,0,5)))return false;
 const c=w.contract;if(!c||!integer(c.good,0,5)||!integer(c.quantity,3,8)||!integer(c.destination,0,4)||!integer(c.deadline,1,30)||!integer(c.reward,1,100000)||!['open','done','expired'].includes(c.status))return false;
 // Optional drive records (added with the drive between districts; older saves have neither).
 const d=w.lastDrive;if(d!==undefined&&(!d||!integer(d.day,1,30)||!DRIVE_RESULTS.includes(d.result)||!integer(d.cash,0,DRIVE_CASH_CAP)||!integer(d.nearMisses,0,999)||!integer(d.stars,0,5)))return false;
 const road=w.road;if(road!==undefined&&(!road||!['trips','escapes','busts','cash','nearMisses'].every(k=>integer(road[k],0,1e7))))return false;
 return Array.isArray(w.history)&&w.history.length>=1&&w.history.length<=8&&w.history.every(h=>Array.isArray(h)&&h.length===6&&h.every(n=>integer(n,1,100000)))&&typeof w.news==='string'&&w.news.length<800;
}
export class LivingTradeGame extends TradeGame {
 constructor(saved=null,seed=freshSeed()){
  const valid=validLivingTrade(saved),restored=valid?saved:null;seed=restored?.world?.seed||seed||1;const random=seededRandom(seed);super(random,restored);
  if(restored?.world){this.world=clone(restored.world);this.world.upgrades??=[];random.setState(this.world.randomState);this.prices=this.world.markets[this.district].prices;return;}
  this.world={version:1,upgrades:[],seed,randomState:0,weather:Math.floor(random()*5),reputation:0,lastTalk:0,pending:null,history:[],news:'The city is waking up.',event:{kind:Math.floor(random()*5),district:Math.floor(random()*5),good:Math.floor(random()*6),remaining:2+Math.floor(random()*3)},rivals:shuffle(random,names.map((_,i)=>i)).slice(0,3).map((name,i)=>({name,district:Math.floor(random()*5),good:Math.floor(random()*6),style:['buyer','seller','collector'][i]})),markets:DISTRICTS.map((d)=>({stock:GOODS.map(()=>18+Math.floor(random()*44)),prices:GOODS.map((g,i)=>Math.round(g.base*d.m[i]*(.7+random()*.65))),pressure:GOODS.map(()=>0)})),contract:null};
  if(restored)this.world.markets[this.district].prices=[...this.prices];else this.prices=this.world.markets[this.district].prices;
  this.world.history.push([...this.prices]);this.offerContract();this.world.news=this.eventDescription();this.event='New city, new opportunities. Markets change together each night.';this.world.randomState=random.getState();
 }
 hasPerk(id){return this.world?.upgrades?.includes(id)||false;}
 buyPerk(id){const perk=TRADE_PERKS.find(p=>p.id===id);if(this.blocked||!perk||this.hasPerk(id)||this.cash<perk.cost)return false;this.cash-=perk.cost;this.world.upgrades.push(id);if(id==='courier'&&this.world.contract.status==='open')this.world.contract.reward=Math.round(this.world.contract.reward*1.15);this.log(perk.name+' equipped for this campaign. '+perk.description);return true;}
 get blocked(){return this.status!=='playing'||!!this.world?.pending;}
 get stock(){return this.world.markets[this.district].stock;}
 get cityWeather(){return WEATHER[this.world.weather];}
 eventDescription(){const e=this.world.event;return `${trends[e.kind]}: ${GOODS[e.good].name} at ${DISTRICTS[e.district].name}. ${e.remaining} nights left.`;}
 travelRisk(destination){if(!DISTRICTS[destination])return 0;return clamp(super.travelRisk(destination)+(this.world?.weather===2?.06:0)-(this.world?.reputation||0)*.0005-(this.hasPerk('scout')?.06:0),.04,.8);}
 buy(i,n){if(this.blocked||!Number.isInteger(i)||!GOODS[i])return 0;const priorHeat=this.heat,amount=this.quantity(n,Math.min(this.stock[i],Math.floor(this.cash/this.prices[i]),this.capacity-this.used)),result=super.buy(i,amount);if(result){if(this.hasPerk('quiet'))this.heat=Math.min(100,priorHeat+result*.35*.6);this.stock[i]-=result;this.world.markets[this.district].pressure[i]=clamp(this.world.markets[this.district].pressure[i]+result*.005,-.5,.5);}return result;}
 sell(i,n){if(this.blocked)return 0;const priorHeat=this.heat,result=super.sell(i,n);if(result){if(this.hasPerk('quiet'))this.heat=Math.min(100,priorHeat+result*.15*.6);this.stock[i]=Math.min(180,this.stock[i]+result);this.world.markets[this.district].pressure[i]=clamp(this.world.markets[this.district].pressure[i]-result*.005,-.5,.5);}return result;}
 repay(){return this.blocked?0:super.repay();}deposit(){return this.blocked?false:super.deposit();}withdraw(){return this.blocked?false:super.withdraw();}upgrade(){return this.blocked?false:super.upgrade();}
 offerContract(){const r=this.random,good=Math.floor(r()*6),quantity=3+Math.floor(r()*6);this.world.contract={good,quantity,destination:(this.district+1+Math.floor(r()*4))%5,deadline:Math.min(30,this.day+4+Math.floor(r()*3)),reward:Math.round((GOODS[good].base*quantity*(1.65+r()*.5)+200)*(this.hasPerk('courier')?1.15:1)*(1+(this.career?.order||0))),status:'open'};}
 advanceEconomy(){const w=this.world,r=this.random;
  if(--w.event.remaining<=0)w.event={kind:Math.floor(r()*5),district:Math.floor(r()*5),good:Math.floor(r()*6),remaining:2+Math.floor(r()*3)};
  if(r()<.45)w.weather=Math.floor(r()*5);
  const reports=[];for(const rival of w.rivals){rival.district=(rival.district+1+Math.floor(r()*4))%5;rival.good=Math.floor(r()*6);const m=w.markets[rival.district],amount=4+Math.floor(r()*10);if(rival.style==='seller'){m.stock[rival.good]=Math.min(180,m.stock[rival.good]+amount);m.pressure[rival.good]=clamp(m.pressure[rival.good]-.1,-.5,.5);}else{m.stock[rival.good]=Math.max(0,m.stock[rival.good]-amount);m.pressure[rival.good]=clamp(m.pressure[rival.good]+.1,-.5,.5);}reports.push(`${names[rival.name]} ${rival.style==='seller'?'unloaded':'bought'} ${GOODS[rival.good].name} at ${DISTRICTS[rival.district].name}`);}
  w.markets.forEach((m,d)=>GOODS.forEach((g,i)=>{const e=w.event,affected=e.district===d&&e.good===i,mult=affected?[1.8,.55,1.5,1.65,.65][e.kind]:1,weather=w.weather===1&&d===2?1.1:1,target=g.base*DISTRICTS[d].m[i]*mult*weather*(1+m.pressure[i]);m.prices[i]=Math.max(5,Math.round(m.prices[i]*.3+target*(.8+r()*.4)*.7));m.stock[i]=clamp(m.stock[i]+Math.floor(r()*19)-4+(affected&&mult<1?12:0),0,180);m.pressure[i]*=.65;}));
  this.prices=w.markets[this.district].prices;w.history.push([...this.prices]);w.history=w.history.slice(-8);w.news=this.eventDescription();this.event=reports[Math.floor(r()*reports.length)]+'.';this.log(this.event);
  if(w.contract.status==='open'&&this.day>w.contract.deadline){w.contract.status='expired';this.log('The contact order expired. No penalty; a new lead will arrive next night.');}else if(w.contract.status!=='open'&&this.day<30)this.offerContract();
 }
 // drive: an optional outcome from the drive (hustle-drive.js). Without one (skipped, no 3D) the trip plays as before.
 travel(destination,drive=null){if(this.blocked||!Number.isInteger(destination)||!DISTRICTS[destination]||destination===this.district||this.day>=30)return false;const run=validDriveOutcome(drive)?drive:null;let risk=this.travelRisk(destination);if(run?.result==='escaped')risk*=.5;else if(run?.result==='clean')risk*=.8;this.day++;this.district=destination;this.debt=Math.ceil(this.debt*1.03);this.bank=Math.floor(this.bank*1.005);this.heat=Math.max(0,this.heat-6);this.advanceEconomy();this.log(`Arrived at ${DISTRICTS[destination].name}. ${this.cityWeather}.`);if(run)this.applyDrive(run);
  if(run?.result==='busted'){const good=this.bag.indexOf(Math.max(...this.bag));this.world.pending={kind:'stop',amount:Math.max(60,Math.round(this.cash*.06+this.heat*6)),good:Math.max(0,good)};}
  else if(this.random()<risk)this.world.pending={kind:'toll',amount:Math.max(50,Math.floor(this.cash*.09)),good:Math.floor(this.random()*6)};
  else if(this.random()<.4)this.world.pending={kind:this.random()<.5?'favor':'flash',amount:60+Math.floor(this.random()*180),good:Math.floor(this.random()*6)};
  if(this.world.pending)this.event='A street encounter is waiting. Choose how your night unfolds.';if(this.day===30)this.log('Final night. Resolve any encounter, deliver an order, then cash out.');return true;
 }
 // What the road did: cash grabbed, nerve shown, and how it left your heat.
 applyDrive(run){const w=this.world,cash=Math.min(DRIVE_CASH_CAP,run.cash),rep=Math.min(5,Math.floor(run.nearMisses/4))+(run.result==='escaped'?3:0);this.cash+=cash;w.reputation=Math.min(999,w.reputation+rep);
  if(run.result==='escaped')this.heat=Math.max(0,this.heat-8);if(run.result==='tailed')this.heat=Math.min(100,this.heat+6);
  w.lastDrive={day:this.day,result:run.result,cash,nearMisses:run.nearMisses,stars:Number.isInteger(run.stars)?Math.min(5,Math.max(0,run.stars)):0};
  const road=w.road||(w.road={trips:0,escapes:0,busts:0,cash:0,nearMisses:0}),cap=n=>Math.min(1e7,n);road.trips=cap(road.trips+1);road.escapes=cap(road.escapes+(run.result==='escaped'?1:0));road.busts=cap(road.busts+(run.result==='busted'?1:0));road.cash=cap(road.cash+cash);road.nearMisses=cap(road.nearMisses+run.nearMisses);
  const what={clean:'Clean run across town.',escaped:'Shook the cruisers on the way in.',tailed:'A cruiser tailed you all the way here. Heat +6.',busted:'Pulled over by a patrol.'}[run.result];
  this.log(what+(cash?` +$${cash} picked up on the road.`:'')+(rep?` +${rep} rep.`:''));}
 encounter(){const p=this.world.pending;if(!p)return null;const options=[];let title,text;
  if(p.kind==='toll'){title='The corner crew';text='A rival crew wants a cut. Your bank balance is protected.';options.push({id:'pay',label:`Pay $${p.amount}`,detail:'Keep your inventory. Lose 10 heat.',disabled:this.cash<p.amount},{id:'bluff',label:'Try your luck',detail:'50%: gain 5 reputation. Otherwise lose 18% of carried cash.'},{id:'yield',label:'Give up part of the bag',detail:'Lose 15% of inventory, rounded up. No cash lost.'});}
  if(p.kind==='favor'){title='A familiar face';text='A local promoter asks you to fund tonight’s pop-up. A small favor could build your name.';options.push({id:'help',label:`Chip in $${p.amount}`,detail:'Gain 8 reputation; reduce heat by 8.',disabled:this.cash<p.amount},{id:'leave',label:'Wish them luck',detail:'Keep your cash. No penalty.'});}
  if(p.kind==='flash'){title='The night-market tip';text=`A contact found a small cache of ${GOODS[p.good].name}. Take it or stay focused.`;options.push({id:'gift',label:'Accept 2 units',detail:'Uses 2 bag slots; adds 3 heat.',disabled:this.capacity-this.used<2},{id:'leave',label:'Pass on the offer',detail:'No cost. No penalty.'});}
  if(p.kind==='stop'){title='Patrol stop';text='Lights in the mirror. A patrol DAWG walks up to your window and asks where you are headed tonight.';const n=this.bag[p.good];options.push({id:'fine',label:`Pay the $${p.amount} ticket`,detail:'Keep everything. Lose 15 heat.',disabled:this.cash<p.amount},{id:'search',label:'Let them search the trunk',detail:n?`They take 40% of your ${GOODS[p.good].name}. Lose 25 heat.`:'Nothing to find. Lose 20 heat.'},{id:'talk',label:'Talk your way out',detail:'Your reputation helps. Fail and the ticket doubles.'});}
  return {title,text,options};
 }
 resolve(id){const e=this.encounter(),p=this.world.pending;if(this.status!=='playing'||!e||!e.options.some(o=>o.id===id&&!o.disabled))return false;let message;
  if(id==='pay'){this.cash-=p.amount;this.heat=Math.max(0,this.heat-10);message=`Paid the corner crew $${p.amount}. Bag intact.`;}
  if(id==='bluff'){if(this.random()<.5){this.world.reputation=Math.min(999,this.world.reputation+5);message='They let you through. Your confidence became a local rumor.';}else{const loss=Math.floor(this.cash*.18);this.cash-=loss;message=`The crew called your bluff. Lost $${loss}.`;}}
  if(id==='yield'){let lost=0;this.bag=this.bag.map((n,i)=>{const take=Math.ceil(n*.15);if(n)this.cost[i]*=(n-take)/n;lost+=take;return n-take;});message=`Handed over ${lost} units. The rest of the night is yours.`;}
  if(id==='help'){this.cash-=p.amount;this.world.reputation=Math.min(999,this.world.reputation+8);this.heat=Math.max(0,this.heat-8);message='The promoter puts your name on the guest list. +8 local reputation.';}
  if(id==='gift'){this.bag[p.good]+=2;this.heat=Math.min(100,this.heat+3);message=`A favor repaid: 2 ${GOODS[p.good].name}.`;}
  if(id==='fine'){this.cash-=p.amount;this.heat=Math.max(0,this.heat-15);message=`Paid the $${p.amount} ticket. The patrol waves you on.`;}
  if(id==='search'){const n=this.bag[p.good],take=Math.ceil(n*.4);if(take){this.cost[p.good]*=(n-take)/n;this.bag[p.good]=n-take;this.heat=Math.max(0,this.heat-25);message=`The patrol confiscated ${take} ${GOODS[p.good].name}. They let you go.`;}else{this.heat=Math.max(0,this.heat-20);message='They searched the trunk and found nothing. Free to go.';}}
  if(id==='talk'){if(this.random()<Math.min(.7,.45+this.world.reputation*.0005)){this.world.reputation=Math.min(999,this.world.reputation+3);this.heat=Math.max(0,this.heat-5);message='Smooth. The patrol laughs and lets you off with a warning. +3 rep.';}else{const loss=Math.min(this.cash,p.amount*2);this.cash-=loss;message=`They did not buy it. Double ticket: $${loss}.`;}}
  if(id==='leave')message='You move on. Sometimes a quiet night is the right call.';
  this.world.pending=null;this.event=message;this.log(message);return true;
 }
 deliver(){const c=this.world.contract;if(this.blocked||c.status!=='open'||this.day>c.deadline||this.district!==c.destination||this.bag[c.good]<c.quantity)return false;const cost=this.averageCost(c.good)*c.quantity;this.bag[c.good]-=c.quantity;this.cost[c.good]=this.bag[c.good]?Math.max(0,this.cost[c.good]-cost):0;this.cash+=c.reward;c.status='done';this.world.reputation=Math.min(999,this.world.reputation+12);this.heat=Math.max(0,this.heat-5);this.log(`Contact order complete. Paid $${c.reward}; +12 reputation.`);return true;}
 talk(){if(this.blocked||this.world.lastTalk===this.day)return false;this.world.lastTalk=this.day;const good=Math.floor(this.random()*6),prices=this.world.markets.map(m=>m.prices[good]),low=prices.indexOf(Math.min(...prices)),high=prices.indexOf(Math.max(...prices));this.log(`Street wire: ${GOODS[good].name} is $${prices[low]} at ${DISTRICTS[low].name} and $${prices[high]} at ${DISTRICTS[high].name}. Prices move when you travel.`);return true;}
 finish(){return this.blocked?false:super.finish();}
 save(){const state=super.save();if(this.world){this.world.randomState=this.random.getState();state.world=clone(this.world);}return state;}
 rivalName(r){return names[r.name];}
}
