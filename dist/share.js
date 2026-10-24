// Sharing: score cards drawn on a canvas, links into a game or a player's profile, and one
// share sheet that uses the device's native share (with the card attached) when it can and
// falls back to social links, a saved image and a copied link.
import {gameById} from './games.js';
import {validDawg} from './dawg-career.js';
import {drawDawg} from './dawg-art.js';

export const SITE='https://dawgcoinai.github.io/';
const DISPLAY='"DAWG display","Arial Narrow",Impact,sans-serif',BODY='"DAWG body",system-ui,sans-serif';
const $=id=>document.getElementById(id);

// Links always point at the public site, so a link shared while testing locally still works.
export function shareBase(loc=globalThis.location){return loc&&/\.github\.io$/.test(loc.hostname)?loc.origin+loc.pathname:SITE;}
export function playLink(game,base=SITE){const u=new URL(base);u.search='';u.hash='';u.searchParams.set('play',game);return u.toString();}
export function profileLink(code,base=SITE){const u=new URL(base);u.search='';u.hash='';u.searchParams.set('player',code);return u.toString();}
export function readPlayLink(search){const id=new URLSearchParams(search).get('play');return gameById(id)?id:null;}
export function readPlayerLink(search){const code=(new URLSearchParams(search).get('player')||'').toUpperCase();return /^[A-F0-9]{8}$/.test(code)?code:null;}
export function socialTargets(text,url){const t=encodeURIComponent(text),u=encodeURIComponent(url),both=encodeURIComponent(text+' '+url);
 return [['X','https://twitter.com/intent/tweet?text='+t+'&url='+u],['Facebook','https://www.facebook.com/sharer/sharer.php?u='+u],['WhatsApp','https://wa.me/?text='+both],['Telegram','https://t.me/share/url?url='+u+'&text='+t],['Reddit','https://www.reddit.com/submit?url='+u+'&title='+t]].map(([name,href])=>({name,href}));}
export const fmt=n=>Math.max(0,Math.floor(Number(n)||0)).toLocaleString('en-US');

function backdrop(c,w,h,cx,cy){const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#1c0838');g.addColorStop(.6,'#0b0820');g.addColorStop(1,'#04060f');c.fillStyle=g;c.fillRect(0,0,w,h);
 for(let i=0;i<28;i++){c.fillStyle=i%2?'#ff5fc81c':'#5ee7ff14';c.beginPath();c.moveTo(cx,cy);c.arc(cx,cy,Math.max(w,h),i/28*Math.PI*2,(i+1)/28*Math.PI*2);c.fill();}
 // A neon floor grid running toward the horizon.
 const hy=h*.78;c.strokeStyle='#b48cff55';c.lineWidth=2;for(let i=0;i<10;i++){const y=hy+(h-hy)*Math.pow(i/9,1.8);c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
 for(let i=-12;i<=12;i++){c.beginPath();c.moveTo(w/2+i*w*.02,hy);c.lineTo(w/2+i*w*.16,h);c.stroke();}
 const v=c.createRadialGradient(w/2,h/2,h*.3,w/2,h/2,h*.85);v.addColorStop(0,'#00000000');v.addColorStop(1,'#000000aa');c.fillStyle=v;c.fillRect(0,0,w,h);}
function glowText(c,text,x,y,size,color,{font=DISPLAY,blur=28,align='center',weight=900}={}){c.save();c.font=`${weight} ${size}px ${font}`;c.textAlign=align;c.textBaseline='alphabetic';c.shadowColor=color;c.shadowBlur=blur;c.fillStyle=color;c.fillText(text,x,y);c.shadowBlur=0;c.fillText(text,x,y);c.restore();}
function fitSize(c,text,max,size,font=DISPLAY){c.font=`900 ${size}px ${font}`;const w=c.measureText(text).width;return w>max?Math.floor(size*max/w):size;}
function pill(c,text,x,y,color){c.save();c.font=`900 34px ${DISPLAY}`;const w=c.measureText(text).width+56;c.fillStyle=color;c.shadowColor=color;c.shadowBlur=24;c.beginPath();c.roundRect(x-w/2,y-46,w,62,31);c.fill();c.shadowBlur=0;c.fillStyle='#0b0820';c.textAlign='center';c.fillText(text,x,y-4);c.restore();}
export async function cardFonts(){try{await Promise.all([document.fonts.load(`900 100px ${DISPLAY}`),document.fonts.load(`400 40px ${BODY}`)]);}catch{}}

// Score card, 1080 × 1350 (fits feeds and stories). data: {game, score, best, medal, detail, player, dawg, unit}.
export function drawScoreCard(canvas,data){const w=canvas.width=1080,h=canvas.height=1350,c=canvas.getContext('2d'),title=(gameById(data.game)?.title||data.game||'DAWG Arcade').toUpperCase();
 backdrop(c,w,h,w/2,560);
 glowText(c,'DAWG ARCADE',w/2,110,44,'#b9ff5e',{blur:18});glowText(c,title,w/2,215,fitSize(c,title,940,104),'#ffffff',{blur:34});
 if(data.dawg&&validDawg(data.dawg)){try{c.save();c.shadowColor='#b48cff88';c.shadowBlur=24;drawDawg(c,data.dawg,w/2,715,450,0,'idle');c.restore();}catch{}}
 else{c.save();c.fillStyle='#b9ff5e22';c.beginPath();c.arc(w/2,560,200,0,Math.PI*2);c.fill();glowText(c,'🐶',w/2,630,190,'#ffffff',{font:BODY,blur:0});c.restore();}
 if(data.best)pill(c,'NEW PERSONAL BEST',w/2,312,'#ff5fc8');
 const score=fmt(data.score);glowText(c,score,w/2,1022,fitSize(c,score,960,190),'#b9ff5e',{blur:50});
 glowText(c,data.unit||'POINTS',w/2,1068,38,'#ffffffcc',{blur:0});
 if(data.medal)glowText(c,data.medal.toUpperCase(),w/2,1122,38,'#ffd36b',{blur:16});
 if(data.detail)glowText(c,data.detail.toUpperCase(),w/2,1170,fitSize(c,data.detail.toUpperCase(),980,32,BODY),'#5ee7ff',{font:BODY,blur:10,weight:400});
 c.fillStyle='#0b0a16e6';c.fillRect(0,h-84,w,84);c.fillStyle='#b9ff5e';c.fillRect(0,h-86,w,3);
 if(data.player){const by='PLAYED BY '+data.player.toUpperCase();glowText(c,by,w/2,1222,fitSize(c,by,900,30,BODY),'#ffffffaa',{font:BODY,blur:0,weight:400});}
 glowText(c,'CAN YOU BEAT IT?',48,h-30,36,'#ffffff',{align:'left',blur:0});glowText(c,'DAWGCOINAI.GITHUB.IO',w-48,h-30,32,'#b9ff5e',{align:'right',blur:12});
 return canvas;}

// Link preview card for the whole site, 1200 × 630. Takes an optional loaded hero image.
export function drawSiteCard(canvas,{head=null,games=12}={}){const w=canvas.width=1200,h=canvas.height=630,c=canvas.getContext('2d');backdrop(c,w,h,960,300);
 if(head){c.save();c.shadowColor='#b9ff5e';c.shadowBlur=70;const s=420;c.drawImage(head,975-s/2,290-s/2,s,s);c.restore();}
 glowText(c,'DAWG',70,200,170,'#b9ff5e',{align:'left',blur:40});glowText(c,'ARCADE',70,340,150,'#ffffff',{align:'left',blur:34});
 glowText(c,`${games} NEON GAMES. ONE DAWG.`,74,410,42,'#5ee7ff',{align:'left',blur:14});
 const chips=['KART RACING','PINBALL','3D MAZE','RUNNER','SNAKE','FLAPPY'];let x=74;c.font=`900 26px ${DISPLAY}`;for(const chip of chips){const cw=c.measureText(chip).width+36;if(x+cw>720)break;c.strokeStyle='#ff5fc8';c.lineWidth=3;c.beginPath();c.roundRect(x,450,cw,46,23);c.stroke();c.fillStyle='#ffd0ee';c.textAlign='left';c.fillText(chip,x+18,482);x+=cw+12;}
 glowText(c,'FREE IN YOUR BROWSER · DAWGCOINAI.GITHUB.IO',74,570,28,'#ffffffcc',{font:BODY,align:'left',blur:0,weight:400});
 return canvas;}

const toBlob=canvas=>new Promise(r=>{try{canvas.toBlob(b=>r(b),'image/png');}catch{r(null);}});

export class ShareSheet {
 constructor({openDialog}){this.openDialog=openDialog;this.url='';this.text='';this.file=null;this.objectUrl=null;
  $('shareNative').onclick=()=>this.native();$('shareCopy').onclick=()=>this.copy();
  $('shareSocials').addEventListener('click',e=>{if(e.target.closest('a'))this.note('Opening…');});}
 note(t){$('shareNote').textContent=t||'';}
 // opts: {title, text, url, card?: async canvas => void, filename?}
 async open({title,text,url,card=null,filename='dawg-arcade.png'}){this.text=text;this.url=url;this.file=null;this.note('');
  $('shareTitle').textContent=title;$('shareText').textContent=text;$('shareLink').textContent=url;
  const img=$('shareImage'),dl=$('shareDownload');if(this.objectUrl)URL.revokeObjectURL(this.objectUrl);this.objectUrl=null;img.hidden=dl.hidden=true;
  $('shareSocials').replaceChildren(...socialTargets(text,url).map(t=>{const a=document.createElement('a');a.href=t.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=t.name;return a;}));
  $('shareNative').hidden=!navigator.share;this.openDialog('shareDialog');
  if(card){try{await cardFonts();const cv=document.createElement('canvas');await card(cv);const blob=await toBlob(cv);if(blob){this.objectUrl=URL.createObjectURL(blob);img.src=this.objectUrl;img.hidden=false;dl.href=this.objectUrl;dl.download=filename;dl.hidden=false;
   const file=new File([blob],filename,{type:'image/png'});if(navigator.canShare?.({files:[file]}))this.file=file;}}catch{}}}
 async native(){if(!navigator.share)return;const base={title:'DAWG Arcade',text:this.text+' '+this.url};
  try{if(this.file)await navigator.share({...base,files:[this.file]});else await navigator.share({title:'DAWG Arcade',text:this.text,url:this.url});this.note('Shared. Good luck holding that record.');}
  catch(e){if(e?.name!=='AbortError'){try{await navigator.share({title:'DAWG Arcade',text:this.text,url:this.url});}catch{}}}}
 async copy(){try{await navigator.clipboard.writeText(this.text+' '+this.url);this.note('Link copied.');}catch{this.note(this.url);}}
}
