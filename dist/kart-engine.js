// Drift Dawgs: deterministic kart racing on seeded, themed circuits. Karts live in track space:
// p is distance along the centerline (laps included; negative on the starting grid), d is the
// sideways offset (positive to the left), a is heading relative to the track, y is height above
// the road while airborne. Renderers map track space to the world with trackPoint() and
// trackHeight() and only read this state.
import {heatOf,ramp,trackHeat,FULL_HEAT} from './difficulty.js';
import {seededRandom} from './mobile-core.js';

export const KART={laps:3,width:11,wall:7.6,cut:6.5,samples:512,step:1/120,top:30,boost:42,offroad:13,accel:17,rivals:5,radius:.75,steerRate:9,draftTime:1,draftBoost:.75,grid:2.4,gravity:22,outro:3.2,shield:8,howl:12};
export const ITEMS=['boost','bone','rocket','shield','howl'];
// Three circuit families. Each has its own planform, hills, and a name the renderer themes.
export const THEMES=[
 {id:'harbour',name:'Barkside Harbour',amp:[.2,.1,.04,0],sx:1.3,sy:.9,hill:2.2,size:100},
 {id:'neon',name:'Neon Kennel Night',amp:[.1,.19,.04,.05],sx:1.12,sy:.98,hill:3.4,size:104},
 {id:'skyway',name:'Cloud Nine Skyway',amp:[.25,.05,.08,0],sx:1.42,sy:.86,hill:4.8,size:108}];
export const kartTheme=seed=>THEMES[Math.floor(seededRandom((seed^0x7ac3)>>>0)()*THEMES.length)%THEMES.length];
const PLACE_BONUS=[3000,2000,1400,900,500,250];
// The ladder: three cups, each faster and worth more. Your best score opens the next one.
export const CUPS=[{id:'pup',name:'Pup Cup',cc:'100cc',need:0,pace:1,pay:1},{id:'street',name:'Street Cup',cc:'150cc',need:4500,pace:1.035,pay:1.25},{id:'top',name:'Top Dawg Cup',cc:'200cc',need:8000,pace:1.07,pay:1.5}];
export const cupFor=best=>{let n=0;CUPS.forEach((c,i)=>{if((best||0)>=c.need)n=i;});return n;};
// Things to pull off in a single race. The engine announces each the first time it happens.
export const FEATS=[
 {id:'kart.rocketstart',name:'Rocket Start',text:'Hit a control just as the lights go green.'},
 {id:'kart.drift10',name:'Sideways Dawg',text:'Fire 10 mini-turbos in one race.'},
 {id:'kart.super3',name:'Orange Sparks',text:'Fire 3 super turbos in one race.'},
 {id:'kart.draft3',name:'Tailgater',text:'Take 3 slipstreams in one race.'},
 {id:'kart.air3',name:'Frequent Flyer',text:'Clear the gap on all three laps.'},
 {id:'kart.shortcut',name:'Local Knowledge',text:'Boost through the shortcut.'},
 {id:'kart.block',name:'Not Today',text:'Block a hit with a shield.'},
 {id:'kart.howl2',name:'Pack Leader',text:'Spin two or more rivals with one howl.'},
 {id:'kart.hits3',name:'Marksdawg',text:'Land 3 hits on rivals in one race.'},
 {id:'kart.coins10',name:'Full Tank',text:'Carry 10 coins at once.'},
 {id:'kart.clean',name:'Not A Scratch',text:'Finish on the podium without a wall or a spin.'},
 {id:'kart.win',name:'Top Step',text:'Win a race.'},
 {id:'kart.photo',name:'By A Whisker',text:'Win by less than a quarter of a second.'},
 {id:'kart.lastfirst',name:'From The Back',text:'Win after starting the final lap outside the top three.'}];
const TWISTS=[{id:'rockets',name:'ROCKET DAY',text:'Every box holds a rocket or a shield.'},{id:'turbo',name:'TURBO DAY',text:'Mini-turbos burn half as long again.'},{id:'gold',name:'GOLD RUSH',text:'Coins are worth double, in speed and in points.'},{id:'tailwind',name:'TAILWIND',text:'Slipstreams charge twice as fast.'}];
// The daily course carries one rule twist, picked by its seed.
export const DAILY_TWIST=seed=>TWISTS[Math.floor(seededRandom((seed^0xda17)>>>0)()*TWISTS.length)%TWISTS.length];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);

// Seeded circuit: a star-shaped polar curve (so it never crosses itself), resampled to even
// spacing. Amplitudes shrink until no corner is tighter than the road can take. On top of the
// planform sit rolling hills, a ramp with a gap to clear, a tunnel and one inside-line shortcut.
const tracks=new Map();
export function kartTrack(seed){
 if(tracks.has(seed))return tracks.get(seed);
 const theme=kartTheme(seed),rnd=seededRandom((seed^0x5eed)>>>0),ph=[0,0,1,2,3,4,5].map(()=>rnd()*Math.PI*2),amp=theme.amp.map(a=>a*(.85+rnd()*.3)),sx=theme.sx+rnd()*.2,sy=theme.sy+rnd()*.12;
 let pts,scale=1;
 for(let tries=0;tries<14;tries++,scale*=.84){
  const raw=[];for(let i=0;i<2400;i++){const t=i/2400*Math.PI*2;let r=1;for(let k=2;k<=5;k++)r+=amp[k-2]*scale*Math.sin(k*t+ph[k]);raw.push([Math.cos(t)*r*theme.size*sx,Math.sin(t)*r*theme.size*sy]);}
  pts=resample(raw,KART.samples);if(minRadius(pts)>26)break;}
 const n=pts.length,len=pts.reduce((sum,p,i)=>sum+Math.hypot(pts[(i+1)%n][0]-p[0],pts[(i+1)%n][1]-p[1]),0),ds=len/n;
 const ang=pts.map((p,i)=>{const q=pts[(i+1)%n],o=pts[(i-1+n)%n];return Math.atan2(q[1]-o[1],q[0]-o[0]);});
 const curve=ang.map((a,i)=>wrap(ang[(i+1)%n]-ang[(i-1+n)%n])/(2*ds));
 const sm=curve.map((_,i)=>{let s=0;for(let k=-3;k<=3;k++)s+=curve[(i+k+n)%n];return s/7;});
 const around=(a,b)=>{const g=Math.abs(a-b)%len;return Math.min(g,len-g);};
 // The jump goes on the straightest 90 m of road away from the start line.
 const span=Math.ceil(90/ds);let best=Infinity,ji=Math.floor(120/ds);
 for(let i=Math.floor(90/ds);i*ds<len-190;i+=2){let m=0;for(let k=0;k<span;k+=3)m=Math.max(m,Math.abs(sm[(i+k)%n]));if(m<best){best=m;ji=i;}}
 const jump={s:ji*ds+36,gap:14,ramp:20,rise:2.4,drop:1};
 // The shortcut opens the inside of the tightest corner that is clear of the jump.
 let ci=-1,peak=0;for(let i=0;i<n;i++){const s=i*ds;if(s<70||s>len-70||around(s,jump.s+10)<80)continue;if(Math.abs(sm[i])>peak){peak=Math.abs(sm[i]);ci=i;}}
 let cut=null;if(ci>=0){let a=ci,b=ci;while(Math.abs(sm[a-1])>peak*.45&&(a-1)*ds>50)a--;while(Math.abs(sm[b+1])>peak*.45&&(b+1)*ds<len-50)b++;const pad=Math.max(6,(40-(b-a)*ds)/2);cut={s0:a*ds-pad,s1:b*ds+pad,side:Math.sign(sm[ci])||1};}
 // The tunnel takes the 70 m furthest from both.
 let tunnel=null,far=0;for(let s=60;s<len-110;s+=8){const mid=s+35,dist=Math.min(around(mid,jump.s+10)-75,cut?around(mid,(cut.s0+cut.s1)/2)-(cut.s1-cut.s0)/2-45:1e9);if(dist>far){far=dist;tunnel={s0:s,s1:s+70};}}
 // Item rows sit on the four straightest stretches; boost pads on two of them; coins line the rest.
 const clear=s=>!(s>jump.s-62&&s<jump.s+jump.gap+34)&&!(cut&&s>cut.s0-8&&s<cut.s1+8);
 const straight=[...sm.keys()].map(i=>[i,Math.abs(sm[i])]).sort((a,b)=>a[1]-b[1]),spaced=[];
 for(const [i]of straight){const s=i*ds;if(s<40||s>len-30||!clear(s)||!clear(s+25))continue;if(spaced.every(j=>around(s,j*ds)>len/7))spaced.push(i);if(spaced.length===4)break;}
 for(let i=Math.floor(45/ds);spaced.length<4&&i<n;i++){const s=i*ds;if(s<len-30&&clear(s)&&clear(s+25)&&spaced.every(j=>around(s,j*ds)>len/9))spaced.push(i);}
 const boxes=[],pads=[],coins=[];spaced.forEach((i,k)=>{for(const d of [-3.6,-1.2,1.2,3.6])boxes.push({s:i*ds,d});if(k<2)pads.push({s:(i*ds+25)%len,d:k?-2.5:2.5});});
 for(let k=0;k<12;k++){const s=(len*(k+.5)/12+17)%len,d=(rnd()-.5)*6;if(s>jump.s-6&&s<jump.s+jump.gap+16)continue;for(let j=0;j<3;j++)coins.push({s:(s+j*3)%len,d});}
 // A coin arc over the gap, and a tempting line through the shortcut.
 for(let j=0;j<4;j++)coins.push({s:jump.s+2+j*3.4,d:0,air:1.5+Math.sin((j+.5)/4*Math.PI)*2.4});
 if(cut)for(let j=0;j<4;j++)coins.push({s:cut.s0+(cut.s1-cut.s0)*(j+1.5)/7,d:cut.side*(KART.wall+2.2)});
 // Hills: three harmonics, flattened around the grid, plus the ramp and the lower landing.
 const hp=[rnd(),rnd(),rnd()].map(v=>v*Math.PI*2),raw=pts.map((_,i)=>{const u=i/n*Math.PI*2;return Math.sin(u+hp[0])+.5*Math.sin(2*u+hp[1])+.3*Math.sin(3*u+hp[2]);}),lo=Math.min(...raw);
 const hgt=raw.map((v,i)=>{const s=i*ds,flat=smooth((Math.min(s,len-s)-24)/70);let h=(v-lo)*theme.hill*.6*flat;const u=s-jump.s;
  if(u>-jump.ramp&&u<=0)h+=jump.rise*smooth(1+u/jump.ramp);else if(u>0&&u<jump.gap)h+=jump.rise-(jump.rise+jump.drop)*u/jump.gap;else if(u>=jump.gap&&u<jump.gap+26)h-=jump.drop*(1-smooth((u-jump.gap)/26));return h;});
 // Corners bank toward the inside.
 const bank=sm.map(c=>clamp(c*7,-.15,.15));
 const track={seed,theme:theme.id,name:theme.name,len,ds,pts,ang,curve:sm,hgt,bank,jump,cut,tunnel,boxes,pads,coins};tracks.set(seed,track);if(tracks.size>8)tracks.delete(tracks.keys().next().value);return track;
}
function resample(raw,n){const seg=raw.map((p,i)=>Math.hypot(raw[(i+1)%raw.length][0]-p[0],raw[(i+1)%raw.length][1]-p[1])),total=seg.reduce((a,b)=>a+b,0),out=[];let i=0,acc=0;
 for(let k=0;k<n;k++){const want=k/n*total;while(acc+seg[i]<want){acc+=seg[i];i++;}const f=(want-acc)/seg[i],a=raw[i],b=raw[(i+1)%raw.length];out.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);}return out;}
function minRadius(pts){const n=pts.length;let min=Infinity;for(let i=0;i<n;i+=2){const a=pts[(i-4+n)%n],b=pts[i],c=pts[(i+4)%n],ab=Math.hypot(b[0]-a[0],b[1]-a[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]),ca=Math.hypot(a[0]-c[0],a[1]-c[1]),area=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;if(area>1e-6)min=Math.min(min,ab*bc*ca/(4*area));}return min;}
// Track sample at distance s (any value; wraps): position, heading and curvature, interpolated.
export function trackAt(t,s){const u=((s%t.len)+t.len)%t.len/t.ds,i=Math.floor(u)%t.pts.length,j=(i+1)%t.pts.length,f=u-Math.floor(u),a=t.pts[i],b=t.pts[j];
 return {x:a[0]+(b[0]-a[0])*f,y:a[1]+(b[1]-a[1])*f,ang:t.ang[i]+wrap(t.ang[j]-t.ang[i])*f,curve:t.curve[i]+(t.curve[j]-t.curve[i])*f};}
export function trackPoint(t,s,d){const q=trackAt(t,s);return {x:q.x-Math.sin(q.ang)*d,y:q.y+Math.cos(q.ang)*d,ang:q.ang};}
// Road surface height at (s, d): the hill profile plus the bank across the road.
export function trackHeight(t,s,d=0){const u=((s%t.len)+t.len)%t.len/t.ds,i=Math.floor(u)%t.pts.length,j=(i+1)%t.pts.length,f=u-Math.floor(u);return t.hgt[i]+(t.hgt[j]-t.hgt[i])*f-d*(t.bank[i]+(t.bank[j]-t.bank[i])*f);}
// How far a kart may stray to one side (1 = left): the barrier, or further where the shortcut opens.
export function wallAt(t,s,side){const c=t.cut;if(!c||side!==c.side)return KART.wall;const u=((s%t.len)+t.len)%t.len;return KART.wall+KART.cut*clamp(Math.min(u-c.s0,c.s1-u)/14,0,1);}
const local=(t,p)=>((p%t.len)+t.len)%t.len;
const gap=(t,a,b)=>{const g=((a-b)%t.len+t.len)%t.len;return g>t.len/2?g-t.len:g;};

// Rivals: who they are decides how they race. weight wins shunts, slip is how often they run
// wide, noise is how ragged their line is, and each has one habit of their own.
const NAMES=['Blaze','Mochi','Turbo Tank','Pixel','Duchess'],COLORS=['#ff5f6d','#ffb547','#5ee7ff','#c18cff','#5cff9b'];
export const RIVALS=[{role:'YOU',weight:1,slip:0,noise:0},{role:'THE BULLY',weight:1.35,slip:1,noise:1.5,bully:true},{role:'THE TACTICIAN',weight:.9,slip:.7,noise:1,tactician:true},{role:'THE HEAVY',weight:1.8,slip:1.1,noise:1.2,accel:.86,top:1.012},{role:'THE WILDCARD',weight:.8,slip:2,noise:3,wild:true,top:1.02},{role:'THE PRO',weight:1,slip:.35,noise:.6}];
function kart(i,rnd){const row=Math.floor(i/2),col=i%2;return {id:i,name:i?NAMES[i-1]:'YOU',color:i?COLORS[i-1]:'#b9ff5e',p:-4-row*5,d:col?-2.4:2.4,a:0,v:0,steer:0,drift:0,charge:0,boost:0,spin:0,item:null,coins:0,finished:false,time:0,skill:i?.93+rnd()*.06+(i===1?.03:0):1,line:0,think:0,draft:0,slip:0,y:0,vy:0,sink:0,shield:0,hitCd:0};}

export class KartGame {
 constructor(random=Math.random,worldSeed=0){this.random=random;this.worldSeed=worldSeed;this.track=kartTrack(worldSeed);this.status='ready';this.time=0;this.score=0;this.events=[];this.reason='';
  this.karts=Array.from({length:KART.rivals+1},(_,i)=>kart(i,random));this.input={left:false,right:false,down:false};this.place=KART.rivals+1;this.lap=0;this.bones=[];this.rockets=[];this.taken=[];this.coinTaken=[];this.acc=0;this.distance=0;this.hits=0;this.turbos=0;this.held=0;this.autoDrift=false;this.bonus=0;this.drafts=0;
  this.go=KART.grid;this.rev=0;this.outro=0;this.margin=0;this.order=[...this.karts];
  this.feats=[];this.cup=0;this.daily=false;this.supers=0;this.jumps=0;this.knocks=0;this.cuts=0;this.cutLap=-1;this.lastLapPlace=1;}
 get twist(){return this.daily?DAILY_TWIST(this.worldSeed):null;}
 get league(){return CUPS[this.cup]||CUPS[0];}
 // The shell hands over the player's best score before the lights: it decides the cup.
 setCup(best){if(this.status==='ready'&&this.go>=KART.grid)this.cup=cupFor(best);return this.cup;}
 feat(id){if(this.feats.includes(id))return;this.feats.push(id);this.events.push({type:'feat',id,name:FEATS.find(f=>f.id===id)?.name||id});}
 get you(){return this.karts[0];}
 get finalLap(){return this.lap>=KART.laps-1;}
 // Music tempo follows the player's speed, and the last lap pushes it to the top of the range.
 get speed(){return 25+Math.min(1,this.you.v/KART.boost+(this.finalLap&&!this.you.finished?.3:0))*15;}
 get heat(){return heatOf(Math.max(0,this.you.p)/this.track.len,FULL_HEAT.kart);}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';this.input={left:false,right:false,down:false};}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 // Held controls: ← / → steer, ↓ drifts; ↑ (a press) fires the item. On the grid, any press as
 // the last light comes on is a rocket start; pressing during the lights before that wastes it.
 press(dir,down){if(this.status!=='playing')return false;
  if(this.go>0){if(down&&!this.rev&&this.go<1.5){this.rev=this.go<=.42?1:-1;this.events.push({type:'rev',good:this.rev===1});}if(dir in this.input)this.input[dir]=down;return true;}
  if(dir==='up'){if(down)return this.useItem(this.you);return false;}if(!(dir in this.input))return false;this.input[dir]=down;return true;}
 move(dir){return this.press(dir,true);}
 useItem(k){const it=k.item,t=this.track;if(!it||k.finished||k.sink>0)return false;k.item=null;
  if(it==='boost'){k.boost=Math.max(k.boost,1.4);this.events.push({type:'boost',kart:k.id});}
  else if(it==='bone'){this.bones.push({p:k.p-2.5,d:k.d,life:30});this.events.push({type:'drop',kart:k.id});}
  else if(it==='shield'){k.shield=KART.shield;this.events.push({type:'shield',kart:k.id});}
  // The howl is a shockwave: everyone close by spins, front or back.
  else if(it==='howl'){let n=0;for(const o of this.karts)if(o!==k&&!o.finished&&Math.abs(gap(t,o.p,k.p))<KART.howl&&this.spinOut(o,'howl',k.id))n++;if(!k.id&&n){this.hits+=n;this.bonus+=150*n;if(n>=2)this.feat('kart.howl2');if(this.hits>=3)this.feat('kart.hits3');}this.events.push({type:'howl',kart:k.id,n});}
  else{const ahead=this.karts.filter(o=>o!==k&&!o.finished&&o.p>k.p).sort((a,b)=>a.p-b.p)[0];this.rockets.push({from:k.id,to:ahead?.id??-1,t:ahead?clamp((ahead.p-k.p)/32,.6,1):.6,p:k.p,d:k.d});this.events.push({type:'rocket',kart:k.id,to:ahead?.id??-1});}
  return true;}
 tick(dt){if(this.status!=='playing')return;this.acc+=dt;while(this.acc>=KART.step&&this.status==='playing'){this.acc-=KART.step;this.step(KART.step);}trackHeat(this,this.heat);}
 step(h){const t=this.track,heat=this.heat;
  // The lights: three reds, then green. Nobody moves until they go out.
  if(this.go>0){const was=this.go;this.go=Math.max(0,this.go-h);for(const [at,n]of [[1.8,1],[1.2,2],[.6,3]])if(was>at&&this.go<=at)this.events.push({type:'light',n});
   if(this.go<=0){this.events.push({type:'go'});if(this.rev===1){this.you.boost=1.15;this.bonus+=150;this.events.push({type:'rocketstart'});this.feat('kart.rocketstart');}else if(this.rev===-1)this.events.push({type:'bogged'});
    for(const k of this.karts)if(k.id&&this.random()<(k.id===5?.6:.25))k.boost=.5;}
   return;}
  this.time+=h;
  for(const k of this.karts){if(k.id)this.drive(k,h,heat);else this.player(k,h);this.physics(k,h,t);}
  // Kart-to-kart contact: the heavier kart holds its line, a hard shunt knocks the lighter one off its.
  for(let i=0;i<this.karts.length;i++)for(let j=i+1;j<this.karts.length;j++){const a=this.karts[i],b=this.karts[j];if(a.y>.4||b.y>.4||a.sink>0||b.sink>0)continue;const dp=gap(t,a.p,b.p),dd=a.d-b.d;
   if(Math.abs(dp)<1.7&&Math.abs(dd)<1.4){const wa=RIVALS[i].weight,wb=RIVALS[j].weight,over=(1.4-Math.abs(dd))*(dd>=0?1:-1);a.d+=over*wb/(wa+wb);b.d-=over*wa/(wa+wb);
    if(!(a.hitCd>0)&&!(b.hitCd>0)){a.hitCd=b.hitCd=.4;const hard=Math.abs(a.v*Math.sin(a.a)-b.v*Math.sin(b.a))>2.2||Math.abs(a.v-b.v)>7;if(hard){const light=wa<wb?a:b,s=light===a?Math.sign(over):-Math.sign(over);if(!(light.shield>0)){light.v*=.93;light.a=clamp(light.a+s*.1,-1.1,1.1);}}
     this.events.push({type:i?'clash':'bump',a:i,b:j,hard});}}}
  // Slipstream: tuck in behind another kart for a second and get slung past it.
  for(const k of this.karts){k.hitCd=Math.max(0,(k.hitCd||0)-h);k.shield=Math.max(0,(k.shield||0)-h);
   const towed=!k.finished&&!k.spin&&!k.y&&k.v>18&&k.boost<=0&&this.karts.some(o=>{if(o===k)return false;const g=gap(t,o.p,k.p);return g>2.5&&g<13&&Math.abs(o.d-k.d)<1.4;});
   k.draft=towed?(k.draft||0)+h*(this.twist?.id==='tailwind'?2:1):Math.max(0,(k.draft||0)-h*2);if(k.draft>=KART.draftTime){k.draft=0;k.boost=Math.max(k.boost,KART.draftBoost);if(!k.id){this.drafts++;this.bonus+=50;this.events.push({type:'draft'});if(this.drafts>=3)this.feat('kart.draft3');}}}
  this.rank();this.pickups(h,t);this.projectiles(h,t);this.rank();
  // Everyone else is home: the player gets a few seconds, then the race is called.
  const rivals=this.karts.slice(1);if(!this.you.finished&&rivals.every(k=>k.finished)&&this.time-Math.max(...rivals.map(k=>k.time))>8){this.you.finished=true;this.you.time=this.time;this.finish();}
  // After the flag the field keeps racing to the line for a moment: the podium shot.
  if(this.outro>0&&(this.outro-=h)<=0){this.outro=0;this.end(this.summary());}
 }
 player(k,h){const i=this.input,st=k.finished?0:(i.left?1:0)-(i.right?1:0),down=i.down&&!k.finished;
  // The wheel swings to full lock in about a tenth of a second, so taps make small corrections.
  k.steer+=clamp(st-k.steer,-KART.steerRate*h,KART.steerRate*h);
  // Touch players drift by holding a turn, but only where there is a corner to slide through.
  const bend=trackAt(this.track,k.p+5).curve,corner=Math.abs(bend)>.006&&Math.sign(bend)===st;
  this.held=st?this.held+h:0;const want=(down||this.autoDrift&&this.held>.2&&corner)&&st!==0&&k.v>12&&!k.spin&&!k.y;
  if(want&&!k.drift){k.drift=st;k.charge=0;this.events.push({type:'hop'});}
  if(k.drift&&!(down||this.autoDrift&&st===k.drift&&Math.abs(bend)>.003&&Math.sign(bend)===k.drift)){this.releaseDrift(k);}}
 releaseDrift(k){const lvl=k.charge>=1.8?2:k.charge>=.9?1:0;k.drift=0;k.charge=0;if(lvl&&!k.spin){k.boost=Math.max(k.boost,(lvl===2?1.3:.7)*(this.twist?.id==='turbo'?1.5:1));if(!k.id){this.turbos++;if(lvl===2)this.supers++;this.bonus+=lvl*100;this.events.push({type:'miniturbo',level:lvl});if(this.turbos>=10)this.feat('kart.drift10');if(this.supers>=3)this.feat('kart.super3');}}}
 drive(k,h,heat){const t=this.track,R=RIVALS[k.id],look=trackAt(t,k.p+14+k.v*.4),you=this.you,s=local(t,k.p),c=t.cut;
  // Racing line: hug the inside of the next corner; dodge bones just ahead.
  if((k.think-=h)<=0){k.think=.4+this.random()*.3;k.line=clamp(look.curve*260,-3.6,3.6)+(this.random()-.5)*R.noise;
   const bone=this.bones.find(b=>{const g=gap(t,b.p,k.p);return g>0&&g<18&&Math.abs(b.d-k.d)<1.6;});if(bone)k.line=bone.d>0?bone.d-2.6:bone.d+2.6;
   const behind=this.karts.some(o=>o!==k&&!o.finished&&gap(t,k.p,o.p)>1&&gap(t,k.p,o.p)<12),near=this.karts.some(o=>o!==k&&!o.finished&&Math.abs(gap(t,o.p,k.p))<KART.howl-2),target=this.karts.some(o=>o!==k&&!o.finished&&gap(t,o.p,k.p)>3&&gap(t,o.p,k.p)<(R.tactician?26:60)),hunted=this.rockets.some(r=>r.to===k.id);
   // Everyone fires eventually; the tactician waits for the moment and the wildcard cannot wait at all.
   if(k.item){const it=k.item,urge=R.wild?.9:R.tactician?.6:.3,ok=it==='boost'?!R.tactician||Math.abs(look.curve)<.006:it==='bone'?behind||!R.tactician:it==='rocket'?target:it==='howl'?near:hunted||!R.tactician&&behind;if(ok&&this.random()<urge)this.useItem(k);}
   // Rivals are not perfect: now and then one carries too much speed and runs wide in a corner.
   if(Math.abs(look.curve)>.012&&!k.slip&&this.random()<.05*R.slip){k.slip=.7+this.random()*.5;if(Math.abs(gap(t,k.p,you.p))<30)this.events.push({type:'slip',kart:k.id});}}
  if(k.slip>0){k.slip=Math.max(0,k.slip-h);k.line=-Math.sign(look.curve||1)*3.4;}
  // The bully leans on you when you are alongside; the wildcard dives through the shortcut on a boost.
  const side=gap(t,you.p,k.p);if(R.bully&&!you.finished&&Math.abs(side)<2.6&&Math.abs(you.d-k.d)<4.5&&!k.slip)k.line=you.d;
  if(c&&(R.wild||k.boost>.8)&&s>c.s0-18&&s<c.s1-24){if(k.item==='boost'&&s>c.s0-6)this.useItem(k);if(k.boost>.25)k.line=c.side*(wallAt(t,k.p+8,c.side)-1.7);}
  // Line up square for the ramp.
  if(s>t.jump.s-30&&s<t.jump.s)k.line=clamp(k.line,-3,3);
  const err=clamp((k.line-k.d)*.35,-.45,.45);k.steer=clamp((err-k.a)*3.2,-1,1);
  const lead=you.p-k.p,rubber=1+clamp(lead*.0045,-.07,.12);k.cap=Math.min(KART.boost,KART.top*this.league.pace*ramp(.92,1.02,heat)*k.skill*(R.top||1)*rubber*(k.slip>0?.84:1));}
 physics(k,h,t){const q=trackAt(t,k.p),side=k.d>=0?1:-1,off=Math.abs(k.d)>KART.width/2,air=k.y>0,s0=local(t,k.p),j=t.jump;
  if(k.sink>0){k.sink=Math.max(0,k.sink-h);k.v=0;if(!k.sink){k.p+=j.s+j.gap+4-s0;k.d=clamp(k.d,-3,3);k.a=0;k.v=7;this.events.push({type:'rescue',kart:k.id});}return;}
  if(k.spin>0){k.spin=Math.max(0,k.spin-h);k.v=Math.max(0,k.v-26*h);}
  // Hills: climbing costs a little top speed, the way down gives it back.
  const slope=clamp((trackHeight(t,k.p+1)-trackHeight(t,k.p-1))/2,-.14,.14);
  const top=k.boost>0?KART.boost:(off?KART.offroad:((k.cap??KART.top)+Math.min(10,k.coins)*(this.twist?.id==='gold'?.5:.25))*(1-slope*.8));k.boost=Math.max(0,k.boost-h);
  if(k.finished)k.v=Math.max(0,k.v-8*h);else if(!k.spin&&!air)k.v+=(k.v<top?KART.accel*(RIVALS[k.id].accel||1)*(k.boost>0?2.2:1):-(off?30:12))*h;k.v=clamp(k.v,0,KART.boost);
  let rate=k.spin?0:k.steer*1.85*Math.min(1,k.v/9)*(air?.25:1);
  if(k.drift){let wheel=k.steer;
   // Touch drifting (hold one side): the slide rides the corner by itself and hugs the inside line,
   // so the player's job is when to start it and when to let go for the mini-turbo.
   if(!k.id&&this.autoDrift){const aim=clamp((clamp(q.curve*260,-3.2,3.2)-k.d)*.12,-.3,.3);wheel=clamp((q.curve*k.v*Math.cos(k.a)+(aim-k.a)*3-k.drift*.6)/.7,-1,1);}
   rate=k.drift*.6+wheel*.7;const before=k.charge;k.charge+=h*(!k.id&&this.autoDrift?1.1:wheel*k.drift>.5?1.5:.9);if(!k.id&&(before<.9&&k.charge>=.9||before<1.8&&k.charge>=1.8))this.events.push({type:'charge',level:k.charge>=1.8?2:1});}
  if(k.id&&k.drift)k.drift=0;
  // The inside of a corner is the short way round: distance along the track grows as the arc shrinks.
  const along=k.v*Math.cos(k.a)*h/(1-clamp(k.d*q.curve,-.3,.3));
  k.a=clamp(k.a+rate*h-q.curve*along,-1.1,1.1);if(Math.abs(k.steer)<.05&&!k.drift)k.a*=1-1.2*h;
  k.p+=along;k.d+=k.v*Math.sin(k.a)*h*(k.drift?.8:1);if(!k.id&&along>0&&!k.finished)this.distance+=along;
  const lim=wallAt(t,k.p,side)-KART.radius;
  if(Math.abs(k.d)>lim){k.d=side*lim;if(!k.touch){if(!k.id&&k.v>6){this.knocks++;this.events.push({type:'wall'});}k.v*=.75;}else k.v*=1-1.2*h;k.touch=true;k.a*=-.25;if(k.drift&&!k.id)this.releaseDrift(k);}else k.touch=false;
  // The ramp: leave the lip with speed and fly the gap; arrive slow and drop into it.
  const s1=local(t,k.p);
  if(!air&&s0<j.s&&s1>=j.s&&s1-s0<5&&k.v>=8){k.y=.01;k.vy=2.6+k.v*.13;if(k.drift)this.releaseDrift(k);if(!k.id)this.events.push({type:'jump'});}
  else if(air){const fall=k.vy;k.vy-=KART.gravity*h;k.y+=k.vy*h-(trackHeight(t,k.p)-trackHeight(t,k.p-along));
   if(k.y<=0){k.y=0;k.vy=0;if(s1>j.s&&s1<j.s+j.gap-.3)this.dunk(k);else{if(fall<-5&&!k.finished)k.boost=Math.max(k.boost,.35);if(!k.id){this.jumps++;this.bonus+=100;this.events.push({type:'land'});if(this.jumps>=KART.laps)this.feat('kart.air3');}}}}
  else if(s1>j.s+.4&&s1<j.s+j.gap-.4)this.dunk(k);
  // The shortcut pays once a lap, and only if you really went through the dirt.
  const c=t.cut;if(!k.id&&c&&!k.finished&&s1>c.s0+14&&s1<c.s1-14&&k.d*c.side>KART.wall+.6&&this.cutLap!==Math.floor(k.p/t.len)){this.cutLap=Math.floor(k.p/t.len);this.cuts++;this.bonus+=250;this.events.push({type:'shortcut'});if(k.boost>0)this.feat('kart.shortcut');}
  const lap=Math.floor(k.p/t.len);if(!k.finished&&k.p>=0){if(!k.id&&lap>this.lap&&lap<KART.laps){this.lap=lap;if(lap===KART.laps-1)this.lastLapPlace=this.place;this.events.push({type:'lap',lap:lap+1,final:lap===KART.laps-1});}
   if(lap>=KART.laps){k.finished=true;k.time=this.time;if(!k.id)this.finish();}}}
 // Into the gap: a second and a half lost while the crane drops the kart on the far side.
 dunk(k){k.sink=1.4;k.y=0;k.vy=0;k.v=0;k.boost=0;k.drift=0;k.charge=0;k.spin=0;this.events.push({type:'splash',kart:k.id});}
 pickups(h,t){
  this.taken=this.taken.map(x=>({...x,t:x.t-h})).filter(x=>x.t>0);
  for(const k of this.karts){if(k.finished||k.sink>0)continue;const s=local(t,k.p);
   t.boxes.forEach((b,i)=>{if(k.item||this.taken.some(x=>x.i===i))return;if(Math.abs(gap(t,s,b.s))<1.3&&Math.abs(k.d-b.d)<1.3){this.taken.push({i,t:2.5});k.item=this.roll(k);if(!k.id)this.events.push({type:'item',item:k.item});}});
   for(const pad of t.pads)if(Math.abs(gap(t,s,pad.s))<1.4&&Math.abs(k.d-pad.d)<1.8&&k.boost<.6){k.boost=.9;if(!k.id)this.events.push({type:'pad'});}
   if(!k.id)t.coins.forEach((c,i)=>{const lapKey=Math.floor(k.p/t.len)*1000+i;if(this.coinTaken.includes(lapKey))return;if(Math.abs(gap(t,s,c.s))<1.1&&Math.abs(k.d-c.d)<(c.air?2.2:1.2)){this.coinTaken.push(lapKey);if(this.coinTaken.length>200)this.coinTaken.shift();if(k.coins<10)k.coins++;this.bonus+=this.twist?.id==='gold'?100:50;this.events.push({type:'coin'});if(k.coins>=10)this.feat('kart.coins10');}});}
 }
 // Items favour whoever is behind: the back of the field sees boosts and rockets, the front sees
 // bones, shields and the howl to defend with. The leader never draws a rocket.
 roll(k){const back=Math.max(0,this.order.indexOf(k))/KART.rivals,r=this.random(),a=.2+back*.26,b=a+.2+back*.08,c=b+.2-back*.08,d=c+.2-back*.04,it=this.twist?.id==='rockets'?(r<.65?'rocket':'shield'):r<a?'boost':r<b?'rocket':r<c?'bone':r<d?'shield':'howl';return it==='rocket'&&back===0?'shield':it;}
 projectiles(h,t){
  for(const b of this.bones){b.life-=h;for(const k of this.karts){if(k.spin>0||k.finished||k.y>.5||k.sink>0)continue;if(Math.abs(gap(t,k.p,b.p))<1.1&&Math.abs(k.d-b.d)<1.1){b.life=0;this.spinOut(k,'bone');}}}
  this.bones=this.bones.filter(b=>b.life>0);
  for(const r of this.rockets){r.t-=h;const target=this.karts[r.to];if(target){r.p=target.p-r.t*14;r.d+=(target.d-r.d)*Math.min(1,h*8);}else r.p+=50*h;
   if(r.t<=0&&target&&!target.finished&&this.spinOut(target,'rocket',r.from)&&r.from===0){this.hits++;this.bonus+=200;this.events.push({type:'hit',kart:target.id});if(this.hits>=3)this.feat('kart.hits3');}}
  this.rockets=this.rockets.filter(r=>r.t>0);
 }
 // A shield eats one hit. Returns whether the kart actually spun.
 spinOut(k,cause,by=-1){if(k.spin>0||k.sink>0)return false;if(k.shield>0){k.shield=0;this.events.push({type:'block',kart:k.id,cause});if(!k.id){this.bonus+=100;this.feat('kart.block');}return false;}
  k.spin=1.1;k.drift=0;k.charge=0;k.boost=0;k.coins=Math.max(0,k.coins-3);if(!k.id)this.knocks++;this.events.push(k.id?{type:'wipeout',kart:k.id,cause,by}:{type:'spin',cause,by});return true;}
 rank(){const prev=this.place;this.order=[...this.karts].sort((a,b)=>a.finished&&b.finished?a.time-b.time:a.finished?-1:b.finished?1:b.p-a.p);if(!this.outro)this.place=this.order.indexOf(this.you)+1;if(this.place<prev&&this.time>1)this.events.push({type:'pass',place:this.place});
  this.score=Math.floor(this.distance/2)+this.bonus;}
 finish(){this.rank();const bonus=PLACE_BONUS[this.place-1]??0,par=KART.laps*this.track.len/24,fast=Math.max(0,Math.round((par-this.time)*30));this.bonus=Math.round((this.bonus+bonus+fast)*this.league.pay);
  // The margin to the nearest kart on the road, in seconds: under a quarter is a photo finish.
  const others=this.karts.slice(1).map(k=>k.finished?this.time-k.time:(this.you.p-k.p)/Math.max(8,k.v)),margin=Math.min(9.99,...others.map(Math.abs));this.margin=margin;this.outro=KART.outro;this.rank();
  this.events.push({type:'finish',place:this.place,bonus,fast,margin,photo:margin<.25});
  if(this.place===1){this.feat('kart.win');if(margin<.25)this.feat('kart.photo');if(this.lastLapPlace>3)this.feat('kart.lastfirst');}if(this.place<=3&&!this.knocks&&this.you.p>=KART.laps*this.track.len)this.feat('kart.clean');}
 // The line for the results screen: where, how close, who to blame, and what is next.
 summary(){const y=this.you,o=this.order,i=o.indexOf(y),near=this.place===1?o[1]:o[i-1],cup=this.league,next=CUPS[this.cup+1],gap=this.margin<.25?'a photo finish, '+this.margin.toFixed(2)+' s':this.margin.toFixed(1)+' s';
  return `${this.track.name}, ${cup.name}: ${ordinal(this.place)} of ${this.karts.length} in ${y.time.toFixed(1)} s${near?(this.place===1?`, ${gap} clear of ${near.name}`:`, ${gap} behind ${near.name}`):''}.${this.twist?' '+this.twist.name+'.':''}${next?(this.score>=next.need?` ${next.name} unlocked!`:` ${(next.need-this.score).toLocaleString('en-US')} more points opens the ${next.name}.`):''}`;}
}
export const ordinal=n=>n+(['th','st','nd','rd'][(n%100-20)%10]||['th','st','nd','rd'][n%100]||'th');

const num=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b,int=(n,a,b)=>Number.isInteger(n)&&num(n,a,b),bool=v=>typeof v==='boolean';
export const KART_FIELDS=['karts','input','place','lap','bones','rockets','taken','coinTaken','acc','distance','hits','turbos','held','autoDrift','bonus','drafts','go','rev','outro','margin','feats','cup','daily','supers','jumps','knocks','cuts','cutLap','lastLapPlace'];
const FEAT_IDS=FEATS.map(f=>f.id);
// Saves from before the themed circuits lack go/rev/outro and the per-kart flight fields: they are
// refused here (the circuit under them has changed shape), never half-loaded.
export function validKartSnapshot(s){const cap=KART.laps*2000,side=KART.wall+KART.cut;
 return Array.isArray(s.karts)&&s.karts.length===KART.rivals+1&&s.karts.every((k,i)=>k&&k.id===i&&num(k.p,-40,cap)&&num(k.d,-side,side)&&num(k.a,-1.1,1.1)&&num(k.v,0,KART.boost)&&num(k.steer,-1,1)&&[-1,0,1].includes(k.drift)&&num(k.charge,0,30)&&num(k.boost,0,2)&&num(k.spin,0,1.1)&&(k.item===null||ITEMS.includes(k.item))&&int(k.coins,0,10)&&bool(k.finished)&&num(k.time,0,1e6)&&num(k.skill,.5,1.1)&&num(k.line,-side,side)&&num(k.think,-.1,1)&&(k.touch===undefined||bool(k.touch))&&(k.cap===undefined||num(k.cap,0,KART.boost))&&num(k.draft,0,KART.draftTime+.1)&&num(k.slip,0,1.3)
   &&num(k.y,0,40)&&num(k.vy,-80,20)&&num(k.sink,0,1.4)&&num(k.shield,0,KART.shield)&&num(k.hitCd,0,.4)&&typeof k.name==='string'&&k.name.length<20&&/^#[0-9a-f]{6}$/.test(k.color))
  &&s.input&&['left','right','down'].every(d=>bool(s.input[d]))&&int(s.place,1,KART.rivals+1)&&int(s.lap,0,KART.laps)&&Array.isArray(s.bones)&&s.bones.length<=60&&s.bones.every(b=>b&&num(b.p,-60,cap)&&num(b.d,-side,side)&&num(b.life,-1,30))
  &&Array.isArray(s.rockets)&&s.rockets.length<=20&&s.rockets.every(r=>r&&int(r.from,0,KART.rivals)&&int(r.to,-1,KART.rivals)&&num(r.t,-1,1)&&num(r.p,-60,cap+100)&&num(r.d,-side,side))
  &&Array.isArray(s.taken)&&s.taken.length<=40&&s.taken.every(x=>x&&int(x.i,0,40)&&num(x.t,-1,2.5))&&Array.isArray(s.coinTaken)&&s.coinTaken.length<=200&&s.coinTaken.every(x=>int(x,-1000,1e6))
  &&num(s.acc,0,KART.step)&&num(s.distance,0,cap*2)&&int(s.hits,0,1e4)&&int(s.turbos,0,1e5)&&num(s.held,0,1e6)&&bool(s.autoDrift)&&int(s.bonus,0,1e7)&&int(s.drafts,0,1e5)
  &&num(s.go,0,KART.grid)&&[-1,0,1].includes(s.rev)&&num(s.outro,0,KART.outro)&&num(s.margin,0,10)
  &&Array.isArray(s.feats)&&s.feats.every(f=>FEAT_IDS.includes(f))&&new Set(s.feats).size===s.feats.length&&int(s.cup,0,CUPS.length-1)&&bool(s.daily)&&int(s.supers,0,1e5)&&int(s.jumps,0,1e4)&&int(s.knocks,0,1e6)&&int(s.cuts,0,1e4)&&int(s.cutLap,-1,KART.laps)&&int(s.lastLapPlace,1,KART.rivals+1);
}
