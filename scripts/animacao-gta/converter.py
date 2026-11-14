"""Converte uma animação de GTA V / FiveM (.ycd) para o boneco do HOKI e grava um .glb só com o clipe.

uso (rodar com `python -I -B`; precisa do numpy):
  converter.py <personagem.yft> <animacao.ycd> <padrao.glb> <animacoes-1.glb> <saida.glb> [NomeDoClipe_Loop]

exemplo (o que gerou public/hoki/boneco/animacoes-extra.glb):
  python -I -B scripts/animacao-gta/converter.py personagem.yft passinhodojamal@animation.ycd     public/hoki/boneco/padrao.glb public/hoki/boneco/animacoes-1.glb     public/hoki/boneco/animacoes-extra.glb Passinho_Jamal_Loop
Para o jogo achar um clipe novo: registrar em src/components/hoki/boneco.ts (REACOES, DURACAO_REACAO e
INTERACOES_BONECO), no tipo Reacao de mascote.ts e no ícone de roda-animacoes.tsx. Um .glb guarda um
clipe por rodada do conversor; para mais danças, gravar outro arquivo e somar à lista ANIMACOES.

- <personagem.yft>: qualquer personagem de GTA/FiveM; só o esqueleto (pose de descanso) é lido.
- <padrao.glb> e <animacoes-1.glb>: os do jogo, em public/hoki/boneco/ (o segundo dá a pose dos dedos).
- o nome do clipe termina em _Loop quando a animação repete.

Como funciona:
- tronco, cabeça e pés: a mesma mudança de orientação que o osso do GTA fez desde a pose de
  descanso dele, aplicada sobre a pose de descanso do boneco (em pé ↔ em pé, pé no chão ↔ pé no chão);
- braços, mãos e pernas: a orientação do osso do GTA passada direto para o osso do boneco, trocando
  os eixos de cada esqueleto (no GTA o osso aponta para +X e o cotovelo dobra em +Z, o joelho em −Z;
  no boneco o osso aponta para +Y e os dois dobram em +X). Assim a direção de cada osso e o lado
  para onde ele dobra ficam iguais aos da animação original, mesmo com as poses de descanso diferentes;
- quadril: o meio das coxas segue o do GTA, na escala do comprimento das pernas, sem o avanço
  que a animação faz ao longo do tempo (para repetir no lugar);
- no fim entra uma passagem curta da última pose para a primeira, para a repetição não dar tranco.

Limites: o leitor do .ycd (rage.py) entende os canais fixos, crus, quantizados e com tabela; se a
animação usar canais "lineares" ou quatérnios em cache (comuns nas animações originais do jogo),
ele avisa e para.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geo  # noqa: E402
import glb  # noqa: E402
from fonte import QC, Fonte, conv_q, conv_v  # noqa: E402

QPS = 30.0
PASSAGEM = 18  # quadros a mais no fim, voltando para a primeira pose
ARQ_YFT, ARQ_YCD, ARQ_BONECO, ARQ_PARADO, ARQ_SAIDA = sys.argv[1:6]
NOME_DO_CLIPE = sys.argv[6] if len(sys.argv) > 6 else "Animacao_Loop"

F = Fonte(ARQ_YFT, ARQ_YCD)
sn = F.nome
js, bin_ = glb.ler(ARQ_BONECO)
T = glb.esqueleto(js)
tn = {x["nome"]: x["i"] for x in T}
ja, ba = glb.ler(ARQ_PARADO)
parado = glb.clipe(ja, ba, "Idle_Loop")

# nós do esqueleto do boneco, de cima para baixo (sem a malha)
ordem = []


def _visita(i):
    if i in ordem or T[i]["malha"]:
        return
    if T[i]["pai"] >= 0:
        _visita(T[i]["pai"])
    ordem.append(i)


for _i in range(len(T)):
    _visita(_i)


def fk(rots, poss=None):
    """Cinemática do boneco: rots/poss são dicts {índice: valor local}; o resto fica no descanso."""
    wr, wp = {}, {}
    for i in ordem:
        r = rots.get(i, T[i]["r"])
        t = (poss or {}).get(i, T[i]["t"])
        p = T[i]["pai"]
        if p < 0:
            wr[i] = geo.qnorm(r)
            wp[i] = np.array(t, dtype=float)
        else:
            wr[i] = geo.qnorm(geo.qmul(wr[p], r))
            wp[i] = wp[p] + geo.qrot(wr[p], t)
    return wr, wp


twr0, twp0 = fk({})


def troca(colunas):
    m = np.array(colunas, dtype=float).T  # colunas = para onde vão os eixos X, Y, Z do osso do boneco
    assert abs(np.linalg.det(m) - 1) < 1e-9
    return geo.q_matriz(m)


# eixo do boneco → eixo do osso do GTA
P_BRACO = troca([[0, 0, 1], [1, 0, 0], [0, 1, 0]])  # X→+Z (dobra do cotovelo), Y→+X (ao longo do osso)
P_PERNA = troca([[0, 0, -1], [1, 0, 0], [0, -1, 0]])  # X→−Z (dobra do joelho), Y→+X

DIRETO = {}
for lado, L in (("l", "L"), ("r", "R")):
    DIRETO[f"upperarm_{lado}"] = (f"SKEL_{L}_UpperArm", P_BRACO)
    DIRETO[f"lowerarm_{lado}"] = (f"SKEL_{L}_Forearm", P_BRACO)
    DIRETO[f"hand_{lado}"] = (f"SKEL_{L}_Hand", P_BRACO)
    DIRETO[f"thigh_{lado}"] = (f"SKEL_{L}_Thigh", P_PERNA)
    DIRETO[f"calf_{lado}"] = (f"SKEL_{L}_Calf", P_PERNA)
DELTA = {
    "pelvis": "SKEL_Pelvis",
    "spine_01": "SKEL_Spine0",
    "spine_03": "SKEL_Spine3",
    "neck_01": "SKEL_Neck_1",
    "Head": "SKEL_Head",
    "foot_l": "SKEL_L_Foot",
    "foot_r": "SKEL_R_Foot",
}
# clavículas: mudança desde o descanso, com o descanso do boneco virado para a direção da clavícula do GTA
ALINHA = {}
for lado, L in (("l", "L"), ("r", "R")):
    dt = twp0[tn[f"upperarm_{lado}"]] - twp0[tn[f"clavicle_{lado}"]]
    ds = conv_v(F.wp0[sn[f"SKEL_{L}_UpperArm"]] - F.wp0[sn[f"SKEL_{L}_Clavicle"]])
    ALINHA[f"clavicle_{lado}"] = (f"SKEL_{L}_Clavicle", geo.q_entre(dt, ds))


def slerp(a, b, w):
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    d = float(np.dot(a, b))
    if d < 0:
        b = -b
        d = -d
    if d > 0.9995:
        return geo.qnorm(a + (b - a) * w)
    th = np.arccos(d)
    return geo.qnorm((np.sin((1 - w) * th) * a + np.sin(w * th) * b) / np.sin(th))


# ---- conferência dos eixos na pose de descanso (lado esquerdo do boneco, +X no glTF)
print("eixo da dobra (mundo, glTF) na pose de descanso; deve apontar para o mesmo lado nos dois:")
for osso_t, (osso_s, P) in DIRETO.items():
    if not osso_t.endswith("_l"):
        continue
    eixo_s = conv_v(geo.qrot(F.wr0[sn[osso_s]], geo.qrot(P, [1, 0, 0])))
    eixo_t = geo.qrot(twr0[tn[osso_t]], [1, 0, 0])
    print(f"  {osso_t:12s} GTA {np.round(eixo_s, 2)} boneco {np.round(eixo_t, 2)}")

# ---- medidas para o quadril
perna_t = np.linalg.norm(T[tn["calf_l"]]["t"]) + np.linalg.norm(T[tn["foot_l"]]["t"])
perna_s = np.linalg.norm(F.pos0[sn["SKEL_L_Calf"]]) + np.linalg.norm(F.pos0[sn["SKEL_L_Foot"]])
K = perna_t / perna_s
chao_s = F.wp0[sn["SKEL_L_Foot"]][2]  # altura do tornozelo do GTA em pé (pé no chão)
tornozelo_t = twp0[tn["foot_l"]][1]
meio_local = (T[tn["thigh_l"]]["t"] + T[tn["thigh_r"]]["t"]) / 2  # meio das coxas no quadril do boneco
meio_t0 = (twp0[tn["thigh_l"]] + twp0[tn["thigh_r"]]) / 2
print(f"pernas: boneco {perna_t:.4f} GTA {perna_s:.4f} escala {K:.4f}")

# o clipe do .ycd costuma começar depois de um ou dois quadros de pose de referência
f0, f1 = min(2, F.quadros - 1), F.quadros - 1
quadros = list(range(f0, f1 + 1))


def meio_s(f):
    _, wp = F.quadro(f)
    return (wp[sn["SKEL_L_Thigh"]] + wp[sn["SKEL_R_Thigh"]]) / 2


avanco = meio_s(f1) - meio_s(f0)
avanco[2] = 0.0
print("avanço tirado (GTA: direita, frente):", np.round(avanco[:2], 3))
centro = np.mean([meio_s(f)[:2] - avanco[:2] * (f - f0) / max(1, f1 - f0) for f in quadros], axis=0)

wr_raiz = twr0[tn["root"]]
wp_raiz = twp0[tn["root"]]

rot_local = {i: [] for i in ordem}  # por nó: lista de quatérnios locais
pos_quadril = []

for f in quadros:
    wrs, wps = F.quadro(f)

    def delta(osso_s):
        i = sn[osso_s]
        return conv_q(geo.qmul(wrs[i], geo.qconj(F.wr0[i])))

    mundo = {}
    locais = {}
    for i in ordem:
        nome = T[i]["nome"]
        p = T[i]["pai"]
        if nome in DIRETO:
            osso_s, P = DIRETO[nome]
            w = geo.qnorm(geo.qmul(geo.qmul(QC, wrs[sn[osso_s]]), P))
        elif nome in DELTA:
            w = geo.qnorm(geo.qmul(delta(DELTA[nome]), twr0[i]))
        elif nome == "spine_02":
            w = geo.qnorm(geo.qmul(slerp(delta("SKEL_Spine0"), delta("SKEL_Spine3"), 0.5), twr0[i]))
        elif nome in ALINHA:
            osso_s, A = ALINHA[nome]
            w = geo.qnorm(geo.qmul(geo.qmul(delta(osso_s), A), twr0[i]))
        else:
            w = None
        if w is None:
            # sem par no GTA: fica na pose de descanso (os dedos recebem a pose do "parado" mais abaixo)
            local = T[i]["r"]
            w = geo.qnorm(geo.qmul(mundo[p], local)) if p >= 0 else geo.qnorm(local)
        else:
            local = geo.qnorm(geo.qmul(geo.qconj(mundo[p]), w))
        mundo[i] = w
        locais[i] = local
    for i in ordem:
        rot_local[i].append(locais[i])

    # quadril: o meio das coxas segue o do GTA (sem o avanço), na escala das pernas
    m = meio_s(f)
    plano = m[:2] - avanco[:2] * (f - f0) / max(1, f1 - f0) - centro
    alvo = np.array([meio_t0[0] - K * plano[0], tornozelo_t + K * (m[2] - chao_s), meio_t0[2] + K * plano[1]])
    quadril_mundo = alvo - geo.qrot(mundo[tn["pelvis"]], meio_local)
    pos_quadril.append(geo.qrot(geo.qconj(wr_raiz), quadril_mundo - wp_raiz))

# ---- dedos relaxados (do clipe "parado" que já existe)
DEDOS = ("index_", "middle_", "ring_", "pinky_", "thumb_")
for i in ordem:
    nome = T[i]["nome"]
    if nome.startswith(DEDOS) and (nome, "rotation") in parado:
        q = geo.qnorm(parado[(nome, "rotation")][1][0])
        rot_local[i] = [q for _ in quadros]

# ---- passagem do fim para o começo
n_principal = len(quadros)
for j in range(1, PASSAGEM + 1):
    w = j / PASSAGEM
    w = w * w * (3 - 2 * w)
    for i in ordem:
        rot_local[i].append(slerp(rot_local[i][n_principal - 1], rot_local[i][0], w))
    pos_quadril.append(pos_quadril[n_principal - 1] * (1 - w) + pos_quadril[0] * w)
total = n_principal + PASSAGEM
tempos = np.arange(total) / QPS

# continuidade de sinal dos quatérnios
for i in ordem:
    qs = rot_local[i]
    for k in range(1, len(qs)):
        if np.dot(qs[k], qs[k - 1]) < 0:
            qs[k] = -qs[k]

# ---- conferência: pés e cabeça do boneco ao longo do clipe, e o quanto o pé de apoio escorrega
alt_torn, alt_ponta, alt_cab = [], [], []
bolas = {"ball_l": [], "ball_r": []}
for k in range(total):
    wr, wp = fk({i: rot_local[i][k] for i in ordem}, {tn["pelvis"]: pos_quadril[k]})
    alt_torn.append(min(wp[tn["foot_l"]][1], wp[tn["foot_r"]][1]))
    alt_ponta.append(min(wp[tn["ball_l"]][1], wp[tn["ball_r"]][1]))
    alt_cab.append(wp[tn["Head"]][1])
    for b in bolas:
        bolas[b].append(wp[tn[b]].copy())
print(f"quadros no clipe: {total} ({total / QPS:.3f} s, última chave em {tempos[-1]:.3f} s)")
print(f"tornozelo mais baixo: min {min(alt_torn):.3f} max {max(alt_torn):.3f} (em pé: {tornozelo_t:.3f})")
print(f"planta do pé mais baixa: min {min(alt_ponta):.3f} max {max(alt_ponta):.3f} (em pé: {twp0[tn['ball_l']][1]:.3f})")
print(f"cabeça: min {min(alt_cab):.3f} max {max(alt_cab):.3f} (em pé: {twp0[tn['Head']][1]:.3f})")
desliza = []
chao_bola = min(alt_ponta)
for b, ps in bolas.items():
    for k in range(1, n_principal):
        if ps[k][1] < chao_bola + 0.015 and ps[k - 1][1] < chao_bola + 0.015:
            desliza.append(np.hypot(ps[k][0] - ps[k - 1][0], ps[k][2] - ps[k - 1][2]) * QPS)
if desliza:
    print(f"pé de apoio escorrega: média {np.mean(desliza):.3f} m/s, 90% abaixo de {np.percentile(desliza, 90):.3f} m/s ({len(desliza)} quadros de apoio)")

# ---- grava
indice_novo = {i: k for k, i in enumerate(ordem)}
nos = [
    {
        "nome": T[i]["nome"],
        "filhos": [indice_novo[c] for c in ordem if T[c]["pai"] == i],
        "t": T[i]["t"],
        "r": T[i]["r"],
        "s": [1.0, 1.0, 1.0],
    }
    for i in ordem
]
trilhas = []
dois = np.array([tempos[0], tempos[-1]])
for i in ordem:
    nome = T[i]["nome"]
    if nome == "Armature":
        continue
    qs = np.array(rot_local[i])
    fixo = np.abs(qs - qs[0]).max() < 1e-7
    trilhas.append((indice_novo[i], "rotation", dois if fixo else tempos, qs[[0, -1]] if fixo else qs))
    if nome == "pelvis":
        trilhas.append((indice_novo[i], "translation", tempos, np.array(pos_quadril)))
    else:
        trilhas.append((indice_novo[i], "translation", dois, np.array([T[i]["t"], T[i]["t"]])))
tamanho = glb.escrever(ARQ_SAIDA, nos, [{"nome": NOME_DO_CLIPE, "trilhas": trilhas}])
print(f"gravado {ARQ_SAIDA}: {tamanho} bytes, {len(trilhas)} trilhas, clipe {NOME_DO_CLIPE}, duração {tempos[-1]:.4f} s")
