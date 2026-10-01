
import {FRAGRANCE_CATALOG,VOLUME_OPTIONS} from "./fragrance-data.js?v=20261001-catalog1";
import {VERIFIED_FRAGRANCES} from "./verified-fragrances.js?v=20261001-verified1";
const OTHER="__other__";
const normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const unique=a=>[...new Set(a)];
const verified=(brand,name,type)=>VERIFIED_FRAGRANCES.find(x=>normalize(x.brand)===normalize(brand)&&normalize(x.name)===normalize(name)&&x.type===type);
function updateReference(form,record){
 const target=form.querySelector(".catalog-reference-note");
 if(!target)return;
 target.replaceChildren();
 if(record){
  target.textContent="Dados consultados em catálogo oficial; confirme a versão e o tamanho da embalagem. ";
  const a=document.createElement("a");a.href=record.source;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Ver fonte oficial";
  target.append(a);
 }else{
  target.textContent="Esta versão ainda não tem ficha oficial validada. Preencha categoria, volume real e notas conforme o rótulo; o sistema não inventará essas informações.";
 }
}
function fillVerified(form,record){
 const f=fields(form);
 updateReference(form,record);
 if(!record)return;
 const category=form.elements.namedItem("category");
 if(category)category.value=record.gender;
 const map={short_description:record.short,description:record.description,
   top_notes:record.top.join(", "),heart_notes:record.heart.join(", "),base_notes:record.base.join(", ")};
 for(const [key,value]of Object.entries(map)){const input=form.elements.namedItem(key);if(input)input.value=value}
}

function el(name,attrs={}){const n=document.createElement(name);for(const[k,v]of Object.entries(attrs))n[k]=v;return n}
function addOption(parent,value,label){const o=new Option(label,value);parent.append(o);return o}
function matchBrand(value){return FRAGRANCE_CATALOG.find(x=>normalize(x.brand)===normalize(value))}
function fields(form){
  return{
    search:form.querySelector(".catalog-brand-search"),
    brand:form.elements.namedItem("brand_preset"),
    customBrand:form.elements.namedItem("brand_custom"),
    customBrandWrap:form.querySelector(".catalog-custom-brand"),
    fragrance:form.elements.namedItem("fragrance_preset"),
    name:form.elements.namedItem("name"),
    type:form.elements.namedItem("product_type"),
    volume:form.elements.namedItem("volume_preset"),
    customVolume:form.elements.namedItem("custom_volume_ml"),
    customVolumeWrap:form.querySelector(".catalog-custom-volume"),
    hint:form.querySelector(".catalog-count-hint")
  };
}
function renderBrands(form,preferred){
  const f=fields(form),search=normalize(f.search.value);
  const selected=preferred===undefined?f.brand.value:preferred;
  f.brand.replaceChildren();
  addOption(f.brand,"","Selecione a marca");
  let count=0;
  for(const group of unique(FRAGRANCE_CATALOG.map(r=>r.group))){
    const entries=FRAGRANCE_CATALOG.filter(r=>r.group===group&&(!search||normalize(r.brand).includes(search)||r.brand===selected));
    if(!entries.length)continue;
    const optgroup=el("optgroup",{label:group});
    for(const entry of entries){addOption(optgroup,entry.brand,entry.brand);count++}
    f.brand.append(optgroup);
  }
  if(!count&&search)addOption(f.brand,"","Nenhuma marca encontrada");
  addOption(f.brand,OTHER,"Outra marca — digitar");
  if([...f.brand.options].some(o=>o.value===selected))f.brand.value=selected;
  else f.brand.value="";
  if(f.hint)f.hint.textContent=search?count+" marca(s) encontrada(s)":"57 marcas cadastradas • escolha ou pesquise";
}
function syncCustomBrand(form){
  const f=fields(form),isOther=f.brand.value===OTHER;
  f.customBrandWrap.hidden=!isOther;
  f.customBrand.required=isOther;
  if(!isOther)f.customBrand.value="";
}
function renderFragrances(form,preferred){
  const f=fields(form);
  const current=preferred===undefined?f.fragrance.value:preferred;
  const entry=FRAGRANCE_CATALOG.find(x=>x.brand===f.brand.value);
  const isSplash=f.type.value==="body_splash";
  const options=entry?(isSplash?entry.splashes:entry.fragrances):[];
  f.fragrance.replaceChildren();
  addOption(f.fragrance,"",entry?(options.length?"Selecione a fragrância":"Sem sugestões para este tipo"):"Selecione uma marca primeiro");
  for(const item of options)addOption(f.fragrance,item,item);
  addOption(f.fragrance,OTHER,"Outro nome — digitar");
  f.fragrance.value=options.includes(current)?current:current===OTHER?OTHER:"";
  f.fragrance.disabled=!entry&&!f.brand.value;
  f.fragrance.title=isSplash?"Somente sugestões de body splash da marca escolhida":"Sugestões de perfumes da marca escolhida";
}
function renderVolumes(form,preferred){
 const f=fields(form);
 const record=verified(f.brand.value,f.fragrance.value,f.type.value);
 const keep=preferred===undefined?f.volume.value:String(preferred||"");
 f.volume.replaceChildren();
 addOption(f.volume,"",record?"Selecione um volume oficial":"Volume não verificado — informar o frasco");
 if(record){for(const amount of record.volumes)addOption(f.volume,String(amount),amount+" mL")}
 addOption(f.volume,OTHER,record?"Outro volume / kit — digitar":"Digitar volume da embalagem");
 f.volume.value=[...f.volume.options].some(x=>x.value===keep)?keep:"";
 toggleVolume(form);
 updateReference(form,record);
}
function toggleVolume(form){
  const f=fields(form),custom=f.volume.value===OTHER;
  f.customVolumeWrap.hidden=!custom;
  f.customVolume.required=custom;
  if(!custom)f.customVolume.value="";
}
function markSelectedFragrance(form){
  const f=fields(form),name=f.name.value.trim();
  const listed=[...f.fragrance.options].some(x=>x.value===name&&x.value!==OTHER);
  f.fragrance.value=listed?name:name?OTHER:"";
}
export function initializeCatalogForm(form){
  if(!form||form.dataset.catalogReady==="yes")return;
  form.dataset.catalogReady="yes";
  renderBrands(form,"");
  renderFragrances(form,"");
  renderVolumes(form);
  const f=fields(form);
  f.search.addEventListener("input",()=>renderBrands(form));
  f.brand.addEventListener("change",()=>{
    syncCustomBrand(form);
    renderFragrances(form,"");
    renderVolumes(form);
    f.name.value="";
  });
  f.type.addEventListener("change",()=>{
    renderFragrances(form,"");
    f.name.value="";
  });
  f.fragrance.addEventListener("change",()=>{
    if(f.fragrance.value&&f.fragrance.value!==OTHER){
      f.name.value=f.fragrance.value;
      fillVerified(form,verified(f.brand.value,f.fragrance.value,f.type.value));
      renderVolumes(form);
    }
    else if(f.fragrance.value===OTHER){
      f.name.value="";
      fillVerified(form,null);renderVolumes(form);
      f.name.focus();
    }
  });
  f.name.addEventListener("input",()=>markSelectedFragrance(form));
  f.volume.addEventListener("change",()=>toggleVolume(form));
}
export function catalogLoadProduct(form,product){
  initializeCatalogForm(form);
  const f=fields(form);
  f.search.value="";
  const brand=matchBrand(product.brand);
  renderBrands(form,brand?brand.brand:OTHER);
  if(!brand)f.customBrand.value=product.brand||"";
  syncCustomBrand(form);
  if(!brand)f.customBrand.value=product.brand||"";
  renderFragrances(form,product.name||OTHER);
  f.name.value=product.name||"";
  markSelectedFragrance(form);
  const volume=Number(product.volume_ml||0);
  renderVolumes(form,volume);
  if(volume&&![...f.volume.options].some(o=>o.value===String(volume))){
    f.volume.value=OTHER;toggleVolume(form);f.customVolume.value=String(volume);
  }
}
export function catalogResetForm(form){
  const f=fields(form);
  f.search.value="";
  f.customBrand.value="";
  f.customVolume.value="";
  renderBrands(form,"");
  syncCustomBrand(form);
  renderFragrances(form,"");
  renderVolumes(form);
  updateReference(form,null);
}
export function catalogReadBrand(data){
  const brand=String(data.get("brand_preset")||"");
  return brand===OTHER?String(data.get("brand_custom")||"").trim():brand;
}
export function catalogReadVolume(data){
  const selected=String(data.get("volume_preset")||"");
  const volume=selected===OTHER?Number(data.get("custom_volume_ml")):Number(selected);
  return Number.isFinite(volume)&&volume>0?volume:0;
}
