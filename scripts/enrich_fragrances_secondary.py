import csv, io, json, re, unicodedata, urllib.request
from difflib import SequenceMatcher
from pathlib import Path

DATA_URL="https://raw.githubusercontent.com/balarabetahir/Perfume-Recommendation-with-Sentence-BERT/main/perfume_data.csv"
SOURCE_PAGE="https://github.com/balarabetahir/Perfume-Recommendation-with-Sentence-BERT/blob/main/perfume_data.csv"
CATALOG=Path("fragrance-data.js")
OUTPUT=Path("enrichment-secondary.json")

def norm(s):
    s=unicodedata.normalize("NFKD",str(s or "")).encode("ascii","ignore").decode().lower()
    s=s.replace("&"," and ")
    s=re.sub(r"\b(eau de parfum|eau de toilette|eau de cologne|eau fraiche|edp|edt|parfum|extrait de parfum|cologne|spray)\b"," ",s)
    s=re.sub(r"[^a-z0-9]+"," ",s)
    return " ".join(s.split())

def brand_norm(s):
    s=norm(s)
    aliases={
      "paco rabanne":"rabanne","rabanne":"rabanne",
      "christian dior":"dior","dior":"dior",
      "giorgio armani":"giorgio armani","armani":"giorgio armani",
      "dolce gabbana":"dolce gabbana","dolce and gabbana":"dolce gabbana",
      "victoria s secret":"victoria s secret","victorias secret":"victoria s secret",
      "viktor rolf":"viktor rolf","viktor and rolf":"viktor rolf",
      "o boticario":"o boticario","boticario":"o boticario"
    }
    return aliases.get(s,s)

txt=CATALOG.read_text(encoding="utf-8")
m=re.search(r"export const FRAGRANCE_CATALOG=(\[.*?\]);\s*export const VOLUME_OPTIONS",txt,re.S)
groups=json.loads(m.group(1))
targets=[]
for g in groups:
    for n in g.get("fragrances",[]): targets.append({"brand":g["brand"],"name":n,"product_type":"perfume"})
    for n in g.get("splashes",[]): targets.append({"brand":g["brand"],"name":n,"product_type":"body_splash"})

raw=urllib.request.urlopen(DATA_URL,timeout=90).read().decode("utf-8-sig",errors="replace")
rows=list(csv.DictReader(io.StringIO(raw)))
by_brand={}
for r in rows:
    by_brand.setdefault(brand_norm(r.get("Brand")),[]).append(r)

def notes(r):
    return [x.strip() for x in re.split(r"\s*,\s*",str(r.get("Notes") or "").strip()) if x.strip()]

out=[]
for t in targets:
    cand=by_brand.get(brand_norm(t["brand"]),[])
    ranked=[]
    tn=norm(t["name"])
    for r in cand:
        rn=norm(r.get("Name"))
        if not rn: continue
        sc=SequenceMatcher(None,tn,rn).ratio()
        if tn==rn: sc=1.0
        ns=notes(r)
        if ns: ranked.append((sc,r,ns))
    ranked.sort(key=lambda x:x[0],reverse=True)
    best=ranked[0] if ranked else None
    second=ranked[1] if len(ranked)>1 else None
    accepted=bool(best and (best[0]>=0.94 or (best[0]>=0.90 and (not second or best[0]-second[0]>=0.06))))
    out.append({**t,
      "matched":accepted,
      "match_score":round(best[0],4) if best else 0,
      "matched_name":best[1].get("Name") if best else None,
      "notes":best[2] if best else [],
      "source_url":SOURCE_PAGE,
      "second_score":round(second[0],4) if second else None,
      "second_name":second[1].get("Name") if second else None
    })
summary={"catalog_total":len(targets),"matched":sum(x["matched"] for x in out),"unmatched":sum(not x["matched"] for x in out)}
OUTPUT.write_text(json.dumps({"summary":summary,"items":out},ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(summary))
