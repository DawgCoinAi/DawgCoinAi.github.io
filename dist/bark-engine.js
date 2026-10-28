// Last Bark Standing: twenty DAWGs on a rooftop that shrinks for ninety seconds. Steer with the
// held directions; hold BARK to charge and let go to blast everyone in a cone in front of you
// off the edge (a bigger charge throws further; a full charge is a MEGA bark). Off the roof is
// out. The player is dawg 0; the rest are AI with personalities, seeded by worldSeed.
// Units are meters on the roof, centred at (0, 0); y grows "down" on the 2D map.
import {seededRandom} from './mobile-core.js';
export const BARK={count:20,length:90,grace:8,radius:11,minRadius:2.4,speed:5.2,accel:26,drag:5.5,charge:1.1,cooldown:.55,range:2.6,rangeMax:5.6,cone:72,push:7,pushMax:19,recoil:.28,fall:1.1,fps:60};
export const NAMES=['Biscuit','Moxie','Riff','Goldie','Tango','Pixel','Duchess','Brick','Velvet','Uncle Bones','Miso','Scooter','Nova','Ziggy','Pepper','Mallow','Rocco','Juniper','Dash','Sable'];
export const STYLES=['brawler','bully','coward','drifter'];
const TAUNTS={win:['Last bark standing. Say it again.','The roof is yours. Nobody left to argue.'],
 early:['Off the roof before the ring even moved. Bold.','Knocked off early. The pigeons saw everything.'],
 mid:['Top half. The bottom half would like a word.','Gone, but not first. Growth.'],
 late:['So close to the top. The edge disagrees.','Podium, almost. The fall was very dramatic.']};
export const roofRadius=t=>t<BARK.grace?BARK.radius:Math.max(BARK.minRadius,BARK.radius-(BARK.radius-BARK.minRadius)*Math.min(1,(t-BARK.grace)/(BARK.length-BARK.grace)));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),wrap=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};

export class BarkGame {
 constructor(random=Math.random,worldSeed=0){this.random=random;this.worldSeed=worldSeed;this.status='ready';this.time=0;this.score=0;this.reason='';this.events=[];this.input={up:false,down:false,left:false,right:false,bark:false};
  const r=seededRandom((worldSeed||7)^0xba7c);this.dawgs=Array.from({length:BARK.count},(_,k)=>{const a=k/BARK.count*Math.PI*2,d=k?6.5+r()*3:0;return {k,name:k?NAMES[(k-1)%NAMES.length]:'You',style:k?(k%4===1?(k<10?'bully':'drifter'):STYLES[k%4]):'you',x:Math.cos(a)*d,y:Math.sin(a)*d,vx:0,vy:0,face:a+Math.PI,charge:0,cool:0,alive:true,fall:0,out:0,kos:0,think:r()*.8,aim:0,tx:0,ty:0};});
  this.alive=BARK.count;this.place=0;this.kos=0;this.acc=0;this.bonus=0;this.warned=-1;}
 get you(){return this.dawgs[0];}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 press(dir,down){if(!(dir in this.input))return false;this.input[dir]=!!down;return true;}
 move(dir){return this.press(dir,true);}
 tick(dt){if(this.status!=='playing')return;this.acc+=dt;while(this.acc>=1/BARK.fps&&this.status==='playing'){this.acc-=1/BARK.fps;this.step(1/BARK.fps);}}
 // One held direction set → steering vector, facing follows it.
 steer(d,ax,ay,bark,dt){const n=Math.hypot(ax,ay);if(n>0){ax/=n;ay/=n;d.vx+=ax*BARK.accel*dt;d.vy+=ay*BARK.accel*dt;d.face=Math.atan2(ay,ax);}
  const sp=Math.hypot(d.vx,d.vy),max=BARK.speed*(d.charge>0?.55:1);if(sp>max){d.vx*=max/sp;d.vy*=max/sp;}d.vx-=d.vx*Math.min(1,BARK.drag*dt*(n?.35:1));d.vy-=d.vy*Math.min(1,BARK.drag*dt*(n?.35:1));
  if(d.cool>0)d.cool=Math.max(0,d.cool-dt);
  if(bark&&d.cool<=0){if(!d.charge)this.events.push({type:'charge',k:d.k});d.charge=Math.min(1,d.charge+dt/BARK.charge);}
  else if(d.charge>0){this.bark(d);}}
 bark(d){const c=d.charge,mega=c>=.98,range=BARK.range+(BARK.rangeMax-BARK.range)*c,push=BARK.push+(BARK.pushMax-BARK.push)*c*c*(mega?1.25:1),half=(BARK.cone+(mega?30:0))*Math.PI/360;d.charge=0;d.cool=BARK.cooldown;const hits=[];
  for(const o of this.dawgs){if(o===d||!o.alive||o.fall)continue;const dx=o.x-d.x,dy=o.y-d.y,dist=Math.hypot(dx,dy);if(dist>range||dist<1e-6)continue;const ang=Math.atan2(dy,dx);if(Math.abs(wrap(ang-d.face))>half)continue;
   const f=push*(1-.55*dist/range);o.vx+=Math.cos(ang)*f;o.vy+=Math.sin(ang)*f;o.hitBy=d.k;o.hitT=this.time;hits.push(o.k);this.events.push({type:'hit',k:o.k,from:d.k,x:o.x,y:o.y,mega});}
  d.vx-=Math.cos(d.face)*push*BARK.recoil;d.vy-=Math.sin(d.face)*push*BARK.recoil;this.events.push({type:'bark',k:d.k,x:d.x,y:d.y,face:d.face,charge:c,mega,range,hits:hits.length});}
 // The AI: each style wants to be somewhere and barks for its own reasons.
 think(d,dt,R){d.think-=dt;const you=this.you,near=this.nearest(d),home=Math.hypot(d.x,d.y);
  if(d.think<=0){d.think=.25+this.random()*.45;const edge=home>R-1.6;let tx=0,ty=0;
   if(edge){tx=-d.x;ty=-d.y;}
   else if(d.style==='brawler'&&near){tx=near.x-d.x;ty=near.y-d.y;}
   else if(d.style==='bully'&&you.alive){tx=you.x-d.x;ty=you.y-d.y;}
   else if(d.style==='coward'){tx=-d.x*.6+(this.random()-.5)*3;ty=-d.y*.6+(this.random()-.5)*3;if(near&&Math.hypot(near.x-d.x,near.y-d.y)<2.2){tx=d.x-near.x;ty=d.y-near.y;}}
   else{const a=this.random()*Math.PI*2;tx=Math.cos(a)*3-d.x*.2;ty=Math.sin(a)*3-d.y*.2;}
   d.tx=tx;d.ty=ty;
   // Bark when a target is in the cone and close; cowards bark when crowded; everyone barks at a full charge.
   const target=d.style==='bully'&&you.alive?you:near;let want=false;
   if(target){const dx=target.x-d.x,dy=target.y-d.y,dist=Math.hypot(dx,dy),inCone=Math.abs(wrap(Math.atan2(dy,dx)-d.face))<BARK.cone*Math.PI/360;want=inCone&&dist<(d.style==='coward'?2.4:3.4)+d.charge*2.5;if(d.style==='brawler'&&dist<4.5&&!d.charge)want=true;}
   d.want=want;}
  // Hold the bark while there is a target, up to this style's patience, then let it go.
  const limit={brawler:.5,bully:.85,coward:.4,drifter:.7}[d.style];this.steer(d,d.tx,d.ty,d.want&&d.charge<limit,dt);}
 nearest(d){let best=null,bd=Infinity;for(const o of this.dawgs){if(o===d||!o.alive||o.fall)continue;const dist=Math.hypot(o.x-d.x,o.y-d.y);if(dist<bd){bd=dist;best=o;}}return best;}
 step(dt){this.time+=dt;const R=roofRadius(this.time),I=this.input;
  const you=this.you;if(you.alive&&!you.fall)this.steer(you,(I.right?1:0)-(I.left?1:0),(I.down?1:0)-(I.up?1:0),I.bark,dt);
  for(const d of this.dawgs){if(!d.k||!d.alive||d.fall)continue;this.think(d,dt,R);}
  for(const d of this.dawgs){if(!d.alive)continue;d.x+=d.vx*dt;d.y+=d.vy*dt;
   if(d.fall){d.fall+=dt;d.vx*=.98;d.vy*=.98;if(d.fall>=BARK.fall){d.alive=false;this.alive--;d.out=BARK.count-this.alive;const by=d.hitBy!==undefined&&this.time-d.hitT<2.5?this.dawgs[d.hitBy]:null;if(by&&by.alive){by.kos++;if(!by.k){this.kos++;this.bonus+=200;}}
    this.events.push({type:'out',k:d.k,name:d.name,by:by?.name||null,byYou:by?.k===0,left:this.alive});if(!d.k)return this.lose();if(this.alive<=1)return this.win();}continue;}
   if(Math.hypot(d.x,d.y)>R+.25){d.fall=1e-6;this.events.push({type:'fall',k:d.k,x:d.x,y:d.y});}}
  // Shoulder bumps keep the crowd from stacking.
  const live=this.dawgs.filter(d=>d.alive&&!d.fall);for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){const a=live[i],b=live[j],dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||1e-6;if(dist<.8){const p=(.8-dist)/2,nx=dx/dist,ny=dy/dist;a.x-=nx*p;a.y-=ny*p;b.x+=nx*p;b.y+=ny*p;}}
  const w=Math.floor(this.time);if(w>this.warned&&(w===BARK.grace||w===30||w===60||w===80)){this.warned=w;this.events.push({type:'shrink',t:w,radius:R});}
  this.score=Math.floor(this.time)*5+this.bonus;
  if(this.time>=BARK.length)this.win(true);}
 win(timeout=false){const you=this.you;this.place=1;this.bonus+=2000;this.score=Math.floor(this.time)*5+this.bonus;this.events.push({type:'win'});this.end(timeout?`Time. You outlasted the whole roof. ${this.kos} knocked off by you. ${TAUNTS.win[this.kos%2]}`:`Last bark standing. ${this.kos} knocked off by you. ${TAUNTS.win[this.kos%2]}`);}
 lose(){const you=this.you,place=this.alive+1;this.place=place;this.bonus+=Math.max(0,(BARK.count-place)*60);this.score=Math.floor(this.time)*5+this.bonus;const by=you.hitBy!==undefined&&this.time-you.hitT<2.5?this.dawgs[you.hitBy].name:null;
  const set=place>14?TAUNTS.early:place>4?TAUNTS.mid:TAUNTS.late;this.end(`${by?by+' barked you off the roof.':'You walked off the roof.'} ${place}${ordinalSuffix(place)} of ${BARK.count}. ${set[this.kos%2]}`);}
}
export const ordinalSuffix=n=>n%100>=11&&n%100<=13?'th':['th','st','nd','rd'][n%10]||'th';
export const BARK_FIELDS=['dawgs','alive','place','kos','acc','bonus','warned','input'];
const num=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b,int=(n,a,b)=>Number.isInteger(n)&&num(n,a,b);
export function validBarkSnapshot(s){
 return Array.isArray(s.dawgs)&&s.dawgs.length===BARK.count&&s.dawgs.every((d,k)=>d&&d.k===k&&typeof d.name==='string'&&d.name.length<=16&&(k?STYLES.includes(d.style):d.style==='you')&&num(d.x,-40,40)&&num(d.y,-40,40)&&num(d.vx,-60,60)&&num(d.vy,-60,60)&&num(d.face,-7,7)&&num(d.charge,0,1)&&num(d.cool,0,BARK.cooldown)&&typeof d.alive==='boolean'&&num(d.fall,0,BARK.fall+.1)&&int(d.out,0,BARK.count)&&int(d.kos,0,BARK.count)&&num(d.think,-1,2)&&num(d.tx,-40,40)&&num(d.ty,-40,40))
  &&int(s.alive,1,BARK.count)&&s.alive===s.dawgs.filter(d=>d.alive).length&&int(s.place,0,BARK.count)&&int(s.kos,0,BARK.count)&&s.kos===s.dawgs[0].kos&&num(s.acc,0,1)&&int(s.bonus,0,1e6)&&int(s.warned,-1,BARK.length)&&s.input&&['up','down','left','right','bark'].every(k=>typeof s.input[k]==='boolean')&&s.score===Math.floor(s.time)*5+s.bonus;}
