export const isTimed=mode=>mode==='rush'||mode==='daily';
export function mobileLayout(width,height,safe={}){
 const top=Math.max(0,safe.top||0),bottom=Math.max(0,safe.bottom||0),left=Math.max(0,safe.left||0),right=Math.max(0,safe.right||0);
 const innerWidth=Math.max(1,width-left-right-16),innerHeight=Math.max(1,height-top-bottom-16);
 const landscape=width>height*1.2&&width>=560;
 const header=48,controls=144,gap=8,chrome=landscape?2:50;
 const availableWidth=landscape?innerWidth-2*controls-24:innerWidth;
 const availableHeight=innerHeight-header-chrome-(landscape?gap:controls+gap*2);
 const boardWidth=Math.max(1,Math.floor(Math.min(600,availableWidth-2,availableHeight*504/552)));
 const boardHeight=boardWidth*552/504;
 return{landscape,boardWidth,boardHeight,cabinetWidth:boardWidth+2,cabinetHeight:boardHeight+chrome,header,controls,gap,top,bottom,left,right,
  totalHeight:16+top+bottom+header+(landscape?Math.max(controls,boardHeight+chrome)+gap:boardHeight+chrome+controls+gap*2)};
}
export function stickDirection(dx,dy,previous=null,deadzone=12){
 if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.hypot(dx,dy)<deadzone)return null;
 const ax=Math.abs(dx),ay=Math.abs(dy);
 if(previous==='left'||previous==='right'){if(ax>=deadzone&&ay<ax*1.18)return dx>0?'right':'left';}
 if(previous==='up'||previous==='down'){if(ay>=deadzone&&ax<ay*1.18)return dy>0?'down':'up';}
 return ax>ay?dx>0?'right':'left':dy>0?'down':'up';
}
export function clampStick(dx,dy,radius=38){const n=Math.hypot(dx,dy);return n>radius?{x:dx/n*radius,y:dy/n*radius}:{x:dx,y:dy};}
export function localDay(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function seededRandom(seed){let a=seed>>>0;const next=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};next.getState=()=>a;next.setState=n=>{a=n>>>0;};return next;}
export function dailyChallenge(day=localDay()){
 let seed=2166136261;for(const c of 'DAWG-V3-'+day)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
 const variants=[{name:'Gold Rush',description:'Gold bags pay 50% more. Follow the money.',lootMultiplier:1.5,dashRecharge:6,rivalSpeed:1},
  {name:'Street Rocket',description:'Dash recharges in 4 seconds. Keep moving.',lootMultiplier:1,dashRecharge:4,rivalSpeed:1},
  {name:'Hot Pursuit',description:'Rivals move 12% faster. Outrun the heat.',lootMultiplier:1,dashRecharge:6,rivalSpeed:1.12}];
 return{...variants[seed%3],day,seed,startLevel:1+(Math.floor(seed/3)%3),targets:[800,1600,2800]};
}
export function medalFor(score,targets=[800,1600,2800]){return score>=targets[2]?3:score>=targets[1]?2:score>=targets[0]?1:0;}
export function dailyResult(previous,score,targets){
 const best=Math.max(previous?.best||0,Math.max(0,Math.floor(score))),medal=medalFor(best,targets),claimed=Math.min(3,Math.max(0,previous?.claimed||0));
 const rewards=[0,100,150,250];let reward=0;for(let i=claimed+1;i<=medal;i++)reward+=rewards[i];
 return{record:{best,medal,claimed:Math.max(claimed,medal),runs:(previous?.runs||0)+1},reward};
}
export function advanceGame(game,elapsed){
 if(!Number.isFinite(elapsed)||elapsed<=0||game.status!=='playing')return;
 if(elapsed>.35){game.pause();game.events.push({type:'interrupted'});return;}
 let remaining=elapsed;while(remaining>1e-9&&game.status==='playing'){const step=Math.min(1/60,remaining);game.tick(step);remaining-=step;}
}
