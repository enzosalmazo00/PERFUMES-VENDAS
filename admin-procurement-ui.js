// AZZENA: interface privada de suprimentos; nenhum custo sai da área autenticada do ADM.
export function setupProcurement({api,getData,refresh,notify,esc,money,cents,option,table}){
 const $=selector=>document.querySelector(selector);
 const suppliersForm=$("#supplierForm"),lotForm=$("#lotForm"),priceForm=$("#repriceForm");
 let suppliers=[],history=[],pricing=[],pendingId=null,pendingFingerprint="";
 const errors={
  SUPPLIER_ALREADY_EXISTS:"Já existe um fornecedor com esse nome. Use o botão Editar.",
  SUPPLIER_NAME_REQUIRED:"Informe o nome do fornecedor.",
  SUPPLIER_NOT_FOUND:"Fornecedor não encontrado.",
  SUPPLIER_NOT_ACTIVE:"O fornecedor selecionado está inativo.",
  PURCHASE_FIELDS_INVALID:"Confira fornecedor, estoque, produto, quantidade, custo e porcentagem.",
  PURCHASE_COSTS_INVALID:"Frete e outras despesas não podem ser negativos.",
  PRODUCT_COST_NOT_REGISTERED:"Registre uma compra deste produto antes de reajustar o preço.",
  LOCATION_NOT_FOUND:"Estoque indisponível. Atualize a página.",
  MARKUP_INVALID:"Informe uma porcentagem entre 0% e 1000%.",
  PROCUREMENT_FAILED:"A operação não pôde ser concluída. Verifique o histórico antes de tentar novamente.",
  FORBIDDEN:"Sua conta não tem permissão de administrador."
 };
 function errorText(error){return errors[error?.message]||"Não foi possível concluir a operação. "+String(error?.message||"").replaceAll("_"," ").slice(0,110)}
 const field=(form,name)=>form.elements.namedItem(name);
 function feedback(id,text,ok=false){const node=$("#"+id);if(node){node.textContent=text;node.classList.toggle("is-success",ok)}}
 function renderSuppliers(){
  $("#lotSupplier").innerHTML=option(suppliers.filter(x=>x.is_active),"id","name","Selecione o fornecedor");
  $("#supplierList").innerHTML=table([
   ["Fornecedor",s=>esc(s.name)],["Contato",s=>esc(s.contact_name||"—")],
   ["Telefone",s=>esc(s.phone||"—")],["Situação",s=>s.is_active?"Ativo":"Inativo"],
   ["Ação",s=>'<button type="button" class="btn btn-small" data-edit-supplier="'+esc(s.id)+'">Editar</button>']
  ],suppliers);
  $("#supplierList").querySelectorAll("[data-edit-supplier]").forEach(button=>button.onclick=()=>{
   const selected=suppliers.find(x=>x.id===button.dataset.editSupplier);if(!selected)return;
   for(const key of ["id","name","phone","email","tax_id","address","notes"]){const node=field(suppliersForm,key);if(node)node.value=selected[key]||""}
   field(suppliersForm,"contact").value=selected.contact_name||"";
   field(suppliersForm,"is_active").checked=!!selected.is_active;
   $("#supplierSubmit").textContent="Salvar alterações do fornecedor";
   $("#cancelSupplierEdit").hidden=false;feedback("supplierFeedback","Editando "+selected.name);
   suppliersForm.scrollIntoView({behavior:"smooth",block:"center"});
  });
 }
 function renderHistory(){
  $("#purchaseHistory").innerHTML=table([
   ["Data",r=>r.purchased_at?new Date(r.purchased_at).toLocaleDateString("pt-BR"):"—"],
   ["Fornecedor",r=>esc(r.supplier_name||"—")],["Produto",r=>esc(r.product_name||"—")],
   ["Destino",r=>esc(r.location_name||"—")],["Unid.",r=>r.quantity??"—"],
   ["Custo/un.",r=>r.unit_cost_cents!=null?money(r.unit_cost_cents):"—"],
   ["Venda",r=>r.sale_price_cents!=null?money(r.sale_price_cents):"—"],
   ["Acréscimo",r=>r.markup_percent!=null?esc(r.markup_percent)+"%":"—"],
   ["Referência",r=>esc(r.reference_code||"—")]
  ],history);
 }
 async function load(){
  const [supplierResult,lotResult]=await Promise.allSettled([
   api({action:"list_suppliers"}),api({action:"list_purchase_lots"})
  ]);
  if(supplierResult.status==="fulfilled"){
   suppliers=supplierResult.value.data||[];renderSuppliers();feedback("supplierFeedback","");
  }else{feedback("supplierFeedback","Falha ao consultar fornecedores: "+errorText(supplierResult.reason))}
  if(lotResult.status==="fulfilled"){
   history=lotResult.value.data?.lots||[];pricing=lotResult.value.data?.pricing||[];
   renderHistory();syncRepriceSelection();
  }else{feedback("lotFeedback","Não foi possível carregar o histórico: "+errorText(lotResult.reason))}
  return supplierResult.status==="fulfilled"&&lotResult.status==="fulfilled";
 }
 function resetSupplier(){
  suppliersForm.reset();field(suppliersForm,"id").value="";
  field(suppliersForm,"is_active").checked=true;
  $("#supplierSubmit").textContent="Cadastrar fornecedor";$("#cancelSupplierEdit").hidden=true;
 }
 suppliersForm.onsubmit=async event=>{
  event.preventDefault();const button=$("#supplierSubmit"),id=field(suppliersForm,"id").value;
  const payload={id,name:field(suppliersForm,"name").value.trim(),
   contact_name:field(suppliersForm,"contact").value.trim(),phone:field(suppliersForm,"phone").value.trim(),
   email:field(suppliersForm,"email").value.trim(),tax_id:field(suppliersForm,"tax_id").value.trim(),
   address:field(suppliersForm,"address").value.trim(),notes:field(suppliersForm,"notes").value.trim(),
   is_active:field(suppliersForm,"is_active").checked};
  button.disabled=true;feedback("supplierFeedback","Salvando fornecedor...");
  try{
   await api({action:id?"update_supplier":"create_supplier",supplier:payload});
   resetSupplier();feedback("supplierFeedback","Fornecedor salvo com sucesso.",true);notify("Fornecedor salvo.");
   await load();
  }catch(error){feedback("supplierFeedback",errorText(error))}
  finally{button.disabled=false}
 };
 $("#cancelSupplierEdit").onclick=()=>{resetSupplier();feedback("supplierFeedback","")};
 function priceFrom(cost,percentage){return Math.round(cost*(1+percentage/100))}
 function computePurchase(){
  const cost=Number(field(lotForm,"cost").value),markup=Number(field(lotForm,"markup").value);
  const costCents=cents(cost),valid=Number.isFinite(cost)&&cost>0&&Number.isFinite(markup)&&markup>=0&&markup<=1000;
  const price=valid?priceFrom(costCents,markup):0;
  $("#lotSalePreview").value=valid?money(price):"";
  const gross=price-costCents;
  $("#lotPriceSummary").textContent=valid?
   "Compra: "+money(costCents)+" / un.  →  Acréscimo: "+markup.toLocaleString("pt-BR")+"%  →  Venda: "+money(price)+
   "  |  Ganho bruto por unidade: "+money(gross)+
   "  |  Margem sobre venda: "+(price?((gross/price)*100).toFixed(1).replace(".",","):"0")+"% (sem descontar frete e outras despesas).":
   "Informe o custo unitário e o percentual sobre o custo para calcular o preço de venda.";
  return {valid,costCents,markup,price};
 }
 for(const name of ["cost","markup"]){field(lotForm,name).addEventListener("input",computePurchase)}
 field(lotForm,"product_id").addEventListener("change",()=>{
  const saved=pricing.find(x=>x.product_id===field(lotForm,"product_id").value);
  if(saved){
   field(lotForm,"cost").value=(Number(saved.last_unit_cost_cents)/100).toFixed(2);
   field(lotForm,"markup").value=Number(saved.markup_percent);
  }else{
   field(lotForm,"cost").value="";
   field(lotForm,"markup").value="40";
  }
  computePurchase();
 });
 const now=new Date();field(lotForm,"purchased_at").value=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
 lotForm.onsubmit=async event=>{
  event.preventDefault();const submit=$("#lotSubmit"),f=new FormData(lotForm),price=computePurchase();
  const qty=Number(f.get("qty"));
  if(!price.valid||!Number.isInteger(qty)||qty<1||qty>10000){feedback("lotFeedback","Confira a quantidade, o custo e a porcentagem.");return}
  if(!f.get("supplier_id")||!f.get("location_id")||!f.get("product_id")){feedback("lotFeedback","Selecione fornecedor, estoque e produto.");return}
  const snapshot=JSON.stringify([...f.entries()].filter(([key])=>key!=="sale_price_preview"));
  if(!pendingId||pendingFingerprint!==snapshot){pendingId=crypto.randomUUID();pendingFingerprint=snapshot}
  const purchase={
   request_id:pendingId,supplier_id:f.get("supplier_id"),location_id:f.get("location_id"),
   product_id:f.get("product_id"),quantity:qty,unit_cost_cents:price.costCents,markup_percent:price.markup,
   purchased_at:f.get("purchased_at"),reference_code:f.get("reference_code"),
   freight_cents:cents(f.get("freight")),other_costs_cents:cents(f.get("other_costs")),
   risk_type:f.get("risk")||null,risk_value_cents:cents(f.get("risk_value")),
   risk_note:f.get("risk_note"),notes:f.get("notes")
  };
  submit.disabled=true;feedback("lotFeedback","Registrando compra e atualizando estoque...");
  try{
   const saved=await api({action:"receive_purchase",purchase});
   pendingId=null;pendingFingerprint="";
   feedback("lotFeedback",saved.data?.already_recorded?
     "Esta compra já estava registrada; nenhuma unidade foi duplicada.":"Compra registrada! Estoque e preço de venda atualizados juntos.",true);
   lotForm.reset();
   const today=new Date();field(lotForm,"purchased_at").value=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
   computePurchase();notify("Entrada de mercadoria confirmada.");
   const updated=await Promise.allSettled([refresh(),load()]);
   if(updated.some(x=>x.status==="rejected"))notify("Entrada salva; atualize a página para conferir o painel.");
  }catch(error){feedback("lotFeedback",errorText(error))}
  finally{submit.disabled=false}
 };
 const pfield=name=>priceForm.elements.namedItem(name);
 function syncRepriceSelection(){
  const id=pfield("product_id").value;
  const saved=pricing.find(x=>x.product_id===id);
  $("#repriceCost").value=saved?money(saved.last_unit_cost_cents):"";
  pfield("markup").value=saved?Number(saved.markup_percent):"";
  showRepricePreview();
 }
 function showRepricePreview(){
  const saved=pricing.find(x=>x.product_id===pfield("product_id").value);
  const markup=Number(pfield("markup").value);
  $("#repricePreview").value=saved&&Number.isFinite(markup)&&markup>=0&&markup<=1000?
   money(priceFrom(Number(saved.last_unit_cost_cents),markup)):"";
 }
 $("#repriceProduct").onchange=syncRepriceSelection;
 $("#repriceMarkup").oninput=showRepricePreview;
 priceForm.onsubmit=async event=>{
  event.preventDefault();const button=$("#repriceSubmit"),id=pfield("product_id").value,markup=Number(pfield("markup").value);
  if(!pricing.some(x=>x.product_id===id)){feedback("repriceFeedback","Primeiro registre o custo deste produto em uma compra.");return}
  if(!Number.isFinite(markup)||markup<0||markup>1000){feedback("repriceFeedback","Acréscimo deve estar entre 0% e 1000%.");return}
  button.disabled=true;feedback("repriceFeedback","Salvando o novo preço...");
  try{
   const result=await api({action:"reprice_product",product_id:id,markup_percent:markup});
   feedback("repriceFeedback","Preço atualizado para "+money(result.data?.new_price_cents)+".",true);
   notify("Preço de venda reajustado.");
   await refresh();await load();
  }catch(error){feedback("repriceFeedback",errorText(error))}
  finally{button.disabled=false}
 };
 computePurchase();
 return {load};
}
