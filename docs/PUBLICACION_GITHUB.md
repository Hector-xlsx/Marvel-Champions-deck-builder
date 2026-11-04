# Publicación privada en GitHub

El destino previsto es [Hector-xlsx/mc-db](https://github.com/Hector-xlsx/mc-db). El repositorio debe crearse vacío, con visibilidad **Private**. Mantener GitHub Pages desactivado y conceder acceso solo a las personas autorizadas desde la configuración del repositorio.

## Qué se sube

El repositorio incluye código, pruebas, documentación y la versión ejecutable de `dist/`, con el catálogo derivado y sus imágenes WebP. La lista de inclusión en `.gitignore` deja fuera los originales de `data/`, los clones de `sources/`, las capturas de evidencia, las dependencias instaladas y los archivos de configuración local. La copia privada se puede ejecutar con Node.js 22 o posterior mediante `npm run gestor:servir` o el lanzador de Windows. Para regenerar `dist/` se necesita el espacio de trabajo original con la biblioteca local y sus dependencias.

## Primera subida

1. En el espacio de trabajo original, ejecutar `npm run gestor:preparar` y `npm test`.
2. Confirmar en GitHub que el repositorio pertenece a **Hector-xlsx**, se llama **mc-db**, figura como **Private** y tiene Pages desactivado.
3. En la raíz del proyecto, ejecutar los siguientes comandos. Si ya hay un repositorio local o remoto con historial, inspeccionar sus ramas y su remoto antes de aplicar estos comandos de primera subida.

   ```powershell
   git init -b main
   git add -- .gitignore README.md package.json 'Lanzar servidor local.cmd' web scripts tests docs dist
   git diff --cached --stat
   git diff --cached --name-only
   ```

4. Revisar la lista preparada, comprobar que solo incluye archivos del alcance anterior y que no contiene credenciales, respaldos ni archivos personales. Luego ejecutar:

   ```powershell
   git commit -m "Publicar primera versión privada de Marvel 2.0"
   git remote add origin https://github.com/Hector-xlsx/mc-db.git
   git push -u origin main
   ```

5. Comparar `git rev-parse HEAD` con `git ls-remote origin refs/heads/main`. En GitHub, confirmar de nuevo la visibilidad **Private** y el estado de Pages. Probar el arranque desde un clon limpio y comprobar que se cargan el catálogo y las imágenes.

## Pendiente después de la primera publicación

Una vez verificados el acceso privado, la subida y el arranque desde un clon limpio, convertir este protocolo en una **skill reutilizable** para proyectos nuevos. La skill debe recibir la cuenta, el repositorio, la visibilidad y el alcance de archivos como parámetros. Debe separar el push de código del despliegue web y comprobar el resultado real de cada operación.
