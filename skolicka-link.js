// Nenápadný odkaz na termíny školičky vedle existující navigace Výcvikové kurzy.
document.addEventListener("DOMContentLoaded",()=>{
  if(document.querySelector('a[href="/skolicka/"]'))return;
  const links=Array.from(document.querySelectorAll("a"));
  const target=links.find(a=>/výcvikové kurzy/i.test((a.textContent||"").trim())&&a.closest("nav,header"))||
               links.find(a=>/výcvikové kurzy/i.test((a.textContent||"").trim()));
  if(target){
    const a=document.createElement("a");a.href="/skolicka/";a.textContent="Termíny školičky";
    a.className=target.className;
    const li=target.closest("li");
    if(li&&li.contains(target)){
      const extra=document.createElement("li");extra.className=li.className;extra.append(a);li.after(extra);
    }else{
      a.style.marginInlineStart="12px";target.after(a);
    }
  }else{
    const footer=document.querySelector("footer")||document.body;
    const a=document.createElement("a");a.href="/skolicka/";a.textContent="Termíny psí školičky";a.style.cssText="display:inline-block;margin:14px;padding:12px;border-radius:10px;background:#e2eee4;color:#154a35;";
    footer.append(a);
  }
});