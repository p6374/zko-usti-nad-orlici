# Psí školička – oddělená správa ZKO

## Co přibývá
- Veřejný kalendář aktualit: `/skolicka/`
- Mobilní formulář správce: `/sprava-skolicky/`
- Správa data, času, názvu, místa, popisu, odkazu, fotografie, zveřejnění/smazání
- Přímé publikování bez schvalování a bez práva upravovat členy a psy.
- Veřejné fotky ve vyhrazených KV klíčích, bez potřeby přístupu do GitHubu.

**Kód sám o sobě ještě neaktivuje přihlášení ani ukládání.** Následující nastavení musí udělat vlastník Cloudflare účtu. Bez něj API z bezpečnostních důvodů vrací 503.

## Krok 1 — úložiště
1. Cloudflare → Workers & Pages → KV (úložiště Workers KV) → Create namespace (například `zko-skolicka`).
2. Workers & Pages → projekt `zko-usti-nad-orlici` → Settings → Bindings → Add → KV namespace.
3. **Variable name:** `SKOLICKA_KV` a vybrat vytvořené KV.
4. Po uložení znovu nasadit produkční projekt, aby binding platil. Nedávat správci přístup do dashboardu Cloudflare.

## Krok 2 — přihlášení jen do školičky
Potřebujeme Cloudflare Zero Trust / Access, aplikaci s vlastní Access policy, jejíž chráněná URL zahrnuje **`/sprava-skolicky/*`** a nikoliv celý veřejný web nebo `/skolicka/`.
- **Allow** pro e-mail majitele ZKO a e-mail pověřeného editora školičky.
- Preferovat vlastní Cloudflare / Google / GitHub identitu editora nebo **One-time PIN** na jeho e-mail; nepoužívat sdílené heslo.
- Získat *Application Audience (AUD)* a název Zero Trust týmu (`<team>.cloudflareaccess.com`).
- Pokud Pages funguje pouze na `*.pages.dev`, ověřit možnosti nastavení Access pro konkrétní cestu. Zapnutí globální Access ochrany celého produkčního `pages.dev` by uzavřelo i veřejný web — **to nedělat**. Pro cestově omezený Access je vhodná vlastní doména připojená k Pages a spravovaná přes Cloudflare.

Bez této Access ochrany bude statický formulář dostupný k zobrazení, **ale API musí vždy ověřit správně podepsaný JWT**, jinak odmítne čtení i zápis.

## Krok 3 — prostředí produkčního Pages projektu
Settings → Variables and Secrets → Add (pro Production):
- `CF_ACCESS_TEAM_NAME` = pouze jméno Zero Trust týmu před `.cloudflareaccess.com`
- `CF_ACCESS_AUD` = Access Application Audience (AUD)
- `SKOLICKA_EDITORS` = povolené e-maily oddělené čárkou, např. `spravce@priklad.cz,vedouci@priklad.cz`.

Pozor: e-mail vlastníka je nutné přidat do **obou** seznamů, tedy Cloudflare Access policy i `SKOLICKA_EDITORS`. Editor nedostává GitHub oprávnění.

## Krok 4 — test
1. Otevřít `/sprava-skolicky/` z mobilu. Přihlášení vyžádá Cloudflare Access.
2. Vytvořit testovací termín se zapnutým „Zveřejnit“ a fotografií.
3. Ověřit veřejnou stránku `/skolicka/` a hlavní web ZKO.
4. Zkusit otevřít editor z nepovoleného e-mailu: nesmí umožnit uložení ani načtení dat.
5. Odvolání práv: odebrat e-mail z Access policy **i** z proměnné `SKOLICKA_EDITORS`.

## Poznámky a omezení
- Workers KV může mít při šíření mezi datovými centry zpoždění přibližně desítky sekund.
- Limit je 80 záznamů a 3 MiB na nahranou fotografii. Klient fotografii komprimuje do JPG a nepřenáší běžná EXIF metadata.
- Jde o základní jednoredaktorový systém. Pokud začne upravovat více lidí současně, je vhodné doplnit transakční uložení (D1).
- Nepředávat žádná hesla nebo API tokeny do chatu; všechna nastavení se provádějí přímo v Cloudflare.
- Pro rozšíření práv v budoucnu vytvořit nové role a serverové endpointy, nikoliv dávat editorovi přístup do GitHubu nebo Cloudflare.
