// Touch controls for Turbo Pup on the game board: swipe to change lane, jump or roll, tap to jump,
// press and hold to burn turbo. A second thumb can swipe while the first one holds.
export function bindTurboTouch(board,pack){
 const down=new Map(),HOLD_MS=190,SWIPE=22,on=()=>pack.kind==='turbo';
 const end=e=>{const p=down.get(e.pointerId);if(!p)return;down.delete(e.pointerId);clearTimeout(p.timer);if(p.hold){if(![...down.values()].some(o=>o.hold))pack.flip('boost',false);}else if(!p.moved&&e.type==='pointerup'&&on())pack.input('up');};
 board.addEventListener('pointerdown',e=>{if(!on())return;const p={x:e.clientX,y:e.clientY,moved:false,hold:false,timer:0};down.set(e.pointerId,p);
  p.timer=setTimeout(()=>{if(down.get(e.pointerId)!==p||p.moved||!on()||pack.game?.status!=='playing')return;p.hold=true;pack.flip('boost',true);},HOLD_MS);});
 board.addEventListener('pointermove',e=>{const p=down.get(e.pointerId);if(!p||!on())return;const x=e.clientX-p.x,y=e.clientY-p.y;if(Math.max(Math.abs(x),Math.abs(y))<SWIPE)return;p.moved=true;clearTimeout(p.timer);p.x=e.clientX;p.y=e.clientY;pack.input(Math.abs(x)>Math.abs(y)?x>0?'right':'left':y>0?'down':'up');});
 for(const t of ['pointerup','pointercancel','lostpointercapture'])board.addEventListener(t,end);
}
