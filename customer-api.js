export const SUPABASE_URL="https://fbwlprwhczxjdsciotsi.supabase.co";
export const SUPABASE_KEY="sb_publishable_XkqHZE_hdTNrNXE0O9tvRA_rWdw5pPE";
const KEY="azzena-customer-session";
function parse(raw){try{return JSON.parse(raw||"null")}catch{return null}}
export function loadCustomerSession(){return parse(localStorage.getItem(KEY))}
export function saveCustomerSession(s){if(s)localStorage.setItem(KEY,JSON.stringify(s));else localStorage.removeItem(KEY)}
function authHeaders(s){return{apikey:SUPABASE_KEY,Authorization:"Bearer "+s.access_token,"Content-Type":"application/json"}}
export async function refreshCustomerSession(){
  const s=loadCustomerSession();if(!s?.refresh_token)throw new Error("Faça login novamente.");
  const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:s.refresh_token})});
  const d=await r.json().catch(()=>({}));if(!r.ok){saveCustomerSession(null);throw new Error("Sua sessão expirou. Entre novamente.");}
  saveCustomerSession(d);return d;
}
export async function validCustomerSession(){
  let s=loadCustomerSession();if(!s?.access_token)throw new Error("LOGIN_REQUIRED");
  if(Number(s.expires_at||0)&&Number(s.expires_at)<=Math.floor(Date.now()/1000)+45)s=await refreshCustomerSession();
  return s;
}
export async function customerSignIn(email,password){
  const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:String(email||"").trim().toLowerCase(),password})});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.msg||d?.error_description||"E-mail ou senha inválidos.");saveCustomerSession(d);return d;
}
export async function customerSignUp(full_name,email,password){
  if(String(password||"").length<8)throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  const r=await fetch(SUPABASE_URL+"/auth/v1/signup",{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:String(email||"").trim().toLowerCase(),password,data:{full_name:String(full_name||"").trim()}})});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.msg||d?.error_description||"Não foi possível criar sua conta.");if(d?.access_token)saveCustomerSession(d);return d;
}
export function customerSignOut(){saveCustomerSession(null)}
export async function callCustomerFunction(name,payload,retry=true){
  let s=await validCustomerSession();
  const r=await fetch(SUPABASE_URL+"/functions/v1/"+name,{method:"POST",headers:authHeaders(s),body:JSON.stringify(payload)});
  if(r.status===401&&retry){await refreshCustomerSession();return callCustomerFunction(name,payload,false)}
  const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d?.error||"Falha na operação.");e.status=r.status;e.data=d;throw e}return d;
}
export const customerPortal=p=>callCustomerFunction("customer-portal",p);
export const shippingQuote=p=>callCustomerFunction("shipping-quote",p);
export const customerCheckout=p=>callCustomerFunction("customer-checkout",p);

export async function requestPasswordReset(email){
  const normalized=String(email||"").trim().toLowerCase();
  if(!normalized||!normalized.includes("@"))throw new Error("Informe um e-mail válido.");
  const redirectTo="https://enzosalmazo00.github.io/PERFUMES-VENDAS/";
  const r=await fetch(SUPABASE_URL+"/auth/v1/recover?redirect_to="+encodeURIComponent(redirectTo),{
    method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:normalized})
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d?.error_description||d?.msg||"Não foi possível enviar o e-mail de recuperação.");
  return d;
}
export function recoveryFromHash(){
  const raw=location.hash.startsWith("#")?location.hash.slice(1):"";
  const p=new URLSearchParams(raw);
  if(p.get("type")!=="recovery"||!p.get("access_token"))return null;
  return {access_token:p.get("access_token"),refresh_token:p.get("refresh_token"),expires_in:Number(p.get("expires_in")||0),token_type:p.get("token_type")||"bearer"};
}
export async function updateRecoveredPassword(accessToken,password){
  if(String(password||"").length<8)throw new Error("A nova senha precisa ter pelo menos 8 caracteres.");
  const r=await fetch(SUPABASE_URL+"/auth/v1/user",{method:"PUT",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+accessToken,"Content-Type":"application/json"},body:JSON.stringify({password})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d?.error_description||d?.msg||"Não foi possível atualizar a senha.");
  return d;
}
