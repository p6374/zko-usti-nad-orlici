// Veřejná data termínů a aktualit školičky – bez editačního přístupu.
export async function onRequestGet({env}) {
  if(!env.SKOLICKA_KV) return Response.json({items:[],ready:false},{headers:{"Cache-Control":"no-store"}});
  const items=await env.SKOLICKA_KV.get("skolicka:items","json");
  return Response.json({items:(Array.isArray(items)?items:[]).filter(item=>item.published===true),ready:true},{
    headers:{"Cache-Control":"public, max-age=30","X-Content-Type-Options":"nosniff"}});
}