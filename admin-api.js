export const SUPABASE_URL="https://fbwlprwhczxjdsciotsi.supabase.co";
export const SUPABASE_KEY="sb_publishable_XkqHZE_hdTNrNXE0O9tvRA_rWdw5pPE";
export const TOKEN_KEY="perfumes-admin-session";

function readStorage(storage){
  try{return JSON.parse(storage.getItem(TOKEN_KEY)||"null")}catch{return null}
}
export function loadSession(){
  const persistent=readStorage(localStorage);
  if(persistent)return persistent;
  const legacy=readStorage(sessionStorage);
  if(legacy){
    try{localStorage.setItem(TOKEN_KEY,JSON.stringify(legacy));sessionStorage.removeItem(TOKEN_KEY)}catch{}
    return legacy;
  }
  return null;
}
export function saveSession(v){
  try{
    if(v)localStorage.setItem(TOKEN_KEY,JSON.stringify(v));
    else localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }catch{}
}
function authHeaders(session,contentType="application/json"){
  return{apikey:SUPABASE_KEY,Authorization:"Bearer "+(session?.access_token||""),"Content-Type":contentType};
}
export function headers(){return authHeaders(loadSession())}

export async function refreshSession(){
  const session=loadSession();
  if(!session?.refresh_token){
    const e=new Error("Sua sessão expirou. Entre novamente.");
    e.status=401;
    throw e;
  }
  const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=refresh_token",{
    method:"POST",
    headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({refresh_token:session.refresh_token})
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok){
    saveSession(null);
    const e=new Error("Sua sessão expirou. Entre novamente.");
    e.status=401;
    throw e;
  }
  saveSession(d);
  return d;
}

async function validSession(){
  const s=loadSession();
  if(!s?.access_token){
    const e=new Error("Faça login para continuar.");
    e.status=401;
    throw e;
  }
  const exp=Number(s.expires_at||0);
  if(exp && exp<=Math.floor(Date.now()/1000)+45)return refreshSession();
  return s;
}

export async function call(name,payload,auth=true,retry=true){
  let session=null;
  if(auth)session=await validSession();
  const r=await fetch(SUPABASE_URL+"/functions/v1/"+name,{
    method:"POST",
    headers:auth?authHeaders(session):{apikey:SUPABASE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  if(r.status===401&&auth&&retry){
    await refreshSession();
    return call(name,payload,auth,false);
  }
  const d=await r.json().catch(()=>({}));
  if(!r.ok){
    const e=new Error(d?.error||"Falha na operação.");
    e.status=r.status;
    throw e;
  }
  return d;
}

export async function signIn(email,password){
  const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{
    method:"POST",
    headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({email,password})
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok){
    const raw=d?.error_description||d?.msg||d?.error||"Falha no login.";
    if(String(raw).toLowerCase().includes("email not confirmed")||String(d?.error_code||"").includes("email_not_confirmed"))throw new Error("Seu e-mail ainda não foi confirmado.");
    throw new Error(raw);
  }
  saveSession(d);
  return d;
}
export async function createFirstAccess(email,password){
  if(password.length<8)throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  const r=await fetch(SUPABASE_URL+"/auth/v1/signup",{
    method:"POST",
    headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({email:String(email||"").trim().toLowerCase(),password})
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d?.error_description||d?.msg||"Não foi possível criar o acesso.");
  if(d?.access_token)saveSession(d);
  return d;
}
export async function resendConfirmation(email){
  const normalized=String(email||"").trim().toLowerCase();
  if(!normalized||!normalized.includes("@"))throw new Error("Informe um e-mail válido.");
  const r=await fetch(SUPABASE_URL+"/auth/v1/resend",{
    method:"POST",
    headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({type:"signup",email:normalized})
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d?.error_description||d?.msg||"Não foi possível reenviar a confirmação.");
  return d;
}

export const adminApi=p=>call("admin-operations",p);
export const procurementApi=p=>call("admin-procurement",p);
export const emergencyApi=p=>call("site-emergency",p);
export const productImageApi=p=>call("admin-product-image",p);

export async function uploadProductImage(file,retry=true){
  if(!(file instanceof File)||!file.size)throw new Error("Selecione a foto do perfume.");
  const allowed=["image/jpeg","image/png","image/webp"];
  if(!allowed.includes(file.type))throw new Error("Use uma imagem JPG, PNG ou WebP.");
  if(file.size>10*1024*1024)throw new Error("A imagem deve ter no máximo 10 MB.");
  const safe=(file.name||"perfume").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(-80)||"perfume";
  const objectPath="products/"+Date.now()+"-"+crypto.randomUUID()+"-"+safe;
  const encodedPath=objectPath.split("/").map(encodeURIComponent).join("/");
  const s=await validSession();
  const r=await fetch(SUPABASE_URL+"/storage/v1/object/product-images/"+encodedPath,{
    method:"POST",
    headers:authHeaders(s,file.type),
    body:file
  });
  if(r.status===401&&retry){
    await refreshSession();
    return uploadProductImage(file,false);
  }
  if(!r.ok){
    const d=await r.json().catch(()=>({}));
    const e=new Error(d?.message||d?.error||"Não foi possível enviar a foto.");
    e.status=r.status;
    throw e;
  }
  return SUPABASE_URL+"/storage/v1/object/public/product-images/"+encodedPath;
}
export function money(c){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(c||0)/100)}
export function cents(v){return Math.round(Number(v||0)*100)}
export function esc(v=""){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
export function option(rows,value,label,empty="Selecione"){return '<option value="">'+empty+'</option>'+rows.map(x=>'<option value="'+esc(x[value])+'">'+esc(typeof label==="function"?label(x):x[label])+'</option>').join("")}
export function table(headers,rows){if(!rows.length)return '<p class="muted">Nenhum registro.</p>';return '<div class="table-wrap"><table class="data-table"><thead><tr>'+headers.map(h=>'<th>'+h[0]+'</th>').join("")+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+headers.map(h=>'<td>'+h[1](r)+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>'}

export async function requestPasswordReset(email){
  const normalized=String(email||"").trim().toLowerCase();
  if(!normalized||!normalized.includes("@"))throw new Error("Informe um e-mail válido.");
  const redirectTo="https://enzosalmazo00.github.io/PERFUMES-VENDAS/admin.html?recovery=1";
  const r=await fetch(SUPABASE_URL+"/auth/v1/recover?redirect_to="+encodeURIComponent(redirectTo),{
    method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:normalized})
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d?.error_description||d?.msg||"Não foi possível enviar o e-mail de recuperação.");
  return d;
}
