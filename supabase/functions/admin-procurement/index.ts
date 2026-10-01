import { withSupabase } from "npm:@supabase/server";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
});
const knownErrors=new Set([
 "FORBIDDEN","SUPPLIER_NAME_REQUIRED","SUPPLIER_ALREADY_EXISTS","SUPPLIER_FIELDS_REQUIRED",
 "SUPPLIER_NOT_FOUND","SUPPLIER_NOT_ACTIVE","LOCATION_NOT_FOUND","PRODUCT_NOT_FOUND",
 "PRODUCT_COST_NOT_REGISTERED","REQUEST_ID_REQUIRED","PURCHASE_FIELDS_INVALID",
 "PURCHASE_COSTS_INVALID","PURCHASE_RISK_INVALID","MARKUP_INVALID","INVALID_LOT_ITEM",
 "PURCHASE_ITEMS_INVALID","DUPLICATE_PURCHASE_PRODUCT"
]);
export default {
 fetch:withSupabase({auth:"user"},async(req,ctx)=>{
  if(req.method==="OPTIONS")return new Response("ok");
  if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  const userId=ctx.userClaims?.sub??ctx.userClaims?.id;
  if(!userId)return json({error:"UNAUTHORIZED"},401);
  const {data:admin,error:adminError}=await ctx.supabaseAdmin.from("admin_users")
   .select("user_id").eq("user_id",userId).maybeSingle();
  if(adminError||!admin)return json({error:"FORBIDDEN"},403);
  const body=await req.json().catch(()=>({}));
  const action=String(body?.action||"");
  const allowed=new Set(["list_suppliers","create_supplier","update_supplier",
    "list_purchase_lots","receive_purchase","reprice_product"]);
  if(!allowed.has(action)){
   if(action==="create_purchase_lot")return json({error:"USE_PURCHASE_RECEIPT_FORM"},409);
   return json({error:"UNKNOWN_ACTION"},400);
  }
  const payload=action==="create_supplier"||action==="update_supplier"?
    (body?.supplier||{}):action==="receive_purchase"?(body?.purchase||{}):{};
  if(action==="receive_purchase"&&!/^[0-9a-f-]{36}$/i.test(String(payload.request_id||"")))
   return json({error:"REQUEST_ID_REQUIRED"},400);
  let data:any,error:any;
  if(action==="receive_purchase"&&Array.isArray(payload.items)){
   if(payload.items.length<1||payload.items.length>30)return json({error:"PURCHASE_ITEMS_INVALID"},400);
   ({data,error}=await ctx.supabaseAdmin.rpc("azzena_admin_receive_purchase_items",{
     p_payload:payload,p_actor_id:userId
   }));
  }else if(action==="reprice_product"){
   ({data,error}=await ctx.supabaseAdmin.rpc("azzena_admin_reprice_product",{
     p_actor_id:userId,p_product_id:body?.product_id,p_markup_percent:body?.markup_percent
   }));
  }else{
   ({data,error}=await ctx.supabaseAdmin.rpc("azzena_admin_procurement",{
     p_action:action,p_payload:payload,p_actor_id:userId
   }));
  }
  if(error){
   const message=String(error.message||"");
   const matched=[...knownErrors].find(code=>message.includes(code));
   if(matched)return json({error:matched},
     matched==="FORBIDDEN"?403:matched.endsWith("ALREADY_EXISTS")?409:matched.endsWith("NOT_FOUND")?404:400);
   console.error("Admin procurement failure",action,error.code||"UNKNOWN");
   return json({error:"PROCUREMENT_FAILED"},500);
  }
  return json(data,action==="create_supplier"||action==="receive_purchase"?201:200);
 })
};
