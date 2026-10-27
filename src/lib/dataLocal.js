// Data local do dia (não UTC): entre 21h e 0h no Brasil o UTC já virou "amanhã",
// e datas de produção gravadas em UTC faziam a OP sumir da fila da máquina.
export function hojeLocalISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}