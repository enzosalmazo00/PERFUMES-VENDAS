import {openSellerLabel} from "./seller-labels.js?v=20261001-sales5";
const $=s=>document.querySelector(s);
const brl=c=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(c||0)/100);
let services=null,initialized=false,poll=null,orderData=[],inventory=[],cart=[],notifications=[],saleKey=null;
const int=c=>Math.round(Number(c||0)*100);
const number=v=>Number(v??0);
const digits=v=>String(v||"").replace(/\D/g,"");
const safe=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
function grouped(){
 const map=new Map();
 for(const row of inventory){
  if(!row.is_active||Number(row.quantity)<=0)continue;
  let p=map.get(row.product_id);
  if(!p){p={id:row.product_id,name:row.product_name,volume_ml:row.volume_ml,quantity:0,
    price_cents:row.price_cents,sale_price_cents:row.sale_price_cents,
    max_discount_percent:Number(row.max_discount_percent||0)};map.set(row.product_id,p)}
  p.quantity+=Number(row.quantity);
 }
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
}
function product(id){return grouped().find(x=>x.id===id)}
function moneyInfo(){
 let gross=0,discount=0;
 for(const row of cart){
  const base=row.unit_price_cents*row.quantity;
  gross+=base;
  discount+=Math.round(base*row.discount_percent/100);
 }
 return{gross,discount,total:gross-discount};
}
function renderTotals(){
 const t=moneyInfo();
 $("#sellerCashSubtotal").textContent=brl(t.gross);
 $("#sellerCashTotalDiscount").textContent="- "+brl(t.discount);
 $("#sellerCashTotal").textContent=brl(t.total);
 const got=int($("#sellerCashReceived").value);
 const change=got-t.total;
 $("#sellerCashChange").textContent=brl(Math.max(0,change));
 $("#sellerCashChange").style.color=change<0?"#ff9292":"#ecc780";
}
function renderCart(){
 const body=$("#sellerCashItems");
 body.innerHTML=cart.length?cart.map((item,index)=>{
  const total=item.unit_price_cents*item.quantity;
  const discount=Math.round(total*item.discount_percent/100);
  return '<tr><td>'+safe(item.name)+' · '+safe(item.volume_ml)+' mL</td><td>'+item.quantity+'</td><td>'+
    brl(item.unit_price_cents)+'</td><td>'+item.discount_percent.toLocaleString("pt-BR")+
    '%<br><small>- '+brl(discount)+'</small></td><td>'+brl(total-discount)+'</td>'+
    '<td><button type="button" class="seller-outline seller-remove-cash" data-cash-remove="'+index+'" aria-label="Remover produto">×</button></td></tr>';
 }).join(""):'<tr><td colspan="6">Selecione os produtos acima.</td></tr>';
 renderTotals();
}
function setProductLimit(){
 const p=product($("#sellerCashProduct").value);
 const limit=p?Number(p.max_discount_percent||0):0;
 $("#sellerCashDiscount").max=limit;
 $("#sellerCashDiscountLimit").textContent=p?
    "Máximo permitido: "+limit.toLocaleString("pt-BR")+"% · Em estoque: "+p.quantity:
    "O ADM define o desconto máximo por produto.";
 if(number($("#sellerCashDiscount").value)>limit)$("#sellerCashDiscount").value=String(limit);
}
function prepareInventory(){
 const select=$("#sellerCashProduct"),old=select.value,rows=grouped();
 select.replaceChildren(new Option("Selecione um perfume do seu estoque",""));
 for(const p of rows){
  select.append(new Option(p.name+" · "+p.volume_ml+" mL · "+brl(p.sale_price_cents??p.price_cents)+" · saldo "+p.quantity,p.id));
 }
 if(rows.some(p=>p.id===old))select.value=old;
 setProductLimit();
}
function notificationText(note){
 const date=new Date(note.created_at).toLocaleString("pt-BR");
 return '<button type="button" class="seller-notification'+(!note.is_read?" is-unread":"")+
 '" data-notification-id="'+safe(note.id)+'" data-order-id="'+safe(note.order_id)+'">'+
 '<strong>'+safe(note.title)+'</strong><span>'+safe(note.message)+'</span><small>'+date+'</small></button>';
}
function renderNotifications(){
 const unread=notifications.filter(n=>!n.is_read).length;
 const badge=$("#sellerNotificationCount");
 badge.hidden=unread===0;badge.textContent=unread>99?"99+":String(unread);
 $("#sellerNotificationBell").setAttribute("aria-label",unread+" notificação(ões) não lida(s)");
 $("#sellerMarkAllRead").disabled=unread===0;
 $("#sellerNotificationList").innerHTML=notifications.length?
  notifications.map(notificationText).join(""):'<p class="muted">Nenhuma notificação de venda ainda.</p>';
}
async function fetchNotifications(){
 if(!services||$("#app").hidden)return;
 try{
  const data=(await services.call("seller-portal",{action:"notifications"})).data||{};
  notifications=data.notifications||[];
  renderNotifications();
 }catch{ /* Não apagar notificações já recebidas durante falhas de rede. */ }
}
async function markRead(ids){
 if(!ids.length)return;
 await services.call("seller-portal",{action:"mark_notifications_read",ids});
 notifications=notifications.map(n=>ids.includes(n.id)?{...n,is_read:true}:n);
 renderNotifications();
}
function bind(){
 $("#sellerCashProduct").addEventListener("change",setProductLimit);
 $("#sellerCashReceived").addEventListener("input",renderTotals);
 $("#sellerCashItems").addEventListener("click",event=>{
  const btn=event.target.closest("[data-cash-remove]");
  if(!btn)return;
  cart.splice(Number(btn.dataset.cashRemove),1);saleKey=null;renderCart();
 });
 $("#sellerAddCashItem").addEventListener("click",()=>{
  const p=product($("#sellerCashProduct").value),quantity=Number($("#sellerCashQuantity").value);
  const pct=Number($("#sellerCashDiscount").value);
  if(!p)return services.notify("Selecione um produto disponível no estoque.");
  if(!Number.isInteger(quantity)||quantity<1||quantity>100)return services.notify("Informe uma quantidade válida.");
  if(!Number.isFinite(pct)||pct<0||pct>p.max_discount_percent)return services.notify(
     "O desconto máximo permitido neste produto é "+p.max_discount_percent+"%.");
  if(cart.some(item=>item.id===p.id))return services.notify("Este perfume já está na lista. Remova o item para alterar quantidade ou desconto.");
  const added=cart.filter(item=>item.id===p.id).reduce((sum,item)=>sum+item.quantity,0);
  if(added+quantity>p.quantity)return services.notify("Estoque insuficiente. Disponíveis: "+(p.quantity-added)+".");
  cart.push({id:p.id,name:p.name,volume_ml:p.volume_ml,quantity,
   discount_percent:Math.round(pct*100)/100,unit_price_cents:Number(p.sale_price_cents??p.price_cents)});
  $("#sellerCashQuantity").value="1";$("#sellerCashDiscount").value="0";
  saleKey=null;renderCart();
 });
 $("#sellerCashForm").onsubmit=async event=>{
  event.preventDefault();
  if(!cart.length)return services.notify("Adicione pelo menos um produto.");
  const form=event.currentTarget,d=new FormData(form),t=moneyInfo();
  if(t.total<=0)return services.notify("O total da venda precisa ser maior que zero.");
  const received=int(d.get("cash_received"));
  if(!Number.isSafeInteger(received)||received<t.total)return services.notify("O dinheiro recebido é menor que o total da venda.");
  const person=String(d.get("customer_name")||"").trim(),phone=String(d.get("customer_phone")||"").trim();
  if(person.length<2||digits(phone).length<10)return services.notify("Preencha nome e telefone do cliente com DDD.");
  const address={street:d.get("address_street"),number:d.get("address_number"),
    neighborhood:d.get("address_neighborhood"),city:d.get("address_city"),
    state:d.get("address_state"),postal_code:d.get("address_postal_code")};
  if(!saleKey)saleKey=crypto.randomUUID();
  const button=$("#sellerRegisterCash");
  button.disabled=true;button.textContent="REGISTRANDO VENDA...";
  $("#sellerCashMessage").textContent="Confirmando valores e baixando o estoque...";
  try{
   const result=await services.call("seller-portal",{
     action:"register_cash_sale",sale_key:saleKey,customer_name:person,customer_phone:phone,
     cash_received_cents:received,items:cart.map(item=>({
      id:item.id,quantity:item.quantity,discount_percent:item.discount_percent
     })),customer_address:address
   });
   const order=result.data;
   $("#sellerCashMessage").textContent="Venda "+order.public_id+" registrada e paga em dinheiro. Troco: "+
       brl(order.cash_change_cents)+". A etiqueta está disponível em Pedidos dos meus clientes.";
   services.notify("Venda presencial registrada no caixa.");
   cart=[];saleKey=null;form.reset();$("#sellerCashReceived").value="";
   renderCart();
   await services.onSale();
  }catch(error){
   const dictionary={DISCOUNT_EXCEEDS_ALLOWED:"Desconto acima do limite autorizado no ADM.",
      INSUFFICIENT_SELLER_STOCK:"Estoque insuficiente; atualize o saldo e confira sua sacola.",
      CASH_INSUFFICIENT:"Dinheiro recebido insuficiente.",CUSTOMER_FIELDS_REQUIRED:"Dados do cliente incompletos."};
   $("#sellerCashMessage").textContent=dictionary[error.message]||error.message||"Não foi possível registrar a venda.";
   services.notify($("#sellerCashMessage").textContent);
  }finally{button.disabled=false;button.textContent="REGISTRAR VENDA EM DINHEIRO";}
 };
 $("#sellerNotificationBell").onclick=()=>$("#sellerNotificationCenter").scrollIntoView({behavior:"smooth",block:"start"});
 $("#sellerRefreshNotifications").onclick=fetchNotifications;
 $("#sellerMarkAllRead").onclick=async()=>{
  const ids=notifications.filter(n=>!n.is_read).map(n=>n.id);
  if(!ids.length)return;
  try{await markRead(ids)}catch(error){services.notify(error.message)}
 };
 $("#sellerNotificationList").addEventListener("click",async event=>{
  const button=event.target.closest("[data-notification-id]");
  if(!button)return;
  const id=button.dataset.notificationId;
  try{await markRead([id])}catch(error){services.notify(error.message)}
  const index=orderData.findIndex(o=>o.id===button.dataset.orderId);
  const rows=document.querySelectorAll("#sellerOrders .seller-order");
  if(index>=0&&rows[index])rows[index].scrollIntoView({behavior:"smooth",block:"center"});
 });
 if(!poll)poll=setInterval(()=>{if(document.visibilityState==="visible")fetchNotifications()},45000);
}
export function initSellerSales(dependencies){
 services=dependencies;
 if(initialized)return;
 initialized=true;bind();
}
export function renderSellerSales(data){
 inventory=data.inventory||[];orderData=data.orders||[];notifications=data.notifications||[];
 prepareInventory();renderNotifications();renderCart();
 const orders=document.querySelectorAll("#sellerOrders .seller-order");
 orders.forEach((card,index)=>{
  const order=orderData[index];if(!order)return;
  const actions=card.querySelector(".seller-dashboard-actions");
  if(!actions)return;
  const button=document.createElement("button");
  button.className="seller-outline seller-print-order";
  button.type="button";button.textContent="Imprimir etiqueta";
  button.onclick=()=>{if(!openSellerLabel(order,$("#sellerLabelSize").value))services.notify("Permita janelas pop-up para imprimir sua etiqueta.")};
  actions.append(button);
 });
}
