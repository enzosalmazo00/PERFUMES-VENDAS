export const SUPABASE_URL="https://fbwlprwhczxjdsciotsi.supabase.co";
export const SUPABASE_KEY="sb_publishable_XkqHZE_hdTNrNXE0O9tvRA_rWdw5pPE";
export const TOKEN_KEY="perfumes-admin-session";
export function loadSession(){try{return JSON.parse(sessionStorage.getItem(TOKEN_KEY)||"null")}catch{return null}}
export function saveSession(v){if(v)sessionStorage.setItem(TOKEN_KEY,JSON.stringify(v));else sessionStorage.removeItem(TOKEN_KEY)}
export function headers(){const s=loadSession();return{apikey:SUPABASE_KEY,Authorization:"Bearer "+(s?.access_token||""),"Content-Type":"application/json"}}
export async function call(name,payload,auth=true){const r=await fetch(SUPABASE_URL+"/functions/v1/"+name,{method:"POST",headers:auth?headers():{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d?.error||"Falha na operação.");e.status=r.status;throw e}return d}
export async function signIn(email,password){const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error_description||d?.msg||"Falha no login.");saveSession(d);return d}
export async function createFirstAccess(email,password){if(password.length<8)throw new Error("A senha precisa ter pelo menos 8 caracteres.");const a=await call("admin-bootstrap",{email},false);if(!a.allowed)throw new Error("Este e-mail não está autorizado como administrador.");const r=await fetch(SUPABASE_URL+"/auth/v1/signup",{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error_description||d?.msg||"Não foi possível criar o acesso.");if(d?.access_token)saveSession(d);return d}
export const adminApi=p=>call("admin-operations",p);
export const procurementApi=p=>call("admin-procurement",p);
export const emergencyApi=p=>call("site-emergency",p);
export function money(c){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(c||0)/100)}
export function cents(v){return Math.round(Number(v||0)*100)}
export function esc(v=""){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
export function option(rows,value,label,empty="Selecione"){return '<option value="">'+empty+'</option>'+rows.map(x=>'<option value="'+esc(x[value])+'">'+esc(typeof label==="function"?label(x):x[label])+'</option>').join("")}
export function table(headers,rows){if(!rows.length)return '<p class="muted">Nenhum registro.</p>';return '<div class="table-wrap"><table class="data-table"><thead><tr>'+headers.map(h=>'<th>'+h[0]+'</th>').join("")+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+headers.map(h=>'<td>'+h[1](r)+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>'}