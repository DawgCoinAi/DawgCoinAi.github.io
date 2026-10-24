import {worldLook,hash} from './world.js';
export function drawRunner(r,g){
 const c=r.c,look=worldLook(g.worldSeed,Math.floor(g.distance/800)),t=r.reduced?0:g.time;
 r.sky(t*.3,g.worldSeed);r.glow(210,190,130,look.glow+'38');
 c.fillStyle='#111929';c.beginPath();c.moveTo(166,170);c.lineTo(254,170);c.lineTo(430,560);c.lineTo(-10,560);c.closePath();c.fill();
 const project=(lane,z)=>{const p=Math.max(0,1-z/270),scale=.12+p*p*.88;return {x:210+(lane-1)*118*scale,y:172+scale*328,scale};};
 for(const lane of [-.5,.5,1.5,2.5]){const a=project(lane,270),b=project(lane,0);r.line(a.x,a.y,b.x,b.y,lane===-.5||lane===2.5?look.glow:look.accent+'55',lane===-.5||lane===2.5?3:1);}
 for(let i=0;i<16;i++){const z=(i*20-g.distance%20+300)%300,a=project(-.5,z),b=project(2.5,z);r.line(a.x,a.y,b.x,b.y,look.accent+'22',1);}
 for(let side=0;side<2;side++)for(let i=0;i<5;i++){const p=project(side?3:-1,(i*57-g.distance%57+285)%285),h=(35+hash(g.worldSeed,i+side*5)*60)*p.scale;r.rect(p.x-16*p.scale,p.y-h,32*p.scale,h,look.floor,2);r.rect(p.x-17*p.scale,p.y-h,34*p.scale,3*p.scale,look.glow);r.rect(p.x-10*p.scale,p.y-h+8*p.scale,5*p.scale,9*p.scale,look.accent+'aa');}
 const box=(lane,z,type)=>{const p=project(lane,z),w=60*p.scale,h=(type==='block'?94:42)*p.scale;if(type==='bar'){r.rect(p.x-w/2,p.y-79*p.scale,6*p.scale,79*p.scale,'#7195ab',2);r.rect(p.x+w/2-6*p.scale,p.y-79*p.scale,6*p.scale,79*p.scale,'#7195ab',2);r.rect(p.x-w/2-4*p.scale,p.y-79*p.scale,w+8*p.scale,20*p.scale,look.glow,3);r.text('↓',p.x,p.y-62*p.scale,19*p.scale,'#161831','center');}else{r.rect(p.x-w/2+3*p.scale,p.y-h+6*p.scale,w,h,'#070d1caa',3);r.rect(p.x-w/2,p.y-h,w,h,type==='crate'?'#bf8a54':'#6a4774',4*p.scale);r.rect(p.x-w/2,p.y-h,w,5*p.scale,type==='crate'?'#f3c67d':'#ec8fba',2);r.line(p.x-w/2+6*p.scale,p.y-h+10*p.scale,p.x+w/2-6*p.scale,p.y-7*p.scale,'#f6d5a655',3*p.scale);r.line(p.x+w/2-6*p.scale,p.y-h+10*p.scale,p.x-w/2+6*p.scale,p.y-7*p.scale,'#f6d5a655',3*p.scale);r.text(type==='crate'?'↑':'×',p.x,p.y-h*.45,22*p.scale,'#fff0ce','center');}};
 for(const row of [...g.rows].sort((a,b)=>b.z-a.z)){for(const o of row.obstacles)box(o.lane,row.z,o.type);const p=project(row.safe,row.z);r.glow(p.x,p.y-16*p.scale,19*p.scale,'#ffdc8d30');r.circle(p.x,p.y-16*p.scale,9*p.scale,'#f6d384');r.circle(p.x,p.y-16*p.scale,5*p.scale,'#af8247');if(row.power){r.glow(p.x,p.y-40*p.scale,27*p.scale,look.accent+'55');r.text(row.power==='shield'?'◇':'U',p.x,p.y-33*p.scale,26*p.scale,look.accent,'center');}}
 const p=project(g.visualLane,0),lift=g.jump>0?Math.sin(g.jump/.85*Math.PI)*72:0,slide=g.slide>0,bob=slide?0:Math.sin(t*17)*2;
 c.save();c.globalAlpha=.35;c.fillStyle='#000';c.beginPath();c.ellipse(p.x,509,25,7,0,0,Math.PI*2);c.fill();c.restore();
 if(g.shield){r.glow(p.x,458-lift,52,look.accent+'35');c.strokeStyle=look.accent;c.lineWidth=2;c.beginPath();c.ellipse(p.x,465-lift,37,45,0,0,Math.PI*2);c.stroke();}
 if(g.magnet>0)r.glow(p.x,465-lift,62,'#d18cff25');
 const y=(slide?492:468)-lift+bob;if(r.character)r.head(p.x,y,slide?58:88,slide?-.4:0,'run');else{r.rect(p.x-16,y+8,32,18,look.glow,8);r.rect(p.x-17,y+24,12,9,'#d9bf85',3);r.rect(p.x+6,y+24,12,9,'#d9bf85',3);r.head(p.x,y,slide?40:56,slide?-.18:0);}
 r.rect(0,0,420,52,'#101529e8');r.text(Math.floor(g.distance)+' m',18,23,13,look.accent);r.text(g.coins+' GOLD',402,23,12,'#f7d08e','right');r.text(look.label.toUpperCase(),18,42,8,'#c5bdd5');r.text(g.magnet>0?'MAGNET '+Math.ceil(g.magnet)+'s':g.shield?'SHIELD READY':'FIND YOUR LINE',402,42,8,g.shield||g.magnet>0?look.accent:'#c5bdd5','right');
 r.rect(0,530,420,30,'#101529ef');r.text('← → DODGE     ↑ JUMP     ↓ SLIDE',210,549,10,'#e3d8f0','center');
}
