if(location.hash&&new URLSearchParams(location.hash.slice(1)).get("type")==="recovery"){location.replace("conta.html"+location.hash);}
const SUPABASE_URL="https://fbwlprwhczxjdsciotsi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_XkqHZE_hdTNrNXE0O9tvRA_rWdw5pPE";
const SPRITE_INDEX={"velora-noir":0,"solaris-elixir":1,"fleur-dambre":2,"nero-absolu":3,"eclat-rose":4,"vertige":5};
const sellerScopeId=/^[0-9a-f-]{36}$/i.test(new URLSearchParams(location.search).get("vendedor")||"")?new URLSearchParams(location.search).get("vendedor"):null;
const state={products:[],reviews:[],sellers:[],sellerScope:null,selectedSellerId:sellerScopeId,filter:"todos",search:"",brand:"",price:"",concentration:"",sort:"az",bag:loadBag(),selectedProduct:null,preorderSellers:[],payment:"pix",catalogLimit:24};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const els={productGrid:$("#productGrid"),catalogStatus:$("#catalogStatus"),catalogSearch:$("#catalogSearch"),topSearch:$("#topSearch"),brandFilter:$("#brandFilter"),priceFilter:$("#priceFilter"),concentrationFilter:$("#concentrationFilter"),sortFilter:$("#sortFilter"),clearCatalogFilters:$("#clearCatalogFilters"),productOverlay:$("#productOverlay"),productModalContent:$("#productModalContent"),bagBtn:$("#bagBtn"),bagCount:$("#bagCount"),bagDrawer:$("#bagDrawer"),closeBag:$("#closeBag"),drawerMask:$("#drawerMask"),bagItems:$("#bagItems"),bagTotal:$("#bagTotal"),checkoutBtn:$("#checkoutBtn"),checkoutOverlay:$("#checkoutOverlay"),checkoutSummary:$("#checkoutSummary"),checkoutForm:$("#checkoutForm"),paymentDemoBox:$("#paymentDemoBox"),sellerPicker:$("#sellerPicker"),toast:$("#toast"),siteUnavailable:$("#siteUnavailable"),siteUnavailableTitle:$("#siteUnavailableTitle"),siteUnavailableMessage:$("#siteUnavailableMessage")};
function esc(v=""){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function brl(c){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(c||0)/100)}
function spriteClass(p){return "sprite-"+(SPRITE_INDEX[p?.slug]??3)}
function productArt(p,klass,priority=false){
 const url=String(p?.image_url||"");
 if(/^https:\/\//i.test(url))return '<img class="'+klass+' product-real-photo" src="'+esc(url)+'" alt="'+esc(p.name)+'" loading="'+(priority?"eager":"lazy")+'" decoding="async" fetchpriority="'+(priority?"high":"low")+'"'+(priority?'':' sizes="(max-width: 600px) 45vw, (max-width: 1000px) 30vw, 17vw"')+'>';
 return '<div class="'+klass+' '+spriteClass(p)+'"></div>';
}
function loadBag(){try{const raw=JSON.parse(localStorage.getItem("perfumes-demo-bag")||"[]");return Array.isArray(raw)?raw.filter(i=>i&&/^[0-9a-f-]{36}$/i.test(String(i.id||""))&&Number.isSafeInteger(Number(i.quantity))&&Number(i.quantity)>0).slice(0,30).map(i=>({id:String(i.id),name:String(i.name||"Produto"),slug:String(i.slug||""),volume_ml:Math.max(1,Number(i.volume_ml)||1),unit_price_cents:Math.max(0,Math.trunc(Number(i.unit_price_cents)||0)),quantity:Math.min(100,Number(i.quantity))})):[]}catch{return[]}}
function saveBag(){localStorage.setItem("perfumes-demo-bag",JSON.stringify(state.bag))}
function syncBagWithCatalog(){
  const byId=new Map(state.products.map(p=>[p.id,p]));let changed=false;
  const valid=[];
  for(const row of state.bag){
    const p=byId.get(row.id),available=Number(p?.available_stock||0);
    if(!p||available<1){changed=true;continue;}
    const quantity=Math.min(Math.max(1,Number(row.quantity)||1),available);
    const price=Number(p.sale_price_cents??p.price_cents);
    if(quantity!==row.quantity||price!==row.unit_price_cents){changed=true;}
    valid.push({id:p.id,name:p.name,slug:p.slug,volume_ml:p.volume_ml,unit_price_cents:price,quantity});
  }
  state.bag=valid;
  if(changed){saveBag();toast("Sacola atualizada conforme os preços e estoques disponíveis.");}
}
async function availableStockBySeller(){
 const sellers=await supabaseGet("seller_checkout_options","select=seller_id&is_active=eq.true");
 const responses=await Promise.allSettled((sellers||[]).map(async seller=>{
   const response=await fetch(SUPABASE_URL+"/rest/v1/rpc/public_seller_catalog",{
     method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json",Accept:"application/json"},
     body:JSON.stringify({p_seller_id:seller.seller_id})
   });
   if(!response.ok)throw new Error("SELLER_STOCK_LOOKUP_FAILED");
   const catalog=await response.json();
   return catalog?.pickup && Array.isArray(catalog.products)?catalog.products:[];
 }));
 if(responses.some(r=>r.status==="rejected"))throw new Error("STOCK_CHECK_UNAVAILABLE");
 const available=new Map();
 for(const result of responses)for(const item of result.value){
   available.set(item.id,(available.get(item.id)||0)+Math.max(0,Number(item.stock)||0));
 }
 return available;
}
function toast(m){els.toast.textContent=m;els.toast.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>els.toast.classList.remove("show"),3500)}
function preorderContacts(){return sellerScopeId?state.preorderSellers.filter(s=>s.seller_id===sellerScopeId):state.preorderSellers;}
function preorderLink(seller,product){
 const phone=String(seller.whatsapp||"").replace(/[^0-9]/g,"");
 if(!/^\d{10,15}$/.test(phone))return null;
 const cep=String(localStorage.getItem("azzena-preorder-cep")||"").replace(/\D/g,"");
 const fullName=[product.brand,product.name].filter(Boolean).join(" · ");
 const message="Olá! Tenho interesse em encomendar pela AZZENA IMPORTS.\n\nPerfume: "+fullName+"\nVolume: "+product.volume_ml+" mL\nQuantidade: 1 unidade\nCEP para estimativa de entrega: "+(cep||"não informado")+"\n\nGostaria de confirmar disponibilidade, valor final e previsão de envio.";
 return "https://wa.me/"+phone+"?text="+encodeURIComponent(message);
}
async function loadPreorderContacts(){
 try{
   const response=await fetch(SUPABASE_URL+"/rest/v1/rpc/public_preorder_sellers",{
     method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json",Accept:"application/json"},
     body:"{}"
   });
   if(!response.ok)throw new Error("PREORDER_CONTACTS_UNAVAILABLE");
   const rows=await response.json();
   state.preorderSellers=Array.isArray(rows)?rows.filter(s=>
     /^[0-9a-f-]{36}$/i.test(String(s?.seller_id||"")) &&
     /^\d{10,15}$/.test(String(s?.whatsapp||"")) &&
     String(s?.display_name||"").trim().length>0
   ).slice(0,50):[];
 }catch(error){state.preorderSellers=[];console.error("Não foi possível carregar contatos de encomenda",error)}
 if(state.products.length)renderProducts();
}
function closePreorder(){const modal=$("#preorderOverlay");if(modal)modal.hidden=true;syncScrollLock()}
function requestPreorder(product){
 const contacts=preorderContacts();
 if(!contacts.length){toast("Nenhum vendedor disponível para encomendas no momento.");return}
 if(contacts.length===1){
   const href=preorderLink(contacts[0],product);
   if(!href){toast("WhatsApp do vendedor indisponível.");return}
   window.open(href,"_blank","noopener,noreferrer");
   return;
 }
 $("#preorderProductName").textContent=product.name+" · "+product.volume_ml+" mL";
 $("#preorderSellerList").replaceChildren();
 for(const seller of contacts){
   const href=preorderLink(seller,product);if(!href)continue;
   const link=document.createElement("a");
   link.className="preorder-seller-link";link.href=href;link.target="_blank";link.rel="noopener noreferrer";
   link.textContent="Conversar com "+seller.display_name+" no WhatsApp ↗";
   $("#preorderSellerList").append(link);
 }
 $("#preorderOverlay").hidden=false;syncScrollLock();
}
async function supabaseGet(table,query=""){const r=await fetch(SUPABASE_URL+"/rest/v1/"+table+"?"+query,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Accept:"application/json"}});if(!r.ok)throw new Error(await r.text());return r.json()}
function refreshCatalogExtras(){
 Promise.allSettled([availableStockBySeller(),supabaseGet("reviews","select=id,product_id,customer_name,rating,comment,is_verified_purchase,is_approved,created_at&is_approved=eq.true&order=created_at.asc")]).then(([stock,reviews])=>{
   if(stock.status==="fulfilled")state.products=state.products.map(p=>({...p,available_stock:Math.max(0,Number(stock.value.get(p.id))||0)}));
   if(reviews.status==="fulfilled")state.reviews=reviews.value;
   syncBagWithCatalog();renderProducts();renderBag();
 }).catch(console.error);
}
async function loadSiteStatus(){try{const rows=await supabaseGet("site_status","select=is_online,outage_kind,public_message&id=eq.true&limit=1"),s=rows[0];if(!s||s.is_online){els.siteUnavailable.hidden=true;return}els.siteUnavailableTitle.textContent=s.outage_kind==="permanent_closure"?"Loja encerrada":"Site temporariamente indisponível";els.siteUnavailableMessage.textContent=s.public_message||"Estamos realizando um ajuste operacional. Voltamos em breve.";els.siteUnavailable.hidden=false}catch(e){console.error(e)}}
async function loadSellers(){
 try{
   const options=await supabaseGet("seller_checkout_options","select=seller_id,display_name,avatar_url&is_active=eq.true&order=display_name.asc");
   const verified=await Promise.allSettled(options.map(async seller=>{
     const response=await fetch(SUPABASE_URL+"/rest/v1/rpc/public_seller_catalog",{
       method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json",Accept:"application/json"},
       body:JSON.stringify({p_seller_id:seller.seller_id})
     });
     if(!response.ok)throw new Error("SELLER_PICKUP_LOOKUP_FAILED");
     const catalog=await response.json();
     return catalog?.pickup&&Array.isArray(catalog?.products)&&catalog.products.length>0?seller:null;
   }));
   state.sellers=verified.filter(r=>r.status==="fulfilled"&&r.value).map(r=>r.value);
   if(!state.sellers.some(s=>s.seller_id===state.selectedSellerId))state.selectedSellerId=state.sellers[0]?.seller_id||null;
   renderSellerPicker();
 }catch(e){console.error(e);els.sellerPicker.innerHTML="<p>Retirada indisponível no momento.</p>"}
}
function renderSellerPicker(){if(!state.sellers.length){els.sellerPicker.innerHTML="<p>Retirada indisponível: ainda não há vendedores com ponto de retirada e estoque confirmados.</p>";return}const shown=sellerScopeId?state.sellers.filter(s=>s.seller_id===sellerScopeId):state.sellers;els.sellerPicker.innerHTML=shown.map(s=>'<button class="seller-card '+(state.selectedSellerId===s.seller_id?"is-active":"")+'" type="button" data-seller-id="'+esc(s.seller_id)+'"><strong>'+esc(s.display_name)+'</strong></button>').join("");$$("[data-seller-id]",els.sellerPicker).forEach(b=>b.onclick=()=>{state.selectedSellerId=b.dataset.sellerId;renderSellerPicker();document.dispatchEvent(new CustomEvent("azzena:seller-changed",{detail:{sellerId:state.selectedSellerId}}))})}
async function loadCatalog(){
 els.catalogStatus.textContent="Carregando catálogo...";
 try{
   if(sellerScopeId){
     const [response,base]=await Promise.all([
       fetch(SUPABASE_URL+"/rest/v1/rpc/public_seller_catalog",{method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({p_seller_id:sellerScopeId})}),
       supabaseGet("products","select=id,slug,name,brand,product_type,category,volume_ml,sale_price_cents,price_cents,image_url,short_description,description,top_notes,heart_notes,base_notes,composition,is_best_seller,is_featured,created_at&is_active=eq.true&order=is_best_seller.desc,is_featured.desc,created_at.asc")
     ]);
     if(!response.ok)throw new Error("SELLER_CATALOG_UNAVAILABLE");
     const catalog=await response.json();state.sellerScope=catalog||null;
     const sellerStock=new Map((catalog?.pickup&&Array.isArray(catalog.products)?catalog.products:[]).map(p=>[p.id,Math.max(0,Number(p.stock)||0)]));
     state.products=catalog?.seller?base.map(p=>({...p,available_stock:sellerStock.get(p.id)||0})):[];
     const banner=$("#sellerCatalogBanner");if(banner){banner.hidden=false;$("#sellerCatalogTitle").textContent=catalog?.seller?"Catálogo de "+catalog.seller.name:"Catálogo indisponível";$("#sellerCatalogDescription").textContent=catalog?.seller?"Produtos disponíveis para retirada ou, quando esgotados, sob consulta por encomenda com este vendedor.":"Este vendedor não está disponível no momento.";}
     const title=$(".catalog-title h2");if(title)title.textContent="Produtos disponíveis";
     supabaseGet("reviews","select=id,product_id,customer_name,rating,comment,is_verified_purchase,is_approved,created_at&is_approved=eq.true&order=created_at.asc").then(rows=>{state.reviews=rows;renderProducts()}).catch(console.error);
   }else{
     const base=await supabaseGet("products","select=id,slug,name,brand,product_type,category,volume_ml,sale_price_cents,price_cents,image_url,short_description,description,top_notes,heart_notes,base_notes,composition,is_best_seller,is_featured,created_at&is_active=eq.true&order=is_best_seller.desc,is_featured.desc,created_at.asc");
     state.products=base.map(p=>({...p,available_stock:0}));
     refreshCatalogExtras();
   }
   populateBrandFilter();renderProducts();renderBag();
 }catch(e){console.error(e);els.catalogStatus.textContent="Não foi possível carregar o catálogo agora."}
}
function concentrationOf(p){const t=(" "+[p.name,p.short_description,p.description].filter(Boolean).join(" ")+" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");if(/\b(extrait|extract|pure parfum|parfum)\b/.test(t))return"parfum";if(/\b(eau de parfum|edp)\b/.test(t))return"edp";if(/\b(eau de toilette|edt)\b/.test(t))return"edt";if(/\b(eau de cologne|edc|cologne)\b/.test(t))return"edc";return"other"}
function populateBrandFilter(){if(!els.brandFilter)return;const selected=state.brand,brands=[...new Set(state.products.map(p=>String(p.brand||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR",{sensitivity:"base"}));els.brandFilter.innerHTML='<option value="">Todas as marcas</option>'+brands.map(b=>'<option value="'+esc(b)+'">'+esc(b)+'</option>').join("");els.brandFilter.value=brands.includes(selected)?selected:"";if(!brands.includes(selected))state.brand=""}
function normalizeCatalogText(value){return String(value??"").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[_-]+/g," ").trim()}
function productMatchesFilter(p,filter){if(filter==="todos")return true;if(filter==="body_splash")return normalizeCatalogText(p.product_type)==="body splash"||normalizeCatalogText(p.category)==="body splash";if(normalizeCatalogText(p.product_type)==="body splash")return false;const category=normalizeCatalogText(p.category),name=normalizeCatalogText([p.name,p.brand,p.short_description].filter(Boolean).join(" "));const masculine=["masculino","masculina","male","men","homem","homens"],feminine=["feminino","feminina","female","women","mulher","mulheres"],unisex=["unissex","unisexo","unisex"];if(filter==="masculino")return masculine.includes(category)||unisex.includes(category)||masculine.some(x=>name.includes(x));if(filter==="feminino")return feminine.includes(category)||unisex.includes(category)||feminine.some(x=>name.includes(x));if(filter==="unissex")return unisex.includes(category);return category===normalizeCatalogText(filter)}
function filteredProducts(){let rows=state.products.filter(p=>productMatchesFilter(p,state.filter));const q=normalizeCatalogText(state.search);if(q)rows=rows.filter(p=>normalizeCatalogText([p.name,p.brand,p.product_type==="body_splash"?"body splash":p.product_type,p.category,p.volume_ml].join(" ")).includes(q));if(state.brand)rows=rows.filter(p=>p.brand===state.brand);if(state.price)rows=rows.filter(p=>{const price=Number(p.sale_price_cents??p.price_cents)/100;if(state.price==="0-200")return price<=200;if(state.price==="200-400")return price>200&&price<=400;if(state.price==="400-700")return price>400&&price<=700;if(state.price==="700+")return price>700;return true});if(state.concentration)rows=rows.filter(p=>concentrationOf(p)===state.concentration);const alpha=(a,b)=>String(a.name||"").localeCompare(String(b.name||""),"pt-BR",{sensitivity:"base",numeric:true});if(state.sort==="za")rows.sort((a,b)=>-alpha(a,b));else if(state.sort==="price_asc")rows.sort((a,b)=>Number(a.sale_price_cents??a.price_cents)-Number(b.sale_price_cents??b.price_cents)||alpha(a,b));else if(state.sort==="price_desc")rows.sort((a,b)=>Number(b.sale_price_cents??b.price_cents)-Number(a.sale_price_cents??a.price_cents)||alpha(a,b));else rows.sort(alpha);return rows}
function reviewSummary(id){const r=state.reviews.filter(x=>x.product_id===id);if(!r.length)return{stars:"☆☆☆☆☆",text:""};const avg=r.reduce((a,b)=>a+Number(b.rating||0),0)/r.length;const rounded=Math.max(0,Math.min(5,Math.round(avg)));return{stars:"★".repeat(rounded)+"☆".repeat(5-rounded),text:avg.toFixed(1).replace(".",",")+" / 5 · "+r.length+" "+(r.length===1?"avaliação":"avaliações")}}
function renderProducts(){
 document.querySelector(".catalog-load-more")?.remove();
 const allRows=filteredProducts(),rows=allRows.slice(0,state.catalogLimit),contacts=preorderContacts();
 els.catalogStatus.textContent=allRows.length?allRows.length+" produto(s) no catálogo · exibindo "+rows.length+" agora":"Nenhum produto encontrado.";
 els.productGrid.innerHTML=rows.map((p,index)=>{
   const price=p.sale_price_cents??p.price_cents,r=reviewSummary(p.id),soldOut=Number(p.available_stock||0)<1;
   const preorder=soldOut?(contacts.length?
     '<button class="preorder-cta" type="button" data-preorder="'+esc(p.id)+'">Solicitar por encomenda ↗</button>':
     '<p class="preorder-unavailable">Encomendas temporariamente indisponíveis</p>'):"";
   return '<article class="product-card" data-product-id="'+esc(p.id)+'"><div class="product-media"><span class="product-heart">♡</span>'+
     (soldOut?'<span class="stock-badge">ESGOTADO</span>':'')+productArt(p,"product-art",index<4)+
     '</div><div class="product-body"><h3>'+esc(p.name).toUpperCase()+'</h3><div class="product-brand">'+
     esc(p.brand||(p.product_type==="body_splash"?"Body Splash":"AZZENA IMPORTS"))+(["perfume","body_splash"].includes(p.product_type)?" · "+esc(p.volume_ml)+" ml":"")+'</div><div class="product-rating">'+r.stars+' <small>'+r.text+'</small></div><strong class="product-price">'+
     brl(price)+'</strong><button class="buy-card" type="button" data-buy="'+esc(p.id)+'"'+
     (soldOut?' disabled aria-disabled="true"':'')+'>'+(soldOut?'ESGOTADO':'▱ &nbsp; COMPRAR')+
     '</button>'+preorder+'</div></article>';
 }).join("");
 if(rows.length<allRows.length){const more=document.createElement("button");more.type="button";more.className="gold-button catalog-load-more";more.textContent="CARREGAR MAIS PRODUTOS";more.onclick=()=>{state.catalogLimit+=24;renderProducts()};els.productGrid.after(more)}else document.querySelector(".catalog-load-more")?.remove();
 $$(".product-card",els.productGrid).forEach(card=>card.onclick=e=>{
   if(e.target.closest("[data-buy],[data-preorder]"))return;
   openProduct(card.dataset.productId);
 });
 $$("[data-buy]",els.productGrid).forEach(b=>b.onclick=e=>{
   e.stopPropagation();const p=state.products.find(x=>x.id===b.dataset.buy);if(p)addToBag(p);
 });
 $$("[data-preorder]",els.productGrid).forEach(b=>b.onclick=e=>{
   e.stopPropagation();const p=state.products.find(x=>x.id===b.dataset.preorder);if(p)requestPreorder(p);
 });
}
function setFilter(f){state.search="";if(els.catalogSearch)els.catalogSearch.value="";if(els.topSearch)els.topSearch.value="";state.brand="";state.concentration="";state.price="";if(els.brandFilter)els.brandFilter.value="";if(els.concentrationFilter)els.concentrationFilter.value="";if(els.priceFilter)els.priceFilter.value="";state.filter=["todos","masculino","feminino","unissex","body_splash"].includes(f)?f:"todos";state.catalogLimit=24;$$(".filter").forEach(b=>b.classList.toggle("is-active",b.dataset.filter===state.filter));renderProducts()}
function bindCatalogRefiners(){if(els.brandFilter)els.brandFilter.onchange=e=>{state.catalogLimit=24;state.brand=e.target.value;renderProducts()};if(els.priceFilter)els.priceFilter.onchange=e=>{state.catalogLimit=24;state.price=e.target.value;renderProducts()};if(els.concentrationFilter)els.concentrationFilter.onchange=e=>{state.catalogLimit=24;state.concentration=e.target.value;renderProducts()};if(els.sortFilter)els.sortFilter.onchange=e=>{state.catalogLimit=24;state.sort=e.target.value;renderProducts()};if(els.clearCatalogFilters)els.clearCatalogFilters.onclick=()=>{state.brand="";state.price="";state.concentration="";state.sort="az";els.brandFilter.value="";els.priceFilter.value="";els.concentrationFilter.value="";els.sortFilter.value="az";renderProducts()}}
function openProduct(id){const p=state.products.find(x=>x.id===id);if(!p)return;const reviews=state.reviews.filter(r=>r.product_id===id),price=p.sale_price_cents??p.price_cents;els.productModalContent.innerHTML='<div class="product-detail"><div class="detail-media">'+productArt(p,"detail-art") +'</div><div class="detail-copy"><p class="eyebrow">'+esc(p.product_type==="body_splash"?"BODY SPLASH":(p.brand||"PERFUME IMPORTADO"))+' · '+esc(p.category)+'</p><h2>'+esc(p.name)+'</h2><p class="detail-price">'+brl(price)+(["perfume","body_splash"].includes(p.product_type)?' · '+esc(p.volume_ml)+' mL':' · unidade')+'</p><p class="detail-desc">'+esc(p.description||p.short_description||"Fragrância selecionada para uma experiência marcante e sofisticada.")+'</p><p class="detail-stock">'+(Number(p.available_stock)>0?esc(p.available_stock)+" unidade(s) disponíveis para retirada":"Esgotado para retirada")+'</p><div class="notes"><div class="note"><strong>Notas de topo</strong><span>'+esc((p.top_notes||[]).join(" · ")||"—")+'</span></div><div class="note"><strong>Notas de coração</strong><span>'+esc((p.heart_notes||[]).join(" · ")||"—")+'</span></div><div class="note"><strong>Notas de fundo</strong><span>'+esc((p.base_notes||[]).join(" · ")||"—")+'</span></div></div><div class="composition"><strong>Composição</strong><p>'+esc(p.composition||"Informação técnica disponível no atendimento.")+'</p></div><div class="review-block"><strong>Avaliações</strong>'+(reviews.length?reviews.map(r=>'<div class="review"><div class="review-head"><b>'+esc(r.customer_name)+'</b>'+(r.is_verified_purchase?'<small class="verified-purchase">COMPRA VERIFICADA</small>':'')+'<span class="stars">'+"★".repeat(Number(r.rating))+"☆".repeat(5-Number(r.rating))+'</span></div><p>'+esc(r.comment)+'</p></div>').join(""):'<p class="detail-desc">Ainda não há avaliações para esta fragrância.</p>')+'</div><div class="detail-actions"><button class="buy-card" id="addSelectedToBag"'+(Number(p.available_stock)>0?'':' disabled')+'>ADICIONAR À SACOLA</button><button class="buy-card secondary" id="buySelectedNow"'+(Number(p.available_stock)>0?'':' disabled')+'>COMPRAR AGORA</button>'+(Number(p.available_stock)<1?(preorderContacts().length?'<button type="button" id="requestPreorderBtn" class="preorder-cta">Solicitar por encomenda ↗</button>':'<p class="preorder-unavailable">Encomendas temporariamente indisponíveis</p>'):'')+'</div><p class="preorder-info"'+(Number(p.available_stock)>0?' hidden':'')+'>Encomenda sujeita à confirmação de disponibilidade, valor e prazo pelo vendedor. Nenhuma cobrança é realizada por esta solicitação.</p></div></div>';els.productOverlay.hidden=false;syncScrollLock();$("#addSelectedToBag").onclick=()=>{if(addToBag(p))closeProduct()};$("#buySelectedNow").onclick=()=>{if(addToBag(p)){closeProduct();openBag()}};if($("#requestPreorderBtn"))$("#requestPreorderBtn").onclick=()=>requestPreorder(p)}
function closeProduct(){els.productOverlay.hidden=true;syncScrollLock()}
function addToBag(p){const max=Math.max(0,Number(p.available_stock)||0),e=state.bag.find(i=>i.id===p.id);if(max<1||(e?.quantity||0)>=max){toast(max<1?"Produto esgotado para retirada.":"Quantidade disponível já está na sacola.");return false}if(e)e.quantity++;else state.bag.push({id:p.id,name:p.name,slug:p.slug,volume_ml:p.volume_ml,unit_price_cents:p.sale_price_cents??p.price_cents,quantity:1});saveBag();renderBag();toast(p.name+" adicionado à sacola");return true}
function removeFromBag(id){state.bag=state.bag.filter(i=>i.id!==id);saveBag();renderBag()}
function total(){return state.bag.reduce((s,i)=>s+Number(i.unit_price_cents)*Number(i.quantity),0)}
function renderBag(){const qty=state.bag.reduce((s,i)=>s+i.quantity,0);els.bagCount.textContent=qty;els.bagTotal.textContent=brl(total());if(!state.bag.length){els.bagItems.innerHTML='<div class="empty-bag-state"><span class="empty-bag-icon-wrap"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7.3 11.2h17.4l-1.45 15H8.75l-1.45-15Z"/><path d="M11.4 12V9.3A4.6 4.6 0 0 1 16 4.7a4.6 4.6 0 0 1 4.6 4.6V12"/><path d="M8.1 13.2h15.8"/><path d="M16 16.2l2.1 2.5-2.1 2.5-2.1-2.5 2.1-2.5Z"/></svg></span><strong>Sua sacola está vazia</strong><span>Escolha suas fragrâncias favoritas e elas aparecerão aqui.</span></div>';els.checkoutBtn.disabled=true;return}els.checkoutBtn.disabled=false;els.bagItems.innerHTML=state.bag.map(i=>'<div class="bag-item"><div class="bag-art '+spriteClass(i)+'"></div><div><h4>'+esc(i.name)+'</h4><p> · qtd. '+i.quantity+' · +brl(i.unit_price_cents*i.quantity)+'</p></div><button data-remove="'+esc(i.id)+'">×</button></div>').join("");$$("[data-remove]",els.bagItems).forEach(b=>b.onclick=()=>removeFromBag(b.dataset.remove))}
function openBag(){els.bagDrawer.classList.add("is-open");els.drawerMask.hidden=false;syncScrollLock()}
function closeBag(){els.bagDrawer.classList.remove("is-open");els.drawerMask.hidden=true;syncScrollLock()}
function openCheckout(){if(!state.bag.length)return toast("Sua sacola está vazia.");if(state.bag.some(row=>{const p=state.products.find(item=>item.id===row.id);return !p||Number(p.available_stock)<Number(row.quantity)}))return toast("Um produto ficou indisponível. Atualize o catálogo antes de continuar.");closeBag();els.checkoutSummary.innerHTML=state.bag.map(i=>'<div>'+i.quantity+'× '+esc(i.name)+' — '+brl(i.unit_price_cents*i.quantity)+'</div>').join("")+'<strong>Total: '+brl(total())+'</strong>';renderSellerPicker();els.checkoutOverlay.hidden=false;syncScrollLock()}
function closeCheckout(){els.checkoutOverlay.hidden=true;syncScrollLock()}
function syncScrollLock(){document.body.style.overflow=(!els.productOverlay.hidden||!els.checkoutOverlay.hidden||!$("#preorderOverlay").hidden||els.bagDrawer.classList.contains("is-open"))?"hidden":""}
function setPayment(m){
 const pix=m==="pix";state.payment=pix?"pix":"card";
 $$(".payment-tab").forEach(b=>{const active=b.dataset.payment===state.payment;b.classList.toggle("is-active",active);b.setAttribute("aria-pressed",String(active))});
 const disclosure=$("#paymentMethodDisclosure");
 if(disclosure)disclosure.textContent=pix?"PIX: o QR Code e o Pix Copia e Cola serão exibidos aqui na AZZENA; a confirmação do pagamento é feita automaticamente pelo Mercado Pago.":"Cartão de crédito: podem existir juros ou encargos que variam com o número de parcelas e as condições do Mercado Pago. Confira valor de cada parcela e total antes de confirmar.";
 els.paymentDemoBox.innerHTML=pix?"<strong>PIX via Mercado Pago</strong><p>O QR Code e o Pix Copia e Cola serão exibidos dentro da AZZENA. A confirmação do pagamento acontece automaticamente. Não envie PIX pessoal ao vendedor.</p>":"<strong>Cartão de crédito via Mercado Pago</strong><p>Escolha o parcelamento no ambiente do Mercado Pago e confira eventuais encargos e o total antes de pagar.</p>";
}
function syncSearch(v){state.search=v;els.catalogSearch.value=v;els.topSearch.value=v;renderProducts();$("#catalogo").scrollIntoView({behavior:"smooth"})}
els.catalogSearch.oninput=e=>{state.search=e.target.value;els.topSearch.value=state.search;renderProducts()};els.topSearch.oninput=e=>syncSearch(e.target.value);
document.addEventListener("click",e=>{const category=e.target.closest("[data-jump-category]");if(category){e.preventDefault();setFilter("todos");state.search=({fones:"fone",carregadores:"carregador",caixas:"caixa de som"})[category.dataset.jumpCategory]||"";els.catalogSearch.value=state.search;els.topSearch.value=state.search;renderProducts();$("#catalogo")?.scrollIntoView({behavior:"smooth",block:"start"});return}const jump=e.target.closest("[data-jump-filter]");if(jump){e.preventDefault();setFilter(jump.dataset.jumpFilter);const catalog=$("#catalogo");if(catalog)catalog.scrollIntoView({behavior:"smooth",block:"start"});return}const filter=e.target.closest("[data-filter]");if(filter){e.preventDefault();setFilter(filter.dataset.filter)}});
$("[data-close-product]").onclick=closeProduct;els.productOverlay.onclick=e=>{if(e.target===els.productOverlay)closeProduct()};els.bagBtn.onclick=openBag;els.closeBag.onclick=closeBag;els.drawerMask.onclick=closeBag;els.checkoutBtn.onclick=openCheckout;$("[data-close-checkout]").onclick=closeCheckout;els.checkoutOverlay.onclick=e=>{if(e.target===els.checkoutOverlay)closeCheckout()};$$(".payment-tab").forEach(b=>b.onclick=()=>setPayment(b.dataset.payment));
// O envio do pedido é controlado exclusivamente por customer-checkout.js, que valida sessão, estoque e gateway no backend.

$("#closePreorder").onclick=closePreorder;
$("#preorderOverlay").onclick=e=>{if(e.target===$("#preorderOverlay"))closePreorder()};
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if(!$("#preorderOverlay").hidden)closePreorder();else if(!els.checkoutOverlay.hidden)closeCheckout();else if(!els.productOverlay.hidden)closeProduct();else if(els.bagDrawer.classList.contains("is-open"))closeBag()});

function initHeroCarousel(){
  const hero=document.getElementById("inicio");
  if(!hero)return;

  const slides=Array.from(hero.querySelectorAll("[data-hero-slide]"));
  const dots=Array.from(hero.querySelectorAll("[data-hero-dot]"));
  if(slides.length<2||slides.length!==dots.length)return;

  let current=0;
  let timer=null;
  let touchStartX=null;

  function render(index){
    current=(index+slides.length)%slides.length;
    slides.forEach((slide,i)=>{
      slide.classList.toggle("is-active",i===current);
      slide.setAttribute("aria-hidden",i===current?"false":"true");
    });
    dots.forEach((dot,i)=>{
      const active=i===current;
      dot.classList.toggle("is-active",active);
      dot.setAttribute("aria-selected",active?"true":"false");
      dot.tabIndex=active?0:-1;
    });
  }

  function stop(){
    if(timer!==null){
      window.clearInterval(timer);
      timer=null;
    }
  }

  function start(){
    stop();
    if(document.hidden)return;
    timer=window.setInterval(()=>render(current+1),5000);
  }

  function select(index){
    render(index);
    start();
  }

  dots.forEach((dot,i)=>{
    dot.addEventListener("click",e=>{
      e.preventDefault();
      select(i);
    });
  });

  hero.addEventListener("touchstart",e=>{
    touchStartX=e.changedTouches?.[0]?.clientX??null;
  },{passive:true});

  hero.addEventListener("touchend",e=>{
    if(touchStartX===null)return;
    const endX=e.changedTouches?.[0]?.clientX;
    if(typeof endX!=="number"){touchStartX=null;return;}
    const delta=endX-touchStartX;
    touchStartX=null;
    if(Math.abs(delta)<40)return;
    select(current+(delta<0?1:-1));
  },{passive:true});

  document.addEventListener("visibilitychange",()=>{
    if(document.hidden)stop();
    else start();
  });

  render(0);
  start();
}

const initialCategory=new URLSearchParams(location.search).get("categoria");if(["masculino","feminino","unissex","body_splash"].includes(initialCategory))state.filter=initialCategory;
bindCatalogRefiners();loadSiteStatus();loadCatalog().then(()=>{const id=new URLSearchParams(location.search).get("produto");if(id&&state.products.some(p=>String(p.id)===id)){state.filter="todos";state.search="";state.catalogLimit=state.products.length;renderProducts();openProduct(id)}});loadSellers();loadPreorderContacts();

// Refresh approved customer reviews when returning to the storefront.
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")loadCatalog()});
