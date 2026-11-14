// BITE NIGHT: the pure data for the arcade's fighting game. Fighters, their frame data, the
// finishing moves ("Curtain Calls"), the stages and the announcer's vocabulary all live here as
// plain tables with no rendering and no randomness, so the engine, the AI, the move list, the
// chat replay viewer and the tests read the same numbers.
//
// Frame data: s = startup frames before the first active frame, a = active frames, r = recovery.
// lv = hit level: 'high' and 'mid' are blocked standing or crouching, 'low' must be blocked
// crouching, 'over' (overhead) must be blocked standing, 'throw' cannot be blocked.
// Distances are metres on the fighting plane, speeds are metres per 60 Hz frame.

export const TITLE='BITE NIGHT';
export const TAGLINE='EVERY DAWG HAS ITS NIGHT';
// The announcer's words, used by the HUD, the cinematics and the share text.
export const CALL={round:n=>'ROUND '+n,final:'FINAL ROUND',go:'UNLEASH!',ko:'LIGHTS OUT!',time:'TIME!',draw:'DEAD HEAT',perfect:'UNTOUCHED!',clutch:'BY A WHISKER!',
 finish:'SEND ’EM HOME!',curtain:'CURTAIN CALL!',dive:'STAGE DIVE!',rub:'BELLY RUB!',wins:n=>n+' WINS',under:'UNDERDAWG!',snap:'SNAP GUARD',tech:'SLIPPED IT',counter:'READ!',wall:'WALL SLAM',first:'FIRST BITE'};

// Input bits (absolute left/right; the engine turns them into forward/back by facing).
export const IN={U:1,D:2,L:4,R:8,A:16,B:32,S:64,G:128};
export const BTN_NAME={A:'LIGHT',B:'HEAVY',S:'SPECIAL',G:'GUARD'};
// The four special slots: a classic motion with LIGHT or HEAVY, or a direction with SPECIAL.
export const SLOTS=[{motion:'236',simple:'5',keys:'↓ → + LIGHT',easy:'SPECIAL'},{motion:'46',simple:'6',keys:'← → + LIGHT',easy:'→ + SPECIAL'},{motion:'214',simple:'4',keys:'↓ ← + LIGHT',easy:'← + SPECIAL'},{motion:'22',simple:'2',keys:'↓ ↓ + LIGHT',easy:'↓ + SPECIAL'}];

const Y={high:[1,1.75],mid:[.45,1.5],low:[0,.55],over:[.7,2.1],throw:[0,1.7]};
// Normals every fighter shares (tuned per fighter by startup, damage and reach modifiers).
const NORMALS={
 '5L':{name:'Jab',s:4,a:3,r:8,dmg:28,lv:'high',hs:15,bs:10,x1:.95,cancel:['5LL','2L','sp','su'],anim:'jab',w:1},
 '5LL':{name:'Cross',s:5,a:3,r:10,dmg:32,lv:'mid',hs:17,bs:11,x1:1.02,cancel:['5LLL','5H','sp','su'],anim:'cross',w:1},
 '5LLL':{name:'Hook',s:7,a:3,r:16,dmg:46,lv:'mid',hs:19,bs:12,x1:1.05,push:.1,cancel:['sp','su'],anim:'hook',w:2},
 '2L':{name:'Shin Tap',s:5,a:3,r:9,dmg:24,lv:'low',hs:14,bs:9,x1:.98,cancel:['5LL','sp','su'],anim:'lowjab',w:1,crouch:1},
 '5H':{name:'Haymaker',s:9,a:4,r:17,dmg:70,lv:'mid',hs:21,bs:15,x1:1.2,push:.09,cancel:['sp','su'],anim:'heavy',w:2},
 '6H':{name:'Hammer',s:20,a:4,r:17,dmg:82,lv:'over',hs:24,bs:13,x1:1.15,push:.07,cancel:['su'],anim:'over',w:2,adv:[6,18,.03]},
 '2H':{name:'Sky Upper',s:8,a:5,r:20,dmg:74,lv:'mid',hs:20,bs:16,x1:.92,y:[.4,2.5],launch:[.006,.25],jp:2,cancel:['sp','su'],anim:'upper',w:2,crouch:1},
 '4H':{name:'Sweep',s:11,a:4,r:22,dmg:58,lv:'low',hs:18,bs:14,x1:1.38,kd:1,cancel:[],anim:'sweep',w:2,crouch:1},
 'jL':{name:'Air Jab',s:5,a:10,r:0,dmg:34,lv:'over',hs:15,bs:10,x1:.9,y:[-.3,1.1],air:1,cancel:[],anim:'airL',w:1},
 'jH':{name:'Air Stomp',s:8,a:9,r:0,dmg:66,lv:'over',hs:22,bs:14,x1:1,y:[-.5,1],air:1,cancel:[],anim:'airH',w:2},
 'throw':{name:'Scruff Toss',kind:'throw',s:5,a:2,r:24,dmg:115,lv:'throw',x1:.98,thr:40,launch:[.075,.15],anim:'throw',w:2,tech:1}
};
const special=(slot,o)=>({kind:'special',slot,lv:'mid',hs:20,bs:14,x1:1.1,w:3,cancel:['su'],...o});
const superMove=o=>({kind:'super',lv:'mid',hs:22,bs:18,x1:1.2,w:4,cancel:[],cost:200,...o});
const fin=(id,name,seq,range,blurb)=>({id,name,seq,range,blurb});

// seq: three direction taps (F forward, B back, D down, U up) then a button (A light, B heavy).
const RAW=[
 {id:'biscuit',name:'BISCUIT',title:'The Bodega Brawler',arche:'RUSHDOWN',color:'#ff8a3d',hp:1000,walk:.06,scale:1,
  stats:{power:3,speed:4,reach:2,tricks:2},look:{coat:2,pattern:3,outfit:0,hat:0,glasses:4,neck:0,hue:18,accentHue:48,shoeHue:200,build:1,ears:0,tail:0,shoes:1,back:0,aura:0,finish:0,pose:1},
  bio:'Night-shift counter dawg who settles every dispute the same way: fast, close and before the bread burns.',
  intro:'Shop’s open. You’re the first customer.',win:'Next! And somebody mop that up.',taunt:'You fight like day-old bread.',ending:'Biscuit hangs the champion’s belt above the register. Bread is half price, forever.',
  specials:[
   special(0,{id:'rush',name:'Bodega Rush',s:10,a:12,r:18,dmg:32,hits:3,gap:4,adv:[4,22,.11],x1:.95,anim:'flurry',ex:{hits:5,a:18,adv:[4,28,.1],r:12,last:{launch:[.03,.19]}}}),
   special(1,{id:'step',name:'Quick Step',s:15,a:0,r:1,dmg:0,adv:[1,13,.14],ghost:[2,13],anim:'dash',cancel:[],free:10,ex:{inv:[1,13],free:8}}),
   special(2,{id:'crumb',name:'Crumb Crusher',s:22,a:4,r:20,dmg:105,lv:'over',adv:[8,22,.05],launch:[.01,.13],anim:'slam',ex:{s:17,launch:[.01,.19],dmg:120}}),
   special(3,{id:'rise',name:'Rise & Shine',s:5,a:8,r:30,dmg:110,inv:[1,7],y:[.3,2.8],x1:.9,launch:[.03,.24],jp:2,hop:[5,.03,.19],anim:'rise',ex:{dmg:140,inv:[1,10]}})],
  super:superMove({id:'dozen',name:'Baker’s Dozen',s:8,a:39,r:30,dmg:24,hits:13,gap:3,adv:[4,14,.15],inv:[1,9],anim:'flurry',last:{launch:[.05,.24]}}),
  fins:[fin('thunder_fetch','Thunder Fetch','DFD B','close','A charged stick, a storm cloud, and one very fluffy rival.'),fin('fresh_baked','Fresh Baked','BFF A','mid','Into the oven. Out comes a golden loaf.'),fin('special_delivery','Special Delivery','FBB B','far','Boxed, stamped and drone-shipped out of town.')]},
 {id:'moxie',name:'MOXIE',title:'The Neon Tagger',arche:'ZONER',color:'#ff5fc8',hp:950,walk:.05,scale:.98,
  stats:{power:2,speed:3,reach:5,tricks:3},look:{coat:6,pattern:1,outfit:8,hat:3,glasses:2,neck:3,hue:310,accentHue:180,shoeHue:310,build:1,ears:1,tail:1,shoes:2,back:1,aura:0,finish:1,pose:0},
  bio:'Street artist with a can in each paw. If you can reach her, you were allowed to.',
  intro:'Hold still. You’re about to be a mural.',win:'Signed, sealed, sprayed.',taunt:'I’ve tagged walls tougher than you.',ending:'Every wall in the city wakes up pink. Nobody saw a thing.',
  specials:[
   special(0,{id:'tag',name:'Tag Shot',s:13,a:1,r:26,dmg:0,anim:'cast',proj:{k:'paint',vx:.14,y:1.15,dmg:70,hs:18,bs:12,life:110},ex:{proj:{k:'paint',vx:.2,y:1.15,dmg:50,hs:20,bs:14,life:110,hits:2,kd:1}}}),
   special(1,{id:'wet',name:'Wet Paint',s:18,a:1,r:20,dmg:0,anim:'castlow',proj:{k:'puddle',vx:0,y:0,dx:2.3,dmg:50,life:260,trap:1,kd:1,lv:'low',h:.3,w:.7},ex:{proj:{k:'puddle',vx:0,y:0,dx:2.3,dmg:80,life:420,trap:1,launch:[0,.17],lv:'low',h:.3,w:.9}}}),
   special(2,{id:'low',name:'Low Rider',s:15,a:1,r:27,dmg:0,anim:'castlow',proj:{k:'can',vx:.1,y:.05,dmg:60,hs:17,bs:12,life:120,lv:'low',h:.4},ex:{proj:{k:'can',vx:.13,y:.05,dmg:75,life:120,lv:'low',h:.4,launch:[.01,.15]}}}),
   special(3,{id:'sky',name:'Sky Tag',s:9,a:1,r:28,dmg:0,anim:'castup',proj:{k:'paint',vx:.075,vy:.13,y:1.4,dmg:85,hs:20,life:60,launch:[.02,.17]},ex:{proj:{k:'paint',vx:.075,vy:.13,y:1.4,dmg:60,hits:2,life:60,launch:[.02,.2],w:.6,h:.6}}})],
  super:superMove({id:'mural',name:'Mural Cannon',s:12,a:1,r:44,dmg:0,anim:'beam',proj:{k:'beam',vx:0,dx:7.3,y:1.15,dmg:38,hits:8,gap:3,life:28,h:.8,w:6.7,pierce:1,last:{launch:[.06,.2]}}}),
  fins:[fin('fresh_coat','Fresh Coat','DFD A','close','Rolled flat by a giant paint roller and pasted up as a poster.'),fin('color_bomb','Color Bomb','FBF B','mid','Inflated like a party balloon. Then: pop.'),fin('signature','Signature','BBF A','far','Strapped to a spray-can rocket. The fireworks spell her name.')]},
 {id:'bruno',name:'BRUNO',title:'The Bear Hug',arche:'GRAPPLER',color:'#ff4d5e',hp:1100,walk:.045,scale:1.14,ds:1,pow:1.08,
  stats:{power:5,speed:2,reach:2,tricks:2},look:{coat:4,pattern:0,outfit:6,hat:4,glasses:4,neck:6,hue:355,accentHue:45,shoeHue:355,build:2,ears:2,tail:0,shoes:3,back:3,aura:0,finish:0,pose:1},
  bio:'Retired alley-wrestling champion. He only wants a hug. The hug has a name and a finishing bell.',
  intro:'Come here. Bruno just wants to talk.',win:'One, two, three. Good night, little one.',taunt:'You’re light. Bruno likes light.',ending:'Bruno opens a wrestling school for puppies. Tuition is one hug.',
  specials:[
   special(0,{id:'bus',name:'Suplex Express',lv:'throw',s:8,a:18,r:26,dmg:150,x1:.95,adv:[3,26,.1],thr:52,launch:[-.06,.2],anim:'rungrab',cancel:[],ex:{armor:[1,26],dmg:170}}),
   special(1,{id:'belly',name:'Belly Bounce',s:12,a:6,r:20,dmg:95,armor:[3,12],adv:[6,16,.09],push:.2,wall:1,anim:'charge',ex:{launch:[.05,.18],dmg:110}}),
   special(2,{id:'hug',name:'Bear Hug',lv:'throw',s:6,a:3,r:30,dmg:170,x1:1.25,thr:58,launch:[.04,.12],anim:'grab',cancel:[],ex:{s:4,x1:1.55,dmg:200}}),
   special(3,{id:'hook',name:'Sky Hook',lv:'throw',s:6,a:6,r:28,dmg:150,x1:1.25,y:[1,3.2],airOnly:1,thr:46,launch:[.02,-.2],anim:'upgrab',cancel:[],ex:{inv:[1,8],dmg:175}})],
  super:superMove({id:'main',name:'Main Event',lv:'throw',s:6,a:4,r:34,dmg:340,x1:1.45,thr:96,launch:[.02,.1],anim:'grab'}),
  fins:[fin('sewer_service','Sewer Service','DDF B','close','A piledriver straight through the street and into the sewer.'),fin('orbit_toss','Orbit Toss','FBF A','mid','A giant swing so big it ends in a new constellation.'),fin('bell_ringer','Bell Ringer','BBF B','far','Rung like the bell at the end of the main event.')]},
 {id:'mochi',name:'SENSEI MOCHI',title:'The Still Water',arche:'COUNTER',color:'#5effc1',hp:950,walk:.052,scale:.95,
  stats:{power:3,speed:3,reach:3,tricks:5},look:{coat:5,pattern:5,outfit:2,hat:7,glasses:1,neck:2,hue:150,accentHue:150,shoeHue:30,build:0,ears:2,tail:2,shoes:0,back:0,aura:0,finish:1,pose:0},
  bio:'Runs the tea house above the arcade. Never throws the first punch. Always throws the last.',
  intro:'Strike when you are ready. I already know where.',win:'The lesson is free. The tea is not.',taunt:'Your breathing gave you away.',ending:'Mochi returns to the tea house. The kettle never went cold.',
  specials:[
   special(0,{id:'palm',name:'Flowing Palm',s:11,a:4,r:19,dmg:95,adv:[5,13,.12],push:.18,wall:1,x1:1.15,anim:'palm',ex:{hs:42,push:.02,wall:0,dmg:85}}),
   special(1,{id:'tea',name:'Tea Time',s:30,a:1,r:20,dmg:0,x1:0,anim:'sip',cancel:[],gain:80,heal:30,ex:{heal:90,gain:0}}),
   special(2,{id:'parry',name:'Still Water',s:3,a:20,r:16,dmg:0,x1:0,anim:'counter',cancel:[],counter:{lv:['high','mid','over'],then:'parry!'},ex:{counter:{lv:['high','mid','over','low','proj'],then:'parry!+'}}}),
   special(3,{id:'tide',name:'Low Tide',s:3,a:20,r:16,dmg:0,x1:0,anim:'counterlow',cancel:[],counter:{lv:['low','throw'],then:'tide!'},crouch:1,ex:{counter:{lv:['low','throw','mid'],then:'tide!'}}})],
  extra:[{id:'parry!',name:'Still Water (strike)',kind:'special',hidden:1,s:2,a:4,r:20,dmg:140,x1:1.6,launch:[.05,.2],hs:20,bs:14,lv:'mid',w:3,inv:[1,8],cancel:['su'],anim:'palm'},{id:'parry!+',name:'Still Water (strike)',kind:'special',hidden:1,s:2,a:4,r:16,dmg:170,x1:2.4,launch:[.04,.23],hs:20,bs:14,lv:'mid',w:3,inv:[1,8],cancel:['su'],anim:'palm'},{id:'tide!',name:'Low Tide (strike)',kind:'special',hidden:1,s:2,a:4,r:20,dmg:130,x1:1.6,kd:1,hs:20,bs:14,lv:'mid',w:3,inv:[1,8],cancel:[],anim:'sweep'}],
  super:superMove({id:'nap',name:'Thousand-Year Nap',s:2,a:40,r:22,dmg:0,x1:0,anim:'counter',counter:{lv:['high','mid','over','low','proj','throw'],then:'nap!'}}),
  extra2:[{id:'nap!',name:'Thousand-Year Nap (strike)',kind:'super',hidden:1,s:3,a:24,r:30,dmg:54,hits:6,gap:4,x1:2.6,hs:22,bs:18,lv:'mid',w:4,inv:[1,30],cancel:[],anim:'flurry',last:{launch:[.05,.25]}}],
  fins:[fin('deep_freeze','Deep Freeze','FDF A','close','One breath of winter. One tap. Confetti.'),fin('zen_garden','Zen Garden','DBF B','mid','Turned to stone and raked into the garden.'),fin('tea_bag','Steeped','BBF A','far','Dunked like a tea bag in a cup the size of a hot tub.')]},
 {id:'jinx',name:'JINX',title:'The Glitch',arche:'TRICKSTER',color:'#5ee7ff',hp:930,walk:.058,scale:.97,
  stats:{power:2,speed:4,reach:3,tricks:5},look:{coat:1,pattern:2,outfit:10,hat:9,glasses:5,neck:3,hue:188,accentHue:300,shoeHue:188,build:1,ears:1,tail:1,shoes:5,back:5,aura:1,finish:2,pose:0},
  bio:'Nobody remembers Jinx walking into the arcade. One day the cabinets just started losing.',
  intro:'I’m already behind you. Check.',win:'gg. Uninstall.',taunt:'Your hitbox is showing.',ending:'Jinx steps into a cabinet and is never seen again. The high score reads J-N-X.',
  specials:[
   special(0,{id:'glitch',name:'Glitch Jab',s:9,a:4,r:20,dmg:90,tele:[6,'fwd',2.1],x1:1.1,anim:'jab',ex:{launch:[.02,.2]}}),
   special(1,{id:'drop',name:'Drop In',s:14,a:30,r:14,dmg:100,lv:'over',tele:[8,'above',2.5],fall:1,y:[-.6,.9],x1:.8,launch:[.01,.12],anim:'dive',cancel:[],ex:{launch:[.01,.2],dmg:115}}),
   special(2,{id:'decoy',name:'Decoy',s:8,a:1,r:16,dmg:0,x1:0,tele:[7,'back',2.4],anim:'tele',cancel:[],proj:{k:'decoy',vx:0,y:.2,dx:0,dmg:80,life:100,trap:1,launch:[.02,.17],h:1.5,w:.6,at:'origin'},ex:{proj:{k:'decoy',vx:0,y:.2,dx:0,dmg:115,life:150,trap:1,launch:[.02,.2],h:1.6,w:.9,at:'origin'}}}),
   special(3,{id:'blink',name:'Blink',s:16,a:0,r:1,dmg:0,x1:0,tele:[8,'behind',.95],anim:'tele',cancel:[],ex:{s:10,free:7}})],
  super:superMove({id:'bsod',name:'Blue Screen',s:6,a:36,r:28,dmg:52,hits:6,gap:6,flip:1,inv:[1,10],x1:1.2,anim:'flurry',last:{launch:[.03,.25]}}),
  fins:[fin('game_over','Game Over','DFD B','close','Sucked into an arcade cabinet as an 8-bit sprite. INSERT COIN.'),fin('deleted','Deleted','FFB A','mid','Dragged to the bin, one pixel at a time.'),fin('shrink_ray','Pocket Size','DUD B','far','Shrunk to the size of a chew toy and kept in a jar.')]},
 {id:'tank',name:'TANK',title:'The Big Rig',arche:'HEAVY',color:'#ffd25e',hp:1200,walk:.04,scale:1.28,ds:2,pow:1.2,reach:1.12,
  stats:{power:5,speed:1,reach:4,tricks:1},look:{coat:3,pattern:4,outfit:11,hat:6,glasses:0,neck:1,hue:45,accentHue:45,shoeHue:20,build:2,ears:2,tail:0,shoes:3,back:0,aura:0,finish:0,pose:1},
  bio:'Hauls freight on the docks by day. Hauls rivals off the stage by night. Does not use the brakes.',
  intro:'Wide load coming through.',win:'Delivered. Sign here.',taunt:'You’re in my blind spot.',ending:'Tank parks the trophy in the cab and drives into the sunrise. The horn plays a victory lap.',
  specials:[
   special(0,{id:'charge',name:'Rig Charge',s:14,a:14,r:24,dmg:120,armor:[4,28],adv:[10,28,.1],push:.2,wall:1,kd:1,anim:'charge',ex:{launch:[.05,.2],dmg:140,armorHits:2}}),
   special(1,{id:'horn',name:'Air Horn',s:10,a:6,r:22,dmg:50,x1:2.4,push:.24,wall:1,y:[.3,2],eat:1,anim:'honk',ex:{dmg:80,hs:40,push:.05,wall:0}}),
   special(2,{id:'dump',name:'Dump Truck',s:26,a:5,r:26,dmg:150,lv:'over',armor:[8,26],launch:[.01,.16],x1:1.3,anim:'slam',ex:{s:20,dmg:165}}),
   special(3,{id:'pound',name:'Ground Pound',s:18,a:1,r:26,dmg:0,x1:0,anim:'stomp',proj:{k:'quake',vx:.12,y:0,dmg:80,life:50,lv:'low',h:.45,w:.8,launch:[0,.14],gnd:1},ex:{proj:{k:'quake',vx:.16,y:0,dmg:110,life:80,lv:'low',h:.45,w:.9,launch:[0,.18],gnd:1}}})],
  super:superMove({id:'wheeler',name:'Eighteen Wheeler',s:10,a:30,r:30,dmg:110,hits:3,gap:9,adv:[6,40,.16],armor:[1,40],armorHits:9,push:.1,x1:1.3,anim:'charge',last:{launch:[.08,.24],wall:1}}),
  fins:[fin('flat_pack','Flat Pack','DDF A','close','Sat on. Folded into a paper plane. Thrown.'),fin('home_run','Home Run','BFF B','mid','A lamppost, a wind-up, and a new hole in the moon.'),fin('ball_pit','Ball Pit','FBB A','far','One honk. One dump truck. Ten thousand tennis balls.')]},
 {id:'zip',name:'ZIP',title:'The Blur',arche:'SPEEDSTER',color:'#b9ff5e',hp:900,walk:.072,scale:.9,ds:-1,pow:.9,
  stats:{power:2,speed:5,reach:2,tricks:4},look:{coat:7,pattern:5,outfit:3,hat:4,glasses:3,neck:1,hue:92,accentHue:92,shoeHue:330,build:0,ears:1,tail:2,shoes:2,back:0,aura:2,finish:0,pose:2},
  bio:'Fastest courier in the district. Has never once been on time, because he keeps lapping himself.',
  intro:'Blink and you’ll... never mind, too late.',win:'Was that it? I had a whole speech.',taunt:'I ran here from tomorrow.',ending:'Zip wins the tournament twice, by accident, on the same night.',
  specials:[
   special(0,{id:'zipline',name:'Zip Line',s:7,a:6,r:22,dmg:85,adv:[4,13,.3],ghost:[4,14],x1:.9,x0:-.9,anim:'dash',ex:{launch:[.0,.2],r:16}}),
   special(1,{id:'after',name:'Afterimage',s:13,a:0,r:1,dmg:0,x1:0,adv:[1,11,.2],ghost:[1,12],inv:[1,9],anim:'dash',cancel:[],free:9,ex:{free:6,inv:[1,12]}}),
   special(2,{id:'pinball',name:'Pinball',s:16,a:30,r:10,dmg:100,lv:'over',hop:[3,-.06,.2],dive:[16,.2,-.13],fall:1,y:[-.6,.9],x1:.85,kd:1,anim:'dive',cancel:[],ex:{launch:[.01,.2]}}),
   special(3,{id:'flurry',name:'Flurry Feet',s:6,a:24,r:14,dmg:20,hits:6,gap:4,adv:[6,30,.03],x1:1,anim:'kicks',ex:{hits:8,a:32,last:{launch:[.03,.2]}}})],
  super:superMove({id:'zoomies',name:'Sonic Zoomies',s:6,a:30,r:26,dmg:31,hits:10,gap:3,flip:1,inv:[1,10],x1:1.2,anim:'dash',last:{launch:[.03,.25]}}),
  fins:[fin('zoomies_fin','Dust Devil','FDF B','close','Runs circles until the circles become weather.'),fin('photo_finish','Photo Finish','DBF A','mid','One flash. The loser leaves as a souvenir photo.'),fin('lap_of_shame','Lap of Shame','FFB B','far','Runs all the way around the planet to land one punch.')]},
 {id:'duchess',name:'DUCHESS',title:'The Royal Pain',arche:'WEAPON',color:'#c78bff',hp:1000,walk:.048,scale:1.03,reach:1.28,weapon:'scepter',
  stats:{power:4,speed:2,reach:5,tricks:3},look:{coat:8,pattern:3,outfit:9,hat:5,glasses:7,neck:5,hue:275,accentHue:45,shoeHue:275,build:2,ears:1,tail:2,shoes:4,back:3,aura:0,finish:1,pose:1},
  bio:'Best in Show nine years running. Carries the golden bone scepter and is not afraid to use it on commoners.',
  intro:'You may bow now. It saves time.',win:'Dismissed.',taunt:'Do try to bleed charisma, dear. Oh. You haven’t any.',ending:'Duchess adds the trophy to the cabinet. It is the smallest one in there.',
  specials:[
   special(0,{id:'sweep',name:'Scepter Sweep',s:14,a:5,r:22,dmg:105,x1:2.35,kd:1,anim:'swing',ex:{launch:[.02,.2],dmg:120}}),
   special(1,{id:'court',name:'Court Is In Session',s:10,a:5,r:26,dmg:100,x1:1.6,y:[.3,2.8],launch:[.02,.23],jp:2,anim:'upswing',ex:{inv:[1,9],dmg:120}}),
   special(2,{id:'decree',name:'Royal Decree',s:14,a:1,r:24,dmg:0,x1:0,anim:'cast',proj:{k:'crown',vx:.13,y:1.3,dmg:55,hs:18,bs:12,life:84,hits:2,gap:20,ret:42},ex:{proj:{k:'crown',vx:.17,y:1.3,dmg:50,hs:20,bs:12,life:84,hits:3,gap:12,ret:42}}}),
   special(3,{id:'curtsy',name:'Curtsy',s:20,a:4,r:20,dmg:110,adv:[1,10,-.12],adv2:[11,20,.21],inv:[2,9],x1:1.85,push:.14,wall:1,anim:'thrust',ex:{hs:40,dmg:120}})],
  super:superMove({id:'coron',name:'Coronation',s:8,a:30,r:30,dmg:64,hits:5,gap:6,x1:2.3,inv:[1,8],anim:'upswing',last:{launch:[.03,.25]}}),
  fins:[fin('gold_standard','Gold Standard','DFD A','close','One tap of the scepter: solid gold, and worth every coin.'),fin('knighted','Knighted','BFF B','mid','Dubbed on both shoulders, then crowned. Heavily.'),fin('royal_flush','Royal Flush','FBB A','far','Down the royal drain with a very regal gurgle.')]},
 {id:'king',name:'KING KIBBLE',title:'The House',arche:'BOSS',color:'#ffcf3d',hp:1250,walk:.046,scale:1.34,ds:1,pow:1.15,reach:1.15,boss:1,
  stats:{power:5,speed:3,reach:4,tricks:4},look:{coat:9,pattern:0,outfit:2,hat:10,glasses:6,neck:7,hue:48,accentHue:48,shoeHue:48,build:2,ears:0,tail:2,shoes:4,back:3,aura:4,finish:2,pose:1},
  bio:'Owns the arcade, the building and, he will tell you, the night itself. The House has never lost at home.',
  intro:'Everybody plays. The House collects.',win:'Thank you for playing. Exit through the gift shop.',taunt:'Your credit is no good here.',ending:'The House pays out for the first time in history. King Kibble tips his crown, and asks for a rematch.',
  specials:[
   special(0,{id:'coins',name:'Coin Shower',s:16,a:1,r:24,dmg:0,x1:0,anim:'castup',proj:{k:'coin',vx:0,vy:-.13,y:4.4,dmg:45,hs:16,bs:10,life:60,n:3,at:'foe',lv:'over'},ex:{proj:{k:'coin',vx:0,vy:-.14,y:4.4,dmg:45,hs:18,bs:10,life:60,n:5,at:'foe',lv:'over'}}}),
   special(1,{id:'tilt',name:'Tilt',s:20,a:4,r:26,dmg:60,lv:'low',x1:14,x0:-14,y:[0,.2],kd:1,gnd:1,anim:'stomp',cancel:[],ex:{dmg:90,launch:[0,.18]}}),
   special(2,{id:'rules',name:'House Rules',lv:'throw',s:16,a:4,r:30,dmg:160,x1:1.2,tele:[10,'behind',.9],thr:54,launch:[.05,.17],anim:'grab',cancel:[],ex:{s:12,dmg:185}}),
   special(3,{id:'jackpot',name:'Jackpot Slam',s:16,a:30,r:14,dmg:125,lv:'over',hop:[4,.085,.21],fall:1,y:[-.6,1],x1:1,launch:[.01,.15],anim:'dive',cancel:[],ex:{armor:[1,40],dmg:145}})],
  super:superMove({id:'house',name:'The House Always Wins',s:12,a:1,r:44,dmg:0,anim:'beam',proj:{k:'beam',vx:0,dx:7.3,y:1.2,dmg:40,hits:8,gap:3,life:28,h:1,w:6.7,pierce:1,last:{launch:[.06,.2]}}}),
  fins:[fin('cashed_out','Cashed Out','DFD B','close','Converted to loose change and swept into the royal purse.'),fin('jackpot_fin','Jackpot','BFF A','mid','Fed into the slot machine. Three sevens. Everybody wins but one.'),fin('high_score','High Score','FBB B','far','Launched into the scoreboard. New record: K.K.')]},
 {id:'you',name:'YOUR DAWG',title:'The Contender',arche:'ALL-ROUNDER',color:'#b9ff5e',hp:1000,walk:.055,scale:1,own:1,
  stats:{power:3,speed:3,reach:3,tricks:3},look:null,
  bio:'Your own DAWG, straight from the kennel, with a street style that does a bit of everything.',
  intro:'Let’s make it a night to remember.',win:'Who’s a good DAWG? Me.',taunt:'Sit. Stay. Lose.',ending:'The whole district chants one name tonight. It’s yours.',
  specials:[
   special(0,{id:'fetch',name:'Fetch!',s:13,a:1,r:25,dmg:0,x1:0,anim:'cast',proj:{k:'ball',vx:.135,y:1.1,dmg:65,hs:18,bs:12,life:110},ex:{proj:{k:'ball',vx:.19,y:1.1,dmg:48,hs:20,bs:14,life:110,hits:2,kd:1}}}),
   special(1,{id:'tackle',name:'Zoomie Tackle',s:11,a:8,r:20,dmg:95,adv:[6,19,.13],push:.18,wall:1,kd:1,anim:'charge',ex:{armor:[1,19],dmg:110}}),
   special(2,{id:'roll',name:'Roll Over',s:10,a:10,r:16,dmg:70,lv:'low',adv:[3,20,.1],lowp:[3,20],kd:1,x1:.9,anim:'roll',crouch:1,cancel:[],ex:{launch:[.01,.18]}}),
   special(3,{id:'upper',name:'Good Boy Upper',s:5,a:8,r:30,dmg:105,inv:[1,6],y:[.3,2.8],x1:.9,launch:[.03,.24],jp:2,hop:[5,.03,.19],anim:'rise',ex:{dmg:135,inv:[1,10]}})],
  super:superMove({id:'best',name:'Best In Show',s:8,a:30,r:30,dmg:39,hits:8,gap:4,adv:[4,14,.15],inv:[1,9],anim:'flurry',last:{launch:[.05,.24]}}),
  fins:[fin('bath_time','Bath Time','DFD A','close','Scrubbed, rinsed and blow-dried into a perfect pom-pom.'),fin('walkies','Walkies','BFF B','mid','Tied to a hundred balloons and taken for a very long walk.'),fin('bad_dog','Bad Dog','FBB A','far','A rolled-up newspaper the size of a bus says: no.')]}
];

const levelY=m=>m.y||Y[m.lv]||Y.mid;
function finish(m,f){const out={push:.06,jp:1,x0:-.15,hits:1,gap:0,cancel:[],...m};out.y=levelY(out);
 if(out.kind!=='throw'&&out.lv!=='throw'){out.hs??=18;out.bs??=12;}out.chip??=out.kind==='special'||out.kind==='super'?Math.round(out.dmg*.12):0;return out;}
function build(raw){
 const ds=raw.ds||0,pow=raw.pow||1,reach=raw.reach||1,moves={};
 for(const [id,n]of Object.entries(NORMALS)){const m=finish({id,kind:'normal',push:.035,...n},raw);m.s=Math.max(3,m.s+ds);m.dmg=Math.round(m.dmg*pow);m.x1=+(m.x1*(/H$/.test(id)||id==='5LLL'?reach:Math.min(reach,1.1))*raw.scale).toFixed(3);if(raw.weapon&&/H$/.test(id)){m.s+=1;m.weapon=1;}moves[id]=m;}
 const add=m=>{const out=finish(m,raw);if(out.proj){out.proj={hs:18,bs:12,lv:'mid',w:.45,h:.45,hits:1,gap:8,...out.proj};}moves[out.id]=out;return out;};
 for(const sp of raw.specials){const {ex,...base}=sp;add(base);const e={...base,...ex,id:base.id+'+',name:'Amped '+base.name,ex:1,cost:100};if(ex?.proj)e.proj={...ex.proj};add(e);}
 for(const m of [...(raw.extra||[]),...(raw.extra2||[])])add(m);
 add(raw.super);
 const {specials,extra,extra2,super:sup,...rest}=raw;
 return {...rest,pow,ds,reach,moves,specials:specials.map(s=>s.id),super:sup.id};
}
export const FIGHTERS=RAW.map(build);
export const FIGHTER_IDS=FIGHTERS.map(f=>f.id);
export const fighter=id=>FIGHTERS.find(f=>f.id===id)||null;
// The eight on the select screen from the start, then the player's own DAWG; the boss is earned.
export const STARTERS=FIGHTER_IDS.filter(id=>id!=='king');

export const STAGES=[
 {id:'rooftop',name:'Neon Rooftop',place:'After Hours district, 40 floors up',mood:'Rain-slick roof under a wall of signs',hazard:{name:'Live Billboard',side:1,dmg:60},dive:fin('billboard_star','Billboard Star','UUD B','any','Punched into the billboard and left there as tonight’s advert.')},
 {id:'subway',name:'Platform Nine',place:'Bark Street station, last train',mood:'Tiled platform, flickering tubes, a train that waits for no one',hazard:{name:'Vending Machine',side:-1,dmg:55},dive:fin('last_train','Last Train','UUD B','any','Bundled through the doors of the last train home.')},
 {id:'arcade',name:'The Arcade Floor',place:'DAWG Arcade, after closing',mood:'Cabinets humming, carpet glowing, tokens everywhere',hazard:{name:'Token Machine',side:1,dmg:55},dive:fin('prize_claw','Prize Claw','UUD B','any','Picked up by the giant claw and dropped down the prize chute.')},
 {id:'market',name:'Night Market',place:'Bodega Alley, midnight',mood:'Lanterns, steam and a crowd that came for noodles and stayed for the fight',hazard:{name:'Noodle Cart',side:-1,dmg:60},dive:fin('noodle_bath','Noodle Bath','UUD B','any','Dropped into the big pot. Lid on. Slurp.')},
 {id:'docks',name:'Dawg Docks',place:'Pier 9, just before sunrise',mood:'Cranes, containers and gulls with opinions',hazard:{name:'Crate Stack',side:1,dmg:65},dive:fin('shipped','Shipped','UUD B','any','Lifted by the crane, packed in a container and sent overseas.')}
];
export const STAGE_IDS=STAGES.map(s=>s.id);
export const stageOf=id=>STAGES.find(s=>s.id===id)||null;
export const RUB=fin('belly_rub','Belly Rub','DDD A','any','No hard feelings: a belly rub, a treat and a new best friend.');

// Every finishing move with what kind it is and who owns it.
export const FINISHERS=[...FIGHTERS.flatMap(f=>f.fins.map((x,i)=>({...x,kind:'curtain',owner:f.id,slot:i}))),...STAGES.map(s=>({...s.dive,kind:'dive',stage:s.id})),{...RUB,kind:'rub'}];
export const finisher=id=>FINISHERS.find(f=>f.id===id)||null;
export const FINISHER_IDS=FINISHERS.map(f=>f.id);
// The finishers one fighter can perform on one stage, in input-slot order.
export const finishersFor=(fid,stage)=>[...FINISHERS.filter(f=>f.owner===fid),...FINISHERS.filter(f=>f.kind==='dive'&&f.stage===stage),FINISHERS.find(f=>f.kind==='rub')];
// Easy inputs for a finisher (simple mode): a direction with SPECIAL, or GUARD + SPECIAL.
export const easyInput=f=>f.kind==='rub'?'GUARD + SPECIAL':f.kind==='dive'?'↑ + SPECIAL':['↓ + SPECIAL','→ + SPECIAL','← + SPECIAL'][f.slot];
const ARROW={F:'→',B:'←',D:'↓',U:'↑'};
export const seqText=f=>{const [dirs,b]=f.seq.split(' ');return [...dirs].map(d=>ARROW[d]).join(' ')+' + '+BTN_NAME[b];};
export const RANGE_TEXT={close:'up close',mid:'a few steps away',far:'from across the stage',any:'anywhere'};

// The tower: seven rivals, then the House. Difficulty climbs 1 → 5.
export const TOWER=[{lvl:1},{lvl:1},{lvl:2},{lvl:2},{lvl:3},{lvl:3},{lvl:4},{lvl:5,boss:'king',stage:'arcade'}];
export const DIFFICULTY=[{id:1,name:'PUP',text:'Telegraphs everything'},{id:2,name:'SCRAPPER',text:'Blocks sometimes, punishes rarely'},{id:3,name:'CONTENDER',text:'Real combos, real defence'},{id:4,name:'TOP DAWG',text:'Reads your habits'},{id:5,name:'ALPHA',text:'Punishes everything'}];
export const MODS=[{id:'moon',name:'Moon Gravity',text:'Everyone floats: juggles last longer'},{id:'glass',name:'Glass Jaws',text:'Every hit does half as much again'},{id:'amped',name:'Full Howl',text:'Howl meter fills three times as fast'},{id:'sudden',name:'Sudden Bark',text:'One round. Half health. No second chances'},{id:'vampire',name:'Leech',text:'Landing a hit heals you'},{id:'iron',name:'Iron Guard',text:'Blocking costs nothing: open them up or throw'}];
export const MOD_IDS=MODS.map(m=>m.id);

// Three combo trials per fighter for training mode: each is a list of move ids that must land in one combo.
export function trialsFor(f){const sp=f.specials,m=f.moves,strike=sp.find(id=>m[id].dmg>0&&m[id].lv!=='throw'&&!m[id].fall&&!m[id].hop)||null,list=[{id:f.id+'.t1',name:'One-Two-Hook',moves:['5L','5LL','5LLL']}];
 list.push(strike?{id:f.id+'.t2',name:'Cancel It',moves:['5L','5LL',strike]}:{id:f.id+'.t2',name:'Low Then High',moves:['2L','5LL','5H']});
 list.push({id:f.id+'.t3',name:'Air Mail',moves:['2H','5L','5H']});return list;}
