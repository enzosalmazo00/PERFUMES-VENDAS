export function switchProductCatalog(kind){
 const host=document.querySelector("#electronicsCatalogHost");
 const perfume=document.querySelector('[data-panel="perfumes"]');
 if(!host||!perfume)return;
 const cards=["#productForm","#products","#editProductCard"].map(q=>document.querySelector(q)?.closest(".card")).filter(Boolean);
 if(!switchProductCatalog.home)switchProductCatalog.home=cards.map(node=>({node,parent:node.parentNode,next:node.nextSibling}));
 if(kind==="eletronicos")cards.forEach(node=>host.appendChild(node));
 else switchProductCatalog.home.forEach(({node,parent,next})=>parent.insertBefore(node,next?.parentNode===parent?next:null));
 for(const form of [document.querySelector("#productForm"),document.querySelector("#editProductForm")]){
  if(!form)continue;
  const electronic=kind==="eletronicos",type=form.elements.product_type,category=form.elements.category;
  if(!type.dataset.allOptions)type.dataset.allOptions=JSON.stringify([...type.options].map(o=>[o.value,o.textContent]));
  const choices=JSON.parse(type.dataset.allOptions).filter(([v])=>electronic?!["perfume","body_splash"].includes(v):["perfume","body_splash"].includes(v));
  const current=type.value;type.replaceChildren(...choices.map(([v,label])=>new Option(label,v)));
  type.value=choices.some(([v])=>v===current)?current:choices[0]?.[0]||"";
  if(electronic)category.value=type.value;
  type.onchange=()=>{if(electronic)category.value=type.value};
  for(const sel of [".catalog-global-label",".catalog-global-results",".catalog-reference-note",".catalog-brand-search",".catalog-fragrance-select",".catalog-volume-select",".catalog-count-hint"]){
   form.querySelectorAll(sel).forEach(el=>{const box=el.closest("label")||el;box.hidden=electronic;box.querySelectorAll("input,select").forEach(input=>input.disabled=electronic)});
  }
  for(const name of ["volume_preset","fragrance_preset","brand_preset"]){const field=form.elements[name];if(field){field.disabled=electronic;field.required=!electronic&&name!=="fragrance_preset"}}
  const brand=form.elements.brand_custom;if(brand){brand.closest("label").hidden=!electronic;brand.disabled=!electronic;brand.required=electronic;}
  for(const name of ["composition","top_notes","heart_notes","base_notes"]){const field=form.elements[name];if(field)field.closest("label").hidden=electronic}
  const heading=form.closest(".card")?.querySelector("h2");
  if(heading&&form.id==="productForm")heading.textContent=electronic?"Cadastrar eletrônico":"Novo perfume";
  if(form.id==="productForm"&&electronic){form.elements.name.placeholder="Nome, marca e modelo do eletrônico";}
 }
}
