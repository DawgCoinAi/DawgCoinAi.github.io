// Original DAWG Chess pieces, sculpted from primitives: every piece is a DAWG character on a
// lit pedestal. Pawn: a helmeted pup soldier. Knight: a war hound's head. Bishop: a hooded oracle
// with a mitre and staff. Rook: a fortified doghouse keep. Queen: a long-eared duchess in a gown
// with a tiara. King: a caped alpha whose crown is topped with a bone. Each model comes back as
// geometry merged per material slot (body, trim, glow, dark), so a piece costs four draw calls.
// Models face +z; the board turns them toward the other side.
import {T,merge} from './three-kit.js';

const tf=(g,{s=[1,1,1],r=[0,0,0],p=[0,0,0]}={})=>{g.scale(...s);g.rotateX(r[0]);g.rotateY(r[1]);g.rotateZ(r[2]);g.translate(...p);return g;};
const sphere=(r,o,seg=20)=>tf(new T.SphereGeometry(r,seg,Math.round(seg*.7)),o);
const cyl=(a,b,h,o,seg=24)=>tf(new T.CylinderGeometry(a,b,h,seg),o);
const cone=(r,h,o,seg=16)=>tf(new T.ConeGeometry(r,h,seg),o);
const box=(w,h,d,o)=>tf(new T.BoxGeometry(w,h,d),o);
const torus=(R,r,o,seg=32)=>tf(new T.TorusGeometry(R,r,8,seg),o);
const lathe=(pts,o,seg=36)=>tf(new T.LatheGeometry(pts.map(([x,y])=>new T.Vector2(x,y)),seg),o);
// A bone, lying along x: the DAWG emblem on crowns and keeps.
const bone=(len,o)=>{const k=len*.16,parts=[cyl(k*.7,k*.7,len,{r:[0,0,Math.PI/2]},10)];for(const sx of [-1,1])for(const sy of [-1,1])parts.push(sphere(k,{p:[sx*len/2,sy*k*.7,0]},10));return parts.map(g=>tf(g,o));};

// The shared pedestal: a stepped base with a glowing team ring.
function pedestal(m,r=.34){m.body.push(lathe([[0,0],[r,0],[r,.05],[r-.04,.08],[r-.06,.12],[r-.1,.14],[0,.14]]));m.glow.push(torus(r-.02,.018,{r:[Math.PI/2,0,0],p:[0,.06,0]}));m.trim.push(torus(r-.1,.012,{r:[Math.PI/2,0,0],p:[0,.14,0]}));return .14;}
// A DAWG head at height y: skull, muzzle, nose, glowing eyes and ears (floppy, pointy or long).
function head(m,y,s,{ears='floppy',brow=false}={}){
 m.body.push(sphere(.17*s,{s:[1,.92,1],p:[0,y,0]}),sphere(.1*s,{s:[1,.8,1.25],p:[0,y-.05*s,.13*s]}));m.dark.push(sphere(.035*s,{p:[0,y-.02*s,.25*s]},10));
 for(const x of [-1,1]){m.glow.push(sphere(.028*s,{p:[x*.075*s,y+.04*s,.135*s]},10));
  if(ears==='floppy')m.body.push(sphere(.07*s,{s:[.55,1.4,.9],r:[0,0,x*.35],p:[x*.17*s,y-.04*s,-.01*s]}));
  if(ears==='pointy')m.body.push(cone(.07*s,.2*s,{r:[0,0,-x*.35],p:[x*.11*s,y+.2*s,-.02*s]},8));
  if(ears==='long')m.body.push(sphere(.06*s,{s:[.55,2.1,.8],r:[0,0,x*.2],p:[x*.16*s,y-.1*s,-.03*s]}));}
 if(brow)m.trim.push(box(.26*s,.03*s,.05*s,{p:[0,y+.085*s,.12*s],r:[-.25,0,0]}));return y+.17*s;}

const BUILD={
 // Pawn: a pup soldier with a round helmet and a little shield.
 p(m){const b=pedestal(m,.3);m.body.push(lathe([[0,0],[.16,0],[.15,.08],[.11,.2],[.12,.24],[0,.25]],{p:[0,b,0]}));m.trim.push(torus(.12,.02,{r:[Math.PI/2,0,0],p:[0,b+.22,0]}));
  const top=head(m,b+.38,.82,{ears:'floppy'});m.trim.push(sphere(.15,{s:[1,.7,1],p:[0,b+.43,-.01]},16));m.trim.push(cyl(.012,.012,.08,{p:[0,b+.55,-.01]},6));m.glow.push(sphere(.025,{p:[0,b+.6,-.01]},8));
  m.trim.push(cyl(.09,.09,.02,{r:[Math.PI/2,0,0],p:[.13,b+.14,.08]},18));m.glow.push(sphere(.02,{p:[.13,b+.14,.095]},8));return top;},
 // Knight: a war hound's head rearing from a plated neck, mane spikes down the back.
 n(m){const b=pedestal(m);m.body.push(lathe([[0,0],[.2,0],[.17,.12],[.13,.3],[0,.32]],{p:[0,b,0]}));
  m.body.push(cyl(.1,.13,.32,{r:[.45,0,0],p:[0,b+.42,-.03]}));m.trim.push(torus(.125,.022,{r:[Math.PI/2-.45,0,0],p:[0,b+.33,-.06]}));
  const s=1.25,y=b+.66;m.body.push(sphere(.17*s,{s:[1,.95,1.05],p:[0,y,0]}),sphere(.11*s,{s:[1,.85,1.6],p:[0,y-.06,.2]}));m.dark.push(sphere(.045,{p:[0,y-.02,.37]},10),box(.16,.025,.12,{p:[0,y-.13,.24]}));
  for(const x of [-1,1]){m.glow.push(sphere(.035,{s:[1.3,.8,1],p:[x*.1,y+.06,.16]},10));m.body.push(cone(.08,.26,{r:[-.2,0,-x*.3],p:[x*.13,y+.25,-.04]},8));m.trim.push(cone(.022,.07,{r:[Math.PI,0,0],p:[x*.06,y-.12,.3]},6));}
  for(let i=0;i<4;i++)m.trim.push(cone(.04,.14,{r:[-.9,0,0],p:[0,y+.12-i*.1,-.2-i*.03]},6));m.trim.push(box(.24,.035,.06,{p:[0,y+.1,.15],r:[-.3,0,0]}));return y+.3;},
 // Bishop: a hooded oracle in robes, with a notched mitre and a staff topped with a glowing orb.
 b(m){const b=pedestal(m);m.body.push(lathe([[0,0],[.22,0],[.2,.1],[.15,.3],[.12,.46],[.1,.5],[0,.5]],{p:[0,b,0]}));m.trim.push(torus(.17,.016,{r:[Math.PI/2,0,0],p:[0,b+.12,0]}),box(.03,.32,.02,{p:[0,b+.28,.15],r:[-.15,0,0]}));
  m.body.push(sphere(.2,{s:[1,1.05,1],p:[0,b+.6,-.03]},18));const y=b+.66;head(m,y,.78,{ears:'floppy'});
  m.body.push(lathe([[0,0],[.13,0],[.13,.05],[.09,.22],[0,.3]],{p:[0,y+.1,-.02]}));m.dark.push(box(.03,.12,.27,{p:[0,y+.32,-.02],r:[.5,0,0]}));m.trim.push(torus(.13,.014,{r:[Math.PI/2,0,0],p:[0,y+.12,-.02]}));
  m.trim.push(cyl(.012,.012,.85,{p:[.24,b+.42,.05]},8),torus(.04,.01,{p:[.24,b+.85,.05]},16));m.glow.push(sphere(.055,{p:[.24,b+.9,.05]},14));return y+.42;},
 // Rook: a doghouse keep, a round tower with battlements, an arched door and a bone over it.
 r(m){const b=pedestal(m,.36);m.body.push(cyl(.25,.28,.5,{p:[0,b+.25,0]},28),cyl(.3,.27,.1,{p:[0,b+.55,0]},28));
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;m.body.push(box(.1,.12,.08,{r:[0,-a,0],p:[Math.sin(a)*.26,b+.66,Math.cos(a)*.26]}));}
  m.dark.push(cyl(.09,.09,.04,{r:[Math.PI/2,0,0],p:[0,b+.18,.26]},18),box(.18,.18,.04,{p:[0,b+.09,.26]}));m.trim.push(torus(.1,.015,{p:[0,b+.18,.275]},20));
  m.trim.push(...bone(.24,{p:[0,b+.38,.27]}));m.glow.push(box(.04,.07,.02,{p:[-.13,b+.42,.235],r:[0,-.5,0]}),box(.04,.07,.02,{p:[.13,b+.42,.235],r:[0,.5,0]}));
  for(const y of [.06,.47])m.trim.push(torus(.27,.012,{r:[Math.PI/2,0,0],p:[0,b+y,0]},32));return b+.72;},
 // Queen: a long-eared duchess in a flared gown with a pearl collar and a tiara.
 q(m){const b=pedestal(m,.35);m.body.push(lathe([[0,0],[.28,0],[.26,.06],[.18,.22],[.12,.42],[.1,.56],[.13,.62],[0,.63]],{p:[0,b,0]}));
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2;m.trim.push(sphere(.024,{p:[Math.sin(a)*.12,b+.6,Math.cos(a)*.12]},8));}
  const y=b+.8;head(m,y,.92,{ears:'long'});m.trim.push(torus(.12,.014,{r:[Math.PI/2,0,0],p:[0,y+.13,-.01]}));
  for(let i=0;i<7;i++){const a=(i/6-.5)*2.1;m.trim.push(cone(.022,.09+(i===3?.05:0),{p:[Math.sin(a)*.12,y+.18+(i===3?.025:0),Math.cos(a)*.12-.02]},6));}m.glow.push(sphere(.032,{p:[0,y+.2,.11]},10));
  m.trim.push(torus(.27,.012,{r:[Math.PI/2,0,0],p:[0,b+.06,0]}));return y+.3;},
 // King: a broad, caped alpha with a crown of points and a bone across the top.
 k(m){const b=pedestal(m,.36);m.body.push(lathe([[0,0],[.26,0],[.24,.1],[.2,.32],[.17,.5],[.2,.58],[0,.6]],{p:[0,b,0]}));
  m.dark.push(lathe([[0,0],[.29,0],[.27,.2],[.22,.45],[.2,.58],[0,.6]],{s:[1,1,.7],p:[0,b,-.06]},28));m.trim.push(torus(.2,.025,{r:[Math.PI/2,0,0],p:[0,b+.58,0]}),sphere(.04,{p:[0,b+.5,.19]},10));
  const y=b+.78;head(m,y,1.05,{ears:'pointy',brow:true});m.trim.push(cyl(.15,.13,.1,{p:[0,y+.17,-.01]},24));
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;m.trim.push(cone(.03,.09,{p:[Math.sin(a)*.14,y+.26,Math.cos(a)*.14-.01]},6));}
  m.trim.push(...bone(.22,{p:[0,y+.36,-.01]}));m.glow.push(sphere(.03,{p:[0,y+.17,.14]},10));return y+.44;}};

// Builds a piece type's merged geometry, one per material slot, plus its height.
export function pieceModel(t){const m={body:[],trim:[],glow:[],dark:[]};const height=BUILD[t](m);const out={height};for(const k in m)out[k]=m[k].length?merge(m[k]):null;return out;}
export const PIECE_TYPES='pnbrqk';
