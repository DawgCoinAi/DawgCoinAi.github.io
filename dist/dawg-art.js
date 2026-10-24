import {visualTraits,lookOf,CATALOG,flexRating} from './dawg-fashion.js';
import {baseTraits,COATS,OUTFITS,HATS,GLASSES,NECKS,PATTERNS,levelOf,rankOf,ratingOf} from './dawg-career.js';
const TAU=Math.PI*2;
const rounded=(c,x,y,w,h,r,fill,stroke='#141528',line=3)=>{c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}};
const oval=(c,x,y,rx,ry,fill,stroke=null,line=3)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}};
const path=(c,points,fill,stroke='#151526',line=3)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}};
function star(c,x,y,r,color){const p=[];for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,s=i%2?r*.48:r;p.push([x+Math.cos(a)*s,y+Math.sin(a)*s]);}path(c,p,color,null);}
export function traitLabels(d){const t=visualTraits(d);return [['Coat',COATS[t.coat][0]+' · '+PATTERNS[t.pattern]],['Fit',CATALOG.outfit.items[t.outfit]],['Headwear',CATALOG.hat.items[t.hat]],['Eyes',CATALOG.glasses.items[t.glasses]],['Accessory',CATALOG.neck.items[t.neck]],['Footwear',CATALOG.shoes.items[t.shoes]],['Back',CATALOG.back.items[t.back]],['Signature',t.rarity+' · '+['compact','classic','tall'][t.build]]];}
// Scalable full-body art. All visual randomness comes from immutable DNA, never gameplay RNG.
export function drawDawg(c,d,x,y,height,time=0,pose='idle'){
 if(!d)return;const t=visualTraits(d),[coat,fur,light]=COATS[t.coat],ink='#171629',color=`hsl(${t.hue} 63% 57%)`,dark=`hsl(${t.hue} 42% 29%)`,accent=`hsl(${t.accentHue} 72% 73%)`,shoe=`hsl(${t.shoeHue} 70% 68%)`,lv=levelOf(d),walk=pose==='run'?Math.sin(time*13)*5:t.pose===2?4:0;
 c.save();c.translate(x-height*.4,y-height*.5);c.scale(height/320,height/320);
 if(t.rarity==='Mythic'||lv>=10||t.aura>0){c.save();c.globalAlpha=.16;c.strokeStyle=color;c.lineWidth=3;for(let i=0;i<3;i++){c.beginPath();c.ellipse(128,176,100+i*8,121+i*6,0,0,TAU);c.stroke();}c.restore();}
 oval(c,128,302,78,12,'#05081566');
 if(t.aura===2||t.aura===4)for(let i=0;i<12;i++)star(c,25+(i*53)%210,43+(i*37)%240,3+i%3,accent);
 if(t.aura===3){c.strokeStyle=accent;c.lineWidth=3;for(let i=0;i<9;i++){c.beginPath();c.moveTo(26+i*26,284);c.lineTo(18+i*26,265-i%3*17);c.stroke();}}
 if(t.back===3)path(c,[[72,169],[181,169],[207,285],[128,269],[49,285]],dark,accent,3);
 if(t.back===2){rounded(c,42,180,36,83,14,dark);rounded(c,180,180,36,83,14,dark);path(c,[[45,255],[61,287],[74,255]],accent);path(c,[[183,255],[199,287],[212,255]],accent);}
 if(t.back===4){for(const side of [-1,1]){path(c,[[128+side*52,193],[128+side*116,159],[128+side*101,208],[128+side*113,229],[128+side*63,238]],color,accent,3);}}
 if(t.back===5){for(let i=0;i<5;i++){const a=-Math.PI/2+(i-2)*.42;c.strokeStyle=accent;c.lineWidth=3;c.beginPath();c.moveTo(128,231);c.lineTo(128+Math.cos(a)*123,231+Math.sin(a)*123);c.stroke();star(c,128+Math.cos(a)*123,231+Math.sin(a)*123,9,color);}}

 // Tail, legs, shoes: every DAWG has a complete silhouette.
 c.strokeStyle=fur;c.lineWidth=13;c.lineCap='round';c.beginPath();c.moveTo(178,241);c.bezierCurveTo(224,252,220,198,194,216);if(t.tail===0)c.bezierCurveTo(179,235,219,240,211,217);if(t.tail===2)c.bezierCurveTo(184,199,230,184,232,213);c.stroke();
 const tall=t.build===2?6:0,w=t.build===0?60:70;
 rounded(c,91,245,31,43+tall+walk,12,dark);rounded(c,136,245,31,43+tall-walk,12,dark);
 rounded(c,77,278+walk+tall,48,23,10,shoe);rounded(c,134,278-walk+tall,48,23,10,shoe);rounded(c,77,293+walk+tall,48,8,4,'#f7e9ce',null);rounded(c,134,293-walk+tall,48,8,4,'#f7e9ce',null);
 c.strokeStyle=ink;c.lineWidth=2;for(let i=0;i<3;i++){c.beginPath();c.moveTo(91+i*7,282+walk+tall);c.lineTo(94+i*7,288+walk+tall);c.moveTo(145+i*7,282-walk+tall);c.lineTo(148+i*7,288-walk+tall);c.stroke();}
 if(t.pattern===5){rounded(c,91,269+walk,31,10,3,light,null);rounded(c,136,269-walk,31,10,3,light,null);}
 if(t.shoes===1||t.shoes===3){rounded(c,79,267+walk+tall,44,20,7,t.shoes===3?dark:shoe);rounded(c,136,267-walk+tall,44,20,7,t.shoes===3?dark:shoe);}
 if(t.shoes===2){rounded(c,72,294+walk+tall,57,10,4,accent);rounded(c,129,294-walk+tall,57,10,4,accent);}
 if(t.shoes===4){rounded(c,82,281+walk+tall,37,5,2,'#faffff',null);rounded(c,139,281-walk+tall,37,5,2,'#faffff',null);}
 if(t.shoes===5){for(const ex of [101,158]){c.strokeStyle=accent;c.lineWidth=3;c.beginPath();c.ellipse(ex,309,28,5,0,0,TAU);c.stroke();}}
 // Arms and paws.
 rounded(c,56,183+walk,34,67,17,t.outfit===6?fur:color);rounded(c,167,183-walk,34,67,17,t.outfit===6?fur:color);
 oval(c,74,245+walk,17,18,light,ink);oval(c,185,245-walk,17,18,light,ink);
 rounded(c,128-w/2-12,172,w+24,89,24,t.outfit===2?'#242336':color);
 if(t.outfit===1){path(c,[[87,177],[127,210],[168,177],[152,164],[107,164]],dark);rounded(c,103,231,52,18,7,dark,null);c.strokeStyle=light;c.lineWidth=3;c.beginPath();c.moveTo(112,194);c.lineTo(110,216);c.moveTo(145,194);c.lineTo(147,216);c.stroke();}
 else if(t.outfit===2){path(c,[[98,176],[127,232],[154,176],[138,175],[128,206],[115,175]],'#f0e5c7');path(c,[[124,187],[133,187],[138,213],[128,222],[119,212]],color);}
 else if(t.outfit===4){rounded(c,87,207,25,25,4,dark);rounded(c,145,207,25,25,4,dark);}
 else if(t.outfit===6){star(c,129,219,22,light);star(c,129,219,13,dark);}
 else{rounded(c,87,177,13,73,5,light,null);c.strokeStyle=dark;c.lineWidth=3;c.beginPath();c.moveTo(129,190);c.lineTo(129,259);c.stroke();for(let i=0;i<3;i++)oval(c,135,219+i*12,2,2,light);}
 if(t.outfit===0){c.fillStyle=dark;c.font='bold 29px sans-serif';c.textAlign='center';c.fillText('D',110,228);}
 if(t.outfit===3){rounded(c,60,188,5,40,2,light,null);rounded(c,188,188,5,40,2,light,null);rounded(c,103,190,5,60,2,dark,null);}
 if(t.outfit===5){c.strokeStyle='#ffffff55';c.lineWidth=4;c.beginPath();c.moveTo(105,187);c.lineTo(115,245);c.moveTo(143,241);c.lineTo(161,234);c.stroke();}
 if(t.outfit===8){path(c,[[89,173],[112,203],[101,278],[77,263]],accent);path(c,[[167,173],[143,204],[155,278],[181,263]],color,accent);}
 if(t.outfit===9){path(c,[[84,172],[112,186],[99,203],[72,187]],'#f3ddb8');path(c,[[172,172],[144,186],[157,203],[184,187]],'#f3ddb8');}
 if(t.outfit===10){path(c,[[95,180],[116,180],[153,257],[132,257]],accent);rounded(c,104,222,42,14,4,dark);}
 if(t.outfit===11){for(const ex of [61,170])rounded(c,ex,182,25,24,7,dark,accent,2);rounded(c,102,190,52,20,5,dark,accent,2);}
 if(t.finish>0){c.strokeStyle=t.finish===2?'#ffffffbd':'#ffffff55';c.lineWidth=t.finish===2?5:2;c.beginPath();c.moveTo(101,184);c.lineTo(110,247);c.moveTo(153,188);c.lineTo(160,239);c.stroke();}
 if(t.back===1){path(c,[[81,180],[91,175],[177,240],[165,247]],dark);rounded(c,140,235,42,25,6,accent);}
 // DNA crest encodes all 128 identity bits in sixteen uniquely colored stitches.
 rounded(c,139,205,29,30,6,dark,null);for(let i=0;i<16;i++){const v=t.bytes[i];c.fillStyle=`rgb(${v},${255-v},${v*37%256})`;c.fillRect(143+i%4*5,209+Math.floor(i/4)*5,3,3);}
 if(t.outfit===7){c.font='bold 29px monospace';c.textAlign='center';c.fillStyle=light;c.fillText(String(t.crest%100).padStart(2,'0'),123,245);}
 // Oversized pug head, floppy ears, wrinkles and signature bulging eyes.
 oval(c,52,116,24,t.ears===1?49:t.ears===2?27:39,'#3c3040',ink);oval(c,204,116,24,t.ears===1?49:t.ears===2?27:39,'#3c3040',ink);
 const grad=c.createLinearGradient(70,50,180,173);grad.addColorStop(0,light);grad.addColorStop(.42,fur);grad.addColorStop(1,fur);oval(c,128,114,83,72,grad,ink,4);
 if(t.pattern===2)path(c,[[123,46],[138,46],[148,143],[111,143]],light,null);
 if(t.pattern===3)oval(c,128,156,55,31,light);
 if(t.pattern===4){c.strokeStyle=dark;c.lineWidth=6;for(let i=0;i<4;i++){c.beginPath();c.moveTo(70+i*32,68);c.lineTo(80+i*27,87);c.stroke();}}
 if(t.pattern===1)for(let i=0;i<16;i++){const b=t.bytes[i];oval(c,65+(b%126),72+((b*7+i*13)%80),1+(b%4),1+(b%3),dark);}
 c.strokeStyle='#5a4144';c.lineWidth=3;c.lineCap='round';for(let i=0;i<3;i++){c.beginPath();c.moveTo(111-i*8,65+i*7);c.quadraticCurveTo(122,60+i*9,127,82);c.moveTo(145+i*7,65+i*7);c.quadraticCurveTo(134,60+i*9,130,82);c.stroke();}
 const eyeY=108,eyeR=t.glasses===4?26:31;
 for(const ex of [88,168]){oval(c,ex,eyeY,eyeR+6,eyeR+5,ink);oval(c,ex,eyeY,eyeR,eyeR,'#fff3d1');const gaze=(t.bytes[9]%7)-3;oval(c,ex+gaze,eyeY+3,16,20,'#151729');oval(c,ex+gaze-5,eyeY-5,6,7,'#fffef2');oval(c,ex+gaze+8,eyeY+12,2,2,'#fffef2');c.strokeStyle='#d99595';c.lineWidth=1.3;c.beginPath();c.moveTo(ex+24,eyeY-16);c.lineTo(ex+18,eyeY-7);c.lineTo(ex+23,eyeY+1);c.stroke();}
 if(t.glasses===0||t.glasses===2){rounded(c,48,72,78,74,16,'#00000000',ink,7);rounded(c,132,72,78,74,16,'#00000000',ink,7);c.strokeStyle=ink;c.lineWidth=7;c.beginPath();c.moveTo(125,92);c.lineTo(134,92);c.stroke();if(t.glasses===2){rounded(c,52,77,69,62,14,`hsla(${t.hue},80%,40%,.45)`,null);rounded(c,137,77,68,62,14,`hsla(${t.hue},80%,40%,.45)`,null);c.strokeStyle='#ffffff80';c.lineWidth=4;c.beginPath();c.moveTo(64,88);c.lineTo(97,126);c.moveTo(148,88);c.lineTo(180,126);c.stroke();}}
 if(t.glasses===1){for(const ex of [88,168])oval(c,ex,eyeY,38,37,'#00000000',color,6);c.strokeStyle=ink;c.lineWidth=4;c.beginPath();c.moveTo(125,103);c.lineTo(132,103);c.stroke();}
 if(t.glasses===3){for(const ex of [88,168]){const p=[];for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?28:42;p.push([ex+Math.cos(a)*r,eyeY+Math.sin(a)*r]);}path(c,p,'#00000000',color,5);}}
 oval(c,128,157,46,32,'#403340',ink);oval(c,109,151,22,17,'#645051');oval(c,147,151,22,17,'#645051');oval(c,128,142,17,12,'#151322');oval(c,124,138,6,3,'#cbb8b0');
 c.strokeStyle='#100f20';c.lineWidth=4;c.beginPath();c.moveTo(128,150);c.lineTo(128,165);c.quadraticCurveTo(106,177,100,163);c.moveTo(128,165);c.quadraticCurveTo(149,179,158,163);c.stroke();
 rounded(c,121,165,23,29,10,'#f17c9b');c.strokeStyle='#bb4e73';c.lineWidth=2;c.beginPath();c.moveTo(132,170);c.lineTo(130,184);c.stroke();
 for(const ex of [99,157])for(let i=0;i<3;i++)oval(c,ex+(i%2)*8,150+i*5,1.3,1.3,'#241e30');
 // Headwear.
 if(t.hat===0){path(c,[[53,70],[61,37],[87,19],[165,19],[195,40],[202,68]],'#24273b',ink,4);rounded(c,85,40,86,26,9,color);rounded(c,95,45,65,16,5,'#292a3d');for(let i=0;i<6;i++)oval(c,102+i*10,53,2.4,2.4,light);path(c,[[166,30],[208,35],[224,54],[194,53]],dark);}
 if(t.hat===1){rounded(c,71,21,114,43,17,color);path(c,[[67,48],[189,48],[211,72],[48,72]],dark);rounded(c,75,44,108,9,3,light,null);}
 if(t.hat===2){oval(c,128,47,65,41,color,ink);rounded(c,60,43,137,28,9,dark);rounded(c,117,45,24,21,5,light);star(c,129,55,7,color);}
 if(t.hat===3){c.strokeStyle=ink;c.lineWidth=17;c.beginPath();c.arc(128,96,80,Math.PI,TAU);c.stroke();c.strokeStyle=color;c.lineWidth=9;c.stroke();rounded(c,36,83,23,48,10,color);rounded(c,197,83,23,48,10,color);}
 if(t.hat===4){path(c,[[51,64],[191,52],[202,75],[55,81]],color);path(c,[[191,58],[224,41],[214,74],[237,81],[202,84]],color);for(let i=0;i<8;i++)star(c,65+i*17,68,3,light);}
 if(t.hat===5){path(c,[[78,62],[65,22],[102,36],[128,8],[151,36],[187,22],[177,62]],'#f5cf7d',ink,4);rounded(c,77,54,103,14,5,'#c38a51');for(const ex of [99,129,159])oval(c,ex,58,4,5,color);}
 if(t.hat===6){rounded(c,55,49,147,21,6,color);path(c,[[116,60],[204,59],[221,81],[170,84]],dark);}
 if(t.hat===8){c.strokeStyle=accent;c.lineWidth=7;c.beginPath();c.ellipse(128,17,64,11,-.06,0,TAU);c.stroke();}
 if(t.hat===9){path(c,[[62,71],[34,22],[93,53]],dark,accent,3);path(c,[[192,71],[221,22],[164,53]],dark,accent,3);}
 if(t.hat===10){path(c,[[64,66],[62,19],[100,40],[128,6],[155,40],[196,19],[190,66]],dark,accent,4);for(const ex of [91,128,167])star(c,ex,51,8,accent);}
 if(t.glasses===5){rounded(c,48,78,161,58,12,`hsla(${t.accentHue},85%,60%,.25)`,accent,4);c.strokeStyle='#ffffff99';c.lineWidth=5;c.beginPath();c.moveTo(61,86);c.lineTo(116,125);c.stroke();}
 if(t.glasses===6){oval(c,88,108,38,38,'#00000000',accent,5);c.strokeStyle=accent;c.lineWidth=2;c.beginPath();c.moveTo(51,113);c.lineTo(49,164);c.stroke();}
 if(t.glasses===7){for(const ex of [88,168]){oval(c,ex,108,39,38,'#00000000',accent,5);star(c,ex-28,85,13,'#ffe29d');}}
 // Chain / accessory overlaps the collar but never hides the face.
 if(t.neck<2){c.strokeStyle=t.neck===0?'#e7bb66':'#bdccd9';c.lineWidth=6;c.beginPath();c.moveTo(88,182);c.quadraticCurveTo(128,231,168,182);c.stroke();for(let i=0;i<9;i++){const a=.4+i*.29;oval(c,128+39*Math.cos(a),180+33*Math.sin(a),4,3,t.neck===0?'#ffde8b':'#e8f3fa',ink,1);}star(c,128,216,9,t.neck===0?'#ffde8b':'#e8f3fa');}
 if(t.neck===2){path(c,[[91,181],[129,200],[166,181],[149,205],[147,239],[130,222],[116,232],[119,206]],shoe);}
 if(t.neck===3){c.strokeStyle=ink;c.lineWidth=8;c.beginPath();c.moveTo(91,183);c.quadraticCurveTo(128,214,166,183);c.stroke();rounded(c,84,181,20,26,6,shoe);rounded(c,155,181,20,26,6,shoe);}
 if(t.neck===4){c.strokeStyle=light;c.lineWidth=2;c.beginPath();c.moveTo(92,184);c.lineTo(128,220);c.lineTo(165,184);c.stroke();star(c,128,221,11,shoe);}
 if(t.neck>=5){c.strokeStyle=t.neck===7?accent:'#d9e6f2';c.lineWidth=t.neck===7?9:4;c.beginPath();c.moveTo(89,181);c.quadraticCurveTo(128,216,168,181);c.stroke();if(t.neck===5)star(c,128,210,10,'#e8f9ff');if(t.neck===6){oval(c,128,214,17,17,'#f3d58a',ink,2);c.fillStyle=ink;c.font='bold 22px sans-serif';c.textAlign='center';c.fillText('D',128,222);}if(t.neck===7)for(let i=0;i<5;i++)oval(c,100+i*14,195+Math.sin(i/4*Math.PI)*12,4,4,accent);}
 if(lv>=25){star(c,75,213,10,'#fff0ae');star(c,186,212,6,'#fff0ae');}
 c.restore();
}
export function drawCharacterCard(c,d,width=720,height=1000){const t=visualTraits(d),glow=`hsl(${t.hue} 60% 65%)`;c.save();c.scale(width/720,height/1000);const g=c.createLinearGradient(0,0,720,1000);g.addColorStop(0,'#23213d');g.addColorStop(1,'#090d19');c.fillStyle=g;c.fillRect(0,0,720,1000);rounded(c,22,22,676,956,28,'#00000000',glow,3);c.fillStyle='#d6ff87';c.font='bold 20px sans-serif';c.textAlign='left';c.fillText('$DAWG / ORIGIN COLLECTION',52,69);c.fillStyle=glow;c.font='16px monospace';c.textAlign='right';c.fillText(t.rarity.toUpperCase(),667,103);drawDawg(c,d,360,410,555);c.textAlign='center';c.fillStyle='#fff4df';c.font='bold 39px sans-serif';c.fillText(d.name,360,748,620);c.fillStyle=glow;c.font='19px sans-serif';c.fillText('LEVEL '+levelOf(d)+'  ·  '+rankOf(d).toUpperCase(),360,788);c.fillStyle='#bbb5d0';c.font='15px sans-serif';c.fillText(COATS[t.coat][0]+' / '+CATALOG.outfit.items[t.outfit]+' / '+CATALOG.hat.items[t.hat],360,827);c.font='14px monospace';c.fillText(d.id,360,889);c.fillText('FLEX '+flexRating(d)+' · CAREER '+ratingOf(d)+' / 9000',360,921);c.font='12px sans-serif';c.fillText('Collectible game character · local save · no blockchain',360,951);c.restore();}
const sprites=new Map();
// Cache small gameplay sprites so phones do not redraw hundreds of vector paths every frame.
export function drawPlayableDawg(c,d,x,y,height,time=0,pose='idle'){
 if(typeof document==='undefined'){drawDawg(c,d,x,y,height,time,pose);return;}
 const stage=levelOf(d)>=25?2:levelOf(d)>=10?1:0,frame=pose==='run'?Math.floor(time*8)%4:0,key=d.id+':'+(d.genome?.version||1)+':'+JSON.stringify(lookOf(d))+':'+stage+':'+pose+':'+frame;
 let canvas=sprites.get(key);if(!canvas){canvas=document.createElement('canvas');canvas.width=192;canvas.height=240;drawDawg(canvas.getContext('2d'),d,96,120,240,frame*Math.PI/26,pose);sprites.set(key,canvas);if(sprites.size>32)sprites.delete(sprites.keys().next().value);}
 c.drawImage(canvas,x-height*.4,y-height*.5,height*.8,height);
}
