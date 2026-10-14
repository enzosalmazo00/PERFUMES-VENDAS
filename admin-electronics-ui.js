export function switchProductCatalog(kind){
 const host=document.querySelector(kind==="bebidas"?"#beveragesCatalogHost":"#electronicsCatalogHost");
 const perfume=document.querySelector('[data-panel="perfumes"]');
 if(!host||!perfume)return;
 const cards=["#productForm","#products","#editProductCard"].map(q=>document.querySelector(q)?.closest(".card")).filter(Boolean);
 if(!switchProductCatalog.home)switchProductCatalog.home=cards.map(node=>({node,parent:node.parentNode,next:node.nextSibling}));
 if(kind==="eletronicos"||kind==="bebidas")cards.forEach(node=>host.appendChild(node));
 else switchProductCatalog.home.forEach(({node,parent,next})=>parent.insertBefore(node,next?.parentNode===parent?next:null));
 for(const form of [document.querySelector("#productForm"),document.querySelector("#editProductForm")]){
  if(!form)continue;
  const electronic=kind==="eletronicos",beverage=kind==="bebidas",generic=electronic||beverage,type=form.elements.product_type,category=form.elements.category;
  if(!type.dataset.allOptions)type.dataset.allOptions=JSON.stringify([...type.options].map(o=>[o.value,o.textContent]));
  const choices=JSON.parse(type.dataset.allOptions).filter(([v])=>beverage?v==="bebidas":electronic?!["perfume","body_splash","bebidas"].includes(v):["perfume","body_splash"].includes(v));
  const current=type.value;type.replaceChildren(...choices.map(([v,label])=>new Option(label,v)));
  type.value=choices.some(([v])=>v===current)?current:choices[0]?.[0]||"";
  if(generic)category.value=type.value;
  type.onchange=()=>{if(generic)category.value=type.value};
  for(const sel of [".catalog-global-label",".catalog-global-results",".catalog-reference-note",".catalog-brand-search",".catalog-fragrance-select",".catalog-volume-select",".catalog-count-hint"]){
   form.querySelectorAll(sel).forEach(el=>{const box=el.closest("label")||el;box.hidden=generic;box.querySelectorAll("input,select").forEach(input=>input.disabled=generic)});
  }
  for(const el of form.querySelectorAll(".catalog-custom-volume"))el.hidden=generic;
  for(const name of ["volume_preset","fragrance_preset","brand_preset"]){const field=form.elements[name];if(field){field.disabled=generic;field.required=!generic&&name!=="fragrance_preset"}}
  const brand=form.elements.brand_custom;if(brand){
   const label=brand.closest("label");
   if(generic){
    label.hidden=false;brand.disabled=false;
    let select=form.querySelector(".electronics-brand-preset");
    if(!select){
     select=document.createElement("select");select.className="electronics-brand-preset";
     for(const v of ["","EcoPower","Aiwa","JBL","Apple","Samsung","Redragon","Outra marca"])select.add(new Option(v||"Selecione a marca",v));
     label.insertBefore(select,brand);
     select.addEventListener("change",()=>{const other=select.value==="Outra marca";brand.hidden=!other;brand.value=other?"":select.value;brand.required=other;});
    }
    select.hidden=false;select.disabled=false;
    if(beverage){
      select.hidden=true;select.disabled=true;brand.hidden=false;brand.required=true;
    }else{
      select.hidden=false;select.disabled=false;
    }
    const known=[...select.options].some(o=>o.value===brand.value&&o.value);
    select.value=known?brand.value:"";if(electronic){brand.hidden=known;brand.required=!known}
   }else{
    label.hidden=true;brand.disabled=true;brand.required=false;
    const select=form.querySelector(".electronics-brand-preset");if(select){select.hidden=true;select.disabled=true;}
   }
  }
  for(const name of ["composition","top_notes","heart_notes","base_notes"]){const field=form.elements[name];if(field)field.closest("label").hidden=generic}
  const heading=form.closest(".card")?.querySelector("h2");
  if(heading&&form.id==="productForm")heading.textContent=beverage?"Cadastrar bebida":electronic?"Cadastrar eletrônico":"Novo perfume";
  if(form.id==="productForm"){form.elements.name.placeholder=beverage?"Nome, marca e apresentação da bebida":electronic?"Nome, marca e modelo do eletrônico":"Nome da fragrância";}
  let volumeLabel=form.querySelector(".beverage-volume-label");
  if(!volumeLabel){volumeLabel=document.createElement("label");volumeLabel.className="beverage-volume-label";volumeLabel.textContent="Volume da embalagem (mL)";const input=document.createElement("input");input.type="number";input.name="beverage_volume_ml";input.min="1";input.max="100000";input.step="1";input.placeholder="Ex.: 350, 500, 1000";volumeLabel.append(input);category.closest("label")?.after(volumeLabel)}
  volumeLabel.hidden=!beverage;volumeLabel.querySelector("input").disabled=!beverage;volumeLabel.querySelector("input").required=beverage;
 }
}
