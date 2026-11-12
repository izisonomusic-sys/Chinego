import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const enc=new TextEncoder();
async function sha512(value:string){const d=await crypto.subtle.digest("SHA-512",enc.encode(value));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function secrets(){const master=Deno.env.get("PAYDUNYA_DISBURSE_MASTER_KEY")||Deno.env.get("PAYDUNYA_MASTER_KEY")||"";const privateKey=Deno.env.get("PAYDUNYA_DISBURSE_PRIVATE_KEY")||Deno.env.get("PAYDUNYA_PRIVATE_KEY")||"";const token=Deno.env.get("PAYDUNYA_DISBURSE_TOKEN")||Deno.env.get("PAYDUNYA_TOKEN")||"";if(!master||!privateKey||!token||Deno.env.get("PAYDUNYA_PER_ENABLED")!=="true")throw new Error("Le service de décaissement PayDunya n’est pas activé ou ses clés PER sont absentes.");return {master,privateKey,token};}
async function paydunya(path:string,payload:Record<string,unknown>){const {master,privateKey,token}=secrets();const response=await fetch("https://app.paydunya.com/api/v2/disburse/"+path,{method:"POST",headers:{"Content-Type":"application/json","PAYDUNYA-MASTER-KEY":master,"PAYDUNYA-PRIVATE-KEY":privateKey,"PAYDUNYA-TOKEN":token},body:JSON.stringify(payload)});const data=await response.json().catch(()=>({}));if(!response.ok||data.response_code!=="00")throw new Error(data.response_text||data.message||"PayDunya a refusé le décaissement.");return data;}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 const supabaseUrl=Deno.env.get("SUPABASE_URL")!;const anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
 const authHeader=req.headers.get("Authorization")||"";
 const callback=new URL(req.url).searchParams.get("callback")==="1"||!authHeader.startsWith("Bearer ");
 if(callback){
  try{const raw=await req.text();let body:Record<string,string>={};try{body=JSON.parse(raw);}catch{body=Object.fromEntries(new URLSearchParams(raw).entries());}
   const master=Deno.env.get("PAYDUNYA_DISBURSE_MASTER_KEY")||Deno.env.get("PAYDUNYA_MASTER_KEY")||"";
   if(!master||!body.hash||body.hash.toLowerCase()!==await sha512(master))return json({error:"Signature PayDunya invalide"},401);
   const id=body.disburse_id||"";const status=String(body.status||"").toLowerCase();
   if(!id||!["success","failed"].includes(status))return json({received:true,ignored:true});
   const {error}=await admin.rpc("sync_wallet_payout_status",{p_payout_request_id:id,p_status:status==="success"?"paid":"rejected",p_provider_reference:body.transaction_id||body.disburse_tx_id||null});
   if(error)throw error;return json({received:true});
  }catch(error){return json({error:error instanceof Error?error.message:"Callback invalide"},400);}
 }
 if(!authHeader.startsWith("Bearer "))return json({error:"Authentification requise"},401);
 const userClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false}});
 const {data:{user},error:authError}=await userClient.auth.getUser();if(authError||!user)return json({error:"Session invalide"},401);
 try{
  const body=await req.json();
  if(body.action==="create_payout"){
   const method=String(body.payout_method||"");const mode=method==="T-Money"?"t-money-togo":method==="Moov Money"?"moov-togo":"";
   if(!mode)return json({error:"Pour le retrait automatique au Togo, choisissez T-Money ou Moov Money."},400);
   const phone=String(body.beneficiary_phone||"").replace(/\D/g,"").replace(/^228/,"");
   if(!phone||phone.length<8||phone.length>10)return json({error:"Numéro Mobile Money invalide. Saisissez le numéro sans +228."},400);
   const amount=Math.floor(Number(body.amount));if(!Number.isSafeInteger(amount)||amount<1000)return json({error:"Le retrait minimum est de 1 000 FCFA."},400);
   const {data:payoutId,error:createError}=await userClient.rpc("request_wallet_payout",{p_wallet_account_id:body.wallet_account_id,p_amount:amount,p_payout_method:method,p_beneficiary_name:String(body.beneficiary_name||"").trim(),p_beneficiary_phone:phone,p_beneficiary_account:null,p_beneficiary_bank:null});
   if(createError)throw createError;
   try{
    const invoice=await paydunya("get-invoice",{account_alias:phone,amount,withdraw_mode:mode,callback_url:supabaseUrl+"/functions/v1/paydunya-payouts?callback=1"});
    const token=invoice.disburse_token;if(!token)throw new Error("PayDunya n’a pas retourné de jeton de décaissement.");
    const submitted=await paydunya("submit-invoice",{disburse_invoice:token,disburse_id:payoutId});
    const status=String(submitted.status||"").toLowerCase();
    if(status==="success"){const {error}=await admin.rpc("sync_wallet_payout_status",{p_payout_request_id:payoutId,p_status:"paid",p_provider_reference:submitted.transaction_id||token});if(error)throw error;}
    else {const {error}=await admin.from("payout_requests").update({status:"processing",provider:"PayDunya",provider_reference:token}).eq("id",payoutId);if(error)throw error;}
    return json({success:true,payout_request_id:payoutId,status:status==="success"?"paid":"processing",message:status==="success"?"Retrait exécuté par PayDunya.":"Demande transmise à PayDunya. Le statut final sera confirmé par notification ou vérification."});
   }catch(providerError){await admin.rpc("sync_wallet_payout_status",{p_payout_request_id:payoutId,p_status:"rejected"});throw providerError;}
  }
  if(body.action==="check_payout"){
   const {data:payout,error}=await userClient.from("payout_requests").select("id,status,provider_reference,user_id").eq("id",body.payout_request_id).eq("user_id",user.id).single();
   if(error||!payout)return json({error:"Demande de retrait introuvable."},404);
   if(["paid","rejected"].includes(payout.status))return json({success:true,status:payout.status});
   if(!payout.provider_reference)return json({error:"Référence PayDunya absente pour cette demande."},400);
   const result=await paydunya("check-status",{disburse_invoice:payout.provider_reference});const status=String(result.status||"").toLowerCase();
   if(status==="success"||status==="failed"){const {error:syncError}=await admin.rpc("sync_wallet_payout_status",{p_payout_request_id:payout.id,p_status:status==="success"?"paid":"rejected",p_provider_reference:result.transaction_id||result.disburse_tx_id||payout.provider_reference});if(syncError)throw syncError;}
   return json({success:true,status:status==="success"?"paid":status==="failed"?"rejected":"processing"});
  }
  return json({error:"Action inconnue."},400);
 }catch(error){return json({error:error instanceof Error?error.message:"Erreur de décaissement."},400);}
});
