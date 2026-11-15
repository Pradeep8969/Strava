import {createClient} from 'npm:@supabase/supabase-js@2';
import {response} from '../_shared/http.ts';
// Invoke from a trusted scheduler, never a mobile client. No arbitrary payload/user/token input.
async function authorized(value:string,expected:string){
 if(expected.length<32)return false;
 const digest=async(v:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
 const [a,b]=await Promise.all([digest(value),digest(expected)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
Deno.serve(async req=>{
 if(req.method!=='POST')return response({error:'POST required'},405);
 if(!await authorized(req.headers.get('Authorization')?.replace(/^Bearer /,'')??'',Deno.env.get('PUSH_WORKER_SECRET')??''))return response({error:'Unauthorized'},401);
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const headers={'Content-Type':'application/json',...(Deno.env.get('EXPO_ACCESS_TOKEN')?{Authorization:`Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}`}:{})};
 try{
  // Receipt polling does not resend accepted messages.
  const receipts=await client.from('notification_push_jobs').select('notification_id,ticket_id,installation_id,user_id,target_token').eq('state','accepted').limit(100);
  if(receipts.error)throw receipts.error;
  if(receipts.data?.length){
   const result=await fetch('https://exp.host/--/api/v2/push/getReceipts',{method:'POST',headers,body:JSON.stringify({ids:receipts.data.map(r=>r.ticket_id)}),signal:AbortSignal.timeout(10000)});
   if(result.ok){const body=await result.json();for(const job of receipts.data){const receipt=body.data?.[job.ticket_id];if(!receipt)continue;
    if(receipt.details?.error==='DeviceNotRegistered')await client.from('push_devices').update({enabled:false}).eq('installation_id',job.installation_id).eq('user_id',job.user_id).eq('expo_token',job.target_token);
    const state=receipt.status==='ok'?'sent':receipt.details?.error==='DeviceNotRegistered'?'pending':'failed';
    const update=await client.from('notification_push_jobs').update({state,updated_at:new Date().toISOString()}).eq('notification_id',job.notification_id).eq('state','accepted');if(update.error)throw update.error;
   }}
  }
  const claimed=await client.rpc('claim_notification_push_jobs');if(claimed.error)throw claimed.error;
  for(const job of claimed.data??[]){
   let state='uncertain',ticket_id:string|null=null;
   try{
    const result=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers,body:JSON.stringify({to:job.expo_token,title:job.title,body:job.body,sound:'default',channelId:'account-updates',data:{notification_id:job.notification_id,user_id:job.user_id,screen:'notifications'}}),signal:AbortSignal.timeout(10000)});
    if(result.status===429 || result.status>=500)state='pending';
    else if(result.ok){const ticket=(await result.json()).data;if(ticket?.status==='ok'&&typeof ticket.id==='string'){state='accepted';ticket_id=ticket.id;}
     else if(ticket?.details?.error==='DeviceNotRegistered'){await client.from('push_devices').update({enabled:false}).eq('expo_token',job.expo_token).eq('user_id',job.user_id);state='pending';}
     else state='failed';
    }else state='failed';
   }catch{/* Ambiguous send: do not automatically duplicate a potentially accepted push. */}
   const result=await client.from('notification_push_jobs').update({state,ticket_id,next_attempt_at:new Date(Date.now()+Math.min(3600000,30000*2**job.attempts)).toISOString(),updated_at:new Date().toISOString()}).eq('notification_id',job.notification_id).eq('state','sending');if(result.error)throw result.error;
  }
  return response({processed:claimed.data?.length??0});
 }catch{return response({error:'Push processing unavailable; inspect server job state before retrying uncertain sends.'},503);}
});
