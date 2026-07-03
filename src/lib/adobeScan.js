/**
 * Abre o aplicativo Adobe Scan no dispositivo mobile.
 * Após o usuário escanear o documento e retornar ao app,
 * abre automaticamente o seletor de arquivos para selecionar o scan.
 *
 * @param {React.RefObject} fileInputRef - Ref do input[type=file] (sem capture) a ser aberto no retorno
 */
export function abrirAdobeScan(fileInputRef) {
  const ua = navigator.userAgent || "";
  const isAndroid = /android/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const startTime = Date.now();
  let jaRetornou = false;

  const handleVisibility = () => {
    if (!document.hidden && Date.now() - startTime > 1000 && !jaRetornou) {
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
  setTimeout(() => {
    document.removeEventListener("visibilitychange", handleVisibility);
  }, 120000);

  // Abre o Adobe Scan direto via URL scheme oficial
  if (isAndroid) {
    window.location.href = "intent://scan#Intent;package=com.adobe.scan.android;scheme=adobescan;end";
  } else if (isIOS) {
    window.location.href = "com.adobe.scan.ios://";
  }
}