
const $=s=>document.querySelector(s);
const fmt=c=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(c||0)/100);
const n=x=>Number(x)||0;
const esc=x=>String(x??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const sum=(rows,key)=>rows.reduce((a,x)=>a+n(typeof key==="function"?key(x):x[key]),0);
const categories={marketing:"Marketing",frete:"Frete operacional",embalagens:"Embalagens",aluguel:"Aluguel",servicos:"Serviços",impostos:"Impostos",taxas:"Taxas extras",transporte:"Transporte",outros:"Outros"};
let api,notifyFn,lastData=null,lastAnalysis=null,loading=false;
const reportNode=()=>$("#adminFinanceHub");
const fields=()=>({from:$("#financeFrom").value,to:$("#financeTo").value,seller_id:$("#financeSeller").value,product_id:$("#financeProduct").value});
function metric(name,value,note=""){return '<div class="metric" style="min-height:112px"><span>'+esc(name)+'</span><strong>'+esc(value)+'</strong>'+(note?'<small style="display:block;margin-top:8px;color:#c5b89c">'+esc(note)+'</small>':"")+'</div>'}
function barChart(rows){
 const max=Math.max(1,...rows.map(x=>n(x.sales)));
 const bars=rows.map(x=>'<div style="display:flex;flex-direction:column;align-items:center;justify-content:end;min-width:43px;flex:1;gap:5px" title="'+esc(x.label)+': '+fmt(x.sales)+'"><small style="font-size:10px">'+fmt(x.sales)+'</small><div style="width:65%;min-height:2px;height:'+Math.max(2,Math.round(n(x.sales)/max*145))+'px;border-radius:5px 5px 0 0;background:linear-gradient(#e6c27e,#90703b)"></div><small>'+esc(x.label)+'</small></div>').join("");
 return '<div role="img" aria-label="Gráfico de faturamento do período por mês" style="display:flex;gap:9px;align-items:end;overflow-x:auto;min-height:195px;padding:10px 0;border-bottom:1px solid #5d4929">'+bars+'</div>';
}
function analyze(d,productId){
 const p=d.private||{},orders=d.orders||[],items=d.items||[],locations=d.locations||[],balances=d.stock||[];
 const itemMap=new Map(),productNames=new Map((d.products||[]).map(x=>[x.id,x.name]));
 for(const i of items){const list=itemMap.get(i.order_id)||[];list.push(i);itemMap.set(i.order_id,list)}
 const costs=new Map((p.costs||[]).map(c=>[c.seller_id+"|"+c.product_id,n(c.unit_cost_cents)]));
 const fallbackCosts=new Map();
 for(const row of p.purchases||[]){const k=row.seller_id+"|"+row.product_id,prev=fallbackCosts.get(k)||{cost:0,qty:0};prev.cost+=n(row.unit_cost_cents)*n(row.quantity);prev.qty+=n(row.quantity);fallbackCosts.set(k,prev)}
 const unitCost=(seller,product)=>{const key=seller+"|"+product;if(costs.has(key))return costs.get(key);const hist=fallbackCosts.get(key);return hist&&hist.qty>0?Math.round(hist.cost/hist.qty):null};
 const feeMap=new Map((p.fees||[]).map(x=>[x.order_id,x]));
 const locationMap=new Map(locations.map(x=>[x.id,x]));
 let merchandiseRevenue=0,receipts=0,shipping=0,knownCogs=0,uncosted=0,uncostedUnits=0,fees=0,unknownFees=0,commissions=0,soldUnits=0,completeOrders=0;
 const byMonth=new Map(),byProduct=new Map(),bySeller=new Map();
 for(const order of orders){
  const all=itemMap.get(order.id)||[];
  const chosen=productId?all.filter(i=>i.product_id===productId):all;
  if(!chosen.length)continue;
  completeOrders++;
  const lineSum=sum(all,"line_total_cents");
  const ratio=productId&&lineSum>0?sum(chosen,"line_total_cents")/lineSum:1;
  const rev=sum(chosen,"line_total_cents");
  merchandiseRevenue+=rev;receipts+=Math.round(n(order.total_cents)*ratio);
  shipping+=productId?0:n(order.shipping_price_cents);
  commissions+=Math.round(n(order.seller_commission_cents)*ratio);
  let fee=feeMap.get(order.id);
  if(fee&&fee.fee_source==="provider_actual"){fees+=Math.round((n(fee.payment_fee_cents)+n(fee.financing_fee_cents)+n(fee.taxes_cents))*ratio)}
  else unknownFees++;
  const month=String(order.payment_confirmed_at||order.created_at).slice(0,7);
  byMonth.set(month,(byMonth.get(month)||0)+rev);
  const sellerEntry=bySeller.get(order.seller_id)||{seller:order.seller_id,revenue:0,commission:0,orders:0};
  sellerEntry.revenue+=rev;sellerEntry.commission+=Math.round(n(order.seller_commission_cents)*ratio);sellerEntry.orders++;bySeller.set(order.seller_id,sellerEntry);
  for(const item of chosen){
   const qty=n(item.quantity),cost=unitCost(order.seller_id,item.product_id);
   soldUnits+=qty;
   if(cost===null){uncosted++;uncostedUnits+=qty}else knownCogs+=cost*qty;
   const pi=byProduct.get(item.product_id)||{name:item.product_name||productNames.get(item.product_id)||"Produto",quantity:0,revenue:0,cost:0,missing:false};
   pi.quantity+=qty;pi.revenue+=n(item.line_total_cents);if(cost===null)pi.missing=true;else pi.cost+=qty*cost;byProduct.set(item.product_id,pi)
  }
 }
 const expenses=(p.expenses||[]).filter(x=>x.date>=d.from&&x.date<=d.to&&(!d.seller_id||x.seller_id===d.seller_id));
 const operations=sum(expenses,"amount_cents");
 const purchases=(p.purchases||[]).filter(x=>String(x.date||"").slice(0,10)>=d.from&&String(x.date||"").slice(0,10)<=d.to&&(!d.seller_id||x.seller_id===d.seller_id));
 const purchaseAmount=sum(purchases,x=>n(x.quantity)*n(x.unit_cost_cents))+sum([...new Map(purchases.map(x=>[x.id,x])).values()],x=>n(x.freight_cents)+n(x.other_costs_cents));
 const enteredUnits=sum(purchases,"quantity");
 const filteredStocks=balances.filter(x=>!d.seller_id||locationMap.get(x.location_id)?.seller_id===d.seller_id).filter(x=>!productId||x.product_id===productId);
 let stockQty=0,stockKnown=0,stockUnknown=0,stockLow=0;
 for(const x of filteredStocks){const seller=locationMap.get(x.location_id)?.seller_id,c=unitCost(seller,x.product_id),qty=n(x.quantity);stockQty+=qty;if(c===null)stockUnknown+=qty;else stockKnown+=c*qty;if(qty<=n(x.low_stock_threshold))stockLow++}
 const payoutRows=(d.payouts||[]).filter(x=>!d.seller_id||x.seller_id===d.seller_id);
 const paidPayouts=payoutRows.filter(x=>x.paid_at&&String(x.paid_at).slice(0,10)>=d.from&&String(x.paid_at).slice(0,10)<=d.to);
 const requestedPayouts=payoutRows.filter(x=>x.status==="requested");
 const lossCodes=new Set(["loss","breakage","damage","road_loss","seizure"]);
 const lossRows=(d.movements||[]).filter(x=>lossCodes.has(x.reason_code)&&(!productId||x.product_id===productId));
 const losses=sum(lossRows,"financial_impact_cents");
 const feeComplete=unknownFees===0;
 const cogsComplete=uncosted===0&&completeOrders>0;
 const netComplete=cogsComplete&&feeComplete&&!productId;
 const grossProfit=cogsComplete?merchandiseRevenue-knownCogs:null;
 const operational=netComplete?merchandiseRevenue-knownCogs-commissions-fees-operations-losses:null;
 return {receipts,merchandiseRevenue,shipping,knownCogs,uncosted,uncostedUnits,fees,unknownFees,commissions,soldUnits,completeOrders,byMonth,byProduct,bySeller,expenses,operations,purchaseAmount,enteredUnits,stockQty,stockKnown,stockUnknown,stockLow,payoutRows,paidPayouts,requestedPayouts,losses,grossProfit,operational,netComplete,cogsComplete,feeComplete,orders:orders.filter(o=>!productId||(itemMap.get(o.id)||[]).some(i=>i.product_id===productId)),purchases};
}
function render(d){
 const productId=$("#financeProduct").value,model=analyze(d,productId);lastAnalysis=model;
 const exact=x=>x==null?"Não apurado":fmt(x);
 const noteMissing=model.uncosted?"Falta custo de "+model.uncosted+" linha(s) de venda.":"Custos de todas as linhas cadastrados.";
 const profitNote=productId?"Filtro por produto: despesas comuns não são rateadas.":model.netComplete?"Apuração estimada com dados cadastrados.":"Lucro operacional indisponível até cadastrar custos e taxas reais.";
 $("#financeKpis").innerHTML=[
  metric("Vendas aprovadas",String(model.completeOrders),"Pedidos com pagamento aprovado"),
  metric("Faturamento de produtos",fmt(model.merchandiseRevenue),"Sem frete"),
  metric("Recebimentos de pedidos",fmt(model.receipts),"Inclui frete quando aplicável"),
  metric("Custo da mercadoria vendida",model.cogsComplete?fmt(model.knownCogs):"Não apurado",noteMissing),
  metric("Lucro bruto",exact(model.grossProfit),model.cogsComplete?"Receita de itens − CMV":"Aguardando custo dos produtos"),
  metric("Comissões geradas",fmt(model.commissions),"Não são transferências efetivas"),
  metric("Taxas conhecidas",fmt(model.fees),model.unknownFees+" pedido(s) sem taxa efetiva"),
  metric("Despesas lançadas",fmt(model.operations),"Gastos do período"),
  metric("Perdas do estoque",fmt(model.losses),"Conforme movimentações informadas"),
  metric("Resultado operacional estimado",exact(model.operational),profitNote),
  metric("Compras de mercadorias",fmt(model.purchaseAmount),"Capital investido, não despesa integral no lucro"),
  metric("Repasses efetivamente marcados pagos",fmt(sum(model.paidPayouts,"amount_cents")),"Fluxo de caixa, sem duplicar despesa"),
  metric("Estoque atual",String(model.stockQty)+" unidades",model.stockLow+" saldo(s) com alerta"),
  metric("Custo identificado do estoque",model.stockUnknown?fmt(model.stockKnown)+" (parcial)":fmt(model.stockKnown),model.stockUnknown+" unidade(s) sem custo")
 ].join("");
 $("#financeWarnings").innerHTML='<strong>Conciliação e limites dos resultados</strong><p>'+[
  model.uncosted?"Faltam custos de mercadoria nas vendas; não mostramos lucro como se custo fosse zero.":"Custos das vendas cobertos.",
  model.unknownFees?"Taxas Mercado Pago ainda não conciliadas em "+model.unknownFees+" pedido(s).":"Taxas de pagamento registradas.",
  "Comissões são apropriadas por venda; repasses pagos não são descontados novamente do lucro.",
  "Compras aumentam o estoque; o custo é reconhecido como CMV quando o produto é vendido.",
  "Resultado operacional estimado não equivale a lucro líquido contábil ou fiscal.",
  "Filtragem temporal considera a data do pedido para evitar deixar pagamentos sem data de confirmação de fora."
 ].map(esc).join("<br>")+'</p>';
 const months=[];const start=new Date(d.from+"T12:00:00Z"),end=new Date(d.to+"T12:00:00Z");const ptr=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),1));
 while(ptr<=end&&months.length<36){const key=ptr.toISOString().slice(0,7);months.push({key,label:key.slice(5)+"/"+key.slice(2,4),sales:model.byMonth.get(key)||0});ptr.setUTCMonth(ptr.getUTCMonth()+1)}
 $("#financeChart").innerHTML=barChart(months);
 const sellers=new Map((d.sellers||[]).map(x=>[x.id,x.name]));
 $("#financeProductRanking").innerHTML=[...model.byProduct.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,30).map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+x.quantity+'</td><td>'+fmt(x.revenue)+'</td><td>'+(x.missing?"Custo não apurado":fmt(x.cost))+'</td></tr>').join("")||'<tr><td colspan="4">Nenhuma venda de produto neste período</td></tr>';
 $("#financeSellerRanking").innerHTML=[...model.bySeller.values()].sort((a,b)=>b.revenue-a.revenue).map(x=>'<tr><td>'+esc(sellers.get(x.seller)||"Vendedor")+'</td><td>'+x.orders+'</td><td>'+fmt(x.revenue)+'</td><td>'+fmt(x.commission)+'</td></tr>').join("")||'<tr><td colspan="4">Nenhuma venda registrada</td></tr>';
 $("#financeExpenseRows").innerHTML=model.expenses.slice(0,100).map(x=>'<tr><td>'+esc(x.date)+'</td><td>'+esc(categories[x.category]||x.category)+'</td><td>'+esc(x.description)+'</td><td>'+fmt(x.amount_cents)+'</td><td><button type="button" class="btn" data-finance-remove="'+esc(x.id)+'">Excluir</button></td></tr>').join("")||'<tr><td colspan="5">Nenhuma despesa lançada neste período</td></tr>';
 $("#financePurchases").innerHTML='<strong>Mercadorias recebidas: '+model.enteredUnits+' unidades · '+fmt(model.purchaseAmount)+'</strong><p class="muted">Entradas de fornecedores devem ser cadastradas na aba Compras e fornecedores. Ajustes manuais do estoque não representam necessariamente novas compras.</p>';
 $("#financePayouts").innerHTML='<div class="metrics">'+metric("Repasses a solicitar",fmt(sum(model.requestedPayouts,"amount_cents")),"Solicitações aguardando o ADM")+
 metric("Pagamentos registrados no período",fmt(sum(model.paidPayouts,"amount_cents")),"Saídas de caixa informadas pelo administrador")+'</div>';
 $("#financeStatus").textContent=d.truncated?"Atenção: limite de resultados alcançado. Divida o período para obter dados completos.":"Atualizado com dados do banco de dados.";
}
function exportCSV(){
 if(!lastData||!lastAnalysis)return;
 const d=lastData,m=lastAnalysis;
 const rows=[["Categoria","Descrição","Valor (R$)"],["Resumo","Faturamento de produtos",(m.merchandiseRevenue/100).toFixed(2)],["Resumo","Recebimentos",(m.receipts/100).toFixed(2)],["Resumo","Comissões",(m.commissions/100).toFixed(2)],["Resumo","Despesas",(m.operations/100).toFixed(2)],["Resumo","Custos de mercadoria identificados",(m.knownCogs/100).toFixed(2)],["Resumo","Taxas identificadas",(m.fees/100).toFixed(2)],["Resumo","Lucro bruto",m.grossProfit==null?"NÃO APURADO":(m.grossProfit/100).toFixed(2)],["Resumo","Resultado operacional",m.operational==null?"NÃO APURADO":(m.operational/100).toFixed(2)]];
 for(const p of m.byProduct.values())rows.push(["Produto",p.name,(p.revenue/100).toFixed(2)]);
 for(const e of m.expenses)rows.push(["Despesa",e.date+" - "+e.description,(n(e.amount_cents)/100).toFixed(2)]);
 const csv="\ufeff"+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(";")).join("\r\n");
 const u=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const a=document.createElement("a");a.href=u;a.download="AZZENA-financeiro-"+d.from+"-"+d.to+".csv";a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);
}
async function load(){
 if(loading)return;const el=reportNode();if(!el)return;
 const f=fields();if(!f.from||!f.to||f.from>f.to){notifyFn("Selecione um período válido.");return}
 loading=true;$("#financeStatus").textContent="Consultando dados financeiros...";
 try{
  const res=await api({action:"finance_report",from:f.from,to:f.to,seller_id:f.seller_id});
  lastData=res.data;
  const sellers=$("#financeSeller");if(sellers.options.length<=1){(lastData.sellers||[]).forEach(x=>sellers.add(new Option(x.name,x.id)))}
  const products=$("#financeProduct");if(products.options.length<=1){(lastData.products||[]).forEach(x=>products.add(new Option(x.name,x.id)))}
  render(lastData);
 }catch(e){$("#financeStatus").textContent="Não foi possível carregar o financeiro: "+(e.message||"Erro desconhecido")}finally{loading=false}
}
export function setupAdminFinance({call,notify}){
 api=call;notifyFn=notify;
 const root=reportNode();if(!root)return;
 const today=new Date(),first=new Date(today.getFullYear(),today.getMonth(),1);
 $("#financeFrom").value=first.toISOString().slice(0,10);
 $("#financeTo").value=today.toISOString().slice(0,10);
 $("#financeApply").onclick=load;
 $("#financeSeller").onchange=load;
 $("#financeProduct").onchange=()=>{if(lastData)render(lastData)};
 $("#financeExport").onclick=exportCSV;
 $("#financeQuickMonth").onclick=()=>{const d=new Date();$("#financeFrom").value=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);$("#financeTo").value=d.toISOString().slice(0,10);load()};
 $("#financeQuickYear").onclick=()=>{const d=new Date();$("#financeFrom").value=d.getFullYear()+"-01-01";$("#financeTo").value=d.toISOString().slice(0,10);load()};
 $("#financeExpenseForm").onsubmit=async e=>{
  e.preventDefault();const form=e.currentTarget,f=new FormData(form);
  const amount=Math.round(Number(String(f.get("amount")||"").replace(",","."))*100);
  if(!Number.isSafeInteger(amount)||amount<=0){notifyFn("Informe um valor válido.");return}
  const button=form.querySelector('button[type="submit"]');button.disabled=true;
  try{await api({action:"finance_expense_add",date:f.get("date"),category:f.get("category"),description:f.get("description"),amount_cents:amount,seller_id:$("#financeSeller").value||null});form.reset();form.elements.date.value=new Date().toISOString().slice(0,10);notifyFn("Despesa lançada.");await load()}
  catch(err){notifyFn(err.message||"Falha ao lançar despesa")}finally{button.disabled=false}
 };
 $("#financeExpenseDate").value=today.toISOString().slice(0,10);
 root.addEventListener("click",async e=>{
  const btn=e.target.closest("[data-finance-remove]");
  if(!btn)return;if(!confirm("Excluir este lançamento de despesa?"))return;
  btn.disabled=true;try{await api({action:"finance_expense_delete",expense_id:btn.dataset.financeRemove});notifyFn("Despesa excluída.");await load()}catch(err){notifyFn(err.message||"Falha ao excluir");btn.disabled=false}
 });
}
export {load as loadAdminFinance};
