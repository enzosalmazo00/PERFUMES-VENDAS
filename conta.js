import{
  loadCustomerSession,validCustomerSession,customerSignIn,customerSignUp,
  customerSignOut,customerPortal,requestPasswordReset,recoveryFromHash,updateRecoveredPassword
}from"./customer-api.js?v=20261001-sessionfix1";

const $=selector=>document.querySelector(selector);
const authView=$("#authView"),accountView=$("#accountView"),recoveryView=$("#recoveryView");
const authMessage=$("#authMessage"),toast=$("#accountToast"),screen=$("#accountSessionScreen");
const fields=$("#accountDetailsForm");
const field=name=>fields.elements.namedItem(name);
let boot=null,selectedAddressId=null,checking=false,validatedCep="";
const esc=(value="")=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const brl=value=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(value||0)/100);
const digits=value=>String(value??"").replace(/\D/g,"");
const statusLabel=value=>({
  pending:"Pedido recebido",preparing:"Preparando pedido",ready:"Pronto para envio/retirada",
  shipped:"Enviado",delivered:"Entregue",cancelled:"Cancelado"
}[value]||value);

function notify(message){
  toast.textContent=message;
  toast.classList.add("show");
  clearTimeout(notify.timeout);
  notify.timeout=setTimeout(()=>toast.classList.remove("show"),3200);
}
function showChecking(message="Verificando seu acesso com segurança..."){
  screen.hidden=false;
  $("#sessionLoader").hidden=false;
  $("#sessionActions").hidden=true;
  $("#sessionStatus").textContent=message;
  authView.hidden=true;accountView.hidden=true;recoveryView.hidden=true;
}
function hideChecking(){screen.hidden=true}
function showAuth(message=""){
  accountView.hidden=true;recoveryView.hidden=true;authView.hidden=false;
  authMessage.textContent=message;
  hideChecking();
}
function showRetry(message){
  screen.hidden=false;
  $("#sessionLoader").hidden=true;
  $("#sessionStatus").textContent=message||"Não foi possível carregar sua conta. Seus dados continuam salvos.";
  $("#sessionActions").hidden=false;
  authView.hidden=true;accountView.hidden=true;recoveryView.hidden=true;
}
function showRecovery(){
  authView.hidden=true;accountView.hidden=true;recoveryView.hidden=false;
  hideChecking();
}
function bindPasswordEyes(){
  document.querySelectorAll("[data-toggle-password]").forEach(button=>{
    button.onclick=()=>{
      const input=document.getElementById(button.dataset.togglePassword);
      if(!input)return;
      const visible=input.type==="password";
      input.type=visible?"text":"password";
      button.classList.toggle("is-visible",visible);
      button.setAttribute("aria-label",visible?"Ocultar senha":"Mostrar senha");
    };
  });
}

function fillAddress(address){
  const a=address||{};
  selectedAddressId=a.id||null;
  for(const key of ["id","label","postal_code","number","street","neighborhood","city","state","complement"]){
    if(field(key))field(key).value=a[key]??(key==="label"?"Principal":"");
  }
  field("is_default").checked=address?!!address.is_default:true;
  validatedCep=digits(a.postal_code);
}
function renderAddresses(){
  const addresses=boot?.addresses||[];
  const list=$("#addressList");
  list.innerHTML=addresses.length?addresses.map(a=>
    '<article class="address-item"><div class="address-item-top"><div><strong>'+
    esc(a.label||"Endereço")+(a.is_default?" · principal":"")+
    '</strong><p>'+esc(a.street)+", "+esc(a.number)+(a.complement?" · "+esc(a.complement):"")+
    "<br>"+esc(a.neighborhood)+" · "+esc(a.city)+"/"+esc(a.state)+" · CEP "+esc(a.postal_code)+
    '</p></div></div><div class="address-actions"><button class="account-mini-btn" type="button" data-edit-address="'+esc(a.id)+
    '">Alterar endereço</button><button class="account-mini-btn danger" type="button" data-delete-address="'+esc(a.id)+
    '">Excluir</button></div></article>'
  ).join(""):'<p class="account-hint">Nenhum endereço salvo. Preencha seu endereço acima e clique em Salvar alterações.</p>';
  list.querySelectorAll("[data-edit-address]").forEach(button=>button.onclick=()=>{
    const address=addresses.find(a=>a.id===button.dataset.editAddress);
    if(!address)return;
    fillAddress(address);
    $("#accountSaveMessage").textContent="Alterando "+(address.label||"seu endereço")+". Salve quando terminar.";
    $("#addressCep").focus({preventScroll:true});
    $("#accountDetailsForm").scrollIntoView({behavior:"smooth",block:"start"});
  });
  list.querySelectorAll("[data-delete-address]").forEach(button=>button.onclick=async()=>{
    if(!confirm("Excluir este endereço da sua conta?"))return;
    try{
      await customerPortal({action:"delete_address",id:button.dataset.deleteAddress});
      if(selectedAddressId===button.dataset.deleteAddress)selectedAddressId=null;
      await openAccount({quiet:true});
      notify("Endereço excluído.");
    }catch(error){notify(error.message||"Não foi possível excluir o endereço.")}
  });
}
const storeDate=value=>{
 if(!value)return "Aguardando confirmação";
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return "Data indisponível";
 return new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",
   day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false
 }).format(date)+" (horário de Brasília)";
};
function renderOrders(){
 const orders=boot?.orders||[];
 const maps=raw=>{
   try{
     const url=new URL(raw);
     if(url.protocol!=="https:"||(!/^(maps\.app\.goo\.gl|goo\.gl)$/.test(url.hostname)&&
       !/^((www|maps)\.)?google\.[a-z.]+$/.test(url.hostname)))return null;
     return url.href;
   }catch{return null}
 };
 $("#orderList").innerHTML=orders.length?orders.map(order=>{
   const isPickup=order.delivery_method==="presencial"&&!!order.pickup_location_snapshot;
   const isOnlinePickup=isPickup&&order.payment_channel==="mercadopago";
   const loc=isPickup?order.pickup_location_snapshot:null;
   const map=loc?maps(loc.google_maps_url):null;
   const paid=order.payment_status==="approved";
   const redeemed=isOnlinePickup&&!!order.pickup_redeemed_at;
   const units=(order.items||[]).reduce((n,item)=>n+Number(item.quantity||0),0);
   const pickupDetails=loc?
     '<div class="account-pickup"><strong>Local de retirada: '+esc(loc.display_name||"Retirada com o vendedor")+'</strong><p>'+
     esc(loc.street)+', '+esc(loc.street_number)+(loc.complement?' · '+esc(loc.complement):'')+
     '<br>'+esc(loc.neighborhood)+' · '+esc(loc.city)+'/'+esc(loc.state)+
     (loc.postal_code?'<br>CEP: '+esc(loc.postal_code):'')+'</p>'+
     (map?'<a href="'+esc(map)+'" target="_blank" rel="noopener noreferrer">Abrir Google Maps ↗</a>':'')+
     (loc.instructions?'<p>'+esc(loc.instructions)+'</p>':'')+
     (!redeemed?'<p class="account-warning">Aguarde o pagamento ser confirmado e o pedido ficar pronto antes de ir ao local.</p>':'')+'</div>':"";
   let pickupCodeCard="";
   if(isOnlinePickup){
     if(redeemed){
       pickupCodeCard='<section class="customer-pickup-code is-redeemed" aria-label="Comprovante de entrega">'+
         '<p class="customer-pickup-eyebrow">RETIRADA CONCLUÍDA · CÓDIGO BAIXADO</p>'+
         '<strong class="customer-pickup-number">'+esc(order.pickup_code||"CÓDIGO UTILIZADO")+'</strong>'+
         '<div class="customer-delivery-proof"><strong>PRODUTO(S) ENTREGUE(S)</strong><p>'+esc(units)+' unidade(s) entregue(s) a <b>'+
         esc(order.customer_name)+'</b> pelo vendedor <b>'+esc(order.delivered_by_seller_name||"autorizado AZZENA")+
         '</b> em <b>'+esc(storeDate(order.delivered_at||order.pickup_redeemed_at))+'</b>.</p>'+
         '<p>A entrega foi registrada e este código não pode ser utilizado novamente.</p></div></section>';
     }else if(paid&&order.pickup_code){
       pickupCodeCard='<section class="customer-pickup-code" aria-label="Código de retirada do pedido">'+
         '<p class="customer-pickup-eyebrow">SEU CÓDIGO ÚNICO DE RETIRADA</p>'+
         '<strong class="customer-pickup-number">'+esc(order.pickup_code)+'</strong>'+
         '<button type="button" class="customer-copy-code" data-copy-pickup-code="'+esc(order.pickup_code)+'">COPIAR CÓDIGO</button>'+
         '<p><b>Pagamento confirmado:</b> '+esc(storeDate(order.payment_confirmed_at))+'</p>'+
         '<p><b>Produtos:</b> '+units+' unidade(s). Mostre este código ao vendedor quando retirar.</p>'+
         (order.fulfillment_status==="ready"?'<p class="customer-pickup-ready">PEDIDO PRONTO PARA RETIRADA</p>':
           '<p class="customer-pickup-waiting">Aguarde o vendedor liberar a retirada dos produtos.</p>')+
         '<p class="customer-pickup-instruction">O código é pessoal. Não envie a desconhecidos nem entregue seus produtos a terceiros sem conferir a compra.</p>'+
         '</section>';
     }else if(paid){
       pickupCodeCard='<div class="customer-pickup-waiting">Pagamento confirmado. Estamos preparando seu código de retirada. Esta página atualizará o pedido automaticamente.</div>';
     }else{
       pickupCodeCard='<div class="customer-pickup-waiting"><strong>PAGAMENTO AINDA NÃO CONFIRMADO</strong><p>Seu código será emitido automaticamente após a confirmação do pagamento pela AZZENA. Não faça PIX pessoal ao vendedor.</p></div>';
     }
   }
   const paymentLabels={pending:"Pagamento pendente",approved:"Pagamento aprovado",rejected:"Pagamento recusado",
     cancelled:"Cancelado",refunded:"Estornado"};
   return '<article class="order-item"><div class="order-head"><div><strong>'+esc(order.public_id)+
     '</strong><p>'+new Date(order.created_at).toLocaleString("pt-BR")+'</p></div>'+
     '<span class="order-status">'+esc(redeemed?"Entregue ao cliente":statusLabel(order.fulfillment_status))+'</span></div>'+
     '<div class="order-lines">'+(order.items||[]).map(item=>esc(item.quantity)+"× "+esc(item.product_name)+
        (item.volume_ml?" · "+esc(item.volume_ml)+" mL":"")+" · "+brl(item.line_total_cents)).join("<br>")+'</div>'+
     '<p><strong>'+esc(paymentLabels[order.payment_status]||order.payment_status)+'</strong><br>'+
     (isPickup?'Retirada presencial · sem frete':'Entrega · Frete: '+brl(order.shipping_price_cents)+
       ' · '+esc(order.shipping_carrier||"—")+' / '+esc(order.shipping_service||"—"))+
     '<br>Total: <strong>'+brl(order.total_cents)+'</strong>'+
     (!isPickup&&order.shipping_delivery_days?'<br>Prazo estimado: '+esc(order.shipping_delivery_days)+' dia(s).':'')+
     (!isPickup&&order.tracking_code?'<br>Rastreio: '+esc(order.tracking_code):'')+
     '</p>'+pickupCodeCard+pickupDetails+'</article>';
 }).join(""):'<p class="account-hint">Você ainda não possui pedidos.</p>';
}
let orderRefreshBusy=false;
async function refreshCustomerOrders(){
 if(orderRefreshBusy||accountView.hidden||!loadCustomerSession()||document.visibilityState!=="visible")return;
 orderRefreshBusy=true;
 try{
   const response=await customerPortal({action:"orders"});
   if(boot&&Array.isArray(response.data)){boot.orders=response.data;renderOrders()}
 }catch(error){console.warn("Pedidos: atualização temporariamente indisponível.",error?.message||"")}
 finally{orderRefreshBusy=false}
}
$("#orderList").addEventListener("click",async event=>{
 const button=event.target.closest("[data-copy-pickup-code]");
 if(!button)return;
 const code=button.dataset.copyPickupCode;
 try{
   if(!navigator.clipboard?.writeText)throw new Error("Clipboard unavailable");
   await navigator.clipboard.writeText(code);
   notify("Código de retirada copiado.");
 }catch{
   const field=document.createElement("input");
   field.value=code;field.readOnly=true;
   field.style.position="fixed";field.style.left="-9999px";
   document.body.append(field);field.select();
   const copied=document.execCommand("copy");field.remove();
   notify(copied?"Código de retirada copiado.":"Mantenha o código visível para apresentá-lo ao vendedor.");
 }
});
window.setInterval(refreshCustomerOrders,30000);
document.addEventListener("visibilitychange",()=>{
 if(document.visibilityState==="visible")refreshCustomerOrders();
});
function renderAccount(){
  const profile=boot?.profile||{};
  $("#welcomeName").textContent=profile.full_name?"Olá, "+profile.full_name.split(" ")[0]:"Minha conta";
  field("full_name").value=profile.full_name||"";
  field("email_display").value=loadCustomerSession()?.user?.email||"";
  field("phone").value=profile.phone||"";
  field("whatsapp_opt_in").checked=profile.whatsapp_opt_in!==false;
  const addresses=boot?.addresses||[];
  const selected=addresses.find(a=>a.id===selectedAddressId)||
    addresses.find(a=>a.is_default)||addresses[0]||null;
  fillAddress(selected);
  renderAddresses();
  renderOrders();
  $("#accountSaveMessage").textContent="Altere seus dados e endereço e salve tudo em um só lugar.";
  authView.hidden=true;recoveryView.hidden=true;accountView.hidden=false;
  hideChecking();
  if(location.hash==="#pedidos")requestAnimationFrame(()=>$("#pedidos").scrollIntoView({block:"start"}));
}
async function openAccount({quiet=false}={}){
  if(checking)return;
  checking=true;
  if(!quiet)showChecking();
  try{
    await validCustomerSession();
    boot=(await customerPortal({action:"bootstrap"})).data;
    renderAccount();
  }catch(error){
    const session=loadCustomerSession();
    if(error.message==="LOGIN_REQUIRED"&&!session){
      showAuth("Sua sessão terminou. Entre novamente para continuar.");
    }else if(error.message==="LOGIN_REQUIRED"&&!session?.refresh_token){
      customerSignOut();
      showAuth("Sua sessão terminou. Entre novamente para continuar.");
    }else{
      showRetry("Não conseguimos verificar sua conta agora. Sua sessão está preservada. Confira sua conexão e tente novamente.");
    }
  }finally{checking=false}
}

$("#retryAccountLoad").onclick=()=>openAccount();
$("#leaveAccount").onclick=()=>{customerSignOut();boot=null;showAuth()};
$("#loginForm").onsubmit=async event=>{
  event.preventDefault();
  authMessage.textContent="";
  showChecking("Entrando na sua conta...");
  try{
    await customerSignIn($("#loginEmail").value,$("#loginPassword").value);
    await openAccount();
  }catch(error){showAuth(error.message||"Não foi possível entrar. Confira seu e-mail e sua senha.")}
};
$("#forgotPasswordBtn").onclick=async()=>{
  authMessage.textContent="";
  const email=$("#loginEmail").value.trim();
  if(!email){authMessage.textContent="Digite seu e-mail acima para receber o link de recuperação.";$("#loginEmail").focus();return}
  try{
    await requestPasswordReset(email);
    authMessage.textContent="Enviamos o link para redefinir sua senha. Confira sua caixa de entrada e o spam.";
  }catch(error){authMessage.textContent=error.message}
};
$("#signupForm").onsubmit=async event=>{
  event.preventDefault();
  authMessage.textContent="";
  showChecking("Criando sua conta...");
  try{
    const result=await customerSignUp($("#signupName").value,$("#signupEmail").value,$("#signupPassword").value);
    if(!result.access_token){
      showAuth("Conta criada. Confirme seu e-mail e depois entre normalmente.");
      return;
    }
    await customerPortal({action:"save_profile",full_name:$("#signupName").value,phone:"",whatsapp_opt_in:true});
    await openAccount();
  }catch(error){showAuth(error.message||"Não foi possível criar sua conta.")}
};
$("#logoutBtn").onclick=()=>{customerSignOut();boot=null;showAuth()};
$("#recoveryForm").onsubmit=async event=>{
  event.preventDefault();
  const recovery=recoveryFromHash(),password=$("#newPassword").value,confirmation=$("#confirmPassword").value;
  const message=$("#recoveryMessage");message.textContent="";
  if(!recovery){message.textContent="Este link de recuperação não é mais válido.";return}
  if(password!==confirmation){message.textContent="As senhas não coincidem.";return}
  try{
    await updateRecoveredPassword(recovery.access_token,password);
    history.replaceState(null,"",location.pathname);
    customerSignOut();
    message.textContent="Senha atualizada. Você já pode entrar com a nova senha.";
    authView.hidden=false;accountView.hidden=true;
    hideChecking();
    recoveryView.hidden=true;
    authMessage.textContent="Sua senha foi alterada com sucesso.";
  }catch(error){message.textContent=error.message}
};
$("#newAddressBtn").onclick=()=>{
  fillAddress(null);
  field("label").value=(boot?.addresses||[]).length?"Outro":"Principal";
  field("is_default").checked=!(boot?.addresses||[]).some(a=>a.is_default);
  $("#accountSaveMessage").textContent="Novo endereço: preencha os campos e clique em Salvar alterações.";
  $("#addressCep").focus();
};
$("#addressCep").addEventListener("input",event=>{
  const postal=digits(event.target.value);
  if(postal!==validatedCep){
    field("city").value="";
    field("state").value="";
  }
});
$("#addressCep").addEventListener("blur",async event=>{
  const postal=digits(event.target.value);
  if(postal.length!==8||postal===validatedCep)return;
  try{
    const response=await fetch("https://viacep.com.br/ws/"+postal+"/json/");
    if(!response.ok)throw new Error("Falha ao consultar o CEP.");
    const address=await response.json();
    if(address.erro)throw new Error("CEP não encontrado.");
    if(String(address.uf).toUpperCase()!=="SP")throw new Error("Por enquanto, os envios são apenas para São Paulo.");
    if(digits($("#addressCep").value)!==postal)return;
    field("street").value=address.logradouro||"";
    field("neighborhood").value=address.bairro||"";
    field("city").value=address.localidade||"";
    field("state").value=address.uf||"";
    validatedCep=postal;
  }catch(error){
    validatedCep="";
    field("city").value="";
    field("state").value="";
    notify(error.message||"Não foi possível consultar o CEP.");
  }
});
fields.onsubmit=async event=>{
  event.preventDefault();
  const button=$("#saveAccountButton"),message=$("#accountSaveMessage");
  const full_name=field("full_name").value.trim(),phone=field("phone").value.trim();
  if(!full_name||!phone){message.textContent="Informe nome e telefone com DDD.";return}
  const hasAddress=!!selectedAddressId||[
    "postal_code","street","number","neighborhood","city","state","complement"
  ].some(name=>field(name).value.trim());
  let address=null;
  if(hasAddress){
    address={
      id:field("id").value||null,label:field("label").value.trim()||"Principal",
      postal_code:digits(field("postal_code").value),number:field("number").value.trim(),
      street:field("street").value.trim(),neighborhood:field("neighborhood").value.trim(),
      city:field("city").value.trim(),state:field("state").value.trim(),
      complement:field("complement").value.trim(),is_default:field("is_default").checked
    };
    if(address.postal_code.length!==8||!address.street||!address.number||!address.neighborhood||!address.city||address.state!=="SP"){
      message.textContent="Confira o endereço. Informe um CEP válido de São Paulo e todos os campos obrigatórios.";
      return;
    }
  }
  button.disabled=true;
  button.textContent="SALVANDO...";
  message.textContent="Salvando seus dados...";
  let profileSaved=false;
  try{
    await customerPortal({action:"save_profile",full_name,phone,whatsapp_opt_in:field("whatsapp_opt_in").checked});
    profileSaved=true;
    if(address){
      const saved=await customerPortal({action:"save_address",...address});
      selectedAddressId=saved.data?.id||selectedAddressId;
    }
    boot=(await customerPortal({action:"bootstrap"})).data;
    renderAccount();
    message.textContent="Seus dados"+(address?" e endereço":"")+" foram atualizados com sucesso.";
    notify("Alterações salvas.");
  }catch(error){
    message.textContent=(profileSaved?"Seus dados pessoais foram salvos, mas houve um problema com o endereço ou a atualização: ":"Não foi possível salvar: ")+(error.message||"tente novamente.");
  }finally{button.disabled=false;button.textContent="SALVAR ALTERAÇÕES"}
};

bindPasswordEyes();
if(recoveryFromHash()){
  showRecovery();
}else if(loadCustomerSession()){
  openAccount();
}else{
  showAuth();
}
window.addEventListener("pageshow",event=>{
  if(event.persisted&&loadCustomerSession()&&accountView.hidden)openAccount();
});