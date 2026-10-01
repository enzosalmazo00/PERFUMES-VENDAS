// Conferência do código de retirada: o servidor é a fonte única do pagamento e da baixa.
const $=selector=>document.querySelector(selector);
const safe=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const money=value=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(value||0)/100);
const localDate=value=>{
  if(!value)return "Aguardando confirmação";
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",
    day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false
  }).format(date)+" (horário de Brasília)";
};
const errorMessage=error=>({
  PICKUP_CODE_INVALID_FORMAT:"Confira o formato do código entregue pelo cliente.",
  PICKUP_CODE_INVALID:"O código contém um erro de digitação. Confira todos os caracteres.",
  PICKUP_CODE_NOT_FOUND:"Código não encontrado entre os pedidos deste vendedor. Confira com o cliente.",
  PICKUP_CHECK_LIMIT:"Muitas tentativas. Aguarde dez minutos para consultar novamente.",
  PICKUP_CODE_ALREADY_USED:"Este código já foi utilizado. A entrega não pode ser registrada novamente.",
  PICKUP_PAYMENT_NOT_APPROVED:"Pagamento ainda não confirmado pela loja. NÃO ENTREGAR.",
  PICKUP_NOT_READY:"O pedido ainda não foi liberado para retirada. Prepare-o antes de concluir a entrega.",
  PICKUP_OPERATION_FAILED:"Não foi possível verificar o pedido. Atualize a página e tente novamente."
}[error?.message]||error?.message||"Falha ao conferir o código.");

let deps=null,lookedUp=null,busy=false;

function normalizeCode(raw){
  const plain=String(raw??"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(!/^AZZ[2-9A-HJ-NP-Z]{14}$/.test(plain))return null;
  return "AZZ-"+plain.slice(3,7)+"-"+plain.slice(7,11)+"-"+plain.slice(11,15)+"-"+plain.slice(15,17);
}
function receiptMarkup(order){
  const paid=order.payment_status==="approved"&&!!order.payment_confirmed_at;
  const used=!!order.pickup_redeemed_at||order.fulfillment_status==="delivered";
  const ready=order.fulfillment_status==="ready";
  const items=Array.isArray(order.items)?order.items:[];
  const units=items.reduce((n,item)=>n+Number(item.quantity||0),0);
  const state=used?"CÓDIGO UTILIZADO · RETIRADA CONCLUÍDA":
    !paid?"PAGAMENTO NÃO CONFIRMADO — NÃO ENTREGAR":
    ready?"PAGAMENTO CONFIRMADO · PRONTO PARA RETIRADA":
    "PAGO · AGUARDANDO SEPARAÇÃO DOS PRODUTOS";
  const delivery=used?'<div class="pickup-verified-delivered"><strong>ENTREGA JÁ REGISTRADA</strong><p>'+
    safe(order.customer_name)+" recebeu "+units+" unidade(s) de "+safe(order.delivered_by_seller_name||"um vendedor autorizado")+
    " em "+safe(localDate(order.delivered_at||order.pickup_redeemed_at))+
    '.</p><p>Este código não pode ser utilizado novamente.</p></div>':"";
  return '<div class="pickup-verified-state '+(used?"is-used":paid?"is-paid":"is-unpaid")+'">'+safe(state)+'</div>'+
    '<p class="pickup-verified-caption">COMPROVANTE DE RETIRADA AZZENA</p>'+
    '<strong class="pickup-verified-order">'+safe(order.public_id)+'</strong>'+
    '<div class="pickup-verified-customer"><small>NOME DO CLIENTE</small><strong>'+safe(order.customer_name)+'</strong></div>'+
    '<div class="pickup-verified-stats"><div><small>PAGAMENTO</small><strong>'+safe(paid?"CONFIRMADO":"PENDENTE")+'</strong></div>'+
    '<div><small>DATA E HORA DO PAGAMENTO</small><strong>'+safe(localDate(order.payment_confirmed_at))+'</strong></div>'+
    '<div><small>QUANTIDADE A RETIRAR</small><strong>'+units+' UNIDADE(S)</strong></div>'+
    '<div><small>VALOR TOTAL</small><strong>'+money(order.total_cents)+'</strong></div></div>'+
    '<div class="pickup-verified-items"><strong>CONFIRA CADA PRODUTO</strong>'+
    (items.length?items.map(item=>'<div><span>'+safe(item.quantity)+' × '+safe(item.name||item.product_name)+
      (item.volume_ml?' · '+safe(item.volume_ml)+' mL':'')+'</span><b>'+money(item.line_total_cents)+'</b></div>').join(""):
      '<p>Os produtos devem ser conferidos no pedido original.</p>')+'</div>'+
    delivery+
    (!paid?'<p class="pickup-verified-warning">Pagamento não confirmado no sistema da loja. Não entregue os produtos.</p>':
      !ready&&!used?'<p class="pickup-verified-warning">Pedido pago, mas ainda não marcado como pronto. Faça a separação primeiro.</p>':"");
}

function present(order){
  lookedUp=order;
  $("#pickupVerifyResult").hidden=false;
  $("#pickupVerifyResult").innerHTML=receiptMarkup(order);
  const canDeliver=order.payment_status==="approved"&&!!order.payment_confirmed_at&&
    order.fulfillment_status==="ready"&&!order.pickup_redeemed_at;
  $("#pickupConfirmArea").hidden=!canDeliver;
  $("#pickupConfirmChecklist").checked=false;
  $("#pickupConfirmDelivery").disabled=true;
  $("#pickupVerifyStatus").textContent=canDeliver?
    "Código validado. Confira os itens e o cliente antes de confirmar a entrega.":
    order.pickup_redeemed_at?"Código já utilizado; entrega registrada.":"Consulte o status e as instruções exibidas no comprovante.";
}

export function initPickupVerifier(options){
  if(deps)return;
  deps=options;
  const form=$("#sellerVerifyForm"),entry=$("#sellerPickupCode");
  const submit=$("#sellerVerifySubmit"),confirmButton=$("#pickupConfirmDelivery");
  $("#pickupConfirmChecklist").addEventListener("change",event=>{
    confirmButton.disabled=!event.target.checked||!lookedUp||lookedUp.fulfillment_status!=="ready"||busy;
  });
  entry.addEventListener("input",()=>{
    const before=entry.value;
    entry.value=before.toUpperCase();
    if(lookedUp){
      lookedUp=null;$("#pickupVerifyResult").hidden=true;
      $("#pickupConfirmArea").hidden=true;confirmButton.disabled=true;
      $("#pickupVerifyStatus").textContent="Código alterado. Consulte novamente antes de entregar.";
    }
  });
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    if(busy)return;
    const code=normalizeCode(entry.value);
    if(!code){$("#pickupVerifyStatus").textContent="Digite o código AZZ completo informado pelo cliente.";return}
    busy=true;submit.disabled=true;$("#pickupVerifyStatus").textContent="Consultando o pagamento e os itens do pedido...";
    $("#pickupConfirmArea").hidden=true;$("#pickupVerifyResult").hidden=true;lookedUp=null;
    try{
      const result=await deps.call("seller-portal",{action:"lookup_pickup_code",code});
      entry.value=code;
      present(result.data);
    }catch(error){
      $("#pickupVerifyStatus").textContent=errorMessage(error);
      deps.notify(errorMessage(error));
    }finally{busy=false;submit.disabled=false}
  });
  confirmButton.addEventListener("click",async()=>{
    if(busy||!lookedUp||!$("#pickupConfirmChecklist").checked)return;
    const order=lookedUp,code=normalizeCode(entry.value);
    if(code!==order.pickup_code){
      $("#pickupVerifyStatus").textContent="O código foi alterado. Consulte novamente.";
      return;
    }
    if(!window.confirm("Você conferiu o nome do cliente e entregou TODOS os produtos do pedido "+
       order.public_id+"? A baixa é definitiva e o código não poderá ser reutilizado."))return;
    busy=true;confirmButton.disabled=true;$("#pickupVerifyStatus").textContent="Registrando a entrega com segurança...";
    try{
      const result=await deps.call("seller-portal",{action:"redeem_pickup_code",code});
      const delivered=result.data||{};
      present({...order,...delivered,pickup_redeemed_at:delivered.delivered_at,
        payment_status:"approved",fulfillment_status:"delivered"});
      $("#pickupVerifyStatus").textContent="Entrega confirmada! O código foi baixado e o comprovante atualizado no histórico do cliente.";
      deps.notify("Entrega registrada. O código não poderá ser reutilizado.");
      try{await deps.onDelivered?.()}catch{ /* O registro já foi concluído; o painel pode ser atualizado depois. */ }
    }catch(error){
      $("#pickupVerifyStatus").textContent=errorMessage(error);
      deps.notify(errorMessage(error));
      if(error.message==="PICKUP_CODE_ALREADY_USED"){
        $("#pickupConfirmArea").hidden=true;
      }
    }finally{busy=false}
  });
}
