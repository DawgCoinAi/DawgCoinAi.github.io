// Cloud saves for the arcade. The browser copy stays the source of truth while offline; this
// module signs players in (as a guest first), mirrors save sections to Supabase, pulls newer
// sections from other devices, and uploads finished runs for server-verified unlocks.
import {SUPABASE_URL,SUPABASE_KEY} from './cloud-config.js';
import {SAVE_KEYS,SAVE_PREFIX,parseBackup} from './progress-backup.js';

const META='dawg-sync',QUEUE='dawg-session-queue';
const safeRead=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const safeWrite=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
// A section is valid if the same checks that guard backup imports accept it.
export function validSection(key,data){try{parseBackup(JSON.stringify({format:'dawg-arcade-backup',version:1,saves:{[key]:data}}));return true;}catch{return false;}}
// Picks, per section, whether the device or the cloud copy wins: newest change wins.
export function plan(meta,remoteRows,localKeys){
 const pull=[],push=[],seen=new Set();
 for(const row of remoteRows){seen.add(row.key);const m=meta[row.key]||{},local=m.local||'',synced=m.synced||'';
  if(row.updated_at>synced&&row.updated_at>local)pull.push(row);else if(local>row.updated_at)push.push(row.key);}
 for(const key of localKeys)if(!seen.has(key))push.push(key);
 return {pull,push};
}

export class Cloud {
 constructor({onPulled,onStatus,onServer}={}){this.onPulled=onPulled;this.onStatus=onStatus;this.onServer=onServer;this.client=null;this.user=null;this.status='offline';this.timer=0;this.meta=safeRead(META,{});}
 // Called by the save choke point for every write, even before the client has connected.
 touch(key){if(!SAVE_KEYS.includes(key))return;this.meta[key]={...this.meta[key],local:new Date().toISOString()};safeWrite(META,this.meta);if(this.user){clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),2500);}}
 setStatus(status,detail=''){this.status=status;this.onStatus?.(status,detail,this.account());}
 account(){const u=this.user;return u?{guest:!!u.is_anonymous,email:u.email||u.new_email||'',pendingEmail:u.new_email||'',id:u.id}:null;}
 async start(){
  // Only real web pages talk to the cloud; file:// copies and test harnesses stay local.
  if(!/^https?:$/.test(globalThis.location?.protocol||"")){this.setStatus("offline","local copy");return this;}
  try{
   const {createClient}=await import('./vendor/supabase.js');
   this.client=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'dawg-auth'}});
   this.client.auth.onAuthStateChange((event,session)=>{const changed=session?.user?.id!==this.user?.id;this.user=session?.user||null;if(changed&&this.user&&event==='SIGNED_IN')this.sync();else this.setStatus(this.user?'online':'offline');});
   let {data:{session}}=await this.client.auth.getSession();
   if(!session){const {data,error}=await this.client.auth.signInAnonymously();if(error)throw error;session=data.session;}
   this.user=session.user;await this.sync();
  }catch(error){this.setStatus('offline',error?.message||'Cloud unavailable');}
  return this;
 }
 async sync(){
  if(!this.client||!this.user||this.syncing)return;this.syncing=true;this.setStatus('syncing');
  try{
   const {data,error}=await this.client.from('saves').select('key,data,updated_at');if(error)throw error;
   const localKeys=SAVE_KEYS.filter(k=>localStorage.getItem(SAVE_PREFIX+k)!==null),{pull,push}=plan(this.meta,data||[],localKeys);let pulled=0;
   for(const row of pull){if(!SAVE_KEYS.includes(row.key)||!validSection(row.key,row.data))continue;localStorage.setItem(SAVE_PREFIX+row.key,JSON.stringify(row.data));this.meta[row.key]={synced:row.updated_at,local:row.updated_at};pulled++;}
   safeWrite(META,this.meta);await this.flush(push);await this.flushRuns();this.setStatus('online');
   if(pulled)this.onPulled?.(pulled);
  }catch(error){this.setStatus('offline',error?.message||'Sync failed');}finally{this.syncing=false;}
 }
 async flush(keys=SAVE_KEYS.filter(k=>{const m=this.meta[k];return m&&m.local&&m.local>(m.synced||'');})){
  if(!this.client||!this.user||!keys.length)return;
  const rows=[];for(const key of keys){let data;try{data=JSON.parse(localStorage.getItem(SAVE_PREFIX+key));}catch{continue;}if(data===null||data===undefined||!validSection(key,data))continue;rows.push({user_id:this.user.id,key,data,updated_at:this.meta[key]?.local||new Date().toISOString()});}
  if(!rows.length)return;const {error}=await this.client.from('saves').upsert(rows);if(error){this.setStatus('offline',error.message);return;}
  for(const row of rows)this.meta[row.key]={synced:row.updated_at,local:row.updated_at};safeWrite(META,this.meta);
 }
 // Finished runs queue on the device and upload when online; the server re-checks every number.
 recordRun(run){const queue=safeRead(QUEUE,[]);queue.push(run);safeWrite(QUEUE,queue.slice(-200));if(this.user)this.flushRuns();}
 async flushRuns(){
  if(!this.client||!this.user||this.flushing)return;this.flushing=true;
  try{
   // The queue is re-read every pass: runs finished during an upload must not be lost.
   for(let r;(r=safeRead(QUEUE,[])[0]);){const {error}=await this.client.rpc('record_session',{p_game:r.game,p_local_day:r.day,p_started_at:r.startedAt,p_ended_at:r.endedAt,p_active_seconds:r.seconds,p_score:r.score,p_xp:r.xp,p_gold:r.gold||0});
    // A rejected run (clock skew, overlap) is dropped; a network failure stops and retries later.
    if(error&&!/out of range|overlapping|violates/.test(error.message))break;
    const latest=safeRead(QUEUE,[]);if(latest[0]?.startedAt===r.startedAt&&latest[0]?.game===r.game)latest.shift();safeWrite(QUEUE,latest);}
   const {data,error}=await this.client.rpc('claim_unlocks');if(!error&&data)this.onServer?.(data);
  }catch{}finally{this.flushing=false;}
 }
 redirect(){return location.origin+location.pathname;}
 // Turns the current guest into a permanent account; progress stays attached.
 async saveWithEmail(email){const {error}=await this.client.auth.updateUser({email},{emailRedirectTo:this.redirect()});if(error)throw error;this.setStatus('online');}
 // Signs in to an existing account on this device; that account's newer progress replaces this device's.
 async signInWithEmail(email){const {error}=await this.client.auth.signInWithOtp({email,options:{emailRedirectTo:this.redirect(),shouldCreateUser:false}});if(error)throw error;}
 async signOut(){await this.client.auth.signOut();this.user=null;this.meta={};safeWrite(META,{});await this.start();}
 async deleteData(){const {error}=await this.client.rpc('delete_my_data');if(error)throw error;this.meta={};safeWrite(META,{});safeWrite(QUEUE,[]);}
}
