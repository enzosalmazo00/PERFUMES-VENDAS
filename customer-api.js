export const SUPABASE_URL="https://fbwlprwhczxjdsciotsi.supabase.co";
export const SUPABASE_KEY="sb_publishable_XkqHZE_hdTNrNXE0O9tvRA_rWdw5pPE";
const KEY="azzena-customer-session";
function parse(raw){try{return JSON.parse(raw||"null")}catch{return null}}
export function loadCustomerSession(){return parse(localStorage.getItem(KEY))}
export function saveCustomerSession(session){
  if(!session){localStorage.removeItem(KEY);return}
  const expires_at=Number(session.expires_at||0)||Math.floor(Date.now()/1000)+Number(session.expires_in||3600);
  localStorage.setItem(KEY,JSON.stringify({...session,expires_at}));
}
function authHeaders(s){return{apikey:SUPABASE_KEY,Authorization:"Bearer "+s.access_token,"Content-Type":"application/json"}}
let refreshing=null;
export async function refreshCustomerSession(){
  if(refreshing)return refreshing;
  refreshing=(async()=>{
    const previous=loadCustomerSession();
    if(!previous?.refresh_token)throw new Error("LOGIN_REQUIRED");
    const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=refresh_token",{
      method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({refresh_token:previous.refresh_token})
    });
    const result=await r.json().catch(()=>({}));
    if(!r.ok){
      if(r.status===400||r.status===401){saveCustomerSession(null);throw new Error("LOGIN_REQUIRED")}
      throw new Error("Não foi possível verificar sua sessão. Verifique a conexão e tente novamente.");
    }
    const next={...previous,...result};
    saveCustomerSession(next);
    return next;
  })();
  try{return await refreshing}finally{refreshing=null}
}
export async function validCustomerSession(){
  const s=loadCustomerSession();
  if(!s)throw new Error("LOGIN_REQUIRED");
  if(!s.access_token&&s.refresh_token)return refreshCustomerSession();
  if(!s.access_token)throw new Error("LOGIN_REQUIRED");
  if(Number(s.expires_at||0)&&Number(s.expires_at)<=Math.floor(Date.now()/1000)+60)return refreshCustomerSession();
  return s;
}
export async function customerSignIn(email,password){const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:String(email||"").trim().toLowerCase(),password})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.msg||d?.error_description||"E-mail ou senha inválidos.");saveCustomerSession(d);return d}
export async function customerSignUp(full_name,email,password){if(String(password||"").length<8)throw new Error("A senha precisa ter pelo menos 8 caracteres.");const r=await fetch(SUPABASE_URL+"/auth/v1/signup",{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:String(email||"").trim().toLowerCase(),password,data:{full_name:String(full_name||"").trim()}})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.msg||d?.error_description||"Não foi possível criar sua conta.");if(d?.access_token)saveCustomerSession(d);return d}
export function customerSignOut(){saveCustomerSession(null)}
export async function callCustomerFunction(name,payload,retry=true){
  const session=await validCustomerSession();
  const response=await fetch(SUPABASE_URL+"/functions/v1/"+name,{
    method:"POST",headers:authHeaders(session),body:JSON.stringify(payload)
  });
  if(response.status===401&&retry){
    const newest=loadCustomerSession();
    if(newest?.access_token===session.access_token)await refreshCustomerSession();
    return callCustomerFunction(name,payload,false);
  }
  const result=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(result?.error||"Não foi possível concluir a operação.");
    error.status=response.status;error.data=result;throw error;
  }
  return result;
}
export const customerPortal=p=>callCustomerFunction("customer-portal",p);
export const shippingQuote=p=>callCustomerFunction("shipping-quote",p);
export const customerCheckout=p=>callCustomerFunction("customer-checkout",p);
export async function requestPasswordReset(email){const normalized=String(email||"").trim().toLowerCase();if(!normalized||!normalized.includes("@"))throw new Error("Informe um e-mail válido.");const redirectTo="https://enzosalmazo00.github.io/PERFUMES-VENDAS/";const r=await fetch(SUPABASE_URL+"/auth/v1/recover?redirect_to="+encodeURIComponent(redirectTo),{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:normalized})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error_description||d?.msg||"Não foi possível enviar o e-mail de recuperação.");return d}
export function recoveryFromHash(){const p=new URLSearchParams(location.hash.replace(/^#/,""));if(p.get("type")!=="recovery"||!p.get("access_token"))return null;return{access_token:p.get("access_token"),refresh_token:p.get("refresh_token")||"",expires_in:Number(p.get("expires_in")||3600),token_type:p.get("token_type")||"bearer"}}
export async function updateRecoveredPassword(accessToken,password){if(String(password||"").length<8)throw new Error("A nova senha precisa ter pelo menos 8 caracteres.");const r=await fetch(SUPABASE_URL+"/auth/v1/user",{method:"PUT",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+accessToken,"Content-Type":"application/json"},body:JSON.stringify({password})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error_description||d?.msg||"Não foi possível atualizar a senha.");return d}
