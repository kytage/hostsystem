/** Enquanto alguém está dentro do HOST FAZENDAS (tela cheia por cima), a praça 3D para de desenhar. */
let pausado = false;
export const pausarMundo3D = (v: boolean) => {
  pausado = v;
};
export const mundoPausado = () => pausado;
