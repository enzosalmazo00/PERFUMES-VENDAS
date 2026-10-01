import {esc,money,option,table} from "./admin-api.js?v=20261001-0045";
export function shell(){
return `<nav class="tabs">
<button class="tab is-active" data-tab="visao">Visão geral</button>
<button class="tab" data-tab="perfumes">Perfumes / Body Splash</button>
<button class="tab" data-tab="rede">Vendedores/Cidades</button>
<button class="tab" data-tab="estoque">Estoques</button>
<button class="tab" data-tab="compras">Compras/Risco</button>
<button class="tab" data-tab="relatorios">Relatórios</button>
<button class="tab" data-tab="emergencia">Emergência</button>
</nav>
<section class="tab-panel" data-panel="visao"><div id="metrics" class="metrics"></div><div class="card"><p class="eyebrow">Alertas</p><h2>Estoque baixo</h2><div id="lowStock"></div></div></section>
<section class="tab-panel" data-panel="perfumes" hidden>
<div class="card"><p class="eyebrow">Catálogo</p><h2>Novo produto</h2>
<form id="productForm" class="form-grid">
<label>Nome<input name="name" required></label><label>Marca<input name="brand"></label>
<label>Tipo de produto<select name="product_type"><option value="perfume">Perfume</option><option value="body_splash">Body Splash</option></select></label>
<label>Categoria<select name="category"><option value="masculino">Masculino</option><option value="feminino">Feminino</option><option value="unissex">Unissex</option></select></label>
<label>Volume (mL)<input name="volume_ml" type="number" min="1" required></label>
<label>Preço venda (R$)<input name="price" type="number" min="0" step=".01" required></label><label>Preço promocional (R$)<input name="sale_price" type="number" min="0" step=".01"></label>
<label class="span2 product-image-field">Foto do produto<input name="image" id="productImage" type="file" accept="image/jpeg,image/png,image/webp" required><small>JPG, PNG ou WebP · até 10 MB</small><img id="productImagePreview" class="product-image-preview" alt="Prévia da foto do perfume" hidden></label>
<label class="span2">Resumo curto<textarea name="short_description" placeholder="Texto curto que aparece no destaque do produto"></textarea></label>
<label class="span2">Descrição completa<textarea name="description"></textarea></label>
<label class="span2">Composição<textarea name="composition"></textarea></label>
<label>Notas de topo<input name="top_notes" placeholder="Ex.: bergamota, limão, pimenta"></label>
<label>Notas de coração<input name="heart_notes" placeholder="Ex.: lavanda, íris, jasmim"></label>
<label>Notas de fundo<input name="base_notes" placeholder="Ex.: âmbar, baunilha, patchouli"></label>
<label class="checkline"><input type="checkbox" name="is_featured"> Produto em destaque</label>
<label class="checkline"><input type="checkbox" name="is_best_seller"> Marcar como mais vendido</label>
<button class="btn btn-primary">Cadastrar produto</button>
</form></div>

<div class="card"><p class="eyebrow">Produtos cadastrados</p><h2>Gerenciar catálogo</h2><p class="muted">Edite informações, notas olfativas, foto e preço. “Excluir” remove o card da loja sem apagar o histórico.</p><div id="products"></div></div>

<div class="card edit-product-card" id="editProductCard" hidden>
<p class="eyebrow">Edição</p><h2>Editar produto</h2>
<form id="editProductForm" class="form-grid">
<input type="hidden" name="id">
<label>Nome<input name="name" required></label><label>Marca<input name="brand"></label>
<label>Tipo de produto<select name="product_type"><option value="perfume">Perfume</option><option value="body_splash">Body Splash</option></select></label>
<label>Categoria<select name="category"><option value="masculino">Masculino</option><option value="feminino">Feminino</option><option value="unissex">Unissex</option></select></label>
<label>Volume (mL)<input name="volume_ml" type="number" min="1" required></label>
<label>Preço venda (R$)<input name="price" type="number" min="0" step=".01" required></label><label>Preço promocional (R$)<input name="sale_price" type="number" min="0" step=".01"></label>
<label class="span2 product-image-field">Trocar foto <small>(opcional)</small><input name="image" id="editProductImage" type="file" accept="image/jpeg,image/png,image/webp"><small>Se não escolher outra foto, a atual será mantida.</small><img id="editProductImagePreview" class="product-image-preview" alt="Foto atual do perfume" hidden></label>
<label class="span2">Resumo curto<textarea name="short_description"></textarea></label>
<label class="span2">Descrição completa<textarea name="description"></textarea></label>
<label class="span2">Composição<textarea name="composition"></textarea></label>
<label>Notas de topo<input name="top_notes" placeholder="Separadas por vírgula"></label>
<label>Notas de coração<input name="heart_notes" placeholder="Separadas por vírgula"></label>
<label>Notas de fundo<input name="base_notes" placeholder="Separadas por vírgula"></label>
<label class="checkline"><input type="checkbox" name="is_featured"> Produto em destaque</label>
<label class="checkline"><input type="checkbox" name="is_best_seller"> Mais vendido</label>
<label class="checkline"><input type="checkbox" name="is_active"> Visível na loja</label>
<div class="span2 edit-actions"><button class="btn btn-primary" type="submit">Salvar alterações</button><button class="btn" type="button" id="cancelEditProduct">Cancelar</button></div>
</form></div>
</section>
<section class="tab-panel" data-panel="rede" hidden>
<div class="grid2">
  <div class="card"><p class="eyebrow">Cobertura</p><h2>Nova cidade</h2><form id="cityForm"><label>Cidade<input name="city_name" required placeholder="Ex.: Pedro Juan Caballero"></label><label>Estado/Departamento<input name="state_name" placeholder="Ex.: Amambay"></label><label>País<select name="country_code"><option value="BR">Brasil</option><option value="PY">Paraguai</option></select></label><button class="btn btn-primary">Cadastrar cidade</button></form></div>
  <div class="card"><p class="eyebrow">Equipe</p><h2>Novo vendedor</h2><form id="sellerForm"><label>Nome<input name="name" required></label><label>E-mail de acesso<input name="email" type="email"></label><label>WhatsApp<input name="whatsapp_number" required></label><label>Foto (URL)<input name="avatar_url"></label><label>Cidade<select name="city_id" id="sellerCity"></select></label><label><input type="checkbox" name="can_toggle"> Pode usar emergência</label><button class="btn btn-primary">Cadastrar vendedor</button></form></div>
</div>
<div class="card"><p class="eyebrow">Cobertura cadastrada</p><h2>Cidades</h2><div id="cities"></div></div>
<div class="card"><p class="eyebrow">Equipe cadastrada</p><h2>Vendedores</h2><div id="sellers"></div></div>
</section>
<section class="tab-panel" data-panel="estoque" hidden><div class="grid2"><div class="card"><p class="eyebrow">Local</p><h2>Novo estoque</h2><form id="locationForm"><label>Nome<input name="name" required></label><label>Cidade<select name="city_id" id="locationCity"></select></label><label>Vendedor<select name="seller_id" id="locationSeller"></select></label><button class="btn btn-primary">Criar estoque</button></form></div>
<div class="card"><p class="eyebrow">Regulador auditável</p><h2>Movimentar estoque</h2><form id="adjustForm"><label>Estoque<select name="location_id" id="adjustLocation"></select></label><label>Produto<select name="product_id" id="adjustProduct"></select></label><label>Quantidade (+ entrada / − saída)<input name="qty" type="number" required></label><label>Motivo<select name="reason"><option value="restock">Reposição</option><option value="breakage">Quebra</option><option value="damage">Avaria</option><option value="loss">Perda</option><option value="gift">Brinde</option><option value="road_loss">Perda na estrada</option><option value="inventory_count">Contagem</option><option value="return">Devolução</option><option value="other">Outro</option></select></label><label>Impacto financeiro (R$)<input name="impact" type="number" min="0" step=".01"></label><label>Justificativa<textarea name="note"></textarea></label><button class="btn btn-primary">Registrar</button></form></div></div><div class="card" id="inventory"></div></section>
<section class="tab-panel" data-panel="compras" hidden><div class="grid2"><div class="card"><p class="eyebrow">Privado</p><h2>Novo fornecedor</h2><form id="supplierForm"><label>Nome<input name="name" required></label><label>Contato<input name="contact"></label><label>Telefone<input name="phone"></label><label>Notas<textarea name="notes"></textarea></label><button class="btn btn-primary">Salvar</button></form></div>
<div class="card"><p class="eyebrow">Entrada</p><h2>Novo lote</h2><form id="lotForm"><label>Fornecedor<select name="supplier_id" id="lotSupplier"></select></label><label>Destino<select name="location_id" id="lotLocation"></select></label><label>Produto<select name="product_id" id="lotProduct"></select></label><label>Quantidade<input name="qty" type="number" min="1" required></label><label>Custo unitário (R$)<input name="cost" type="number" min="0" step=".01" required></label><label>Risco<select name="risk"><option value="">Sem risco</option><option value="travel">Viagem</option><option value="seizure">Apreensão</option><option value="damage">Dano</option><option value="loss">Perda</option><option value="other">Outro</option></select></label><label>Valor do risco (R$)<input name="risk_value" type="number" min="0" step=".01"></label><label>Nota<textarea name="risk_note"></textarea></label><button class="btn btn-primary">Registrar lote + estoque</button></form></div></div></section>
<section class="tab-panel" data-panel="relatorios" hidden><div class="card"><p class="eyebrow">Financeiro privado</p><h2>Relatórios</h2><div class="form-grid"><label>De<input type="date" id="from"></label><label>Até<input type="date" id="to"></label><label>Vendedor<select id="reportSeller"></select></label><label>Produto<select id="reportProduct"></select></label><label>Cidade<select id="reportCity"></select></label></div><button class="btn btn-primary" id="runReport">Gerar relatório</button></div><div id="reportMetrics" class="metrics"></div><div class="card" id="reportMoves"></div><div class="card" id="reportRisks"></div></section>
<section class="tab-panel" data-panel="emergencia" hidden><div class="grid2"><div class="card danger-card"><p class="eyebrow">Emergência</p><h2>Retirar loja do ar</h2><label>Categoria<select id="outageKind"><option value="stock_issue">Problema de estoque</option><option value="inventory_count">Contagem de estoque</option><option value="maintenance">Manutenção/erro</option><option value="no_seller">Sem vendedor</option><option value="operational_pause">Pausa operacional</option><option value="permanent_closure">Encerramento definitivo</option></select></label><label>Justificativa<textarea id="outageReason"></textarea></label><label>Mensagem pública<textarea id="publicMessage"></textarea></label><button class="btn btn-danger" id="disableSite">Desativar loja</button></div><div class="card"><p class="eyebrow">Status</p><div class="status-line"><span class="status-dot" id="statusDot"></span><strong id="statusText">—</strong></div><p id="statusDetail" class="muted"></p><label>Nota para reativação<textarea id="restoreReason"></textarea></label><button class="btn btn-primary" id="enableSite">Colocar online</button></div></div></section>`;}
export function renderDashboard(d){
document.querySelector("#metrics").innerHTML=[["Produtos",d.products.length],["Cidades",d.cities.filter(x=>x.is_active).length],["Vendedores",d.sellers.filter(x=>x.is_active).length],["Estoques",d.locations.length],["Alertas",d.inventory.filter(x=>x.low_stock).length]].map(x=>'<div class="metric"><span>'+x[0]+'</span><strong>'+x[1]+'</strong></div>').join("");
const low=d.inventory.filter(x=>x.low_stock);
document.querySelector("#lowStock").innerHTML=table([["Produto",r=>esc(r.product_name)],["Local",r=>esc(r.location_name)],["Saldo",r=>'<span class="badge-warn">⚠ '+r.quantity+'</span>'],["Limite",r=>r.low_stock_threshold]],low);
document.querySelector("#products").innerHTML=table([
["Foto",r=>r.image_url?'<img class="product-thumb" src="'+esc(r.image_url)+'" alt="">':'—'],
["Produto",r=>'<strong>'+esc(r.name)+'</strong><br><span class="muted">'+esc(r.brand||"—")+' · '+r.volume_ml+' mL</span>'],
["Tipo",r=>r.product_type==="body_splash"?"Body Splash":"Perfume"],
["Categoria",r=>esc(r.category)],
["Preço",r=>money(r.sale_price_cents??r.price_cents)],
["Status",r=>r.is_active?'<span class="badge-ok">Ativo</span>':'<span class="badge-off">Fora da loja</span>'],
["Ações",r=>'<div class="row-actions"><button class="btn btn-small" type="button" data-edit-product="'+esc(r.id)+'">Editar</button>'+(r.is_active?'<button class="btn btn-small btn-danger-soft" type="button" data-delete-product="'+esc(r.id)+'">Excluir</button>':'<button class="btn btn-small btn-restore" type="button" data-restore-product="'+esc(r.id)+'">Restaurar</button>')+'</div>']
],d.products);
document.querySelector("#cities").innerHTML=table([["Cidade",r=>esc(r.city_name)],["Estado/Departamento",r=>esc(r.state_name||"—")],["País",r=>r.country_code==="PY"?"Paraguai":"Brasil"],["Status",r=>r.is_active?'<span class="badge-ok">Ativa</span>':'<span class="badge-off">Inativa</span>']],d.cities);
document.querySelector("#sellers").innerHTML=table([["Nome",r=>esc(r.name)],["E-mail",r=>esc(r.email||"—")],["WhatsApp",r=>esc(r.whatsapp_number)],["Emergência",r=>r.can_toggle_site_emergency?"Liberada":"Bloqueada"]],d.sellers);
document.querySelector("#inventory").innerHTML=table([["Produto",r=>esc(r.product_name)],["Local",r=>esc(r.location_name)],["Cidade",r=>esc(r.city_name||"—")],["Vendedor",r=>esc(r.seller_name||"—")],["Saldo",r=>r.low_stock?'<span class="badge-warn">⚠ '+r.quantity+'</span>':r.quantity],["Limite",r=>r.low_stock_threshold]],d.inventory);
document.querySelector("#sellerCity").innerHTML=option(d.cities,"id","city_name","Sem cidade");
document.querySelector("#locationCity").innerHTML=option(d.cities,"id","city_name","Sem cidade");
document.querySelector("#locationSeller").innerHTML=option(d.sellers,"id","name","Sem vendedor");
document.querySelector("#adjustLocation").innerHTML=option(d.locations,"id","name");
document.querySelector("#adjustProduct").innerHTML=option(d.products,"id",x=>x.name+" · "+x.volume_ml+" mL");
document.querySelector("#lotLocation").innerHTML=option(d.locations,"id","name");
document.querySelector("#lotProduct").innerHTML=option(d.products,"id",x=>x.name+" · "+x.volume_ml+" mL");
document.querySelector("#reportSeller").innerHTML=option(d.sellers,"id","name","Todos");
document.querySelector("#reportProduct").innerHTML=option(d.products,"id",x=>x.name+" · "+x.volume_ml+" mL","Todos");
document.querySelector("#reportCity").innerHTML=option(d.cities,"id","city_name","Todas");
}