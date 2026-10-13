// Navegação da área do cliente — script externo autorizado pela política de segurança.
(()=>{
const root=document.querySelector("#accountView");if(!root)return;
const menu=root.querySelector(".account-menu-grid"),top=root.querySelector("#accountPanelTop"),back=root.querySelector("#accountPanelBack"),title=root.querySelector("#accountPanelTitle");
const sections=[...root.querySelectorAll("[data-account-section]")];
function show(panel){
 menu.hidden=Boolean(panel);top.hidden=!panel;
 sections.forEach(el=>{el.hidden=el.dataset.accountSection!==panel});
 if(panel){
  const button=menu.querySelector('[data-account-panel="'+panel+'"]');
  title.textContent=button?.querySelector("strong")?.textContent||"";
  if(panel==="tracking")syncTracking();
 }
 window.scrollTo({top:0,behavior:"smooth"});
}
function syncTracking(){
 const source=document.querySelector("#orderList"),target=document.querySelector("#trackingOrderList");
 if(source&&target)target.innerHTML=source.innerHTML;
}
menu.addEventListener("click",event=>{const button=event.target.closest("[data-account-panel]");if(button)show(button.dataset.accountPanel)});
back.addEventListener("click",()=>show(null));
const source=document.querySelector("#orderList");
if(source)new MutationObserver(()=>{if(!top.hidden&&title.textContent==="Acompanhar pedidos")syncTracking()}).observe(source,{childList:true});
document.querySelector("#trackingOrderList")?.addEventListener("click",event=>{
 const button=event.target.closest("[data-copy-pickup-code]");
 if(button){const code=button.dataset.copyPickupCode;navigator.clipboard?.writeText(code).then(()=>{button.textContent="CÓDIGO COPIADO"}).catch(()=>{});}
});
})();