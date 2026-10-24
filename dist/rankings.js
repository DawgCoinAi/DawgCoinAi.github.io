// Social layer: the Rankings view (per-game and Arcade Level boards with a podium and your
// pinned row), the Friends view (challenges inbox, friend activity, friends and followers),
// player cards, challenge and profile links, and the social lines on game-over screens.
// Everything reads through server functions in supabase/migrations/*_social*.sql; other
// players' data is untrusted, so it is rendered as text and validated DAWGs only.
import {GAMES,gameById} from './games.js';
import {validDawg} from './dawg-career.js';
import {drawDawg} from './dawg-art.js';
import {profileLink,readPlayerLink,shareBase,drawScoreCard} from './share.js';
import {posterOf,timeAgo,movement} from './shell.js';

const $=id=>document.getElementById(id);
export const NAME_RULE=/^[A-Za-z0-9][A-Za-z0-9 _.-]{1,14}[A-Za-z0-9]$/;
export const RANKED_GAMES=GAMES.map(g=>g.id);
// Challenge links: ?challenge=<game>&score=<n>&from=<FRIENDCODE>
export function challengeLink(base,game,score,code){const u=new URL(base);u.search='';u.hash='';u.searchParams.set('challenge',game);u.searchParams.set('score',String(Math.max(0,Math.floor(score)||0)));u.searchParams.set('from',code);return u.toString();}
export function readChallenge(search){const p=new URLSearchParams(search);const game=p.get('challenge'),score=Number(p.get('score')),from=(p.get('from')||'').toUpperCase();
 return gameById(game)&&Number.isSafeInteger(score)&&score>=0&&/^[A-F0-9]{8}$/.test(from)?{game,score,from}:null;}
const fmt=n=>Number(n||0).toLocaleString('en-US');
const ordinal=n=>n+(['th','st','nd','rd'][(n%100-20)%10]||['th','st','nd','rd'][n%100]||'th');
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const button=(label,cls,on)=>{const b=el('button','btn small '+(cls||''),label);b.type='button';b.onclick=on;return b;};
const titleOf=id=>id==='level'?'Arcade Level':gameById(id)?.title||id;
const missing=e=>/still being set up/.test(e?.message||'');

export class Rankings {
 constructor({cloud,kennel,records,stats,confirm,openDialog,announce,play,share,shell,currentGame}){Object.assign(this,{cloud,kennel,records,stats,confirm,openDialog,announce,play,share,shell,currentGame});
  this.game='level';this.period='week';this.scope='global';this.tab='inbox';this.profile=null;this.friends=[];this.challenges=[];this.cache=new Map();this.wire();}
 get api(){return this.cloud.client&&this.cloud.user?this.cloud.client:null;}
 async rpc(name,args){const api=this.api;if(!api)throw new Error('Rankings need the cloud connection. Your progress is still saved on this device.');const {data,error}=await api.rpc(name,args);if(error)throw new Error(/name taken/.test(error.message)?'That name is taken. Try another.':/not allowed/.test(error.message)?'That name isn’t allowed. Use 3–16 letters, numbers, spaces, _ . or -.':/no player/.test(error.message)?'No player has that code.':/own code/.test(error.message)?'That’s your own friend code.':/finish a ranked run/.test(error.message)?'Finish a run in that game first so there’s a score to beat.':/too many challenges/.test(error.message)?'That’s a lot of challenges for one day. Try again tomorrow.':/Could not find the function|does not exist/i.test(error.message)?'This part of the social layer is still being set up. Check back soon.':error.message);return data;}
 // Short-lived cache so switching tabs and views doesn't refetch everything.
 async cached(key,ms,load){const hit=this.cache.get(key);if(hit&&Date.now()-hit.at<ms)return hit.value;const value=await load();this.cache.set(key,{at:Date.now(),value});return value;}
 forget(prefix){for(const k of [...this.cache.keys()])if(k.startsWith(prefix))this.cache.delete(k);}
 note(id,text){const n=$(id);if(n)n.textContent=text||'';}
 wire(){
  const chips=$('rankGames'),chip=(id,label,img)=>{const b=el('button','chip');b.type='button';b.setAttribute('role','tab');b.dataset.game=id;if(img){const i=el('img');i.src=img;i.alt='';i.loading='lazy';b.append(i);}else b.append(el('span','chip-icon','★'));b.append(label);return b;};
  chips.append(chip('level','Arcade Level',null),...GAMES.map(g=>chip(g.id,g.title,posterOf(g.id))));
  chips.addEventListener('click',e=>{const id=e.target.closest('[data-game]')?.dataset.game;if(id){this.game=id;this.loadBoard();}});
  $('rankPeriods').addEventListener('click',e=>{const p=e.target.closest('[data-period]')?.dataset.period;if(p){this.period=p;this.loadBoard();}});
  $('rankScopes').addEventListener('click',e=>{const s=e.target.closest('[data-scope]')?.dataset.scope;if(s){this.scope=s;this.loadBoard();}});
  $('rankNameForm').addEventListener('submit',e=>{e.preventDefault();this.saveProfile();});
  $('rankPublic').addEventListener('change',()=>this.saveProfile());
  $('rankCopy').onclick=()=>this.copy(this.profile?.code,'friendNote','Friend code copied.');
  $('friendInvite').onclick=$('rankProfile').onclick=()=>this.shareProfile();
  $('friendForm').addEventListener('submit',e=>{e.preventDefault();this.follow($('friendCode').value.trim()).then(p=>{if(p){$('friendCode').value='';this.loadFriendsTab();}});});
  $('friendTabs').addEventListener('click',e=>{const t=e.target.closest('[data-tab]')?.dataset.tab;if(t){this.tab=t;this.loadFriendsTab();}});
  $('profileFollow').onclick=()=>this.followShown();$('profileChallenge').onclick=()=>{const p=this.shown;if(p){$('profileDialog').close();this.pickGame(p);}};
  $('profilePlay').onclick=()=>{$('profileDialog').close();this.play(this.shown?.topGame||'runner');};
  $('heroBoard').onclick=()=>{const id=this.shell.preview||this.currentGame?.();if(id)this.game=id;this.shell.show('rankings');};
  $('heroChallenge').onclick=()=>this.pickFriend(this.currentGame?.());
  $('feedRow').addEventListener('click',e=>{const g=e.target.closest('[data-game]')?.dataset.game;if(g)this.play(g);});
 }
 // Called once the cloud is online: makes sure the player has a card with their current DAWG.
 async sync(){if(!this.api)return;try{this.profile=await this.rpc('ensure_profile');const d=this.kennel.active;if(d&&this.profile&&this.profile.avatar?.id!==d.id)this.profile=await this.rpc('set_profile',{p_name:this.profile.name,p_avatar:d,p_public:this.profile.public});}catch{}
  this.renderIdentity();this.refreshBadge();this.loadFeedStrip();clearInterval(this.poll);this.poll=setInterval(()=>{if(!document.hidden)this.refreshBadge();},120000);}
 openView(view){if(view==='rankings')this.loadBoard();else if(view==='friends')this.loadFriendsTab();else if(view==='me')this.renderIdentity();}
 avatar(canvas,d,size){const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);if(d&&validDawg(d)){try{drawDawg(c,d,canvas.width/2,canvas.height*.92,canvas.height*.9,0,'idle');return;}catch{}}c.fillStyle='#b48cff33';c.beginPath();c.arc(canvas.width/2,canvas.height/2,canvas.width*.42,0,Math.PI*2);c.fill();c.fillStyle='#b48cff';c.font=`900 ${Math.round(canvas.width*.42)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText('?',canvas.width/2,canvas.height/2+2);}
 face(d,size){const cv=el('canvas');cv.width=cv.height=size*2;cv.setAttribute('aria-hidden','true');this.avatar(cv,d,size);return cv;}
 renderIdentity(){const p=this.profile,d=this.kennel.active,s=this.stats();this.avatar($('rankAvatar'),d,240);this.avatar($('navAvatar'),d,56);
  $('meName').textContent=p?.name||d?.name||'Guest';$('meMeta').textContent='Level '+s.level+(p?.code?' · friend code '+p.code:'')+(p?.public===false?' · hidden from boards':'');
  $('playerName').value=p?.name||'';$('playerName').placeholder=d?.name?d.name+' (pick a player name)':'Pick a player name';$('rankCode').textContent=p?.code||'—';$('rankPublic').checked=p?.public!==false;}

 // ── Rankings ──────────────────────────────────────────────────────────────────────────────
 async loadBoard(){
  const level=this.game==='level';for(const b of document.querySelectorAll('#rankGames [data-game]'))b.setAttribute('aria-selected',String(b.dataset.game===this.game));
  $('rankGames').querySelector(`[data-game="${this.game}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});
  $('rankPeriods').hidden=level;for(const b of document.querySelectorAll('#rankPeriods [data-period]'))b.setAttribute('aria-pressed',String(b.dataset.period===this.period));
  for(const b of document.querySelectorAll('#rankScopes [data-scope]'))b.setAttribute('aria-pressed',String(b.dataset.scope===this.scope));
  const list=$('rankList'),podium=$('rankPodium'),me=$('rankMe');list.replaceChildren(...[0,1,2,3].map(()=>el('li','skeleton')));podium.replaceChildren();me.hidden=true;$('rankStanding').textContent='';this.note('rankNote','');this.loadStats();
  if(!this.api){list.replaceChildren(this.empty('Rankings are offline','Rankings need the cloud connection. Your progress is still saved on this device.'));return;}
  const ticket=this.ticket=Symbol();
  try{
   const key=[this.game,this.period,this.scope].join(':');
   const [rows,mine]=await this.cached('board:'+key,30000,()=>Promise.all([level?this.rpc('level_board',{p_scope:this.scope,p_limit:50}):this.rpc('leaderboard',{p_game:this.game,p_period:this.period,p_scope:this.scope,p_limit:50}),
    level?this.rpc('my_level_rank').catch(()=>null):this.rpc('my_rank',{p_game:this.game,p_period:this.period}).catch(()=>this.rpc('my_standing',{p_game:this.game,p_period:this.period}))]));
   if(ticket!==this.ticket)return;this.renderBoard(rows||[],mine,level);
  }catch(error){if(ticket!==this.ticket)return;if(level&&missing(error)){this.game=this.currentGame?.()||'runner';this.loadBoard();return;}list.replaceChildren(this.empty(missing(error)?'Coming soon':'Couldn’t load this board',error.message));}
 }
 renderBoard(rows,mine,level){
  const list=$('rankList'),podium=$('rankPodium'),pin=$('rankMe'),title=titleOf(this.game),value=r=>level?'LV '+r.level:fmt(r.score),sub=r=>level?fmt(r.xp)+' XP':r.achieved_at?timeAgo(r.achieved_at):'';
  const move=movement(mine?.place,mine?.prev_place),when=this.scope==='friends'?' among friends':level?'':this.period==='day'?' today':this.period==='week'?' this week':' all time';
  const standing=$('rankStanding');standing.replaceChildren();
  if(mine?.place){standing.append('You’re ',el('b','',ordinal(mine.place)),` of ${fmt(mine.players)} in ${title}${when}`+(level?` · ${fmt(mine.xp)} XP`:` · best ${fmt(mine.score)}`));if(move.text)standing.append(' ',el('span',move.dir,move.text+' since yesterday'));}
  else standing.textContent=level?'Play any game to join the Arcade Level board.':mine?.players?`${fmt(mine.players)} players ranked in ${title}${when}. Finish a run to join them.`:'';
  if(!rows.length){podium.replaceChildren();list.replaceChildren(this.empty(this.scope==='friends'?'No friends on this board yet':'No runs here yet',this.scope==='friends'?'Add friends by code, or challenge them to a game.':'Be the first on the '+title+' board.',level?null:this.game));pin.hidden=true;return;}
  const spots=[rows[1],rows[0],rows[2]].map((r,i)=>{if(!r)return el('div');const cls=['second','first','third'][i],b=el('button','podium-spot '+cls+(r.is_me?' me':''));b.type='button';if(cls==='first')b.append(el('span','crown','👑'));b.append(this.face(r.avatar,cls==='first'?92:72),el('b','',r.player+(r.is_me?' (you)':'')),el('small','',value(r)),el('div','plinth',String(r.place)));b.onclick=()=>this.showCode(r.friend_code);return b;});
  podium.replaceChildren(...spots);
  list.replaceChildren(...rows.slice(3).map(r=>{const li=el('li');li.append(this.row(r,value(r),sub(r)));return li;}));
  const shown=rows.some(r=>r.is_me);pin.hidden=!(mine?.place&&!shown);
  if(!pin.hidden){const r={place:mine.place,player:this.profile?.name||this.kennel.active?.name||'You',avatar:this.kennel.active,is_me:true,friend_code:this.profile?.code,level:mine.level,xp:mine.xp,score:mine.score};pin.replaceChildren(this.row(r,value(r),'YOUR SPOT'));}
 }
 row(r,value,sub){const b=el('button','rank-row'+(r.is_me?' me':''));b.type='button';const name=el('span','rank-name',r.player+(r.is_me?' (you)':''));if(sub)name.append(el('small','',sub));b.append(el('span','rank-place','#'+r.place),this.face(r.avatar,40),name,el('b','',value));b.onclick=()=>r.friend_code&&this.showCode(r.friend_code);return b;}
 empty(title,text,game){const d=el('div','rank-empty');d.append(el('b','',title),el('p','',text));if(game)d.append(button('PLAY '+titleOf(game).toUpperCase(),'primary',()=>this.play(game)));return d;}
 async loadStats(){try{const s=await this.cached('stats',60000,()=>this.rpc('global_stats'));$('rankStats').replaceChildren(...[['PLAYERS',fmt(s.players)],['RUNS TODAY',fmt(s.runs_today)],['ALL RUNS',fmt(s.runs)],['HOURS',fmt(s.hours)]].map(([k,v])=>{const d=el('div');d.append(el('b','',v),el('small','',k));return d;}));}catch{}}

 // ── Friends ───────────────────────────────────────────────────────────────────────────────
 async loadFriendsTab(){this.renderIdentity();
  for(const b of document.querySelectorAll('#friendTabs [data-tab]'))b.setAttribute('aria-selected',String(b.dataset.tab===this.tab));
  for(const [tab,id] of [['inbox','friendInbox'],['feed','friendFeed'],['people','friendPeople']])$(id).hidden=tab!==this.tab;
  if(!this.api){this.note('friendNote','Friends need the cloud connection. Your progress is still saved on this device.');return;}this.note('friendNote','');
  if(this.tab==='inbox')this.loadInbox();else if(this.tab==='feed')this.loadFeed();else this.loadPeople();}
 async loadInbox(){const box=$('friendInbox');box.replaceChildren(el('div','skeleton'),el('div','skeleton'));
  try{const rows=await this.rpc('my_challenges');this.challenges=rows||[];
   if(this.challenges.some(c=>c.direction==='in'&&!c.seen)){this.rpc('mark_challenges_seen').catch(()=>{});}
   const incoming=this.challenges.filter(c=>c.direction==='in'),outgoing=this.challenges.filter(c=>c.direction==='out'),open=incoming.filter(c=>!c.beaten),done=incoming.filter(c=>c.beaten);
   const parts=[];
   if(!this.challenges.length)parts.push(this.emptyState('No challenges yet','Challenge a friend from their card, or from any game’s Play screen. When someone challenges you, it lands here.',button('CHALLENGE A FRIEND','primary',()=>this.pickFriend(this.currentGame?.()))));
   if(open.length)parts.push(el('p','list-label','WAITING FOR YOU'),...open.map(c=>this.challengeRow(c)));
   if(outgoing.length)parts.push(el('p','list-label','YOU SENT'),...outgoing.map(c=>this.challengeRow(c)));
   if(done.length)parts.push(el('p','list-label','YOU WON'),...done.map(c=>this.challengeRow(c)));
   box.replaceChildren(...parts);this.badge(0,true);
  }catch(error){box.replaceChildren(this.emptyState(missing(error)?'Challenges are coming':'Couldn’t load challenges',error.message));}}
 challengeRow(c){const inbound=c.direction==='in',row=el('div','challenge'+(inbound&&!c.seen?' new':'')+(c.beaten?' won':'')),who=el('div','who'),title=titleOf(c.game);
  const face=this.face(c.avatar,48);face.onclick=()=>this.showCode(c.friend_code);
  who.append(el('b','',inbound?`${c.player} challenged you`:`You challenged ${c.player}`));const small=el('small');small.append(title+' · beat ',el('span','score',fmt(c.score)),' · '+timeAgo(c.created_at)+' ');
  small.append(inbound?(c.beaten?el('span','tag win','BEATEN · '+fmt(c.answer)):el('span','tag wait','YOUR MOVE')):(c.beaten?el('span','tag lose','THEY BEAT IT · '+fmt(c.answer)):el('span','tag wait','WAITING')));who.append(small);
  const acts=el('div','acts');if(inbound&&!c.beaten)acts.append(button('PLAY','primary',()=>this.play(c.game)));if(!inbound&&c.beaten)acts.append(button('REMATCH','pink',()=>this.sendChallenge({friend_code:c.friend_code,player:c.player},c.game)));
  acts.append(button('✕','',async()=>{try{await this.rpc('remove_challenge',{p_id:c.id});row.remove();}catch(e){this.note('friendNote',e.message);}}));acts.lastChild.setAttribute('aria-label',inbound?'Dismiss challenge':'Withdraw challenge');
  row.append(face,who,acts);return row;}
 async loadFeed(){const box=$('friendFeed');box.replaceChildren(el('div','skeleton'),el('div','skeleton'));
  try{const rows=await this.cached('feed',30000,()=>this.rpc('friend_feed',{p_limit:40}));
   box.replaceChildren(...(rows?.length?rows.map(r=>this.feedItem(r)):[this.emptyState('Nothing new from your pack','When friends set a new personal best, it shows up here.',button('ADD FRIENDS','primary',()=>{this.tab='people';this.loadFriendsTab();$('friendCode').focus();}))]));
  }catch(error){box.replaceChildren(this.emptyState(missing(error)?'Activity is coming':'Couldn’t load activity',error.message));}}
 feedItem(r){const d=el('div','feed-item'),face=this.face(r.avatar,48),who=el('div');face.onclick=()=>this.showCode(r.friend_code);
  who.append(el('b','',`${r.player} set a new best in ${titleOf(r.game)}`));const small=el('small','',fmt(r.score)+' · '+timeAgo(r.achieved_at));
  if(r.my_best>0)small.append(' · ',el('span',r.score>r.my_best?'beat':'',r.score>r.my_best?`${fmt(r.score-r.my_best)} ahead of you`:`you’re ${fmt(r.my_best-r.score)} ahead`));who.append(small);
  d.append(face,who,button(r.score>r.my_best?'BEAT IT':'PLAY','primary',()=>this.play(r.game)));return d;}
 async loadPeople(){const followers=$('followerList'),list=$('friendList');list.replaceChildren(el('li','skeleton'),el('li','skeleton'));followers.replaceChildren();
  try{const [rows,fans]=await Promise.all([this.rpc('my_friends'),this.rpc('my_followers').catch(()=>[])]);this.friends=rows||[];
   if(fans?.length){followers.append(el('p','list-label','ADDED YOU'),...fans.map(f=>{const row=el('div','person'),who=el('div','who'),face=this.face(f.avatar,48);face.onclick=()=>this.showCode(f.friend_code);who.append(el('b','',f.player),el('small','',`Level ${f.level} · added you ${timeAgo(f.added_at)}`));const acts=el('div','acts');acts.append(button('ADD BACK','primary',async()=>{if(await this.follow(f.friend_code))this.loadPeople();}));row.append(face,who,acts);return row;}));}
   try{localStorage.setItem('dawg-v1-fansSeen',String(Date.now()));}catch{}this.badge();
   list.replaceChildren(...(this.friends.length?[el('p','list-label','YOUR FRIENDS · '+this.friends.length),...this.friends.map(f=>{const li=el('li','person'),who=el('div','who'),face=this.face(f.avatar,48);face.onclick=()=>this.showCode(f.friend_code);const name=el('b','',f.player+' ');if(f.follows_me)name.append(el('span','tag mutual','MUTUAL'));
     who.append(name,el('small','',`Level ${f.level}`+(f.last_game?` · played ${titleOf(f.last_game)} ${timeAgo(f.last_played)}`:' · no runs yet')));const acts=el('div','acts');acts.append(button('CHALLENGE','pink',()=>this.pickGame(f)),button('✕','',()=>this.confirm('Remove '+f.player+'?','They won’t show on your Friends board or feed. You can add them again with their code.','REMOVE',()=>this.unfollow(f.friend_code))));acts.lastChild.setAttribute('aria-label','Remove '+f.player);li.append(face,who,acts);return li;})]:[this.emptyState('Your pack is empty','Share your invite link or add a friend’s code above. Friends show up on your Friends board, feed and challenges.',button('INVITE FRIENDS','primary',()=>this.shareProfile()))]));
  }catch(error){list.replaceChildren(this.emptyState('Couldn’t load friends',error.message));}}
 emptyState(title,text,action){const d=el('div','empty-state');d.append(el('b','',title),el('span','',text));if(action)d.append(el('br'),action);return d;}
 // Friends badge: unseen incoming challenges plus new "added you" players.
 async refreshBadge(){if(!this.api)return;let n=0;try{const rows=await this.rpc('my_challenges');this.challenges=rows||[];n+=this.challenges.filter(c=>c.direction==='in'&&!c.seen&&!c.beaten).length;}catch{}
  try{const fans=await this.rpc('my_followers');let seen=0;try{seen=Number(localStorage.getItem('dawg-v1-fansSeen'))||0;}catch{}n+=(fans||[]).filter(f=>new Date(f.added_at).getTime()>seen).length;}catch{}this.badge(n);}
 badge(n=this.badgeCount||0,inboxSeen=false){if(inboxSeen)n=Math.max(0,n-this.challenges.filter(c=>c.direction==='in'&&!c.seen&&!c.beaten).length);this.badgeCount=n;
  for(const id of ['friendsBadge','inboxBadge']){const b=$(id);if(!b)continue;b.hidden=!n;b.textContent=n>9?'9+':String(n);}const nav=$('friendsButton');nav?.setAttribute('aria-label',n?`Friends, ${n} new`:'Friends');}
 // Friend activity on the Play view.
 async loadFeedStrip(){if(!this.api)return;try{const rows=await this.cached('feed',30000,()=>this.rpc('friend_feed',{p_limit:40}));const strip=$('feedStrip'),row=$('feedRow');strip.hidden=!rows?.length;
  row.replaceChildren(...(rows||[]).slice(0,10).map(r=>{const b=el('button','feed-card');b.type='button';b.dataset.game=r.game;const t=el('div');t.append(el('b','',`${r.player} · ${titleOf(r.game)}`));const s=el('small','',fmt(r.score)+' · '+timeAgo(r.achieved_at));if(r.my_best>0&&r.score>r.my_best)s.append(' · ',el('span','beat','beat yours by '+fmt(r.score-r.my_best)));t.append(s);b.append(this.face(r.avatar,44),t);return b;}));}catch{}}

 // ── Challenges ────────────────────────────────────────────────────────────────────────────
 async sendChallenge(friend,game){try{const r=await this.rpc('send_challenge',{p_code:friend.friend_code,p_game:game});this.note('pickNote','');$('pickDialog').open&&$('pickDialog').close();this.announce(`CHALLENGE SENT · ${(r?.to||friend.player).toUpperCase()} · ${titleOf(game).toUpperCase()}`);if(this.shell.view==='friends'&&this.tab==='inbox')this.loadInbox();return true;}
  catch(error){if($('pickDialog').open)this.note('pickNote',error.message);else this.announce(error.message);return false;}}
 // Pick which game to challenge a friend in: games with a personal best first.
 pickGame(friend){if(!this.api){this.announce('Challenges need the cloud connection.');return;}const recs=this.records();const games=GAMES.filter(g=>g.id!=='story').sort((a,b)=>(recs[b.id]||0)-(recs[a.id]||0));
  $('pickEyebrow').textContent='CHALLENGE '+friend.player.toUpperCase();$('pickTitle').textContent='Pick a game';$('pickText').textContent='They’ll get your best score in that game as the one to beat.';this.note('pickNote','');
  $('pickList').replaceChildren(...games.map(g=>{const b=el('button');b.type='button';const img=el('img');img.src=posterOf(g.id);img.alt='';const t=el('span','',g.title);t.append(el('small','',recs[g.id]>0?'Your best':'No score yet'));b.append(img,t,el('b','',recs[g.id]>0?fmt(recs[g.id]):'—'));b.disabled=!(recs[g.id]>0);b.onclick=()=>this.sendChallenge(friend,g.id);return b;}));this.openDialog('pickDialog');}
 // Pick which friend to challenge in a game.
 async pickFriend(game){if(!game||!gameById(game))return;if(!this.api){this.announce('Challenges need the cloud connection.');return;}const best=this.records()[game]||0;
  $('pickEyebrow').textContent='CHALLENGE · '+titleOf(game).toUpperCase();$('pickTitle').textContent='Who’s up?';$('pickText').textContent=best>0?`They’ll need to beat your ${fmt(best)}.`:'Finish a run in this game first so there’s a score to beat.';this.note('pickNote','');$('pickList').replaceChildren(el('div','skeleton'));this.openDialog('pickDialog');
  try{const rows=this.friends.length?this.friends:await this.rpc('my_friends');this.friends=rows||[];
   $('pickList').replaceChildren(...(this.friends.length?this.friends.map(f=>{const b=el('button');b.type='button';const t=el('span','',f.player);t.append(el('small','',`Level ${f.level}`));b.append(this.face(f.avatar,44),t,el('b','','SEND ›'));b.disabled=!(best>0);b.onclick=()=>this.sendChallenge(f,game);return b;}):[this.emptyState('No friends yet','Add friends by code, or send them your invite link.',button('INVITE FRIENDS','primary',()=>{$('pickDialog').close();this.shareProfile();}))]));
  }catch(error){$('pickList').replaceChildren();this.note('pickNote',error.message);}}

 // ── Player cards, names and links ─────────────────────────────────────────────────────────
 async saveProfile(){const name=$('playerName').value.trim();if(name&&!NAME_RULE.test(name)){this.announce('Use 3–16 letters, numbers, spaces, _ . or -.');return;}try{this.profile=await this.rpc('set_profile',{p_name:name||null,p_avatar:this.kennel.active||null,p_public:$('rankPublic').checked});this.forget('board:');this.renderIdentity();this.announce(name?'SAVED · YOU’RE '+name.toUpperCase()+' ON THE BOARDS':'PROFILE SAVED');}catch(error){this.announce(error.message);}}
 async follow(code){code=String(code||'').trim().toUpperCase();if(!/^[A-F0-9]{8}$/.test(code)){this.note('friendNote','Friend codes are 8 letters and numbers, like 3FA9C210.');return null;}try{const p=await this.rpc('follow_code',{p_code:code});this.note('friendNote','Added '+(p?.name||code)+'.');this.friends=[];this.forget('board:');this.forget('feed');return p;}catch(error){this.note('friendNote',error.message);this.announce(error.message);return null;}}
 async unfollow(code){try{await this.rpc('unfollow_code',{p_code:code});this.friends=[];this.forget('board:');this.forget('feed');this.loadPeople();}catch(error){this.note('friendNote',error.message);}}
 async copy(text,noteId,done){if(!text)return;try{await navigator.clipboard.writeText(text);this.note(noteId,done);}catch{this.note(noteId,text);}}
 // A link to the player's public card. Needs a public profile, since that is what the link shows.
 async shareProfile(){const p=this.profile;if(!p?.code){this.announce('Connect to the cloud to get your invite link.');return;}if(p.public===false){this.announce('Turn on “Show me on public boards” to share your profile.');return;}
  const url=profileLink(p.code,shareBase()),name=p.name||'Guest '+p.code,text=`Play the DAWG Arcade with me 🐶 Add ${name} with friend code ${p.code}`;
  this.share({title:'Invite friends',text,url,filename:'dawg-arcade-invite.png',card:cv=>drawScoreCard(cv,{game:null,score:this.bestScore(),player:name,dawg:this.kennel.active,unit:'TOP SCORE',detail:'friend code '+p.code})});}
 bestScore(){return Math.max(0,...Object.values(this.records()).filter(Number.isFinite));}
 async showCode(code){if(!code)return;try{const p=await this.rpc('public_profile',{p_code:code});if(p)this.showPlayer(p);else this.announce('That player card is private.');}catch(error){this.announce(error.message);}}
 // A profile link opened on this device: show that player's public card with an Add Friend button.
 async handlePlayer(){const code=readPlayerLink(location.search);if(!code)return;const u=new URL(location.href);u.searchParams.delete('player');history.replaceState(null,'',u.pathname+u.search+u.hash);
  let p=null;try{p=await this.rpc('public_profile',{p_code:code});}catch(error){this.announce(error.message);return;}if(!p){this.announce('That player card is private or no longer exists.');return;}this.showPlayer(p);}
 showPlayer(p){this.shown=p;const bests=Object.entries(p.best||{}).filter(([g,s])=>gameById(g)&&Number.isFinite(s)).sort((a,b)=>b[1]-a[1]);p.topGame=bests[0]?.[0];
  this.avatar($('profileAvatar'),p.avatar,200);$('profileName').textContent=p.name||'Guest '+p.code;$('profileLevel').textContent=`Level ${fmt(p.level)} · friend code ${p.code}`;
  $('profileBests').replaceChildren(...bests.map(([g,s])=>{const li=el('li');li.append(el('span','',gameById(g).title),el('b','',fmt(s)));return li;}));
  if(!bests.length)$('profileBests').append(el('li','muted','No ranked runs yet.'));
  const mine=p.code===this.profile?.code;$('profileFollow').hidden=mine;$('profileChallenge').hidden=mine;$('profileFollow').textContent=p.following?'FRIENDS ✓':'ADD FRIEND';$('profileFollow').disabled=!!p.following;$('profileNote').textContent=mine?'This is your own card.':'';this.openDialog('profileDialog');}
 async followShown(){const p=this.shown;if(!p||p.following)return;const r=await this.follow(p.code);if(r){p.following=true;$('profileFollow').textContent='FRIENDS ✓';$('profileFollow').disabled=true;$('profileNote').textContent='Added. Race them on the Friends board.';}}
 // A challenge link opened on this device: say who sent it, then offer to play and add them.
 async handleChallenge(){const ch=readChallenge(location.search);if(!ch)return;history.replaceState(null,'',location.pathname+location.hash);let from=null;try{from=await this.rpc('public_profile',{p_code:ch.from});}catch{}
  const who=from?.name||'A friend',title=gameById(ch.game)?.title||ch.game;this.confirm(`${who} challenged you!`,`Beat ${fmt(ch.score)} in ${title}. Accepting adds ${who} to your friends so you can race on the Friends board.`,'ACCEPT & PLAY ↗',async()=>{if(from&&!from.following&&from.code!==this.profile?.code)await this.follow(ch.from);this.play(ch.game);});}

 // ── Social lines for the Play hero and game-over screens ──────────────────────────────────
 async heroStats(game){if(!this.api||!gameById(game))return null;try{return await this.cached('hero:'+game,60000,async()=>{
   const [mine,friends]=await Promise.all([this.rpc('my_rank',{p_game:game,p_period:'week'}).catch(()=>this.rpc('my_standing',{p_game:game,p_period:'week'})),this.rpc('leaderboard',{p_game:game,p_period:'all',p_scope:'friends',p_limit:10}).catch(()=>[])]);
   const top=(friends||[]).find(r=>!r.is_me),move=movement(mine?.place,mine?.prev_place);
   return {rank:mine?.place?'#'+mine.place+(move.text?' '+move.text:''):'—',rankDir:move.dir,friend:top?`${top.player} · ${fmt(top.score)}`:'Add friends'};});}catch{return null;}}
 // After a run: where it lands this week and against the closest friend. Waits briefly so the
 // run has reached the server first.
 async insight(game,score){if(!this.api||!gameById(game)||!(score>0))return null;await new Promise(r=>setTimeout(r,1600));this.forget('hero:'+game);this.forget('board:');
  try{const [mine,friends]=await Promise.all([this.rpc('my_rank',{p_game:game,p_period:'week'}).catch(()=>this.rpc('my_standing',{p_game:game,p_period:'week'})),this.rpc('leaderboard',{p_game:game,p_period:'all',p_scope:'friends',p_limit:50}).catch(()=>[])]);
   const lines=[];if(mine?.place){const move=movement(mine.place,mine.prev_place);lines.push({text:`#${mine.place} of ${fmt(mine.players)} this week`,extra:move.text,dir:move.dir});}
   const others=(friends||[]).filter(r=>!r.is_me),above=others.filter(r=>r.score>score).sort((a,b)=>a.score-b.score)[0],below=others.filter(r=>r.score<=score).sort((a,b)=>b.score-a.score)[0];
   if(above)lines.push({text:`${fmt(above.score-score)} behind ${above.player}`,dir:'down',friend:above});else if(below)lines.push({text:`${fmt(score-below.score)} ahead of ${below.player}`,dir:'up',friend:below});
   return lines.length?lines:null;}catch{return null;}}
}
