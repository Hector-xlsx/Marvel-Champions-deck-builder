# Publicación en GitHub Pages

El código vive en [Marvel Champions Deck Builder](https://github.com/Hector-xlsx/Marvel-Champions-deck-builder). La aplicación se abre en [GitHub Pages](https://hector-xlsx.github.io/Marvel-Champions-deck-builder/).

El flujo de GitHub Actions publica `dist/` al actualizar `main`. Antes de subir un cambio, sincroniza los archivos ejecutables de `dist/` con `web/` y ejecuta `npm test`. Si cambias el catálogo, regenera `dist/` con `npm run gestor:preparar` desde el espacio de trabajo con la biblioteca original. Los datos originales y la configuración local quedan fuera del repositorio.

En un navegador compatible, instala la aplicación desde su menú. Tras una primera carga en línea, el constructor y el catálogo quedan disponibles sin conexión. Las ilustraciones se guardan cuando se cargan. Los mazos se guardan en el navegador. Para moverlos desde otro enlace o dispositivo, exporta la biblioteca como JSON e impórtala en la aplicación publicada.
