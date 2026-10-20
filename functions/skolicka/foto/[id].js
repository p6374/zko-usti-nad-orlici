// Veřejné fotografie uložené ve vyhrazeném KV školičky.
export async function onRequestGet({env,params}) {
  if(!env.SKOLICKA_KV||!/^[a-f0-9-]{36}$/.test(params.id||""))return new Response("Nenalezeno",{status:404});
  const result=await env.SKOLICKA_KV.getWithMetadata("skolicka:image:"+params.id,{type:"arrayBuffer"});
  if(!result.value||!["image/jpeg","image/png","image/webp"].includes(result.metadata?.type))return new Response("Nenalezeno",{status:404});
  return new Response(result.value,{headers:{"Content-Type":result.metadata.type,"Cache-Control":"public, max-age=86400","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
}