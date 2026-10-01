const SUPABASE_URL="https://fbwlprwhczxjdsciotsi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_XkqHZE_hdTNrNXE0O9tvRA_rWdw5pPE";
const SPRITE_INDEX={"velora-noir":0,"solaris-elixir":1,"fleur-dambre":2,"nero-absolu":3,"eclat-rose":4,"vertige":5};
const state={products:[],reviews:[],sellers:[],selectedSellerId:null,filter:"todos",search:"",bag:loadBag(),selectedProduct:null,payment:"pix"};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const els={productGrid:$("#productGrid"),catalogStatus:$("#catalogStatus"),catalogSearch:$("#catalogSearch"),topSearch:$("#topSearch"),productOverlay:$("#productOverlay"),productModalContent:$("#productModalContent"),bagBtn:$("#bagBtn"),bagCount:$("#bagCount"),bagDrawer:$("#bagDrawer"),closeBag:$("#closeBag"),drawerMask:$("#drawerMask"),bagItems:$("#bagItems"),bagTotal:$("#bagTotal"),checkoutBtn:$("#checkoutBtn"),checkoutOverlay:$("#checkoutOverlay"),checkoutSummary:$("#checkoutSummary"),checkoutForm:$("#checkoutForm"),paymentDemoBox:$("#paymentDemoBox"),sellerPicker:$("#sellerPicker"),toast:$("#toast"),siteUnavailable:$("#siteUnavailable"),siteUnavailableTitle:$("#siteUnavailableTitle"),siteUnavailableMessage:$("#siteUnavailableMessage")};
function esc(v=""){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function brl(c){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(c||0)/100)}
function spriteClass(p){return "sprite-"+(SPRITE_INDEX[p?.slug]??3)}
function loadBag(){try{return JSON.parse(localStorage.getItem("perfumes-demo-bag")||"[]")}catch{return[]}}
function saveBag(){localStorage.setItem("perfumes-demo-bag",JSON.stringify(state.bag))}
function toast(m){els.toast.textContent=m;els.toast.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>els.toast.classList.remove("show"),2300)}
async function supabaseGet(table,query=""){const r=await fetch(SUPABASE_URL+"/rest/v1/"+table+"?"+query,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Accept:"application/json"}});if(!r.ok)throw new Error(await r.text());return r.json()}
async function loadSiteStatus(){try{const rows=await supabaseGet("site_status","select=is_online,outage_kind,public_message&id=eq.true&limit=1"),s=rows[0];if(!s||s.is_online){els.siteUnavailable.hidden=true;return}els.siteUnavailableTitle.textContent=s.outage_kind==="permanent_closure"?"Loja encerrada":"Site temporariamente indisponível";els.siteUnavailableMessage.textContent=s.public_message||"Estamos realizando um ajuste operacional. Voltamos em breve.";els.siteUnavailable.hidden=false}catch(e){console.error(e)}}
async function loadSellers(){try{state.sellers=await supabaseGet("seller_checkout_options","select=seller_id,display_name,avatar_url&is_active=eq.true&order=display_name.asc");renderSellerPicker()}catch(e){console.error(e);els.sellerPicker.innerHTML="<p>Nenhum vendedor ativo no momento.</p>"}}
function renderSellerPicker(){if(!state.sellers.length){els.sellerPicker.innerHTML="<p>Nenhum vendedor ativo no momento.</p>";return}els.sellerPicker.innerHTML=state.sellers.map(s=>'<button class="seller-card '+(state.selectedSellerId===s.seller_id?"is-active":"")+'" type="button" data-seller-id="'+esc(s.seller_id)+'"><strong>'+esc(s.display_name)+'</strong></button>').join("");$$("[data-seller-id]",els.sellerPicker).forEach(b=>b.onclick=()=>{state.selectedSellerId=b.dataset.sellerId;renderSellerPicker()})}
async function loadCatalog(){els.catalogStatus.textContent="Carregando catálogo...";try{const [products,reviews]=await Promise.all([supabaseGet("products","select=*&is_active=eq.true&order=is_best_seller.desc,is_featured.desc,created_at.asc"),supabaseGet("reviews","select=id,product_id,customer_name,rating,comment,is_verified_purchase,is_approved,created_at&is_approved=eq.true&order=created_at.asc")]);state.products=products;state.reviews=reviews;renderProducts();renderBag()}catch(e){console.error(e);els.catalogStatus.textContent="Não foi possível carregar o catálogo agora."}}
function filteredProducts(){let rows=state.filter==="todos"?state.products:state.products.filter(p=>p.category===state.filter);const q=state.search.trim().toLowerCase();if(q)rows=rows.filter(p=>[p.name,p.brand,p.category,p.volume_ml].join(" ").toLowerCase().includes(q));return rows}
function reviewSummary(id){const r=state.reviews.filter(x=>x.product_id===id);if(!r.length)return{stars:"☆☆☆☆☆",text:""};const avg=r.reduce((a,b)=>a+Number(b.rating||0),0)/r.length;return{stars:"★".repeat(Math.round(avg))+"☆".repeat(5-Math.round(avg)),text:"("+r.length+")"}}
function renderProducts(){const rows=filteredProducts();els.catalogStatus.textContent=rows.length?rows.length+" fragrância"+(rows.length===1?"":"s")+" disponível"+(rows.length===1?"":"s"):"Nenhuma fragrância encontrada.";els.productGrid.innerHTML=rows.slice(0,12).map(p=>{const price=p.sale_price_cents??p.price_cents,r=reviewSummary(p.id);return '<article class="product-card" data-product-id="'+esc(p.id)+'"><div class="product-media"><span class="product-heart">♡</span><div class="product-art '+spriteClass(p)+'"></div></div><div class="product-body"><h3>'+esc(p.name).toUpperCase()+'</h3><div class="product-brand">'+esc(p.brand||"Perfume importado")+' · '+esc(p.volume_ml)+'ml</div><div class="product-rating">'+r.stars+' <small>'+r.text+'</small></div><strong class="product-price">'+brl(price)+'</strong><button class="buy-card" type="button" data-buy="'+esc(p.id)+'">▱ &nbsp; COMPRAR</button></div></article>'}).join("");$$(".product-card",els.productGrid).forEach(card=>card.onclick=e=>{if(e.target.closest("[data-buy]"))return;openProduct(card.dataset.productId)});$$("[data-buy]",els.productGrid).forEach(b=>b.onclick=e=>{e.stopPropagation();const p=state.products.find(x=>x.id===b.dataset.buy);if(p)addToBag(p)})}
function setFilter(f){state.filter=f;$$(".filter").forEach(b=>b.classList.toggle("is-active",b.dataset.filter===f));renderProducts()}
function openProduct(id){const p=state.products.find(x=>x.id===id);if(!p)return;const reviews=state.reviews.filter(r=>r.product_id===id),price=p.sale_price_cents??p.price_cents;els.productModalContent.innerHTML='<div class="product-detail"><div class="detail-media"><div class="detail-art '+spriteClass(p)+'"></div></div><div class="detail-copy"><p class="eyebrow">'+esc(p.brand||"PERFUME IMPORTADO")+' · '+esc(p.category)+'</p><h2>'+esc(p.name)+'</h2><p class="detail-price">'+brl(price)+' · '+esc(p.volume_ml)+' mL</p><p class="detail-desc">'+esc(p.description||p.short_description||"Fragrância selecionada para uma experiência marcante e sofisticada.")+'</p><p class="detail-stock">'+(Number(p.stock)>0?esc(p.stock)+" unidade(s) disponíveis":"Disponibilidade a confirmar")+'</p><div class="notes"><div class="note"><strong>Notas de topo</strong><span>'+esc((p.top_notes||[]).join(" · ")||"—")+'</span></div><div class="note"><strong>Notas de coração</strong><span>'+esc((p.heart_notes||[]).join(" · ")||"—")+'</span></div><div class="note"><strong>Notas de fundo</strong><span>'+esc((p.base_notes||[]).join(" · ")||"—")+'</span></div></div><div class="composition"><strong>Composição</strong><p>'+esc(p.composition||"Informação técnica disponível no atendimento.")+'</p></div><div class="review-block"><strong>Avaliações</strong>'+(reviews.length?reviews.map(r=>'<div class="review"><div class="review-head"><b>'+esc(r.customer_name)+'</b><span class="stars">'+"★".repeat(Number(r.rating))+"☆".repeat(5-Number(r.rating))+'</span></div><p>'+esc(r.comment)+'</p></div>').join(""):'<p class="detail-desc">Ainda não há avaliações para esta fragrância.</p>')+'</div><div class="detail-actions"><button class="buy-card" id="addSelectedToBag">ADICIONAR À SACOLA</button><button class="buy-card secondary" id="buySelectedNow">COMPRAR AGORA</button></div></div></div>';els.productOverlay.hidden=false;syncScrollLock();$("#addSelectedToBag").onclick=()=>{addToBag(p);closeProduct()};$("#buySelectedNow").onclick=()=>{addToBag(p);closeProduct();openBag()}}
function closeProduct(){els.productOverlay.hidden=true;syncScrollLock()}
function addToBag(p){const e=state.bag.find(i=>i.id===p.id);if(e)e.quantity++;else state.bag.push({id:p.id,name:p.name,slug:p.slug,volume_ml:p.volume_ml,unit_price_cents:p.sale_price_cents??p.price_cents,quantity:1});saveBag();renderBag();toast(p.name+" adicionado à sacola")}
function removeFromBag(id){state.bag=state.bag.filter(i=>i.id!==id);saveBag();renderBag()}
function total(){return state.bag.reduce((s,i)=>s+Number(i.unit_price_cents)*Number(i.quantity),0)}
function renderBag(){const qty=state.bag.reduce((s,i)=>s+i.quantity,0);els.bagCount.textContent=qty;els.bagTotal.textContent=brl(total());if(!state.bag.length){els.bagItems.innerHTML='<p class="empty-bag">Sua sacola está vazia.</p>';els.checkoutBtn.disabled=true;return}els.checkoutBtn.disabled=false;els.bagItems.innerHTML=state.bag.map(i=>'<div class="bag-item"><div class="bag-art '+spriteClass(i)+'"></div><div><h4>'+esc(i.name)+'</h4><p>'+esc(i.volume_ml)+' mL · qtd. '+i.quantity+' · '+brl(i.unit_price_cents*i.quantity)+'</p></div><button data-remove="'+esc(i.id)+'">×</button></div>').join("");$$("[data-remove]",els.bagItems).forEach(b=>b.onclick=()=>removeFromBag(b.dataset.remove))}
function openBag(){els.bagDrawer.classList.add("is-open");els.drawerMask.hidden=false;syncScrollLock()}
function closeBag(){els.bagDrawer.classList.remove("is-open");els.drawerMask.hidden=true;syncScrollLock()}
function openCheckout(){if(!state.bag.length)return toast("Sua sacola está vazia.");closeBag();els.checkoutSummary.innerHTML=state.bag.map(i=>'<div>'+i.quantity+'× '+esc(i.name)+' — '+brl(i.unit_price_cents*i.quantity)+'</div>').join("")+'<strong>Total: '+brl(total())+'</strong>';renderSellerPicker();els.checkoutOverlay.hidden=false;syncScrollLock()}
function closeCheckout(){els.checkoutOverlay.hidden=true;syncScrollLock()}
function syncScrollLock(){document.body.style.overflow=(!els.productOverlay.hidden||!els.checkoutOverlay.hidden||els.bagDrawer.classList.contains("is-open"))?"hidden":""}
function setPayment(m){state.payment=m;$$(".payment-tab").forEach(b=>b.classList.toggle("is-active",b.dataset.payment===m));els.paymentDemoBox.innerHTML=m==="pix"?"<strong>PIX</strong><p>O pagamento é confirmado no atendimento.</p>":"<strong>Cartão</strong><p>O pagamento por cartão é confirmado no atendimento.</p>"}
function syncSearch(v){state.search=v;els.catalogSearch.value=v;els.topSearch.value=v;renderProducts();$("#catalogo").scrollIntoView({behavior:"smooth"})}
els.catalogSearch.oninput=e=>{state.search=e.target.value;els.topSearch.value=state.search;renderProducts()};els.topSearch.oninput=e=>syncSearch(e.target.value);
$$(".filter").forEach(b=>b.onclick=()=>setFilter(b.dataset.filter));$$("[data-jump-filter]").forEach(b=>b.onclick=()=>{setFilter(b.dataset.jumpFilter);$("#catalogo").scrollIntoView({behavior:"smooth"})});
$("[data-close-product]").onclick=closeProduct;els.productOverlay.onclick=e=>{if(e.target===els.productOverlay)closeProduct()};els.bagBtn.onclick=openBag;els.closeBag.onclick=closeBag;els.drawerMask.onclick=closeBag;els.checkoutBtn.onclick=openCheckout;$("[data-close-checkout]").onclick=closeCheckout;els.checkoutOverlay.onclick=e=>{if(e.target===els.checkoutOverlay)closeCheckout()};$$(".payment-tab").forEach(b=>b.onclick=()=>setPayment(b.dataset.payment));
els.checkoutForm.onsubmit=e=>{e.preventDefault();const d=new FormData(e.currentTarget),customer=String(d.get("name")||"").trim();if(state.sellers.length&&!state.selectedSellerId)return toast("Selecione o vendedor que te atendeu.");toast("Pedido preparado para "+(customer||"cliente"));state.bag=[];saveBag();renderBag();closeCheckout();e.currentTarget.reset();state.selectedSellerId=null;renderSellerPicker()};
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if(!els.checkoutOverlay.hidden)closeCheckout();else if(!els.productOverlay.hidden)closeProduct();else if(els.bagDrawer.classList.contains("is-open"))closeBag()});

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

initHeroCarousel();
loadSiteStatus();loadCatalog();loadSellers();
// Hero carousel
const heroSlides=[...document.querySelectorAll("[data-hero-slide]")],heroDots=[...document.querySelectorAll("[data-hero-dot]")];let heroIndex=0,heroTimer;
function showHero(i){if(!heroSlides.length)return;heroIndex=(i+heroSlides.length)%heroSlides.length;heroSlides.forEach((s,n)=>s.classList.toggle("is-active",n===heroIndex));heroDots.forEach((d,n)=>d.classList.toggle("is-active",n===heroIndex))}
function startHero(){clearInterval(heroTimer);heroTimer=setInterval(()=>showHero(heroIndex+1),6500)}
heroDots.forEach((d,i)=>d.addEventListener("click",()=>{showHero(i);startHero()}));
const heroCarousel=document.querySelector("#heroCarousel");if(heroCarousel){let sx=0;heroCarousel.addEventListener("touchstart",e=>{sx=e.changedTouches[0].clientX},{passive:true});heroCarousel.addEventListener("touchend",e=>{const dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>45){showHero(heroIndex+(dx<0?1:-1));startHero()}},{passive:true});startHero();}
