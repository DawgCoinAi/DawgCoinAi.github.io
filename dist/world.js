import {seededRandom} from './mobile-core.js';
export {seededRandom};
export const WEATHER=['Clear skies','Neon rain','Harbor fog','Golden dusk','Electric night'];
export const PALETTES=[{sky:'#0c1533',glow:'#a684ef',accent:'#7be1d2',floor:'#192e43'},{sky:'#28162f',glow:'#ef91b6',accent:'#ffd48c',floor:'#3c2a40'},{sky:'#10272d',glow:'#70cfb0',accent:'#c9ef91',floor:'#193c40'},{sky:'#201735',glow:'#ce9eec',accent:'#85c6f4',floor:'#2c2849'},{sky:'#25203b',glow:'#f2b180',accent:'#efda9a',floor:'#34354d'}];
let counter=0;
export function freshSeed(){
 // A stored counter mixes fresh run seeds; resuming always uses the saved seed.
 let n;try{n=(Number(localStorage.getItem('dawg-world-counter'))||Date.now())+1;localStorage.setItem('dawg-world-counter',String(n));}catch{counter=Math.max(Date.now(),counter+1);n=counter;}
 let x=n>>>0;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)||1;
}
export function hash(seed,index=0){let n=(seed+Math.imul(index+1,0x9e3779b9))>>>0;n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);return ((n^(n>>>15))>>>0)/4294967296;}
export const pick=(random,items)=>items[Math.floor(random()*items.length)];
export function shuffle(random,items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function worldLook(seed=0,stage=0){const n=Math.floor(hash(seed,stage)*PALETTES.length);return {...PALETTES[n],weather:Math.floor(hash(seed,stage+501)*WEATHER.length),label:pick(seededRandom(seed+stage),['Velvet','Jade','Lunar','Sunset','Electric','Midnight'])+' '+pick(seededRandom(seed+stage+77),['Heights','Quarter','Gardens','Harbor','Avenue','District']),code:(seed>>>0).toString(36).toUpperCase()};}
export function proceduralMaze(seed,level=1){
 const random=seededRandom((seed+Math.imul(level,7919))>>>0),rows=Array.from({length:23},()=>Array(21).fill('#')),stack=[[1,1]];rows[1][1]='.';
 while(stack.length){const [x,y]=stack.at(-1),next=shuffle(random,[[2,0],[-2,0],[0,2],[0,-2]]).find(([dx,dy])=>x+dx>0&&x+dx<20&&y+dy>0&&y+dy<22&&rows[y+dy][x+dx]==='#');if(!next){stack.pop();continue;}const[dx,dy]=next;rows[y+dy/2][x+dx/2]='.';rows[y+dy][x+dx]='.';stack.push([x+dx,y+dy]);}
 // Add loops rather than walls: connectivity and legal spawn exits are preserved.
 for(let y=1;y<22;y++)for(let x=1;x<20;x++)if(rows[y][x]==='#'&&((rows[y][x-1]==='.'&&rows[y][x+1]==='.')||(rows[y-1][x]==='.'&&rows[y+1][x]==='.'))&&random()<.32)rows[y][x]='.';
 for(const [x,y]of [[10,15],[9,15],[11,15],[10,9],[9,11],[11,11],[10,5]])rows[y][x]='.';
 rows[15][10]=' ';
 for(const [xa,xb,ya,yb]of [[1,9,1,9],[11,19,1,9],[1,9,13,21],[11,19,13,21]]){const p=[];for(let y=ya;y<=yb;y++)for(let x=xa;x<=xb;x++)if(rows[y][x]==='.')p.push([x,y]);const [x,y]=pick(random,p);rows[y][x]='o';}
 return rows.map(r=>r.join(''));
}
export function reachableGrid(width,height,blocked,start){const key=p=>p.x+','+p.y,seen=new Set([key(start)]),q=[start];for(let i=0;i<q.length;i++){const p=q[i];for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,y:p.y+dy},k=key(n);if(n.x>=0&&n.x<width&&n.y>=0&&n.y<height&&!blocked.has(k)&&!seen.has(k)){seen.add(k);q.push(n);}}}return seen;}
export function snakeGarden(seed){if(!seed)return [];const random=seededRandom(seed^0x5eed),rocks=[],occupied=new Set();for(let tries=0;tries<100&&rocks.length<8+seed%9;tries++){const p={x:1+Math.floor(random()*13),y:1+Math.floor(random()*16)},k=p.x+','+p.y;if(p.x>=3&&p.x<=11&&p.y>=6&&p.y<=12||occupied.has(k))continue;occupied.add(k);if(reachableGrid(15,18,occupied,{x:7,y:9}).size===270-occupied.size)rocks.push(p);else occupied.delete(k);}return rocks;}
