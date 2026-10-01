import{loadCustomerSession,customerPortal,shippingQuote,customerCheckout}from"./customer-api.js?v=20261001-account1";
const $=s=>document.querySelector(s);
const brlValue=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v||0));
const esc=(v="")=>String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
let boot=null,selectedQuote=null;

function bag(){try{return JSON.parse(localStorage.getItem("perfumes-demo-bag")||"[]")}catch{return[]}}
function cartItems(){return bag().map(i=>({id:i.id,quantity:Number(i.quantity||1)}))}
function sellerId(){return document.querySelector(".seller-card.is-active")?.dataset?.sellerId||null}
function payment(){return document.querySelector(".payment-tab.is-active")?.dataset?.payment||"pix"}
function notify(m){const t=$("#toast");if(!t)return;t.textContent=m;t.classList.add("show");clearTimeout(notify.t);notify.t=setTimeout(()=>t.classList.remove("show"),2800)}
function errorText(code){
  return ({
    LOGIN_REQUIRED:"Entre na sua conta para calcular o frete.",
    PROFILE_INCOMPLETE:"Complete seu nome e WhatsApp na área Minha Conta.",
    SHIPPING_DISABLED:"Os envios ainda não foram liberados pela loja.",
    ORIGIN_POSTAL_CODE_MISSING:"O cálculo de frete está sendo configurado pela loja.",
    MELHOR_ENVIO_NOT_CONFIGURED:"A integração de frete está pronta e aguarda a ativação do Melhor Envio.",
    STATE_NOT_SUPPORTED:"No momento enviamos somente para o Estado de São Paulo.",
    NO_SHIPPING_OPTIONS:"Nenhuma opção de frete foi encontrada para esse CEP.",
    PRODUCT_UNAVAILABLE:"Um dos produtos da sacola não está mais disponível."
  }[code]||code||"Não foi possível calcular o frete.")
}
async function loadCustomer(){
  const box=$("#checkoutCustomerBox"),address=$("#checkoutAddressSelect"),quotes=$("#shippingQuotes");
  selectedQuote=null;if(quotes)quotes.innerHTML="";
  if(!loadCustomerSession()?.access_token){
    boot=null;
    box.innerHTML='<div class="checkout-login-call"><strong>Entre para receber em São Paulo</strong><p>Seu cadastro mantém endereço, telefone e histórico de pedidos salvos.</p><a href="conta.html" class="gold-button">ENTRAR / CRIAR CONTA</a></div>';
    $("#shippingArea").hidden=true;return;
  }
  try{
    boot=(await customerPortal({action:"bootstrap"})).data;
    const p=boot.profile||{};
    box.innerHTML='<div class="checkout-customer-ok"><span>Cliente</span><strong>'+esc(p.full_name||"Conta cadastrada")+'</strong><a href="conta.html">Editar meus dados</a></div>';
    $("#shippingArea").hidden=false;
    const rows=boot.addresses||[];
    address.innerHTML=rows.length?rows.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.label)+" · "+esc(a.city)+"/"+esc(a.state)+" · "+esc(a.postal_code)+'</option>').join(""):'<option value="">Cadastre um endereço primeiro</option>';
    $("#calculateShipping").disabled=!rows.length;
    $("#shippingPublicNote").textContent=boot.shipping?.public_note||"Envios disponíveis para o Estado de São Paulo.";
    if(!rows.length)quotes.innerHTML='<p class="shipping-message">Você ainda não possui endereço. <a href="conta.html">Cadastrar endereço</a></p>';
  }catch(e){
    box.innerHTML='<div class="checkout-login-call"><strong>Sessão expirada</strong><p>Entre novamente para continuar.</p><a href="conta.html" class="gold-button">ENTRAR</a></div>';
    $("#shippingArea").hidden=true;
  }
}
async function calculateShipping(){
  const addressId=$("#checkoutAddressSelect")?.value;if(!addressId)return notify("Cadastre ou selecione um endereço.");
  const q=$("#shippingQuotes");q.innerHTML='<p class="shipping-message">Calculando opções de frete...</p>';selectedQuote=null;$("#checkoutSubmit").disabled=true;
  try{
    const r=await shippingQuote({address_id:addressId,items:cartItems()});const quotes=r.data?.quotes||[];
    q.innerHTML=quotes.map((x,i)=>'<button type="button" class="shipping-option" data-quote-index="'+i+'"><span><strong>'+esc(x.carrier)+" · "+esc(x.service_name)+'</strong><small>'+esc(x.delivery_days)+' dia(s) estimados</small></span><b>'+brlValue(x.price)+'</b></button>').join("");
    q.querySelectorAll("[data-quote-index]").forEach(b=>b.onclick=()=>{selectedQuote=quotes[Number(b.dataset.quoteIndex)];q.querySelectorAll(".shipping-option").forEach(x=>x.classList.toggle("is-active",x===b));$("#checkoutSubmit").disabled=false;renderFinalTotal()});
  }catch(e){q.innerHTML='<p class="shipping-message shipping-error">'+esc(errorText(e.message))+'</p>';$("#checkoutSubmit").disabled=true}
}
function subtotalCents(){return bag().reduce((s,i)=>s+Number(i.unit_price_cents||0)*Number(i.quantity||1),0)}
function renderFinalTotal(){const el=$("#checkoutFinalTotal");if(!el)return;const ship=Math.round(Number(selectedQuote?.price||0)*100);el.innerHTML='<span>Produtos: '+brlValue(subtotalCents()/100)+'</span><span>Frete: '+(selectedQuote?brlValue(selectedQuote.price):"—")+'</span><strong>Total: '+brlValue((subtotalCents()+ship)/100)+'</strong>'}
async function submitOrder(e){
  e.preventDefault();
  if(!loadCustomerSession()?.access_token)return location.href="conta.html";
  const addressId=$("#checkoutAddressSelect")?.value;if(!addressId)return notify("Selecione o endereço de entrega.");
  if(!selectedQuote)return notify("Calcule e selecione uma opção de frete.");
  const btn=$("#checkoutSubmit");btn.disabled=true;btn.textContent="CRIANDO PEDIDO...";
  try{
    const r=await customerCheckout({action:"create_shipping_order",address_id:addressId,service_id:selectedQuote.service_id,seller_id:sellerId(),payment_method:payment(),items:cartItems()});
    localStorage.setItem("perfumes-demo-bag","[]");
    const id=r.data?.order?.public_id||"";
    alert("Pedido "+id+" criado com sucesso. Você pode acompanhar tudo em Minha Conta.");
    location.href="conta.html#pedidos";
  }catch(err){notify(errorText(err.message));btn.disabled=false;btn.textContent="CRIAR PEDIDO"}
}
function install(){
  const form=$("#checkoutForm");if(!form)return;
  form.onsubmit=submitOrder;
  $("#calculateShipping").onclick=calculateShipping;
  $("#checkoutAddressSelect").onchange=()=>{selectedQuote=null;$("#shippingQuotes").innerHTML="";$("#checkoutSubmit").disabled=true;renderFinalTotal()};
  document.querySelectorAll(".payment-tab").forEach(b=>b.addEventListener("click",()=>setTimeout(()=>{const demo=$("#paymentDemoBox");if(demo)demo.innerHTML='<strong>'+payment().toUpperCase()+'</strong><p>O pedido será criado com pagamento pendente para confirmação no fechamento.</p>'},0)));
  $("#checkoutBtn")?.addEventListener("click",()=>setTimeout(()=>{loadCustomer();renderFinalTotal()},0));
  if(location.hash==="#checkout")setTimeout(()=>$("#checkoutBtn")?.click(),100);
}
install();
