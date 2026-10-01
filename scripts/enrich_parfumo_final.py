import gzip, html as htmlmod, json, re, unicodedata, urllib.request, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlparse, urlunparse
from xml.etree import ElementTree as ET

PENDING=Path("pending-fragrances.json")
OUTPUT=Path("enrichment-parfumo-final.json")
UA="Mozilla/5.0 (compatible; AZZENA-Catalog-Enrichment/1.1)"

def norm(s):
    s=unicodedata.normalize("NFKD",str(s or "")).encode("ascii","ignore").decode().lower()
    s=s.replace("&"," and ").replace("*"," ")
    s=re.sub(r"\b(eau de parfum|eau de toilette|eau de cologne|eau fraiche|edp|edt|parfum|extrait|cologne|spray|pour homme|pour femme|for men|for women|for him|for her|intensement)\b"," ",s)
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
 "maison alhambra":"maison alhambra","alhambra":"maison alhambra",
 "l occitane au bresil":"l occitane au bresil","loccitane au bresil":"l occitane au bresil",
}
def bnorm(s):
    x=norm(s); return ALIASES.get(x,x)

def fetch(url,timeout=15,attempts=2):
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
            if k+1<attempts: time.sleep(.4)
    raise last

def locs(d):
    root=ET.fromstring(d)
    return [e.text.strip() for e in root.iter() if e.tag.endswith("loc") and e.text]

def product_parts(url):
    p=urlparse(url); seg=[x for x in p.path.split("/") if x]
    idx=next((i for i,x in enumerate(seg) if x.lower() in {"perfumes","parfums"}),None)
    if idx is None or len(seg)<=idx+2:return None
    b=seg[idx+1].replace("_"," ").replace("-"," ")
    n=seg[idx+2].replace("_"," ").replace("-"," ")
    clean=urlunparse(("https","www.parfumo.com","/Perfumes/"+seg[idx+1]+"/"+seg[idx+2],"","",""))
    return bnorm(b),norm(n),clean

def remove_brand(name, brand):
    toks=set(bnorm(brand).split())
    return " ".join(x for x in norm(name).split() if x not in toks and x not in {"perfumes","perfume"})

targets=json.loads(PENDING.read_text(encoding="utf-8"))["items"]
idx=fetch("https://www.parfumo.com/sitemap_en.xml",12,2)
children=[u for u in locs(idx) if "sitemap_en_perfums" in u]
brand_urls={}
def load_sm(u):
    out=[]
    try:
        for x in locs(fetch(u,18,2)):
            p=product_parts(x)
            if p:out.append(p)
    except Exception as e: print("SM_ERR",u,repr(e),flush=True)
    return out
with ThreadPoolExecutor(max_workers=6) as ex:
    for f in as_completed([ex.submit(load_sm,u) for u in children]):
        for b,n,u in f.result():brand_urls.setdefault(b,[]).append((n,u))

brands=list(brand_urls)
cands=[]
for t in targets:
    tb=bnorm(t["brand"]); tn=norm(t["name"]); tclean=remove_brand(tn,tb)
    bms=[]
    for bk in brands:
        if tb==bk:bs=1.0
        elif tb in bk or bk in tb:bs=.94
        else:bs=SequenceMatcher(None,tb,bk).ratio()
        if bs>=.68:bms.append((bs,bk))
    bms=sorted(bms,reverse=True)[:8]
    ranked=[]
    for bs,bk in bms:
        for nn,u in brand_urls[bk]:
            variants={nn,remove_brand(nn,tb),remove_brand(nn,bk)}
            ns=max(SequenceMatcher(None,tclean or tn,v).ratio() for v in variants if v)
            tt=set((tclean or tn).split())
            for v in variants:
                vt=set(v.split())
                if tt and tt.issubset(vt): ns=max(ns,.94 if len(tt)>1 else .88)
            ranked.append((.25*bs+.75*ns,ns,bs,nn,u))
    ranked.sort(reverse=True)
    best=ranked[0] if ranked else None; second=ranked[1] if len(ranked)>1 else None
    ok=bool(best and best[1]>=.82 and best[2]>=.68 and (best[1]>=.97 or not second or best[0]-second[0]>=.018))
    cands.append({**t,"candidate_url":best[4] if ok else None,"candidate_name":best[3] if best else None,
                  "name_score":round(best[1],4) if best else 0,"brand_score":round(best[2],4) if best else 0})

def parse(item):
    if not item["candidate_url"]:return {**item,"matched":False,"top_notes":[],"heart_notes":[],"base_notes":[]}
    try:
        page=fetch(item["candidate_url"],12,2).decode("utf-8",errors="replace")
        def tier(c):
            vals=re.findall(r'<span class="clickable_note_img[^"]*"[^>]*data-nt="'+c+r'"[^>]*>.*?<img[^>]*alt="([^"]+)"',page,re.S|re.I)
            out=[]
            for v in vals:
                v=htmlmod.unescape(v).strip()
                if v and v not in out:out.append(v)
            return out
        top,heart,base=tier("t"),tier("m"),tier("b")
        hm=re.search(r"<h1[^>]*>(.*?)</h1>",page,re.S|re.I)
        h=htmlmod.unescape(re.sub(r"<[^>]+>"," ",hm.group(1))).strip() if hm else ""
        if top or heart or base:
            return {**item,"matched":True,"source_url":item["candidate_url"],"page_name":" ".join(h.split()),"top_notes":top,"heart_notes":heart,"base_notes":base}
        return {**item,"matched":False,"top_notes":[],"heart_notes":[],"base_notes":[],"error":"no pyramid"}
    except Exception as e:return {**item,"matched":False,"top_notes":[],"heart_notes":[],"base_notes":[],"error":repr(e)}

results=[]
with ThreadPoolExecutor(max_workers=3) as ex:
    for f in as_completed([ex.submit(parse,x) for x in cands]):results.append(f.result())
results.sort(key=lambda x:(x["brand"],x["name"],x["product_type"]))
summary={"targets":len(targets),"matched":sum(x.get("matched",False) for x in results),"unmatched":sum(not x.get("matched",False) for x in results)}
OUTPUT.write_text(json.dumps({"summary":summary,"items":results},ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(summary),flush=True)
