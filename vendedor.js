import {SUPABASE_URL,SUPABASE_KEY,money,esc,table} from "./admin-api.js?v=20261001-sellerflow2";
import {initSellerSales,renderSellerSales} from "./seller-sales.js?v=20261001-sales8";
import {initPickupVerifier} from "./seller-pickup.js?v=20261001-pickupcode1";
import {setupSellerWorkspace,activateSellerTab,updateSellerWorkflow} from "./seller-workspace.js?v=20261001-workspace1";

const $=selector=>document.querySelector(selector);
const SESSION_KEY="azzena-seller-session";
const views=["loadingView","loginView","confirmView","applyView","pendingView","app"];
let refreshing=null,loading=false;
const feedback=(target,message)=>{$(target).textContent=message||""};
function show(view){
  for(const id of views)$("#"+id).hidden=id!==view;
  if(view==="loadingView"){$("#loadingRetry").hidden=true;$(".seller-loading-icon").hidden=false}
}
function busy(message="Verificando seu acesso..."){
  $("#loadingMessage").textContent=message;
  show("loadingView");
}
function notify(message){
  const toast=$("#toast");
  toast.textContent=message;
  toast.classList.add("show");
  clearTimeout(notify.timer);
  notify.timer=setTimeout(()=>toast.classList.remove("show"),3500);
}
function readSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||"null")}catch{return null}}
function saveSession(value){
  if(!value)localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY,JSON.stringify({...value,
    expires_at:Number(value.expires_at||0)||Math.floor(Date.now()/1000)+Number(value.expires_in||3600)}));
}
function logout(){saveSession(null);show("loginView")}
async function refreshSession(){
  if(refreshing)return refreshing;
  refreshing=(async()=>{
    const current=readSession();
    if(!current?.refresh_token)throw new Error("LOGIN_REQUIRED");
    const response=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=refresh_token",{
      method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({refresh_token:current.refresh_token})
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok){
      if(response.status===400||response.status===401){saveSession(null);throw new Error("LOGIN_REQUIRED")}
      throw new Error("Não foi possível confirmar a sessão. Confira a internet e tente novamente.");
    }
    const next={...current,...body};
    saveSession(next);
    return next;
  })();
  try{return await refreshing}finally{refreshing=null}
}
async function validSession(){
  const session=readSession();
  if(!session)throw new Error("LOGIN_REQUIRED");
  if(!session.access_token&&session.refresh_token)return refreshSession();
  if(!session.access_token)throw new Error("LOGIN_REQUIRED");
  if(Number(session.expires_at||0)&&Number(session.expires_at)<=Math.floor(Date.now()/1000)+60)return refreshSession();
  return session;
}
async function call(name,payload,auth=true,retry=true){
  const session=auth?await validSession():null;
  const response=await fetch(SUPABASE_URL+"/functions/v1/"+name,{
    method:"POST",
    headers:{apikey:SUPABASE_KEY,
      ...(auth?{Authorization:"Bearer "+session.access_token}:{}),
      "Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  if(response.status===401&&auth&&retry){
    const latest=readSession();
    if(latest?.access_token===session.access_token)await refreshSession();
    return call(name,payload,auth,false);
  }
  const body=await response.json().catch(()=>({}));
  if(!response.ok){
    const e=new Error(body?.error||"Falha na operação.");
    e.status=response.status;e.details=body;throw e;
  }
  return body;
}
function friendlyError(error){
  const map={
    LOGIN_REQUIRED:"Entre novamente para acessar seu painel.",
    EMAIL_UNCONFIRMED:"Confirme seu e-mail antes de solicitar acesso. Confira a caixa de entrada e o spam.",
    SELLER_PENDING:"Seu cadastro ainda está aguardando aprovação.",
    SELLER_REJECTED:"Esta solicitação foi recusada. Fale com a administração.",
    FORBIDDEN:"Você ainda não tem permissão para entrar no painel.",
    SELLER_FIELDS_REQUIRED:"Informe seu nome completo e WhatsApp com DDD válido.",
    SELLER_REQUEST_ALREADY_EXISTS:"Este cadastro já foi enviado. Entre para verificar o status.",
    EMAIL_ALREADY_LINKED:"Este e-mail já está vinculado a outro cadastro de vendedor.",
    SELLER_APPLICATION_FAILED:"Não foi possível enviar sua solicitação. Tente novamente."
  };
  return map[error?.message]||error?.message||"Não foi possível concluir a operação.";
}
async function signIn(email,password){
  const response=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{
    method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({email:String(email||"").trim().toLowerCase(),password})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error_description||data.msg||"E-mail ou senha incorretos.");
  saveSession(data);
  return data;
}
async function signUp(name,phone,email,password){
  if(password.length<8)throw new Error("Use uma senha de pelo menos 8 caracteres.");
  if(String(phone||"").replace(/\D/g,"").length<10)throw new Error("Informe o WhatsApp com DDD.");
  const response=await fetch(SUPABASE_URL+"/auth/v1/signup",{
    method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({email:String(email||"").trim().toLowerCase(),
      password,data:{full_name:String(name).trim()}})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error_description||data.msg||"Não foi possível criar sua conta.");
  if(data.access_token)saveSession(data);
  return data;
}
function showPending(status,info){
  const title={
    pending:"Aguardando aprovação",
    rejected:"Solicitação recusada",
    paused:"Seu acesso está pausado"
  }[status]||"Aguardando liberação";
  const description={
    pending:"Sua solicitação foi recebida. O administrador precisa aprovar seu acesso. Volte a esta página para conferir o status.",
    rejected:"Seu pedido foi recusado. Entre em contato com a administração para esclarecimentos.",
    paused:"Sua conta está temporariamente sem acesso. Entre em contato com a administração."
  }[status]||"Confira com a administração o status do seu cadastro.";
  $("#pendingTitle").textContent=title;
  $("#pendingDescription").textContent=description;
  $("#pendingEmail").textContent=info?.email||readSession()?.user?.email||"";
  $("#checkApproval").hidden=status==="rejected";
  show("pendingView");
}
async function refreshInventory(){
  const response=await call("seller-portal",{});
  const data=response.data||{},inventory=data.inventory||[],low=data.low_stock||[];
  $("#sellerName").textContent=data.seller?.name||"Meu estoque";
  $("#metrics").innerHTML=[
    ["Produtos",inventory.length],
    ["Unidades",inventory.reduce((sum,item)=>sum+Number(item.quantity||0),0)],
    ["Alertas",low.length]
  ].map(item=>'<div class="metric"><span>'+item[0]+'</span><strong>'+item[1]+'</strong></div>').join("");
  $("#alerts").innerHTML=low.length?low.map(item=>
    '<div class="alert-row"><span class="badge-warn">⚠ '+esc(item.product_name)+
    '</span><span>Restam '+item.quantity+' em '+esc(item.location_name)+'</span></div>'
  ).join(""):'<p class="muted">Nenhum alerta de estoque baixo.</p>';
  $("#inventory").innerHTML=table([
    ["Produto",item=>esc(item.product_name)+" "+esc(item.volume_ml||"")+" mL"],
    ["Local",item=>esc(item.location_name)],
    ["Saldo",item=>item.low_stock?'<span class="badge-warn">⚠ '+item.quantity+'</span>':item.quantity],
    ["Limite",item=>item.low_stock_threshold]
  ],inventory);
  const catalogUrl=new URL("index.html",location.href);
  catalogUrl.searchParams.set("vendedor",data.seller.id);
  $("#sellerCatalogUrl").value=catalogUrl.href;
  $("#sendSellerCatalog").href="https://wa.me/?text="+encodeURIComponent("Confira meus perfumes disponíveis na AZZENA PARFUMS: "+catalogUrl.href);
  $("#openSellerCatalog").href=catalogUrl.href;
  const statuses={pending:"Recebido",preparing:"Preparando",ready:"Pronto para retirar",shipped:"Enviado",delivered:"Entregue",cancelled:"Cancelado"};
  const payments={pending:"Pagamento pendente",approved:"Pagamento aprovado",rejected:"Pagamento recusado",cancelled:"Cancelado",refunded:"Estornado"};
  const orders=data.orders||[];
  $("#sellerOrders").innerHTML=orders.length?orders.map(order=>{
    const canAdvance=order.delivery_method==="presencial"&&order.payment_status==="approved"&&
      !["cancelled","delivered"].includes(order.fulfillment_status);
    const next=order.fulfillment_status==="ready"?"code_required":order.fulfillment_status==="preparing"?"ready":"preparing";
    const labels={preparing:"Iniciar preparação",ready:"Liberar retirada",delivered:"Marcar entregue"};
    const phone=String(order.customer_phone||"").replace(/\D/g,"");
    return '<article class="seller-order"><header><strong>'+esc(order.public_id)+'</strong><small>'+new Date(order.created_at).toLocaleString("pt-BR")+'</small></header>'+
      '<p><b>'+esc(order.customer_name)+'</b> · '+money(order.total_cents)+'</p>'+
      '<p>'+esc(order.delivery_method==="presencial"?"Retirada presencial":"Entrega")+' · '+esc(payments[order.payment_status]||order.payment_status)+
      ' · '+esc(statuses[order.fulfillment_status]||order.fulfillment_status)+'</p>'+
      '<p class="seller-order-lines">'+(order.items||[]).map(item=>esc(item.quantity)+'× '+esc(item.product_name)+' · '+esc(item.volume_ml)+' mL').join('<br>')+'</p>'+ 
      '<div class="seller-dashboard-actions"><a class="seller-outline" href="etiqueta.html?pedido='+encodeURIComponent(order.id)+'" target="_blank" rel="noopener noreferrer">Gerar etiqueta</a>'+ (phone?'<a class="seller-outline" target="_blank" rel="noopener" href="https://wa.me/'+phone+'?text='+encodeURIComponent("Olá "+order.customer_name+", sobre seu pedido "+order.public_id+" na AZZENA PARFUMS.")+'">Conversar no WhatsApp</a>':'')+
      (canAdvance&&next==="code_required"?'<button type="button" class="seller-outline" data-seller-go="retiradas">Conferir código para entregar</button>':
        canAdvance?'<button type="button" class="seller-outline" data-seller-order-save="'+esc(order.id)+'" data-next-status="'+next+'">'+labels[next]+'</button>':'')+'</div></article>';
  }).join(""):'<p class="muted">Ainda não há pedidos vinculados a você.</p>';
  const pickup=data.pickup||{};
  const pickupForm=$("#sellerPickupForm");
  for(const key of ["display_name","country_code","street","street_number","neighborhood","city","state","postal_code","complement","google_maps_url","instructions"]){
    if(pickupForm.elements[key])pickupForm.elements[key].value=pickup[key]||(key==="country_code"?"BR":"");
  }
  pickupForm.elements.is_enabled.checked=pickup.is_enabled===true;
  renderSellerSales(data);
  updateSellerWorkflow(data);
  $("#emergencyCard").hidden=!data.seller?.can_toggle_site_emergency;
  show("app");activateSellerTab();
  if(data.seller?.can_toggle_site_emergency)await loadStatus();
}

async function openSeller(){
  if(loading)return;
  loading=true;
  busy();
  try{
    await validSession();
    const result=await call("seller-application",{action:"status"});
    const info=result.data||{};
    if(info.status==="approved"){await refreshInventory();return}
    if(info.status==="not_registered"){
      const form=$("#applyForm");
      form.elements.name.value=readSession()?.user?.user_metadata?.full_name||"";
      form.elements.phone.value="";
      show("applyView");return;
    }
    showPending(info.status,info);
  }catch(error){
    if(error?.message==="LOGIN_REQUIRED"&&!readSession()){show("loginView");return}
    if(error?.message==="EMAIL_UNCONFIRMED"){show("confirmView");return}
    if(error?.message==="SELLER_PENDING"){showPending("pending");return}
    if(error?.message==="SELLER_REJECTED"){showPending("rejected");return}
    $("#loadingMessage").textContent="Não conseguimos verificar seu acesso. "+friendlyError(error);
    $("#loadingRetry").hidden=false;
    $(".seller-loading-icon").hidden=true;
  }finally{loading=false}
}
async function loadStatus(){
  try{
    const response=await call("site-emergency",{action:"get_status"});
    $("#status").textContent=response.data.is_online?"Loja online":"Loja fora do ar · "+(response.data.outage_reason||"");
  }catch{$("#status").textContent="Não foi possível consultar o status."}
}
$("#loginForm").onsubmit=async event=>{
  event.preventDefault();
  feedback("#loginMessage","");
  busy("Entrando na sua conta...");
  try{await signIn($("#email").value,$("#password").value);await openSeller()}
  catch(error){show("loginView");feedback("#loginMessage",friendlyError(error))}
};
$("#signupForm").onsubmit=async event=>{
  event.preventDefault();
  feedback("#signupMessage","");
  const form=event.currentTarget,button=form.querySelector('[type="submit"]'),data=new FormData(form);
  const name=String(data.get("name")||"").trim(),phone=String(data.get("phone")||"").trim();
  button.disabled=true;
  try{
    const result=await signUp(name,phone,data.get("email"),String(data.get("password")||""));
    if(result.access_token){
      const applied=await call("seller-application",{action:"apply",name,whatsapp_number:phone});
      showPending(applied.data.status,applied.data);
    }else{
      show("confirmView");
    }
  }catch(error){show("loginView");feedback("#signupMessage",friendlyError(error))}
  finally{button.disabled=false}
};
$("#applyForm").onsubmit=async event=>{
  event.preventDefault();
  const form=event.currentTarget,button=form.querySelector('[type="submit"]');
  button.disabled=true;feedback("#applyMessage","");
  try{
    const result=await call("seller-application",{
      action:"apply",name:form.elements.name.value,whatsapp_number:form.elements.phone.value
    });
    if(result.data?.status==="approved"){await refreshInventory();return}
    showPending(result.data?.status,result.data);
  }catch(error){feedback("#applyMessage",friendlyError(error))}
  finally{button.disabled=false}
};
$("#resetPassword").onclick=async()=>{
  const email=$("#email").value.trim();
  if(!email){feedback("#loginMessage","Informe seu e-mail acima para recuperar a senha.");$("#email").focus();return}
  try{
    const response=await fetch(SUPABASE_URL+"/auth/v1/recover?redirect_to="+encodeURIComponent("https://enzosalmazo00.github.io/PERFUMES-VENDAS/"),{
      method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error_description||data.msg||"Não foi possível enviar a recuperação.");
    feedback("#loginMessage","Link enviado. Confira o e-mail e o spam. Como o acesso usa a mesma conta AZZENA, você pode redefinir a senha pela página de recuperação.");
  }catch(error){feedback("#loginMessage",friendlyError(error))}
};
$("#backToLogin").onclick=()=>show("loginView");
$("#retryLoad").onclick=openSeller;
$("#checkApproval").onclick=openSeller;
for(const id of ["loadingLogout","applyLogout","pendingLogout","logout"])$("#"+id).onclick=logout;
document.querySelectorAll("[data-password]").forEach(button=>{
  button.onclick=()=>{
    const input=$("#"+button.dataset.password),visible=input.type==="password";
    input.type=visible?"text":"password";
    button.setAttribute("aria-label",visible?"Ocultar senha":"Mostrar senha");
  };
});
$("#sellerOrders").addEventListener("click",async event=>{
  const button=event.target.closest("[data-seller-order-save]");
  if(!button)return;
  const next=button.dataset.nextStatus;
  const prompt=next==="delivered"?"Confirma que o produto foi entregue ao cliente?":"Atualizar o status deste pedido?";
  if(!confirm(prompt))return;
  button.disabled=true;
  try{
    await call("seller-portal",{action:"update_pickup_order",id:button.dataset.sellerOrderSave,fulfillment_status:next});
    await refreshInventory();notify("Pedido atualizado.");
  }catch(error){notify(error.message==="PAYMENT_NOT_CONFIRMED"?"O pagamento ainda não foi confirmado no ADM.":friendlyError(error))}
  finally{button.disabled=false}
});
$("#sellerPreorderSettingsForm").onsubmit=async event=>{
 event.preventDefault();
 const submit=$("#sellerPreorderSave"),status=$("#sellerPreorderSettingsStatus");
 const enabled=$("#sellerPreorderOptIn").checked;
 submit.disabled=true;status.textContent="Salvando sua preferência...";
 try{
   const result=await call("seller-portal",{action:"update_preorder_settings",enabled});
   await refreshInventory();
   activateSellerTab("configuracoes");
   status.textContent=result.data?.enabled?
     "Pronto. Seu WhatsApp está autorizado a receber solicitações de encomenda.":
     "Encomendas desativadas. Seu WhatsApp não aparecerá na lista pública para novas solicitações.";
   notify("Preferência de encomendas salva.");
 }catch(error){
   status.textContent=error.message==="SELLER_WHATSAPP_INVALID"?
     "Seu WhatsApp cadastrado está incompleto. Solicite ao administrador a correção antes de ativar.":friendlyError(error);
 }finally{submit.disabled=false}
};
$("#copySellerCatalog").onclick=async()=>{
  const url=$("#sellerCatalogUrl").value;
  if(!url)return notify("Acesse sua conta aprovada para compartilhar seu catálogo.");
  try{await navigator.clipboard.writeText(url);notify("Link do catálogo copiado!")}
  catch{$("#sellerCatalogUrl").focus();$("#sellerCatalogUrl").select();notify("Selecione e copie o link exibido no campo.")}
};
$("#sellerPickupForm").onsubmit=async event=>{
  event.preventDefault();
  const form=event.currentTarget,submit=form.querySelector('[type="submit"]');
  const values=new FormData(form);
  const pickup=Object.fromEntries(["display_name","country_code","street","street_number","neighborhood","city","state","postal_code","complement","google_maps_url","instructions"].map(k=>[k,values.get(k)]));
  pickup.is_enabled=form.elements.is_enabled.checked;
  submit.disabled=true;$("#sellerPickupMessage").textContent="Salvando o endereço...";
  try{
    await call("seller-portal",{action:"save_pickup",pickup});
    $("#sellerPickupMessage").textContent="Endereço atualizado. "+(pickup.is_enabled?"Clientes podem escolher retirar neste local.":"Retirada desativada no momento.");
    notify("Ponto de retirada salvo.");
  }catch(error){
    const message=error.message==="GOOGLE_MAPS_LINK_REQUIRED"?"Informe o link do Google Maps para habilitar a retirada.":error.message==="GOOGLE_MAPS_LINK_INVALID"?"Use um link válido do Google Maps.":friendlyError(error);
    $("#sellerPickupMessage").textContent=message;notify(message);
  }finally{submit.disabled=false}
};
$("#disable").onclick=async()=>{
  const reason=$("#reason").value.trim();
  if(reason.length<3){notify("Informe a justificativa.");return}
  if(!confirm("Confirma desativar a loja temporariamente?"))return;
  try{
    await call("site-emergency",{action:"set_status",is_online:false,outage_kind:$("#kind").value,outage_reason:reason});
    await loadStatus();notify("Loja temporariamente desativada.");
  }catch(error){notify(friendlyError(error))}
};
$("#enable").onclick=async()=>{
  if(!confirm("Confirma colocar a loja online?"))return;
  try{
    await call("site-emergency",{action:"set_status",is_online:true,outage_reason:"Reativação pelo vendedor"});
    await loadStatus();notify("Loja online.");
  }catch(error){notify(friendlyError(error))}
};
try{
  const saved=JSON.parse(localStorage.getItem("azzena-label-prefs")||"{}");
  if(["100x150","100x100","a4"].includes(saved.size))$("#sellerLabelSize").value=saved.size;
}catch{}
$("#sellerLabelSize").onchange=()=>{
  let current={};try{current=JSON.parse(localStorage.getItem("azzena-label-prefs")||"{}")}catch{}
  localStorage.setItem("azzena-label-prefs",JSON.stringify({...current,size:$("#sellerLabelSize").value}));
};
setupSellerWorkspace();
initSellerSales({call,notify,onSale:refreshInventory,navigate:activateSellerTab});
initPickupVerifier({call,notify,onDelivered:refreshInventory});
if(readSession())openSeller();else show("loginView");