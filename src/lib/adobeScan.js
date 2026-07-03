/**
 * Abre o aplicativo Adobe Scan no dispositivo mobile.
 * Após o usuário escanear o documento e retornar ao app,
 * abre automaticamente o seletor de arquivos para selecionar o scan.
 *
 * URL schemes:
 * - iOS: com.adobe.scan.ios://
 * - Android: intent://scan#Intent;package=com.adobe.scan.android;scheme=adobescan;end
 *
 * Se o app não estiver instalado, redireciona para a loja correspondente.
 *
 * @param {React.RefObject} fileInputRef - Ref do input[type=file] (sem capture) a ser aberto no retorno
 */
export function abrirAdobeScan(fileInputRef) {
  const ua = navigator.userAgent || "";
  const isAndroid = /android/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // App Store / Play Store URLs para fallback
  const playStoreUrl = "https://play.google.com/store/apps/details?id=com.adobe.scan.android";
  const appStoreUrl = "https://apps.apple.com/app/adobe-scan/id1199564834";

  const startTime = Date.now();
  let jaRetornou = false;

  const handleVisibility = () => {
    if (!document.hidden && Date.now() - startTime > 1500 && !jaRetornou) {
      jaRetornou = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      // Se voltou rápido demais (app não abriu), provavelmente não está instalado
      if (Date.now() - startTime < 3000) {
        // Abre o seletor de arquivos mesmo assim, e mostra alerta
        if (fileInputRef?.current) {
          fileInputRef.current.value = "";
          fileInputRef.current.click();
        }
      } else {
        // App abriu e usuário voltou — abre seletor de arquivos
        setTimeout(() => {
          if (fileInputRef?.current) {
            fileInputRef.current.value = "";
            fileInputRef.current.click();
          }
        }, 300);
      }
    }
  };

  document.addEventListener("visibilitychange", handleVisibility);
  setTimeout(() => {
    document.removeEventListener("visibilitychange", handleVisibility);
  }, 120000);

  // Detecta se o app não abriu (fallback para loja)
  let appAbriu = false;
  const checkFallback = setTimeout(() => {
    if (!appAbriu && !document.hidden) {
      const loja = isIOS ? appStoreUrl : playStoreUrl;
      const ir = confirm(
        "O aplicativo Adobe Scan não foi encontrado no seu aparelho.\n\nDeseja baixá-lo agora na loja?"
      );
      if (ir) {
        window.open(loja, "_blank");
      }
    }
  }, 2500);

  // Marca como abriu quando a página perde visibilidade
  const onHidden = () => {
    if (document.hidden) {
      appAbriu = true;
      clearTimeout(checkFallback);
      document.removeEventListener("visibilitychange", onHidden);
    }
  };
  document.addEventListener("visibilitychange", onHidden);

  // Tenta abrir o Adobe Scan
  if (isAndroid) {
    // Android: usa intent URI
    window.location.href = "intent://scan#Intent;package=com.adobe.scan.android;scheme=adobescan;end";
  } else if (isIOS) {
    // iOS: usa o custom scheme oficial
    window.location.href = "com.adobe.scan.ios://";
  } else {
    // Desktop: não há app Adobe Scan, vai direto para o site
    window.open("https://acrobat.adobe.com/scan.html", "_blank");
  }
}

/**
 * Verifica se o dispositivo é mobile (onde o app Adobe Scan pode ser instalado).
 */
export function isMobileDevice() {
  const ua = navigator.userAgent || "";
  return /android/i.test(ua) || /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}