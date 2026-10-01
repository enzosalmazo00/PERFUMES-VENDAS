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
  PURCHASE_ITEMS_INVALID:"Confira todas as linhas: selecione produtos válidos, quantidades e custos.",
  REQUEST_ID_REQUIRED:"Identificador da compra inválido. Atualize o ADM e tente novamente.",
  DUPLICATE_PURCHASE_PRODUCT:"Este produto aparece duas vezes. Agrupe as quantidades em uma linha.",
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
   $("#supplierActiveLabel").hidden=false;
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
  $("#supplierActiveLabel").hidden=true;
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
 const lines=()=>[...document.querySelectorAll("#lotItems .purchase-line")];
 const lineField=(line,name)=>line.querySelector('[name="'+name+'"]');
 const normal=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
 const allCatalogProducts=()=>getData()?.products||[];
 function setPurchaseDate(){
  const now=new Date();field(lotForm,"purchased_at").value=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
 }
 function filterLineProducts(line,term="",preserve=true){
  const select=lineField(line,"product_id"),selected=preserve?select.value:"";
  const tokens=normal(term).split(/\s+/).filter(Boolean);
  const found=allCatalogProducts().filter(p=>{
   const hay=normal((p.brand||"")+" "+p.name+" "+(p.volume_ml||"")+" ml");
   return tokens.every(t=>hay.includes(t));
  });
  select.innerHTML=option(found,"id",p=>(p.brand?p.brand+" · ":"")+p.name+" · "+p.volume_ml+" mL",
    found.length?"Selecione o produto":"Nenhum produto cadastrado encontrado");
  if(selected&&found.some(p=>p.id===selected))select.value=selected;
  else select.value="";
  return found.length;
 }
 function computeLine(line){
  const id=lineField(line,"product_id").value;
  const quantity=Number(lineField(line,"qty").value);
  const rawCost=lineField(line,"cost").value,rawMarkup=lineField(line,"markup").value;
  const unitCost=Number(rawCost),markup=Number(rawMarkup);
  const priceReady=rawCost!==""&&rawMarkup!==""&&Number.isFinite(unitCost)&&unitCost>0&&
    Number.isFinite(markup)&&markup>=0&&markup<=1000;
  const costCents=priceReady?cents(unitCost):0;
  const priceCents=priceReady?priceFrom(costCents,markup):0;
  lineField(line,"sale_price_preview").value=priceReady?money(priceCents):"";
  const valid=Boolean(id)&&Number.isSafeInteger(quantity)&&quantity>=1&&quantity<=10000&&priceReady;
  const summary=line.querySelector(".purchase-line-summary");
  summary.textContent=priceReady?
   "Compra: "+money(costCents)+"/un. · Venda: "+money(priceCents)+"/un. · Acréscimo: "+
   markup.toLocaleString("pt-BR")+"%"+(valid?" · "+quantity+" unidade(s) · Total: "+money(quantity*costCents):""):
   "Informe o custo de compra e a porcentagem deste produto.";
  summary.classList.toggle("is-valid",valid);
  return {valid,product_id:id,quantity,unit_cost_cents:costCents,markup_percent:markup,
    sale_price_cents:priceCents,line_cost_cents:valid?quantity*costCents:0,
    line_revenue_cents:valid?quantity*priceCents:0};
 }
 function computePurchase(){
  const data=lines().map(computeLine),ids=data.filter(x=>x.product_id).map(x=>x.product_id);
  const duplicate=new Set(ids).size!==ids.length;
  const valid=data.length>0&&data.every(x=>x.valid)&&!duplicate;
  const units=data.reduce((n,x)=>n+(x.valid?x.quantity:0),0);
  const totalCost=data.reduce((n,x)=>n+x.line_cost_cents,0);
  const totalRevenue=data.reduce((n,x)=>n+x.line_revenue_cents,0);
  const freight=cents(field(lotForm,"freight").value),other=cents(field(lotForm,"other_costs").value);
  const risk=cents(field(lotForm,"risk_value").value);
  const extras=Math.max(0,freight)+Math.max(0,other)+Math.max(0,risk);
  $("#purchaseLineCount").textContent=data.length+" produto(s) · "+units+" unidade(s) conferidas";
  $("#addPurchaseLine").disabled=data.length>=30;
  $("#lotPriceSummary").textContent=
    (duplicate?"Atenção: o mesmo produto está em mais de uma linha. Agrupe a quantidade. · ":"")+
    "Total pago pelos produtos: "+money(totalCost)+" · Despesas informadas: "+money(extras)+
    " · Compra estimada: "+money(totalCost+extras)+
    " · Receita prevista com preços cadastrados: "+money(totalRevenue)+
    " · Diferença projetada: "+money(totalRevenue-totalCost-extras)+
    " (estimativa antes das taxas e demais despesas operacionais).";
  return {valid,duplicate,items:data.map(({product_id,quantity,unit_cost_cents,markup_percent})=>({
    product_id,quantity,unit_cost_cents,markup_percent
  }))};
 }
 function setLineCostFromProduct(line){
  const saved=pricing.find(x=>x.product_id===lineField(line,"product_id").value);
  lineField(line,"cost").value=saved?(Number(saved.last_unit_cost_cents)/100).toFixed(2):"";
  lineField(line,"markup").value=saved?Number(saved.markup_percent):40;
  computePurchase();
 }
 function reindexLines(){
  lines().forEach((line,index)=>{
   line.setAttribute("aria-label","Produto recebido "+(index+1));
   line.querySelector(".purchase-line-title strong").textContent="Produto "+(index+1);
   line.querySelector("[data-remove-purchase-line]").hidden=index===0;
  });
  computePurchase();
 }
 function wireLine(line){
  const search=line.querySelector(".purchase-line-search");
  const select=lineField(line,"product_id");
  search.addEventListener("input",()=>{
   const before=select.value,found=filterLineProducts(line,search.value);
   if(before&&!select.value)setLineCostFromProduct(line);
   else computePurchase();
   if(found===1&&select.options.length===2){select.value=select.options[1].value;setLineCostFromProduct(line)}
  });
  search.addEventListener("keydown",event=>{
   if(event.key==="Enter"){
    const matches=[...select.options].filter(o=>o.value);
    if(matches.length===1){event.preventDefault();select.value=matches[0].value;setLineCostFromProduct(line)}
   }
  });
  select.addEventListener("change",()=>setLineCostFromProduct(line));
  for(const key of ["qty","cost","markup"]){
   lineField(line,key).addEventListener("input",computePurchase);
  }
  line.querySelector("[data-remove-purchase-line]").addEventListener("click",()=>{
   if(lines().length<=1)return;
   line.remove();reindexLines();
  });
 }
 const firstLine=lines()[0];if(!firstLine)throw new Error("PURCHASE_FORM_MISSING");
 wireLine(firstLine);
 $("#addPurchaseLine").onclick=()=>{
  if(lines().length>=30)return feedback("lotFeedback","Limite de 30 produtos por compra.");
  const line=firstLine.cloneNode(true);
  line.querySelectorAll("[id]").forEach(node=>node.removeAttribute("id"));
  line.querySelectorAll("input").forEach(node=>node.value="");
  lineField(line,"markup").value="40";
  line.querySelector("[data-remove-purchase-line]").hidden=false;
  $("#lotItems").append(line);
  filterLineProducts(line,"",false);wireLine(line);reindexLines();
  line.querySelector(".purchase-line-search").focus();
 };
 for(const name of ["freight","other_costs","risk_value"]){
  field(lotForm,name).addEventListener("input",computePurchase);
 }
 setPurchaseDate();computePurchase();
 lotForm.onsubmit=async event=>{
  event.preventDefault();
  const submit=$("#lotSubmit"),f=new FormData(lotForm),computed=computePurchase();
  if(computed.duplicate){feedback("lotFeedback","O mesmo produto foi selecionado duas vezes. Some a quantidade em uma única linha.");return}
  if(!computed.valid){feedback("lotFeedback","Confira produto, quantidade, custo e porcentagem de todas as linhas.");return}
  if(!f.get("supplier_id")||!f.get("location_id")){
   feedback("lotFeedback","Selecione o fornecedor e o destino do estoque.");return;
  }
  const snapshot=JSON.stringify({supplier:f.get("supplier_id"),location:f.get("location_id"),
   items:computed.items,purchased_at:f.get("purchased_at"),reference:f.get("reference_code"),
   freight:f.get("freight"),other:f.get("other_costs"),risk:f.get("risk"),
   risk_value:f.get("risk_value"),risk_note:f.get("risk_note"),notes:f.get("notes")});
  if(!pendingId||pendingFingerprint!==snapshot){pendingId=crypto.randomUUID();pendingFingerprint=snapshot}
  const purchase={
   request_id:pendingId,supplier_id:f.get("supplier_id"),location_id:f.get("location_id"),
   items:computed.items,purchased_at:f.get("purchased_at"),reference_code:f.get("reference_code"),
   freight_cents:cents(f.get("freight")),other_costs_cents:cents(f.get("other_costs")),
   risk_type:f.get("risk")||null,risk_value_cents:cents(f.get("risk_value")),
   risk_note:f.get("risk_note"),notes:f.get("notes")
  };
  submit.disabled=true;feedback("lotFeedback","Registrando "+computed.items.length+" produtos e atualizando o estoque...");
  try{
   const saved=await api({action:"receive_purchase",purchase});
   pendingId=null;pendingFingerprint="";
   feedback("lotFeedback",saved.data?.already_recorded?
    "Esta compra já estava registrada. Nenhuma unidade foi duplicada.":
    "Compra registrada: "+saved.data?.item_count+" produtos, "+saved.data?.total_units+
    " unidades. Todos os saldos e preços foram atualizados juntos.",true);
   lines().slice(1).forEach(row=>row.remove());
   lotForm.reset();firstLine.querySelector(".purchase-line-search").value="";
   filterLineProducts(firstLine,"",false);setPurchaseDate();reindexLines();
   notify("Entrada de todos os produtos confirmada.");
   const updated=await Promise.allSettled([refresh(),load()]);
   if(updated.some(x=>x.status==="rejected"))notify("Compra salva. Atualize o ADM para conferir os saldos.");
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
