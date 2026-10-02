// AZZENA — workspace do vendedor. Organização visual sem alterar permissões ou transações.
const $=selector=>document.querySelector(selector);
const TABS=[
 {id:"visao",title:"Início",hint:"Resumo geral do seu painel e prioridades do dia.",nodes:["sellerWorkflow","metrics"]},
 {id:"notificacoes",title:"Notificações",hint:"Pedidos novos, pagamentos confirmados e avisos das suas vendas.",nodes:["sellerNotificationCenter"]},
 {id:"pedidos",title:"Pedidos",hint:"Acompanhe os pedidos recebidos pelo seu catálogo.",nodes:["sellerOrdersCard"]},
 {id:"retiradas",title:"Retiradas",hint:"Confira o código do cliente antes de liberar uma retirada.",nodes:["sellerPickupVerifier"]},
 {id:"agenda",title:"Agenda",hint:"Cadastre separadamente os dias e horários disponíveis.",nodes:["sellerPickupScheduleCard"]},
 {id:"locais",title:"Locais de entrega",hint:"Cadastre e edite o local autorizado usado no atendimento ao cliente.",nodes:["sellerPickupCard"]},
 {id:"estoque",title:"Meu estoque",hint:"Veja somente os produtos e unidades vinculados ao seu estoque.",nodes:["sellerInventoryCard"]},
 {id:"alertas",title:"Alertas de estoque",hint:"Consulte separadamente os produtos com estoque baixo.",nodes:["sellerLowStockCard"]},
 {id:"caixa",title:"Venda em dinheiro",hint:"Registre sua venda presencial recebida em dinheiro vivo.",nodes:["sellerCashCard"]},
 {id:"cobranca",title:"Cobrança personalizada",hint:"Crie e acompanhe cobranças de encomendas que serão enviadas ao cliente.",nodes:["sellerCustomSaleCard"]},
 {id:"vendas",title:"Minhas vendas",hint:"Consulte o histórico das suas vendas.",nodes:["sellerSalesHistoryCard"]},
 {id:"financeiro",title:"Minhas finanças",hint:"Veja o resumo financeiro das suas próprias vendas.",nodes:["sellerFinanceCard"]},
 {id:"encomendas",title:"Encomendas",hint:"Orientações para atendimento de produtos encomendados.",nodes:["sellerPreorderCard"]},
 {id:"catalogo",title:"Meu catálogo",hint:"Compartilhe sua página exclusiva com seus clientes.",nodes:["sellerShareCard"]},
 {id:"configuracoes",title:"Preferências de encomenda",hint:"Ative ou desative o recebimento de solicitações pelo seu WhatsApp.",nodes:["sellerPreorderSettingsCard"]},
 {id:"emergencia",title:"Emergência da loja",hint:"Área restrita, exibida somente quando houver autorização.",nodes:["emergencyCard"]}
];
let built=false,active="visao";
export function activateSellerTab(id,{focus=false}={}){
 if(!built)return;
 if(id&&!TABS.some(t=>t.id===id))return;
 active=id||active;
 for(const tab of TABS){
   const button=$('#sellerTab-'+tab.id),panel=$('#sellerPanel-'+tab.id),selected=active===tab.id;
   if(button){button.classList.toggle("is-active",selected);button.setAttribute("aria-selected",String(selected));button.tabIndex=selected?0:-1;if(focus&&selected)button.focus();}
   if(panel)panel.hidden=!selected;
 }
 try{sessionStorage.setItem("azzena-seller-tab",active)}catch{}
}
function createElement(tag,klass,content){
 const el=document.createElement(tag);if(klass)el.className=klass;if(content!=null)el.textContent=content;return el;
}
export function setupSellerWorkspace(){
 if(built)return;
 const app=$("#app"),nav=$(".seller-dashboard-tabs");
 if(!app||!nav)return;
 const finance=$("#sellerFinanceCard"),sales=$("#sellerFinanceSales");
 if(finance&&sales&&!$("#sellerSalesHistoryCard")){
   const salesCard=createElement("div","card");salesCard.id="sellerSalesHistoryCard";
   const eyebrow=createElement("p","eyebrow","MINHAS VENDAS"),title=createElement("h2","","Histórico das minhas vendas");
   salesCard.append(eyebrow,title,sales);finance.insertAdjacentElement("afterend",salesCard);
 }
 const originals=new Map();
 for(const tab of TABS)for(const id of tab.nodes){
   const node=$("#"+id);if(!node)throw new Error("Painel do vendedor incompleto: "+id);
   originals.set(id,node);
 }
 nav.id="sellerDashboardTabs";nav.setAttribute("role","tablist");nav.setAttribute("aria-label","Áreas de trabalho do vendedor");nav.replaceChildren();
 const panels=createElement("div","seller-workspace-panels");panels.id="sellerWorkspacePanels";
 for(const tab of TABS){
   const button=createElement("button","seller-tab-button",tab.title);
   button.id="sellerTab-"+tab.id;button.type="button";button.dataset.sellerTab=tab.id;
   button.setAttribute("role","tab");button.setAttribute("aria-controls","sellerPanel-"+tab.id);
   button.setAttribute("aria-selected","false");button.tabIndex=-1;
   if(tab.id==="visao"){const badge=createElement("span","seller-nav-badge","0");badge.id="sellerNavUnread";badge.hidden=true;button.append(badge)}
   nav.append(button);
   const panel=createElement("section","seller-workspace-panel");
   panel.id="sellerPanel-"+tab.id;panel.dataset.sellerTabPanel=tab.id;panel.setAttribute("role","tabpanel");panel.setAttribute("aria-labelledby",button.id);panel.tabIndex=-1;panel.hidden=true;
   const titleWrap=createElement("header","seller-workspace-title");
   const h=createElement("h2","",tab.title),p=createElement("p","",tab.hint);
   titleWrap.append(h,p);panel.append(titleWrap);
   if(tab.id==="retiradas"){
     const info=createElement("div","seller-workspace-help");
     const action=createElement("button","seller-outline","Abrir locais de entrega");
     action.type="button";action.dataset.sellerGo="locais";info.append(action);panel.append(info);
   }
   for(const id of tab.nodes)panel.append(originals.get(id));
   panels.append(panel);
 }
 nav.insertAdjacentElement("afterend",panels);
 nav.addEventListener("click",e=>{const btn=e.target.closest("[data-seller-tab]");if(btn)activateSellerTab(btn.dataset.sellerTab,{focus:true})});
 nav.addEventListener("keydown",e=>{
   if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;
   e.preventDefault();const idx=TABS.findIndex(t=>t.id===active);
   const next=e.key==="Home"?0:e.key==="End"?TABS.length-1:(idx+(e.key==="ArrowRight"?1:-1)+TABS.length)%TABS.length;
   activateSellerTab(TABS[next].id,{focus:true});
 });
 document.addEventListener("click",e=>{
   const go=e.target.closest("[data-seller-go]");if(!go||!$("#app")?.contains(go))return;
   const to=go.dataset.sellerGo;if(!TABS.some(t=>t.id===to))return;
   e.preventDefault();activateSellerTab(to);
   $("#sellerWorkspacePanels")?.scrollIntoView({behavior:"smooth",block:"start"});
 });
 built=true;
 let saved="visao";try{saved=sessionStorage.getItem("azzena-seller-tab")||"visao"}catch{}
 activateSellerTab(TABS.some(t=>t.id===saved)?saved:"visao");
}
export function updateSellerWorkflow(data){
 if(!built)return;
 const orders=Array.isArray(data.orders)?data.orders:[];
 const paid=orders.filter(o=>o.payment_status==="approved"&&!["cancelled","delivered"].includes(o.fulfillment_status));
 const stock=Array.isArray(data.inventory)?data.inventory.filter(i=>i.is_active&&Number(i.quantity)>0):[];
 const pickupEnabled=data.pickup?.is_enabled===true;
 const configured=data.seller?.allow_preorders===true;
 const tasks=[
  {title:paid.length?paid.length+" pedido(s) pago(s) aguardando atendimento":"Conferir pedidos",detail:paid.length?"Prepare os produtos e depois libere a retirada.":"Acompanhe novos pagamentos e imprima etiquetas.",tab:"pedidos",button:"Abrir pedidos"},
  {title:pickupEnabled?"Ponto de retirada ativo":"Configure seu ponto de retirada",detail:pickupEnabled?"O endereço está habilitado para clientes.":"Cadastre e habilite um endereço autorizado com link do Google Maps.",tab:"locais",button:pickupEnabled?"Ver local":"Cadastrar local"},
  {title:stock.length?stock.length+" produto(s) com saldo":"Sem estoque para venda",detail:stock.length?"Confira saldos e os alertas de reposição.":"Solicite ao ADM o vínculo e o lançamento do estoque físico.",tab:"estoque",button:"Conferir estoque"},
  {title:configured?"Encomendas por WhatsApp ativas":"Habilitar encomendas",detail:configured?"Produtos esgotados podem gerar conversas no seu WhatsApp.":"Ative o contato público caso deseje receber consultas sobre produtos esgotados.",tab:configured?"encomendas":"configuracoes",button:configured?"Ver orientações":"Ativar contato"}
 ];
 const target=$("#sellerWorkflowCards");if(target){
   const cards=tasks.map(item=>{
     const card=createElement("article","seller-workflow-item");
     const title=createElement("h3","",item.title),desc=createElement("p","",item.detail),btn=createElement("button","seller-outline",item.button);
     btn.type="button";btn.dataset.sellerGo=item.tab;card.append(title,desc,btn);return card;
   });target.replaceChildren(...cards);
 }
 const settings=$("#sellerPreorderOptIn");if(settings)settings.checked=configured;
 const phone=$("#sellerPreorderPhone");if(phone)phone.textContent=data.seller?.whatsapp_number||"Não informado";
 const status=$("#sellerPreordersStatus");if(status)status.textContent=configured?
 "Seu WhatsApp está habilitado para receber solicitações. Responda preço e prazo ao cliente; nenhum pagamento é processado pela encomenda.":
 "Encomendas desativadas. Ative o contato em Configurações se quiser receber solicitações.";
}
