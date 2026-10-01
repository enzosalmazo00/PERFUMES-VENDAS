import gzip, html as htmlmod, json, re, time, unicodedata, urllib.request
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlparse, urlunparse
from xml.etree import ElementTree as ET

PENDING=Path("pending-fragrances.json")
OUTPUT=Path("enrichment-parfumo-live.json")
SITEMAP="https://www.parfumo.com/sitemap_en.xml"
UA="Mozilla/5.0 (compatible; AZZENA-Catalog-Enrichment/1.0; source-verification)"

def norm(s):
    s=unicodedata.normalize("NFKD",str(s or "")).encode("ascii","ignore").decode().lower()
    s=s.replace("&"," and ")
    s=re.sub(r"\b(eau de parfum|eau de toilette|eau de cologne|eau fraiche|edp|edt|parfum|extrait|cologne|spray|pour homme|pour femme|for men|for women)\b"," ",s)
    s=re.sub(r"\b(100 ml|100ml|50 ml|50ml|75 ml|75ml|125 ml|125ml|200 ml|200ml)\b"," ",s)
    s=re.sub(r"[^a-z0-9]+"," ",s)
    return " ".join(s.split())

BRAND_ALIAS={
 "afnan":"afnan perfumes","afnan perfumes":"afnan perfumes",
 "rabanne":"paco rabanne","paco rabanne":"paco rabanne",
 "dior":"dior","christian dior":"dior",
 "giorgio armani":"giorgio armani","armani":"giorgio armani",
 "dolce gabbana":"dolce gabbana","dolce and gabbana":"dolce gabbana",
 "victoria s secret":"victoria s secret","victorias secret":"victoria s secret",
 "viktor rolf":"viktor rolf","viktor and rolf":"viktor rolf",
 "o boticario":"o boticario","boticario":"o boticario",
 "maison francis kurkdjian":"maison francis kurkdjian",
 "l occitane au bresil":"l occitane au bresil",
 "bath body works":"bath body works","bath and body works":"bath body works",
 "jean paul gaultier":"jean paul gaultier",
 "mercedes benz":"mercedes benz",
 "jo malone london":"jo malone","jo malone":"jo malone",
}
def bnorm(s):
    x=norm(s)
    return BRAND_ALIAS.get(x,x)

def fetch(url, attempts=3):
    last=None
    for k in range(attempts):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept-Language":"en-US,en;q=0.9"})
            with urllib.request.urlopen(req,timeout=45) as r:
                data=r.read()
                if data[:2]==b"\x1f\x8b": data=gzip.decompress(data)
                return data
        except Exception as e:
            last=e
            time.sleep(1.0*(k+1))
    raise last

def locs(xmlbytes):
    root=ET.fromstring(xmlbytes)
    return [e.text.strip() for e in root.iter() if e.tag.endswith("loc") and e.text]

def product_parts(url):
    p=urlparse(url)
    seg=[x for x in p.path.split("/") if x]
    idx=None
    for i,x in enumerate(seg):
        if x.lower() in {"perfumes","parfums"}:
            idx=i;break
    if idx is None or len(seg)<=idx+2:return None
    brand=seg[idx+1].replace("_"," ").replace("-"," ")
    name=seg[idx+2].replace("_"," ").replace("-"," ")
    newpath="/Perfumes/"+seg[idx+1]+"/"+seg[idx+2]
    return bnorm(brand),norm(name),urlunparse(("https","www.parfumo.com",newpath,"","",""))

targets=json.loads(PENDING.read_text(encoding="utf-8"))["items"]
idx=fetch(SITEMAP)
children=[u for u in locs(idx) if "sitemap_perfums" in u]
if not children:
    # some deployments point sitemap_en to sitemap index aliases
    children=[u for u in locs(fetch("https://www.parfumo.com/sitemap.xml")) if "sitemap_perfums" in u]
print("sitemaps",len(children))

brand_urls={}
url_count=0
for si,u in enumerate(children,1):
    try:
        raw=fetch(u)
    except Exception:
        # sitemap index sometimes uses .de host; mirror path on .com
        pu=urlparse(u); alt=urlunparse((pu.scheme,"www.parfumo.com",pu.path,pu.params,pu.query,pu.fragment))
        raw=fetch(alt)
    for url in locs(raw):
        pp=product_parts(url)
        if not pp:continue
        b,n,clean=pp
        brand_urls.setdefault(b,[]).append((n,clean))
        url_count+=1
    print("sitemap_done",si,"urls",url_count)

brand_keys=list(brand_urls)
results=[]
accepted=0
for ix,t in enumerate(targets,1):
    tb=bnorm(t["brand"]); tn=norm(t["name"])
    bmatches=[]
    for bk in brand_keys:
        sc=1.0 if tb==bk else SequenceMatcher(None,tb,bk).ratio()
        if sc>=0.72:bmatches.append((sc,bk))
    bmatches.sort(reverse=True); bmatches=bmatches[:6]
    ranked=[]
    for bsc,bk in bmatches:
        for nn,url in brand_urls[bk]:
            nsc=1.0 if tn==nn else SequenceMatcher(None,tn,nn).ratio()
            if nsc>=0.70:
                ranked.append((0.30*bsc+0.70*nsc,nsc,bsc,nn,url,bk))
    ranked.sort(reverse=True)
    best=ranked[0] if ranked else None
    second=ranked[1] if len(ranked)>1 else None
    ok=bool(best and best[1]>=0.86 and best[2]>=0.72 and
            (best[1]>=0.97 or not second or best[0]-second[0]>=0.025))
    item={**t,"matched":False,"match_score":round(best[0],4) if best else 0,
          "name_score":round(best[1],4) if best else 0,
          "brand_score":round(best[2],4) if best else 0,
          "candidate_url":best[4] if best else None,
          "candidate_name":best[3] if best else None,
          "top_notes":[],"heart_notes":[],"base_notes":[],"page_name":None}
    if ok:
        try:
            page=fetch(best[4]).decode("utf-8",errors="replace")
            hm=re.search(r"<h1[^>]*>(.*?)</h1>",page,re.S|re.I)
            htxt=re.sub(r"<[^>]+>"," ",hm.group(1)) if hm else ""
            htxt=htmlmod.unescape(" ".join(htxt.split()))
            # page-name check: target normalized name must closely match h1 prefix/content
            page_score=SequenceMatcher(None,tn,norm(htxt)).ratio() if htxt else 0
            # Extract directly from Parfumo's machine-readable tier marker.
            def tier(code):
                vals=re.findall(r'<span class="clickable_note_img[^"]*"[^>]*data-nt="'+code+r'"[^>]*>.*?<img[^>]*alt="([^"]+)"',page,re.S|re.I)
                out=[]
                for v in vals:
                    v=htmlmod.unescape(v).strip()
                    if v and v not in out:out.append(v)
                return out
            top=tier("t"); heart=tier("m"); base=tier("b")
            if top or heart or base:
                item.update({"matched":True,"source_url":best[4],"page_name":htxt,
                             "page_score":round(page_score,4),
                             "top_notes":top,"heart_notes":heart,"base_notes":base})
                accepted+=1
        except Exception as e:
            item["error"]=repr(e)
        time.sleep(0.12)
    results.append(item)
    if ix%25==0: print("progress",ix,"accepted",accepted)

summary={"targets":len(targets),"sitemap_urls":url_count,"matched":accepted,"unmatched":len(targets)-accepted}
OUTPUT.write_text(json.dumps({"summary":summary,"items":results},ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(summary))
