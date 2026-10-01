export const SUPABASE_URL="https://fbwlprwhczxjdsciotsi.supabase.co";
export const SUPABASE_KEY="sb_publishable_XkqHZE_hdTNrNXE0O9tvRA_rWdw5pPE";
export const TOKEN_KEY="perfumes-admin-session";
export function loadSession(){try{return JSON.parse(sessionStorage.getItem(TOKEN_KEY)||"null")}catch{return null}}
export function saveSession(v){if(v)sessionStorage.setItem(TOKEN_KEY,JSON.stringify(v));else sessionStorage.removeItem(TOKEN_KEY)}
export function headers(){const s=loadSession();return{apikey:SUPABASE_KEY,Authorization:"Bearer "+(s?.access_token||""),"Content-Type":"application/json"}}
export async function call(name,payload,auth=true){const r=await fetch(SUPABASE_URL+"/functions/v1/"+name,{method:"POST",headers:auth?headers():{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d?.error||"Falha na operação.");e.status=r.status;throw e}return d}
export async function signIn(email,password){const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password})});const d=await r.json().catch(()=>({}));if(!r.ok){const raw=d?.error_description||d?.msg||d?.error||"Falha no login.";if(String(raw).toLowerCase().includes("email not confirmed")||String(d?.error_code||"").includes("email_not_confirmed"))throw new Error("Seu e-mail ainda não foi confirmado. Use “Reenviar confirmação” e confirme pelo link recebido.");throw new Error(raw)}saveSession(d);return d}
export async function createFirstAccess(email,password){if(password.length<8)throw new Error("A senha precisa ter pelo menos 8 caracteres.");const r=await fetch(SUPABASE_URL+"/auth/v1/signup",{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:String(email||"").trim().toLowerCase(),password})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error_description||d?.msg||"Não foi possível criar o acesso.");if(d?.access_token)saveSession(d);return d}
export async function resendConfirmation(email){const normalized=String(email||"").trim().toLowerCase();if(!normalized||!normalized.includes("@"))throw new Error("Informe um e-mail válido.");const r=await fetch(SUPABASE_URL+"/auth/v1/resend",{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({type:"signup",email:normalized})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error_description||d?.msg||"Não foi possível reenviar a confirmação.");return d}
export const adminApi=p=>call("admin-operations",p);
export const procurementApi=p=>call("admin-procurement",p);
export const emergencyApi=p=>call("site-emergency",p);
export const productImageApi=p=>call("admin-product-image",p);
export async function uploadProductImage(file){
  if(!(file instanceof File)||!file.size)throw new Error("Selecione a foto do perfume.");
  const allowed=["image/jpeg","image/png","image/webp"];
  if(!allowed.includes(file.type))throw new Error("Use uma imagem JPG, PNG ou WebP.");
  if(file.size>10*1024*1024)throw new Error("A imagem deve ter no máximo 10 MB.");
  const safe=(file.name||"perfume").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(-80)||"perfume";
  const objectPath="products/"+Date.now()+"-"+crypto.randomUUID()+"-"+safe;
  const encodedPath=objectPath.split("/").map(encodeURIComponent).join("/");
  const s=loadSession();
  const r=await fetch(SUPABASE_URL+"/storage/v1/object/product-images/"+encodedPath,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+(s?.access_token||""),"Content-Type":file.type,"x-upsert":"false"},body:file});
  if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d?.message||d?.error||"Não foi possível enviar a foto.");}
  return SUPABASE_URL+"/storage/v1/object/public/product-images/"+encodedPath;
}
export function money(c){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(c||0)/100)}
export function cents(v){return Math.round(Number(v||0)*100)}
export function esc(v=""){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
export function option(rows,value,label,empty="Selecione"){return '<option value="">'+empty+'</option>'+rows.map(x=>'<option value="'+esc(x[value])+'">'+esc(typeof label==="function"?label(x):x[label])+'</option>').join("")}
export function table(headers,rows){if(!rows.length)return '<p class="muted">Nenhum registro.</p>';return '<div class="table-wrap"><table class="data-table"><thead><tr>'+headers.map(h=>'<th>'+h[0]+'</th>').join("")+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+headers.map(h=>'<td>'+h[1](r)+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>'}