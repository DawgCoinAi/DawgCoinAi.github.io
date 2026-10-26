// Runs the DAWG Chess opponent off the main thread, so the board keeps animating while it thinks.
import {rivalMove,hintMove} from './chess-ai.js';
self.onmessage=e=>{const {id,kind,fen,rival}=e.data||{};try{const move=kind==='hint'?hintMove(fen):rivalMove(fen,rival);self.postMessage({id,move});}catch(err){self.postMessage({id,error:String(err?.message||err)});}};
