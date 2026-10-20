// Oddělené rozhraní správce školičky. Bez ověřeného Cloudflare Access neumožní žádné změny.
// Potřebuje KV binding SKOLICKA_KV a proměnné CF_ACCESS_TEAM_NAME, CF_ACCESS_AUD, SKOLICKA_EDITORS.
const DATA_KEY = "skolicka:items";
const MAX_IMAGE = 3 * 1024 * 1024;
let jwksMemo = null, jwksUntil = 0;
const json = (value, status=200) => Response.json(value, {status, headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const err = (message,status=400) => json({error:message},status);
function decode64(s) {
  const bin=atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4));
  return Uint8Array.from(bin, c=>c.charCodeAt(0));
}
function claim(s) {return JSON.parse(new TextDecoder().decode(decode64(s)));}
async function editor(req, env) {
  const name=(env.CF_ACCESS_TEAM_NAME||"").trim();
  const audience=(env.CF_ACCESS_AUD||"").trim();
  const allowed=(env.SKOLICKA_EDITORS||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
  if(!/^[a-z0-9-]{2,64}$/i.test(name)||!audience||!allowed.length) return {error:"Chybí nastavení ověření správce.", status:503};
  const token=req.headers.get("Cf-Access-Jwt-Assertion")||"";
  const parts=token.split(".");
  if(parts.length!==3) return {error:"Přihlášení je vyžadováno.",status:401};
  try {
    const header=claim(parts[0]), data=claim(parts[1]);
    const issuer="https://"+name+".cloudflareaccess.com";
    if(header.alg!=="RS256"||typeof header.kid!=="string"||
        data.iss!==issuer||
        !(Array.isArray(data.aud)?data.aud:[data.aud]).includes(audience)||
        typeof data.exp!=="number"||data.exp<=Date.now()/1000||
        (data.nbf && data.nbf>Date.now()/1000+30)||
        typeof data.email!=="string"||!allowed.includes(data.email.toLowerCase())) {
      return {error:"Tento účet nemá právo upravovat školičku.",status:403};
    }
    if(!jwksMemo||Date.now()>jwksUntil) {
      const response=await fetch(issuer+"/cdn-cgi/access/certs",{signal:AbortSignal.timeout(5000)});
      if(!response.ok) throw new Error("Access keys unavailable");
      const payload=await response.json();
      if(!Array.isArray(payload.keys)) throw new Error("Access keys invalid");
      jwksMemo=payload.keys; jwksUntil=Date.now()+300000;
    }
    const jwk=jwksMemo.find(k=>k.kid===header.kid&&k.kty==="RSA");
    if(!jwk) return {error:"Nepodařilo se ověřit přihlášení.",status:401};
    const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    const good=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode64(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
    return good ? {email:data.email} : {error:"Nepodařilo se ověřit přihlášení.",status:401};
  } catch {
    return {error:"Přihlášení se nepodařilo bezpečně ověřit.",status:401};
  }
}
const str=(v,max)=>typeof v==="string" ? v.trim().slice(0,max) : "";
function validItem(v) {
  if(!v||typeof v!=="object"||Array.isArray(v)) return null;
  const id=str(v.id,70),title=str(v.title,120),date=str(v.date,10),
        time=str(v.time,5),location=str(v.location,130),description=str(v.description,1800),
        image=str(v.image,100),link=str(v.link,500);
  if(!/^[a-f0-9-]{36}$/.test(id)||!title||
     !/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+"T12:00:00Z"))||
     (time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))||
     (image&&!/^\/skolicka\/foto\/[a-f0-9-]{36}$/.test(image))) return null;
  if(link){try{const u=new URL(link); if(u.protocol!=="https:")return null;}catch{return null;}}
  return {id,title,date,time,location,description,image,link,published:v.published===true};
}
function isImage(buffer,type) {
  const b=new Uint8Array(buffer);
  return (type==="image/jpeg"&&b.length>3&&b[0]===255&&b[1]===216&&b[2]===255)||
  (type==="image/png"&&b.length>8&&b.slice(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i]))||
  (type==="image/webp"&&b.length>12&&String.fromCharCode(...b.slice(0,4))==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WEBP");
}
export async function onRequest(context) {
  const {request,env}=context;
  if(!env.SKOLICKA_KV) return err("Je potřeba připojit úložiště SKOLICKA_KV v Cloudflare.",503);
  const user=await editor(request,env);
  if(user.error) return err(user.error,user.status);
  const action=context.params.action;
  if(action!=="data"&&action!=="image") return err("Nenalezeno.",404);
  if(request.method==="GET"&&action==="data"){
    const items=await env.SKOLICKA_KV.get(DATA_KEY,"json");
    return json({items:Array.isArray(items)?items:[], editor:user.email});
  }
  if(request.method!=="POST") return err("Nepodporovaná metoda.",405);
  // Zápisy smějí přicházet pouze z naší administrace, nikoliv z jiných webů.
  const origin=request.headers.get("Origin");
  if(origin!==new URL(request.url).origin) return err("Nepovolený původ požadavku.",403);
  if(action==="data") {
    if(!(request.headers.get("Content-Type")||"").includes("application/json"))return err("Neplatný formát.",415);
    if(Number(request.headers.get("Content-Length")||0)>100000)return err("Příliš mnoho dat.",413);
    let body;
    try {body=await request.json();}catch{return err("Neplatný JSON.");}
    if(!body||!Array.isArray(body.items)||body.items.length>80)return err("Maximálně 80 záznamů.");
    const cleaned=body.items.map(validItem);
    if(cleaned.some(x=>!x)||new Set(cleaned.map(x=>x.id)).size!==cleaned.length)return err("Některý záznam je neplatný.");
    const encoded=JSON.stringify(cleaned);
    if(encoded.length>100000)return err("Data překročila povolenou velikost.",413);
    await env.SKOLICKA_KV.put(DATA_KEY,encoded);
    return json({ok:true,items:cleaned});
  }
  const type=(request.headers.get("Content-Type")||"").split(";")[0].trim().toLowerCase();
  if(!["image/jpeg","image/png","image/webp"].includes(type))return err("Povolené jsou JPG, PNG nebo WEBP.");
  if(Number(request.headers.get("Content-Length")||0)>MAX_IMAGE)return err("Fotografie je příliš velká.",413);
  const bytes=await request.arrayBuffer();
  if(!bytes.byteLength||bytes.byteLength>MAX_IMAGE||!isImage(bytes,type))return err("Soubor není platný obrázek JPG, PNG nebo WEBP.");
  const id=crypto.randomUUID();
  await env.SKOLICKA_KV.put("skolicka:image:"+id,bytes,{metadata:{type}});
  return json({ok:true,url:"/skolicka/foto/"+id});
}
