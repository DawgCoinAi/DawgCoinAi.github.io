import {drawPlayableDawg} from './dawg-art.js';
import {DIRS} from './engine.js';

export const THEMES={
  district:{name:'District neon',color:'#aa7bff',secondary:'#39e8ed',unlock:0},
  mint:{name:'Toxic mint',color:'#a4f44f',secondary:'#35dfbe',unlock:300},
  sunset:{name:'Golden hour',color:'#ff8e76',secondary:'#ffd260',unlock:900},
  ice:{name:'Arctic chrome',color:'#80d9ff',secondary:'#f3b6ff',unlock:1800}
};
const W=504,H=552,T=24;
const rivalColors=['#ff648d','#ad7dff','#2ce8da','#ffae50'];
const hexAlpha=(hex,a)=>hex+Math.round(a*255).toString(16).padStart(2,'0');
export class ArcadeRenderer {
 constructor(canvas,face){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.ctx.setTransform(2,0,0,2,0,0);this.ctx.imageSmoothingEnabled=true;this.ctx.imageSmoothingQuality='high';this.face=face;
  this.wallCanvas=document.createElement('canvas');this.wallCanvas.width=W*2;this.wallCanvas.height=H*2;
  this.wallContext=this.wallCanvas.getContext('2d');this.wallContext.scale(2,2);
  this.spriteCanvas=document.createElement('canvas');this.spriteCanvas.width=128;this.spriteCanvas.height=128;this.spriteReady=false;
  this.particles=[];this.labels=[];this.rings=[];this.trail=[];this.shake=0;this.flash=0;this.lastTime=0;this.trailTime=0;
  this.theme='district';this.cacheKey='';this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 }
 palette(game){return this.theme==='district'?game.district:THEMES[this.theme]||game.district;}
 reset(){this.particles=[];this.labels=[];this.rings=[];this.trail=[];this.shake=0;this.flash=0;this.cacheKey='';}
 setTheme(name){this.theme=name in THEMES?name:'district';this.cacheKey='';}
 burst(x,y,color,count=16,speed=65){
  for(let i=0;i<(this.reduced?Math.min(count,3):count);i++){const a=Math.random()*Math.PI*2,v=20+Math.random()*speed;this.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.4+Math.random()*.5,max:1,color,size:1+Math.random()*2});}
  if(this.particles.length>180)this.particles.splice(0,this.particles.length-180);
 }
 event(e,game){
  const p=game.position(game.player),x=((e.x??p.x)+.5)*T,y=((e.y??p.y)+.5)*T;
  if(e.type==='pellet')this.burst(x,y,'#ffd980',3,25);
  if(e.type==='power'){this.burst(x,y,'#dbff74',30,100);this.rings.push({x,y,r:12,life:1,color:'#dcff75'});this.flash=.12;}
  if(e.type==='dash'){this.burst(x,y,'#63f6ff',20,100);this.rings.push({x,y,r:6,life:.55,color:'#63f6ff'});}
  if(e.type==='eat'||e.type==='loot'){this.burst(x,y,e.type==='loot'?'#ffdd74':'#b9ff6c',30,100);this.labels.push({x,y,text:`+${e.bonus}`,life:1.4,color:e.type==='loot'?'#ffe78b':'#d9ff91'});this.shake=3;}
  if(e.type==='hit'){this.burst(x,y,'#ff658f',32,120);this.rings.push({x,y,r:10,life:.7,color:'#ff6085'});this.shake=7;this.flash=.22;this.trail=[];}
  if(e.type==='level'){for(let i=0;i<9;i++)this.burst(45+i*52,200+Math.sin(i)*70,['#c9fa6b','#bb8fff','#62e8ff'][i%3],20,130);this.flash=.25;}
 }
 buildWalls(game,palette){
  const c=this.wallContext;c.clearRect(0,0,W,H);
  const floor=c.createLinearGradient(0,0,W,H);floor.addColorStop(0,'#0b0c1b');floor.addColorStop(.5,'#111228');floor.addColorStop(1,'#080b17');c.fillStyle=floor;c.fillRect(0,0,W,H);
  c.strokeStyle='#b7aaff08';c.lineWidth=.5;
  for(let x=12;x<W;x+=T){c.beginPath();c.moveTo(x,0);c.lineTo(x,H);c.stroke();}
  for(let y=12;y<H;y+=T){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}
  const edges=[];
  game.map.forEach((row,y)=>[...row].forEach((v,x)=>{
   if(v!=='#')return;const px=x*T,py=y*T;
   const fill=c.createLinearGradient(px,py,px+T,py+T);fill.addColorStop(0,'#262440');fill.addColorStop(1,'#131629');c.fillStyle=fill;c.fillRect(px,py,T,T);
   const top=!game.wall(x,y-1),bottom=!game.wall(x,y+1),left=!game.wall(x-1,y),right=!game.wall(x+1,y);
   const x0=px+(left?4:0),x1=px+T-(right?4:0),y0=py+(top?4:0),y1=py+T-(bottom?4:0);
   if(top)edges.push([x0,y0,x1,y0]);if(bottom)edges.push([x0,y1,x1,y1]);if(left)edges.push([x0,y0,x0,y1]);if(right)edges.push([x1,y0,x1,y1]);
   if(!top&&!bottom&&x>0&&x<20&&y>0&&y<22){c.fillStyle='#cec2ff08';c.fillRect(px+7,py+6,10,1);c.fillRect(px+7,py+10,5,1);}
  }));
  c.lineCap='round';
  const drawEdges=(color,width,offset=0)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();edges.forEach(([x,y,x1,y1])=>{c.moveTo(x,y+offset);c.lineTo(x1,y1+offset);});c.stroke();};
  drawEdges('#00000070',8,4);
  c.shadowColor=palette.color;c.shadowBlur=10;drawEdges(hexAlpha(palette.color,.45),3.3);c.shadowBlur=0;
  drawEdges(palette.color,1.1);drawEdges('#e4d6ff65',.5,-.6);
  c.strokeStyle='#b5a6ff35';c.lineWidth=1;c.strokeRect(7,7,W-14,H-14);
  for(const [x,y]of [[12,12],[W-12,12],[12,H-12],[W-12,H-12]]){c.fillStyle=palette.secondary;c.shadowBlur=8;c.shadowColor=palette.secondary;c.fillRect(x-2,y-2,4,4);c.shadowBlur=0;}
 }
 drawGhost(g,game,t){
  const c=this.ctx,p=game.position(g),x=(p.x+.5)*T,y=(p.y+.5)*T;
  const scared=game.power>0,warning=game.power<2&&Math.sin(t*15)>0;
  const color=scared?(warning?'#e3e8ff':'#6571ff'):rivalColors[g.type];
  c.save();c.translate(x,y+(this.reduced?0:Math.sin(t*5+g.type)*1.4));c.globalAlpha=g.cooldown>0?.3:1;
  c.fillStyle='#0006';c.beginPath();c.ellipse(0,11,10,3,0,0,Math.PI*2);c.fill();
  c.shadowColor=color;c.shadowBlur=scared?12:7;
  const grad=c.createLinearGradient(-8,-11,10,12);grad.addColorStop(0,color);grad.addColorStop(1,scared?'#273270':'#25213f');c.fillStyle=grad;
  c.beginPath();c.moveTo(-10,8);c.lineTo(-10,-1);c.bezierCurveTo(-10,-13,10,-13,10,-1);c.lineTo(10,8);
  for(let i=3;i>=-3;i--)c.lineTo(i*3,7+(i%2===0?2:-1));c.closePath();c.fill();
  c.shadowBlur=0;c.strokeStyle=color;c.lineWidth=.7;c.stroke();
  c.fillStyle='#ffffff38';c.beginPath();c.ellipse(-3,-7,4,1.5,-.3,0,Math.PI*2);c.fill();
  c.fillStyle='#101225';c.beginPath();c.roundRect(-8,-3,16,8,3);c.fill();
  c.fillStyle=scared?'#e4ecff':'#fcffff';const [dx,dy]=DIRS[g.dir];
  c.beginPath();c.ellipse(-3.8,-.1,2.4,3,0,0,Math.PI*2);c.ellipse(3.8,-.1,2.4,3,0,0,Math.PI*2);c.fill();
  c.fillStyle='#181b38';c.beginPath();c.arc(-3.8+dx,-.1+dy,1.3,0,Math.PI*2);c.arc(3.8+dx,-.1+dy,1.3,0,Math.PI*2);c.fill();
  if(!scared){c.strokeStyle=color;c.lineWidth=1.4;c.beginPath();c.moveTo(-8,-5);c.lineTo(-3,-3);c.moveTo(8,-5);c.lineTo(3,-3);c.stroke();}
  else{c.strokeStyle='#e4ecff';c.lineWidth=1;c.beginPath();c.moveTo(-3,5);c.lineTo(-1,4);c.lineTo(1,5);c.lineTo(3,4);c.stroke();}
  c.restore();
 }
 draw(game,now){
  const dt=Math.min(.05,Math.max(0,(now-this.lastTime)/1000));this.lastTime=now;
  const t=this.reduced?0:now/1000,c=this.ctx,palette=this.palette(game);
  const cache=game.level+this.theme+(game.worldSeed||0);
  if(cache!==this.cacheKey){this.buildWalls(game,palette);this.cacheKey=cache;}
  c.clearRect(0,0,W,H);c.save();
  if(this.shake>0&&!this.reduced)c.translate((Math.random()-.5)*this.shake,(Math.random()-.5)*this.shake);
  this.shake=Math.max(0,this.shake-dt*22);
  c.drawImage(this.wallCanvas,0,0,W,H);
  const pos=game.position(game.player),px=(pos.x+.5)*T,py=(pos.y+.5)*T;
  const light=c.createRadialGradient(px,py,3,px,py,game.power>0?110:72);light.addColorStop(0,game.power>0?'#d6ff751b':hexAlpha(palette.secondary,.1));light.addColorStop(1,'#00000000');c.fillStyle=light;c.fillRect(px-115,py-115,230,230);
  game.pellets.forEach((v,k)=>{
   const[x,y]=k.split(',').map(Number),cx=(x+.5)*T,cy=(y+.5)*T;
   if(v==='o'){
    c.save();c.translate(cx,cy);c.rotate(t*.8);c.shadowColor='#ceff62';c.shadowBlur=12;c.strokeStyle='#dfff80';c.lineWidth=1.6;c.strokeRect(-4,-4,8,8);c.shadowBlur=0;c.fillStyle='#f2ffc8';c.fillRect(-2,-2,4,4);c.strokeStyle='#ceff6240';c.beginPath();c.arc(0,0,8+Math.sin(t*3),0,Math.PI*2);c.stroke();c.restore();
   }else{
    c.fillStyle='#d6a757';c.beginPath();c.arc(cx,cy+1,2,0,Math.PI*2);c.fill();c.fillStyle='#ffe9a4';c.beginPath();c.arc(cx-.3,cy-.3,1.3,0,Math.PI*2);c.fill();
   }
  });
  if(game.loot){const l=game.loot,x=(l.x+.5)*T,y=(l.y+.5)*T+Math.sin(t*4)*2;c.save();c.translate(x,y);c.shadowColor='#ffcf54';c.shadowBlur=18;c.fillStyle='#f5c95c';c.beginPath();c.moveTo(-4,-8);c.lineTo(4,-8);c.lineTo(2,-4);c.quadraticCurveTo(11,6,5,9);c.lineTo(-5,9);c.quadraticCurveTo(-11,6,-2,-4);c.closePath();c.fill();c.shadowBlur=0;c.fillStyle='#744c20';c.font='bold 12px monospace';c.textAlign='center';c.fillText('$',0,6);c.strokeStyle='#ffdf8e';c.lineWidth=1.8;c.beginPath();c.arc(0,0,13,-Math.PI/2,-Math.PI/2+Math.PI*2*l.time/12);c.stroke();c.restore();}
  if(game.status==='playing'&&game.player.moving){this.trailTime+=dt;if(this.trailTime>.035){this.trailTime=0;this.trail.push({x:px,y:py,life:game.dashTime>0?.4:.2});}}
  for(const point of this.trail){point.life-=dt;if(point.life<=0)continue;c.fillStyle=hexAlpha(game.dashTime>0?'#71f5ff':palette.secondary,Math.min(.25,point.life*.5));c.beginPath();c.arc(point.x,point.y,game.dashTime>0?10:5,0,Math.PI*2);c.fill();}this.trail=this.trail.filter(p=>p.life>0);
  game.ghosts.forEach(g=>this.drawGhost(g,game,t));
  c.save();c.translate(px,py);c.fillStyle='#0008';c.beginPath();c.ellipse(0,11,12,4,0,0,Math.PI*2);c.fill();
  if(game.power>0||game.dashTime>0||game.invincible>0&&game.status==='playing'){
   c.strokeStyle=game.dashTime>0?'#7af5ff':game.power>0?'#d6ff76':hexAlpha(palette.secondary,.65);c.lineWidth=1.7;c.shadowColor=c.strokeStyle;c.shadowBlur=8;c.beginPath();c.arc(0,0,14+Math.sin(t*5)*1,-t,t+Math.PI*1.5);c.stroke();c.shadowBlur=0;
  }
  if(game.invincible>0&&game.status==='playing')c.globalAlpha=.7+.3*Math.abs(Math.sin(t*7));
  const bounce=this.reduced?0:game.player.moving&&game.status==='playing'?Math.sin(t*(game.dashTime>0?30:18))*.7:Math.sin(t*2)*.5;
  const lean=game.player.dir==='left'?-.08:game.player.dir==='right'?.08:0;c.rotate(lean);
  if(this.character){drawPlayableDawg(c,this.character,0,bounce,29,t,game.player.moving?'run':'idle');}
  else if(this.face.complete&&this.face.naturalWidth){
   if(!this.spriteReady){const s=this.spriteCanvas.getContext('2d');s.imageSmoothingEnabled=true;s.imageSmoothingQuality='high';s.drawImage(this.face,0,0,128,128);this.spriteReady=true;}
   c.drawImage(this.spriteCanvas,-16,-17+bounce,32,32);
  }
  else{c.fillStyle='#d1f76a';c.beginPath();c.arc(0,0,10,0,Math.PI*2);c.fill();}
  c.restore();
  for(const ring of this.rings){ring.life-=dt;ring.r+=dt*95;if(ring.life<=0)continue;c.globalAlpha=Math.min(1,ring.life);c.lineWidth=1.2;c.strokeStyle=ring.color;c.beginPath();c.arc(ring.x,ring.y,ring.r,0,Math.PI*2);c.stroke();}c.globalAlpha=1;this.rings=this.rings.filter(r=>r.life>0);
  for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=dt*38;p.vx*=.985;if(p.life<=0)continue;c.globalAlpha=Math.min(1,p.life*2);c.fillStyle=p.color;c.fillRect(p.x,p.y,p.size,p.size);}c.globalAlpha=1;this.particles=this.particles.filter(p=>p.life>0);
  for(const l of this.labels){l.life-=dt;l.y-=dt*20;c.globalAlpha=Math.min(1,l.life*2);c.font='bold 15px monospace';c.textAlign='center';c.strokeStyle='#0a0b1c';c.lineWidth=4;c.strokeText(l.text,l.x,l.y);c.fillStyle=l.color;c.fillText(l.text,l.x,l.y);}c.globalAlpha=1;this.labels=this.labels.filter(l=>l.life>0);
  if(this.flash>0){c.fillStyle=`rgba(197,209,255,${this.reduced?0:this.flash*.25})`;c.fillRect(0,0,W,H);this.flash=Math.max(0,this.flash-dt);}
  c.restore();
 }
}
