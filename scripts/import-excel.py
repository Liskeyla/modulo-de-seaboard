import json
import re
import pandas as pd

df = pd.read_excel(
    r"c:\Users\lmacias\Downloads\Reporte de Estimaciones  RFS - DMS Ecuador.xlsx",
    header=1,
)


def clean_estado(v):
    if pd.isna(v):
        return ""
    return re.sub(r"\s+", " ", str(v)).strip().upper()


def clean(v):
    if pd.isna(v):
        return ""
    if isinstance(v, float) and v == int(v):
        return int(v)
    if isinstance(v, (int, float)):
        return v
    return str(v).strip()


records = []
for i, row in df.iterrows():
    codigo = clean(row.get("Codigo", ""))
    if not codigo:
        continue
    naviera = clean(row.get("Naviera", ""))
    codigo_rfs = clean(row.iloc[7]) if len(row) > 7 else ""
    rec = {
        "id": f"est-{i + 1}",
        "codigo": codigo,
        "semana": int(row["Semana"]) if pd.notna(row.get("Semana")) else 0,
        "anio": int(row.iloc[3]) if pd.notna(row.iloc[3]) else 2026,
        "estado": clean_estado(row.get("Estado", "")),
        "contenedor": clean(row.get("Contenedor", "")),
        "modeloMaquina": clean(row.get("Modelo Maquina", "")),
        "codigoRfs": codigo_rfs,
        "naviera": naviera,
        "actividad": clean(row.get("Actividad", "")),
        "lugarEstimacion": clean(row.iloc[10]) if len(row) > 10 else "",
        "lugarAsistencia": clean(row.iloc[11]) if len(row) > 11 else "",
        "fechaGateIn": clean(row.iloc[12]) if len(row) > 12 else "",
        "fechaElaboracion": clean(row.iloc[13]) if len(row) > 13 else "",
        "fechaReparacion": clean(row.iloc[14]) if len(row) > 14 else "",
        "tipoEstimacion": clean(row.iloc[15]) if len(row) > 15 else "",
        "tecnico": clean(row.iloc[16]) if len(row) > 16 else "",
        "horasHombre": float(row.iloc[17]) if pd.notna(row.iloc[17]) else 0,
        "pvpHorasHombre": float(row.iloc[18]) if pd.notna(row.iloc[18]) else 0,
        "pvpMateriales": float(row.iloc[19]) if pd.notna(row.iloc[19]) else 0,
        "pvpTotal": float(row.iloc[20]) if pd.notna(row.iloc[20]) else 0,
        "estadoPti": clean(row.iloc[21]) if len(row) > 21 else "",
        "fechaFinPti": clean(row.iloc[22]) if len(row) > 22 else "",
        "enviarAprobacion": clean(row.iloc[23]) if len(row) > 23 else "",
        "fechaEnvio": clean(row.iloc[24]) if len(row) > 24 else "",
        "fechaAprobacion": clean(row.iloc[25]) if len(row) > 25 else "",
        "fechaRevision": clean(row.iloc[13]) if len(row) > 13 else "",
        "ediEnviadoOne": clean(row.iloc[26]) if len(row) > 26 else "",
        "fechaEnvioEdiOne": clean(row.iloc[27]) if len(row) > 27 else "",
        "niveles": clean(row.iloc[28]) if len(row) > 28 else "",
        "diasEstadia": int(row.iloc[29]) if pd.notna(row.iloc[29]) else 0,
        "tipoDano": clean(row.iloc[30]) if len(row) > 30 else "",
        "analisisObservacion": clean(row.iloc[31]) if len(row) > 31 else "",
        "fechaModificacion": clean(row.iloc[32]) if len(row) > 32 else "",
        "usuarioModificacion": clean(row.iloc[33]) if len(row) > 33 else "",
        "sinDanos": "No hay" in str(row.iloc[0]) if pd.notna(row.iloc[0]) else False,
        "buque": "MN SEABOARD VICTORY 23SB" if "SEABOARD" in naviera else "",
        "viaje": "23SB" if "SEABOARD" in naviera else "",
        "tipoContenedor": "40' REEFER HC CONTAINER" if codigo_rfs == "40RC" else "",
        "comentariosSeaboard": [],
    }
    records.append(rec)

for r in records:
    if r["codigo"] == "ERSBM-2026-174556":
        r["estado"] = "ENVIADO"
        r["fechaEnvio"] = "10/07/2026 17:24"
        r["enviarAprobacion"] = "SI"

import os
out = os.path.join(os.path.dirname(__file__), "..", "src", "data", "estimacionesSeed.json")
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"Wrote {len(records)} records to {out}")
