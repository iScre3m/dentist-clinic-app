# Plan: WhatsApp recordatorio de turno desde el panel

**Ruta del plan:** `.kilo/plans/1793461740000-whatsapp-dashboard-reminder.md`
**Objetivo:** El asistente puede hacer clic en un botón "Enviar recordatorio" en cada turno próximo del panel, ver el mensaje de la plantilla de WhatsApp, abrir el enlace `wa.me` (gesto del usuario) con el número del paciente y registrar el envío como `sent` / `skipped`.

---

## Contexto y estado actual (verificado en el repositorio)

- Stack: SvelteKit, Svelte 5, Tailwind, shadcn-svelte, Drizzle + SQLite, Better Auth, Valibot, libphonenumber-js. `pnpm` scripts: `dev`, `build`, `check`, `lint`, `db:migrate`, `db:seed`, `test:unit`.
- Servicio WhatsApp ya existe: `src/lib/server/services/whatsapp/index.ts` con `TEMPLATES` (10 claves, incl. `initial`), `renderTemplate`, `buildWaMeLink`, `buildRegistrationInviteLink`. Espeja `templates/whatsapp/reminder.es.md`.
- Esquema BD ya tiene `reminder_records` (`id, appointmentId, purpose, templateKey, status prepared|sent|skipped, recordedBy, recordedAt, resentReason, ...`). No se necesita migración.
- Panel: `src/routes/(app)/dashboard/+page.server.ts` devuelve `upcoming` (con `patientName`, `patientPhone`) pero **sin** estado de consentimiento, sin `optedOutAt` y sin botón de recordatorio. `+page.svelte` no tiene botón "Enviar recordatorio" (usa un `getInviteUrl()` embebido solo para eventos sin paciente).
- Todas las rutas `(app)` están protegidas por sesión (`+layout.server.ts` redirige a `/login` si no hay `locals.session`).
- La página de detalle de paciente `pacientes/[id]/+page.svelte` **no existe** (solo `+page.server.ts` vacía): queda fuera de alcance de esta tarea.

---

## Decisiones (recomendadas, basadas en AGENTS.md §4)

1. **Superficie objetivo:** tarjeta "Próximos turnos" del panel, una acción por turno próximo. No se toca la página de detalle de paciente en este MVP.
2. **Flujo por turno (botón en el panel):**
   - `consent === granted` y teléfono presente y `optedOutAt` nulo → botón "Enviar recordatorio" → página de vista previa.
   - `consent === unknown` → botón "Enviar invitación a registrarse" → enlace `wa.me` directo con plantilla `registration_invite` (gesto de usuario, sin registro de envío).
   - `consent === denied`, opt-out, o sin teléfono válido → mensaje de error en línea, sin acción de WhatsApp.
3. **Vista previa:** nueva ruta `(app)/turnos/[appointmentId]/recordatorio` (`+page.server.ts` + `+page.svelte`). El servidor renderiza plantilla `initial` (vars: `nombre`, `fecha`, `hora`, `consultorio`, `nombre_odontologa`, `telefono_consultorio`) y construye el enlace `wa.me`. El cliente muestra el mensaje (textarea editable, sin guardar el cuerpo — el esquema no almacena cuerpos) y un `<a href="https://wa.me/...">` real que el asistente clickea (popup blockers lo permiten).
4. **Registro del envío:** acciones POST en la vista previa:
   - `marcarEnviado` → `reminder_records.status = 'sent'`, `recordedBy = usuario actual`, `recordedAt = ahora`.
   - `omitir` → `status = 'skipped'`.
   - Se reutiliza una fila `prepared` existente para la misma `(appointmentId, purpose='reminder')` (no se duplican).
   - Si ya existe una fila `sent` para ese turno y propósito, se ofrece "Reenviar" con `resent_reason` obligatorio y se crea una fila nueva con `purpose='resend'`.
5. **Copia de texto:** botón "Copiar mensaje" (portapapeles); si falla, el texto queda en un campo seleccionable.
6. **Copy de UI:** agregar a `src/lib/copy.ts` etiquetas de botón, mensajes de confirmación y errores (es-AR).
7. **No se implementa:** envío automático, WhatsApp Business API, estados delivered/read, programación, la bandera de 24 h de filas `prepared` (se deja como seguimiento), página de detalle de paciente.

---

## Alcance (dentro / fuera)

**Dentro:**

- Botón "Enviar recordatorio" en el panel por turno próximo (filtrado por consentimiento/teléfono/opt-out).
- Ruta de vista previa `/turnos/[id]/recordatorio` con plantilla, enlace `wa.me`, copia al portapapeles, acciones enviar/omitir.
- Registros `reminder_records` (crear/reutilizar `prepared`, marcar `sent`/`skipped`, reenvío con motivo).
- Botón "Enviar invitación a registrarse" para consentimiento `unknown`.
- Error en línea para `denied` / opt-out / teléfono sin validar.

**Fuera:**

- Página de detalle de paciente (`pacientes/[id]`) y su botón de recordatorio.
- Registro automático, recordatorios programados, estados de entrega/lectura.
- Migración de BD (la tabla `reminder_records` ya existe).

---

## Flujo de datos

1. `GET /(app)/dashboard` → `load` suma `whatsappConsent`, `optedOutAt`, `phone` de `patients` al listado `upcoming`. El componente decide qué botón mostrar por turno.
2. Clic "Enviar recordatorio" → `goto('/(app)/turnos/[id]/recordatorio')`.
3. `GET /turnos/[id]/recordatorio` (`+page.server.ts`):
   - `requireUser(locals)`.
   - Carga turno + paciente; valida que el turno sea futuro y `calendarStatus === 'confirmed'`; valida `consent === 'granted'`, teléfono, sin `optedOutAt`; si falla → error 403/400 con mensaje.
   - Renderiza `initial`, construye `wa.me`, busca fila `reminder_records` existente para `(appointmentId, 'reminder')`.
4. Cliente muestra mensaje editable + `<a href=wa.me target=_blank>` + botón "Copiar".
5. Clic "Confirmar enviado" → `POST ?/marcarEnviado` → actualiza `reminder_records` a `sent`. Clic "Omitir" → `skipped`. Clic "Reenviar" (si ya hay `sent`) → form con `resent_reason` obligatorio → fila nueva `purpose='resend'`, `status='prepared'`, luego se vuelve a la vista previa para confirmar.

---

## Casos de fallo y bordes

- Sesión expirada → `+layout.server.ts` redirige a `/login` (sin cambios).
- Paciente sin consentimiento / dado de baja → no se muestra botón de recordatorio; error en línea si se intenta forzar.
- Teléfono inválido o no móvil → se trata como no elegible (el teléfono ya se normaliza y valida al registrarse/editar; se revalida ligero en el servidor de la vista previa).
- Turno ya cancelado/borrado en el calendario (`calendarStatus !== 'confirmed'` o pasado) → no se ofrece recordatorio.
- Pop-up bloqueado → el enlace `wa.me` es un `<a>` clickeado por el usuario; se muestra el mensaje copiable como alternativa.
- Doble envío accidental → se reutiliza la fila `prepared`; el reenvío intencional requiere `resent_reason` explícito.

---

## Tareas (ordenadas)

1. `src/routes/(app)/dashboard/+page.server.ts`: agregar `whatsappConsent`, `optedOutAt`, `phone` a la selección de `upcoming` y pasar el usuario de la sesión (para `recordedBy`).
2. `src/routes/(app)/dashboard/+page.svelte`: en cada turno de "Próximos turnos", mostrar el botón correcto según elegibilidad ("Enviar recordatorio" / "Enviar invitación a registrarse" / error en línea). Importar etiquetas de `src/lib/copy.ts`.
3. `src/lib/copy.ts`: agregar `reminderCopy` (botones, confirmaciones, errores, estados).
4. `src/routes/(app)/turnos/[id]/recordatorio/+page.server.ts`: `load` con validación de elegibilidad, render de plantilla `initial`, enlace `wa.me`, fila existente de `reminder_records`; acciones `marcarEnviado`, `omitir`, `reenviar` (con `resent_reason` requerido).
5. `src/routes/(app)/turnos/[id]/recordatorio/+page.svelte`: vista previa del mensaje (textarea editable), `<a href=wa.me>`, botón "Copiar mensaje", acciones enviar/omitir/reenviar, estados de carga y éxito.
6. Verificación: `pnpm check`, `pnpm lint`, inspección visual del panel y de la vista previa con `FAKE_CALENDAR=1` y datos semillados (`pnpm db:seed`).

---

## Validación

- `pnpm check` (svelte-check + TypeScript) sin errores.
- `pnpm lint` sin errores.
- Con `FAKE_CALENDAR=1` y base semillada: abrir el panel, verificar que un turno con `consent=granted` muestra "Enviar recordatorio", que uno con `consent=unknown` muestra la invitación, y que uno con `consent=denied` muestra error y ningún enlace `wa.me`.
- Navegar a la vista previa, verificar que el mensaje usa la plantilla `initial`, que el enlace `wa.me` tiene solo dígitos y texto codificado, y que "Confirmar enviado" crea un registro `reminder_records` con `status='sent'`.
- Verificar que no se crean filas duplicadas al volver a la vista previa de un turno con una fila `prepared` existente.

---

## Suposiciones abiertas (resolver si se desea ajustar)

- El envío real lo hace el asistente desde su WhatsApp; la aplicación solo prepara el enlace y registra la confirmación del asistente (según AGENTS.md §4). Si se espera que el botón "envíe" directamente sin paso de confirmación, hay que replantear el flujo.
- La bandera de filas `prepared` con más de 24 h (mencionada en AGENTS.md) se deja para una iteración posterior; no bloquea este MVP.

---

Cuando este plan esté listo, se implementa el listado de tareas y se ejecuta `pnpm check`, `pnpm lint` y una verificación manual del flujo.
