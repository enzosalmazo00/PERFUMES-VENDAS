import csv, gzip, io, json, re, unicodedata, urllib.request
from difflib import SequenceMatcher
from pathlib import Path

DATA_URL = "https://raw.githubusercontent.com/JennyIseev/fragrance-analysis/main/data/02_Parfumo_Perfumes.csv.gz"
CATALOG_PATH = Path("fragrance-data.js")
OUTPUT_PATH = Path("enrichment-open-data.json")

BRAND_ALIASES = {
    "rabanne": {"rabanne", "paco rabanne"},
    "dior": {"dior", "christian dior"},
    "o boticario": {"o boticario", "boticario"},
    "dolce gabbana": {"dolce gabbana"},
    "giorgio armani": {"giorgio armani", "armani"},
    "maison francis kurkdjian": {"maison francis kurkdjian", "mfk"},
    "l occitane au bresil": {"l occitane au bresil"},
    "victor rolf": {"viktor rolf"},
}

def norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    s = s.replace("&", " and ")
    s = re.sub(r"\b(eau de parfum|eau de toilette|eau de cologne|eau fraiche|edp|edt|parfum|extrait de parfum|cologne)\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())

def brand_norm(s):
    s = norm(s).replace(" and ", " ")
    return " ".join(s.split())

def brand_keys(brand):
    b = brand_norm(brand)
    keys = {b}
    for canon, vals in BRAND_ALIASES.items():
        if b == canon or b in vals:
            keys |= set(vals) | {canon}
    return keys

def parse_catalog():
    txt = CATALOG_PATH.read_text(encoding="utf-8")
    m = re.search(r"export const FRAGRANCE_CATALOG=(\[.*?\]);\s*export const VOLUME_OPTIONS", txt, re.S)
    if not m:
        raise RuntimeError("FRAGRANCE_CATALOG not found")
    groups = json.loads(m.group(1))
    out = []
    for g in groups:
        for name in g.get("fragrances", []):
            out.append({"brand": g["brand"], "name": name, "product_type": "perfume"})
        for name in g.get("splashes", []):
            out.append({"brand": g["brand"], "name": name, "product_type": "body_splash"})
    return out

def split_notes(v):
    s = str(v or "").strip()
    if not s or s.lower() in {"nan", "n/a", "none"}:
        return []
    if s.startswith("[") and s.endswith("]"):
        try:
            arr = json.loads(s.replace("'", '"'))
            if isinstance(arr, list):
                return [str(x).strip() for x in arr if str(x).strip()]
        except Exception:
            pass
    parts = re.split(r"\s*[;,|]\s*", s)
    if len(parts) == 1:
        parts = re.split(r"\s*/\s*", s)
    return [p.strip(" []'\"") for p in parts if p.strip(" []'\"")]

def score_name(target, row):
    t = norm(target)
    n = norm(row.get("Name"))
    c = norm(row.get("Concentration"))
    combos = {n}
    if c:
        combos.add((n + " " + c).strip())
    best = max(SequenceMatcher(None, t, x).ratio() for x in combos if x)
    if t == n:
        best = max(best, 0.965)
    return best

def fetch_rows():
    with urllib.request.urlopen(DATA_URL, timeout=90) as r:
        raw = r.read()
    text = gzip.decompress(raw).decode("utf-8-sig", errors="replace")
    return list(csv.DictReader(io.StringIO(text)))

catalog = parse_catalog()
rows = fetch_rows()

by_brand = {}
for r in rows:
    b = brand_norm(r.get("Brand"))
    by_brand.setdefault(b, []).append(r)

results = []
for target in catalog:
    candidates = []
    for bk in brand_keys(target["brand"]):
        candidates.extend(by_brand.get(bk, []))
    # fallback: brand contains exact normalized phrase
    if not candidates:
        tb = brand_norm(target["brand"])
        for b, vals in by_brand.items():
            if tb == b or (len(tb) >= 5 and (tb in b or b in tb)):
                candidates.extend(vals)
    ranked = []
    for r in candidates:
        sc = score_name(target["name"], r)
        top = split_notes(r.get("Top_Notes") or r.get("Top Notes"))
        mid = split_notes(r.get("Middle_Notes") or r.get("Middle Notes"))
        base = split_notes(r.get("Base_Notes") or r.get("Base Notes"))
        if not (top or mid or base):
            continue
        ranked.append((sc, r, top, mid, base))
    ranked.sort(key=lambda x: (x[0], int(float(x[1].get("Rating_Count") or 0))), reverse=True)
    best = ranked[0] if ranked else None
    second = ranked[1] if len(ranked) > 1 else None
    accepted = bool(best and best[0] >= 0.90 and (not second or best[0] - second[0] >= 0.015 or best[0] >= 0.97))
    item = {
        **target,
        "matched": accepted,
        "match_score": round(best[0], 4) if best else 0,
        "matched_brand": best[1].get("Brand") if best else None,
        "matched_name": best[1].get("Name") if best else None,
        "concentration": best[1].get("Concentration") if best else None,
        "main_accords": best[1].get("Main_Accords") if best else None,
        "top_notes": best[2] if best else [],
        "heart_notes": best[3] if best else [],
        "base_notes": best[4] if best else [],
        "source_url": best[1].get("URL") if best else None,
        "second_score": round(second[0], 4) if second else None,
        "second_name": second[1].get("Name") if second else None,
    }
    results.append(item)

summary = {
    "dataset": DATA_URL,
    "catalog_total": len(catalog),
    "matched": sum(1 for x in results if x["matched"]),
    "unmatched": sum(1 for x in results if not x["matched"]),
}
OUTPUT_PATH.write_text(json.dumps({"summary": summary, "items": results}, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(summary, ensure_ascii=False))
