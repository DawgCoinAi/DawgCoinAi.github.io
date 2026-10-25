// Discoveries: the arcade introduces its features one at a time, as players earn them. Each one
// shows once, as a card with a button that takes you straight there, when its moment comes
// (a first finished run, a new level, a streak, an unlock). Seen ones stay listed on the Me tab
// so anyone can go back to them. Pure rules here; the app says what's true and where to go.
const $=id=>document.getElementById(id);
export const SEEN_KEY='dawg-discovered';
// ctx: {runs, level, minutes, streak, unlocked (count), bests (games with a score), hasName,
//       hasEmail, dawgs, views (has played a game with 1P/3P), medals, endings, friends}
export const DISCOVERIES=[
 {id:'dawg',icon:'🐶',title:'Meet your DAWG',text:'Every run you finish earns XP for your DAWG. Train its stats, name it, and dress it in the atelier. It plays every game with you.',cta:'OPEN MY DAWG',go:'kennel',when:c=>c.runs>=1},
 {id:'views',icon:'🎥',title:'Three ways to see every game',text:'Press V, or the 1P / 3P / 2D button, to switch between first person, third person and the classic flat board. Each game remembers your pick.',cta:'GOT IT',go:null,when:c=>c.runs>=2},
 {id:'share',icon:'📣',title:'Share your scores',text:'Every finished run has a Share button: it makes a score card with your DAWG on it, and a link that challenges friends to beat you.',cta:'SHARE MY BEST',go:'share',when:c=>c.bests>=1&&c.runs>=3},
 {id:'rankings',icon:'🏆',title:'The Rankings',text:'Every game has a global board, plus the Arcade League that adds up your levels. Give yourself a name so the pack knows who to chase.',cta:'SEE RANKINGS',go:'rankings',when:c=>c.runs>=4},
 {id:'unlocks',icon:'🔓',title:'How games unlock',text:'Each locked game opens when you reach its level, play long enough, or keep a daily streak. Tap any locked card to see how close you are.',cta:'SHOW ME',go:'library',when:c=>c.level>=2},
 {id:'daily',icon:'🔥',title:'Daily Run and streaks',text:'One maze for everyone, every day. Playing on consecutive days builds a streak, and streaks unlock games on their own.',cta:'PLAY TODAY’S RUN',go:'daily',when:c=>c.runs>=5},
 {id:'friends',icon:'👥',title:'Friends and challenges',text:'Share your friend code or add a friend’s. Then challenge them to beat a score from any game, and watch their runs in your feed.',cta:'FIND FRIENDS',go:'friends',when:c=>c.level>=3},
 {id:'atelier',icon:'👔',title:'Dress to impress',text:'The atelier has outfits, hats, glasses and dyes for your DAWG. Looks earn Flex, and your DAWG wears them in every 3D game.',cta:'OPEN THE ATELIER',go:'atelier',when:c=>c.level>=4},
 {id:'cloud',icon:'☁️',title:'Keep your progress anywhere',text:'You already have a cloud save as a guest. Add your email and it follows you to any phone or computer.',cta:'ADD MY EMAIL',go:'cloud',when:c=>c.level>=5&&!c.hasEmail},
 {id:'passport',icon:'🛂',title:'The Arcade Passport',text:'A stamp for every game you play well. Fill the passport for the city legend badge.',cta:'SEE MY PASSPORT',go:'passport',when:c=>c.bests>=4},
 {id:'league',icon:'🏁',title:'The circuit league',text:'Adopt more DAWGs and race them against each other in the circuit league on the Me tab.',cta:'OPEN THE LEAGUE',go:'league',when:c=>c.level>=6},
 {id:'hustle',icon:'💼',title:'Street Hustle is open',text:'Thirty nights, one city, your contact on every corner. Buy low, sell high and handle whoever stops you.',cta:'START HUSTLING',go:'trade',when:c=>c.open.includes('trade')},
 {id:'story',icon:'🌙',title:'After Hours is open',text:'One velvet suit, one night, six endings. Talk to everyone, pick up everything, and try typing commands like the classics.',cta:'START THE NIGHT',go:'story',when:c=>c.open.includes('story')},
 {id:'owner',icon:'🔑',title:'Owner tools',text:'You run this arcade. Open every game for any player by friend code, from the Me tab or any player card.',cta:'OPEN OWNER TOOLS',go:'owner',when:c=>c.owner}
];
export const readSeen=()=>{try{const v=JSON.parse(localStorage.getItem(SEEN_KEY)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[];}catch{return [];}};
export const nextDiscovery=(ctx,seen)=>DISCOVERIES.find(d=>!seen.includes(d.id)&&d.when(ctx))||null;

export class Discoveries {
 // io: {ctx()→ctx, go(where), busy()→bool (a dialog or play session is up)}
 constructor(io){this.io=io;this.seen=readSeen();this.shownAt=0;this.current=null;
  $('discoveryGo').onclick=()=>{const d=this.current;this.close();if(d?.go)this.io.go(d.go);};$('discoveryLater').onclick=()=>this.close();
  $('discoveryList').onclick=e=>{const b=e.target.closest('[data-discovery]');if(!b)return;const d=DISCOVERIES.find(x=>x.id===b.dataset.discovery);if(d)this.show(d,true);};}
 // One card at a time, never over another dialog or mid-game, and a few minutes apart so a
 // returning player isn't buried under everything they've earned.
 check(now=Date.now()){if(this.io.busy()||$('discoveryDialog').open||now-this.shownAt<4*60000)return null;const d=nextDiscovery(this.io.ctx(),this.seen);if(!d)return null;this.show(d);return d;}
 show(d,replay=false){this.current=d;$('discoveryIcon').textContent=d.icon;$('discoveryTitle').textContent=d.title;$('discoveryText').textContent=d.text;$('discoveryGo').textContent=d.cta;$('discoveryGo').hidden=!d.go&&!replay;$('discoveryEyebrow').textContent=replay?'DISCOVERED':'NEW FOR YOU';
  if(!replay){this.shownAt=Date.now();this.mark(d.id);}$('discoveryDialog').showModal?.();}
 close(){if($('discoveryDialog').open)$('discoveryDialog').close();}
 mark(id){if(this.seen.includes(id))return;this.seen=[...this.seen,id];try{localStorage.setItem(SEEN_KEY,JSON.stringify(this.seen));}catch{}this.renderList();}
 renderList(){const box=$('discoveryList');if(!box)return;const ctx=this.io.ctx();box.replaceChildren(...DISCOVERIES.filter(d=>d.id!=='owner'||ctx.owner).map(d=>{const seen=this.seen.includes(d.id),b=document.createElement('button');b.type='button';b.dataset.discovery=d.id;b.className='discovery-row'+(seen?' seen':'');b.disabled=!seen;const i=document.createElement('span');i.textContent=d.icon;const t=document.createElement('strong');t.textContent=seen?d.title:'???';const s=document.createElement('small');s.textContent=seen?'Tap to read again':'Keep playing to discover';b.append(i,t,s);return b;}));
  const n=$('discoveryCount');if(n)n.textContent=this.seen.filter(id=>DISCOVERIES.some(d=>d.id===id)).length+' / '+DISCOVERIES.filter(d=>d.id!=='owner'||ctx.owner).length;}
}
