// AZZENA PARFUMS — client review flow, with authorization enforced by customer-portal.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function installReviewFlow({getOrders,portal,refresh,rerender,notify}){
  const $=selector=>document.querySelector(selector);
  const overlay=$("#reviewOverlay"),container=$("#reviewItems"),status=$("#reviewMessage");
  let activeOrder=null,busy=false,returnFocus=null,poll=null;
  const scores=new Map();
  const reviewedSet=order=>new Set((order.reviews||[]).map(item=>item.product_id));
  const pendingItems=order=>{
    const reviewed=reviewedSet(order),seen=new Set();
    return (order.items||[]).filter(item=>{
      if(!uuid.test(String(item.product_id||""))||reviewed.has(item.product_id)||seen.has(item.product_id))return false;
      seen.add(item.product_id);return true;
    });
  };
  const dismissed=id=>{try{return sessionStorage.getItem("azzena-review-dismissed-"+id)==="1"}catch{return false}};
  const markDismissed=id=>{try{sessionStorage.setItem("azzena-review-dismissed-"+id,"1")}catch{}};
  function stopPolling(){if(poll){clearInterval(poll);poll=null;}}
  function cleanReturnUrl(){
    const url=new URL(location.href);
    if(!url.searchParams.has("avaliar")&&!url.searchParams.has("pedido"))return;
    url.searchParams.delete("avaliar");url.searchParams.delete("pedido");
    history.replaceState(null,"",url.pathname+url.search+url.hash);
  }
  function close(){
    if(overlay.hidden)return;
    overlay.hidden=true;document.body.style.overflow="";
    if(activeOrder)markDismissed(activeOrder.id);
    activeOrder=null;scores.clear();stopPolling();cleanReturnUrl();
    if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
  }
  function reviewCard(item){
    const card=document.createElement("article");card.className="review-product";card.dataset.productId=item.product_id;
    const heading=document.createElement("h3");heading.textContent=item.product_name+(item.volume_ml?" · "+item.volume_ml+" mL":"");card.append(heading);
    const legend=document.createElement("label");legend.textContent="Sua avaliação deste perfume";card.append(legend);
    const controls=document.createElement("div");controls.className="review-star-controls";controls.setAttribute("role","group");controls.setAttribute("aria-label","Escolha uma nota de 0 a 5 estrelas");
    for(let value=0;value<=5;value++){
      const button=document.createElement("button");button.type="button";button.dataset.reviewScore=String(value);
      button.setAttribute("aria-pressed","false");button.setAttribute("aria-label",value===0?"Zero estrelas":value===1?"Uma estrela":value+" estrelas");
      if(value===0){button.className="review-zero";button.textContent="0 ★"}else{button.textContent="☆"}
      controls.append(button);
    }
    card.append(controls);
    const comment=document.createElement("textarea");comment.dataset.reviewComment="";
    comment.minLength=5;comment.maxLength=1200;comment.placeholder="Como foi sua experiência com este produto?";
    comment.setAttribute("aria-label","Comentário sobre "+item.product_name);card.append(comment);
    const save=document.createElement("button");save.type="button";save.className="review-send";
    save.dataset.reviewSend="";save.textContent="PUBLICAR AVALIAÇÃO";card.append(save);
    return card;
  }
  function open(order){
    if(!order||order.payment_status!=="approved"||order.payment_channel!=="mercadopago"||activeOrder)return false;
    const items=pendingItems(order);if(!items.length)return false;
    activeOrder=order;scores.clear();status.textContent="";
    container.replaceChildren(...items.map(reviewCard));returnFocus=document.activeElement;
    overlay.hidden=false;document.body.style.overflow="hidden";stopPolling();
    $("#reviewClose").focus({preventScroll:true});
    return true;
  }
  function check(previousPaidIds=null){
    if(activeOrder||!getOrders()?.length)return;
    const params=new URLSearchParams(location.search),asked=params.get("avaliar")==="1",orderId=params.get("pedido");
    const choices=asked?getOrders().filter(o=>!orderId||o.id===orderId)
      :(previousPaidIds?getOrders().filter(o=>!previousPaidIds.has(o.id)):[]);
    const eligible=choices.find(o=>o.payment_status==="approved"&&o.payment_channel==="mercadopago"&&!dismissed(o.id)&&pendingItems(o).length);
    if(eligible){open(eligible);return;}
    if(asked&&!poll&&choices.some(o=>o.payment_status==="pending"&&o.payment_channel==="mercadopago")){
      notify("Aguardando confirmação do pagamento para liberar sua avaliação.");
      let attempts=0;
      poll=setInterval(()=>{
        if(++attempts>15){stopPolling();return;}
        refresh();
      },4000);
    }
  }
  $("#reviewClose").onclick=close;$("#reviewDone").onclick=close;
  overlay.addEventListener("click",async event=>{
    if(event.target===overlay){close();return;}
    const score=event.target.closest("[data-review-score]");
    if(score){
      const card=score.closest(".review-product"),id=card?.dataset.productId;
      if(!uuid.test(String(id||"")))return;
      const value=Number(score.dataset.reviewScore);
      if(!Number.isInteger(value)||value<0||value>5)return;
      scores.set(id,value);
      card.querySelectorAll("[data-review-score]").forEach(button=>{
        const n=Number(button.dataset.reviewScore);
        button.setAttribute("aria-pressed",String(n===value));
        if(n>0)button.textContent=n<=value?"★":"☆";
      });
      return;
    }
    const send=event.target.closest("[data-review-send]");
    if(!send||busy||!activeOrder)return;
    const card=send.closest(".review-product"),productId=card?.dataset.productId;
    const value=scores.get(productId),comment=card?.querySelector("[data-review-comment]")?.value.trim()||"";
    if(value===undefined){status.textContent="Selecione uma nota de 0 a 5 estrelas.";return;}
    if(comment.length<5||comment.length>1200){status.textContent="Digite um comentário de 5 a 1.200 caracteres.";return;}
    if(!uuid.test(String(productId||"")))return;
    busy=true;send.disabled=true;send.textContent="PUBLICANDO...";
    try{
      const saved=await portal({action:"review_product",order_id:activeOrder.id,product_id:productId,rating:value,comment});
      activeOrder.reviews=[...(activeOrder.reviews||[]),{product_id:productId,rating:value,created_at:saved.data?.created_at}];
      const done=document.createElement("div");done.className="customer-review-complete";
      done.textContent="✓ Avaliação publicada. Seu nome completo não será exibido.";
      card.replaceWith(done);status.textContent="Obrigado! Sua avaliação já está no catálogo.";rerender();
    }catch(error){
      const messages={REVIEW_ALREADY_EXISTS:"Você já avaliou este produto neste pedido.",REVIEW_PAYMENT_NOT_CONFIRMED:"A avaliação será liberada após o pagamento ser confirmado.",REVIEW_PRODUCT_NOT_PURCHASED:"Produto não encontrado neste pedido.",REVIEW_FIELDS_INVALID:"Revise sua nota e seu comentário."};
      status.textContent=messages[error.message]||"Não foi possível publicar. Tente novamente.";
      send.disabled=false;send.textContent="PUBLICAR AVALIAÇÃO";
    }finally{busy=false}
  });
  overlay.addEventListener("keydown",event=>{if(event.key==="Escape")close()});
  $("#orderList").addEventListener("click",event=>{
    const button=event.target.closest("[data-open-review-order]");if(!button)return;
    const order=getOrders()?.find(o=>o.id===button.dataset.openReviewOrder);
    if(order)open(order);
  });
  return {check,close,stopPolling};
}
