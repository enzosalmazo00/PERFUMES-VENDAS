import{loadSession,saveSession,signIn,createFirstAccess,resendConfirmation,requestPasswordReset,adminApi,procurementApi,emergencyApi,productImageApi,uploadProductImage,money,cents,esc,option,table}from"./admin-api.js?v=20261002-adminlogin4";
import{shell,renderDashboard}from"./admin-view.js?v=20261002-adminparsefix1";
import{initializeCatalogForm,catalogLoadProduct,catalogResetForm,catalogReadBrand,catalogReadVolume}from"./fragrance-selectors.js?v=20261001-multicatalog2";
import{setupProcurement}from"./admin-procurement-ui.js?v=20261001-multicatalog2";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const login=$("#loginView"),app=$("#app"),content=$("#adminContent"),msg=$("#loginMessage"),toast=$("#toast");
let data=null,procurementUi=null;
function notify(t){toast.textContent=t;toast.classList.add("show");clearTimeout(notify.t);notify.t=setTimeout(()=>toast.classList.remove("show"),2800)}
function bindTabs(){$$(".tab").forEach(b=>b.onclick=()=>{$$(".tab").forEach(x=>x.classList.toggle("is-active",x===b));$$(".tab-panel").forEach(p=>p.hidden=p.dataset.panel!==b.dataset.tab);if(b.dataset.tab==="compras")procurementUi?.load();if(b.dataset.tab==="estoque")loadInventoryHistory();if(b.dataset.tab==="relatorios")runReports();if(b.dataset.tab==="emergencia")loadStatus()})}
async function refresh(){data=(await adminApi({action:"dashboard"})).data;renderDashboard(data)}
async function open(){const fresh=(await adminApi({action:"dashboard"})).data;data=fresh;content.innerHTML=shell();login.hidden=true;app.hidden=false;bindTabs();bindForms();renderDashboard(data);procurementUi=setupProcurement({api:procurementApi,getData:()=>data,refresh,notify,esc,money,cents,option,table})}

const stockReasons={
 entry:[["restock","Entrada sem compra"],["return","Devolução recebida"],["inventory_count","Ajuste de inventário"],["other","Outra entrada"]],
 exit:[["breakage","Quebra"],["loss","Perda"],["damage","Avaria"],["seizure","Apreensão"],
       ["gift","Brinde"],["road_loss","Perda no transporte"],["inventory_count","Divergência na contagem"],["other","Outra saída"]]
};
function bindStockDirection(){
 const form=$("#adjustForm"),reason=$("#adjustReason"),note=$("#adjustNote"),impact=$("#adjustImpactLabel");
 function updateRequired(){
  note.required=form.elements.namedItem("direction").value==="exit"||
   ["restock","inventory_count","other"].includes(reason.value);
  $("#adjustNoteHelp").textContent=note.required?"Descreva o motivo (mínimo de 5 caracteres). O histórico registra o responsável.":"Observação opcional para devoluções.";
 }
 function setDirection(direction){
  form.elements.namedItem("direction").value=direction;
  content.querySelectorAll("[data-stock-direction]").forEach(b=>{
   const selected=b.dataset.stockDirection===direction;
   b.classList.toggle("is-active",selected);b.setAttribute("aria-pressed",String(selected));
  });
  reason.replaceChildren();
  for(const [code,label] of stockReasons[direction])reason.add(new Option(label,code));
  impact.hidden=direction!=="exit";
  $("#adjustSubmit").textContent=direction==="exit"?"Registrar saída justificada":"Registrar entrada manual";
  updateRequired();
 }
 content.querySelectorAll("[data-stock-direction]").forEach(b=>b.onclick=()=>setDirection(b.dataset.stockDirection));
 reason.onchange=updateRequired;
 setDirection("entry");
 return setDirection;
}
let setStockDirection=()=>{};
async function loadInventoryHistory(){
 const target=$("#inventoryHistory");if(!target)return;
 try{
  const rows=(await adminApi({action:"inventory_history"})).data||[];
  const labels={restock:"Entrada",return:"Devolução",inventory_count:"Contagem",breakage:"Quebra",
    damage:"Avaria",loss:"Perda",seizure:"Apreensão",gift:"Brinde",road_loss:"Perda em transporte",
    other:"Outro",sale:"Venda",transfer:"Transferência"};
  target.innerHTML=table([["Data",r=>new Date(r.created_at).toLocaleString("pt-BR")],
    ["Produto",r=>esc(r.product_name||"—")],["Estoque",r=>esc(r.location_name||"—")],
    ["Movimento",r=>(r.quantity_delta>0?'<span class="badge-ok">Entrada</span>':'<span class="badge-warn">Saída</span>')+" "+Math.abs(r.quantity_delta)],
    ["Motivo",r=>esc(labels[r.reason_code]||r.reason_code||"—")],
    ["Justificativa",r=>esc(r.note||"—")],["Impacto",r=>money(r.financial_impact_cents||0)]
  ],rows);
 }catch(error){target.textContent="Não foi possível carregar o histórico de estoque."}
}
function setPreview(input,preview){const file=input?.files?.[0];if(!preview)return;if(!file){preview.hidden=true;preview.removeAttribute("src");return}preview.src=URL.createObjectURL(file);preview.hidden=false}
function productPayload(f,includeActive=false){const generic=!["perfume","body_splash"].includes(String(f.get("product_type")||"perfume"));const p={name:f.get("name"),brand:generic?String(f.get("brand_custom")||f.get("brand_preset")||"").trim():catalogReadBrand(f),product_type:f.get("product_type")||"perfume",category:f.get("category"),volume_ml:generic?1:catalogReadVolume(f),price_cents:cents(f.get("price")),sale_price_cents:f.get("sale_price")?cents(f.get("sale_price")):null,max_discount_percent:Number(f.get("max_discount_percent")||0),weight_kg:Number(f.get("weight_kg")||.25),width_cm:Number(f.get("width_cm")||12),height_cm:Number(f.get("height_cm")||15),length_cm:Number(f.get("length_cm")||8),short_description:f.get("short_description"),description:f.get("description"),composition:f.get("composition"),top_notes:f.get("top_notes"),heart_notes:f.get("heart_notes"),base_notes:f.get("base_notes"),is_featured:f.get("is_featured")==="on",is_best_seller:f.get("is_best_seller")==="on"};if(includeActive)p.is_active=f.get("is_active")==="on";return p}
function openProductEditor(id){const p=data?.products?.find(x=>x.id===id);if(!p)return notify("Perfume não encontrado.");const card=$("#editProductCard"),form=$("#editProductForm");form.elements.id.value=p.id;form.elements.name.value=p.name||"";form.elements.product_type.value=p.product_type||"perfume";catalogLoadProduct(form,p);form.elements.category.value=p.category||"masculino";form.elements.price.value=(Number(p.price_cents||0)/100).toFixed(2);form.elements.sale_price.value=p.sale_price_cents!=null?(Number(p.sale_price_cents)/100).toFixed(2):"";form.elements.max_discount_percent.value=Number(p.max_discount_percent||0).toFixed(2);form.elements.weight_kg.value=Number(p.weight_kg||.5);form.elements.width_cm.value=Number(p.width_cm||12);form.elements.height_cm.value=Number(p.height_cm||15);form.elements.length_cm.value=Number(p.length_cm||8);form.elements.short_description.value=p.short_description||"";form.elements.description.value=p.description||"";form.elements.composition.value=p.composition||"";form.elements.top_notes.value=(p.top_notes||[]).join(", ");form.elements.heart_notes.value=(p.heart_notes||[]).join(", ");form.elements.base_notes.value=(p.base_notes||[]).join(", ");form.elements.is_featured.checked=!!p.is_featured;form.elements.is_best_seller.checked=!!p.is_best_seller;form.elements.is_active.checked=!!p.is_active;form.elements.image.value="";const preview=$("#editProductImagePreview");if(p.image_url){preview.src=p.image_url;preview.hidden=false}else{preview.hidden=true;preview.removeAttribute("src")}card.hidden=false;card.scrollIntoView({behavior:"smooth",block:"start"})}
function closeProductEditor(){const card=$("#editProductCard"),form=$("#editProductForm");if(form){form.reset();catalogResetForm(form)}if(card)card.hidden=true}
function openSellerEditor(id){const s=data?.sellers?.find(x=>x.id===id);if(!s)return notify("Vendedor não encontrado.");const card=$("#editSellerCard"),form=$("#editSellerForm");form.elements.id.value=s.id;form.elements.name.value=s.name||"";form.elements.email.value=s.email||"";form.elements.whatsapp_number.value=s.whatsapp_number||"";form.elements.avatar_url.value=s.avatar_url||"";form.elements.bio.value=s.bio||"";form.elements.city_id.value=(s.city_ids||[])[0]||"";form.elements.can_toggle.checked=!!s.can_toggle_site_emergency;form.elements.stock_management_mode.value=s.stock_management_mode||"admin";form.elements.is_active.checked=!!s.is_active;card.hidden=false;card.scrollIntoView({behavior:"smooth",block:"start"})}
function closeSellerEditor(){const card=$("#editSellerCard"),form=$("#editSellerForm");if(form)form.reset();if(card)card.hidden=true}
let productCreateBusy=false,hardDeleteTarget=null;
function setProductAction(state,message){
 const overlay=$("#productActionOverlay"),title=$("#productActionTitle"),body=$("#productActionMessage");
 if(!overlay)return;
 overlay.hidden=false;overlay.dataset.state=state;overlay.setAttribute("aria-busy",state==="loading"?"true":"false");
 title.textContent=state==="success"?"Concluído":"Cadastrando produto";
 body.textContent=message||(state==="success"?"Produto cadastrado com sucesso.":"Aguarde. Estamos salvando o produto e a foto com segurança.");
}
function closeProductAction(){const overlay=$("#productActionOverlay");if(overlay)overlay.hidden=true}
function openHardDelete(product){
 hardDeleteTarget=product;const overlay=$("#hardDeleteOverlay"),input=$("#hardDeleteConfirmText"),confirm=$("#confirmHardDelete");
 $("#hardDeleteText").textContent='Você solicitou a exclusão definitiva de "'+(product?.name||"este produto")+'".';
 input.value="";confirm.disabled=true;overlay.hidden=false;setTimeout(()=>input.focus(),30);
}
function closeHardDelete(){hardDeleteTarget=null;const overlay=$("#hardDeleteOverlay");if(overlay)overlay.hidden=true}
function bindForms(){
initializeCatalogForm($("#productForm"));
initializeCatalogForm($("#editProductForm"));
setStockDirection=bindStockDirection();
$("#productImage").onchange=e=>setPreview(e.target,$("#productImagePreview"));
$("#editProductImage").onchange=e=>setPreview(e.target,$("#editProductImagePreview"));

$("#productForm").onsubmit=async e=>{
 e.preventDefault();if(productCreateBusy)return;
 const form=e.currentTarget,f=new FormData(form),file=f.get("image"),submit=$("#productSubmit");
 productCreateBusy=true;submit.disabled=true;form.setAttribute("aria-busy","true");setProductAction("loading");
 try{
  const imageUrl=await uploadProductImage(file);
  const created=await adminApi({action:"create_product",...productPayload(f)});
  await productImageApi({product_id:created.data.id,image_url:imageUrl});
  form.reset();catalogResetForm(form);const preview=$("#productImagePreview");preview.hidden=true;preview.removeAttribute("src");
  await refresh();setProductAction("success","Produto cadastrado com sucesso. O cadastro e a foto foram salvos.");
  notify("Produto cadastrado com sucesso.");setTimeout(closeProductAction,1800);
 }catch(x){closeProductAction();notify(x.message||"Não foi possível cadastrar o produto.")}
 finally{productCreateBusy=false;submit.disabled=false;form.removeAttribute("aria-busy")}
};

$("#editProductForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),id=f.get("id"),file=f.get("image");try{notify("Salvando alterações...");await adminApi({action:"update_product",id,...productPayload(f,true)});if(file instanceof File&&file.size){const imageUrl=await uploadProductImage(file);await productImageApi({product_id:id,image_url:imageUrl})}await refresh();closeProductEditor();notify("Perfume atualizado.")}catch(x){notify(x.message)}};
$("#cancelEditProduct").onclick=closeProductEditor;
$("#hardDeleteConfirmText").addEventListener("input",e=>{$("#confirmHardDelete").disabled=String(e.target.value).trim().toUpperCase()!=="EXCLUIR"});
$("#cancelHardDelete").onclick=closeHardDelete;
$("#confirmHardDelete").onclick=async()=>{
 if(!hardDeleteTarget||String($("#hardDeleteConfirmText").value).trim().toUpperCase()!=="EXCLUIR")return;
 const button=$("#confirmHardDelete"),id=hardDeleteTarget.id;button.disabled=true;button.textContent="Excluindo...";
 try{await adminApi({action:"hard_delete_product",id,confirmation:"EXCLUIR"});closeHardDelete();closeProductEditor();await refresh();notify("Produto excluído definitivamente.")}
 catch(error){button.disabled=false;notify(error.message==="PRODUCT_HAS_HISTORY"?"Este produto possui histórico e não pode ser apagado. Use Remover da loja para preservar os registros.":error.message||"Não foi possível excluir definitivamente.")}
 finally{button.textContent="Excluir definitivamente"}
};

content.addEventListener("click",async e=>{
const review=e.target.closest("[data-review-seller]");
if(review){
  const seller=data?.sellers?.find(x=>x.id===review.dataset.reviewSeller);
  const decision=review.dataset.decision;
  if(!seller||!["approve","reject"].includes(decision))return;
  if(!confirm(decision==="approve"?"Aprovar o acesso de "+seller.name+" ao painel do vendedor?":"Recusar a solicitação de "+seller.name+"?"))return;
  review.disabled=true;
  try{
    await adminApi({action:"review_seller",id:seller.id,decision});
    await refresh();
    notify(decision==="approve"?"Vendedor aprovado! Ele já pode entrar.":"Solicitação recusada.");
  }catch(error){notify(error.message||"Não foi possível atualizar a solicitação.");review.disabled=false}
  return;
}
const saveOrder=e.target.closest("[data-save-order]"),editSeller=e.target.closest("[data-edit-seller]"),edit=e.target.closest("[data-edit-product]"),del=e.target.closest("[data-delete-product]"),hardDel=e.target.closest("[data-hard-delete-product]"),restore=e.target.closest("[data-restore-product]");if(saveOrder){const id=saveOrder.dataset.saveOrder,fulfillment=document.querySelector('[data-order-fulfillment="'+id+'"]')?.value,payment=document.querySelector('[data-order-payment="'+id+'"]')?.value;try{await adminApi({action:"update_order_status",id,fulfillment_status:fulfillment,payment_status:payment});await refresh();notify("Pedido atualizado.")}catch(x){notify(x.message)}return}if(editSeller){openSellerEditor(editSeller.dataset.editSeller);return}if(edit){openProductEditor(edit.dataset.editProduct);return}if(del){const p=data?.products?.find(x=>x.id===del.dataset.deleteProduct);if(!confirm('Remover "'+(p?.name||"este perfume")+'" da loja? O histórico será preservado e você poderá restaurá-lo depois.'))return;try{await adminApi({action:"delete_product",id:del.dataset.deleteProduct});await refresh();closeProductEditor();notify("Perfume removido da loja.")}catch(x){notify(x.message)}return}if(hardDel){const p=data?.products?.find(x=>x.id===hardDel.dataset.hardDeleteProduct);if(p)openHardDelete(p);return}if(restore){try{await adminApi({action:"restore_product",id:restore.dataset.restoreProduct});await refresh();notify("Perfume restaurado na loja.")}catch(x){notify(x.message)}}});

$("#cityForm").onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);try{const r=await adminApi({action:"create_city",city_name:f.get("city_name"),state_name:f.get("state_name"),country_code:f.get("country_code")});form.reset();await refresh();notify(r?.already_exists?"Cidade já estava cadastrada e continua ativa.":r?.restored?"Cidade reativada.":"Cidade cadastrada.");$("#cities")?.scrollIntoView({behavior:"smooth",block:"nearest"})}catch(x){notify(x.message==="CITY_CREATE_FAILED"?"Não foi possível cadastrar a cidade. Verifique os dados e tente novamente.":x.message)}};
$("#sellerForm").onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);try{await adminApi({action:"create_seller",name:f.get("name"),email:f.get("email"),whatsapp_number:f.get("whatsapp_number"),avatar_url:f.get("avatar_url"),bio:f.get("bio"),city_ids:f.get("city_id")?[f.get("city_id")]:[],can_toggle_site_emergency:f.get("can_toggle")==="on"});form.reset();await refresh();notify("Vendedor cadastrado.")}catch(x){notify(x.message)}};

$("#editSellerForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{notify("Salvando vendedor...");await adminApi({action:"update_seller",id:f.get("id"),name:f.get("name"),email:f.get("email"),whatsapp_number:f.get("whatsapp_number"),avatar_url:f.get("avatar_url"),bio:f.get("bio"),city_ids:f.get("city_id")?[f.get("city_id")]:[],can_toggle_site_emergency:f.get("can_toggle")==="on",stock_management_mode:f.get("stock_management_mode")||"admin",is_active:f.get("is_active")==="on"});await refresh();closeSellerEditor();notify("Cadastro do vendedor atualizado.")}catch(x){notify(x.message==="SELLER_AUTH_EMAIL_UPDATE_FAILED"?"Os demais dados foram salvos, mas não foi possível atualizar o e-mail de login.":x.message)}};
$("#cancelEditSeller").onclick=closeSellerEditor;
$("#locationForm").onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);try{await adminApi({action:"create_location",name:f.get("name"),service_city_id:f.get("city_id"),seller_id:f.get("seller_id")});form.reset();await refresh();notify("Estoque criado.")}catch(x){notify(x.message)}};
$("#adjustForm").onsubmit=async event=>{
 event.preventDefault();
 const form=event.currentTarget,f=new FormData(form);
 const direction=String(f.get("direction")),qty=Number(f.get("qty")),reason=String(f.get("reason")||""),
   note=String(f.get("note")||"").trim(),impactRaw=String(f.get("impact")||"").trim();
 const feedback=$("#adjustFeedback"),button=$("#adjustSubmit");
 if(!Number.isInteger(qty)||qty<1||qty>10000){feedback.textContent="Informe uma quantidade inteira positiva.";return}
 if(direction==="exit"&&note.length<5){feedback.textContent="Justifique esta saída com pelo menos 5 caracteres.";return}
 if(direction==="entry"&&["restock","inventory_count","other"].includes(reason)&&note.length<5){
  feedback.textContent="Explique a origem desta entrada.";return;
 }
 if(direction==="exit"&&!confirm("Confirmar saída de "+qty+" unidade(s) por "+(stockReasons.exit.find(x=>x[0]===reason)||[])[1]+"? Esta movimentação ficará registrada."))return;
 button.disabled=true;feedback.textContent="Registrando movimentação...";
 try{
  await adminApi({action:"adjust_inventory",location_id:f.get("location_id"),product_id:f.get("product_id"),
    direction,quantity:qty,reason_code:reason,
    financial_impact_cents:impactRaw===""?null:cents(impactRaw),note});
  form.reset();setStockDirection("entry");await refresh();await loadInventoryHistory();
  feedback.textContent="Movimentação registrada com sucesso.";notify("Saldo de estoque atualizado.");
 }catch(error){
  const messages={INSUFFICIENT_STOCK:"Quantidade superior ao estoque disponível.",
   RESERVED_STOCK_CONFLICT:"Essa saída comprometeria unidades já reservadas em pedidos.",
   JUSTIFICATION_REQUIRED:"Informe a justificativa obrigatória.",
   LOCATION_NOT_FOUND:"O local de estoque não está mais ativo."};
  feedback.textContent=messages[error.message]||error.message||"Não foi possível registrar a movimentação.";
 }finally{button.disabled=false}
};
$("#shippingSettingsForm").onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form);try{const cep=String(f.get("origin_postal_code")||"").replace(/\D/g,"");if(cep&&cep.length!==8)return notify("Informe um CEP de origem válido.");await adminApi({action:"update_shipping_settings",origin_postal_code:cep,provider_environment:f.get("provider_environment"),shipping_enabled:f.get("shipping_enabled")==="on",public_note:f.get("public_note")});await refresh();notify("Configuração de frete salva.")}catch(x){notify(x.message)}};
$("#runReport").onclick=runReports;
$("#disableSite").onclick=async()=>{const reason=$("#outageReason").value.trim();if(reason.length<3)return notify("Informe a justificativa.");if(!confirm("Confirma retirar a loja do ar?"))return;try{await emergencyApi({action:"set_status",is_online:false,outage_kind:$("#outageKind").value,outage_reason:reason,public_message:$("#publicMessage").value.trim()});await loadStatus();notify("Loja desativada.")}catch(e){notify(e.message)}};
$("#enableSite").onclick=async()=>{if(!confirm("Confirma reativar a loja?"))return;try{await emergencyApi({action:"set_status",is_online:true,outage_reason:$("#restoreReason").value.trim()});await loadStatus();notify("Loja reativada.")}catch(e){notify(e.message)}};
}
async function loadStatus(){try{const s=(await emergencyApi({action:"get_status"})).data;$("#statusDot").className="status-dot "+(s.is_online?"online":"offline");$("#statusText").textContent=s.is_online?"Loja online":"Loja fora do ar";$("#statusDetail").textContent=s.is_online?"A vitrine está disponível.":(s.outage_kind||"Indisponível")+" · "+(s.outage_reason||"")}catch(e){notify(e.message)}}
async function runReports(){if(!$("#reportMetrics"))return;try{const r=(await adminApi({action:"reports",from:$("#from").value,to:$("#to").value,seller_id:$("#reportSeller").value,product_id:$("#reportProduct").value,city_id:$("#reportCity").value})).data,s=r.summary;$("#reportMetrics").innerHTML=[["Vendas",money(s.sales_cents)],["Lucro bruto",money(s.gross_profit_cents)],["Margem",s.gross_margin_percent+"%"],["Perdas",money(s.loss_cents)],["Brindes",money(s.gift_cents)],["Perda estrada",money(s.road_loss_cents)],["Resultado",money(s.net_operational_cents)]].map(x=>'<div class="metric"><span>'+x[0]+'</span><strong>'+x[1]+'</strong></div>').join("");$("#reportMoves").innerHTML=table([["Data",x=>new Date(x.created_at).toLocaleString("pt-BR")],["Produto",x=>esc(x.product_name)],["Cidade",x=>esc(x.city_name||"—")],["Motivo",x=>esc(({breakage:"Quebra",damage:"Avaria",loss:"Perda",seizure:"Apreensão",restock:"Entrada",road_loss:"Perda transporte",gift:"Brinde",inventory_count:"Contagem",return:"Devolução"})[x.reason_code]||x.reason_code||"—")],["Qtd.",x=>x.quantity_delta],["Impacto",x=>money(x.financial_impact_cents)],["Nota",x=>esc(x.note||"—")]],r.movements||[]);$("#reportRisks").innerHTML=table([["Produto",x=>esc(x.product_name)],["Risco",x=>esc(x.risk_type||"—")],["Valor",x=>money(x.risk_value_cents)],["Qtd.",x=>x.quantity]],r.risks||[])}catch(e){notify(e.message)}}
$("#adminPasswordEye").onclick=()=>{const input=$("#password"),show=input.type==="password";input.type=show?"text":"password";$("#adminPasswordEye").classList.toggle("is-visible",show);$("#adminPasswordEye").setAttribute("aria-label",show?"Ocultar senha":"Mostrar senha")};
$("#forgotAdminPassword").onclick=async()=>{msg.textContent="";const email=$("#email").value.trim();if(!email){msg.textContent="Digite seu e-mail acima para receber o link de recuperação.";$("#email").focus();return}try{await requestPasswordReset(email);msg.textContent="Enviamos um link para redefinir sua senha. Confira sua caixa de entrada e o spam."}catch(x){msg.textContent=x.message}};
async function submitAdminLogin(){msg.textContent="Entrando...";const button=$("#adminLoginButton");if(button)button.disabled=true;try{await signIn($("#email").value.trim(),$("#password").value);msg.textContent="Carregando painel...";await open();msg.textContent=""}catch(x){if(x?.status===401||x?.status===403)saveSession(null);msg.textContent=x?.message||"Não foi possível abrir o painel. Tente novamente."}finally{if(button)button.disabled=false}}
$("#adminLoginButton").onclick=submitAdminLogin;
$("#loginForm").addEventListener("submit",e=>{e.preventDefault();submitAdminLogin()});
$("#createAccess").onclick=async()=>{msg.textContent="";try{const d=await createFirstAccess($("#email").value.trim(),$("#password").value);if(d.access_token)await open();else msg.textContent="Conta criada. Confirme o e-mail recebido e depois entre. Se não encontrar a mensagem, use “Reenviar confirmação”."}catch(x){msg.textContent=x.message}};
$("#resendConfirm").onclick=async()=>{msg.textContent="";try{await resendConfirmation($("#email").value.trim());msg.textContent="E-mail de confirmação reenviado. Abra sua caixa de entrada, confirme o acesso e depois entre normalmente."}catch(x){msg.textContent=x.message}};
$("#logout").onclick=()=>{saveSession(null);location.reload()};
(async()=>{if(!loadSession()?.access_token)return;try{await open()}catch(e){if(e?.status===401){saveSession(null);login.hidden=false;app.hidden=true;msg.textContent="Sua sessão expirou. Entre novamente."}else{login.hidden=false;app.hidden=true;msg.textContent=e?.message||"Não foi possível carregar o painel. Tente novamente."}}})();
