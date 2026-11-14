// App shell: the four views (Play, Rankings, Friends, Me), the Play screen (featured carousel,
// jump-back-in panel, today rail, the New shelf and the game library with filters) and the Me
// page. It only renders; app.js owns game state and rankings.js owns the social data.
import {gameById,GAMES} from './games.js';
import {shortRule} from './unlocks.js';

const $=id=>document.getElementById(id);
// Elements the home screen adds are optional: an older index.html (or a test DOM) may lack them.
const opt=id=>{try{return document.getElementById(id)||null;}catch{return null;}};
export const VIEWS=['play','rankings','friends','chat','me'];
const POSTER={classic:'maze',rush:'maze',daily:'maze'};
export const posterOf=id=>`assets/posters/${POSTER[id]||id}.jpg`;
// One paragraph of copy per game for the game sheet and the jump-back-in panel.
export const BLURBS={
 classic:'A hungry DAWG, a maze full of loot and four rivals who really don’t want you to win. See the whole block from above, or drop into the corridors in first person.',
 rush:'Sixty seconds. Every coin counts, every hit costs. Chase the score, not the exit.',
 daily:'One seeded maze for everyone, every day. Same twist, same rivals: who runs it best?',
 trade:'Drive a living coastal city, deal from your phone and lose the cruisers. Thirty nights to build an empire.',
 flappy:'Jetpack through the sky-gaps of a skyline, from golden hour to fireworks. Burn, dive, ride the thermals.',
 cross:'Hop the traffic, ride the logs, grab the gold. How far can one DAWG get?',
 snake:'Ride the light trail through a neon arena. Grow your pack and don’t bite your tail.',
 runner:'Three lanes, one night, no brakes. Jump, slide and stack gold through the city.',
 turbo:'A 3D speed run through the sky: loops, corkscrews, rails and the high road. Beat the clock.',
 pinball:'One deep table, Dawg City Nights: real flipper physics, two ramps, two orbits, five timed modes, multiball jackpots and a wizard mode. Climb the ladder from Stray to Top Dawg.',
 kart:'Three laps, five rivals, three circuits with jumps, tunnels and shortcuts. Drift, draft and win the cups.',
 nemesis:'A machine that studies how you move, then shoots where you’re about to be. Break your own habits or get PREDICTED. It remembers you.',
 bark:'Twenty DAWGs on a shrinking rooftop and one move: a charged bark that sends whoever is in front of you flying. Last one on the roof wins.',
 paint:'Three minutes, one night-market city, and every crew wants it in their colour. Loop out and back to flood whole blocks, buildings and landmarks with your paint, cut open trails, dash, drop paint bombs, and own the most of the town when the whistle goes.',
 domino:'Fifteen pegboard contraptions in three shops. Peg a few pieces in among the dominoes, ramps, springs, gloves and see-saws, press GO, and get the golden bone into the bin. Free test runs, three stars a room, a code for every solution.',
 heist:'Plan a heist 30 seconds at a time. Every loop adds one more of you, replaying your last loops exactly. Your past selves are your crew.',
 climb:'A 500-meter glass tower, one grappling leash and no checkpoints. Every fall is measured. Every meter is earned twice.',
 chess:'Five rival DAWGs, one crown. Every capture is a little film: the knight somersaults in, the rook runs out a cannon, the queen strikes from three sides, and each piece falls its own way. A new mate puzzle every day.',
 story:'One velvet suit, one night, ten places to make bad decisions. Win over Nova, steal the rooftop show, and find all six endings before sunrise.'
};
// One line that sells the game: featured slides, shelf cards and the top of the game sheet.
export const HOOKS={
 classic:'Eat the block. Turn the tables. Own the night.',rush:'Sixty seconds. Every coin counts.',daily:'One maze for everyone. A new twist every day.',
 trade:'Drive the city. Deal from your phone. Lose the cruisers.',flappy:'Jetpack the skyline from golden hour to fireworks.',cross:'Hop the traffic. Ride the decks. Outrun the blackout.',
 snake:'Ride the light. Grow the pack. Don’t bite your tail.',runner:'Three lanes, one night, no brakes.',turbo:'Loops, rails and the high road at full burn.',
 pinball:'Real flippers, five modes, one wizard jackpot.',kart:'Drift, draft and steal the cup on the last corner.',nemesis:'It studies how you move. Then it cheats.',
 bark:'Twenty DAWGs. One shrinking roof. Bark them off it.',paint:'Flood the city in your colour before the whistle.',domino:'Peg it. Press GO. Watch it all fall into place.',
 heist:'Your past selves are your crew.',climb:'One leash. 500 meters. No checkpoints.',chess:'36 duels. Every capture is its own fight scene.',story:'One velvet suit. One night. Six endings.'
};
// Genres for the library filter; the first one is the label printed on the card.
export const GENRES={classic:['action'],rush:['action'],daily:['action'],trade:['strategy','story'],flappy:['action'],cross:['action'],snake:['action'],runner:['action','racing'],turbo:['racing','action'],
 pinball:['action'],kart:['racing','party'],story:['story'],chess:['strategy'],climb:['action'],heist:['puzzle','strategy'],domino:['puzzle'],paint:['party','action'],bark:['party','action'],nemesis:['action'],fight:['action','party']};
export const genresOf=id=>GENRES[id]||['action'];
// Card and slide badges. FLAGSHIP games lead the featured carousel, in this order.
export const BADGES={fight:'FLAGSHIP',nemesis:'FLAGSHIP',bark:'NEW',paint:'NEW',domino:'NEW',heist:'NEW',climb:'NEW',kart:'HOT',pinball:'HOT',chess:'HOT'};
const FLAGSHIPS=['fight','nemesis'],SPOTLIGHT=['bark','kart','heist','climb','paint','pinball','turbo','domino','chess'];
const NO_DEMO=['story','trade','chess'];
const ICONS={
 daily:'<path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm7 7.2 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"/>',
 streak:'<path d="M12 3c.6 3.2 4.8 5 4.8 9.6A4.8 4.8 0 0 1 12 17.5a4.8 4.8 0 0 1-4.8-4.9c0-1.7.8-3 1.8-4 .2 1.4.9 2.2 1.7 2.6C10.4 8.400 11 5.300 12 3zM8 21h8"/>',
 unlock:'<path d="M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zm2 0V7.500a4 4 0 0 1 7.800-1.200M12 15v2.500"/>',
 challenges:'<path d="M5 4l9.500 9.500M14 4h5v5L9.500 18.500M4 20l3-3M17 14l3 3-3 3-3-3M7 14l3 3"/>'
};
const icon=(name,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||''}</svg>`;
export const fmt=n=>Math.max(0,Math.floor(Number(n)||0)).toLocaleString('en-US');
export function timeAgo(when,now=Date.now()){const s=Math.max(0,(now-new Date(when).getTime())/1000);return s<60?'just now':s<3600?Math.floor(s/60)+' min ago':s<86400?Math.floor(s/3600)+' h ago':Math.floor(s/86400)+' d ago';}
// Rank movement between two places (lower is better): '▲ 3', '▼ 1' or ''.
export function movement(place,prev){if(!place||!prev||place===prev)return {text:'',dir:''};return place<prev?{text:'▲ '+(prev-place),dir:'up'}:{text:'▼ '+(place-prev),dir:'down'};}
// The closest route to unlocking a game, as a 0–100 progress figure for the card ring.
export function unlockProgress(wall){if(!wall||wall.open)return 100;return Math.round(Math.max(0,...(wall.routes||[]).map(r=>Math.min(1,r.have/Math.max(1,r.need))))*100);}
// The featured line-up: every flagship that exists, then spotlights that rotate daily, three in all.
export function featuredIds(have,day=Math.floor(Date.now()/864e5),count=3){const flag=FLAGSHIPS.filter(have),pool=SPOTLIGHT.filter(have),out=[...flag];
 for(let i=0;out.length<count&&i<pool.length;i++){const id=pool[(day+i)%pool.length];if(!out.includes(id))out.push(id);}return out;}
// Library filter: a genre chip and a search box, both optional.
export function matchesFilter(game,genre,query){const q=String(query||'').trim().toLowerCase();if(genre&&genre!=='all'&&!genresOf(game.id).includes(genre))return false;
 return !q||[game.title,game.tag,HOOKS[game.id],...genresOf(game.id)].some(t=>String(t||'').toLowerCase().includes(q));}
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const reduced=()=>{try{return matchMedia('(prefers-reduced-motion:reduce)').matches;}catch{return false;}};
const RECENT_KEY='dawg-recent';
const readRecent=()=>{try{const a=JSON.parse(localStorage.getItem(RECENT_KEY)||'[]');return Array.isArray(a)?a.filter(id=>typeof id==='string'&&gameById(id)).slice(0,6):[];}catch{return [];}};

// The featured carousel at the top of Play: poster art, a hook, PLAY, and a live attract demo
// of the game playing itself when the device can afford one.
class Featured {
 constructor(host,shell){this.host=host;this.shell=shell;this.at=0;this.timer=0;this.demo=null;this.idle=false;this.ids=[];
  host.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const id=b.closest('[data-game]')?.dataset.game;
   if(b.dataset.featGo!==undefined)this.go(Number(b.dataset.featGo),true);else if(b.dataset.featStep)this.go(this.at+Number(b.dataset.featStep),true);
   else if(b.dataset.feat==='play'&&id)this.shell.play(id);else if(b.dataset.feat==='info'&&id)this.shell.open(id);});
  host.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){this.go(this.at+1,true);}else if(e.key==='ArrowLeft'){this.go(this.at-1,true);}});
  let x0=null;host.addEventListener('pointerdown',e=>{x0=e.pointerType==='mouse'?null:e.clientX;});host.addEventListener('pointerup',e=>{if(x0===null)return;const dx=e.clientX-x0;x0=null;if(Math.abs(dx)>48)this.go(this.at+(dx<0?1:-1),true);});
  host.addEventListener('pointerenter',()=>{this.hover=true;});host.addEventListener('pointerleave',()=>{this.hover=false;});
  this.watch=setInterval(()=>this.tick(),700);}
 build(ids){this.ids=ids;this.stopDemo();const slides=ids.map((id,i)=>{const g=gameById(id),a=el('article','feat-slide');a.dataset.game=id;a.setAttribute('aria-roledescription','slide');a.setAttribute('aria-label',`${i+1} of ${ids.length}: ${g.title}`);a.style.setProperty('--poster',`url(${posterOf(id)})`);
   const badge=BADGES[id];a.innerHTML=`<div class="feat-bg"></div><div class="feat-art"><div class="feat-demo"></div></div><div class="feat-shade"></div>
<div class="feat-copy"><div class="feat-tags">${badge?`<span class="badge" data-badge="${badge}">${badge}</span>`:''}<span class="feat-genre">${genresOf(id).join(' · ').toUpperCase()}</span><span class="feat-live" aria-hidden="true">LIVE DEMO</span></div>
<h2></h2><p></p><div class="feat-actions"><button type="button" class="btn primary big" data-feat="play"></button><button type="button" class="btn glass big" data-feat="info">DETAILS</button></div></div>`;
   a.querySelector('h2').textContent=g.title;a.querySelector('p').textContent=HOOKS[id]||document.querySelector(`#tab-${id} .card-body small`)?.textContent||'';return a;});
  const nav=el('div','feat-nav');nav.setAttribute('role','group');nav.setAttribute('aria-label','Featured games');
  nav.append(...ids.map((id,i)=>{const b=el('button','feat-dot');b.type='button';b.dataset.featGo=i;b.style.setProperty('--poster',`url(${posterOf(id)})`);b.setAttribute('aria-label','Show '+gameById(id).title);b.append(el('span','feat-thumb'),el('strong','',gameById(id).title),el('i'));return b;}));
  const prev=el('button','feat-arrow prev','‹'),next=el('button','feat-arrow next','›');prev.type=next.type='button';prev.dataset.featStep=-1;next.dataset.featStep=1;prev.setAttribute('aria-label','Previous featured game');next.setAttribute('aria-label','Next featured game');
  this.host.replaceChildren(...slides,prev,next,nav);this.slides=slides;this.dots=[...nav.children];this.host.classList.toggle('single',ids.length<2);this.sync();this.go(Math.min(this.at,ids.length-1));}
 // Locked flagships stay on show; their button explains the way in.
 sync(){for(const s of this.slides||[]){const locked=!!$('tab-'+s.dataset.game)?.classList.contains('locked');s.classList.toggle('locked',locked);s.querySelector('[data-feat=play]').textContent=locked?'HOW TO UNLOCK':'PLAY NOW';}}
 go(i,user=false){const n=this.ids.length;if(!n)return;this.at=((i%n)+n)%n;this.stopDemo();
  this.slides.forEach((s,k)=>{const on=k===this.at;s.classList.toggle('on',on);s.setAttribute('aria-hidden',String(!on));s.inert=!on;});
  this.dots.forEach((d,k)=>{d.classList.remove('on');if(k===this.at){void d.offsetWidth;d.classList.add('on');d.setAttribute('aria-current','true');}else d.removeAttribute('aria-current');});
  this.arm(user?14000:9000);}
 arm(ms){clearTimeout(this.timer);clearTimeout(this.demoTimer);this.host.style.setProperty('--feat-ms',ms+'ms');
  if(!reduced()&&this.ids.length>1)this.timer=setTimeout(()=>{if(this.hover||this.host.contains(document.activeElement))this.arm(4000);else this.go(this.at+1);},ms);
  if(this.canDemo())this.demoTimer=setTimeout(()=>this.startDemo(),1100);}
 canDemo(){const id=this.ids[this.at],n=navigator;return !!this.shell.demo&&!this.idle&&!this.flat?.has(id)&&!NO_DEMO.includes(id)&&!this.slides[this.at]?.classList.contains('locked')&&innerWidth>=900&&!reduced()&&!n.connection?.saveData&&(n.deviceMemory||8)>=4&&(n.hardwareConcurrency||8)>=4;}
 // The demo fades in over the poster only once its 3D scene has mounted; a flat 2D fallback never replaces the art.
 startDemo(){this.stopDemo();if(!this.canDemo())return;const s=this.slides[this.at];try{this.demo=this.shell.demo(s.querySelector('.feat-demo'),this.ids[this.at]);this.demoAt=Date.now();}catch{this.demo=null;}}
 reveal(){if(!this.demo)return;const s=this.slides[this.at];if(s.classList.contains('live'))return;if(s.querySelector('.feat-demo>div'))s.classList.add('live');else if(Date.now()-this.demoAt>9000){(this.flat||=new Set()).add(this.ids[this.at]);this.stopDemo();}}
 stopDemo(){clearTimeout(this.demoTimer);try{this.demo?.dispose();}catch{}this.demo=null;for(const s of this.slides||[]){s.classList.remove('live');s.querySelector('.feat-demo').replaceChildren();}}
 // Rest while the carousel can't be seen: another view, a dialog, a game session or off screen.
 tick(){const r=this.host.getBoundingClientRect(),idle=document.hidden||this.shell.view!=='play'||!!document.querySelector('dialog[open]')||/\b(pack|mobile)-session\b|story-focus/.test(document.body.className)||r.bottom<80||r.top>innerHeight;
  this.reveal();if(idle===this.idle)return;this.idle=idle;this.host.classList.toggle('paused',idle);if(idle){clearTimeout(this.timer);this.stopDemo();}else this.go(this.at);}
}

export class Shell {
 constructor({onView}={}){this.onView=onView;this.view='play';this.preview=null;this.sheet=null;this.demo=null;this.genre='all';this.query='';
  document.querySelector('.app-nav')?.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)this.show(b.dataset.view);});
  for(const b of document.querySelectorAll('.game-card'))if(BADGES[b.dataset.mode])b.dataset.hot=BADGES[b.dataset.mode];
  window.addEventListener('popstate',()=>{const v=(location.hash||'').slice(1);if(VIEWS.includes(v)&&v!==this.view)this.show(v,{push:false});});
  // Everything below needs a real browser; tests drive the shell through a minimal DOM.
  if(typeof document.body?.getBoundingClientRect==='function'){try{this.home();}catch(error){console.error(error);}}
 }
 // Open a game's sheet, or play it straight away (locked games open their sheet instead).
 open(id){if(this.sheet)this.sheet.open(id);else $('tab-'+id)?.click();}
 play(id){const locked=$('tab-'+id)?.classList.contains('locked');if(locked||!this.sheet)this.open(id);else this.sheet.io.play(id);}
 // The Play screen's own furniture: card details, lazy posters, tilt, filters, shelf, carousel.
 home(){const cards=[...document.querySelectorAll('.game-grid .game-card')],grid=document.querySelector('.game-grid');this.cardEls=cards;
  cards.forEach((b,i)=>{const id=b.dataset.mode,body=b.querySelector('.card-body');b.dataset.genres=genresOf(id).join(' ');b.style.setProperty('--i',i);if(body)body.dataset.genre=genresOf(id)[0].toUpperCase();const t=b.querySelector('.card-body strong');if(t)t.title=t.textContent;});
  // Posters load as their cards come near the screen.
  if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){e.target.classList.add('seen');io.unobserve(e.target);}},{rootMargin:'400px 0px'});cards.forEach(b=>io.observe(b));}else cards.forEach(b=>b.classList.add('seen'));
  // A tap on a card opens its sheet; the page behind stays where it was.
  grid?.addEventListener('click',()=>{this.quiet=true;setTimeout(()=>{this.quiet=false;},0);},true);
  // Poster tilt under a mouse.
  if(grid&&matchMedia('(hover:hover) and (pointer:fine)').matches&&!reduced()){let live=null;grid.addEventListener('pointermove',e=>{const b=e.target.closest('.game-card');if(live&&live!==b){live.classList.remove('tilt');live=null;}if(!b)return;const r=b.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;live=b;b.classList.add('tilt');b.style.setProperty('--rx',(-y*7).toFixed(2)+'deg');b.style.setProperty('--ry',(x*9).toFixed(2)+'deg');b.style.setProperty('--gx',((x+.5)*100).toFixed(0)+'%');b.style.setProperty('--gy',((y+.5)*100).toFixed(0)+'%');});
   grid.addEventListener('pointerleave',()=>{live?.classList.remove('tilt');live=null;});}
  // Library filters.
  const chips=opt('libChips'),search=opt('libSearch');
  chips?.addEventListener('click',e=>{const b=e.target.closest('[data-genre]');if(!b)return;this.genre=b.dataset.genre;this.filter();});
  search?.addEventListener('input',()=>{this.query=search.value;this.filter();});
  opt('libClear')?.addEventListener('click',()=>{this.genre='all';this.query='';if(search)search.value='';this.filter();});
  for(const b of chips?.querySelectorAll('[data-genre]')||[]){const k=b.dataset.genre,n=k==='all'?cards.length:cards.filter(c=>genresOf(c.dataset.mode).includes(k)).length;b.hidden=!n;b.append(el('small','',String(n)));}
  // Shelves and recents open sheets.
  for(const host of [opt('shelfNew'),opt('heroRecent')])host?.addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b)this.open(b.dataset.open);});
  this.shelf();
  const feat=opt('featured');if(feat){this.featured=new Featured(feat,this);this.featured.build(featuredIds(id=>!!gameById(id)&&!!$('tab-'+id)));}
 }
 filter(){let shown=0;for(const b of this.cardEls||[]){const id=b.dataset.mode,ok=matchesFilter({id,title:gameById(id)?.title||'',tag:b.querySelector('.card-body small')?.dataset.tag||b.querySelector('.card-body small')?.textContent},this.genre,this.query);b.hidden=!ok;if(ok){shown++;b.classList.add('seen');}}
  for(const c of opt('libChips')?.querySelectorAll('[data-genre]')||[])c.setAttribute('aria-pressed',String(c.dataset.genre===this.genre));const empty=opt('libEmpty');if(empty)empty.hidden=shown>0;}
 // The New shelf: wide cards for the latest games.
 shelf(){const host=opt('shelfNew');if(!host)return;const ids=GAMES.map(g=>g.id).filter(id=>BADGES[id]==='NEW'&&$('tab-'+id));host.hidden=!ids.length;if(!ids.length)return;
  const head=el('div','section-head');head.append(el('h2','section-title','New this season'),el('span','section-meta',ids.length+' GAMES'));const row=el('div','shelf-row');
  row.append(...ids.map(id=>{const b=el('button','shelf-card');b.type='button';b.dataset.open=id;b.style.setProperty('--poster',`url(${posterOf(id)})`);const body=el('span','shelf-body'),badge=el('em','badge','NEW');badge.dataset.badge='NEW';body.append(badge,el('strong','',gameById(id).title),el('small','',HOOKS[id]||''));b.append(el('span','shelf-art'),body);return b;}));
  host.replaceChildren(head,row);}
 initial(){const v=(globalThis.location?.hash||'').slice(1);if(VIEWS.includes(v)&&v!=='play')this.show(v,{push:false});}
 show(view,{push=true,scroll=true}={}){if(!VIEWS.includes(view))return;const changed=view!==this.view;this.view=view;
  for(const v of VIEWS){const el=$('view'+v[0].toUpperCase()+v.slice(1));if(el)el.hidden=v!==view;}
  for(const b of document.querySelectorAll('.app-nav [data-view]')){if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
  if(push&&changed&&globalThis.history){try{history.pushState(null,'',view==='play'?location.pathname+location.search:'#'+view);}catch{}}
  if(scroll&&changed)window.scrollTo({top:0,behavior:'auto'});this.title();this.onView?.(view);}
 // Tab title follows the view, and the selected game on Play.
 title(){const names={rankings:'Rankings',friends:'Friends',chat:'Chat',me:'Me'};document.title=(this.view==='play'?this.gameTitle||'Play':names[this.view])+' · DAWG Arcade';}
 // The jump-back-in panel for the selected game, or a preview of a locked one with its unlock routes.
 hero(id,{best=0,wall=null,bestLabel=null}={}){const g=gameById(id);if(!g)return;const locked=wall&&!wall.open;this.preview=locked?id:null;
  $('heroArt').style.setProperty('--hero-poster',`url(${posterOf(id)})`);$('heroTitle').textContent=g.title;this.gameTitle=g.title;this.title();
  $('heroTag').textContent=document.querySelector(`#tab-${id} .card-body small`)?.textContent||'';$('heroDesc').textContent=BLURBS[id]||'';
  $('heroBest').textContent=bestLabel??fmt(best);$('heroLock').hidden=!locked;
  const play=$('heroPlay');play.disabled=!!locked;$('heroPlayLabel').textContent=locked?'LOCKED':id==='trade'||id==='story'||id==='chess'?'CONTINUE':'PLAY NOW';
  const label=opt('heroLabel');if(label)label.textContent=locked?'LOCKED':best>0||bestLabel&&bestLabel!=='—'?'JUMP BACK IN':'UP NEXT';
  $('playHero').classList?.toggle('locked',!!locked);
  if(locked){$('heroLockTitle').textContent='Unlock '+g.title+' — any one of these opens it:';$('heroRoutes').replaceChildren(...wall.routes.map(r=>{const row=document.createElement('div');row.className='hero-route'+(r.done?' done':'');const head=document.createElement('header'),label=document.createElement('span'),left=document.createElement('small'),bar=document.createElement('div'),fill=document.createElement('i');label.textContent=r.label;left.textContent=r.done?'DONE':r.left;bar.className='meter';fill.style.setProperty('--p',Math.min(100,Math.round(r.have/Math.max(1,r.need)*100))+'%');bar.append(fill);head.append(label,left);row.append(head,bar);return row;}));}
  else this.recent(id);
  for(const b of document.querySelectorAll('.game-card'))b.classList.toggle('previewing',b.dataset.mode===id&&locked);}
 // Remembers the games picked lately (this device only) and offers them next to the selected one.
 recent(id){const list=[id,...readRecent().filter(x=>x!==id)].slice(0,6);try{localStorage.setItem(RECENT_KEY,JSON.stringify(list));}catch{}
  const host=opt('heroRecent');if(!host)return;const rest=list.filter(x=>x!==id).slice(0,4);host.hidden=!rest.length;
  host.replaceChildren(el('small','','RECENT'),...rest.map(x=>{const b=el('button','recent-tile');b.type='button';b.dataset.open=x;b.style.setProperty('--poster',`url(${posterOf(x)})`);b.append(el('i'),el('span','',gameById(x).title));return b;}));}
 // Pass 'loading' while the weekly rank and top friend are being fetched.
 heroSocial(s){const loading=s==='loading',{rank='—',rankDir='',friend='—'}=loading?{}:s||{},r=$('heroRank'),f=$('heroFriend');r.textContent=loading?'':rank;r.className=loading?'loading':rankDir;f.textContent=loading?'':friend;f.className=loading?'loading':'';}
 // Lock rings and states on every game card.
 cards(walls){let open=0;for(const b of document.querySelectorAll('.game-card')){const w=walls(b.dataset.mode),small=b.querySelector('.card-body small'),pct=unlockProgress(w),title=gameById(b.dataset.mode)?.title||'';b.classList.toggle('locked',!w.open);if(w.open)open++;b.style.setProperty('--unlock',pct);b.title=w.open?'':'Locked: '+(w.routes?.[0]?.label||'keep playing to open');
   b.setAttribute('aria-label',w.open?title:`${title}, locked, ${pct}% of the way. ${(w.routes||[]).map(r=>r.label).join(', or ')}`);
   // Locked cards say what opens them instead of their tagline.
   if(small){small.dataset.tag??=small.textContent;small.textContent=w.open?small.dataset.tag:shortRule(b.dataset.mode);}}
  $('gamesMeta').textContent=open+' / '+GAMES.length+' UNLOCKED';this.featured?.sync();}
 // Today rail: short cards for the daily run, streak, next unlock and anything waiting.
 // items: [{id, icon, title, sub, pct?, tone?}]; onTap(id) handles the action.
 today(items,onTap){const rail=$('todayRail');if(!rail)return;rail.replaceChildren(...items.map(it=>{const b=document.createElement('button');b.type='button';b.className='today-card'+(it.tone?' '+it.tone:'');b.dataset.today=it.id;const i=document.createElement('span');i.className='today-icon';const kind=String(it.id).split(':')[0];if(ICONS[kind])i.innerHTML=icon(kind);else i.textContent=it.icon;const t=document.createElement('span');t.className='today-text';const s=document.createElement('strong');s.textContent=it.title;const m=document.createElement('small');m.textContent=it.sub;t.append(s,m);if(it.pct!==undefined){const bar=document.createElement('span');bar.className='meter';const f=document.createElement('i');f.style.setProperty('--p',Math.round(it.pct)+'%');bar.append(f);t.append(bar);}b.append(i,t);b.onclick=()=>onTap?.(it.id);return b;}));rail.hidden=!items.length;}
 // Me page: stats, bests and the level bar. Profile name and code come from rankings.js.
 me({level,xp,next,prev,minutes,streak,runs,records,stamps,rank}){
  $('meXpFill').style.setProperty('--p',Math.min(100,Math.round((xp-prev)/Math.max(1,next-prev)*100))+'%');$('meXpText').textContent=fmt(xp)+' / '+fmt(next)+' XP TO LEVEL '+(level+1);
  const tiles=[['LEVEL',level],['DAY STREAK',streak,streak>=3],['MINUTES PLAYED',fmt(minutes)],['RUNS',fmt(runs)],['STAMPS',stamps],['ARCADE RANK',rank||'—']];
  $('meStats').replaceChildren(...tiles.map(([k,v,hot])=>{const d=document.createElement('div');d.className='stat-tile'+(hot?' hot':'');const b=document.createElement('b'),s=document.createElement('small');b.textContent=String(v);s.textContent=k;d.append(b,s);return d;}));
  $('meBests').replaceChildren(...GAMES.map(g=>{const li=document.createElement('li'),img=document.createElement('img'),span=document.createElement('span'),small=document.createElement('small'),b=document.createElement('b');const v=records[g.id];li.dataset.game=g.id;li.className=v>0?'':'none';img.src=posterOf(g.id);img.alt='';img.loading='lazy';span.textContent=g.title;small.textContent=g.id==='trade'?'NET WORTH':'BEST SCORE';span.append(small);b.textContent=v>0?(g.id==='trade'?'$'+fmt(v):fmt(v)):'—';li.append(img,span,b);return li;}));}
}
