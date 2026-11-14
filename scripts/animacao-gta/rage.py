"""Leitura de arquivos do motor RAGE (GTA V / FiveM): o esqueleto de um .yft e as trilhas de um .ycd.

Só o necessário para converter uma animação: nada aqui é copiado de outro programa; o formato
é o que os próprios arquivos mostram (conferido com os nomes dos ossos e a soma dos bits).
"""
import struct
import zlib


def abrir(caminho):
    """Descomprime um recurso RSC7 e devolve (versão, dados)."""
    b = open(caminho, "rb").read()
    assert b[:4] == b"RSC7", "não é um recurso RSC7"
    versao = struct.unpack_from("<I", b, 4)[0]
    return versao, zlib.decompress(b[16:], -15)


class Leitor:
    def __init__(self, d):
        self.d = d

    def u8(self, o):
        return self.d[o]

    def u16(self, o):
        return struct.unpack_from("<H", self.d, o)[0]

    def i16(self, o):
        return struct.unpack_from("<h", self.d, o)[0]

    def u32(self, o):
        return struct.unpack_from("<I", self.d, o)[0]

    def i32(self, o):
        return struct.unpack_from("<i", self.d, o)[0]

    def u64(self, o):
        return struct.unpack_from("<Q", self.d, o)[0]

    def f32(self, o):
        return struct.unpack_from("<f", self.d, o)[0]

    def ptr(self, o):
        v = self.u64(o)
        return (v & 0x0FFFFFFF) if (v >> 28) == 5 else 0

    def texto(self, o):
        fim = self.d.index(b"\0", o)
        return self.d[o:fim].decode("latin1")


# ------------------------------------------------------------------ esqueleto (.yft)


def ler_esqueleto(caminho):
    """Lista de ossos: nome, etiqueta (tag), pai, rotação (x, y, z, w) e translação locais."""
    _, d = abrir(caminho)
    L = Leitor(d)
    alvo = d.find(b"SKEL_ROOT\0")
    assert alvo >= 0, "sem SKEL_ROOT"
    # o osso guarda um ponteiro para o nome em +0x38; o primeiro osso é o SKEL_ROOT
    ponteiro = struct.pack("<Q", 0x50000000 + alvo)
    onde = d.find(ponteiro)
    assert onde >= 0, "ninguém aponta para SKEL_ROOT"
    base = onde - 0x38
    ossos = []
    i = 0
    while True:
        o = base + i * 0x50
        if o + 0x50 > len(d):
            break
        nome_p = L.ptr(o + 0x38)
        indice = L.i16(o + 0x42)
        if not nome_p or indice != i:
            break
        ossos.append(
            {
                "i": i,
                "nome": L.texto(nome_p),
                "tag": L.u16(o + 0x44),
                "pai": L.i16(o + 0x32),
                "rot": struct.unpack_from("<4f", d, o),
                "pos": struct.unpack_from("<3f", d, o + 0x10),
            }
        )
        i += 1
    return ossos


# ------------------------------------------------------------------ animação (.ycd)


class Bits:
    """Leitura de bits do menos significativo para o mais, em palavras de 32 bits (little-endian)."""

    def __init__(self, dados):
        self.d = dados

    def ler(self, bit, n):
        if n == 0:
            return 0
        palavra = (bit // 32) * 4
        baixo = struct.unpack_from("<I", self.d, palavra)[0]
        alto = struct.unpack_from("<I", self.d, palavra + 4)[0] if palavra + 8 <= len(self.d) else 0
        par = (alto << 32) | baixo
        return (par >> (bit % 32)) & ((1 << n) - 1)


def ler_animacoes(caminho):
    """Devolve as animações do .ycd: quadros, duração e, por trilha, os valores de cada quadro."""
    versao, d = abrir(caminho)
    assert versao == 46, f"versão inesperada: {versao}"
    L = Leitor(d)
    mapa = L.ptr(0x18)
    ponteiros, capacidade = L.ptr(mapa + 0x18), L.u16(mapa + 0x20)
    saida = []
    for i in range(capacidade):
        e = L.ptr(ponteiros + i * 8)
        while e:
            saida.append(_ler_animacao(L, L.u32(e), L.ptr(e + 8)))
            e = L.ptr(e + 0x10)
    return saida


def _ler_animacao(L, hash_, a):
    quadros, duracao = L.u16(a + 0x14), L.f32(a + 0x18)
    seqs_p, seqs_n = L.ptr(a + 0x40), L.u16(a + 0x48)
    ossos_p, ossos_n = L.ptr(a + 0x50), L.u16(a + 0x58)
    trilhas = []
    for k in range(ossos_n):
        o = ossos_p + k * 4
        formato = L.u8(o + 2)  # 0 = vetor, 1 = quatérnio, 2 = número
        trilhas.append({"osso": L.u16(o), "formato": formato, "trilha": L.u8(o + 3), "quadros": []})
    for s in range(seqs_n):
        _ler_sequencia(L, L.ptr(seqs_p + s * 8), trilhas)
    return {"hash": hash_, "quadros": quadros, "duracao": duracao, "trilhas": trilhas}


def _ler_sequencia(L, sp, trilhas):
    inicio_quadros = L.u32(sp + 0x0C)
    n_quadros = L.u16(sp + 0x16)
    bytes_quadro = L.u16(sp + 0x18)
    dados = L.d[sp + 0x20 : sp + 0x20 + L.u32(sp + 4)]
    D = Leitor(dados)
    bits = Bits(dados)
    lista = inicio_quadros + bytes_quadro * n_quadros  # contagem de canais por tipo (9 × u16)
    info = lista + 18  # um u16 por canal: (trilha << 2) | componente
    pos = 0  # cabeçalhos dos canais, em palavras de 32 bits
    bit_no_quadro = 0
    canais = []
    for tipo in range(9):
        n = D.u16(lista + tipo * 2)
        for _ in range(n):
            ref = D.u16(info)
            info += 2
            c = {"tipo": tipo, "trilha": ref >> 2, "comp": ref & 3}
            if tipo == 0:  # quatérnio fixo (x, y, z; o w sai da norma)
                x, y, z = struct.unpack_from("<3f", dados, pos)
                pos += 12
                w = max(0.0, 1.0 - (x * x + y * y + z * z)) ** 0.5
                c["fixo"] = (x, y, z, w)
            elif tipo == 1:  # vetor fixo
                c["fixo"] = struct.unpack_from("<3f", dados, pos)
                pos += 12
            elif tipo == 2:  # número fixo
                c["fixo"] = D.f32(pos)
                pos += 4
            elif tipo == 3:  # número cru (32 bits por quadro)
                c["bits"] = 32
            elif tipo == 4:  # quantizado: bits × passo + base
                c["bits"], c["passo"], c["base"] = D.i32(pos), D.f32(pos + 4), D.f32(pos + 8)
                pos += 12
            elif tipo == 5:  # quantizado com tabela: o quadro guarda o índice
                c["bits"], bits_valor, n_ints = D.i32(pos), D.i32(pos + 4), D.i32(pos + 8)
                passo, base = D.f32(pos + 12), D.f32(pos + 16)
                pos += 20
                quantos = min((n_ints * 32) // bits_valor, 1 << c["bits"]) if bits_valor else 0
                c["tabela"] = [bits.ler(pos * 8 + k * bits_valor, bits_valor) * passo + base for k in range(quantos)]
                pos += n_ints * 4
            else:
                raise NotImplementedError(f"tipo de canal {tipo} (linear ou quatérnio em cache) não tratado")
            c["bit"] = bit_no_quadro
            bit_no_quadro += c.get("bits", 0)
            canais.append(c)
        if n % 4:
            info += (4 - n % 4) * 2
    assert pos == inicio_quadros, (pos, inicio_quadros)
    assert bit_no_quadro <= bytes_quadro * 8, (bit_no_quadro, bytes_quadro * 8)

    por_trilha = {}
    for c in canais:
        por_trilha.setdefault(c["trilha"], {})[c["comp"]] = c
    for f in range(n_quadros):
        inicio = (inicio_quadros + bytes_quadro * f) * 8
        for t, comps in por_trilha.items():
            tr = trilhas[t]
            tamanho = 4 if tr["formato"] == 1 else 3 if tr["formato"] == 0 else 1
            valor = [0.0] * tamanho
            for comp, c in comps.items():
                tipo = c["tipo"]
                if tipo in (0, 1):
                    valor = list(c["fixo"])
                    break
                if tipo == 2:
                    v = c["fixo"]
                elif tipo == 3:
                    v = struct.unpack("<f", struct.pack("<I", bits.ler(inicio + c["bit"], 32)))[0]
                elif tipo == 4:
                    v = bits.ler(inicio + c["bit"], c["bits"]) * c["passo"] + c["base"]
                else:
                    v = c["tabela"][bits.ler(inicio + c["bit"], c["bits"])]
                valor[comp] = v
            tr["quadros"].append(valor)
    return canais
