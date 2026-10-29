# Entregrable1_Grupo7_ — API REST de usuarios y mascotas

Interfaz sencilla en español, sin marca ni logotipos. Incluye dos secciones: Mascotas y Usuarios.

Implementación de «Especificación Entregable 1.docx»: Node.js 18+, Express, JSON con `fs.promises`, contraseñas con `crypto.scrypt`, Multer con `diskStorage` y archivos estáticos. Incluye una interfaz gráfica en español para gestionar ambos recursos desde el navegador. No requiere base de datos ni un proceso de compilación del frontend.

## Instalación y ejecución

Clonar el repositorio y ejecutar:

```sh
git clone https://github.com/JaderSarria/Entregrable1_Grupo7_.git
cd Entregrable1_Grupo7_
npm ci
npm start
```

Abrir **http://localhost:8080** para usar la interfaz gráfica. Se puede definir la variable de entorno `PORT`. Para pruebas aisladas o despliegues se admiten `DATA_DIR` y `PUBLIC_DIR` como rutas alternativas; por defecto se utilizan exactamente `src/data` y `public`. Si se configura otro `PUBLIC_DIR`, copiar también allí los archivos de interfaz de `public`.

## Uso de la interfaz gráfica

1. Elegir **Mascotas** o **Usuarios** en el menú.
2. Pulsar **Añadir mascota** o **Añadir usuario**, completar los campos y, si se desea, seleccionar imágenes. Pulsar **Guardar**.
3. Las mascotas aparecen en fichas con sus fotos; los usuarios, en una tabla con avatar, nombre y nombre de usuario. La búsqueda permite filtrar por sus datos o ID.
4. **Abrir ficha** muestra los datos de una mascota. En usuarios, pulsar el nombre abre sus detalles. **Editar** permite modificar información; la papelera pide confirmación antes de eliminar.
5. Al editar usuarios, dejar la contraseña vacía conserva la actual. Un avatar nuevo reemplaza el anterior.
6. Al editar mascotas, elegir entre conservar las fotos y agregar otras o reemplazarlas todas. Reemplazar sin seleccionar fotos permite eliminar las imágenes actuales.

La pantalla se comunica con la API mediante peticiones HTTP reales y formularios multipart. Los datos se guardan en los JSON del servidor. Incluye vistas vacías, validaciones, vistas previas, avisos de guardado, mensajes de error y diseño adaptable a móviles. No depende de fuentes, imágenes o servicios externos.

**Si usaste el ZIP anterior:** extraer esta versión en una carpeta nueva, detener el servidor anterior con Ctrl+C y ejecutar `npm ci` y `npm start` en la nueva carpeta. Para conservar registros existentes, copiar antes `src/data/users.json`, `src/data/pets.json` y las carpetas `public/img/users` y `public/img/pets` del proyecto anterior al nuevo. No abrir `index.html` con doble clic: acceder siempre mediante la URL del servidor. Si el navegador conserva la versión anterior, recargar con Ctrl+F5.

## Estructura

```text
public/img/users/.gitkeep
public/img/pets/.gitkeep
public/index.html
public/styles.css
public/app.js
public/favicon.svg
src/app.js
src/middlewares/multer.middleware.js
src/routes/users.router.js
src/routes/pets.router.js
src/utils/crypto.js
src/utils/store.js
src/utils/resource.js
src/data/users.json
src/data/pets.json
test/api.test.js
test/helpers/in-process.cjs
test/run-in-process.cjs
package.json
package-lock.json
README.md
```

Se conservan todos los archivos y directorios exigidos. Las utilidades y pruebas adicionales evitan duplicar la lógica compartida.

## Rutas y respuestas

| Método | Usuarios | Mascotas | Resultado |
| --- | --- | --- | --- |
| GET | /api/users | /api/pets | 200, array de registros |
| GET | /api/users/:id | /api/pets/:id | 200, registro |
| POST | /api/users | /api/pets | 201, registro creado |
| PUT | /api/users/:id | /api/pets/:id | 200, registro actualizado |
| DELETE | /api/users/:id | /api/pets/:id | 200, mensaje e ID |

Errores JSON `{ "error": "mensaje" }`: 400 para campos faltantes, inválidos, ID mal formado, username duplicado o carga inválida; 404 para recursos o rutas inexistentes; 500 para errores de persistencia o servidor. Los detalles internos de un 500 solo aparecen en la terminal.

### Usuarios

POST: `firstname`, `lastname`, `username` y `password` obligatorios. `avatar` es una imagen opcional. PUT admite cualquiera de estos campos; los omitidos se conservan. Un avatar nuevo reemplaza y elimina el anterior. La contraseña se vuelve a procesar con scrypt y salt aleatorio; **ninguna respuesta devuelve password**, tampoco POST y PUT. `username` es único sin distinguir mayúsculas.

### Mascotas

POST: `especie`, `color`, `edad` y `sexo` obligatorios; imágenes opcionales bajo el campo repetido `img`. `edad` se persiste como entero no negativo y `sexo` acepta `macho` o `hembra`. PUT permite actualización parcial. Por defecto agrega imágenes; `imageMode=replace` reemplaza la colección y elimina los archivos anteriores. Con `imageMode=replace` y algún campo de datos, sin imágenes, se puede vaciar la colección.

Se permiten **hasta cinco imágenes por petición**, como exige `upload.array('img', 5)`; pueden acumularse más mediante varias actualizaciones. Avatares: `upload.single('avatar')`. Se admiten JPEG, PNG, WebP y GIF declarados por MIME, con límite de 5 MiB por archivo. No se inspecciona el contenido binario para autenticar el tipo de imagen. Los nombres se generan con fecha y UUID; no se reutilizan nombres enviados por el cliente. Las URL guardadas, como `/img/pets/archivo.png`, son accesibles mediante GET.

Ambos recursos aceptan `multipart/form-data`; para operaciones sin archivos también admiten JSON y formularios URL encoded. Los campos no reconocidos se rechazan. Los archivos recibidos se eliminan si falla la validación o persistencia. DELETE también elimina sus imágenes.

## Ejemplos de pruebas manuales

En Windows usar `curl.exe`; en macOS/Linux usar `curl`. Sustituir las rutas de los archivos y los ID según las respuestas.

```sh
curl.exe -i -F "firstname=Ana" -F "lastname=Perez" -F "username=ana" -F "password=secreto" -F "avatar=@avatar.png" http://localhost:8080/api/users
curl.exe -i http://localhost:8080/api/users
curl.exe -i http://localhost:8080/api/users/1
curl.exe -i -X PUT -F "password=otra-clave" -F "avatar=@nuevo.png" http://localhost:8080/api/users/1
curl.exe -i -F "especie=perro" -F "color=negro" -F "edad=4" -F "sexo=macho" -F "img=@foto1.png" -F "img=@foto2.png" http://localhost:8080/api/pets
curl.exe -i http://localhost:8080/api/pets
curl.exe -i http://localhost:8080/api/pets/1
curl.exe -i -X PUT -F "color=blanco" -F "imageMode=replace" -F "img=@foto3.png" http://localhost:8080/api/pets/1
curl.exe -i -X DELETE http://localhost:8080/api/pets/1
curl.exe -i -X DELETE http://localhost:8080/api/users/1
```

Para verificar imágenes, abrir en el navegador `http://localhost:8080` seguido de la URL `avatar` o `img` devuelta por la API. Reiniciar el servidor y consultar GET para comprobar persistencia.

## Pruebas automatizadas

```sh
npm test
```

Las pruebas levantan un servidor HTTP real en un puerto disponible y usan directorios temporales: no modifican los JSON entregados. Cubren las diez rutas, archivos estáticos, actualización y borrado de imágenes, límites de carga, validaciones, hashing y ocultación de contraseñas, persistencia, escrituras concurrentes y respuesta 500 ante JSON corrupto.

También comprueban que `/` entregue la interfaz y que sus archivos HTML, CSS, JavaScript e icono estén disponibles. Si el entorno no permite conexiones locales, `npm run test:in-process` ejecuta las mismas comprobaciones directamente contra Express sin abrir puertos. Esta alternativa verifica rutas y formularios multipart, pero no reemplaza una revisión visual del navegador.

En esta versión se superaron 42 comprobaciones con `npm run test:in-process` en Node.js 24. La revisión visual del navegador y la repetición de pruebas por red local no pudieron completarse por restricciones del entorno de ejecución. Para elegir un directorio temporal de pruebas alternativo, configurar `TEST_TMP_DIR`; los datos de prueba se crean en una subcarpeta única y se eliminan al finalizar.

## Persistencia y alcance

Todas las operaciones propias de archivos usan exclusivamente `node:fs/promises` con async/await. Se serializan las modificaciones por recurso y se escribe primero un archivo temporal, seguido de rename, para evitar actualizaciones perdidas dentro de un proceso. Los JSON comienzan vacíos; los ID son enteros positivos generados como máximo actual + 1. No ejecutar varias instancias escribiendo sobre los mismos JSON. La limpieza de imágenes sucede después de guardar los datos; si esa limpieza falla, la API devuelve 500 aunque el cambio de datos ya se haya guardado. El ejercicio no incluye autenticación ni autorización.

## Repositorio

Versión oliva del proyecto: [JaderSarria/Entregrable1_Grupo7_](https://github.com/JaderSarria/Entregrable1_Grupo7_). Incluye el backend y la interfaz de esta versión, con sus etapas organizadas en commits.
