import {worldLook,hash,WEATHER} from './world.js';
import {DISTRICTS} from './engine.js';

// Scenery has its own deterministic hash. Drawing never consumes gameplay randomness.
export function atmosphere(r,seed,weather,time,h=230){
 const t=r.reduced?0:time;
 if(weather===1)for(let i=0;i<42;i++){const x=(hash(seed,i)*460+t*31)%460-20,y=(hash(seed,i+60)*h+t*(90+hash(seed,i+120)*40))%h;r.line(x,y,x-4,y+11,'#a9d7f344');}
 if(weather===2){for(let i=0;i<3;i++)r.glow((i*180+t*4)%600-80,h*.7+i*9,140,'#b2ced817');}
 if(weather===4)for(let i=0;i<14;i++){const x=hash(seed,i+200)*420,y=(hash(seed,i+240)*h-t*5+h*100)%h;r.circle(x,y,1,'#e2c5ff88');}
}
function skyline(r,seed,look,time,baseline=150){
 const c=r.c,g=c.createLinearGradient(0,0,0,230);g.addColorStop(0,look.sky);g.addColorStop(1,look.floor);r.rect(0,0,420,230,g);
 r.glow(300,50,160,look.glow+'2b');r.circle(320+hash(seed,3)*45,35,14,look.accent+'cc');
 for(let layer=0;layer<2;layer++)for(let i=0;i<12;i++){const x=i*43-15+hash(seed,i+layer*22)*15,w=25+hash(seed,i+30)*24,h=30+hash(seed,i+layer*35+90)*90,y=baseline-h+layer*20;r.rect(x,y,w,h+30,layer?look.floor:'#0d1427');r.rect(x,y,w,2,look.glow+'60');for(let a=0;a<3;a++)for(let b=0;b<6;b++){if(hash(seed,i*100+a*10+b)>.35)r.rect(x+5+a*10,y+10+b*13,3,5,(b+i)%3===0?look.accent+'75':look.glow+'50');}}
 for(let i=0;i<16;i++)r.circle(hash(seed,i+900)*420,hash(seed,i+950)*90,.6,'#efe8ff80');
}
function person(r,x,y,color,scale=.38,kind='dog',time=0){r.c.save();r.c.translate(x,y+Math.sin(time*2+x)*1.3);r.c.scale(scale,scale);r.npc(0,0,color,kind);r.c.restore();}
function label(r,text,x,y,color,max=180){r.c.save();r.c.font='800 12px system-ui,sans-serif';const w=r.c.measureText(text).width;r.text(text,x,y,Math.min(12,12*max/Math.max(w,1)),color,'center');r.c.restore();}
export function drawLivingStory(r,s,now=0){
 const c=r.c;c.setTransform(r.canvas.width/420,0,0,r.canvas.height/230,0,0);
 const e=s.episode,seed=s.episodeSeed,roomIndex=['block','diner','shop','club','roof'].indexOf(s.room),look=worldLook(seed,roomIndex),t=r.reduced?0:now/1000,weather=(e.look.weather+Math.floor(s.moves/8))%5,color=look.accent;
 skyline(r,seed+roomIndex*103,look,t);
 const outdoor=s.room==='block'||s.room==='roof';
 if(!outdoor){r.rect(0,0,420,165,look.sky+'dd');for(let i=0;i<4;i++){const x=18+i*104;r.rect(x,47,72,83,look.glow+'55',6);r.rect(x+4,51,64,75,'#101b2f',4);r.line(x+36,51,x+36,126,look.glow+'70');r.rect(x+8,100,56,24,look.accent+'13');}for(let i=0;i<4;i++){r.line(50+i*100,0,50+i*100,26,'#92829b');r.glow(50+i*100,33,27,color+'26');r.rect(39+i*100,26,22,5,color,3);}}
 r.rect(0,164,420,66,look.floor);for(let i=0;i<10;i++)r.line(i*55,164,i*55-60,230,look.glow+'20');for(let i=0;i<4;i++)r.line(0,177+i*16,420,177+i*16,look.glow+'18');
 const shift=(hash(seed,roomIndex+501)-.5)*28;
 if(s.room==='block'){
  r.rect(20,65,89,96,look.glow+'66',6);r.rect(26,71,77,84,'#ead8b9',3);r.text('TONIGHT',64,88,9,look.sky,'center');r.text(e.password,64,110,14,look.sky,'center');r.text('SOUNDCHECK',64,126,7,look.sky,'center');r.text(e.recipe.join(' / '),64,140,6,look.sky,'center');
  for(let i=0;i<4;i++)person(r,250+i*40+Math.sin(t*.4+i)*5,148,look.glow,.35,'dog',t);
  r.npc(202+shift,131,look.glow);label(r,e.cast.promoter.toUpperCase(),202+shift,207,color);r.rect(312,172,84,15,'#607c8e',9);r.rect(321,167,65,8,'#80cfe3',4);
 }
 if(s.room===e.barRoom){
  label(r,s.roomInfo().name.toUpperCase(),215,25,color,220);r.npc(300+shift,122,look.glow);r.rect(195,145,212,43,'#80566d',5);r.rect(191,140,220,8,'#dbb598',3);r.rect(221,122,17,18,'#f3e6cb',3);r.circle(240,129,5,'#e4d0ac');r.rect(355,100,33,40,'#667a8e',4);r.rect(362,107,17,10,color+'99',2);
  r.rect(20,62,100,63,'#151e30',4);r.text('AFTER MIDNIGHT',70,79,8,color,'center');r.text(['COFFEE & COURAGE','NO BAD IDEAS?','ONE MORE CUP'][seed%3],70,96,7,'#ecdbbf','center');r.text('1 TOKEN',70,113,9,'#ecdbbf','center');if(!r.reduced)for(let i=0;i<3;i++)r.circle(229+Math.sin(t+i)*3,114-i*6-(t*4%6),2,'#e4efff40');
 }
 if(s.room===e.djRoom){
  label(r,s.roomInfo().name.toUpperCase(),210,25,color,220);for(let i=0;i<4;i++){r.circle(40+i*100,75,23,'#080f22');r.circle(40+i*100,75,8,i%2?color:look.glow);r.circle(40+i*100,75,2,'#11182b');}r.npc(298+shift,122,look.glow,'dj');r.rect(188,149,220,42,'#263650',5);
  for(let i=0;i<3;i++){const on=s.mix.length>i||s.flags.mixed;r.rect(200+i*64,155,56,25,on?color:look.glow+'80',4);r.text(e.recipe[i],228+i*64,171,8,on?look.sky:'#f4e9ff','center');}r.text(s.flags.awake?'DJ '+e.cast.dj.toUpperCase():'Z Z Z',302,205,8,color,'center');
 }
 if(s.room==='club'){
  label(r,s.roomInfo().name.toUpperCase(),210,27,color,220);r.rect(245,50,92,124,look.glow+'55',5);r.rect(252,58,78,111,'#11182b',3);r.line(291,58,291,169,look.glow,2);r.rect(27,58,68,105,'#c1a6c5',8);r.rect(33,64,56,93,'#344e69',5);r.line(40,125,82,80,'#b7dbe94a',7);r.npc(201+shift,130,look.glow,'brick');r.line(143,173,366,173,color,4);for(const x of [143,366]){r.circle(x,163,5,'#efcf87');r.rect(x-2,166,4,34,'#bda67e');}
 }
 if(s.room==='roof'){
  r.line(0,28,420,49,'#897c9d');for(let i=0;i<10;i++){const y=28+i*2.2;r.circle(i*46,y,3,i%2?color:look.glow);r.glow(i*46,y,15,(i%2?color:look.glow)+'25');}r.rect(182,176,225,27,look.glow+'60',5);r.npc(288+shift,132,look.glow,'nova');r.line(370,115,370,177,'#c3b0d0',3);r.circle(370,112,6,'#e8d9f3');r.rect(190,159,34,35,'#121c2f',3);r.circle(207,177,11,'#7186a1');for(let i=0;i<4;i++)person(r,20+i*23,152,look.accent,.28,'dog',t);label(r,e.plot.venue,290,67,color);
 }
 if(s.room===e.tokenRoom&&!s.flags.token){r.glow(357,190,19,'#ffdb773b');r.circle(357,190,5,'#ffe6a2');r.text('✧',366,185,11,'#ffe6a2');}
 const bob=r.reduced?0:Math.sin(t*2)*1.2;if(r.character)r.head(137,159+bob,110);else{r.rect(122,180,10,23,'#10192b',3);r.rect(141,180,10,23,'#10192b',3);r.rect(117,199,18,6,'#ddbf85',3);r.rect(139,199,19,6,'#ddbf85',3);r.rect(115,160,45,32,look.glow,10);r.line(138,165,138,188,'#dfbd83',2);r.head(137,146+bob,62);}
 if(outdoor)atmosphere(r,seed,weather,t);r.rect(0,213,420,17,'#0b1423c9');r.text(s.ending?'A NIGHT TO REMEMBER':WEATHER[weather].toUpperCase(),12,225,7,color);r.text('EPISODE '+e.look.code,408,225,7,'#ded5e8','right');
}
export function drawLivingCity(r,game,now=0){
 const c=r.c;c.setTransform(r.canvas.width/420,0,0,r.canvas.height/190,0,0);const seed=game.world.seed+game.district*771,look=worldLook(seed),t=r.reduced?0:now/1000;
 skyline(r,seed,look,t,120);r.rect(0,133,420,57,'#172335');r.rect(0,130,420,5,look.glow+'90');r.line(0,164,420,164,'#d5caa533',2);
 const signs=['NIGHT MARKET','RECORDS','COFFEE','THE EXCHANGE','ROOFTOP'];for(let i=0;i<4;i++){const x=i*109+5,h=37+hash(seed,i)*30;r.rect(x,129-h,94,h,look.floor,3);r.rect(x+5,133-h,84,13,look.glow+'44',2);label(r,signs[(i+game.district)%5],x+47,143-h,look.accent,80);r.rect(x+8,150-h,27,h-22,'#0a182a');r.rect(x+44,150-h,41,h-22,look.accent+'25');}
 for(let i=0;i<8;i++){const x=(hash(seed,i+50)*520+t*(i%2?6:-7)+5200)%520-50;person(r,x,126, i%2?look.glow:look.accent,.22,'dog',t);}
 for(let i=0;i<3;i++){const dir=i%2?1:-1,x=(hash(seed,i+70)*620+t*dir*(24+i*7)+6200)%620-110;r.car(x,145+(i%2)*31,44+hash(seed,i+90)*14,dir,i%2?look.glow:look.accent);}
 game.world.rivals.filter(rival=>rival.district===game.district).forEach((rival,i)=>{const x=70+i*130;r.circle(x,93,3,'#ffc977');r.text(game.rivalName(rival),x,86,7,'#ffe0a0','center');});
 r.head(370,124,r.character?48:32);atmosphere(r,seed,game.world.weather,t,190);r.rect(0,0,420,20,'#091224c9');r.text(DISTRICTS[game.district].name.toUpperCase(),10,13,8,look.accent);r.text(game.cityWeather.toUpperCase(),410,13,8,'#ddd4ea','right');
}
