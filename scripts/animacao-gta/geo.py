"""Contas de quatérnio (x, y, z, w) e cinemática direta, com numpy."""
import numpy as np


def qmul(a, b):
    """Produto de Hamilton a ⊗ b (aplica b e depois a)."""
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return np.array(
        [
            aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
            aw * bw - ax * bx - ay * by - az * bz,
        ]
    )


def qconj(q):
    return np.array([-q[0], -q[1], -q[2], q[3]])


def qnorm(q):
    q = np.asarray(q, dtype=float)
    n = np.linalg.norm(q)
    return q / n if n > 0 else np.array([0.0, 0.0, 0.0, 1.0])


def qrot(q, v):
    """Gira o vetor v pelo quatérnio q."""
    x, y, z, w = q
    u = np.array([x, y, z])
    v = np.asarray(v, dtype=float)
    return v + 2.0 * np.cross(u, np.cross(u, v) + w * v)


def q_entre(a, b):
    """Menor rotação que leva a direção a até a direção b."""
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    d = float(np.dot(a, b))
    if d > 1 - 1e-9:
        return np.array([0.0, 0.0, 0.0, 1.0])
    if d < -1 + 1e-9:
        eixo = np.cross(a, [1.0, 0.0, 0.0])
        if np.linalg.norm(eixo) < 1e-6:
            eixo = np.cross(a, [0.0, 1.0, 0.0])
        eixo = eixo / np.linalg.norm(eixo)
        return np.array([eixo[0], eixo[1], eixo[2], 0.0])
    eixo = np.cross(a, b)
    return qnorm(np.array([eixo[0], eixo[1], eixo[2], 1.0 + d]))


def q_matriz(m):
    """Quatérnio de uma matriz de rotação 3×3 (colunas = eixos)."""
    t = m[0][0] + m[1][1] + m[2][2]
    if t > 0:
        s = 0.5 / np.sqrt(t + 1.0)
        return qnorm([(m[2][1] - m[1][2]) * s, (m[0][2] - m[2][0]) * s, (m[1][0] - m[0][1]) * s, 0.25 / s])
    if m[0][0] > m[1][1] and m[0][0] > m[2][2]:
        s = 2.0 * np.sqrt(1.0 + m[0][0] - m[1][1] - m[2][2])
        return qnorm([0.25 * s, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s, (m[2][1] - m[1][2]) / s])
    if m[1][1] > m[2][2]:
        s = 2.0 * np.sqrt(1.0 + m[1][1] - m[0][0] - m[2][2])
        return qnorm([(m[0][1] + m[1][0]) / s, 0.25 * s, (m[1][2] + m[2][1]) / s, (m[0][2] - m[2][0]) / s])
    s = 2.0 * np.sqrt(1.0 + m[2][2] - m[0][0] - m[1][1])
    return qnorm([(m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, 0.25 * s, (m[1][0] - m[0][1]) / s])


def cinematica(pais, rots, poss):
    """Rotações e posições de mundo a partir das locais (pais[i] < i ou -1)."""
    n = len(pais)
    wr = [None] * n
    wp = [None] * n
    for i in range(n):
        p = pais[i]
        if p < 0:
            wr[i] = qnorm(rots[i])
            wp[i] = np.asarray(poss[i], dtype=float)
        else:
            wr[i] = qnorm(qmul(wr[p], rots[i]))
            wp[i] = wp[p] + qrot(wr[p], poss[i])
    return wr, wp
