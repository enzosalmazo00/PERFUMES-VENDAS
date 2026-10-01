// Etiqueta de pedido imprimível. Apenas o painel autorizado recebe os dados.
const safe=(v="")=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const brl=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n||0)/100);
const PRESETS={"100x150":{w:"100mm",h:"150mm",label:"100 × 150 mm"},
 "100x100":{w:"100mm",h:"100mm",label:"100 × 100 mm"},
 a4:{w:"210mm",h:"297mm",label:"A4"}};
function address(order){
 const c=order.customer_address_snapshot||{};
 const street=c.full_address||c.street||order.shipping_street;
 if(c.full_address)return{title:"ENDEREÇO DO CLIENTE",lines:[safe(c.full_address)]};
 if(street)return{title:"ENDEREÇO DO CLIENTE",lines:[
   [street,c.number||order.shipping_number,c.complement||order.shipping_complement].filter(Boolean).map(safe).join(", "),
   [c.neighborhood||order.shipping_neighborhood,c.city||order.shipping_city,c.state||order.shipping_state].filter(Boolean).map(safe).join(" · "),
   "CEP: "+safe(c.postal_code||order.shipping_postal_code||"não informado")
 ]};
 const p=order.pickup_location_snapshot||{};
 if(p.street)return{title:"LOCAL DE RETIRADA",lines:[
   safe(p.display_name||"Retirada com vendedor"),
   [p.street,p.street_number,p.complement].filter(Boolean).map(safe).join(", "),
   [p.neighborhood,p.city,p.state].filter(Boolean).map(safe).join(" · "),
   p.postal_code?"CEP: "+safe(p.postal_code):""
 ]};
 return {title:"ENDEREÇO",lines:["Confirme o local com o cliente antes de entregar."]};
}
export function openSellerLabel(order,presetName="100x150"){
 const preset=PRESETS[presetName]||PRESETS["100x150"];
 const popup=window.open("","_blank");
 if(!popup)return false;
 const pending=order.payment_status!=="approved",addr=address(order);
 const list=(order.items||[]).map(item=>'<tr><td>'+safe(item.quantity)+' × '+safe(item.product_name)+
  (item.volume_ml?' · '+safe(item.volume_ml)+' mL':'')+'</td><td>'+brl(item.line_total_cents)+'</td></tr>').join("");
 const css='@page{size:'+preset.w+' '+preset.h+';margin:0}*{box-sizing:border-box}'+
 'body{margin:0;background:#ececec;color:#181818;font:10pt/1.3 Arial,sans-serif}'+
 '.actions{max-width:580px;margin:20px auto;padding:12px;text-align:center;background:#fff}'+
 '.actions button{border:1px solid #222;background:#111;color:#fff;padding:11px 22px;border-radius:3px}'+
 '.label{width:'+preset.w+';min-height:'+preset.h+';max-width:100%;padding:6mm;margin:20px auto;background:#fff;border:1px solid #ddd;overflow-wrap:anywhere}'+
 '.brand{font-family:Georgia,serif;font-size:20pt;font-weight:bold;letter-spacing:.13em;text-align:center;margin:2mm 0 0}'+
 '.brand-sub{font-size:8pt;letter-spacing:.39em;text-align:center;margin-bottom:5mm}'+
 '.top{display:flex;justify-content:space-between;gap:3mm;border-top:2px solid #111;padding-top:2mm}'+
 '.orderid{font-weight:800;font-size:14pt}.tiny{font-size:8pt;color:#444}.section{border-top:1px solid #777;margin-top:3mm;padding-top:2mm}'+
 '.label-title{font-size:8pt;letter-spacing:.08em;font-weight:700;margin-bottom:1.2mm}'+
 '.person{font-size:13pt;font-weight:700}.lines{line-height:1.42;font-size:9pt}'+
 'table{width:100%;border-collapse:collapse;font-size:8.5pt;margin-top:1.5mm}'+
 'td{vertical-align:top;padding:1mm 0;border-bottom:1px dotted #aaa}td:last-child{text-align:right;white-space:nowrap}'+
 '.footer{margin-top:2.5mm;padding-top:2mm;border-top:2px solid #111;display:flex;justify-content:space-between;gap:3mm;font-weight:bold}'+
 '.warning{border:2px solid #111;padding:2mm;margin-top:3mm;text-align:center;font-weight:800;font-size:11pt}'+
 '.paid{border:1px solid #777;padding:1mm 2mm;margin-top:2mm;text-align:center;font-weight:bold}'+
 '@media print{body{background:white}.actions{display:none}.label{margin:0;border:0;page-break-after:avoid;box-shadow:none}}'+
 '@media screen{.label{box-shadow:0 4px 22px rgba(0,0,0,.15)}}';
 const html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>Etiqueta '+safe(order.public_id)+' — AZZENA PARFUMS</title><style>'+css+'</style></head><body>'+
 '<div class="actions">Formato: '+preset.label+' · <button onclick="window.print()">IMPRIMIR ETIQUETA</button></div>'+
 '<main class="label"><div class="brand">AZZENA</div><div class="brand-sub">PARFUMS</div>'+
 '<div class="top"><div><div class="tiny">PEDIDO</div><div class="orderid">'+safe(order.public_id)+'</div></div>'+
 '<div class="tiny" style="text-align:right">'+safe(new Date(order.created_at).toLocaleString("pt-BR"))+'<br>'+preset.label+'</div></div>'+
 '<div class="section"><div class="label-title">CLIENTE / DESTINATÁRIO</div><div class="person">'+safe(order.customer_name)+
 '</div><div class="lines">Telefone: '+safe(order.customer_phone)+'</div></div>'+
 '<div class="section"><div class="label-title">'+addr.title+'</div><div class="lines">'+addr.lines.filter(Boolean).join("<br>")+'</div></div>'+
 '<div class="section"><div class="label-title">ITENS</div><table>'+list+'</table></div>'+
 '<div class="footer"><span>VALOR TOTAL</span><span>'+brl(order.total_cents)+'</span></div>'+
 '<div class="'+(pending?'warning':'paid')+'">'+(pending?'AGUARDANDO PAGAMENTO — NÃO ENTREGAR':
   order.payment_channel==='seller_cash'?'PAGO EM DINHEIRO · VENDA PRESENCIAL':
   order.payment_channel==='mercadopago'&&order.pickup_redeemed_at?
     'ENTREGA REGISTRADA · CÓDIGO AZZ UTILIZADO':
     'PAGO · EXIGIR CÓDIGO AZZ NO PAINEL ANTES DA ENTREGA')+
 '</div></main></body></html>';
 popup.document.open();popup.document.write(html);popup.document.close();popup.focus();return true;
}
