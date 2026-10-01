import {SUPABASE_URL,SUPABASE_KEY} from "./admin-api.js?v=20261001-accountui3";
const $=x=>document.querySelector(x),key="azzena-seller-session",money=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n||0)/100);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const orderId=new URLSearchParams(location.search).get("pedido");
let order=null,seller=null;
function status(text){$("#status").textContent=text}
function session(){try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}}
async function token(){
 const s=session();if(!s?.access_token&&!s?.refresh_token)throw new Error("Entre no Painel do Vendedor antes de imprimir.");
 if(s.access_token&&(!s.expires_at||s.expires_at>Date.now()/1000+60))return s.access_token;
 const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:s.refresh_token})});
 const d=await r.json();if(!r.ok)throw new Error("Sua sessão expirou. Entre no Painel do Vendedor novamente.");
 localStorage.setItem(key,JSON.stringify({...s,...d,expires_at:Math.floor(Date.now()/1000)+Number(d.expires_in||3600)}));
 return d.access_token;
}
function render(){
 if(!order)return;
 const pending=order.payment_status!=="approved";
 const location=order.delivery_method==="shipping"?{
  street:order.shipping_street,number:order.shipping_number,complement:order.shipping_complement,
  neighborhood:order.shipping_neighborhood,city:order.shipping_city,state:order.shipping_state,
  postal_code:order.shipping_postal_code
 }:order.customer_address_snapshot||{};
 const hasClientAddress=Boolean(location.street&&location.city);
 const pickup=order.pickup_location_snapshot||{};
 const address=loc=>[loc.street,[loc.number,loc.complement].filter(Boolean).join(" · "),
  loc.neighborhood,[loc.city,loc.state].filter(Boolean).join("/"),loc.postal_code?"CEP "+loc.postal_code:""].filter(Boolean).map(esc).join("<br>");
 $("#printSheet").innerHTML='<header class="lh"><div class="brandprint">AZZENA<small>PARFUMS</small></div><div><div class="order-code">'+esc(order.public_id)+'</div><div class="label-datetime">'+new Date(order.created_at).toLocaleString("pt-BR")+'</div></div></header>'+
 '<div class="label-block"><strong>CLIENTE / DESTINATÁRIO</strong><h2>'+esc(order.customer_name)+'</h2><p>Telefone: '+esc(order.customer_phone)+'</p>'+
 (hasClientAddress?'<p><strong>Endereço do cliente</strong>'+address(location)+'</p>':'<p>Endereço do cliente: não cadastrado — retirada presencial.</p>')+'</div>'+
 (order.delivery_method==="presencial"?'<div class="label-block"><strong>RETIRADA NO LOCAL</strong><p>'+address(pickup)+'</p></div>':'')+
 '<div class="label-block"><strong>ITENS DO PEDIDO</strong><table class="label-items"><thead><tr><th>Produto</th><th>Qtd.</th><th>Valor</th></tr></thead><tbody>'+
 (order.items||[]).map(i=>'<tr><td>'+esc(i.product_name)+' · '+esc(i.volume_ml)+' mL</td><td>'+esc(i.quantity)+'</td><td>'+money(i.line_total_cents)+'</td></tr>').join("")+
 '</tbody></table></div>'+
 (Number(order.discount_cents||0)>0?'<p>Desconto: '+money(order.discount_cents)+'</p>':'')+
 '<p class="label-total">TOTAL: '+money(order.total_cents)+'</p>'+
 (pending?'<div class="label-warning">PAGAMENTO PENDENTE — NÃO ENTREGAR</div>':
 '<div class="label-warning">'+(order.payment_channel==="seller_cash"?"DINHEIRO RECEBIDO · VENDA REGISTRADA":
   order.payment_channel==="mercadopago"&&order.pickup_redeemed_at?"ENTREGA REGISTRADA · CÓDIGO UTILIZADO":
   "PAGO · EXIGIR CÓDIGO AZZ NO PAINEL ANTES DA ENTREGA")+'</div>')+
 '<div class="label-foot">Responsável: '+esc(seller?.name||"Vendedor AZZENA")+'<br>Uso interno · confira o pedido e o endereço antes da entrega.</div>';
 update();
}
function update(){
 const size=$("#labelSize").value,scale=Number($("#labelScale").value),pad=Number($("#labelPadding").value);
 const sheet=$("#printSheet");
 sheet.dataset.size=size;
 sheet.style.padding=(size==="a4"?Math.max(10,pad):pad)+"mm";
 sheet.style.fontSize=(10*scale/100)+"pt";
 const page=document.getElementById("dynamicPage")||document.createElement("style");
 page.id="dynamicPage";
 page.textContent="@media print{@page{size:"+(size==="a4"?"A4 portrait":size==="100x100"?"100mm 100mm":"100mm 150mm")+";margin:0}}";
 document.head.append(page);
 localStorage.setItem("azzena-label-prefs",JSON.stringify({size,scale,pad}));
}
async function load(){
 if(!/^[a-f0-9-]{36}$/i.test(orderId||""))throw new Error("Pedido inválido.");
 const access=await token();
 const response=await fetch(SUPABASE_URL+"/functions/v1/seller-portal",{
 method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+access,"Content-Type":"application/json"},
 body:JSON.stringify({action:"order_label",order_id:orderId})
 });
 const result=await response.json();
 if(!response.ok)throw new Error(result.error==="ORDER_NOT_FOUND"?"Este pedido não pertence à sua conta.":result.error||"Não foi possível carregar a etiqueta.");
 order=result.data.order;seller=result.data.seller;render();status("Etiqueta pronta. Ajuste o tamanho, a escala e a margem conforme sua impressora.");$("#printLabel").disabled=false;
}
try{const pref=JSON.parse(localStorage.getItem("azzena-label-prefs")||"{}");if(["100x150","100x100","a4"].includes(pref.size))$("#labelSize").value=pref.size;if(["85","90","95","100","105","110"].includes(String(pref.scale)))$("#labelScale").value=String(pref.scale);if(["3","5","7","10"].includes(String(pref.pad)))$("#labelPadding").value=String(pref.pad)}catch{}
["labelSize","labelScale","labelPadding"].forEach(id=>$("#"+id).addEventListener("change",update));
$("#printLabel").onclick=()=>window.print();
load().catch(e=>status(e.message));
