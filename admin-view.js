import {esc,money,option,table} from "./admin-api.js?v=20261001-password1";
export function shell(){
return `<nav class="tabs" aria-label="Áreas da administração">
<button class="tab is-active" data-tab="visao">Visão da loja</button>
<button class="tab" data-tab="compras">Compras e fornecedores</button>
<button class="tab" data-tab="estoque">Estoque e movimentações</button>
<button class="tab" data-tab="perfumes">Produtos e preços</button>
<button class="tab" data-tab="pedidos">Pedidos e pagamentos</button>
<button class="tab" data-tab="caixa">Caixa presencial</button>
<button class="tab" data-tab="rede">Vendedores e regiões</button>
<button class="tab" data-tab="relatorios">Resultados e relatórios</button>
<button class="tab" data-tab="emergencia">Segurança e emergência</button>
</nav>
<div class="admin-action-overlay" id="productActionOverlay" hidden aria-live="assertive" aria-busy="true">
 <div class="admin-action-card" role="status">
  <div class="admin-action-spinner" aria-hidden="true"></div>
  <div class="admin-action-success" aria-hidden="true">✓</div>
  <p class="eyebrow">Cadastro de produto</p><h2 id="productActionTitle">Cadastrando produto</h2>
  <p id="productActionMessage">Aguarde. Estamos salvando o produto e a foto com segurança.</p>
 </div>
</div>
<div class="admin-confirm-overlay" id="hardDeleteOverlay" hidden role="dialog" aria-modal="true" aria-labelledby="hardDeleteTitle">
 <div class="admin-confirm-card">
  <p class="eyebrow danger-eyebrow">Ação irreversível</p><h2 id="hardDeleteTitle">Excluir definitivamente?</h2>
  <p id="hardDeleteText"></p>
  <div class="hard-delete-warning"><strong>Esta opção apaga o cadastro permanentemente.</strong><span>Se existir histórico de compra, estoque, reserva ou avaliação, o servidor recusará a exclusão para preservar a rastreabilidade.</span></div>
  <label>Para confirmar, digite <strong>EXCLUIR</strong><input id="hardDeleteConfirmText" autocomplete="off" spellcheck="false" placeholder="EXCLUIR"></label>
  <div class="confirm-actions"><button class="btn" type="button" id="cancelHardDelete">Cancelar</button><button class="btn btn-danger-solid" type="button" id="confirmHardDelete" disabled>Excluir definitivamente</button></div>
 </div>
</div>
<section class="tab-panel" data-panel="visao"><div id="metrics" class="metrics"></div><div class="card"><p class="eyebrow">Alertas</p><h2>Estoque baixo</h2><div id="lowStock"></div></div></section>
<section class="tab-panel" data-panel="perfumes" hidden>
<div class="card"><p class="eyebrow">Catálogo</p><h2>Novo produto</h2>
<form id="productForm" class="form-grid">
<label class="span2 catalog-global-label">🔎 Buscar perfume, linha ou marca
<input class="catalog-global-search" type="search" placeholder="Ex.: Ferrari Black, Club de Nuit, Khamrah, 9PM..." autocomplete="off" aria-label="Pesquisar perfume ou marca">
<small>Pesquise o nome completo ou apenas parte dele. Clique no resultado para preencher o cadastro.</small></label>
<div class="catalog-global-results span2" role="group" aria-label="Resultados da busca de perfumes" hidden></div>
<label>Ou filtre pela marca<input class="catalog-brand-search" type="search" placeholder="Ex.: Dior, Lattafa, Chanel..." autocomplete="off"><small class="catalog-count-hint">Carregando catálogo...</small></label>
<label>Marca<select name="brand_preset" class="catalog-brand-select" required><option value="">Carregando marcas...</option></select></label>
<label class="catalog-custom-brand span2" hidden>Outra marca<input name="brand_custom" placeholder="Digite o nome da marca" autocomplete="off"></label>
<label class="span2">Perfume ou fragrância da marca<select name="fragrance_preset" class="catalog-fragrance-select"><option value="">Escolha uma marca primeiro</option></select></label><div class="span2 catalog-reference-note" role="status">Ao escolher uma fragrância com ficha oficial validada, os dados serão preenchidos automaticamente.</div>
<label class="span2">Nome do produto<input name="name" required placeholder="Preenchido automaticamente; você pode editar"><small>Ao selecionar uma fragrância, o nome aparece aqui. Para outra, digite o nome.</small></label>
<label>Tipo de produto<select name="product_type"><option value="perfume">Perfume</option><option value="body_splash">Body Splash</option></select></label>
<label>Categoria<select name="category" required><option value="">Selecione a categoria</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option><option value="unissex">Unissex</option></select></label>
<label>Volume (mL)<select name="volume_preset" class="catalog-volume-select" required><option value="">Selecione o volume</option></select><small>Confira o tamanho na embalagem antes de anunciar.</small></label>
<label class="catalog-custom-volume" hidden>Outro volume (mL)<input name="custom_volume_ml" type="number" min="1" max="10000" step="1" placeholder="Ex.: 85"></label>
<label>Preço venda (R$)<input name="price" type="number" min="0" step=".01" required></label><label>Preço promocional (R$)<input name="sale_price" type="number" min="0" step=".01"></label><label>Desconto máximo do vendedor (%)<input name="max_discount_percent" type="number" min="0" max="100" step=".01" value="0" required><small>Limite para vendas presenciais em dinheiro. Acima desse valor, o servidor recusa a venda.</small></label>
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
<button class="btn btn-primary" id="productSubmit" type="submit">Cadastrar produto</button>
</form></div>

<div class="card"><p class="eyebrow">Produtos cadastrados</p><h2>Gerenciar catálogo</h2><p class="muted">Edite informações, notas olfativas, foto e preço. “Remover da loja” desativa o produto e preserva todo o histórico. “Excluir definitivamente” só é permitido quando não existe histórico vinculado.</p><div id="products"></div></div>

<div class="card edit-product-card" id="editProductCard" hidden>
<p class="eyebrow">Edição</p><h2>Editar produto</h2>
<form id="editProductForm" class="form-grid">
<input type="hidden" name="id">
<label class="span2 catalog-global-label">🔎 Buscar perfume, linha ou marca
<input class="catalog-global-search" type="search" placeholder="Ex.: Ferrari Black, Club de Nuit, Khamrah, 9PM..." autocomplete="off" aria-label="Pesquisar perfume ou marca">
<small>Pesquise o nome completo ou apenas parte dele. Clique no resultado para preencher o cadastro.</small></label>
<div class="catalog-global-results span2" role="group" aria-label="Resultados da busca de perfumes" hidden></div>
<label>Ou filtre pela marca<input class="catalog-brand-search" type="search" placeholder="Ex.: Dior, Lattafa, Chanel..." autocomplete="off"><small class="catalog-count-hint">Carregando catálogo...</small></label>
<label>Marca<select name="brand_preset" class="catalog-brand-select" required><option value="">Carregando marcas...</option></select></label>
<label class="catalog-custom-brand span2" hidden>Outra marca<input name="brand_custom" placeholder="Digite o nome da marca" autocomplete="off"></label>
<label class="span2">Perfume ou fragrância da marca<select name="fragrance_preset" class="catalog-fragrance-select"><option value="">Escolha uma marca primeiro</option></select></label><div class="span2 catalog-reference-note" role="status">Ao escolher uma fragrância com ficha oficial validada, os dados serão preenchidos automaticamente.</div>
<label class="span2">Nome do produto<input name="name" required placeholder="Preenchido automaticamente; você pode editar"><small>Ao selecionar uma fragrância, o nome aparece aqui. Para outra, digite o nome.</small></label>
<label>Tipo de produto<select name="product_type"><option value="perfume">Perfume</option><option value="body_splash">Body Splash</option></select></label>
<label>Categoria<select name="category" required><option value="">Selecione a categoria</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option><option value="unissex">Unissex</option></select></label>
<label>Volume (mL)<select name="volume_preset" class="catalog-volume-select" required><option value="">Selecione o volume</option></select><small>Confira o tamanho na embalagem antes de anunciar.</small></label>
<label class="catalog-custom-volume" hidden>Outro volume (mL)<input name="custom_volume_ml" type="number" min="1" max="10000" step="1" placeholder="Ex.: 85"></label>
<label>Preço venda (R$)<input name="price" type="number" min="0" step=".01" required></label><label>Preço promocional (R$)<input name="sale_price" type="number" min="0" step=".01"></label><label>Desconto máximo do vendedor (%)<input name="max_discount_percent" type="number" min="0" max="100" step=".01" value="0" required><small>Limite para vendas presenciais em dinheiro. Acima desse valor, o servidor recusa a venda.</small></label>
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
<section class="tab-panel" data-panel="estoque" hidden>
  <div class="admin-intro"><p class="eyebrow">OPERAÇÃO DIÁRIA</p><h2>Estoque e movimentações</h2><p>Escolha entrada ou saída clicando no botão. Saídas sem venda exigem motivo e justificativa, e todas as movimentações ficam no histórico.</p></div>
  <div class="grid2">
    <div class="card"><p class="eyebrow">PASSO 1</p><h2>Cadastrar local de estoque</h2>
      <p class="muted">Ex.: depósito, vitrine, loja física ou estoque de um vendedor.</p>
      <form id="locationForm">
        <label>Nome do estoque<input name="name" required maxlength="110" placeholder="Ex.: Depósito principal"></label>
        <label>Cidade ou região<select name="city_id" id="locationCity"></select></label>
        <label>Vendedor responsável<select name="seller_id" id="locationSeller"></select></label>
        <button class="btn btn-primary" type="submit">Criar local de estoque</button>
      </form>
    </div>
    <div class="card"><p class="eyebrow">PASSO 2</p><h2>Entrada ou saída manual</h2>
      <p class="muted">Para compras de fornecedor, use <strong>Compras e fornecedores</strong>: lá a entrada é registrada junto com custo e preço de venda.</p>
      <form id="adjustForm" class="form-grid">
        <div class="stock-direction span2" role="group" aria-label="Tipo de movimentação">
          <button type="button" class="stock-direction-btn is-active" data-stock-direction="entry" aria-pressed="true">↓ Entrada</button>
          <button type="button" class="stock-direction-btn" data-stock-direction="exit" aria-pressed="false">↑ Saída sem venda</button>
          <input type="hidden" name="direction" value="entry">
        </div>
        <label>Local de estoque<select name="location_id" id="adjustLocation" required></select></label>
        <label>Produto<select name="product_id" id="adjustProduct" required></select></label>
        <label>Quantidade (somente números positivos)<input name="qty" type="number" min="1" max="10000" step="1" required placeholder="Ex.: 3"></label>
        <label>Motivo<select name="reason" id="adjustReason" required></select></label>
        <label id="adjustImpactLabel" hidden>Valor da perda (R$)<input name="impact" type="number" min="0" step=".01" placeholder="Automático pelo último custo"><small>Se deixar em branco, usamos o último custo de compra registrado.</small></label>
        <label class="span2">Justificativa<textarea name="note" id="adjustNote" rows="3" maxlength="1200" placeholder="Informe o motivo, as condições e o responsável."></textarea><small id="adjustNoteHelp">Para entrada de mercadoria comprada, utilize a aba Compras e fornecedores.</small></label>
        <p class="span2 admin-feedback" id="adjustFeedback" role="status"></p>
        <button class="btn btn-primary span2" type="submit" id="adjustSubmit">Registrar entrada</button>
      </form>
    </div>
  </div>
  <div class="card"><p class="eyebrow">SALDOS ATUAIS</p><h2>Produtos por estoque</h2><div id="inventory"></div></div>
<div class="card"><p class="eyebrow">AUDITORIA</p><h2>Últimas movimentações</h2><p class="muted">Saídas sem venda mostram a justificativa e o valor do prejuízo registrado.</p><div id="inventoryHistory"><p class="muted">Abra esta aba para carregar o histórico.</p></div></div>
</section>
<section class="tab-panel" data-panel="pedidos" hidden>
<div class="grid2">
  <div class="card"><p class="eyebrow">Frete</p><h2>Configuração de envios</h2>
    <form id="shippingSettingsForm">
      <label>CEP de origem<input name="origin_postal_code" inputmode="numeric" maxlength="9" placeholder="00000-000"></label>
      <label>Ambiente<select name="provider_environment"><option value="sandbox">Sandbox / testes</option><option value="production">Produção</option></select></label>
      <label class="checkline"><input type="checkbox" name="shipping_enabled" disabled> Envios para São Paulo desativados nesta fase</label><p class="muted">A loja opera somente com vendedores e retirada. O cálculo de frete permanecerá bloqueado até a ativação futura.</p>
      <label>Mensagem ao cliente<textarea name="public_note">Atendimento atual somente com vendedores e retirada presencial.</textarea></label>
      <button class="btn btn-primary">Salvar configuração</button>
    </form>
  </div>
  <div class="card"><p class="eyebrow">Integração</p><h2>Status do Melhor Envio</h2>
    <div id="shippingProviderStatus" class="shipping-admin-status"></div>
    <div class="tracking-admin-note"><strong>Rastreio automático</strong><p>A estrutura do banco já possui campos para código e link de rastreio. A integração automática de rastreamento será estudada e implementada em uma próxima etapa.</p></div>
  </div>
</div>
<div class="card"><p class="eyebrow">COBRANÇA DA LOJA</p><h2>Mercado Pago · Checkout Seguro</h2><div id="mercadoPagoStatus"></div>
<p class="muted">PIX e cartão dos clientes são cobrados exclusivamente pela AZZENA. O vendedor só registra dinheiro vivo na aba Caixa do painel dele. Envio para São Paulo desativado.</p></div>
<div class="card"><p class="eyebrow">Pedidos</p><h2>Pedidos de clientes</h2><div id="orders"></div></div>
</section>
<section class="tab-panel" data-panel="caixa" hidden>
 <div class="card"><p class="eyebrow">CONTROLE FINANCEIRO</p><h2>Vendas presenciais em dinheiro</h2>
 <p class="muted">Todas as vendas recebidas em dinheiro vivo ficam registradas com o vendedor responsável, desconto autorizado, valor recebido, troco e baixa de estoque. PIX e cartão só pelo Mercado Pago da AZZENA.</p>
 <div id="cashSalesSummary" class="metrics"></div><div id="cashSalesTable"></div>
 </div></section>
<section class="tab-panel" data-panel="compras" hidden>
 <div class="admin-intro"><p class="eyebrow">GESTÃO DE MERCADORIAS</p><h2>Compras e fornecedores</h2><p>Cadastre quem fornece, registre quanto pagou e dê entrada no estoque sem precisar movimentar as unidades uma segunda vez. Os custos ficam privados na administração.</p></div>
 <div class="card">
   <p class="eyebrow">1 · CADASTRO</p><h2>Fornecedores</h2>
   <form id="supplierForm" class="form-grid">
     <input type="hidden" name="id">
     <label>Nome do fornecedor<input name="name" required maxlength="150" placeholder="Nome da empresa ou fornecedor"></label>
     <label>Pessoa de contato<input name="contact" maxlength="150" placeholder="Responsável pelo atendimento"></label>
     <label>Telefone / WhatsApp<input name="phone" type="tel" maxlength="40" placeholder="+55 ..."></label>
     <label>E-mail<input name="email" type="email" maxlength="180"></label>
     <label>CPF/CNPJ ou documento<input name="tax_id" maxlength="60" placeholder="Se aplicável"></label>
     <label>Endereço ou local de origem<input name="address" maxlength="350"></label>
     <label class="span2">Observações<textarea name="notes" maxlength="1500" rows="2"></textarea></label>
     <label class="checkline" id="supplierActiveLabel" hidden><input type="checkbox" name="is_active" checked> Fornecedor ativo</label>
     <p id="supplierFeedback" class="span2 admin-feedback" role="status"></p>
     <div class="span2 row-actions"><button class="btn btn-primary" type="submit" id="supplierSubmit">Cadastrar fornecedor</button><button class="btn" type="button" id="cancelSupplierEdit" hidden>Cancelar edição</button></div>
   </form>
   <div class="admin-table-section"><h3>Fornecedores cadastrados</h3><div id="supplierList"><p class="muted">Carregando fornecedores...</p></div></div>
 </div>
 <div class="card">
   <p class="eyebrow">2 · REGISTRAR COMPRA E RECEBER</p><h2>Entrada de produtos</h2>
   <p class="muted">Adicione todos os produtos recebidos do mesmo fornecedor, com custos e porcentagens individuais. Uma única operação grava a compra e atualiza todos os saldos e preços. Nada de registrar a mesma entrada duas vezes. Promoções antigas serão desativadas para não esconder o novo preço calculado.</p>
   <form id="lotForm" class="form-grid">
     <label>Fornecedor<select name="supplier_id" id="lotSupplier" required></select></label>
     <label>Destino: estoque<select name="location_id" id="lotLocation" required></select></label>
     <div class="span2 purchase-lines-head"><strong>Produtos recebidos</strong><small>Até 30 itens diferentes, cada um com quantidade, custo e porcentagem próprios.</small></div>
     <div class="span2 purchase-lines" id="lotItems">
       <section class="purchase-line" aria-label="Produto recebido 1">
         <div class="purchase-line-title"><strong>Produto 1</strong><button type="button" class="btn btn-small purchase-remove" data-remove-purchase-line hidden>Remover</button></div>
         <div class="form-grid">
           <label class="span2">Buscar no catálogo cadastrado<input class="purchase-line-search" type="search" placeholder="Digite o nome ou marca para filtrar..." autocomplete="off"></label>
           <label class="span2">Produto<select name="product_id" id="lotProduct" required></select></label>
           <label>Quantidade recebida<input name="qty" type="number" min="1" max="10000" step="1" required placeholder="Ex.: 10"></label>
           <label>Custo por unidade (R$)<input name="cost" type="number" min=".01" max="10000000" step=".01" required placeholder="Ex.: 100,00"></label>
           <label>Acréscimo sobre o custo (%)<input name="markup" type="number" min="0" max="1000" step=".01" value="40" required></label>
           <label>Preço de venda calculado<input name="sale_price_preview" id="lotSalePreview" type="text" readonly placeholder="R$ 0,00"></label>
         </div>
         <div class="purchase-line-summary" aria-live="polite">Selecione o produto, informe quantidade e custo.</div>
       </section>
     </div>
     <div class="span2 purchase-add-row"><button type="button" class="btn" id="addPurchaseLine">+ Adicionar outro produto</button><span id="purchaseLineCount">1 produto nesta compra</span></div>
     <div class="span2 pricing-preview" id="lotPriceSummary" aria-live="polite">O total da compra e a projeção de venda serão calculados para todos os produtos.</div>
     <label>Data da compra<input name="purchased_at" type="date" required></label>
     <label>Número da nota / referência<input name="reference_code" maxlength="90" placeholder="Opcional"></label>
     <label>Frete da compra (R$)<input name="freight" type="number" min="0" step=".01" value="0"></label>
     <label>Outras despesas (R$)<input name="other_costs" type="number" min="0" step=".01" value="0"></label>
     <label>Ocorrência na compra<select name="risk"><option value="">Nenhuma</option><option value="travel">Transporte</option><option value="seizure">Apreensão</option><option value="damage">Avaria</option><option value="loss">Perda</option><option value="other">Outro</option></select></label>
     <label>Valor da ocorrência (R$)<input name="risk_value" type="number" min="0" step=".01" value="0"></label>
     <label class="span2">Notas da compra<textarea name="notes" rows="2" maxlength="1200" placeholder="Observações sobre a compra, embalagem ou procedência"></textarea></label>
     <label class="span2">Descrição da ocorrência<textarea name="risk_note" rows="2" maxlength="500" placeholder="Somente se houve ocorrência"></textarea></label>
     <p class="span2 admin-feedback" id="lotFeedback" role="status"></p>
     <button class="btn btn-primary span2" type="submit" id="lotSubmit">Registrar compra e dar entrada em todos os produtos</button>
   </form>
 </div>
 <div class="card">
   <p class="eyebrow">3 · PREÇOS</p><h2>Reajustar preço pelo último custo</h2>
   <p class="muted">Altere a porcentagem quando quiser, sem precisar dar nova entrada. O último custo de compra continua privado.</p>
   <form id="repriceForm" class="form-grid">
     <label class="span2">Produto com custo registrado<select id="repriceProduct" name="product_id" required></select></label>
     <label>Último custo por unidade<input id="repriceCost" type="text" readonly placeholder="Selecione o produto"></label>
     <label>Porcentagem sobre o custo (%)<input id="repriceMarkup" name="markup" type="number" min="0" max="1000" step=".01" required></label>
     <label>Preço de venda recalculado<input id="repricePreview" type="text" readonly placeholder="R$ 0,00"></label>
     <p class="span2 admin-feedback" id="repriceFeedback" role="status"></p>
     <button class="btn btn-primary span2" type="submit" id="repriceSubmit">Salvar novo preço de venda</button>
   </form>
 </div>
 <div class="card"><p class="eyebrow">4 · CONFERÊNCIA</p><h2>Histórico de compras</h2><div id="purchaseHistory"><p class="muted">Carregando compras...</p></div></div>
</section>
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
["Desconto máx.",r=>Number(r.max_discount_percent||0).toLocaleString("pt-BR")+"%"],
["Envio",r=>Number(r.weight_kg||0).toFixed(3)+" kg · "+Number(r.width_cm||0)+"×"+Number(r.height_cm||0)+"×"+Number(r.length_cm||0)+" cm"],
["Status",r=>r.is_active?'<span class="badge-ok">Ativo</span>':'<span class="badge-off">Fora da loja</span>'],
["Ações",r=>'<div class="row-actions"><button class="btn btn-small" type="button" data-edit-product="'+esc(r.id)+'">Editar</button>'+(r.is_active?'<button class="btn btn-small btn-danger-soft" type="button" data-delete-product="'+esc(r.id)+'">Remover da loja</button>':'<button class="btn btn-small btn-restore" type="button" data-restore-product="'+esc(r.id)+'">Restaurar</button>')+'<button class="btn btn-small btn-danger-outline" type="button" data-hard-delete-product="'+esc(r.id)+'">Excluir definitivamente</button>'+'</div>']
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
["Origem",r=>r.payment_channel==="seller_cash"?"Dinheiro presencial":r.payment_channel==="mercadopago"?"Site · Mercado Pago":"Legado"],
["Pagamento",r=>'<select class="admin-inline-select" data-order-payment="'+esc(r.id)+'">'+["pending","approved","rejected","cancelled","refunded"].map(x=>'<option value="'+x+'" '+(r.payment_status===x?"selected":"")+'>'+paymentLabels[x]+'</option>').join("")+'</select>'],
["Pedido",r=>'<select class="admin-inline-select" data-order-fulfillment="'+esc(r.id)+'">'+["pending","preparing","ready","shipped","delivered","cancelled"].map(x=>'<option value="'+x+'" '+(r.fulfillment_status===x?"selected":"")+'>'+orderStatusLabels[x]+'</option>').join("")+'</select>'],
["Ações",r=>'<div class="row-actions"><button class="btn btn-small" type="button" data-save-order="'+esc(r.id)+'">Salvar status</button><a class="btn btn-small" target="_blank" rel="noopener" href="https://wa.me/'+String(r.customer_phone||"").replace(/\D/g,"")+'?text='+encodeURIComponent("Olá "+r.customer_name+", estamos entrando em contato sobre o pedido "+r.public_id+".")+'">WhatsApp</a></div>']
],d.orders||[]);
const cashRows=(d.orders||[]).filter(o=>o.payment_channel==="seller_cash");
const cashGross=cashRows.reduce((sum,o)=>sum+Number(o.subtotal_cents||0),0);
const cashDiscount=cashRows.reduce((sum,o)=>sum+Number(o.discount_cents||0),0);
const cashNet=cashRows.reduce((sum,o)=>sum+Number(o.total_cents||0),0);
document.querySelector("#cashSalesSummary").innerHTML=[
 ["Vendas em dinheiro",cashRows.length],["Faturamento líquido",money(cashNet)],
 ["Descontos concedidos",money(cashDiscount)]
].map(row=>'<div class="metric"><span>'+row[0]+'</span><strong>'+row[1]+'</strong></div>').join("");
document.querySelector("#cashSalesTable").innerHTML=table([
 ["Data",o=>new Date(o.created_at).toLocaleString("pt-BR")],
 ["Pedido",o=>esc(o.public_id)],["Cliente",o=>esc(o.customer_name)],
 ["Vendedor",o=>esc(d.sellers.find(s=>s.id===o.seller_id)?.name||"—")],
 ["Bruto",o=>money(o.subtotal_cents)],["Desconto",o=>money(o.discount_cents)],
 ["Líquido",o=>money(o.total_cents)],["Dinheiro recebido",o=>money(o.cash_received_cents)],
 ["Troco",o=>money(o.cash_change_cents)]
],cashRows);
document.querySelector("#mercadoPagoStatus").innerHTML=d.mercado_pago_credentials_present?
 '<div class="badge-ok">Credenciais cadastradas no Supabase. Faça um pagamento de teste antes de liberar vendas reais.</div>':
 '<div class="badge-warn">Integração preparada; falta configurar o Access Token e a chave secreta de Webhook da conta Mercado Pago da loja. O checkout online permanece indisponível até a configuração.</div>';
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
document.querySelector("#repriceProduct").innerHTML=option(d.products,"id",x=>x.name+" · "+x.volume_ml+" mL");
document.querySelector("#reportSeller").innerHTML=option(d.sellers,"id","name","Todos");
document.querySelector("#reportProduct").innerHTML=option(d.products,"id",x=>x.name+" · "+x.volume_ml+" mL","Todos");
document.querySelector("#reportCity").innerHTML=option(d.cities,"id","city_name","Todas");
}