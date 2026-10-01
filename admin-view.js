import {esc,money,option,table} from "./admin-api.js?v=20261001-password1";
export function shell(){
return `<nav class="tabs">
<button class="tab is-active" data-tab="visao">Visão geral</button>
<button class="tab" data-tab="perfumes">Perfumes / Body Splash</button>
<button class="tab" data-tab="rede">Vendedores/Cidades</button>
<button class="tab" data-tab="estoque">Estoques</button>
<button class="tab" data-tab="pedidos">Pedidos/Envios</button>
<button class="tab" data-tab="compras">Compras/Risco</button>
<button class="tab" data-tab="relatorios">Relatórios</button>
<button class="tab" data-tab="emergencia">Emergência</button>
</nav>
<section class="tab-panel" data-panel="visao"><div id="metrics" class="metrics"></div><div class="card"><p class="eyebrow">Alertas</p><h2>Estoque baixo</h2><div id="lowStock"></div></div></section>
<section class="tab-panel" data-panel="perfumes" hidden>
<div class="card"><p class="eyebrow">Catálogo</p><h2>Novo produto</h2>
<form id="productForm" class="form-grid">
<label>Pesquisar marca<input class="catalog-brand-search" type="search" placeholder="Ex.: Dior, Lattafa, Chanel..." autocomplete="off"><small class="catalog-count-hint">Carregando catálogo...</small></label>
<label>Marca<select name="brand_preset" class="catalog-brand-select" required><option value="">Carregando marcas...</option></select></label>
<label class="catalog-custom-brand span2" hidden>Outra marca<input name="brand_custom" placeholder="Digite o nome da marca" autocomplete="off"></label>
<label class="span2">Perfume ou fragrância da marca<select name="fragrance_preset" class="catalog-fragrance-select"><option value="">Escolha uma marca primeiro</option></select></label><div class="span2 catalog-reference-note" role="status">Ao escolher uma fragrância com ficha oficial validada, os dados serão preenchidos automaticamente.</div>
<label class="span2">Nome do produto<input name="name" required placeholder="Preenchido automaticamente; você pode editar"><small>Ao selecionar uma fragrância, o nome aparece aqui. Para outra, digite o nome.</small></label>
<label>Tipo de produto<select name="product_type"><option value="perfume">Perfume</option><option value="body_splash">Body Splash</option></select></label>
<label>Categoria<select name="category" required><option value="">Selecione a categoria</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option><option value="unissex">Unissex</option></select></label>
<label>Volume (mL)<select name="volume_preset" class="catalog-volume-select" required><option value="">Selecione o volume</option></select><small>Confira o tamanho na embalagem antes de anunciar.</small></label>
<label class="catalog-custom-volume" hidden>Outro volume (mL)<input name="custom_volume_ml" type="number" min="1" max="10000" step="1" placeholder="Ex.: 85"></label>
<label>Preço venda (R$)<input name="price" type="number" min="0" step=".01" required></label><label>Preço promocional (R$)<input name="sale_price" type="number" min="0" step=".01"></label>
<label>Peso embalado (kg)<input name="weight_kg" type="number" min=".001" step=".001" value=".500" required></label>
<label>Largura (cm)<input name="width_cm" type="number" min="1" step=".1" value="12" required></label>
<label>Altura (cm)<input name="height_cm" type="number" min="1" step=".1" value="15" required></label>
<label>Comprimento (cm)<input name="length_cm" type="number" min="1" step=".1" value="8" required></label>
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
<label>Pesquisar marca<input class="catalog-brand-search" type="search" placeholder="Ex.: Dior, Lattafa, Chanel..." autocomplete="off"><small class="catalog-count-hint">Carregando catálogo...</small></label>
<label>Marca<select name="brand_preset" class="catalog-brand-select" required><option value="">Carregando marcas...</option></select></label>
<label class="catalog-custom-brand span2" hidden>Outra marca<input name="brand_custom" placeholder="Digite o nome da marca" autocomplete="off"></label>
<label class="span2">Perfume ou fragrância da marca<select name="fragrance_preset" class="catalog-fragrance-select"><option value="">Escolha uma marca primeiro</option></select></label><div class="span2 catalog-reference-note" role="status">Ao escolher uma fragrância com ficha oficial validada, os dados serão preenchidos automaticamente.</div>
<label class="span2">Nome do produto<input name="name" required placeholder="Preenchido automaticamente; você pode editar"><small>Ao selecionar uma fragrância, o nome aparece aqui. Para outra, digite o nome.</small></label>
<label>Tipo de produto<select name="product_type"><option value="perfume">Perfume</option><option value="body_splash">Body Splash</option></select></label>
<label>Categoria<select name="category" required><option value="">Selecione a categoria</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option><option value="unissex">Unissex</option></select></label>
<label>Volume (mL)<select name="volume_preset" class="catalog-volume-select" required><option value="">Selecione o volume</option></select><small>Confira o tamanho na embalagem antes de anunciar.</small></label>
<label class="catalog-custom-volume" hidden>Outro volume (mL)<input name="custom_volume_ml" type="number" min="1" max="10000" step="1" placeholder="Ex.: 85"></label>
<label>Preço venda (R$)<input name="price" type="number" min="0" step=".01" required></label><label>Preço promocional (R$)<input name="sale_price" type="number" min="0" step=".01"></label>
<label>Peso embalado (kg)<input name="weight_kg" type="number" min=".001" step=".001" required></label>
<label>Largura (cm)<input name="width_cm" type="number" min="1" step=".1" required></label>
<label>Altura (cm)<input name="height_cm" type="number" min="1" step=".1" required></label>
<label>Comprimento (cm)<input name="length_cm" type="number" min="1" step=".1" required></label>
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
  <div class="card"><p class="eyebrow">Equipe</p><h2>Pré-cadastrar vendedor</h2><p class="muted">Opcional: informe o e-mail do vendedor e peça que ele crie a conta no painel dele. Para novas solicitações, use Aprovar abaixo.</p><form id="sellerForm"><label>Nome<input name="name" required></label><label>E-mail de acesso<input name="email" type="email"></label><label>WhatsApp<input name="whatsapp_number" required></label><label>Foto (URL)<input name="avatar_url"></label><label>Bio<textarea name="bio" placeholder="Apresentação curta do vendedor"></textarea></label><label>Cidade<select name="city_id" id="sellerCity"></select></label><label><input type="checkbox" name="can_toggle"> Pode usar emergência</label><button class="btn btn-primary">Cadastrar vendedor</button></form></div>
</div>
<div class="card"><p class="eyebrow">Cobertura cadastrada</p><h2>Cidades</h2><div id="cities"></div></div>
<div class="card"><p class="eyebrow">Aguardando sua autorização</p><h2>Solicitações de vendedores</h2>
<p class="muted">O vendedor cria a própria conta em <a href="vendedor.html" target="_blank" rel="noopener">vendedor.html</a> e confirma o e-mail. Você aprova ou recusa o acesso aqui. A senha é criada e guardada pelo próprio vendedor.</p>
<div id="sellerApplications"></div></div>
<div class="card"><p class="eyebrow">Equipe cadastrada</p><h2>Vendedores</h2><div id="sellers"></div></div>
<div class="card edit-product-card" id="editSellerCard" hidden>
<p class="eyebrow">Edição</p><h2>Editar vendedor</h2>
<form id="editSellerForm" class="form-grid">
<input type="hidden" name="id">
<label>Nome<input name="name" required></label>
<label>E-mail de acesso<input name="email" type="email"></label>
<label>WhatsApp<input name="whatsapp_number" required></label>
<label>Foto (URL)<input name="avatar_url"></label>
<label class="span2">Bio<textarea name="bio" placeholder="Apresentação curta do vendedor"></textarea></label>
<label>Cidade<select name="city_id" id="editSellerCity"></select></label>
<label class="checkline"><input type="checkbox" name="can_toggle"> Pode usar emergência</label>
<label class="checkline"><input type="checkbox" name="is_active"> Vendedor ativo</label>
<div class="span2 edit-actions"><button class="btn btn-primary" type="submit">Salvar alterações</button><button class="btn" type="button" id="cancelEditSeller">Cancelar</button></div>
</form>
</div>
</section>
<section class="tab-panel" data-panel="estoque" hidden><div class="grid2"><div class="card"><p class="eyebrow">Local</p><h2>Novo estoque</h2><form id="locationForm"><label>Nome<input name="name" required></label><label>Cidade<select name="city_id" id="locationCity"></select></label><label>Vendedor<select name="seller_id" id="locationSeller"></select></label><button class="btn btn-primary">Criar estoque</button></form></div>
<div class="card"><p class="eyebrow">Regulador auditável</p><h2>Movimentar estoque</h2><form id="adjustForm"><label>Estoque<select name="location_id" id="adjustLocation"></select></label><label>Produto<select name="product_id" id="adjustProduct"></select></label><label>Quantidade (+ entrada / − saída)<input name="qty" type="number" required></label><label>Motivo<select name="reason"><option value="restock">Reposição</option><option value="breakage">Quebra</option><option value="damage">Avaria</option><option value="loss">Perda</option><option value="gift">Brinde</option><option value="road_loss">Perda na estrada</option><option value="inventory_count">Contagem</option><option value="return">Devolução</option><option value="other">Outro</option></select></label><label>Impacto financeiro (R$)<input name="impact" type="number" min="0" step=".01"></label><label>Justificativa<textarea name="note"></textarea></label><button class="btn btn-primary">Registrar</button></form></div></div><div class="card" id="inventory"></div></section>
<section class="tab-panel" data-panel="pedidos" hidden>
<div class="grid2">
  <div class="card"><p class="eyebrow">Frete</p><h2>Configuração de envios</h2>
    <form id="shippingSettingsForm">
      <label>CEP de origem<input name="origin_postal_code" inputmode="numeric" maxlength="9" placeholder="00000-000"></label>
      <label>Ambiente<select name="provider_environment"><option value="sandbox">Sandbox / testes</option><option value="production">Produção</option></select></label>
      <label class="checkline"><input type="checkbox" name="shipping_enabled"> Liberar cálculo de frete no site</label>
      <label>Mensagem ao cliente<textarea name="public_note">Envios disponíveis para o Estado de São Paulo. O rastreio detalhado será configurado em uma próxima etapa.</textarea></label>
      <button class="btn btn-primary">Salvar configuração</button>
    </form>
  </div>
  <div class="card"><p class="eyebrow">Integração</p><h2>Status do Melhor Envio</h2>
    <div id="shippingProviderStatus" class="shipping-admin-status"></div>
    <div class="tracking-admin-note"><strong>Rastreio automático</strong><p>A estrutura do banco já possui campos para código e link de rastreio. A integração automática de rastreamento será estudada e implementada em uma próxima etapa.</p></div>
  </div>
</div>
<div class="card"><p class="eyebrow">Pedidos</p><h2>Pedidos de clientes</h2><div id="orders"></div></div>
</section>
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
["Envio",r=>Number(r.weight_kg||0).toFixed(3)+" kg · "+Number(r.width_cm||0)+"×"+Number(r.height_cm||0)+"×"+Number(r.length_cm||0)+" cm"],
["Status",r=>r.is_active?'<span class="badge-ok">Ativo</span>':'<span class="badge-off">Fora da loja</span>'],
["Ações",r=>'<div class="row-actions"><button class="btn btn-small" type="button" data-edit-product="'+esc(r.id)+'">Editar</button>'+(r.is_active?'<button class="btn btn-small btn-danger-soft" type="button" data-delete-product="'+esc(r.id)+'">Excluir</button>':'<button class="btn btn-small btn-restore" type="button" data-restore-product="'+esc(r.id)+'">Restaurar</button>')+'</div>']
],d.products);
document.querySelector("#cities").innerHTML=table([["Cidade",r=>esc(r.city_name)],["Estado/Departamento",r=>esc(r.state_name||"—")],["País",r=>r.country_code==="PY"?"Paraguai":"Brasil"],["Status",r=>r.is_active?'<span class="badge-ok">Ativa</span>':'<span class="badge-off">Inativa</span>']],d.cities);
const pendingSellers=d.sellers.filter(r=>r.approval_status==="pending");
document.querySelector("#sellerApplications").innerHTML=pendingSellers.length?table([
["Solicitante",r=>'<strong>'+esc(r.name)+'</strong><br><span class="muted">'+esc(r.email||"—")+'</span>'],
["WhatsApp",r=>esc(r.whatsapp_number)],
["Data",r=>r.created_at?new Date(r.created_at).toLocaleDateString("pt-BR"):"—"],
["Ações",r=>'<div class="row-actions"><button class="btn btn-small btn-approve-seller" type="button" data-review-seller="'+esc(r.id)+'" data-decision="approve">Aprovar</button><button class="btn btn-small btn-danger-soft" type="button" data-review-seller="'+esc(r.id)+'" data-decision="reject">Recusar</button></div>']
],pendingSellers):'<p class="muted">Nenhuma solicitação pendente. Compartilhe o link do painel com seus vendedores.</p>';
document.querySelector("#sellers").innerHTML=table([
["Nome",r=>'<strong>'+esc(r.name)+'</strong>'],
["E-mail",r=>esc(r.email||"—")],
["WhatsApp",r=>esc(r.whatsapp_number)],
["Cidade",r=>{const id=(r.city_ids||[])[0];const c=d.cities.find(x=>x.id===id);return esc(c?.city_name||"—")}],
["Status",r=>r.approval_status==="pending"?'<span class="badge-warn">Aguardando aprovação</span>':r.approval_status==="rejected"?'<span class="badge-off">Recusado</span>':r.is_active?'<span class="badge-ok">Aprovado</span>':'<span class="badge-off">Pausado</span>'],
["Login",r=>r.auth_user_id?"Conta vinculada":'<span class="muted">Aguardando primeiro acesso</span>'],
["Emergência",r=>r.can_toggle_site_emergency?"Liberada":"Bloqueada"],
["Ações",r=>'<div class="row-actions"><button class="btn btn-small" type="button" data-edit-seller="'+esc(r.id)+'">Editar</button></div>']
],d.sellers);
const orderStatusLabels={pending:"Recebido",preparing:"Preparando",ready:"Pronto",shipped:"Enviado",delivered:"Entregue",cancelled:"Cancelado"};
const paymentLabels={pending:"Pendente",approved:"Aprovado",rejected:"Recusado",cancelled:"Cancelado",refunded:"Estornado"};
document.querySelector("#orders").innerHTML=table([
["Pedido",r=>'<strong>'+esc(r.public_id)+'</strong><br><span class="muted">'+new Date(r.created_at).toLocaleString("pt-BR")+'</span>'],
["Cliente",r=>'<strong>'+esc(r.customer_name)+'</strong><br><span class="muted">'+esc(r.customer_phone)+'</span>'],
["Entrega",r=>{
 if(r.delivery_method==="shipping")return esc(r.shipping_city||"—")+"/"+esc(r.shipping_state||"")+" · "+esc(r.shipping_carrier||"—")+" · "+money(r.shipping_price_cents);
 const loc=r.pickup_location_snapshot||{};
 const owner=d.sellers.find(x=>x.id===r.seller_id);
 return "Retirada com "+esc(owner?.name||"Vendedor")+(loc.street?" · "+esc(loc.street)+", "+esc(loc.street_number||"")+" · "+esc(loc.city||"")+"/"+esc(loc.state||""):"");
}],
["Total",r=>money(r.total_cents)],
["Pagamento",r=>'<select class="admin-inline-select" data-order-payment="'+esc(r.id)+'">'+["pending","approved","rejected","cancelled","refunded"].map(x=>'<option value="'+x+'" '+(r.payment_status===x?"selected":"")+'>'+paymentLabels[x]+'</option>').join("")+'</select>'],
["Pedido",r=>'<select class="admin-inline-select" data-order-fulfillment="'+esc(r.id)+'">'+["pending","preparing","ready","shipped","delivered","cancelled"].map(x=>'<option value="'+x+'" '+(r.fulfillment_status===x?"selected":"")+'>'+orderStatusLabels[x]+'</option>').join("")+'</select>'],
["Ações",r=>'<div class="row-actions"><button class="btn btn-small" type="button" data-save-order="'+esc(r.id)+'">Salvar status</button><a class="btn btn-small" target="_blank" rel="noopener" href="https://wa.me/'+String(r.customer_phone||"").replace(/\\D/g,"")+'?text='+encodeURIComponent("Olá "+r.customer_name+", estamos entrando em contato sobre o pedido "+r.public_id+".")+'">WhatsApp</a></div>']
],d.orders||[]);
const ss=d.shipping_settings||{};
const sf=document.querySelector("#shippingSettingsForm");
if(sf){sf.elements.origin_postal_code.value=ss.origin_postal_code||"";sf.elements.provider_environment.value=ss.provider_environment||"sandbox";sf.elements.shipping_enabled.checked=!!ss.shipping_enabled;sf.elements.public_note.value=ss.public_note||"Envios disponíveis para o Estado de São Paulo."}
document.querySelector("#shippingProviderStatus").innerHTML='<div class="status-line"><span class="status-dot '+(d.shipping_provider_configured?"online":"offline")+'"></span><strong>'+(d.shipping_provider_configured?"Token do Melhor Envio configurado":"Token do Melhor Envio pendente")+'</strong></div><p class="muted">CEP de origem: '+esc(ss.origin_postal_code||"não configurado")+' · Ambiente: '+esc(ss.provider_environment||"sandbox")+' · Envios: '+(ss.shipping_enabled?"liberados":"bloqueados")+'</p>';
document.querySelector("#inventory").innerHTML=table([["Produto",r=>esc(r.product_name)],["Local",r=>esc(r.location_name)],["Cidade",r=>esc(r.city_name||"—")],["Vendedor",r=>esc(r.seller_name||"—")],["Saldo",r=>r.low_stock?'<span class="badge-warn">⚠ '+r.quantity+'</span>':r.quantity],["Limite",r=>r.low_stock_threshold]],d.inventory);
document.querySelector("#sellerCity").innerHTML=option(d.cities.filter(x=>x.is_active),"id","city_name","Sem cidade");
document.querySelector("#editSellerCity").innerHTML=option(d.cities.filter(x=>x.is_active),"id","city_name","Sem cidade");
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