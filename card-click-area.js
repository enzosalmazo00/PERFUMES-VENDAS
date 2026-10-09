(()=>{"use strict";
const selectors=".imports-feature,.category-card,.product-card,.catalog-card,.product-tile";
document.addEventListener("click",event=>{
 const card=event.target.closest(selectors);if(!card)return;
 if(event.target.closest("a,button,input,select,textarea,[role=button]")!==card&&event.target.closest("a,button,input,select,textarea,[role=button]"))return;
 if(card.matches("a,button"))return;
 const link=card.querySelector("a[href]");if(link){link.click();return;}
 const button=card.querySelector("button[data-product-id],button[data-open-product],button[data-action='details']");if(button)button.click();
});
document.addEventListener("keydown",event=>{
 if(!["Enter"," "].includes(event.key))return;
 const card=event.target.closest(selectors);if(!card||card.matches("a,button"))return;
 const link=card.querySelector("a[href]");if(link){event.preventDefault();link.click();}
});
})();