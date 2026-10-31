# Plantillas de WhatsApp — Recordatorios de turno

Este archivo es la copia oficial de los mensajes. La aplicación lo lee para
armar el texto y el enlace `wa.me`; el asistente revisa, copia y envía desde
su propio WhatsApp.

## Reglas de uso

-   Escribir en voseo rioplatense, con tono cordial y breve (máximo 4
    líneas).
-   Una sola pregunta por mensaje.
-   Reemplazar todas las variables `{{...}}`. Si falta un dato, no enviar.
-   Verificar el consentimiento de WhatsApp antes de enviar.
-   No incluir diagnósticos, nombres de tratamientos, indicaciones clínicas
    ni importes.
-   No enviar nada si el paciente pidió no recibir mensajes: registrar el
    intento como `skipped`.
-   Si el paciente hace una consulta clínica, responder que la odontóloga
    lo verá en el turno.

## Variables disponibles

| Variable                 | Ejemplo                 |
| ------------------------ | ----------------------- |
| `{{nombre}}`             | Laura                   |
| `{{fecha}}`              | lunes 9 de noviembre    |
| `{{hora}}`               | 10:30                   |
| `{{fecha_nueva}}`        | martes 10 de noviembre  |
| `{{hora_nueva}}`         | 09:00                   |
| `{{consultorio}}`        | Consultorio Dra. Laura  |
| `{{nombre_odontologa}}`  | Dra. Laura              |
| `{{telefono_consultorio}}` | +54 11 5555-5555      |
| `{{link_registro}}`      | https://app.../registro |

## Plantillas

### `initial` — recordatorio inicial (turno dentro de los próximos 30 días)

Hola {{nombre}}, te escribimos de {{consultorio}} para recordarte tu turno del {{fecha}} a las {{hora}}. ¿Podés confirmarnos si vas a poder asistir?

### `upcoming_48h` — recordatorio cercano (48 horas antes)

Hola {{nombre}}, te recordamos tu turno del {{fecha}} a las {{hora}} en {{consultorio}}. Respondé "SÍ" para confirmar o "NO" si necesitás reprogramarlo.

### `confirmation_request` — pedido de confirmación (paciente sin respuesta)

Hola {{nombre}}, todavía no nos confirmaste el turno del {{fecha}} a las {{hora}}. ¿Vas a poder venir? Si no te queda cómodo, buscamos otro horario.

### `confirmation_ack` — acuse de confirmación

¡Gracias, {{nombre}}! Te esperamos el {{fecha}} a las {{hora}} en {{consultorio}}. Si necesitás cambiar el turno, avisanos por acá.

### `reschedule_patient` — el paciente necesita reprogramar

Hola {{nombre}}, necesitamos reprogramar tu turno del {{fecha}} a las {{hora}}. ¿Qué día y horario te quedan cómodos? Buscamos un lugar lo antes posible.

### `reschedule_office` — el consultorio reprograma

Hola {{nombre}}, tuvimos que cambiar tu turno. Te ofrecemos el {{fecha_nueva}} a las {{hora_nueva}} en {{consultorio}}. ¿Te sirve?

### `follow_up` — seguimiento administrativo de tratamiento

Hola {{nombre}}, te escribimos de {{consultorio}} para coordinar la próxima sesión de tu tratamiento. ¿Querés que busquemos un turno esta semana o la próxima?

### `manual` — mensaje libre

Hola {{nombre}}, te escribimos de {{consultorio}} por tu turno del {{fecha}} a las {{hora}}. Contanos si necesitás algo o si querés que lo cambiemos.

### `registration_invite` — invitación a registrarse

Hola {{nombre}}, te escribimos de {{consultorio}}. Para enviarte recordatorios por WhatsApp, completá tus datos una sola vez en este enlace: {{link_registro}}

### `opt_out_ack` — confirmación de baja

Listo, {{nombre}}. No te vamos a enviar más recordatorios por WhatsApp. Si necesitás un turno, escribinos cuando quieras.

## Notas para el asistente

-   El asistente elige cuándo enviar. La aplicación no programa envíos ni
    marca recordatorios como pendientes por fecha.
-   Usar `initial` para el primer recordatorio y `upcoming_48h` cuando el
    turno está a menos de 48 horas.
-   Usar `confirmation_request` solo si el paciente no respondió al
    recordatorio anterior.
-   Usar `manual` cuando el mensaje no encaja en ninguna otra plantilla.
-   Usar `registration_invite` cuando el paciente todavía no está
    registrado o no dio consentimiento. No enviar recordatorios en ese
    caso.
-   Un reenvío (`resend`) siempre requiere confirmación explícita en la
    aplicación y un motivo escrito.
-   El teléfono del paciente debe estar en formato internacional. Para
    Argentina: `+54 9 <código de área> <número>`, por ejemplo
    `+54 9 11 5555-5555`.
