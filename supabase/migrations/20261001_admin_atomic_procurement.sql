-- AZZENA PARFUMS | estoque, fornecedores, custo privado e precificação
-- Fonte sincronizada com a migração aplicada e funções verificadas no Supabase.
-- Não concede acesso às tabelas privadas para anon/authenticated.

ALTER TABLE private.purchase_lots ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.inventory_locations(id);
ALTER TABLE private.purchase_lots ADD COLUMN IF NOT EXISTS idempotency_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS purchase_lots_idempotency_azz_idx ON private.purchase_lots(idempotency_key);
ALTER TABLE private.purchase_lot_items ADD COLUMN IF NOT EXISTS sale_price_cents bigint;
ALTER TABLE private.purchase_lot_items ADD COLUMN IF NOT EXISTS markup_percent numeric(8,2);
CREATE TABLE IF NOT EXISTS private.product_pricing (
 product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
 last_unit_cost_cents bigint NOT NULL CHECK(last_unit_cost_cents>=0),
 markup_percent numeric(8,2) NOT NULL CHECK(markup_percent BETWEEN 0 AND 1000),
 last_purchase_lot_id uuid REFERENCES private.purchase_lots(id) ON DELETE SET NULL,
 updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.product_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_reason_code_check;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_reason_code_check CHECK(
 reason_code IS NULL OR reason_code IN ('sale','restock','breakage','damage','loss','seizure','gift','road_loss','inventory_count','transfer','return','other')
);

-- private.apply_inventory_adjustment
CREATE OR REPLACE FUNCTION private.apply_inventory_adjustment(p_location_id uuid, p_product_id uuid, p_delta integer, p_reason_code text, p_note text, p_financial_impact_cents bigint, p_actor_id uuid)
 RETURNS TABLE(new_balance integer, movement_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'pg_temp'
AS $function$
DECLARE v_balance integer;v_movement uuid;v_seller uuid;v_type text;
        v_stock bigint;v_reserved bigint;
BEGIN
 IF p_delta IS NULL OR p_delta=0 THEN RAISE EXCEPTION 'delta cannot be zero';END IF;
 IF p_reason_code NOT IN ('sale','restock','breakage','damage','loss','seizure','gift','road_loss','inventory_count','transfer','return','other')
 THEN RAISE EXCEPTION 'invalid reason code';END IF;
 SELECT seller_id INTO v_seller FROM public.inventory_locations WHERE id=p_location_id AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_NOT_FOUND';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=p_product_id) THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND';END IF;
 INSERT INTO public.inventory_balances(location_id,product_id,quantity) VALUES(p_location_id,p_product_id,0)
 ON CONFLICT(location_id,product_id) DO NOTHING;
 IF v_seller IS NOT NULL THEN
   PERFORM 1 FROM public.inventory_balances b JOIN public.inventory_locations l ON l.id=b.location_id
   WHERE l.seller_id=v_seller AND l.is_active=true AND b.product_id=p_product_id
   ORDER BY b.location_id FOR UPDATE OF b;
 END IF;
 SELECT quantity INTO v_balance FROM public.inventory_balances
 WHERE location_id=p_location_id AND product_id=p_product_id FOR UPDATE;
 IF v_balance+p_delta<0 THEN RAISE EXCEPTION 'insufficient stock';END IF;
 IF p_delta<0 AND v_seller IS NOT NULL THEN
   SELECT coalesce(sum(b.quantity),0) INTO v_stock FROM public.inventory_balances b
   JOIN public.inventory_locations l ON l.id=b.location_id
   WHERE l.seller_id=v_seller AND l.is_active=true AND b.product_id=p_product_id;
   SELECT coalesce(sum(r.quantity),0) INTO v_reserved FROM public.seller_stock_reservations r
   WHERE r.seller_id=v_seller AND r.product_id=p_product_id AND r.status='held' AND r.reserved_until>now();
   IF v_stock+p_delta<v_reserved THEN RAISE EXCEPTION 'RESERVED_STOCK_CONFLICT';END IF;
 END IF;
 UPDATE public.inventory_balances SET quantity=v_balance+p_delta,updated_at=now()
 WHERE location_id=p_location_id AND product_id=p_product_id RETURNING quantity INTO v_balance;
 v_type:=CASE WHEN p_reason_code='sale' THEN 'sale'
 WHEN p_reason_code='restock' THEN 'restock'
 WHEN p_reason_code IN ('breakage','damage','loss','seizure','road_loss') THEN 'loss'
 WHEN p_reason_code='return' THEN 'return'
 WHEN p_reason_code='transfer' AND p_delta>0 THEN 'transfer_in'
 WHEN p_reason_code='transfer' AND p_delta<0 THEN 'transfer_out'
 ELSE 'adjustment' END;
 INSERT INTO public.inventory_movements(seller_id,product_id,movement_type,quantity_delta,balance_after,
 note,inventory_location_id,reason_code,financial_impact_cents,created_by)
 VALUES(v_seller,p_product_id,v_type,p_delta,v_balance,nullif(btrim(p_note),''),
        p_location_id,p_reason_code,greatest(coalesce(p_financial_impact_cents,0),0),p_actor_id)
 RETURNING id INTO v_movement;
 RETURN QUERY SELECT v_balance,v_movement;
END $function$
;

-- public.azzena_admin_adjust_inventory
CREATE OR REPLACE FUNCTION public.azzena_admin_adjust_inventory(p_actor_id uuid, p_location_id uuid, p_product_id uuid, p_direction text, p_quantity integer, p_reason_code text, p_note text, p_financial_impact_cents bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'pg_temp'
AS $function$
DECLARE v_delta integer;v_impact bigint;v_unit_cost bigint;v_balance integer;v_movement uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=p_actor_id) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_direction NOT IN('entry','exit') OR p_quantity IS NULL OR p_quantity<1 OR p_quantity>10000
 THEN RAISE EXCEPTION 'INVALID_MOVEMENT_QUANTITY';END IF;
 IF (p_direction='entry' AND p_reason_code NOT IN('restock','return','inventory_count','other'))
 OR (p_direction='exit' AND p_reason_code NOT IN('breakage','loss','damage','seizure','gift','road_loss','inventory_count','other'))
 THEN RAISE EXCEPTION 'INVALID_MOVEMENT_REASON';END IF;
 IF p_direction='exit' AND length(btrim(coalesce(p_note,'')))<5 THEN RAISE EXCEPTION 'JUSTIFICATION_REQUIRED';END IF;
 IF p_direction='entry' AND p_reason_code IN ('inventory_count','other','restock') AND length(btrim(coalesce(p_note,'')))<5
 THEN RAISE EXCEPTION 'JUSTIFICATION_REQUIRED';END IF;
 v_delta:=CASE WHEN p_direction='entry' THEN p_quantity ELSE -p_quantity END;
 IF p_financial_impact_cents IS NOT NULL AND p_financial_impact_cents<0 THEN RAISE EXCEPTION 'INVALID_IMPACT';END IF;
 IF p_direction='exit' THEN
   SELECT last_unit_cost_cents INTO v_unit_cost FROM private.product_pricing WHERE product_id=p_product_id;
   v_impact:=coalesce(p_financial_impact_cents,coalesce(v_unit_cost,0)*p_quantity);
 ELSE v_impact:=0;END IF;
 SELECT a.new_balance,a.movement_id INTO v_balance,v_movement FROM private.apply_inventory_adjustment(
 p_location_id,p_product_id,v_delta,p_reason_code,p_note,v_impact,p_actor_id) a;
 RETURN jsonb_build_object('data',jsonb_build_object('new_balance',v_balance,'movement_id',v_movement,
 'quantity_delta',v_delta,'financial_impact_cents',v_impact));
END $function$
;

-- public.azzena_admin_procurement
CREATE OR REPLACE FUNCTION public.azzena_admin_procurement(p_action text, p_payload jsonb, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'pg_temp'
AS $function$
DECLARE v_data jsonb;v_aux jsonb;v_supplier private.suppliers%rowtype;v_name text;
 v_loc public.inventory_locations%rowtype;v_prod public.products%rowtype;
 v_request uuid;v_lot_id uuid;v_supplier_id uuid;v_product_id uuid;v_location_id uuid;
 v_qty integer;v_cost bigint;v_markup numeric(8,2);v_price bigint;v_risk text;
 v_balance integer;v_movement uuid;v_reference text;v_note text;v_freight bigint;v_other bigint;
BEGIN
 IF p_actor_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=p_actor_id)
 THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_action='list_suppliers' THEN
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_data FROM
   (SELECT id,name,contact_name,phone,email,tax_id,address,notes,is_active,created_at,updated_at
    FROM private.suppliers ORDER BY name) x;
   RETURN jsonb_build_object('data',v_data);
 ELSIF p_action='create_supplier' THEN
   v_name:=left(btrim(coalesce(p_payload->>'name','')),150);
   IF length(v_name)<2 THEN RAISE EXCEPTION 'SUPPLIER_NAME_REQUIRED';END IF;
   IF EXISTS(SELECT 1 FROM private.suppliers WHERE lower(btrim(name))=lower(v_name))
   THEN RAISE EXCEPTION 'SUPPLIER_ALREADY_EXISTS';END IF;
   INSERT INTO private.suppliers(name,contact_name,phone,email,tax_id,address,notes,is_active)
   VALUES(v_name,nullif(left(btrim(p_payload->>'contact_name'),150),''),
          nullif(left(btrim(p_payload->>'phone'),40),''),
          nullif(left(lower(btrim(p_payload->>'email')),180),''),
          nullif(left(btrim(p_payload->>'tax_id'),60),''),
          nullif(left(btrim(p_payload->>'address'),350),''),
          nullif(left(btrim(p_payload->>'notes'),1500),''),true)
   RETURNING * INTO v_supplier;
   RETURN jsonb_build_object('data',to_jsonb(v_supplier));
 ELSIF p_action='update_supplier' THEN
   v_supplier_id:=nullif(p_payload->>'id','')::uuid;
   v_name:=left(btrim(coalesce(p_payload->>'name','')),150);
   IF v_supplier_id IS NULL OR length(v_name)<2 THEN RAISE EXCEPTION 'SUPPLIER_FIELDS_REQUIRED';END IF;
   IF EXISTS(SELECT 1 FROM private.suppliers WHERE lower(btrim(name))=lower(v_name) AND id<>v_supplier_id)
   THEN RAISE EXCEPTION 'SUPPLIER_ALREADY_EXISTS';END IF;
   UPDATE private.suppliers SET name=v_name,contact_name=nullif(left(btrim(p_payload->>'contact_name'),150),''),
    phone=nullif(left(btrim(p_payload->>'phone'),40),''),
    email=nullif(left(lower(btrim(p_payload->>'email')),180),''),
    tax_id=nullif(left(btrim(p_payload->>'tax_id'),60),''),
    address=nullif(left(btrim(p_payload->>'address'),350),''),
    notes=nullif(left(btrim(p_payload->>'notes'),1500),''),
    is_active=coalesce((p_payload->>'is_active')::boolean,true),updated_at=now()
   WHERE id=v_supplier_id RETURNING * INTO v_supplier;
   IF NOT FOUND THEN RAISE EXCEPTION 'SUPPLIER_NOT_FOUND';END IF;
   RETURN jsonb_build_object('data',to_jsonb(v_supplier));
 ELSIF p_action='list_purchase_lots' THEN
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_data FROM (
     SELECT l.id,l.reference_code,l.purchased_at,l.created_at,l.freight_cents,l.other_costs_cents,
      s.name AS supplier_name,loc.name AS location_name,
      i.product_id,p.name AS product_name,i.quantity,i.unit_cost_cents,i.sale_price_cents,i.markup_percent
     FROM private.purchase_lots l
     LEFT JOIN private.suppliers s ON s.id=l.supplier_id
     LEFT JOIN public.inventory_locations loc ON loc.id=l.location_id
     LEFT JOIN private.purchase_lot_items i ON i.purchase_lot_id=l.id
     LEFT JOIN public.products p ON p.id=i.product_id
     ORDER BY l.created_at DESC LIMIT 100
   ) x;
   SELECT coalesce(jsonb_agg(to_jsonb(z)),'[]'::jsonb) INTO v_aux FROM (
      SELECT product_id,last_unit_cost_cents,markup_percent,updated_at FROM private.product_pricing
   ) z;
   RETURN jsonb_build_object('data',jsonb_build_object('lots',v_data,'pricing',v_aux));
 ELSIF p_action='report_costs' THEN
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_data FROM
     (SELECT product_id,quantity,unit_cost_cents,risk_type,risk_value_cents
     FROM private.purchase_lot_items) x;
   RETURN jsonb_build_object('data',v_data);
 ELSIF p_action='receive_purchase' THEN
   v_request:=nullif(p_payload->>'request_id','')::uuid;
   IF v_request IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED';END IF;
   SELECT id INTO v_lot_id FROM private.purchase_lots WHERE idempotency_key=v_request;
   IF FOUND THEN RETURN jsonb_build_object('data',jsonb_build_object('lot_id',v_lot_id,'already_recorded',true));END IF;
   v_supplier_id:=nullif(p_payload->>'supplier_id','')::uuid;
   v_location_id:=nullif(p_payload->>'location_id','')::uuid;
   v_product_id:=nullif(p_payload->>'product_id','')::uuid;
   v_qty:=(p_payload->>'quantity')::integer;
   v_cost:=(p_payload->>'unit_cost_cents')::bigint;
   v_markup:=(p_payload->>'markup_percent')::numeric;
   IF v_supplier_id IS NULL OR v_location_id IS NULL OR v_product_id IS NULL OR
      v_qty IS NULL OR v_qty<1 OR v_qty>10000 OR v_cost IS NULL OR v_cost<1 OR v_cost>1000000000 OR
      v_markup IS NULL OR v_markup<0 OR v_markup>1000 THEN RAISE EXCEPTION 'PURCHASE_FIELDS_INVALID';END IF;
   IF NOT EXISTS(SELECT 1 FROM private.suppliers WHERE id=v_supplier_id AND is_active=true)
   THEN RAISE EXCEPTION 'SUPPLIER_NOT_ACTIVE';END IF;
   SELECT * INTO v_loc FROM public.inventory_locations WHERE id=v_location_id AND is_active=true;
   IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_NOT_FOUND';END IF;
   SELECT * INTO v_prod FROM public.products WHERE id=v_product_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND';END IF;
   v_price:=round(v_cost*(1+v_markup/100))::bigint;
   v_reference:=nullif(left(btrim(p_payload->>'reference_code'),90),'');
   v_note:=nullif(left(btrim(p_payload->>'notes'),1200),'');
   v_freight:=coalesce((p_payload->>'freight_cents')::bigint,0);
   v_other:=coalesce((p_payload->>'other_costs_cents')::bigint,0);
   IF v_freight<0 OR v_other<0 THEN RAISE EXCEPTION 'PURCHASE_COSTS_INVALID';END IF;
   v_risk:=nullif(btrim(p_payload->>'risk_type'),'');
   IF v_risk IS NOT NULL AND v_risk NOT IN('travel','seizure','damage','loss','other')
   THEN RAISE EXCEPTION 'PURCHASE_RISK_INVALID';END IF;
   INSERT INTO private.purchase_lots(supplier_id,service_city_id,location_id,idempotency_key,
   reference_code,purchased_at,freight_cents,other_costs_cents,notes)
   VALUES(v_supplier_id,v_loc.service_city_id,v_location_id,v_request,v_reference,
      coalesce(nullif(p_payload->>'purchased_at','')::timestamptz,now()),v_freight,v_other,v_note)
   ON CONFLICT(idempotency_key) DO NOTHING RETURNING id INTO v_lot_id;
   IF v_lot_id IS NULL THEN
     SELECT id INTO v_lot_id FROM private.purchase_lots WHERE idempotency_key=v_request;
     RETURN jsonb_build_object('data',jsonb_build_object('lot_id',v_lot_id,'already_recorded',true));
   END IF;
   INSERT INTO private.purchase_lot_items(purchase_lot_id,product_id,quantity,unit_cost_cents,
       sale_price_cents,markup_percent,risk_type,risk_value_cents,risk_note)
   VALUES(v_lot_id,v_product_id,v_qty,v_cost,v_price,v_markup,v_risk,
       greatest(coalesce((p_payload->>'risk_value_cents')::bigint,0),0),
       nullif(left(btrim(p_payload->>'risk_note'),500),''));
   SELECT a.new_balance,a.movement_id INTO v_balance,v_movement
   FROM private.apply_inventory_adjustment(v_location_id,v_product_id,v_qty,'restock',
       'Entrada por compra '||coalesce(v_reference,v_lot_id::text)||coalesce(' - '||v_note,''),
       0,p_actor_id) a;
   INSERT INTO private.product_pricing(product_id,last_unit_cost_cents,markup_percent,
         last_purchase_lot_id,updated_by,updated_at)
   VALUES(v_product_id,v_cost,v_markup,v_lot_id,p_actor_id,now())
   ON CONFLICT(product_id) DO UPDATE SET last_unit_cost_cents=excluded.last_unit_cost_cents,
      markup_percent=excluded.markup_percent,last_purchase_lot_id=excluded.last_purchase_lot_id,
      updated_by=excluded.updated_by,updated_at=now();
   UPDATE public.products SET price_cents=v_price,
      sale_price_cents=NULL,updated_at=now()
   WHERE id=v_product_id;
   RETURN jsonb_build_object('data',jsonb_build_object('lot_id',v_lot_id,'already_recorded',false,
         'new_balance',v_balance,'movement_id',v_movement,'unit_cost_cents',v_cost,
         'markup_percent',v_markup,'sale_price_cents',v_price));
 ELSE RAISE EXCEPTION 'UNKNOWN_PROCUREMENT_ACTION';END IF;
END $function$
;

-- public.azzena_admin_reprice_product
CREATE OR REPLACE FUNCTION public.azzena_admin_reprice_product(p_actor_id uuid, p_product_id uuid, p_markup_percent numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'pg_temp'
AS $function$
DECLARE v_cost bigint;v_price bigint;v_old_price bigint;
BEGIN
 IF p_actor_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=p_actor_id)
 THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 IF p_markup_percent IS NULL OR p_markup_percent<0 OR p_markup_percent>1000
 THEN RAISE EXCEPTION 'MARKUP_INVALID';END IF;
 SELECT last_unit_cost_cents INTO v_cost FROM private.product_pricing WHERE product_id=p_product_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_COST_NOT_REGISTERED';END IF;
 SELECT price_cents INTO v_old_price FROM public.products WHERE id=p_product_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND';END IF;
 v_price:=round(v_cost*(1+p_markup_percent/100))::bigint;
 UPDATE private.product_pricing SET markup_percent=p_markup_percent,updated_by=p_actor_id,updated_at=now()
 WHERE product_id=p_product_id;
 UPDATE public.products SET price_cents=v_price,
   sale_price_cents=NULL,updated_at=now() WHERE id=p_product_id;
 RETURN jsonb_build_object('data',jsonb_build_object('old_price_cents',v_old_price,
 'unit_cost_cents',v_cost,'markup_percent',p_markup_percent,'new_price_cents',v_price));
END $function$
;


REVOKE ALL ON FUNCTION public.azzena_admin_adjust_inventory(uuid,uuid,uuid,text,integer,text,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.azzena_admin_adjust_inventory(uuid,uuid,uuid,text,integer,text,text,bigint) TO service_role;
REVOKE ALL ON FUNCTION public.azzena_admin_procurement(text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.azzena_admin_procurement(text,jsonb,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.azzena_admin_reprice_product(uuid,uuid,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.azzena_admin_reprice_product(uuid,uuid,numeric) TO service_role;

-- Indices auxiliares das novas relacoes privadas
CREATE INDEX IF NOT EXISTS product_pricing_lot_azz_idx ON private.product_pricing(last_purchase_lot_id);
CREATE INDEX IF NOT EXISTS product_pricing_updated_by_azz_idx ON private.product_pricing(updated_by);
CREATE INDEX IF NOT EXISTS purchase_lots_location_azz_idx ON private.purchase_lots(location_id);
