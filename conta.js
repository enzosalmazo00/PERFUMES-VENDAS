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
function pendingReviewOrders(){
 return (boot?.orders||[]).filter(order=>order.payment_channel==="mercadopago"&&order.payment_status==="approved"&&(order.items||[]).some(item=>!(order.reviews||[]).some(review=>review.product_id===item.product_id)));
}
function closeReviewModal(){
 const modal=$("#reviewOverlay");if(modal)modal.hidden=true;document.body.style.overflow="";
 const url=new URL(location.href);
 for(const key of ["avaliar","pedido","collection_id","payment_id","collection_status","status","external_reference","merchant_order_id","preference_id"]){url.searchParams.delete(key)}
 history.replaceState(null,"",url.pathname+url.search+url.hash);
}
function renderReviewModal(order){
 const list=$("#reviewProductList");if(!list)return;
 const reviewed=new Set((order.reviews||[]).map(r=>r.product_id));
 list.replaceChildren();
 for(const item of order.items||[]){
   const card=document.createElement("section");card.className="review-product";
   if(reviewed.has(item.product_id)){card.innerHTML="<h3>"+esc(item.product_name)+"</h3><p class=\"review-done\">Avaliação enviada como compra verificada.</p>";list.append(card);continue}
   const title=document.createElement("h3");title.textContent=item.product_name;
   const meta=document.createElement("small");meta.textContent=(item.volume_ml?item.volume_ml+" mL · ":"")+"Compra verificada";
   const stars=document.createElement("div");stars.className="review-stars";stars.setAttribute("role","group");stars.setAttribute("aria-label","Nota de zero a cinco estrelas");
   const label=document.createElement("span");label.className="review-rating-label";label.textContent="0 de 5";
   let rating=0,ratingSelected=false;
   for(let value=1;value<=5;value++){const star=document.createElement("button");star.type="button";star.className="review-star";star.textContent="★";star.setAttribute("aria-label",value+" estrela"+(value>1?"s":""));star.onclick=()=>{rating=value;ratingSelected=true;[...stars.querySelectorAll(".review-star")].forEach((s,i)=>s.classList.toggle("is-active",i<rating));label.textContent=rating+" de 5"};stars.append(star)}
   const zero=document.createElement("button");zero.type="button";zero.className="account-mini-btn";zero.textContent="0 estrela";zero.onclick=()=>{rating=0;ratingSelected=true;stars.querySelectorAll(".review-star").forEach(s=>s.classList.remove("is-active"));label.textContent="0 de 5"};
   const comment=document.createElement("textarea");comment.maxLength=1200;comment.minLength=5;comment.placeholder="Escreva seu comentário sobre o produto...";
   const submit=document.createElement("button");submit.type="button";submit.className="review-submit";submit.textContent="PUBLICAR AVALIAÇÃO";
   submit.onclick=async()=>{const text=comment.value.trim();if(!ratingSelected){$("#reviewMessage").textContent="Selecione de 0 a 5 estrelas.";return}if(text.length<5){$("#reviewMessage").textContent="Escreva pelo menos 5 caracteres no comentário.";return}submit.disabled=true;try{await customerPortal({action:"review_product",order_id:order.id,product_id:item.product_id,rating,comment:text});$("#reviewMessage").textContent="Avaliação publicada. Obrigado por compartilhar sua experiência.";const response=await customerPortal({action:"orders"});if(boot&&Array.isArray(response.data)){boot.orders=response.data;renderOrders();const updated=boot.orders.find(o=>o.id===order.id);if(updated)renderReviewModal(updated)}}catch(error){$("#reviewMessage").textContent=error?.message==="REVIEW_ALREADY_EXISTS"?"Este produto já foi avaliado.":"Não foi possível publicar a avaliação agora."}finally{submit.disabled=false}};
   card.append(title,meta,stars,label,zero,comment,submit);list.append(card);
 }
 $("#reviewOverlay").hidden=false;document.body.style.overflow="hidden";
}
function maybePromptReview(){
 const params=new URLSearchParams(location.search),requested=params.get("avaliar")==="1",requestId=params.get("pedido");
 const candidates=pendingReviewOrders();
 const order=(requested&&requestId?candidates.find(o=>o.id===requestId):candidates[0]);
 if(!order){
   if(requested)notify("Sua avaliação será liberada assim que o Mercado Pago confirmar o pagamento.");
   return false;
 }
 const key="azzena-review-prompt-"+order.id;
 if(sessionStorage.getItem(key))return false;
 sessionStorage.setItem(key,"shown");renderReviewModal(order);return true;
}
async function loadCustomCustomerSales(){
 const box=$("#customSaleList");if(!box)return;
 try{
  const session=loadCustomerSession();if(!session?.access_token)return;
  const headers={apikey:SUPABASE_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"};
  await fetch(SUPABASE_URL+"/rest/v1/rpc/claim_customer_custom_sales",{method:"POST",headers,body:"{}"});
  const res=await fetch(SUPABASE_URL+"/rest/v1/custom_sales?select=*&order=created_at.desc",{headers});if(!res.ok)throw new Error();
  const rows=await res.json();box.innerHTML=rows.length?rows.map(s=>'<article class="order-item custom-customer-sale"><div class="order-head"><div><strong>'+esc(s.public_id)+'</strong><p>'+new Date(s.created_at).toLocaleString("pt-BR")+'</p></div><span class="order-status">'+esc(s.status==="pending_payment"?"Aguardando pagamento":s.status==="paid"?"Pago":s.status==="shipped"?"Enviado":s.status)+'</span></div><div class="order-lines">'+esc(s.quantity)+'× '+esc(s.product_name)+(s.volume_ml?" · "+esc(s.volume_ml)+" mL":"")+'</div><p>Produto: <strong>'+brl(Number(s.unit_price_cents)*Number(s.quantity))+'</strong><br>Frete combinado: <strong>'+brl(s.shipping_price_cents)+'</strong><br>Total: <strong>'+brl(s.total_cents)+'</strong></p>'+(s.customer_postal_code?'<p>CEP informado: '+esc(s.customer_postal_code)+'</p>':"")+(s.status==="pending_payment"?'<div class="custom-payment-pending"><strong>Pagamento ainda não ativado</strong><p>PIX com QR Code e cartão serão habilitados aqui quando a conta Mercado Pago deste vendedor estiver conectada. Nenhuma taxa PIX será acrescentada ao seu total.</p><button type="button" disabled>PAGAR — AGUARDANDO MERCADO PAGO</button></div>':'<p><strong>Pagamento registrado:</strong> '+esc(s.payment_method||"Mercado Pago")+(s.payment_confirmed_at?" · "+esc(storeDate(s.payment_confirmed_at)):"")+'</p>')+(s.tracking_code?'<p>Rastreio informado: <strong>'+esc(s.tracking_code)+'</strong></p>':"")+'</article>').join(""):'<p class="account-hint">Nenhuma venda personalizada vinculada à sua conta.</p>';
 }catch{box.innerHTML='<p class="account-hint">Não foi possível carregar as vendas personalizadas agora.</p>'}
}
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
         '<p>A retirada foi registrada, a transação comercial referente a este pedido foi encerrada e este código não pode ser utilizado novamente.</p><p><b>Agradecemos sua compra na AZZENA PARFUMS.</b></p></div></section>';
     }else if(paid&&order.pickup_code){
       pickupCodeCard='<section class="customer-pickup-code" aria-label="Código de retirada do pedido">'+
         '<p class="customer-pickup-eyebrow">SEU CÓDIGO ÚNICO DE RETIRADA</p>'+
         '<strong class="customer-pickup-number">'+esc(order.pickup_code)+'</strong>'+
         '<button type="button" class="customer-copy-code" data-copy-pickup-code="'+esc(order.pickup_code)+'">COPIAR CÓDIGO</button>'+
         '<p><b>Pagamento confirmado:</b> '+esc(storeDate(order.payment_confirmed_at))+'</p>'+
         '<p><b>Produtos:</b> '+units+' unidade(s). Mostre este código ao vendedor somente no momento da retirada.</p><div class="customer-pickup-declaration"><strong>ATENÇÃO AO INFORMAR O CÓDIGO</strong><p>Ao informar este código ao vendedor, você declara que retirou o(s) produto(s) deste pedido. Após a validação do código, a retirada será registrada e a transação comercial referente a este pedido será considerada encerrada.</p><p>Agradecemos sua compra na AZZENA PARFUMS.</p></div>'+
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
   const reviewedProducts=new Set((order.reviews||[]).map(r=>r.product_id));
    const stillToRate=[...new Set((order.items||[]).map(i=>i.product_id).filter(Boolean))].filter(id=>!reviewedProducts.has(id));
    const reviewButton=paid&&order.payment_channel==="mercadopago"
      ?'<div class="order-review-action">'+(stillToRate.length
        ?'<button type="button" data-rate-order="'+esc(order.id)+'">★ AVALIAR SUA COMPRA</button>'
        :'<span>Avaliações deste pedido enviadas.</span>')+'</div>'
      :'';
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
     '</p>'+pickupCodeCard+pickupDetails+reviewButton+'</article>';
 }).join(""):'<p class="account-hint">Você ainda não possui pedidos.</p>';
}
let orderRefreshBusy=false;
async function refreshCustomerOrders(){
 if(orderRefreshBusy||accountView.hidden||!loadCustomerSession()||document.visibilityState!=="visible")return;
 orderRefreshBusy=true;
 try{
   const response=await customerPortal({action:"orders"});
   if(boot&&Array.isArray(response.data)){const before=new Set(pendingReviewOrders().map(o=>o.id));boot.orders=response.data;renderOrders();if(pendingReviewOrders().some(o=>!before.has(o.id)))maybePromptReview()}
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
$("#orderList").addEventListener("click",event=>{
 const button=event.target.closest("[data-rate-order]");if(!button)return;
 const order=(boot?.orders||[]).find(o=>o.id===button.dataset.rateOrder);
 if(order&&order.payment_status==="approved"&&order.payment_channel==="mercadopago")renderReviewModal(order);
});
$("#closeReview").onclick=closeReviewModal;
$("#reviewOverlay").onclick=event=>{if(event.target===$("#reviewOverlay"))closeReviewModal()};
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!$("#reviewOverlay").hidden)closeReviewModal()});
window.setInterval(refreshCustomerOrders,30000);
if(new URLSearchParams(location.search).get("avaliar")==="1"){
 let attempts=0;
 const fastRefresh=window.setInterval(()=>{
  if(++attempts>15||!$("#reviewOverlay").hidden){clearInterval(fastRefresh);return}
  refreshCustomerOrders();
 },4000);
}
document.addEventListener("visibilitychange",()=>{
 if(document.visibilityState==="visible")refreshCustomerOrders();
});
function renderAccount(){
  loadCustomCustomerSales();
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
  window.setTimeout(maybePromptReview,350);
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