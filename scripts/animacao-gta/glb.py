"""Leitura e escrita de .glb (só o que a conversão precisa: nós, animações e os números delas)."""
import json
import struct

import numpy as np

TIPOS = {5126: ("f", 4), 5123: ("H", 2), 5125: ("I", 4), 5121: ("B", 1), 5120: ("b", 1), 5122: ("h", 2)}
COMPS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def ler(caminho):
    b = open(caminho, "rb").read()
    assert b[:4] == b"glTF"
    o = 12
    js, bin_ = None, b""
    while o < len(b):
        n, tipo = struct.unpack_from("<II", b, o)
        dados = b[o + 8 : o + 8 + n]
        if tipo == 0x4E4F534A:
            js = json.loads(dados)
        elif tipo == 0x004E4942:
            bin_ = dados
        o += 8 + n
    return js, bin_


def acessor(js, bin_, i):
    """Os números de um acessor, como matriz numpy (linhas = itens)."""
    a = js["accessors"][i]
    v = js["bufferViews"][a["bufferView"]]
    letra, tam = TIPOS[a["componentType"]]
    n = COMPS[a["type"]]
    inicio = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    passo = v.get("byteStride") or n * tam
    saida = np.zeros((a["count"], n), dtype=float)
    for k in range(a["count"]):
        saida[k] = struct.unpack_from("<" + letra * n, bin_, inicio + k * passo)
    if a.get("normalized"):
        saida /= {5121: 255.0, 5123: 65535.0, 5120: 127.0, 5122: 32767.0}[a["componentType"]]
    return saida


def esqueleto(js):
    """Nós com nome, pai e pose de descanso (translação, rotação xyzw, escala)."""
    nos = js["nodes"]
    pai = [-1] * len(nos)
    for i, n in enumerate(nos):
        for c in n.get("children", []):
            pai[c] = i
    return [
        {
            "i": i,
            "nome": n.get("name", f"no{i}"),
            "pai": pai[i],
            "t": np.array(n.get("translation", [0, 0, 0]), dtype=float),
            "r": np.array(n.get("rotation", [0, 0, 0, 1]), dtype=float),
            "s": np.array(n.get("scale", [1, 1, 1]), dtype=float),
            "malha": "mesh" in n,
        }
        for i, n in enumerate(nos)
    ]


def clipe(js, bin_, nome):
    """Trilhas de uma animação: {(nó, caminho): (tempos, valores)}."""
    for a in js.get("animations", []):
        if a.get("name") != nome:
            continue
        saida = {}
        for c in a["channels"]:
            s = a["samplers"][c["sampler"]]
            no = js["nodes"][c["target"]["node"]].get("name")
            saida[(no, c["target"]["path"])] = (acessor(js, bin_, s["input"])[:, 0], acessor(js, bin_, s["output"]))
        return saida
    return None


def escrever(caminho, nos, animacoes, gerador="conversor de animação do HOKI"):
    """Grava um .glb só com nós (esqueleto) e animações.

    nos: lista de dicts {nome, filhos: [índices], t, r, s}
    animacoes: lista de {nome, trilhas: [(índice do nó, "translation"|"rotation", tempos, valores)]}
    """
    bin_ = bytearray()
    vistas, acessores = [], []

    def por(arr, tipo, com_limites=False):
        arr = np.asarray(arr, dtype="<f4")
        while len(bin_) % 4:
            bin_.append(0)
        vistas.append({"buffer": 0, "byteOffset": len(bin_), "byteLength": arr.nbytes})
        bin_.extend(arr.tobytes())
        a = {"bufferView": len(vistas) - 1, "componentType": 5126, "count": int(arr.shape[0]), "type": tipo}
        if com_limites:
            a["min"] = [float(arr.min())]
            a["max"] = [float(arr.max())]
        acessores.append(a)
        return len(acessores) - 1

    tempos_cache = {}
    anims = []
    for an in animacoes:
        canais, amostras = [], []
        for no, caminho_, tempos, valores in an["trilhas"]:
            chave = (len(tempos), float(tempos[0]), float(tempos[-1]))
            if chave not in tempos_cache:
                tempos_cache[chave] = por(np.asarray(tempos).reshape(-1), "SCALAR", True)
            saida = por(np.asarray(valores), "VEC4" if caminho_ == "rotation" else "VEC3")
            amostras.append({"input": tempos_cache[chave], "output": saida, "interpolation": "LINEAR"})
            canais.append({"sampler": len(amostras) - 1, "target": {"node": no, "path": caminho_}})
        anims.append({"name": an["nome"], "channels": canais, "samplers": amostras})

    filhos_de_alguem = {c for n in nos for c in n.get("filhos", [])}
    raizes = [i for i in range(len(nos)) if i not in filhos_de_alguem]
    js = {
        "asset": {"version": "2.0", "generator": gerador},
        "scene": 0,
        "scenes": [{"nodes": raizes}],
        "nodes": [
            {
                "name": n["nome"],
                **({"children": n["filhos"]} if n.get("filhos") else {}),
                "translation": [float(v) for v in n["t"]],
                "rotation": [float(v) for v in n["r"]],
                "scale": [float(v) for v in n["s"]],
            }
            for n in nos
        ],
        "animations": anims,
        "accessors": acessores,
        "bufferViews": vistas,
        "buffers": [{"byteLength": len(bin_)}],
    }
    while len(bin_) % 4:
        bin_.append(0)
    js["buffers"][0]["byteLength"] = len(bin_)
    texto = json.dumps(js, separators=(",", ":")).encode("utf-8")
    while len(texto) % 4:
        texto += b" "
    total = 12 + 8 + len(texto) + 8 + len(bin_)
    with open(caminho, "wb") as f:
        f.write(b"glTF" + struct.pack("<II", 2, total))
        f.write(struct.pack("<II", len(texto), 0x4E4F534A) + texto)
        f.write(struct.pack("<II", len(bin_), 0x004E4942) + bytes(bin_))
    return total
