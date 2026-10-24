// Rankings and friends: global and friends leaderboards, global stats, a public player card
// with the player's DAWG as avatar, friend codes and "beat my score" challenge links.
// Everything here reads through server functions in supabase/migrations/*_social.sql; other
// players' data is untrusted, so it is rendered as text and validated DAWGs only.
import {GAMES,gameById} from './games.js';
import {validDawg} from './dawg-career.js';
import {drawDawg} from './dawg-art.js';

const $=id=>document.getElementById(id);
export const NAME_RULE=/^[A-Za-z0-9][A-Za-z0-9 _.-]{1,14}[A-Za-z0-9]$/;
export const RANKED_GAMES=GAMES.map(g=>g.id);
// Challenge links: ?challenge=<game>&score=<n>&from=<FRIENDCODE>
export function challengeLink(base,game,score,code){const u=new URL(base);u.search='';u.hash='';u.searchParams.set('challenge',game);u.searchParams.set('score',String(Math.max(0,Math.floor(score)||0)));u.searchParams.set('from',code);return u.toString();}
export function readChallenge(search){const p=new URLSearchParams(search);const game=p.get('challenge'),score=Number(p.get('score')),from=(p.get('from')||'').toUpperCase();
 return gameById(game)&&Number.isSafeInteger(score)&&score>=0&&/^[A-F0-9]{8}$/.test(from)?{game,score,from}:null;}
const fmt=n=>Number(n||0).toLocaleString('en-US');

export class Rankings {
 constructor({cloud,kennel,records,confirm,openDialog,announce,play}){Object.assign(this,{cloud,kennel,records,confirm,openDialog,announce,play});this.game='runner';this.period='week';this.scope='global';this.profile=null;this.wire();}
 get api(){return this.cloud.client&&this.cloud.user?this.cloud.client:null;}
 async rpc(name,args){const api=this.api;if(!api)throw new Error('Rankings need the cloud connection. Your progress is still saved on this device.');const {data,error}=await api.rpc(name,args);if(error)throw new Error(/name taken/.test(error.message)?'That name is taken. Try another.':/not allowed/.test(error.message)?'That name isn’t allowed. Use 3–16 letters, numbers, spaces, _ . or -.':/no player/.test(error.message)?'No player has that code.':/own code/.test(error.message)?'That’s your own friend code.':/Could not find the function|does not exist/i.test(error.message)?'Rankings are still being set up. Check back soon.':error.message);return data;}
 note(text){$('rankNote').textContent=text||'';}
 wire(){
  const games=$('rankGames');for(const g of GAMES){const b=document.createElement('button');b.type='button';b.dataset.game=g.id;b.textContent=g.title;games.append(b);}
  games.addEventListener('click',e=>{const id=e.target.closest('[data-game]')?.dataset.game;if(id){this.game=id;this.load();}});
  $('rankPeriods').addEventListener('click',e=>{const p=e.target.closest('[data-period]')?.dataset.period;if(p){this.period=p;this.load();}});
  $('rankScopes').addEventListener('click',e=>{const s=e.target.closest('[data-scope]')?.dataset.scope;if(s){this.scope=s;this.load();}});
  $('rankNameForm').addEventListener('submit',e=>{e.preventDefault();this.saveProfile();});
  $('rankPublic').addEventListener('change',()=>this.saveProfile());
  $('rankCopy').onclick=()=>this.copy(this.profile?.code,'Friend code copied.');
  $('rankShare').onclick=()=>this.share();
  $('friendForm').addEventListener('submit',e=>{e.preventDefault();this.follow($('friendCode').value.trim());});
  $('friendList').addEventListener('click',e=>{const code=e.target.closest('[data-unfollow]')?.dataset.unfollow;if(code)this.unfollow(code);});
 }
 // Called once the cloud is online: makes sure the player has a card with their current DAWG.
 async sync(){if(!this.api)return;try{this.profile=await this.rpc('ensure_profile');const d=this.kennel.active;if(d&&this.profile&&this.profile.avatar?.id!==d.id)this.profile=await this.rpc('set_profile',{p_name:this.profile.name,p_avatar:d,p_public:this.profile.public});}catch{}}
 async open(game){if(game&&gameById(game))this.game=game;this.openDialog('rankingsDialog');this.renderMe();await this.sync();this.renderMe();this.load();this.loadStats();this.loadFriends();}
 renderMe(){
  const p=this.profile,d=this.kennel.active;this.avatar($('rankAvatar'),d,96);$('playerName').value=p?.name||'';$('playerName').placeholder=d?.name?d.name+' (pick a player name)':'Pick a player name';$('rankCode').textContent=p?.code||'—';$('rankPublic').checked=p?.public!==false;
  for(const b of document.querySelectorAll('#rankGames [data-game]'))b.setAttribute('aria-pressed',String(b.dataset.game===this.game));
  for(const b of document.querySelectorAll('#rankPeriods [data-period]'))b.setAttribute('aria-pressed',String(b.dataset.period===this.period));
  for(const b of document.querySelectorAll('#rankScopes [data-scope]'))b.setAttribute('aria-pressed',String(b.dataset.scope===this.scope));
  if(!this.api)this.note('Rankings need the cloud connection. Your progress is still saved on this device.');
 }
 avatar(canvas,d,size){const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);if(d&&validDawg(d)){try{drawDawg(c,d,canvas.width/2,canvas.height*.92,canvas.height*.9,0,'idle');return;}catch{}}c.fillStyle='#b9ff5e33';c.beginPath();c.arc(canvas.width/2,canvas.height/2,canvas.width*.42,0,Math.PI*2);c.fill();c.fillStyle='#b9ff5e';c.font=`900 ${Math.round(size*.42)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText('?',canvas.width/2,canvas.height/2+2);}
 async loadStats(){try{const s=await this.rpc('global_stats');$('rankStats').replaceChildren(...[['PLAYERS',fmt(s.players)],['RUNS TODAY',fmt(s.runs_today)],['ALL RUNS',fmt(s.runs)],['HOURS PLAYED',fmt(s.hours)]].map(([k,v])=>{const el=document.createElement('div');const b=document.createElement('b');b.textContent=v;const small=document.createElement('small');small.textContent=k;el.append(b,small);return el;}));}catch{}}
 async load(){
  this.renderMe();const list=$('rankList'),standing=$('rankStanding');list.replaceChildren();standing.textContent='';const title=gameById(this.game)?.title||this.game;
  try{
   const [rows,me]=await Promise.all([this.rpc('leaderboard',{p_game:this.game,p_period:this.period,p_scope:this.scope,p_limit:50}),this.rpc('my_standing',{p_game:this.game,p_period:this.period})]);
   standing.textContent=me?.place?`You’re #${fmt(me.place)} of ${fmt(me.players)} in ${title} · best ${fmt(me.score)}`:me?.players?`${fmt(me.players)} players ranked in ${title}. Finish a run to join them.`:`No ranked runs in ${title} yet. Be the first.`;
   for(const r of rows||[]){const li=document.createElement('li');li.className='rank-row'+(r.is_me?' me':'');const place=document.createElement('span');place.className='rank-place';place.textContent='#'+r.place;
    const cv=document.createElement('canvas');cv.width=cv.height=40;this.avatar(cv,r.avatar,40);const name=document.createElement('span');name.className='rank-name';name.textContent=r.player+(r.is_me?' (you)':'');const score=document.createElement('b');score.textContent=fmt(r.score);li.append(place,cv,name,score);list.append(li);}
   this.note('');
  }catch(error){this.note(error.message);}
 }
 async loadFriends(){const ul=$('friendList');try{const rows=await this.rpc('my_friends');ul.replaceChildren(...(rows||[]).map(f=>{const li=document.createElement('li');const cv=document.createElement('canvas');cv.width=cv.height=32;this.avatar(cv,f.avatar,32);const name=document.createElement('span');name.textContent=`${f.player} · LV ${f.level}`;const b=document.createElement('button');b.type='button';b.dataset.unfollow=f.friend_code;b.textContent='REMOVE';li.append(cv,name,b);return li;}));if(!rows?.length){const li=document.createElement('li');li.className='muted';li.textContent='Add a friend’s code to race them on the Friends board.';ul.append(li);}}catch{}}
 async saveProfile(){const name=$('playerName').value.trim();if(name&&!NAME_RULE.test(name)){this.note('Use 3–16 letters, numbers, spaces, _ . or -.');return;}try{this.profile=await this.rpc('set_profile',{p_name:name||null,p_avatar:this.kennel.active||null,p_public:$('rankPublic').checked});await this.load();this.note(name?'Saved. You’re '+name+' on the boards.':'Saved.');}catch(error){this.note(error.message);}}
 async follow(code){if(!/^[A-Fa-f0-9]{8}$/.test(code)){this.note('Friend codes are 8 letters and numbers, like 3FA9C210.');return;}try{const p=await this.rpc('follow_code',{p_code:code});$('friendCode').value='';this.note('Added '+(p?.name||code)+'.');this.loadFriends();if(this.scope==='friends')this.load();return p;}catch(error){this.note(error.message);}}
 async unfollow(code){try{await this.rpc('unfollow_code',{p_code:code});this.loadFriends();if(this.scope==='friends')this.load();}catch(error){this.note(error.message);}}
 async copy(text,done){if(!text)return;try{await navigator.clipboard.writeText(text);this.note(done);}catch{this.note(text);}}
 async share(){const code=this.profile?.code;if(!code){this.note('Connect to the cloud to get a friend code.');return;}const best=this.records()[this.game]||0,title=gameById(this.game)?.title||this.game,url=challengeLink(location.href,this.game,best,code),text=`Beat my ${best.toLocaleString('en-US')} in ${title} on the DAWG Arcade 🐶`;
  if(navigator.share){try{await navigator.share({title:'DAWG Arcade challenge',text,url});return;}catch{}}this.copy(text+' '+url,'Challenge link copied. Send it to a friend.');}
 // A challenge link opened on this device: say who sent it, then offer to play and add them.
 async handleChallenge(){const ch=readChallenge(location.search);if(!ch)return;history.replaceState(null,'',location.pathname+location.hash);let from=null;try{from=await this.rpc('public_profile',{p_code:ch.from});}catch{}
  const who=from?.name||'A friend',title=gameById(ch.game)?.title||ch.game;this.confirm(`${who} challenged you!`,`Beat ${fmt(ch.score)} in ${title}. Accepting adds ${who} to your friends so you can race on the Friends board.`,'ACCEPT & PLAY ↗',async()=>{if(from&&!from.following&&from.code!==this.profile?.code)await this.follow(ch.from);this.play(ch.game);});}
}
