/**
 * compressImage.js
 * 
 * Otimização de Performance no Upload de Fotos:
 * Redimensiona e comprime imagens no navegador antes do envio para o servidor/S3.
 * - Reduz arquivos de 10-20MB (fotos de smartphones) para ~300-500KB
 * - Acelera o upload em até 20x no chão de fábrica (4G/Wi-Fi instável)
 * - Garante que as fotos carreguem instantaneamente na tela para todos os operadores
 */
export async function comprimirImagemParaUpload(file, maxDim = 1920, qualidade = 0.82) {
  if (!file || !(file instanceof File || file instanceof Blob)) {
    return file;
  }

  // Se não for imagem (ex: PDF), retorna o arquivo original sem alteração
  if (!file.type || !file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }

  // Se a imagem já for leve (menor que 400KB), não precisa reprocessar
  if (file.size <= 400 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcula proporção para não distorcer mantendo maxDim
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file); // fallback caso canvas não esteja disponível
          return;
        }

        // Desenha com interpolação suave
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // Se por algum motivo o blob comprimido ficou maior que o original, mantém o original
              resolve(file);
            } else {
              // Preserva o nome original do arquivo
              const compressedFile = new File([blob], file.name || "foto_otimizada.jpg", {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            }
          },
          "image/jpeg",
          qualidade
        );
      };

      img.onerror = () => {
        resolve(file); // se falhar na decodificação, segue com original
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      resolve(file);
    };

    reader.readAsDataURL(file);
  });
}
