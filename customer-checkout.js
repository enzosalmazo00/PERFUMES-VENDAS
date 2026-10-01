import {loadCustomerSession,customerPortal,shippingQuote,customerCheckout} from "./customer-api.js?v=20261001-sessionfix1";

const $=selector=>document.querySelector(selector);
const API_URL="https://fbwlprwhczxjdsciotsi.supabase.co";
const API_KEY="sb_publishable_XkqHZE_hdTNrNXE0O9tvRA_rWdw5pPE";
const escapeHtml=(v="")=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const brl=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n||0));
const money=c=>brl(Number(c||0)/100);
const state={customer:null,method:"pickup",quote:null,pickup:null,pickupCatalog:null,checking:false,gatewayReady:false};
const scopeId=new URLSearchParams(location.search).get("vendedor");
const uuid=value=>/^[0-9a-f-]{36}$/i.test(String(value||""))?String(value):null;
const cart=()=>{try{return JSON.parse(localStorage.getItem("perfumes-demo-bag")||"[]")}catch{return []}};
const items=()=>cart().filter(x=>uuid(x.id)).map(x=>({id:x.id,quantity:Number(x.quantity||1)}));
const chosenSeller=()=>uuid($(".seller-card.is-active")?.dataset?.sellerId)||uuid(scopeId);
const payment=()=>$(".payment-tab.is-active")?.dataset?.payment||"pix";
const customerReady=()=>Boolean(state.customer?.profile?.full_name&&state.customer?.profile?.phone);
function message(text){const toast=$("#toast");if(!toast)return;toast.textContent=text;toast.classList.add("show");clearTimeout(message.timer);message.timer=setTimeout(()=>toast.classList.remove("show"),3600)}
function explain(error){return ({
 LOGIN_REQUIRED:"Entre na sua conta para continuar.",
 PROFILE_INCOMPLETE:"Informe nome e telefone com DDD em Minha Conta.",
 SHIPPING_DISABLED:"Os envios para São Paulo ainda não foram liberados pela loja. Você pode verificar a retirada presencial.",
 ORIGIN_POSTAL_CODE_MISSING:"Falta configurar o CEP de origem no ADM.",
 MELHOR_ENVIO_NOT_CONFIGURED:"O cálculo automático aguarda a ativação do Melhor Envio.",
 STATE_NOT_SUPPORTED:"Por enquanto a entrega é apenas para São Paulo.",
 NO_SHIPPING_OPTIONS:"Nenhuma transportadora disponível para este CEP.",
 PICKUP_NOT_AVAILABLE:"Este vendedor ainda não ativou um ponto de retirada.",
 SELLER_UNAVAILABLE:"O vendedor escolhido não está disponível.",
 SELLER_OUT_OF_STOCK:"Este vendedor ainda não tem estoque disponível para retirada.",
 SELLER_STOCK_UNAVAILABLE:"Um ou mais produtos não estão disponíveis na quantidade escolhida com este vendedor.",
 PRODUCT_UNAVAILABLE:"Um produto da sacola não está disponível.",
 PICKUP_FIELDS_REQUIRED:"Selecione um vendedor antes de continuar.",
 MERCADO_PAGO_NOT_CONFIGURED:"O pagamento online da AZZENA está sendo configurado. Não faça PIX para contas pessoais de vendedores.",
 MERCADO_PAGO_PREFERENCE_FAILED:"O Mercado Pago não conseguiu preparar o pagamento. Tente novamente.",
 SELLER_STOCK_UNAVAILABLE:"A quantidade escolhida acabou de ficar indisponível com este vendedor.",
 PAYMENT_LINK_INVALID:"O link de pagamento não pôde ser validado.",
 PAYMENT_LINK_MISSING:"Não foi possível obter o link de pagamento."
 }[error?.message]||error?.message||"Não foi possível concluir o pedido.")}
function mapsLink(raw){
 try{
  const url=new URL(raw);
  if(url.protocol!=="https:")return null;
  if(!/^(maps\.app\.goo\.gl|goo\.gl)$/.test(url.hostname)&&!/^((www|maps)\.)?google\.[a-z.]+$/.test(url.hostname))return null;
  return url.href;
 }catch{return null}
}
function subtotal(){return cart().reduce((sum,row)=>sum+Number(row.unit_price_cents||0)*Number(row.quantity||1),0)}
function renderTotals(){
 const el=$("#checkoutFinalTotal");
 if(!el)return;
 const shipping=state.method==="pickup"?0:Math.round(Number(state.quote?.price||0)*100);
 el.innerHTML='<span>Produtos: '+money(subtotal())+'</span><span>Frete: '+
  (state.method==="pickup"?"Grátis — retirada presencial":state.quote?money(shipping):"Calcule o frete")+
  '</span><strong>Total: '+money(subtotal()+shipping)+'</strong>';
}
function canSubmit(){
 const ready=customerReady()&&items().length>0;
 return ready&&(state.method==="pickup"?!!state.pickup:!!state.quote);
}
function renderReady(){
 const button=$("#checkoutSubmit");
 if(!button)return;
 button.disabled=!canSubmit()||!state.gatewayReady;
 if(!state.gatewayReady){
   button.textContent="PAGAMENTO ONLINE AGUARDANDO ATIVAÇÃO";
   return renderTotals();
 }
 button.textContent="PAGAR COM SEGURANÇA NA AZZENA";
 renderTotals();
}
async function publicSellerCatalog(sellerId){
 const response=await fetch(API_URL+"/rest/v1/rpc/public_seller_catalog",{
  method:"POST",headers:{apikey:API_KEY,Accept:"application/json","Content-Type":"application/json"},
  body:JSON.stringify({p_seller_id:sellerId})
 });
 if(!response.ok)throw new Error("Não foi possível consultar o catálogo do vendedor.");
 return response.json();
}
async function loadPickup(){
 const box=$("#pickupAvailability");
 state.pickup=null;state.pickupCatalog=null;renderReady();
 const sellerId=chosenSeller();
 if(!sellerId){
  box.textContent="Selecione acima o vendedor com quem deseja retirar seu pedido.";
  return;
 }
 box.textContent="Consultando endereço e estoque do vendedor...";
 try{
  const catalog=await publicSellerCatalog(sellerId);
  if(chosenSeller()!==sellerId)return;
  state.pickupCatalog=catalog;
  if(!catalog?.seller||!catalog.pickup){
   box.textContent="Este vendedor ainda não habilitou a retirada presencial. Selecione outro ou escolha entrega.";
   return;
  }
  const available=new Map((catalog.products||[]).map(p=>[p.id,Number(p.stock||0)]));
  if(items().some(row=>Number(available.get(row.id)||0)<row.quantity)){
   box.textContent="Alguns produtos da sua sacola não estão disponíveis com este vendedor. Consulte o catálogo dele ou escolha entrega.";
   return;
  }
  const pickup=catalog.pickup;
  const map=mapsLink(pickup.google_maps_url);
  box.innerHTML='<div class="pickup-location-card"><strong>'+escapeHtml(pickup.display_name||"Retirada com o vendedor")+
   '</strong><p>'+escapeHtml(pickup.street)+', '+escapeHtml(pickup.street_number)+
   (pickup.complement?' · '+escapeHtml(pickup.complement):'')+'<br>'+escapeHtml(pickup.neighborhood)+
   ' · '+escapeHtml(pickup.city)+'/'+escapeHtml(pickup.state)+
   (pickup.postal_code?'<br>CEP: '+escapeHtml(pickup.postal_code):'')+'</p>'+
   (map?'<a href="'+escapeHtml(map)+'" target="_blank" rel="noopener noreferrer">Ver endereço no Google Maps ↗</a>':'')+
   (pickup.instructions?'<p><strong>Orientações:</strong> '+escapeHtml(pickup.instructions)+'</p>':'')+
   '<p>Retirada somente após confirmação do pagamento e liberação pelo vendedor.</p></div>';
  state.pickup=pickup;
 }catch(error){box.textContent=explain(error)}
 renderReady();
}
async function loadCustomer(){
 if(state.checking)return;
 state.checking=true;
 const box=$("#checkoutCustomerBox"),address=$("#checkoutAddressSelect");
 state.quote=null;state.pickup=null;
 $("#shippingQuotes").replaceChildren();
 renderReady();
 if(!loadCustomerSession()){
  state.customer=null;
  box.innerHTML='<div class="checkout-login-call"><strong>Entre na sua conta</strong><p>Salve seu telefone e endereço para acompanhar seus pedidos.</p><a class="gold-button" href="conta.html">ENTRAR / CRIAR CONTA</a></div>';
  $("#shippingArea").hidden=true;
  $("#pickupArea").hidden=state.method!=="pickup";
  if(state.method==="pickup")await loadPickup();
  state.checking=false;return;
 }
 box.innerHTML='<div class="checkout-login-call">Verificando sua conta AZZENA...</div>';
 try{
  const [account,gate]=await Promise.all([
    customerPortal({action:"bootstrap"}),
    customerCheckout({action:"gateway_status"})
  ]);
  state.customer=account.data;
  state.gatewayReady=gate.data?.online_configured===true;
  const note=$("#paymentSetupNotice");
  if(note){
    note.hidden=state.gatewayReady;
    if(!state.gatewayReady)note.textContent="O pagamento seguro à AZZENA está em configuração. O pedido online só poderá ser finalizado quando a loja ativar o Mercado Pago. Nunca pague PIX pessoal de vendedor.";
  }
  const profile=state.customer.profile||{};
  box.innerHTML='<div class="checkout-customer-ok"><span>Cliente</span><strong>'+escapeHtml(profile.full_name||"Conta cadastrada")+
   '</strong><a href="conta.html">Editar dados</a></div>';
  address.replaceChildren();
  for(const row of state.customer.addresses||[]){
   const opt=new Option((row.label||"Endereço")+" · "+row.city+"/"+row.state+" · "+row.postal_code,row.id);
   address.append(opt);
  }
  if(!address.options.length)address.add(new Option("Cadastre um endereço em Minha Conta",""));
  $("#calculateShipping").disabled=!address.options.length||!address.value;
  $("#shippingPublicNote").textContent=state.customer.shipping?.public_note||"Entrega disponível para o Estado de São Paulo.";
  if(!customerReady())message("Complete seu nome e telefone em Minha Conta antes de finalizar o pedido.");
 }catch(error){
  state.gatewayReady=false;
  const note=$("#paymentSetupNotice");if(note){note.hidden=false;note.textContent="Não foi possível validar o pagamento da loja. Tente novamente mais tarde; não faça transferências pessoais."}
  state.customer=null;
  box.innerHTML='<div class="checkout-login-call"><strong>Não foi possível verificar seus dados agora.</strong><p>Sua sessão foi preservada. Tente novamente ou consulte Minha Conta.</p><a href="conta.html" class="gold-button">MINHA CONTA</a></div>';
 }
 state.checking=false;
 $("#shippingArea").hidden=true;
 $("#pickupArea").hidden=state.method!=="pickup";
 if(state.method==="pickup")await loadPickup();
 renderReady();
}
function setMode(method){
 state.method="pickup";
 state.quote=null;state.pickup=null;
 document.querySelectorAll("[data-checkout-method]").forEach(btn=>btn.classList.toggle("is-active",btn.dataset.checkoutMethod===state.method));
 $("#shippingArea").hidden=state.method!=="shipping";
 $("#pickupArea").hidden=state.method!=="pickup";
 loadPickup();
 renderReady();
}
async function calculateShipping(){
 if(!customerReady())return message("Entre ou complete seus dados antes de calcular o frete.");
 const addressId=$("#checkoutAddressSelect").value;
 if(!addressId)return message("Cadastre um endereço de São Paulo em Minha Conta.");
 const box=$("#shippingQuotes");
 state.quote=null;renderReady();
 box.textContent="Consultando as transportadoras...";
 try{
  const response=await shippingQuote({address_id:addressId,items:items()});
  const quotes=response.data?.quotes||[];
  if(!quotes.length)throw new Error("NO_SHIPPING_OPTIONS");
  box.innerHTML=quotes.map((option,index)=>
    '<button type="button" class="shipping-option" data-quote-index="'+index+'"><span><strong>'+
    escapeHtml(option.carrier)+' · '+escapeHtml(option.service_name)+'</strong><small>'+
    escapeHtml(option.delivery_days)+' dia(s) estimados</small></span><b>'+brl(option.price)+'</b></button>'
  ).join("");
  box.querySelectorAll("[data-quote-index]").forEach(btn=>btn.onclick=()=>{
   state.quote=quotes[Number(btn.dataset.quoteIndex)];
   box.querySelectorAll(".shipping-option").forEach(other=>other.classList.toggle("is-active",other===btn));
   renderReady();
  });
 }catch(error){box.textContent=explain(error)}
 renderReady();
}
async function submitOrder(event){
 event.preventDefault();
 if(!state.customer){location.href="conta.html";return}
 if(!customerReady()){message("Complete seu perfil em Minha Conta.");return}
 if(!canSubmit()){message("Escolha e confirme uma opção de entrega ou retirada.");return}
 if(!state.gatewayReady){message("O pagamento seguro da AZZENA ainda não foi ativado.");return}
 const submit=$("#checkoutSubmit");submit.disabled=true;submit.textContent="REGISTRANDO PEDIDO...";
 try{
  let response;
  if(state.method==="pickup"){
   response=await customerCheckout({
    action:"create_pickup_order",seller_id:chosenSeller(),
    payment_method:payment(),items:items()
   });
  }else{
   response=await customerCheckout({
    action:"create_shipping_order",address_id:$("#checkoutAddressSelect").value,
    service_id:state.quote.service_id,seller_id:chosenSeller(),
    payment_method:payment(),items:items()
   });
  }
  const url=String(response.data?.checkout_url||"");
  let target;
  try{target=new URL(url)}catch{throw new Error("PAYMENT_LINK_MISSING")}
  const host=target.hostname.toLowerCase();
  if(target.protocol!=="https:"||!["mercadopago.com","mercadopago.com.br"].some(domain=>host===domain||host.endsWith("."+domain)))
    throw new Error("PAYMENT_LINK_INVALID");
  location.assign(target.href);
 }catch(error){message(explain(error));renderReady()}
}
function start(){
 const form=$("#checkoutForm");
 if(!form)return;
 document.querySelectorAll("[data-checkout-method]").forEach(b=>{b.hidden=b.dataset.checkoutMethod!=="pickup";b.classList.toggle("is-active",b.dataset.checkoutMethod==="pickup")});
 $("#shippingArea").hidden=true;
 $("#pickupArea").hidden=false;
 form.onsubmit=submitOrder;
 document.querySelectorAll("[data-checkout-method]").forEach(btn=>btn.onclick=()=>setMode(btn.dataset.checkoutMethod));
 $("#calculateShipping").onclick=calculateShipping;
 $("#checkoutAddressSelect").onchange=()=>{state.quote=null;$("#shippingQuotes").replaceChildren();renderReady()};
 $("#sellerPicker").addEventListener("click",()=>{if(state.method==="pickup")setTimeout(loadPickup,0)});
 document.addEventListener("azzena:seller-changed",()=>{if(state.method==="pickup")loadPickup()});
 $("#checkoutBtn").addEventListener("click",()=>{setTimeout(loadCustomer,0)});
 // A aba de pagamento e a divulgação dos encargos são sincronizadas pelo app.js.
 // Nunca anunciar confirmação manual: a cobrança depende do retorno oficial do gateway.
 renderReady();
}
start();
