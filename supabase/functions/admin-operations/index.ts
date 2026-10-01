import { withSupabase } from "npm:@supabase/server";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
const txt=(v:unknown)=>String(v??"").trim();
const num=(v:unknown,d=0)=>Number.isFinite(Number(v))?Math.trunc(Number(v)):d;
const arr=(v:unknown)=>Array.isArray(v)?v.map(x=>txt(x)).filter(Boolean):txt(v).split(",").map(x=>x.trim()).filter(Boolean);
const dayStart=(v:unknown)=>txt(v)?new Date(txt(v)+"T00:00:00.000Z").toISOString():null;
const dayEnd=(v:unknown)=>txt(v)?new Date(txt(v)+"T23:59:59.999Z").toISOString():null;

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok");
    if (req.method !== "POST") return json({error:"METHOD_NOT_ALLOWED"},405);
    const userId=ctx.userClaims?.sub??ctx.userClaims?.id;
    if(!userId) return json({error:"UNAUTHORIZED"},401);
    const {data:admin}=await ctx.supabaseAdmin.from("admin_users").select("user_id").eq("user_id",userId).maybeSingle();
    if(!admin) return json({error:"FORBIDDEN"},403);
    const body=await req.json().catch(()=>({}));
    const action=txt(body?.action);

    if(action==="dashboard"){
      const [pq,sq,cq,lq,bq,scq,oq,ssq]=await Promise.all([
        ctx.supabaseAdmin.from("products").select("id,slug,name,brand,product_type,category,volume_ml,price_cents,sale_price_cents,max_discount_percent,stock,short_description,description,composition,top_notes,heart_notes,base_notes,image_url,is_active,is_featured,is_best_seller,weight_kg,width_cm,height_cm,length_cm,created_at,updated_at").order("name"),
        ctx.supabaseAdmin.from("sellers").select("id,name,email,whatsapp_number,avatar_url,bio,is_active,approval_status,auth_user_id,can_toggle_site_emergency").order("name"),
        ctx.supabaseAdmin.from("service_cities").select("id,city_name,state_name,country_code,is_active").order("city_name"),
        ctx.supabaseAdmin.from("inventory_locations").select("id,name,service_city_id,seller_id,is_active,created_at").order("name"),
        ctx.supabaseAdmin.from("inventory_balances").select("location_id,product_id,quantity,low_stock_threshold,updated_at"),
        ctx.supabaseAdmin.from("seller_service_cities").select("seller_id,city_id,is_active"),
        ctx.supabaseAdmin.from("orders").select("id,public_id,customer_user_id,customer_name,customer_phone,customer_email,subtotal_cents,shipping_price_cents,total_cents,payment_method,payment_channel,payment_status,fulfillment_status,delivery_method,discount_cents,cash_received_cents,cash_change_cents,shipping_postal_code,shipping_street,shipping_number,shipping_complement,shipping_neighborhood,shipping_city,shipping_state,shipping_carrier,shipping_service,shipping_delivery_days,tracking_code,seller_id,pickup_location_snapshot,created_at,updated_at").order("created_at",{ascending:false}).limit(200),
        ctx.supabaseAdmin.from("shipping_settings").select("*").eq("id",true).maybeSingle()
      ]);
      if(pq.error||sq.error||cq.error||lq.error||bq.error||scq.error||oq.error||ssq.error) return json({error:"DATABASE_ERROR"},500);
      const products=pq.data??[], sellersRaw=sq.data??[], cities=cq.data??[], locations=lq.data??[], balances=bq.data??[], sellerCities=scq.data??[], orders=oq.data??[], shipping_settings=ssq.data??null;
      const sellers=sellersRaw.map((s:any)=>({...s,city_ids:sellerCities.filter((x:any)=>x.seller_id===s.id&&x.is_active).map((x:any)=>x.city_id)}));
      const pm=new Map(products.map((x:any)=>[x.id,x])), lm=new Map(locations.map((x:any)=>[x.id,x]));
      const sm=new Map(sellers.map((x:any)=>[x.id,x])), cm=new Map(cities.map((x:any)=>[x.id,x]));
      const inventory=balances.map((b:any)=>{
        const l:any=lm.get(b.location_id)??{}, p:any=pm.get(b.product_id)??{};
        return {...b,location_name:l.name??"",service_city_id:l.service_city_id??null,
          city_name:(cm.get(l.service_city_id) as any)?.city_name??"",seller_id:l.seller_id??null,
          seller_name:(sm.get(l.seller_id) as any)?.name??"",product_name:p.name??"",volume_ml:p.volume_ml??null,
          low_stock:Number(b.quantity)<=Number(b.low_stock_threshold)};
      });
      const shipping_provider_configured=!!((shipping_settings?.provider_environment==="production"?Deno.env.get("MELHOR_ENVIO_PRODUCTION_TOKEN"):Deno.env.get("MELHOR_ENVIO_SANDBOX_TOKEN"))||Deno.env.get("MELHOR_ENVIO_TOKEN"));
      return json({data:{products,sellers,cities,locations,inventory,orders,shipping_settings,shipping_provider_configured,mercado_pago_credentials_present:Boolean(Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")&&Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET"))}});
    }

    if(action==="inventory_history"){
      const [movements,products,locations]=await Promise.all([
        ctx.supabaseAdmin.from("inventory_movements")
        .select("id,product_id,inventory_location_id,quantity_delta,reason_code,note,financial_impact_cents,created_at")
        .order("created_at",{ascending:false}).limit(100),
        ctx.supabaseAdmin.from("products").select("id,name"),
        ctx.supabaseAdmin.from("inventory_locations").select("id,name")
      ]);
      if(movements.error||products.error||locations.error)return json({error:"INVENTORY_HISTORY_FAILED"},500);
      const pm=new Map((products.data||[]).map((x:any)=>[x.id,x.name]));
      const lm=new Map((locations.data||[]).map((x:any)=>[x.id,x.name]));
      return json({data:(movements.data||[]).map((x:any)=>({...x,
        product_name:pm.get(x.product_id)||"Produto removido",
        location_name:lm.get(x.inventory_location_id)||"Local removido"
      }))});
    }

    if(action==="create_product"){
      const name=txt(body?.name), productType=txt(body?.product_type)||"perfume", category=txt(body?.category), volume=num(body?.volume_ml), price=Math.max(0,num(body?.price_cents));
      if(!name||!["perfume","body_splash"].includes(productType)||!["masculino","feminino","unissex"].includes(category)||volume<=0) return json({error:"PRODUCT_FIELDS_REQUIRED"},400);
      if(!Number.isFinite(Number(body?.max_discount_percent??0))||Number(body?.max_discount_percent??0)<0||Number(body?.max_discount_percent??0)>100)return json({error:"DISCOUNT_LIMIT_INVALID"},400);
      const base=name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,56)||"produto";
      const slug=base+"-"+crypto.randomUUID().slice(0,6);
      const {data,error}=await ctx.supabaseAdmin.from("products").insert({
        slug,name,brand:txt(body?.brand)||null,product_type:productType,category,volume_ml:volume,price_cents:price,
        sale_price_cents:body?.sale_price_cents===""||body?.sale_price_cents==null?null:Math.max(0,num(body?.sale_price_cents)),
        max_discount_percent:Math.round(Number(body?.max_discount_percent||0)*100)/100,
        stock:0,short_description:txt(body?.short_description)||null,description:txt(body?.description)||null,
        composition:txt(body?.composition)||null,top_notes:arr(body?.top_notes),heart_notes:arr(body?.heart_notes),base_notes:arr(body?.base_notes),
        weight_kg:Math.max(0.001,Number(body?.weight_kg||0.5)),width_cm:Math.max(1,Number(body?.width_cm||12)),height_cm:Math.max(1,Number(body?.height_cm||15)),length_cm:Math.max(1,Number(body?.length_cm||8)),
        is_active:true,is_featured:body?.is_featured===true,is_best_seller:body?.is_best_seller===true
      }).select().single();
      if(error) return json({error:"PRODUCT_CREATE_FAILED"},500);
      return json({data},201);
    }

    if(action==="update_product"){
      const id=txt(body?.id), name=txt(body?.name), productType=txt(body?.product_type)||"perfume", category=txt(body?.category), volume=num(body?.volume_ml), price=Math.max(0,num(body?.price_cents));
      if(!id||!name||!["perfume","body_splash"].includes(productType)||!["masculino","feminino","unissex"].includes(category)||volume<=0) return json({error:"PRODUCT_FIELDS_REQUIRED"},400);
      if(!Number.isFinite(Number(body?.max_discount_percent??0))||Number(body?.max_discount_percent??0)<0||Number(body?.max_discount_percent??0)>100)return json({error:"DISCOUNT_LIMIT_INVALID"},400);
      const payload:any={
        name,brand:txt(body?.brand)||null,product_type:productType,category,volume_ml:volume,price_cents:price,
        sale_price_cents:body?.sale_price_cents===""||body?.sale_price_cents==null?null:Math.max(0,num(body?.sale_price_cents)),
        max_discount_percent:Math.round(Number(body?.max_discount_percent||0)*100)/100,
        short_description:txt(body?.short_description)||null,description:txt(body?.description)||null,
        composition:txt(body?.composition)||null,top_notes:arr(body?.top_notes),heart_notes:arr(body?.heart_notes),base_notes:arr(body?.base_notes),
        weight_kg:Math.max(0.001,Number(body?.weight_kg||0.5)),width_cm:Math.max(1,Number(body?.width_cm||12)),height_cm:Math.max(1,Number(body?.height_cm||15)),length_cm:Math.max(1,Number(body?.length_cm||8)),
        is_featured:body?.is_featured===true,is_best_seller:body?.is_best_seller===true,is_active:body?.is_active!==false,
        updated_at:new Date().toISOString()
      };
      const {data,error}=await ctx.supabaseAdmin.from("products").update(payload).eq("id",id).select().single();
      if(error) return json({error:"PRODUCT_UPDATE_FAILED"},500);
      return json({data});
    }

    if(action==="delete_product"){
      const id=txt(body?.id);
      if(!id) return json({error:"PRODUCT_ID_REQUIRED"},400);
      const {data,error}=await ctx.supabaseAdmin.from("products").update({is_active:false,updated_at:new Date().toISOString()}).eq("id",id).select("id,name,is_active").single();
      if(error) return json({error:"PRODUCT_DELETE_FAILED"},500);
      return json({data});
    }

    if(action==="restore_product"){
      const id=txt(body?.id);
      if(!id) return json({error:"PRODUCT_ID_REQUIRED"},400);
      const {data,error}=await ctx.supabaseAdmin.from("products").update({is_active:true,updated_at:new Date().toISOString()}).eq("id",id).select("id,name,is_active").single();
      if(error) return json({error:"PRODUCT_RESTORE_FAILED"},500);
      return json({data});
    }

    if(action==="create_city"){
      const city_name=txt(body?.city_name).replace(/\s+/g," ").trim();
      const state_name=txt(body?.state_name).replace(/\s+/g," ").trim();
      const country_code=(txt(body?.country_code)||"BR").toUpperCase().slice(0,2);
      if(!city_name) return json({error:"CITY_REQUIRED"},400);

      let existingQuery=ctx.supabaseAdmin.from("service_cities")
        .select("id,city_name,state_name,country_code,is_active")
        .ilike("city_name",city_name)
        .eq("country_code",country_code);
      existingQuery=state_name?existingQuery.ilike("state_name",state_name):existingQuery.is("state_name",null);
      const {data:existing,error:existingError}=await existingQuery.limit(1).maybeSingle();
      if(existingError) return json({error:"CITY_LOOKUP_FAILED"},500);

      if(existing){
        if(!existing.is_active){
          const {data,error}=await ctx.supabaseAdmin.from("service_cities")
            .update({is_active:true}).eq("id",existing.id).select().single();
          if(error) return json({error:"CITY_RESTORE_FAILED"},500);
          return json({data,restored:true},200);
        }
        return json({data:existing,already_exists:true},200);
      }

      const {data,error}=await ctx.supabaseAdmin.from("service_cities").insert({
        city_name,state_name:state_name||null,country_code,is_active:true
      }).select().single();
      if(error) return json({error:"CITY_CREATE_FAILED",detail:error.code||null},500);
      return json({data},201);
    }

    if(action==="create_seller"){
      const name=txt(body?.name), whatsapp_number=txt(body?.whatsapp_number), email=txt(body?.email).toLowerCase();
      if(!name||!whatsapp_number) return json({error:"SELLER_FIELDS_REQUIRED"},400);
      const {data:seller,error}=await ctx.supabaseAdmin.from("sellers").insert({
        name,whatsapp_number,email:email||null,avatar_url:txt(body?.avatar_url)||null,bio:txt(body?.bio)||null,
        is_active:true,can_toggle_site_emergency:body?.can_toggle_site_emergency===true
      }).select().single();
      if(error||!seller) return json({error:"SELLER_CREATE_FAILED"},500);
      await ctx.supabaseAdmin.from("seller_checkout_options").upsert({
        seller_id:seller.id,display_name:seller.name,avatar_url:seller.avatar_url,is_active:true
      });
      const cityIds=Array.isArray(body?.city_ids)?body.city_ids.filter(Boolean):[];
      if(cityIds.length) await ctx.supabaseAdmin.from("seller_service_cities").upsert(cityIds.map((city_id:string)=>({seller_id:seller.id,city_id,is_active:true})));
      return json({data:seller},201);
    }

    if(action==="update_seller"){
      const id=txt(body?.id), name=txt(body?.name), whatsapp_number=txt(body?.whatsapp_number), email=txt(body?.email).toLowerCase();
      if(!id||!name||!whatsapp_number) return json({error:"SELLER_FIELDS_REQUIRED"},400);

      const {data:current,error:currentError}=await ctx.supabaseAdmin.from("sellers")
        .select("id,name,email,whatsapp_number,avatar_url,bio,is_active,approval_status,can_toggle_site_emergency,auth_user_id")
        .eq("id",id).maybeSingle();
      if(currentError||!current) return json({error:"SELLER_NOT_FOUND"},404);

      const payload:any={
        name,whatsapp_number,email:email||null,avatar_url:txt(body?.avatar_url)||null,bio:txt(body?.bio)||null,
        is_active:body?.is_active!==false && current.approval_status==="approved",can_toggle_site_emergency:body?.can_toggle_site_emergency===true,
        updated_at:new Date().toISOString()
      };

      const {data:seller,error}=await ctx.supabaseAdmin.from("sellers").update(payload).eq("id",id).select().single();
      if(error||!seller) return json({error:"SELLER_UPDATE_FAILED"},500);

      if(current.auth_user_id && email && email!==String(current.email||"").toLowerCase()){
        const {error:authError}=await ctx.supabaseAdmin.auth.admin.updateUserById(current.auth_user_id,{email,email_confirm:true});
        if(authError){
          await ctx.supabaseAdmin.from("sellers").update({email:current.email,updated_at:new Date().toISOString()}).eq("id",id);
          return json({error:"SELLER_AUTH_EMAIL_UPDATE_FAILED"},500);
        }
      }

      const {error:checkoutError}=await ctx.supabaseAdmin.from("seller_checkout_options").upsert({
        seller_id:id,display_name:name,avatar_url:txt(body?.avatar_url)||null,is_active:payload.is_active
      },{onConflict:"seller_id"});
      if(checkoutError) return json({error:"SELLER_CHECKOUT_SYNC_FAILED"},500);

      const cityIds=Array.isArray(body?.city_ids)?[...new Set(body.city_ids.map((x:any)=>txt(x)).filter(Boolean))]:[];
      const {error:disableCitiesError}=await ctx.supabaseAdmin.from("seller_service_cities").update({is_active:false}).eq("seller_id",id);
      if(disableCitiesError) return json({error:"SELLER_CITY_UPDATE_FAILED"},500);
      if(cityIds.length){
        const {error:cityError}=await ctx.supabaseAdmin.from("seller_service_cities").upsert(
          cityIds.map((city_id:string)=>({seller_id:id,city_id,is_active:true})),
          {onConflict:"seller_id,city_id"}
        );
        if(cityError) return json({error:"SELLER_CITY_UPDATE_FAILED"},500);
      }

      return json({data:{...seller,city_ids:cityIds}});
    }

    if(action==="review_seller"){
      const id=txt(body?.id),decision=txt(body?.decision);
      if(!id||!["approve","reject"].includes(decision))return json({error:"REVIEW_FIELDS_INVALID"},400);
      const {data:current,error:lookupError}=await ctx.supabaseAdmin.from("sellers")
        .select("id,name,email,auth_user_id,is_active,approval_status,avatar_url").eq("id",id).maybeSingle();
      if(lookupError||!current)return json({error:"SELLER_NOT_FOUND"},404);
      if(!current.auth_user_id)return json({error:"SELLER_ACCOUNT_NOT_LINKED"},409);
      const active=decision==="approve";
      const {data:result,error:updateError}=await ctx.supabaseAdmin.from("sellers")
        .update({approval_status:active?"approved":"rejected",is_active:active,updated_at:new Date().toISOString()})
        .eq("id",id).select().single();
      if(updateError)return json({error:"SELLER_REVIEW_FAILED"},500);
      const {error:checkoutError}=await ctx.supabaseAdmin.from("seller_checkout_options").upsert({
        seller_id:id,display_name:current.name,avatar_url:current.avatar_url||null,is_active:active
      },{onConflict:"seller_id"});
      if(checkoutError)return json({error:"SELLER_CHECKOUT_SYNC_FAILED"},500);
      return json({data:result});
    }

    if(action==="create_location"){
      const name=txt(body?.name), service_city_id=txt(body?.service_city_id)||null, seller_id=txt(body?.seller_id)||null;
      if(!name) return json({error:"LOCATION_NAME_REQUIRED"},400);
      const {data,error}=await ctx.supabaseAdmin.from("inventory_locations").insert({name,service_city_id,seller_id,is_active:true}).select().single();
      if(error) return json({error:"LOCATION_CREATE_FAILED"},500);
      return json({data},201);
    }

    if(action==="adjust_inventory"){
      const locationId=txt(body?.location_id),productId=txt(body?.product_id);
      const direction=txt(body?.direction),qty=Number(body?.quantity),reason=txt(body?.reason_code);
      const note=txt(body?.note),impact=body?.financial_impact_cents;
      if(!locationId||!productId||!["entry","exit"].includes(direction)||
         !Number.isSafeInteger(qty)||qty<1||qty>10000||!reason)
        return json({error:"ADJUSTMENT_FIELDS_REQUIRED"},400);
      if(direction==="exit"&&note.length<5)return json({error:"JUSTIFICATION_REQUIRED"},400);
      const {data,error}=await ctx.supabaseAdmin.rpc("azzena_admin_adjust_inventory",{
        p_actor_id:userId,p_location_id:locationId,p_product_id:productId,
        p_direction:direction,p_quantity:qty,p_reason_code:reason,
        p_note:note,p_financial_impact_cents:impact==null?null:Number(impact)
      });
      if(error){
        const message=String(error.message||"");
        if(message.includes("insufficient stock"))return json({error:"INSUFFICIENT_STOCK"},409);
        if(message.includes("RESERVED_STOCK_CONFLICT"))return json({error:"RESERVED_STOCK_CONFLICT"},409);
        const known=["JUSTIFICATION_REQUIRED","INVALID_MOVEMENT_QUANTITY","INVALID_MOVEMENT_REASON",
          "LOCATION_NOT_FOUND","PRODUCT_NOT_FOUND","INVALID_IMPACT"];
        const mapped=known.find(x=>message.includes(x));
        if(mapped)return json({error:mapped},400);
        console.error("Inventory adjustment failure",error.code||"UNKNOWN");
        return json({error:"ADJUSTMENT_FAILED"},500);
      }
      return json(data);
    }

    if(action==="set_low_stock_threshold"){
      const locationId=txt(body?.location_id),productId=txt(body?.product_id),threshold=Math.max(0,num(body?.threshold));
      if(!locationId||!productId) return json({error:"FIELDS_REQUIRED"},400);
      const {data:existing}=await ctx.supabaseAdmin.from("inventory_balances").select("quantity").eq("location_id",locationId).eq("product_id",productId).maybeSingle();
      const {error}=await ctx.supabaseAdmin.from("inventory_balances").upsert({
        location_id:locationId,product_id:productId,quantity:Number(existing?.quantity??0),low_stock_threshold:threshold,updated_at:new Date().toISOString()
      },{onConflict:"location_id,product_id"});
      if(error) return json({error:"THRESHOLD_UPDATE_FAILED"},500);
      return json({ok:true});
    }

    if(action==="update_shipping_settings"){
      if(body?.shipping_enabled===true)return json({error:"SHIPPING_DISABLED_UNTIL_LAUNCH"},403);
      if(body?.shipping_enabled===true)return json({error:"SHIPPING_DISABLED_UNTIL_LAUNCH"},409);
      const origin=txt(body?.origin_postal_code).replace(/\D/g,"");
      const env=txt(body?.provider_environment)||"sandbox";
      if(origin && origin.length!==8) return json({error:"ORIGIN_POSTAL_CODE_INVALID"},400);
      if(!["sandbox","production"].includes(env)) return json({error:"SHIPPING_ENV_INVALID"},400);
      const payload:any={
        provider:"melhor_envio",provider_environment:env,origin_postal_code:origin||null,
        allowed_state:"SP",shipping_enabled:false,tracking_enabled:false,
        public_note:txt(body?.public_note)||"Envios disponíveis para o Estado de São Paulo. O rastreio detalhado será configurado em uma próxima etapa.",
        updated_at:new Date().toISOString()
      };
      const {data,error}=await ctx.supabaseAdmin.from("shipping_settings").upsert({id:true,...payload},{onConflict:"id"}).select().single();
      if(error) return json({error:"SHIPPING_SETTINGS_UPDATE_FAILED"},500);
      return json({data});
    }

    if(action==="update_order_status"){
      const id=txt(body?.id), fulfillment=txt(body?.fulfillment_status), payment=txt(body?.payment_status);
      if(!id) return json({error:"ORDER_ID_REQUIRED"},400);
      const allowedFulfillment=["pending","preparing","ready","shipped","delivered","cancelled"];
      const allowedPayment=["pending","approved","rejected","cancelled","refunded"];
      if(fulfillment&&!allowedFulfillment.includes(fulfillment)) return json({error:"ORDER_STATUS_INVALID"},400);
      if(payment&&!allowedPayment.includes(payment)) return json({error:"PAYMENT_STATUS_INVALID"},400);
      const original=await ctx.supabaseAdmin.from("orders")
        .select("payment_channel,payment_status,fulfillment_status").eq("id",id).maybeSingle();
      if(original.error||!original.data)return json({error:"ORDER_NOT_FOUND"},404);
      if(payment&&payment!==original.data.payment_status&&["mercadopago","seller_cash"].includes(original.data.payment_channel))
        return json({error:"PAYMENT_VERIFICATION_REQUIRED"},403);
      if(fulfillment&&["preparing","ready","shipped","delivered"].includes(fulfillment)&&original.data.payment_status!=="approved")
        return json({error:"PAYMENT_REQUIRED_BEFORE_FULFILLMENT"},409);
      const {data:current,error:currentError}=await ctx.supabaseAdmin.from("orders")
        .select("id,payment_channel,payment_status,fulfillment_status,delivery_method").eq("id",id).maybeSingle();
      if(currentError||!current)return json({error:"ORDER_NOT_FOUND"},404);
      if(current.payment_channel==="mercadopago"&&payment==="approved")
        return json({error:"PAYMENT_CONFIRMATION_REQUIRES_VERIFIED_GATEWAY"},403);
      if(fulfillment&&["preparing","ready","shipped","delivered"].includes(fulfillment)&&current.payment_status!=="approved")
        return json({error:"PAYMENT_NOT_CONFIRMED"},409);
      if(current.delivery_method==="presencial"&&fulfillment==="shipped")
        return json({error:"PICKUP_CANNOT_BE_SHIPPED"},400);
      if(current.fulfillment_status==="delivered"&&fulfillment&&fulfillment!=="delivered")
        return json({error:"DELIVERED_ORDER_IS_FINAL"},409);
      const payload:any={updated_at:new Date().toISOString()};
      if(fulfillment) payload.fulfillment_status=fulfillment;
      if(payment) payload.payment_status=payment;
      const {data,error}=await ctx.supabaseAdmin.from("orders").update(payload).eq("id",id).select().single();
      if(error||!data) return json({error:"ORDER_UPDATE_FAILED"},500);
      if(fulfillment){
        await ctx.supabaseAdmin.from("order_status_history").insert({order_id:id,status:fulfillment,note:txt(body?.note)||null,changed_by:userId});
      }
      return json({data});
    }

    if(action==="reports"){
      const from=dayStart(body?.from),to=dayEnd(body?.to),sellerId=txt(body?.seller_id),productId=txt(body?.product_id),cityId=txt(body?.city_id);
      let oq=ctx.supabaseAdmin.from("orders").select("id,public_id,seller_id,service_city_id,total_cents,payment_status,created_at");
      if(from) oq=oq.gte("created_at",from); if(to) oq=oq.lte("created_at",to);
      if(sellerId) oq=oq.eq("seller_id",sellerId); if(cityId) oq=oq.eq("service_city_id",cityId);
      let mq=ctx.supabaseAdmin.from("inventory_movements").select("id,seller_id,product_id,inventory_location_id,reason_code,quantity_delta,financial_impact_cents,note,created_at");
      if(from) mq=mq.gte("created_at",from); if(to) mq=mq.lte("created_at",to); if(sellerId) mq=mq.eq("seller_id",sellerId); if(productId) mq=mq.eq("product_id",productId);
      const [ordersQ,movQ,lotsQ,locQ,sellQ,cityQ,prodQ]=await Promise.all([
        oq,mq,
        (async()=>{const result=await ctx.supabaseAdmin.rpc("azzena_admin_procurement",{
            p_action:"report_costs",p_payload:{},p_actor_id:userId
          });return {data:result.data?.data||[],error:result.error}})(),
        ctx.supabaseAdmin.from("inventory_locations").select("id,service_city_id,seller_id,name"),
        ctx.supabaseAdmin.from("sellers").select("id,name"),
        ctx.supabaseAdmin.from("service_cities").select("id,city_name"),
        ctx.supabaseAdmin.from("products").select("id,name,volume_ml")
      ]);
      if(ordersQ.error||movQ.error||lotsQ.error||locQ.error||sellQ.error||cityQ.error||prodQ.error) return json({error:"REPORT_QUERY_FAILED"},500);
      const locations:any[]=locQ.data??[], pm=new Map((prodQ.data??[]).map((x:any)=>[x.id,x])), lm=new Map(locations.map((x:any)=>[x.id,x]));
      const sm=new Map((sellQ.data??[]).map((x:any)=>[x.id,x.name])), cm=new Map((cityQ.data??[]).map((x:any)=>[x.id,x.city_name]));
      let movements:any[]=[...(movQ.data??[])];
      if(cityId){const valid=new Set(locations.filter((l:any)=>l.service_city_id===cityId).map((l:any)=>l.id));movements=movements.filter((m:any)=>valid.has(m.inventory_location_id));}
      const approved=(ordersQ.data??[]).filter((o:any)=>o.payment_status==="approved");
      const ids=approved.map((o:any)=>o.id);
      let items:any[]=[];
      if(ids.length){
        let iq=ctx.supabaseAdmin.from("order_items").select("order_id,product_id,product_name,quantity,unit_price_cents,line_total_cents").in("order_id",ids);
        if(productId) iq=iq.eq("product_id",productId);
        const ir=await iq;if(ir.error)return json({error:"REPORT_ITEMS_FAILED"},500);items=ir.data??[];
      }
      const cq=new Map<string,{cost:number,qty:number}>();
      for(const x of(lotsQ.data??[])){const c=cq.get(x.product_id)??{cost:0,qty:0};c.cost+=Number(x.unit_cost_cents)*Number(x.quantity);c.qty+=Number(x.quantity);cq.set(x.product_id,c);}
      let sales=0,cogs=0;for(const i of items){sales+=Number(i.line_total_cents);const c=cq.get(i.product_id);cogs+=Math.round((c&&c.qty?c.cost/c.qty:0)*Number(i.quantity));}
      const lossSet=new Set(["breakage","damage","loss","seizure","road_loss"]);
      const losses=movements.filter((m:any)=>lossSet.has(m.reason_code)),gifts=movements.filter((m:any)=>m.reason_code==="gift"),road=movements.filter((m:any)=>m.reason_code==="road_loss");
      const loss=losses.reduce((s:number,m:any)=>s+Number(m.financial_impact_cents||0),0),gift=gifts.reduce((s:number,m:any)=>s+Number(m.financial_impact_cents||0),0),roadLoss=road.reduce((s:number,m:any)=>s+Number(m.financial_impact_cents||0),0);
      const gross=sales-cogs,net=gross-loss-gift;
      const rows=movements.map((m:any)=>{const p:any=pm.get(m.product_id)??{},l:any=lm.get(m.inventory_location_id)??{};return {...m,product_name:p.name??"",volume_ml:p.volume_ml??null,seller_name:sm.get(m.seller_id)??"",location_name:l.name??"",city_name:cm.get(l.service_city_id)??""};});
      const risks=(lotsQ.data??[]).map((x:any)=>({product_id:x.product_id,product_name:(pm.get(x.product_id) as any)?.name??"",risk_type:x.risk_type,risk_value_cents:Number(x.risk_value_cents||0),quantity:Number(x.quantity||0)})).filter((x:any)=>x.risk_type||x.risk_value_cents);
      return json({data:{summary:{approved_orders:approved.length,sales_cents:sales,cogs_cents:cogs,gross_profit_cents:gross,gross_margin_percent:sales?Number((gross/sales*100).toFixed(2)):0,loss_cents:loss,gift_cents:gift,road_loss_cents:roadLoss,loss_percent_of_sales:sales?Number((loss/sales*100).toFixed(2)):0,gift_percent_of_sales:sales?Number((gift/sales*100).toFixed(2)):0,net_operational_cents:net},sales:items,movements:rows,risks}});
    }
    return json({error:"UNKNOWN_ACTION"},400);
  })
};