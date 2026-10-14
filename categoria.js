(()=>{"use strict";const names={perfumes:"Perfumes",fones:"Fones de ouvido",caixas:"Caixas de som",carregadores:"Carregadores portáteis",bebidas:"Bebidas",eletronicos:"Eletrônicos",todos:"Todos os produtos"};const type=new URLSearchParams(location.search).get("tipo")||"todos";const selected=Object.prototype.hasOwnProperty.call(names,type)?type:"todos";const genero=new URLSearchParams(location.search).get("genero");const searchTerm=(new URLSearchParams(location.search).get("q")||"").trim();document.querySelector("#heading").textContent=searchTerm?"Resultados para: "+searchTerm:names[selected];document.title="AZZENA IMPORTS — "+names[selected];const status=document.querySelector("#status"),grid=document.querySelector("#grid");const norm=v=>String(v||"").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");const matches=p=>{const type=norm(p.product_type).replace(/[ _-]+/g,"_");const category=norm(p.category).replace(/[ _-]+/g,"_");const perfume=type==="perfume"||type==="body_splash"||(!type&&["masculino","feminino","unissex","unisex","perfume","body_splash"].includes(category));const phones=type==="fones"||type==="fone"||type==="headphones"||type==="earbuds"||category==="fones";const speakers=type==="caixas"||type==="caixas_de_som"||type==="speaker"||category==="caixas";const chargers=type==="carregadores"||type==="powerbanks"||type==="powerbank"||category==="carregadores";const drinks=type==="bebidas"||type==="bebida"||category==="bebidas"||category==="bebida";if(selected==="todos")return true;if(selected==="perfumes"){if(!perfume)return false;if(!genero)return true;if(genero==="body_splash")return type==="body_splash"||category==="body_splash";return category===genero||category==="unissex"||category==="unisex"}if(selected==="fones")return phones;if(selected==="caixas")return speakers;if(selected==="carregadores")return chargers;if(selected==="bebidas")return drinks;return !perfume&&!drinks&&(phones||speakers||chargers||["eletronicos","acessorios","outros","personalizado"].includes(type))};const money=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v||0)/100);const el=(tag,cls,content)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=content;return e};const dialog=document.querySelector("#productDialog");dialog.querySelector(".dialog-close").onclick=()=>dialog.close();dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});
async function requestCategoryPreorder(p){
 const box=dialog.querySelector("#dialogStatus");
 box.textContent="Consultando contato de encomendas...";
 try{
  const response=await fetch("https://fbwlprwhczxjdsciotsi.supabase.co/rest/v1/rpc/public_preorder_sellers",{method:"POST",headers:{apikey:"sb_publishable_XkqHZE_hdTNrNXE0O9tvRA_rWdw5pPE","Content-Type":"application/json"},body:"{}"});
  if(!response.ok)throw Error("Contato indisponível");
  const sellers=await response.json();
  const seller=Array.isArray(sellers)?sellers.find(x=>String(x.whatsapp||"").replace(/[^0-9]/g,"").length>=10):null;
  if(!seller)throw Error("Nenhum vendedor disponível");
  const hour=Number(new Intl.DateTimeFormat("en-GB",{hour:"2-digit",hour12:false,timeZone:"America/Sao_Paulo"}).format(new Date()));
  const greeting=hour<12?"Bom dia":hour<18?"Boa tarde":"Boa noite";
  const message=[greeting+"! Tudo bem?","Vi um produto no site da AZZENA IMPORTS e gostaria de consultar uma encomenda.","PRODUTO: "+p.name,"MARCA: "+(p.brand||"Não informada"),"QUANTIDADE: 1 unidade","Gostaria de saber:","- Valor da encomenda;","- Disponibilidade e prazo de chegada;","- Valor do envio ou possibilidade de retirada.","Agradeço desde já!"].join("\n\n");
  const phone=String(seller.whatsapp).replace(/[^0-9]/g,"");
  const link="https://wa.me/"+phone+"?text="+encodeURIComponent(message);
  box.replaceChildren();
  const a=document.createElement("a");a.href=link;a.target="_blank";a.rel="noopener noreferrer";a.textContent="ABRIR WHATSAPP DO VENDEDOR";a.className="btn";box.append(a);a.click();
 }catch(error){box.textContent="Não foi possível localizar o WhatsApp do vendedor. Tente novamente."}
}
async function loadProductExtras(p){
 const notes=document.querySelector("#dialogNotes"),grid=document.querySelector("#dialogNotesGrid"),reviews=document.querySelector("#dialogReviews");
 notes.hidden=true;grid.replaceChildren();reviews.textContent="Carregando avaliações...";
 const api="https://fbwlprwhczxjdsciotsi.supabase.co/rest/v1/";
 const headers={apikey:"sb_publishable_XkqHZE_hdTNrNXE0O9tvRA_rWdw5pPE",Accept:"application/json"};
 const [productResult,reviewResult]=await Promise.allSettled([
 fetch(api+"products?select=top_notes,heart_notes,base_notes&id=eq."+encodeURIComponent(p.id)+"&limit=1",{headers}).then(r=>{if(!r.ok)throw Error("notes");return r.json()}),
 fetch(api+"reviews?select=customer_name,rating,comment,is_verified_purchase,created_at&product_id=eq."+encodeURIComponent(p.id)+"&is_approved=eq.true&order=created_at.desc&limit=30",{headers}).then(r=>{if(!r.ok)throw Error("reviews");return r.json()})
 ]);
 if(!dialog.open||document.querySelector("#dialogName").textContent!==p.name)return;
 if(productResult.status==="fulfilled"){
  const item=productResult.value[0]||{};
  for(const [field,label] of [["top_notes","Notas de saída · Primeiro encontro"],["heart_notes","Notas de coração · A essência"],["base_notes","Notas de fundo · A assinatura"]]){
   const value=item[field];if(!value||!String(value).trim())continue;
   const card=document.createElement("div");card.className="note-tier";
   const title=document.createElement("strong");title.textContent=label;
   const detail=document.createElement("span");detail.textContent=Array.isArray(value)?value.join(" · "):String(value);
   card.append(title,detail);grid.append(card);
  }
  notes.hidden=!grid.childElementCount;
 }
 reviews.replaceChildren();
 if(reviewResult.status==="rejected"){reviews.textContent="Não foi possível carregar as avaliações.";return}
 const entries=reviewResult.value;
 if(!entries.length){reviews.textContent="Este produto ainda não recebeu avaliações publicadas.";return}
 for(const item of entries){
  const card=document.createElement("article");card.className="review-card";
  const title=document.createElement("strong");title.textContent="★".repeat(Math.max(0,Math.min(5,Number(item.rating)||0)))+" · "+(item.customer_name||"Cliente");
  const comment=document.createElement("p");comment.textContent=item.comment||"Cliente avaliou este produto.";
  card.append(title,comment);
  if(item.is_verified_purchase){const verified=document.createElement("small");verified.textContent="Compra verificada";card.append(verified)}
  reviews.append(card);
 }
}
async function openDetail(p){dialog.querySelector("#dialogName").textContent=p.name;dialog.querySelector("#dialogBrand").textContent=p.brand||"AZZENA IMPORTS";dialog.querySelector("#dialogPrice").textContent=Number(p.available_stock||0)>0?money(p.sale_price_cents??p.price_cents):"ESGOTADO · CONSULTE VALOR DA ENCOMENDA";dialog.querySelector("#dialogDescription").textContent=p.short_description||"Confira as características do produto.";dialog.querySelector("#dialogDetails").textContent=p.product_type==="bebidas"?(Number(p.volume_ml||0)>1?"Embalagem de "+Number(p.volume_ml)+" mL · vendido por unidade":"Vendido por unidade"):["perfume","body_splash"].includes(p.product_type)?"Volume em mL":"Vendido por unidade";const photo=dialog.querySelector("#dialogPhoto");photo.replaceChildren();if(/^https:\/\//.test(p.image_url||"")){const img=el("img");img.src=p.image_url;img.alt=p.name;photo.append(img)}dialog.querySelector("#dialogStatus").textContent="";dialog.querySelector("#dialogCart").href="index.html?abrir_sacola=1";const add=dialog.querySelector("#dialogAdd");add.disabled=false;add.textContent=Number(p.available_stock||0)<1?"ESGOTADO — SOLICITAR ENCOMENDA":"ADICIONAR À SACOLA";if(add.disabled)dialog.querySelector("#dialogStatus").textContent="Produto esgotado. Entre em contato com o vendedor para encomendar.";add.onclick=()=>{if(Number(p.available_stock||0)<1){requestCategoryPreorder(p);return}try{const key="perfumes-demo-bag",bag=JSON.parse(localStorage.getItem(key)||"[]");const existing=bag.find(i=>i.id===p.id);if(existing)existing.quantity=Math.min(100,Number(existing.quantity||0)+1);else bag.push({id:p.id,name:p.name,slug:"",volume_ml:1,unit_price_cents:p.sale_price_cents??p.price_cents,quantity:1});localStorage.setItem(key,JSON.stringify(bag));dialog.querySelector("#dialogStatus").textContent="Adicionado ao carrinho. Estoque será confirmado na loja.";dialog.querySelector("#dialogCart").href="index.html?abrir_sacola=1"}catch{dialog.querySelector("#dialogStatus").textContent="Não foi possível adicionar. Tente novamente."}};dialog.showModal();loadProductExtras(p);try{const r=await fetch("https://fbwlprwhczxjdsciotsi.supabase.co/rest/v1/products?select=description,short_description&id=eq."+encodeURIComponent(p.id)+"&limit=1",{headers:{apikey:"sb_publishable_XkqHZE_hdTNrNXE0O9tvRA_rWdw5pPE"}});if(r.ok){const d=(await r.json())[0];if(d&&dialog.open)dialog.querySelector("#dialogDescription").textContent=d.description||d.short_description||""}}catch{}}
async function fetchAvailableStock(){
 const api="https://fbwlprwhczxjdsciotsi.supabase.co/rest/v1/";
 const headers={apikey:"sb_publishable_XkqHZE_hdTNrNXE0O9tvRA_rWdw5pPE",Accept:"application/json"};
 const response=await fetch(api+"seller_checkout_options?select=seller_id&is_active=eq.true",{headers});
 if(!response.ok)throw Error("Não foi possível consultar vendedores");
 const sellers=await response.json();
 const catalogs=await Promise.all(sellers.map(async seller=>{
  const r=await fetch(api+"rpc/public_seller_catalog",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({p_seller_id:seller.seller_id})});
  if(!r.ok)throw Error("Estoque indisponível");
  const result=await r.json();
  return result?.pickup&&Array.isArray(result.products)?result.products:[];
 }));
 const stock=new Map();
 for(const catalog of catalogs)for(const product of catalog){
  const id=String(product.id);stock.set(id,(stock.get(id)||0)+Math.max(0,Number(product.stock)||0));
 }
 return stock;
}
async function load(){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);try{grid.replaceChildren();status.textContent="Carregando produtos...";const r=await fetch("https://fbwlprwhczxjdsciotsi.supabase.co/rest/v1/products?select=id,name,brand,category,product_type,volume_ml,short_description,image_url,price_cents,sale_price_cents&is_active=eq.true&order=name.asc&limit=1000",{headers:{apikey:"sb_publishable_XkqHZE_hdTNrNXE0O9tvRA_rWdw5pPE",Accept:"application/json"},signal:controller.signal});if(!r.ok)throw Error("Erro ao consultar produtos");const data=await r.json();if(!Array.isArray(data))throw Error("Resposta inválida do catálogo");const stock=await fetchAvailableStock();const rows=data.filter(p=>matches(p)&&(!searchTerm||norm([p.name,p.brand].join(" ")).includes(norm(searchTerm)))).map(p=>({...p,available_stock:stock.get(String(p.id))||0}));status.textContent=rows.length+" produto(s) encontrado(s)"+(searchTerm?" para “"+searchTerm+"”":"");if(!rows.length){grid.append(el("p","empty","Nenhum produto encontrado. Tente outro nome ou marca."));return}for(const p of rows){const card=el("article","card");if(/^https:\/\//.test(p.image_url||"")){const img=el("img");img.src=p.image_url;img.alt=p.name||"Produto";img.loading="lazy";img.decoding="async";card.append(img)}const body=el("div","body");body.append(el("h2","",p.name),el("p","",p.brand||"AZZENA IMPORTS"),el("p","price",Number(p.available_stock||0)>0?money(p.sale_price_cents??p.price_cents):"ESGOTADO · SOB ENCOMENDA"));const available=Number(p.available_stock||0)>0;const link=el("button","btn",available?"COMPRAR AGORA":"VER DETALHES · SOLICITAR ENCOMENDA");link.type="button";link.style.border="0";link.style.cursor="pointer";card.style.cursor="pointer";card.tabIndex=0;card.setAttribute("role","button");card.setAttribute("aria-label","Ver detalhes de "+p.name);link.addEventListener("click",e=>{e.stopPropagation();if(!available){openDetail(p);return}try{const key="perfumes-demo-bag",bag=JSON.parse(localStorage.getItem(key)||"[]");const current=bag.find(i=>i.id===p.id);if(current)current.quantity=Math.min(Number(p.available_stock),Number(current.quantity||0)+1);else bag.push({id:p.id,name:p.name,slug:"",volume_ml:1,unit_price_cents:p.sale_price_cents??p.price_cents,quantity:1});localStorage.setItem(key,JSON.stringify(bag));location.href="index.html?abrir_sacola=1"}catch{openDetail(p)}});card.addEventListener("click",()=>openDetail(p));card.addEventListener("keydown",e=>{if(e.target===card&&(e.key==="Enter"||e.key===" ")){e.preventDefault();openDetail(p)}});body.append(link);card.append(body);grid.append(card)}}catch(err){status.textContent="Não foi possível carregar os produtos agora. Tente novamente mais tarde.";console.error(err);status.textContent="Não foi possível carregar o catálogo. Toque aqui para tentar novamente.";status.style.cursor="pointer";status.onclick=()=>{status.onclick=null;load()}}finally{clearTimeout(timer)}}load()})();