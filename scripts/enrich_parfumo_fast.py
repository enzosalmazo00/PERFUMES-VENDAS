import gzip, html as htmlmod, json, re, unicodedata, urllib.request, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlparse, urlunparse
from xml.etree import ElementTree as ET

PENDING=Path("pending-fragrances.json")
OUTPUT=Path("enrichment-parfumo-fast.json")
SITEMAP="https://www.parfumo.com/sitemap_en.xml"
UA="Mozilla/5.0 (compatible; AZZENA-Catalog-Enrichment/1.0)"

def norm(s):
    s=unicodedata.normalize("NFKD",str(s or "")).encode("ascii","ignore").decode().lower()
    s=s.replace("&"," and ")
    s=re.sub(r"\b(eau de parfum|eau de toilette|eau de cologne|eau fraiche|edp|edt|parfum|extrait|cologne|spray|pour homme|pour femme|for men|for women|intense|intensement)\b"," ",s)
    s=re.sub(r"[^a-z0-9]+"," ",s)
    return " ".join(s.split())

ALIASES={
 "afnan":"afnan perfumes","afnan perfumes":"afnan perfumes",
 "rabanne":"paco rabanne","paco rabanne":"paco rabanne",
 "dior":"dior","christian dior":"dior",
 "giorgio armani":"giorgio armani","armani":"giorgio armani",
 "dolce gabbana":"dolce gabbana","dolce and gabbana":"dolce gabbana",
 "victoria s secret":"victoria s secret","victorias secret":"victoria s secret",
 "viktor rolf":"viktor rolf","viktor and rolf":"viktor rolf",
 "o boticario":"o boticario","boticario":"o boticario",
 "bath body works":"bath body works","bath and body works":"bath body works",
 "jo malone london":"jo malone","jo malone":"jo malone",
}
def bnorm(s):
    x=norm(s); return ALIASES.get(x,x)

def fetch(url, timeout=18, attempts=2):
    last=None
    for k in range(attempts):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept-Language":"en-US,en;q=0.9"})
            with urllib.request.urlopen(req,timeout=timeout) as r:
                d=r.read()
                if d[:2]==b"\x1f\x8b": d=gzip.decompress(d)
                return d
        except Exception as e:
            last=e
            if k+1<attempts: time.sleep(.5)
    raise last

def locs(d):
    root=ET.fromstring(d)
    return [e.text.strip() for e in root.iter() if e.tag.endswith("loc") and e.text]

def product_parts(url):
    p=urlparse(url); seg=[x for x in p.path.split("/") if x]
    idx=next((i for i,x in enumerate(seg) if x.lower() in {"perfumes","parfums"}),None)
    if idx is None or len(seg)<=idx+2:return None
    brand=seg[idx+1].replace("_"," ").replace("-"," ")
    name=seg[idx+2].replace("_"," ").replace("-"," ")
    return bnorm(brand),norm(name),urlunparse(("https","www.parfumo.com","/Perfumes/"+seg[idx+1]+"/"+seg[idx+2],"","",""))

targets=json.loads(PENDING.read_text(encoding="utf-8"))["items"]
children=[u for u in locs(fetch(SITEMAP,12,2)) if "sitemap_en_perfums" in u]
print("SITEMAPS",len(children),flush=True)

brand_urls={}
def get_map(u):
    out=[]
    try:
        for x in locs(fetch(u,20,2)):
            p=product_parts(x)
            if p: out.append(p)
    except Exception as e:
        print("SITEMAP_ERR",u,repr(e),flush=True)
    return out

with ThreadPoolExecutor(max_workers=6) as ex:
    futs=[ex.submit(get_map,u) for u in children]
    total=0
    for f in as_completed(futs):
        for b,n,u in f.result():
            brand_urls.setdefault(b,[]).append((n,u)); total+=1
        print("INDEXED",total,flush=True)

brand_keys=list(brand_urls)
candidates=[]
for t in targets:
    tb=bnorm(t["brand"]); tn=norm(t["name"])
    bmatches=[]
    for bk in brand_keys:
        bs=1 if tb==bk else SequenceMatcher(None,tb,bk).ratio()
        if bs>=.72:bmatches.append((bs,bk))
    bmatches=sorted(bmatches,reverse=True)[:5]
    ranked=[]
    for bs,bk in bmatches:
        for nn,u in brand_urls[bk]:
            ns=1 if tn==nn else SequenceMatcher(None,tn,nn).ratio()
            if ns>=.72: ranked.append((.3*bs+.7*ns,ns,bs,nn,u))
    ranked.sort(reverse=True)
    best=ranked[0] if ranked else None; second=ranked[1] if len(ranked)>1 else None
    ok=bool(best and best[1]>=.86 and best[2]>=.72 and (best[1]>=.97 or not second or best[0]-second[0]>=.025))
    candidates.append({**t,"candidate":best[4] if ok else None,"candidate_name":best[3] if best else None,
                       "match_score":round(best[0],4) if best else 0,"name_score":round(best[1],4) if best else 0,
                       "brand_score":round(best[2],4) if best else 0})

def parse_one(item):
    if not item["candidate"]: return {**item,"matched":False,"top_notes":[],"heart_notes":[],"base_notes":[]}
    try:
        page=fetch(item["candidate"],15,2).decode("utf-8",errors="replace")
        def tier(code):
            vals=re.findall(r'<span class="clickable_note_img[^"]*"[^>]*data-nt="'+code+r'"[^>]*>.*?<img[^>]*alt="([^"]+)"',page,re.S|re.I)
            out=[]
            for v in vals:
                v=htmlmod.unescape(v).strip()
                if v and v not in out:out.append(v)
            return out
        top,heart,base=tier("t"),tier("m"),tier("b")
        hm=re.search(r"<h1[^>]*>(.*?)</h1>",page,re.S|re.I)
        title=htmlmod.unescape(re.sub(r"<[^>]+>"," ",hm.group(1))).strip() if hm else ""
        if top or heart or base:
            return {**item,"matched":True,"source_url":item["candidate"],"page_name":" ".join(title.split()),
                    "top_notes":top,"heart_notes":heart,"base_notes":base}
        return {**item,"matched":False,"top_notes":[],"heart_notes":[],"base_notes":[],"error":"no pyramid"}
    except Exception as e:
        return {**item,"matched":False,"top_notes":[],"heart_notes":[],"base_notes":[],"error":repr(e)}

results=[]
with ThreadPoolExecutor(max_workers=6) as ex:
    futs=[ex.submit(parse_one,x) for x in candidates]
    done=0
    for f in as_completed(futs):
        results.append(f.result()); done+=1
        if done%25==0: print("PAGES",done,"MATCHED",sum(x.get("matched") for x in results),flush=True)

# stable target ordering
key=lambda x:(x["brand"],x["name"],x["product_type"])
results.sort(key=key)
summary={"targets":len(targets),"matched":sum(bool(x.get("matched")) for x in results),
         "unmatched":sum(not x.get("matched") for x in results)}
OUTPUT.write_text(json.dumps({"summary":summary,"items":results},ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(summary),flush=True)
