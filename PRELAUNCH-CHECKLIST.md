# AZZENA PARFUMS — checklist antes de ativar o Mercado Pago
**Data da revisão:** 2026-10-01. **Escopo:** configuração de segurança, vitrine e operação sem credenciais financeiras.

## Correções executadas e conferidas
- [x] Retirada a execução anônima e autenticada da função interna `notify_seller_for_order()`. Acesso de `service_role` preservado; o trigger permanece instalado.
- [x] Criados 13 índices de chaves estrangeiras que faltavam. Conferido via advisors: sem alertas remanescentes de FKs não indexadas.
- [x] Conferidas as tabelas públicas: todas com RLS habilitado.
- [x] Conferido o bucket `product-images`: upload, edição e exclusão só para administradores; MIME JPEG, PNG, WebP; limite 10 MiB.
- [x] Aplicadas políticas Content Security Policy e Referrer Policy nas seis páginas HTML; redirecionamento de recuperação de conta extraído para JS externo.
- [x] Removidas promessas de frete e de pagamento já ativo enquanto ambos estão desabilitados.
- [x] Vitrine consulta disponibilidade real por vendedor, considera reservas e exige ponto de retirada ativo; bloqueia produtos esgotados e não exibe vendedores sem ponto e produtos disponíveis.
- [x] Carrinho valida entradas armazenadas, corrige preços/quantidades com dados atuais e bloqueia indisponibilidade.
- [x] Telefone no link de WhatsApp do painel ADM é normalizado para somente dígitos.
- [x] Cópia limpa da versão anterior na branch `backup/original-before-azzena-prepayment-fixes-20261001`.
- [x] Testes automatizados da lógica: disponibilidade, ponto de retirada, falha na consulta, reconciliação do carrinho e limite por produto passaram.
- [x] Política do banco para pagamento e retirada: funções críticas sem `EXECUTE` direto para `anon` e `authenticated`.

## Pendências anteriores à primeira venda
- [ ] No Supabase Auth, ativar proteção contra senhas vazadas (se disponível no plano). Não há ação deste conector para alterar configuração do Auth.
- [ ] Cadastrar estoque físico com saldo real em `inventory_locations` e `inventory_balances` por vendedor.
- [ ] Cadastrar e habilitar pelo vendedor um ponto de retirada verificável; atualmente nenhum ponto existe.
- [ ] Conferir fotos, concentração, volume e procedência dos produtos antes de anunciá-los como disponíveis.
- [ ] Validar os textos legais e publicar identificação do fornecedor, suporte, privacidade, devoluções e trocas com dados operacionais verdadeiros.
- [ ] Definir eventual atendimento Brasil/Paraguai e exigências fiscais/sanitárias conforme a origem de cada produto.
- [ ] Realizar auditoria manual dos dois endpoints públicos de consulta de convite (`admin-bootstrap` e `seller-bootstrap`), considerando enumeração de emails e proteção contra abuso.
- [ ] O endpoint público `public_seller_catalog` é `SECURITY DEFINER` de propósito e limitado a vendedores aprovados/ativos, mas continua gerando aviso do advisor; reavaliar exposição de endereços pessoais antes de cadastrar novos vendedores.
- [ ] Vincular credenciais de produção e webhook do Mercado Pago *depois* da preparação operacional.
- [ ] Fazer teste transacional com PIX, cartão, pagamento recusado, estorno, duplicidade de webhook e conciliação de estoque.
- [ ] Só liberar envio domiciliar após revisar código de criação de pedidos enviados, cotação e transportadora apta a transportar perfume.

## Observações
- Nesta revisão não foram criados estoques, endereços, pagamentos ou pedidos fictícios.
- O checkout existente permanece desabilitado até gateway configurado e estoque/ponto de retirada disponíveis.
- O deploy deve ser conferido em ambiente publicado e no navegador do cliente após merge; verificações estáticas não substituem teste real.


## Atualização: pagamentos, encomendas e painel do vendedor (2026-10-01)

### Modalidades do futuro checkout
- [x] PIX e cartão de crédito registrados como modalidades na interface. O botão de pagar continua condicionado à habilitação segura das credenciais do Mercado Pago.
- [x] Transparência sobre parcelamento: texto prévio explica que eventuais juros/encargos variam por número de parcelas e condições da conta e que o checkout do Mercado Pago exibirá o total antes da confirmação.
- [ ] Antes de publicar cobranças, validar na conta real quem arca com as tarifas, parcelamentos permitidos, opções sem juros e valor final. Nunca divulgar taxa fixa sem confirmação.
- [ ] Revisar meios de pagamento efetivamente ofertados no Checkout Pro: conforme documentação, dinheiro em conta do Mercado Pago não pode ser totalmente excluído da tela do provedor.
- [ ] Testar PIX, cartão de crédito, parcela com encargos, pagamento recusado, cancelamento e estorno após ativação.

### Encomendas sem estoque — contato direto e autorizado
- [x] No produto esgotado, cliente pode solicitar por encomenda via WhatsApp de vendedor autorizado. Mensagem menciona nome, volume, consulta de disponibilidade, preço e prazo.
- [x] Na página exclusiva do vendedor, produtos ativos sem estoque aparecem para consulta; comprar e pagar continuam bloqueados sem disponibilidade.
- [x] Função pública somente retorna ID, nome de exibição e telefone de WhatsApp de vendedores aprovados, ativos e com adesão habilitada.
- [x] Vendedor pode ativar/desativar seu contato em Configurações por sessão autenticada. Vendedor ativo atual foi habilitado inicialmente pela decisão comercial desta revisão; futuros cadastros começam desativados.
- [x] Pedido de encomenda via WhatsApp não cria pedido, não reserva estoque e não cobra o cliente; vendedor deve confirmar as condições antes de qualquer pagamento.
- [ ] Se desejar rastreamento de leads no sistema futuramente, criar módulo autorizado de encomendas, com consentimento e histórico próprio (não confundir mensagens de WhatsApp com compras aprovadas).

### Operação do vendedor
- [x] Área reestruturada em oito abas: Visão geral, Pedidos, Retiradas, Estoque, Caixa, Encomendas, Meu catálogo e Configurações.
- [x] Visão geral com prioridades calculadas de pedidos, estoque, retirada e contato por WhatsApp.
- [x] Atalho na notificação abre a aba de pedidos; pedido pronto pode abrir a aba de verificação da retirada.
- [x] Navegação por teclado/ARIA, layout adaptado para mobile e manutenção dos formulários existentes.
- [ ] Verificar manualmente no navegador iPad e smartphone, com contas autorizadas, os fluxos de formulários, impressão, atualização e retorno à aba anteriormente aberta.
