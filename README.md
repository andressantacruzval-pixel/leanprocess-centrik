# Plataforma de Exámenes de Certificación

Aplicación web para que los estudiantes rindan exámenes de certificación
(por ejemplo *Lean Process Implementer* o *Business Continuity Implementer*).
El administrador puede crear **múltiples certificaciones**, cada una con su
propio banco de preguntas y configuración. Cuando un estudiante ingresa con su
código único, el sistema identifica a qué certificación pertenece y le arma un
examen aleatorio. La calificación es instantánea (APROBADO / REPROBADO).

## Características

- **Múltiples certificaciones**: el administrador crea y administra varios
  exámenes de forma independiente, cada uno con su propio banco de preguntas,
  configuración, códigos de acceso y resultados.
- **Códigos de acceso por certificación**: cada código queda asociado a una
  certificación; el estudiante solo necesita su código para entrar.
- **Panel de administrador** para crear certificaciones, configurarlas,
  gestionar el banco de preguntas, generar códigos y consultar resultados.
- **Carga de preguntas** manual o por importación de archivo CSV.
- **Parámetros configurables por certificación**: número de preguntas por
  examen, porcentaje para aprobar, duración del temporizador, intentos
  permitidos, mezcla de preguntas y opciones, y modo de revisión de respuestas.
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
2. **Certificaciones**: crear las certificaciones (ej. "Lean Process
   Implementer", "Business Continuity Implementer"). La barra superior permite
   elegir la certificación activa; las pestañas Configuración, Banco de
   preguntas y Códigos operan sobre ella.
3. **Configuración**: definir nombre, número de preguntas, porcentaje para
   aprobar, duración, intentos, opciones de mezcla y los textos del correo de
   resultado de la certificación activa.
4. **Banco de preguntas**: crear preguntas manualmente o importar un CSV. En
   `sample/preguntas-ejemplo.csv` hay un archivo de ejemplo.
5. **Códigos de acceso**: generar códigos (uno por estudiante, con nombre
   opcional) y entregarlos. Los códigos quedan asociados a la certificación
   activa.
6. **Resultados**: consultar el detalle de cada examen rendido, filtrar por
   certificación o por aprobados, y descargar el CSV con los resultados.
7. **Correo**: configurar el servidor SMTP global usado para enviar los
   resultados.

#### Notificaciones por correo

En la pestaña **Correo** se configura el servidor SMTP global (host, puerto,
usuario, contraseña y remitente) y se activa el envío automático del resultado
al correo del estudiante. El botón *Enviar prueba* permite validar la
configuración SMTP.

Los textos de los mensajes para los casos APROBADO y REPROBADO se redactan por
separado en la pestaña **Configuración** de cada certificación. En los textos
se pueden usar las variables `{nombre}`, `{puntaje}`, `{resultado}`,
`{examen}` y `{minimo}`.

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
