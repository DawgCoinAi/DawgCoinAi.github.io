// DAWG Chess: the full rules of chess. Board squares run 0 (a8) to 63 (h1), as FEN reads them;
// white pieces are upper case (PNBRQK), black lower case. Moves are generated pseudo-legally and
// kept when they don't leave the mover's king in check. Covers castling, en passant, promotion,
// check, checkmate, stalemate, the fifty-move rule, threefold repetition and dead positions.
export const START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FILES='abcdefgh';
export const sqName=i=>FILES[i&7]+(8-(i>>3));
export const sqIndex=n=>FILES.indexOf(n[0])+(8-Number(n[1]))*8;
export const colorOf=p=>p?(p===p.toUpperCase()?'w':'b'):null;
const KNIGHT=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]],KING=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const ROOK=[[-1,0],[1,0],[0,-1],[0,1]],BISHOP=[[-1,-1],[-1,1],[1,-1],[1,1]];
const at=(r,f)=>r>=0&&r<8&&f>=0&&f<8?r*8+f:-1;

export class Chess {
 constructor(fen=START){this.load(fen);}
 load(fen){const [b,t,c,e,h,f]=fen.trim().split(/\s+/);this.board=new Array(64).fill(null);let i=0;
  for(const ch of b){if(ch==='/')continue;if(/\d/.test(ch))i+=Number(ch);else this.board[i++]=ch;}
  if(i!==64)throw new Error('bad FEN');this.turn=t==='b'?'b':'w';this.castling=c&&c!=='-'?c:'';this.ep=e&&e!=='-'?sqIndex(e):-1;this.half=Number(h)||0;this.full=Number(f)||1;
  this.history=[];this.keys=[this.key()];}
 fen(){let s='';for(let r=0;r<8;r++){let n=0;for(let f=0;f<8;f++){const p=this.board[r*8+f];if(!p)n++;else{if(n)s+=n;n=0;s+=p;}}if(n)s+=n;if(r<7)s+='/';}
  return `${s} ${this.turn} ${this.castling||'-'} ${this.ep>=0?sqName(this.ep):'-'} ${this.half} ${this.full}`;}
 // Position identity for repetition: placement, side, castling and a capturable en-passant square.
 key(){const f=this.fen().split(' ');const ep=this.ep>=0&&this.pseudo(this.turn).some(m=>m.flag==='e')?f[3]:'-';return f[0]+' '+f[1]+' '+f[2]+' '+ep;}
 king(c){return this.board.indexOf(c==='w'?'K':'k');}
 // Is square s attacked by colour c?
 attacked(s,c){const r=s>>3,f=s&7,b=this.board,own=p=>p&&colorOf(p)===c,is=(p,t)=>own(p)&&p.toLowerCase()===t;
  const dir=c==='w'?1:-1;for(const df of [-1,1]){const q=at(r+dir,f+df);if(q>=0&&is(b[q],'p'))return true;}
  for(const [dr,df] of KNIGHT){const q=at(r+dr,f+df);if(q>=0&&is(b[q],'n'))return true;}
  for(const [dr,df] of KING){const q=at(r+dr,f+df);if(q>=0&&is(b[q],'k'))return true;}
  for(const [lines,t] of [[ROOK,'r'],[BISHOP,'b']])for(const [dr,df] of lines){let rr=r+dr,ff=f+df;while(rr>=0&&rr<8&&ff>=0&&ff<8){const p=b[rr*8+ff];if(p){if(own(p)&&(p.toLowerCase()===t||p.toLowerCase()==='q'))return true;break;}rr+=dr;ff+=df;}}
  return false;}
 inCheck(c=this.turn){const k=this.king(c);return k>=0&&this.attacked(k,c==='w'?'b':'w');}
 pseudo(c){const out=[],b=this.board,them=c==='w'?'b':'w';
  for(let s=0;s<64;s++){const p=b[s];if(!p||colorOf(p)!==c)continue;const t=p.toLowerCase(),r=s>>3,f=s&7;
   const add=(to,flag='')=>{const cap=b[to];if(t==='p'&&(to>>3===0||to>>3===7)){for(const pr of 'qrbn')out.push({from:s,to,piece:p,captured:cap,promo:c==='w'?pr.toUpperCase():pr,flag:flag||'p'});}else out.push({from:s,to,piece:p,captured:cap,flag});};
   if(t==='p'){const dir=c==='w'?-1:1,start=c==='w'?6:1,one=at(r+dir,f);
    if(one>=0&&!b[one]){add(one);const two=at(r+2*dir,f);if(r===start&&!b[two])add(two,'d');}
    for(const df of [-1,1]){const q=at(r+dir,f+df);if(q<0)continue;if(b[q]&&colorOf(b[q])===them)add(q);else if(q===this.ep)out.push({from:s,to:q,piece:p,captured:c==='w'?'p':'P',flag:'e'});}}
   else if(t==='n'||t==='k'){for(const [dr,df] of t==='n'?KNIGHT:KING){const q=at(r+dr,f+df);if(q>=0&&colorOf(b[q])!==c)add(q);}
    if(t==='k'){const home=c==='w'?60:4,[K,Q]=c==='w'?['K','Q']:['k','q'];
     if(s===home&&!this.attacked(home,them)){
      if(this.castling.includes(K)&&!b[home+1]&&!b[home+2]&&b[home+3]===(c==='w'?'R':'r')&&!this.attacked(home+1,them)&&!this.attacked(home+2,them))out.push({from:s,to:home+2,piece:p,captured:null,flag:'k'});
      if(this.castling.includes(Q)&&!b[home-1]&&!b[home-2]&&!b[home-3]&&b[home-4]===(c==='w'?'R':'r')&&!this.attacked(home-1,them)&&!this.attacked(home-2,them))out.push({from:s,to:home-2,piece:p,captured:null,flag:'q'});}}}
   else for(const [dr,df] of t==='r'?ROOK:t==='b'?BISHOP:[...ROOK,...BISHOP]){let rr=r+dr,ff=f+df;while(rr>=0&&rr<8&&ff>=0&&ff<8){const q=rr*8+ff;if(b[q]){if(colorOf(b[q])===them)add(q);break;}add(q);rr+=dr;ff+=df;}}}
  return out;}
 // Plays a move with no legality check; returns what undo needs.
 make(m){const b=this.board,c=this.turn,undo={m,castling:this.castling,ep:this.ep,half:this.half,full:this.full};
  b[m.to]=m.promo||m.piece;b[m.from]=null;
  if(m.flag==='e')b[m.to+(c==='w'?8:-8)]=null;
  if(m.flag==='k'){b[m.to-1]=b[m.to+1];b[m.to+1]=null;}if(m.flag==='q'){b[m.to+1]=b[m.to-2];b[m.to-2]=null;}
  let cr=this.castling;const strip=(sq)=>{if(sq===60)cr=cr.replace(/[KQ]/g,'');if(sq===4)cr=cr.replace(/[kq]/g,'');if(sq===63)cr=cr.replace('K','');if(sq===56)cr=cr.replace('Q','');if(sq===7)cr=cr.replace('k','');if(sq===0)cr=cr.replace('q','');};strip(m.from);strip(m.to);this.castling=cr;
  this.ep=m.flag==='d'?(m.from+m.to)/2:-1;this.half=m.piece.toLowerCase()==='p'||m.captured?0:this.half+1;if(c==='b')this.full++;this.turn=c==='w'?'b':'w';return undo;}
 unmake(u){const b=this.board,m=u.m;this.turn=this.turn==='w'?'b':'w';const c=this.turn;b[m.from]=m.piece;b[m.to]=m.flag==='e'?null:m.captured;
  if(m.flag==='e')b[m.to+(c==='w'?8:-8)]=m.captured;if(m.flag==='k'){b[m.to+1]=b[m.to-1];b[m.to-1]=null;}if(m.flag==='q'){b[m.to-2]=b[m.to+1];b[m.to+1]=null;}
  this.castling=u.castling;this.ep=u.ep;this.half=u.half;this.full=u.full;}
 moves(c=this.turn){const legal=[];for(const m of this.pseudo(c)){const u=this.make(m);if(!this.inCheck(c))legal.push(m);this.unmake(u);}return legal;}
 movesFrom(s){return this.moves().filter(m=>m.from===s);}
 // Standard algebraic notation for a legal move in this position (before it is played).
 san(m){const t=m.piece.toLowerCase();let s;
  if(m.flag==='k')s='O-O';else if(m.flag==='q')s='O-O-O';
  else{const cap=m.captured||m.flag==='e';if(t==='p')s=(cap?FILES[m.from&7]+'x':'')+sqName(m.to)+(m.promo?'='+m.promo.toUpperCase():'');
   else{const others=this.moves().filter(o=>o.to===m.to&&o.piece===m.piece&&o.from!==m.from);let dis='';if(others.length){const sameFile=others.some(o=>(o.from&7)===(m.from&7)),sameRank=others.some(o=>(o.from>>3)===(m.from>>3));dis=!sameFile?FILES[m.from&7]:!sameRank?String(8-(m.from>>3)):sqName(m.from);}
    s=t.toUpperCase()+dis+(cap?'x':'')+sqName(m.to);}}
  const u=this.make(m),check=this.inCheck(),mate=check&&this.moves().length===0;this.unmake(u);return s+(mate?'#':check?'+':'');}
 // Plays a legal move by {from, to, promo?} and records it; returns the full move, or null.
 play({from,to,promo}){const m=this.moves().find(x=>x.from===from&&x.to===to&&(!x.promo||x.promo.toLowerCase()===(promo||'q').toLowerCase()));if(!m)return null;
  const san=this.san(m),u=this.make(m);this.history.push({...u,san});this.keys.push(this.key());return {...m,san};}
 takeBack(){const h=this.history.pop();if(!h)return null;this.keys.pop();this.unmake(h);return h.m;}
 insufficient(){const rest=this.board.filter(p=>p&&p.toLowerCase()!=='k');if(!rest.length)return true;if(rest.length===1&&'nb'.includes(rest[0].toLowerCase()))return true;
  if(rest.every(p=>p.toLowerCase()==='b')){const colors=new Set();this.board.forEach((p,i)=>{if(p&&p.toLowerCase()==='b')colors.add(((i>>3)+(i&7))%2);});return colors.size===1;}return false;}
 // 'playing', 'checkmate', 'stalemate', 'fifty', 'repetition' or 'material'.
 status(){if(!this.moves().length)return this.inCheck()?'checkmate':'stalemate';if(this.half>=100)return 'fifty';const k=this.keys.at(-1);if(this.keys.filter(x=>x===k).length>=3)return 'repetition';if(this.insufficient())return 'material';return 'playing';}
 // For saves: the starting position and the moves since, which rebuilds everything exactly.
 save(start){return {start,moves:this.history.map(h=>sqName(h.m.from)+sqName(h.m.to)+(h.m.promo?h.m.promo.toLowerCase():''))};}
 static restore(s){if(!s||typeof s.start!=='string'||!Array.isArray(s.moves)||s.moves.length>1200)return null;try{const c=new Chess(s.start);for(const mv of s.moves){if(typeof mv!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(mv))return null;if(!c.play({from:sqIndex(mv.slice(0,2)),to:sqIndex(mv.slice(2,4)),promo:mv[4]}))return null;}return c;}catch{return null;}}
}
// Counts leaf positions to a depth: the standard check that move generation is exactly right.
export function perft(c,depth){if(depth===0)return 1;let n=0;for(const m of c.moves()){const u=c.make(m);n+=depth===1?1:perft(c,depth-1);c.unmake(u);}return n;}
