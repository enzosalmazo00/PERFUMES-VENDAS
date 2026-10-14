import {SUPABASE_URL,SUPABASE_KEY,money,esc,table} from "./admin-api.js?v=20261001-sellerflow2";
import {initSellerSales,renderSellerSales} from "./seller-sales.js?v=20261001-sales8";
import {initPickupVerifier} from "./seller-pickup.js?v=20261001-pickupcode1";
import {setupSellerWorkspace,activateSellerTab,updateSellerWorkflow} from "./seller-workspace.js?v=20261002-workspace2";

const $=selector=>document.querySelector(selector);
const SESSION_KEY="azzena-seller-session";
const views=["loadingView","loginView","confirmView","applyView","pendingView","app"];
let refreshing=null,loading=false,currentSeller=null,customCatalog=[],customSales=[];
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
const customCents=v=>Math.round((Number(v)||0)*100);
function renderCustomTotal(){const q=Math.max(1,Number($("#sellerCustomQuantity")?.value||1)),p=customCents($("#sellerCustomPrice")?.value),f=customCents($("#sellerCustomShipping")?.value);if($("#sellerCustomTotal"))$("#sellerCustomTotal").textContent=money(q*p+f)}
function fillCustomProducts(filter=""){const sel=$("#sellerCustomProduct");if(!sel)return;const old=sel.value,q=filter.trim().toLocaleLowerCase("pt-BR");sel.replaceChildren(new Option("Selecione um perfume cadastrado",""));for(const p of customCatalog.filter(p=>!q||[p.brand,p.name,p.volume_ml+" ml"].join(" ").toLocaleLowerCase("pt-BR").includes(q)).slice(0,300))sel.append(new Option([p.brand,p.name,p.volume_ml?p.volume_ml+" mL":""].filter(Boolean).join(" · "),p.id));if([...sel.options].some(o=>o.value===old))sel.value=old}
function loadCustomSalesFromDashboard(data){
 const inv=Array.isArray(data?.inventory)?data.inventory:[];
 const merged=new Map();
 for(const row of inv){if(!row.is_active||Number(row.quantity)<=0)continue;const prev=merged.get(row.product_id)||{id:row.product_id,name:row.product_name,brand:row.brand||"",volume_ml:row.volume_ml,quantity:0};prev.quantity+=Number(row.quantity||0);merged.set(row.product_id,prev)}
 customCatalog=[...merged.values()].sort((a,b)=>(a.brand+" "+a.name).localeCompare(b.brand+" "+b.name,"pt-BR"));
 customSales=Array.isArray(data?.custom_sales)?data.custom_sales:[];fillCustomProducts();renderCustomSales();
 const mp=$("#sellerMpStatus");if(mp){const st=data?.payment_connection?.status||"not_connected";mp.textContent=st==="connected"?"Mercado Pago conectado a este vendedor":"Integração preparada · conta Mercado Pago ainda não conectada"}
}
function renderCustomSales(){const box=$("#sellerCustomSales");if(!box)return;box.innerHTML=customSales.length?customSales.map(s=>'<article class="seller-custom-row"><div><strong>'+esc(s.public_id)+' · '+esc(s.product_name)+'</strong><small>'+esc(s.volume_ml||"")+" mL · "+esc(s.customer_name)+' · '+esc(s.customer_email)+'</small></div><div><strong>'+money(s.total_cents)+'</strong><span>'+esc(s.status==="pending_payment"?"Aguardando pagamento":s.status==="paid"?"Pago":s.status==="shipped"?"Enviado":s.status)+'</span></div>'+(s.status==="pending_payment"?'<button class="seller-outline" type="button" data-custom-cancel="'+esc(s.id)+'">Cancelar</button>':"")+'</article>').join(""):'<p class="muted">Nenhuma venda personalizada criada.</p>'}
async function createCustomSale(event){event.preventDefault();const form=event.currentTarget,btn=$("#sellerCreateCustomSale"),productId=$("#sellerCustomProduct").value,price=customCents($("#sellerCustomPrice").value),shipping=customCents($("#sellerCustomShipping").value),quantity=Number($("#sellerCustomQuantity").value||1);if(!productId||price<0||quantity<1)return notify("Confira produto, quantidade e preço.");btn.disabled=true;$("#sellerCustomSaleMessage").textContent="Gerando cobrança personalizada...";try{const session=await validSession(),res=await fetch(SUPABASE_URL+"/functions/v1/seller-portal",{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({action:"create_custom_sale",customer_email:form.elements.customer_email.value,customer_name:form.elements.customer_name.value,customer_phone:form.elements.customer_phone.value,customer_postal_code:form.elements.customer_postal_code.value,product_id:productId,quantity,unit_price_cents:price,shipping_price_cents:shipping,notes:$("#sellerCustomNotes").value})});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.message||body.error||"Não foi possível criar a venda.");$("#sellerCustomSaleMessage").textContent="Venda "+body.public_id+" criada. Ela aparecerá na conta AZZENA vinculada ao e-mail informado. O botão de pagamento ficará bloqueado até configurarmos o Mercado Pago deste vendedor.";form.reset();$("#sellerCustomQuantity").value="1";$("#sellerCustomShipping").value="0";renderCustomTotal();notify("Venda personalizada criada.");await refreshInventory()}catch(error){$("#sellerCustomSaleMessage").textContent=friendlyError(error)}finally{btn.disabled=false}}
function configureOwnStock(data){
 const allowed=data?.seller?.stock_management_mode==="seller",controls=$("#sellerOwnStockControls"),notice=$("#sellerStockAdminNotice");
 if(controls)controls.hidden=!allowed;if(notice)notice.hidden=allowed;if(!allowed)return;
 const inv=Array.isArray(data.inventory)?data.inventory:[],locations=new Map(),products=new Map();
 for(const x of inv){locations.set(x.location_id,x.location_name);products.set(x.product_id,{name:x.product_name,volume:x.volume_ml})}
 const loc=$("#sellerStockLocation"),prod=$("#sellerStockProduct");loc.replaceChildren(...[...locations].map(([id,name])=>new Option(name,id)));
 prod.replaceChildren(...[...products].map(([id,p])=>new Option(p.name+(p.volume?" · "+p.volume+" mL":""),id)));
}
async function submitOwnStock(event){
 event.preventDefault();const btn=event.currentTarget.querySelector("button[type=submit]");btn.disabled=true;$("#sellerStockMessage").textContent="Registrando...";
 try{await call("seller-portal",{action:"adjust_own_inventory",location_id:$("#sellerStockLocation").value,product_id:$("#sellerStockProduct").value,
   direction:$("#sellerStockDirection").value,quantity:Number($("#sellerStockQty").value),reason_code:$("#sellerStockReason").value,note:$("#sellerStockNote").value,unit_cost_cents:$("#sellerStockDirection").value==="entry"&&$("#sellerStockReason").value==="restock"?Math.round(Number($("#sellerStockUnitCost").value||0)*100):null});
  $("#sellerStockMessage").textContent="Movimentação registrada com sucesso.";$("#sellerStockNote").value="";await refreshInventory();notify("Estoque atualizado.")
 }catch(error){$("#sellerStockMessage").textContent=friendlyError(error)}finally{btn.disabled=false}
}

function sellerPayoutReceipt(p){
 const safe=x=>String(x??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
 const when=x=>x?new Date(x).toLocaleString("pt-BR"):"Não registrado";
 const status=p.status==="confirmed"?"RECEBIMENTO CONFIRMADO":p.status==="admin_paid"?"TRANSFERÊNCIA INFORMADA PELO ADM":"SOLICITAÇÃO EM ABERTO";
 const win=window.open("","_blank","width=820,height=900");
 if(!win)return notify("Autorize pop-ups para gerar o demonstrativo.");
 const items=p.items||[];
 const rows=items.map((i,k)=>'<tr><td>'+String(k+1).padStart(2,"0")+'</td><td>'+safe(String(i.order_id||"").slice(0,8).toUpperCase())+'</td><td>'+Number(i.commission_percent||0).toLocaleString("pt-BR",{maximumFractionDigits:2})+'%</td><td>'+money(i.commission_cents)+'</td></tr>').join("");
 const style='*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#27231d;margin:0;padding:34px;background:#f8f6f2}main{max-width:800px;margin:auto;background:white;border:1px solid #d9d1c2;padding:36px 38px}header{display:flex;justify-content:space-between;gap:20px;align-items:start;padding-bottom:23px;border-bottom:2px solid #b08a4e}.brand{font-size:26px;font-weight:800;letter-spacing:.19em;color:#222}.brand small{font-size:10px;font-weight:600;letter-spacing:.2em;color:#8b744e;display:block;margin-top:5px}.ref{font-size:11px;color:#7a7164;text-align:right}.eyebrow{font-size:10px;color:#9b783e;letter-spacing:.18em;font-weight:bold}.title{font-size:25px;margin:30px 0 6px}.sub{font-size:12px;color:#787066;margin-top:0}.total{background:#f6f1e7;border-left:4px solid #ae8647;padding:22px 24px;margin:24px 0}.total span{font-size:11px;color:#806d51;display:block}.total strong{font-size:32px;color:#292219;display:block;margin:8px 0}.status{font-size:11px;font-weight:bold;color:#896b3a}.details{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:25px 0}.detail span{font-size:11px;color:#867d71;display:block;margin-bottom:6px}.detail strong{font-size:12px;overflow-wrap:anywhere}.section{font-size:14px;margin:27px 0 8px;color:#393025}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f3eee5;color:#64533b;text-align:left}th,td{padding:12px;border-bottom:1px solid #e7e1d6}td:last-child,th:last-child{text-align:right}footer{font-size:11px;line-height:1.65;border-top:1px solid #ddd3c3;margin-top:30px;padding-top:20px;color:#6e675d}.buttons{padding:18px 0;text-align:center}.buttons button{background:#292119;border:none;color:#fff;padding:13px 26px;font-size:13px;cursor:pointer;border-radius:6px}@media print{body{background:white;padding:0}main{border:0;padding:18px}.buttons{display:none}}@media(max-width:570px){body{padding:8px}main{padding:18px}.details{grid-template-columns:1fr}header{flex-direction:column}.ref{text-align:left}}';
 const page='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demonstrativo de repasse - AZZENA</title><style>'+style+'</style></head><body><main><header><div class="brand">AZZENA<small>IMPORTS · FINANCEIRO</small></div><div class="ref">IDENTIFICAÇÃO DO REPASSE<br><b>'+safe(String(p.id).slice(0,8).toUpperCase())+'</b></div></header><p class="eyebrow" style="margin-top:30px">DOCUMENTO FINANCEIRO</p><h1 class="title">Demonstrativo de comissão</h1><p class="sub">Detalhamento dos pedidos incluídos nesta solicitação.</p><div class="total"><span>VALOR TOTAL DO REPASSE</span><strong>'+money(p.amount_cents)+'</strong><span class="status">'+status+'</span></div><div class="details"><div class="detail"><span>Vendedor</span><strong>'+safe(currentSeller?.name||"")+'</strong></div><div class="detail"><span>Chave Pix de recebimento</span><strong>'+safe(p.pix_key)+'</strong></div><div class="detail"><span>Data da solicitação</span><strong>'+safe(when(p.requested_at))+'</strong></div><div class="detail"><span>Pagamento registrado pelo ADM</span><strong>'+safe(when(p.paid_at))+'</strong></div><div class="detail"><span>Recebimento confirmado pelo vendedor</span><strong>'+safe(when(p.confirmed_at))+'</strong></div><div class="detail"><span>Quantidade de pedidos</span><strong>'+items.length+'</strong></div></div><h2 class="section">Composição do repasse</h2><table><thead><tr><th>#</th><th>Pedido</th><th>Percentual</th><th>Comissão</th></tr></thead><tbody>'+rows+'</tbody></table><footer>Documento emitido eletronicamente pela AZZENA Imports. Este demonstrativo não substitui o comprovante bancário de transferência. O estado de pagamento reflete exclusivamente os registros do sistema; o recebimento somente é confirmado após declaração do vendedor.</footer><div class="buttons"><button onclick="window.print()">Imprimir ou salvar em PDF</button></div></main></body></html>';
 win.document.write(page);win.document.close();
}
document.addEventListener("submit",async event=>{
  if(event.target?.id!=="sellerRequestPayout")return;
  event.preventDefault();
  const form=event.target,pix=String(new FormData(form).get("pix_key")||"").trim();
  if(pix.length<5)return notify("Informe sua chave Pix.");
  if(!confirm("Solicitar pagamento das comissões disponíveis para a chave Pix informada?"))return;
  const button=form.querySelector('button[type="submit"]');button.disabled=true;
  try{await call("seller-portal",{action:"request_payout",pix_key:pix});notify("Solicitação enviada ao administrador.");await refreshInventory()}
  catch(error){notify(friendlyError(error));button.disabled=false}
});
document.addEventListener("click",async event=>{
  if(event.target.id==="sellerPayoutDismiss"){$("#sellerPayoutBigNotice").hidden=true;return}
  const proof=event.target.closest("[data-seller-view-proof]");
  if(proof){try{const response=await call("seller-portal",{action:"get_payout_receipt",payout_id:proof.dataset.sellerViewProof});window.open(response.data.url,"_blank","noopener,noreferrer")}catch(error){notify(friendlyError(error))}return}
  const print=event.target.closest("[data-print-payout]");
  if(print){const payouts=JSON.parse($("#sellerPayoutDashboard")?.dataset.payouts||"[]");const row=payouts.find(p=>p.id===print.dataset.printPayout);if(row)sellerPayoutReceipt(row);return}
  const button=event.target.closest("[data-confirm-payout]");
  if(!button)return;
  if(!confirm("ATENÇÃO: você verificou sua conta bancária e confirma que recebeu este valor?"))return;
  button.disabled=true;
  try{await call("seller-portal",{action:"confirm_payout",payout_id:button.dataset.confirmPayout});notify("Recebimento confirmado.");await refreshInventory()}
  catch(error){notify(friendlyError(error));button.disabled=false}
});
let lastPayoutAlertId="";
setInterval(async()=>{
  if(document.visibilityState!=="visible"||$("#app")?.hidden)return;
  try{
    const res=await call("seller-portal",{action:"payout_status"});
    const due=(Array.isArray(res.data)?res.data:[])[0];
    if(due&&due.id!==lastPayoutAlertId){
      lastPayoutAlertId=due.id;
      const notice=$("#sellerPayoutBigNotice");
      if(notice){
        $("#sellerPayoutBigText").textContent="O administrador informou um repasse de "+money(due.amount_cents)+". Confira se realmente recebeu antes de confirmar.";
        notice.hidden=false;
      }
      await refreshInventory();
    }
  }catch{ /* A rede pode oscilar; manter os dados atuais e tentar no próximo intervalo. */ }
},20000);
async function refreshInventory(){
  const response=await call("seller-portal",{});
  const data=response.data||{},inventory=data.inventory||[],low=data.low_stock||[];
  currentSeller=data.seller||null;
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
  configureOwnStock(data);
  const approvedOrders=(data.orders||[]).filter(o=>o.payment_status==="approved"&&o.fulfillment_status!=="cancelled");
  const recordedSales=Array.isArray(data.financial_sales)?data.financial_sales:[];
  const commissionRows=approvedOrders.map(o=>{
    const rate=Number(o.seller_commission_percent??data.seller?.commission_percent??10);
    const gross=Number(o.total_cents||0);
    const amount=o.seller_commission_cents==null?Math.round(gross*rate/100):Number(o.seller_commission_cents);
    return {...o,commission_rate:rate,commission_amount_cents:amount,
      finance:recordedSales.find(f=>f.order_id===o.id)||null};
  });
  const sums=commissionRows.reduce((a,o)=>{a.gross+=Number(o.total_cents||0);a.commission+=o.commission_amount_cents;return a},{gross:0,commission:0});

  const payouts=Array.isArray(data.payouts)?data.payouts:[];
  const linkedIds=new Set(payouts.flatMap(p=>(p.items||[]).map(i=>i.order_id)));
  const available=commissionRows.filter(o=>!linkedIds.has(o.id)).reduce((sum,o)=>sum+o.commission_amount_cents,0);
  const requested=payouts.filter(p=>p.status==="requested").reduce((sum,p)=>sum+Number(p.amount_cents||0),0);
  const markedPaid=payouts.filter(p=>p.status==="admin_paid").reduce((sum,p)=>sum+Number(p.amount_cents||0),0);
  const received=payouts.filter(p=>p.status==="confirmed").reduce((sum,p)=>sum+Number(p.amount_cents||0),0);
  const payoutBox=$("#sellerPayoutDashboard");
  if(payoutBox){

    const summary=[["Disponível para solicitar",available,"Pronto para o próximo pedido"],["Solicitado ao ADM",requested,"Transferência ainda não registrada"],["Pago · conferir recebimento",markedPaid,"Confirme somente após verificar a conta"],["Recebido e confirmado",received,"Repasses encerrados"]]
      .map((x,i)=>'<div class="repasse-summary-card"><span>'+x[0]+'</span><strong>'+money(x[1])+'</strong><small>'+x[2]+'</small></div>').join("");
    const payoutStatus=p=>p.status==="requested"?"Aguardando transferência":p.status==="admin_paid"?"Confirme o recebimento":"Recebimento confirmado";
    const history=payouts.length?payouts.map(p=>{
      const count=(p.items||[]).length;
      const actions='<button type="button" class="repasse-action repasse-action--secondary" data-print-payout="'+esc(p.id)+'">Demonstrativo</button>'+
        (p.receipt_path?'<button type="button" class="repasse-action repasse-action--secondary" data-seller-view-proof="'+esc(p.id)+'">Comprovante bancário</button>':"")+
        (p.status==="admin_paid"?'<button type="button" class="repasse-action repasse-action--primary" data-confirm-payout="'+esc(p.id)+'">Confirmar que recebi</button>':"");
      return '<article class="repasse-record" data-status="'+esc(p.status)+'"><header class="repasse-record-head"><div class="repasse-record-id"><span class="repasse-index">REPASSE '+esc(String(p.id).slice(0,8).toUpperCase())+'</span><h4>'+payoutStatus(p)+'</h4><small>Solicitado em '+new Date(p.requested_at).toLocaleString("pt-BR")+'</small></div><div class="repasse-record-amount"><span>VALOR SOLICITADO</span><strong>'+money(p.amount_cents)+'</strong><span class="repasse-status repasse-status--'+esc(p.status)+'">'+(p.status==="requested"?"Aguardando ADM":p.status==="admin_paid"?"Aguardando você":"Concluído")+'</span></div></header>'+
      '<div class="repasse-detail-grid"><div><span>Chave Pix</span><strong class="repasse-break">'+esc(p.pix_key)+'</strong></div><div><span>Vendas neste repasse</span><strong>'+count+' pedido(s)</strong></div><div><span>Pagamento registrado</span><strong>'+(p.paid_at?new Date(p.paid_at).toLocaleString("pt-BR"):"Não registrado")+'</strong></div></div>'+
      '<div class="repasse-timeline" aria-label="Histórico de datas deste repasse"><div><span>Solicitação registrada</span><strong>'+new Date(p.requested_at).toLocaleString("pt-BR")+'</strong></div><div><span>ADM registrou a transferência</span><strong>'+(p.paid_at?new Date(p.paid_at).toLocaleString("pt-BR"):"Aguardando pagamento")+'</strong></div><div><span>Você confirmou o recebimento</span><strong>'+(p.confirmed_at?new Date(p.confirmed_at).toLocaleString("pt-BR"):"Aguardando confirmação")+'</strong></div></div>'+
      '<div class="repasse-track"><span class="is-complete">1 · Solicitado</span><span class="'+(p.status!=="requested"?"is-complete":"")+'">2 · Pago pelo ADM</span><span class="'+(p.status==="confirmed"?"is-complete":"")+'">3 · Recebido</span></div>'+
      (p.status==="admin_paid"?'<div class="repasse-attention">O administrador informou a transferência. Confira seu extrato bancário antes de confirmar.</div>':"")+
      '<div class="repasse-footer">'+actions+'</div></article>';
    }).join(""):'<div class="repasse-empty">Você ainda não solicitou nenhum repasse. Suas solicitações aparecerão aqui com o demonstrativo e o comprovante.</div>';
    payoutBox.innerHTML='<div class="repasse-heading"><span class="repasse-eyebrow">CONTROLE DE COMISSÕES</span><h3>Seus repasses</h3><p>Um extrato claro do que foi gerado, solicitado, transferido e confirmado.</p></div>'+
      '<div class="repasse-summary">'+summary+'</div>'+
      '<section class="repasse-request-card"><div><span class="repasse-eyebrow">SOLICITAÇÃO DE PAGAMENTO</span><h3>Saldo disponível para receber</h3><strong class="repasse-request-total">'+money(available)+'</strong><p>O pedido reúne todas as comissões aprovadas ainda não incluídas em outro repasse.</p></div>'+
      '<form id="sellerRequestPayout" class="repasse-request-form"><label>Chave Pix para recebimento<input name="pix_key" required minlength="5" maxlength="150" autocomplete="off" placeholder="CPF, e-mail, telefone ou chave aleatória"></label><button class="repasse-action repasse-action--primary" type="submit" '+(available<=0?'disabled':'')+'>Solicitar repasse de '+money(available)+'</button><small>O envio registra uma solicitação, não faz transferência automática.</small></form></section>'+
      '<section class="repasse-group"><div class="repasse-group-head"><div><h3>Histórico de solicitações <small>'+payouts.length+'</small></h3><p>Documentos, comprovantes e situação de cada pagamento.</p></div></div>'+history+'</section>';
    payoutBox.dataset.payouts=JSON.stringify(payouts);
    const pendingConfirmation=payouts.find(p=>p.status==="admin_paid");
    const big=$("#sellerPayoutBigNotice");
    if(big&&big.parentElement!==document.body)document.body.appendChild(big);
    if(big){big.hidden=!pendingConfirmation;if(pendingConfirmation)$("#sellerPayoutBigText").textContent="O administrador informou o pagamento de "+money(pendingConfirmation.amount_cents)+". Confirme somente se o dinheiro entrou na sua conta."}
  }
  const configuredRate=Number(data.seller?.commission_percent??10);
  $("#sellerFinanceSummary").innerHTML='<div class="metrics"><div class="metric"><span>Vendas aprovadas</span><strong>'+String(commissionRows.length)+'</strong></div><div class="metric"><span>Vendas brutas</span><strong>'+money(sums.gross)+'</strong></div><div class="metric"><span>Comissões geradas</span><strong>'+money(sums.commission)+'</strong></div><div class="metric"><span>Taxa atual definida pelo ADM</span><strong>'+configuredRate.toLocaleString("pt-BR",{maximumFractionDigits:2})+'%</strong></div></div>';
  $("#sellerFinanceSales").innerHTML=commissionRows.length?table([["Data",x=>new Date(x.payment_confirmed_at||x.created_at).toLocaleString("pt-BR")],["Pedido",x=>esc(x.public_id||"—")],["Pagamento",x=>esc(x.payment_method||"—")],["Venda aprovada",x=>money(x.total_cents)],["Comissão (%)",x=>x.commission_rate.toLocaleString("pt-BR",{maximumFractionDigits:2})+"%"],["A receber",x=>money(x.commission_amount_cents)]],commissionRows):'<p class="muted">Nenhuma venda paga contabilizada ainda.</p>';
  loadCustomSalesFromDashboard(data);
  const orders=(data.orders||[]).filter(order=>!(order.payment_status==="pending"&&Date.now()-Date.parse(order.created_at)>=24*60*60*1000));
  $("#sellerOrders").innerHTML=orders.length?orders.map(order=>{
    const canAdvance=order.delivery_method==="presencial"&&order.payment_status==="approved"&&
      !["cancelled","delivered"].includes(order.fulfillment_status);
    const next=order.fulfillment_status==="ready"?"code_required":order.fulfillment_status==="preparing"?"ready":"preparing";
    const labels={preparing:"Iniciar preparação",ready:"Liberar retirada",delivered:"Marcar entregue"};
    const phone=String(order.customer_phone||"").replace(/\D/g,"");
    const visualState=order.payment_status==="cancelled"||order.fulfillment_status==="cancelled"?"cancelled":
      order.payment_status!=="approved"?"pending":
      order.fulfillment_status==="delivered"?"delivered":
      order.fulfillment_status==="ready"?"ready":
      order.fulfillment_status==="preparing"?"preparing":"received";
    const visualText={cancelled:"PEDIDO CANCELADO",pending:"AGUARDANDO PAGAMENTO",delivered:"ENTREGUE",ready:"PRONTO PARA RETIRADA",preparing:"EM PREPARAÇÃO",received:"INICIAR PREPARAÇÃO"}[visualState];
    return '<article class="seller-order"><div class="seller-order-state seller-order-state--'+visualState+'" aria-label="Situação do pedido: '+visualText+'">'+visualText+'</div><header><strong>'+esc(order.public_id)+'</strong><small>'+new Date(order.created_at).toLocaleString("pt-BR")+'</small></header>'+
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
  const schedule=(Array.isArray(data.pickup_schedule)?data.pickup_schedule:[]).filter(row=>row.is_open===false);
  const scheduleBox=$("#sellerPickupScheduleList");
  if(scheduleBox)scheduleBox.innerHTML=schedule.length?'<div class="seller-schedule-list">'+schedule.map(row=>{
    const date=new Date(row.service_date+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"});
    return '<div class="seller-custom-row"><div><strong>'+esc(date)+'</strong><small>Não atendendo · retirada indisponível</small></div><button class="seller-outline" type="button" data-delete-pickup-date="'+esc(row.service_date)+'">Voltar ao horário padrão</button></div>';
  }).join("")+'</div>':'<p class="muted">Nenhuma exceção cadastrada. Atendimento padrão de segunda a sábado, 08:00–12:00 e 14:00–18:00.</p>';
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
    const message=error.message==="GOOGLE_MAPS_LINK_REQUIRED"?"Informe o link do Google Maps para habilitar a retirada.":error.message==="GOOGLE_MAPS_LINK_INVALID"?"Use um link do Google Maps, incluindo maps.app.goo.gl, maps.google.com ou share.google.":friendlyError(error);
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
$("#sellerStockAdjustForm").onsubmit=submitOwnStock;
$("#sellerCustomSaleForm").onsubmit=createCustomSale;
$("#sellerCustomProductSearch").oninput=e=>fillCustomProducts(e.target.value);
["#sellerCustomQuantity","#sellerCustomPrice","#sellerCustomShipping"].forEach(id=>$(id).oninput=renderCustomTotal);
$("#sellerStockDirection").onchange=()=>{const exit=$("#sellerStockDirection").value==="exit",reason=$("#sellerStockReason");reason.innerHTML=exit?'<option value="breakage">Quebra</option><option value="loss">Perda</option><option value="damage">Avaria</option><option value="gift">Brinde</option><option value="inventory_count">Ajuste de contagem</option><option value="other">Outro</option>':'<option value="restock">Reposição</option><option value="return">Devolução</option><option value="inventory_count">Ajuste de contagem</option><option value="other">Outro</option>'};
$("#sellerPickupScheduleForm").onsubmit=async event=>{
  event.preventDefault();
  const form=event.currentTarget,data=new FormData(form),button=form.querySelector('[type="submit"]');
  button.disabled=true;$("#sellerPickupScheduleMessage").textContent="Salvando exceção...";
  try{
    await call("seller-portal",{action:"save_pickup_schedule",service_date:data.get("service_date"),is_open:false,
      period1_start:"",period1_end:"",period2_start:"",period2_end:""});
    $("#sellerPickupScheduleMessage").textContent="Data marcada como não atendendo.";
    form.reset();await refreshInventory();activateSellerTab("agenda");notify("Dia sem atendimento registrado.");
  }catch(error){
    const msg=friendlyError(error);$("#sellerPickupScheduleMessage").textContent=msg;notify(msg);
  }finally{button.disabled=false}
};
$("#sellerPickupScheduleList").onclick=async event=>{
  const button=event.target.closest("[data-delete-pickup-date]");if(!button)return;
  button.disabled=true;
  try{await call("seller-portal",{action:"delete_pickup_schedule",service_date:button.dataset.deletePickupDate});await refreshInventory();notify("Data removida da agenda.")}
  catch(error){button.disabled=false;notify(friendlyError(error))}
};
$("#sellerCustomSales").onclick=async e=>{const b=e.target.closest("[data-custom-cancel]");if(!b)return;if(!confirm("Cancelar esta cobrança pendente?"))return;try{const session=await validSession(),res=await fetch(SUPABASE_URL+"/functions/v1/seller-portal",{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({action:"cancel_custom_sale",id:b.dataset.customCancel})});if(!res.ok)throw new Error("Não foi possível cancelar.");await refreshInventory();notify("Cobrança cancelada e estoque liberado.")}catch(error){notify(error.message)}};
setupSellerWorkspace();
initSellerSales({call,notify,onSale:refreshInventory,navigate:activateSellerTab});
initPickupVerifier({call,notify,onDelivered:refreshInventory});
if(readSession())openSeller();else show("loginView");