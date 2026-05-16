# Plataforma de Examen — Lean Process Implementer

Aplicación web para que los estudiantes rindan el examen de certificación
**Lean Process Implementer**. El administrador carga un banco de preguntas de
opción múltiple y, cuando un estudiante ingresa con su código único, el sistema
le arma un examen aleatorio. La calificación es instantánea (APROBADO /
REPROBADO).

## Características

- **Panel de administrador** para configurar el examen, gestionar el banco de
  preguntas, generar códigos de acceso y consultar resultados.
- **Carga de preguntas** manual o por importación de archivo CSV.
- **Parámetros configurables**: número de preguntas por examen, porcentaje para
  aprobar, duración del temporizador, intentos permitidos, mezcla de preguntas
  y opciones, y modo de revisión de respuestas.
- **Selección aleatoria** de preguntas por intento, fijada al iniciar.
- **Temporizador** persistente controlado por el servidor (no se puede
  manipular desde el navegador ni recargando la página).
- **Calificación automática** en el servidor; las respuestas correctas nunca se
  envían al navegador antes de finalizar.
- **Medidas anti-trampa**: una pregunta a la vez, bloqueo de copiar/pegar y
  menú contextual, y registro de las veces que el estudiante abandona la
  pantalla del examen.
- **Revisión de respuestas** mostrada según la configuración (nunca / solo si
  aprueba / siempre).
- **Notificación por correo** automática al estudiante con su resultado
  (APROBADO / REPROBADO y calificación), con textos personalizables por el
  administrador para cada caso.
- **Exportación de resultados** a CSV (compatible con Excel) y filtro para ver
  únicamente a los aprobados.

## Requisitos

- Node.js 18 o superior
- PostgreSQL 12 o superior

## Puesta en marcha

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear una base de datos PostgreSQL vacía.

3. Copiar `.env.example` a `.env` y completar los valores:

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL`: cadena de conexión a PostgreSQL.
   - `ADMIN_PASSWORD`: contraseña del panel de administrador.
   - `JWT_SECRET`: cadena larga y aleatoria para firmar las sesiones.
   - `PGSSL`: `true` si tu proveedor de base de datos exige SSL.

4. Iniciar el servidor (las tablas se crean automáticamente):

   ```bash
   npm start
   ```

5. Abrir en el navegador:

   - Estudiantes: `http://localhost:3000`
   - Administrador: `http://localhost:3000/admin.html`

## Uso

### Administrador

1. Ingresar al panel con la contraseña configurada.
2. **Configuración**: definir título, número de preguntas, porcentaje para
   aprobar, duración, intentos y opciones de mezcla.
3. **Banco de preguntas**: crear preguntas manualmente o importar un CSV. En
   `sample/preguntas-ejemplo.csv` hay un archivo de ejemplo.
4. **Códigos de acceso**: generar códigos (uno por estudiante, con nombre
   opcional) y entregarlos.
5. **Resultados**: consultar el detalle de cada examen rendido, descargar el
   CSV con todos los resultados o filtrar solo a los aprobados.

#### Notificaciones por correo

En la pestaña **Configuración**, panel *Notificaciones por correo*, se puede
activar el envío automático del resultado al correo del estudiante. Hay que
indicar el servidor SMTP (host, puerto, usuario, contraseña y remitente) y
redactar los mensajes para los casos APROBADO y REPROBADO. En los textos se
pueden usar las variables `{nombre}`, `{puntaje}`, `{resultado}`, `{examen}` y
`{minimo}`. El botón *Enviar prueba* permite validar la configuración SMTP.

### Formato del CSV de importación

Encabezados de columna (sin distinguir mayúsculas):

| Columna      | Obligatoria | Descripción                                  |
|--------------|-------------|----------------------------------------------|
| `pregunta`   | Sí          | Enunciado de la pregunta                     |
| `categoria`  | No          | Tema o categoría                             |
| `dificultad` | No          | Nivel de dificultad                          |
| `opcion_a`   | Sí          | Texto de la opción A                         |
| `opcion_b`   | Sí          | Texto de la opción B                         |
| `opcion_c`   | No          | Texto de la opción C                         |
| `opcion_d`   | No          | Texto de la opción D                         |
| `opcion_e`   | No          | Texto de la opción E                         |
| `correctas`  | Sí          | Letra(s) correcta(s), ej. `A` o `A,C`        |

Si manejas el banco en Excel, exporta la hoja como CSV antes de importarla.

### Estudiante

1. Ingresar nombre completo, correo electrónico y código de acceso.
2. Rendir el examen con el temporizador visible. El examen se envía
   automáticamente al agotarse el tiempo.
3. Ver el resultado (APROBADO / REPROBADO) y, si está habilitado, la revisión
   de respuestas. Si el envío de correo está activo, el resultado también llega
   a su correo electrónico.
