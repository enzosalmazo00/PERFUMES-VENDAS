
CREATE OR REPLACE FUNCTION public.azzena_admin_receive_purchase_items(
 p_payload jsonb,p_actor_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','pg_temp'
AS $fn$
DECLARE
 v_request uuid;v_supplier_id uuid;v_location_id uuid;v_location public.inventory_locations%rowtype;
 v_items jsonb;v_item jsonb;v_seen uuid[]:='{}';v_product_id uuid;v_product_name text;
 v_qty integer;v_cost bigint;v_markup numeric(8,2);v_price bigint;v_qty_total integer:=0;
 v_lot_id uuid;v_ref text;v_note text;v_freight bigint;v_other bigint;v_risk text;
 v_risk_value bigint;v_risk_note text;v_line integer:=0;v_result jsonb:='[]'::jsonb;
 v_balance integer;v_movement uuid;
BEGIN
 IF p_actor_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=p_actor_id)
 THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 v_request:=nullif(p_payload->>'request_id','')::uuid;
 IF v_request IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED';END IF;
 SELECT id INTO v_lot_id FROM private.purchase_lots WHERE idempotency_key=v_request;
 IF FOUND THEN RETURN jsonb_build_object('data',jsonb_build_object('lot_id',v_lot_id,'already_recorded',true));END IF;
 v_supplier_id:=nullif(p_payload->>'supplier_id','')::uuid;
 v_location_id:=nullif(p_payload->>'location_id','')::uuid;
 IF v_supplier_id IS NULL OR v_location_id IS NULL
 THEN RAISE EXCEPTION 'PURCHASE_FIELDS_INVALID';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.suppliers WHERE id=v_supplier_id AND is_active=true)
 THEN RAISE EXCEPTION 'SUPPLIER_NOT_ACTIVE';END IF;
 SELECT * INTO v_location FROM public.inventory_locations WHERE id=v_location_id AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_NOT_FOUND';END IF;
 v_items:=p_payload->'items';
 IF jsonb_typeof(v_items) IS DISTINCT FROM 'array' OR jsonb_array_length(v_items)<1
 OR jsonb_array_length(v_items)>30 THEN RAISE EXCEPTION 'PURCHASE_ITEMS_INVALID';END IF;
 v_freight:=coalesce((p_payload->>'freight_cents')::bigint,0);
 v_other:=coalesce((p_payload->>'other_costs_cents')::bigint,0);
 IF v_freight<0 OR v_other<0 OR v_freight>1000000000 OR v_other>1000000000
 THEN RAISE EXCEPTION 'PURCHASE_COSTS_INVALID';END IF;
 v_risk:=nullif(btrim(p_payload->>'risk_type'),'');
 v_risk_value:=coalesce((p_payload->>'risk_value_cents')::bigint,0);
 v_risk_note:=nullif(left(btrim(p_payload->>'risk_note'),500),'');
 IF (v_risk IS NOT NULL AND v_risk NOT IN('travel','seizure','damage','loss','other'))
 OR v_risk_value<0 THEN RAISE EXCEPTION 'PURCHASE_RISK_INVALID';END IF;
 v_ref:=nullif(left(btrim(p_payload->>'reference_code'),90),'');
 v_note:=nullif(left(btrim(p_payload->>'notes'),1200),'');
 -- Validate every line before writing anything. Duplicate products in a purchase are refused.
 FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
   IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'PURCHASE_ITEMS_INVALID';END IF;
   v_product_id:=nullif(v_item->>'product_id','')::uuid;
   v_qty:=(v_item->>'quantity')::integer;
   v_cost:=(v_item->>'unit_cost_cents')::bigint;
   v_markup:=(v_item->>'markup_percent')::numeric;
   IF v_product_id IS NULL OR v_qty IS NULL OR v_qty<1 OR v_qty>10000 OR
     v_cost IS NULL OR v_cost<1 OR v_cost>1000000000 OR
     v_markup IS NULL OR v_markup<0 OR v_markup>1000
   THEN RAISE EXCEPTION 'PURCHASE_ITEMS_INVALID';END IF;
   IF v_product_id=ANY(v_seen) THEN RAISE EXCEPTION 'DUPLICATE_PURCHASE_PRODUCT';END IF;
   v_seen:=array_append(v_seen,v_product_id);
   v_qty_total:=v_qty_total+v_qty;
 END LOOP;
 -- Deterministic product row lock ordering minimizes concurrent receiving deadlocks.
 PERFORM 1 FROM public.products WHERE id=ANY(v_seen) ORDER BY id FOR UPDATE;
 IF (SELECT count(*) FROM public.products WHERE id=ANY(v_seen))<>cardinality(v_seen)
 THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND';END IF;
 INSERT INTO private.purchase_lots(supplier_id,service_city_id,location_id,idempotency_key,
   reference_code,purchased_at,freight_cents,other_costs_cents,notes)
 VALUES(v_supplier_id,v_location.service_city_id,v_location_id,v_request,v_ref,
   coalesce(nullif(p_payload->>'purchased_at','')::timestamptz,now()),v_freight,v_other,v_note)
 ON CONFLICT(idempotency_key) DO NOTHING RETURNING id INTO v_lot_id;
 IF v_lot_id IS NULL THEN
   SELECT id INTO v_lot_id FROM private.purchase_lots WHERE idempotency_key=v_request;
   RETURN jsonb_build_object('data',jsonb_build_object('lot_id',v_lot_id,'already_recorded',true));
 END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
   v_line:=v_line+1;
   v_product_id:=(v_item->>'product_id')::uuid;
   v_qty:=(v_item->>'quantity')::integer;
   v_cost:=(v_item->>'unit_cost_cents')::bigint;
   v_markup:=(v_item->>'markup_percent')::numeric;
   v_price:=round(v_cost*(1+v_markup/100))::bigint;
   SELECT name INTO v_product_name FROM public.products WHERE id=v_product_id;
   INSERT INTO private.purchase_lot_items(purchase_lot_id,product_id,quantity,unit_cost_cents,
     sale_price_cents,markup_percent,risk_type,risk_value_cents,risk_note)
   VALUES(v_lot_id,v_product_id,v_qty,v_cost,v_price,v_markup,
     CASE WHEN v_line=1 THEN v_risk ELSE NULL END,
     CASE WHEN v_line=1 THEN v_risk_value ELSE 0 END,
     CASE WHEN v_line=1 THEN v_risk_note ELSE NULL END);
   SELECT a.new_balance,a.movement_id INTO v_balance,v_movement
   FROM private.apply_inventory_adjustment(v_location_id,v_product_id,v_qty,'restock',
    'Entrada por compra '||coalesce(v_ref,v_lot_id::text)||coalesce(' - '||v_note,''),0,p_actor_id) a;
   INSERT INTO private.product_pricing(product_id,last_unit_cost_cents,markup_percent,
    last_purchase_lot_id,updated_by,updated_at)
   VALUES(v_product_id,v_cost,v_markup,v_lot_id,p_actor_id,now())
   ON CONFLICT(product_id) DO UPDATE SET
    last_unit_cost_cents=excluded.last_unit_cost_cents,markup_percent=excluded.markup_percent,
    last_purchase_lot_id=excluded.last_purchase_lot_id,updated_by=excluded.updated_by,updated_at=now();
   UPDATE public.products SET price_cents=v_price,sale_price_cents=NULL,updated_at=now()
   WHERE id=v_product_id;
   v_result:=v_result||jsonb_build_array(jsonb_build_object(
    'product_id',v_product_id,'product_name',v_product_name,'quantity',v_qty,
    'unit_cost_cents',v_cost,'markup_percent',v_markup,'sale_price_cents',v_price,
    'new_balance',v_balance,'movement_id',v_movement));
 END LOOP;
 RETURN jsonb_build_object('data',jsonb_build_object(
  'lot_id',v_lot_id,'already_recorded',false,'item_count',v_line,
  'total_units',v_qty_total,'items',v_result));
END $fn$;
REVOKE ALL ON FUNCTION public.azzena_admin_receive_purchase_items(jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.azzena_admin_receive_purchase_items(jsonb,uuid) TO service_role;
