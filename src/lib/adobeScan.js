/**
 * Abre o aplicativo Adobe Scan no dispositivo mobile.
 * Após o usuário escanear o documento e retornar ao app,
 * abre automaticamente o seletor de arquivos para selecionar o scan.
 *
 * @param {React.RefObject} fileInputRef - Ref do input[type=file] (sem capture) a ser aberto no retorno
 */
export function abrirAdobeScan(fileInputRef) {
  const startTime = Date.now();
  let jaRetornou = false;

  const handleVisibility = () => {
    if (!document.hidden && Date.now() - startTime > 1500 && !jaRetornou) {
      jaRetornou = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      setTimeout(() => {
        if (fileInputRef?.current) {
          fileInputRef.current.value = "";
          fileInputRef.current.click();
        }
      }, 300);
    }
  };

  document.addEventListener("visibilitychange", handleVisibility);

  // Limpa o listener após 2 minutos (caso o usuário não volte)
  setTimeout(() => {
    document.removeEventListener("visibilitychange", handleVisibility);
  }, 120000);

  // Tenta abrir o Adobe Scan via URL scheme
  window.location.href = "adobescan://";
}