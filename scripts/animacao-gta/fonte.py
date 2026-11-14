"""A animação de origem (GTA) pronta para consultar: rotações e posições de mundo por quadro."""
import numpy as np

import geo
import rage

# troca de eixos GTA (X direita, Y frente, Z cima) → glTF (X esquerda, Y cima, Z frente)
QC = geo.q_matriz([[-1.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, 1.0, 0.0]])


def conv_v(v):
    return np.array([-v[0], v[2], v[1]])


def conv_q(q):
    """Uma rotação do espaço do GTA vista no espaço do glTF."""
    return geo.qnorm(geo.qmul(geo.qmul(QC, q), geo.qconj(QC)))


class Fonte:
    def __init__(self, yft, ycd):
        self.ossos = rage.ler_esqueleto(yft)
        self.anim = rage.ler_animacoes(ycd)[0]
        self.pais = [o["pai"] for o in self.ossos]
        self.nome = {o["nome"]: o["i"] for o in self.ossos}
        tag = {o["tag"]: o["i"] for o in self.ossos}
        self.rot0 = [np.array(o["rot"], dtype=float) for o in self.ossos]
        self.pos0 = [np.array(o["pos"], dtype=float) for o in self.ossos]
        # a raiz de alguns personagens vem virada 180° no arquivo; a pose de descanso padrão é sem
        # giro (o primeiro quadro das animações confirma: raiz quase sem rotação)
        self.rot0[0] = np.array([0.0, 0.0, 0.0, 1.0])
        self.trilha_rot = {}
        self.trilha_pos = {}
        for t in self.anim["trilhas"]:
            i = tag.get(t["osso"])
            if i is None:
                continue
            if t["formato"] == 1 and t["trilha"] == 1:
                self.trilha_rot[i] = np.array(t["quadros"], dtype=float)
            elif t["formato"] == 0 and t["trilha"] == 0:
                self.trilha_pos[i] = np.array(t["quadros"], dtype=float)
        self.quadros = self.anim["quadros"]
        self.wr0, self.wp0 = geo.cinematica(self.pais, self.rot0, self.pos0)
        self._cache = {}

    def quadro(self, f):
        """(rotações, posições) de mundo no quadro f, no espaço do GTA."""
        if f not in self._cache:
            rots = list(self.rot0)
            poss = list(self.pos0)
            for i, q in self.trilha_rot.items():
                rots[i] = q[f]
            for i, p in self.trilha_pos.items():
                poss[i] = p[f]
            self._cache[f] = geo.cinematica(self.pais, rots, poss)
        return self._cache[f]
