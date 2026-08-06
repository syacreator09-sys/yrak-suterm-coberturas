# Lista de conexiones finales

El código no necesita modificarse para completar estas conexiones. Se agregan recursos, identificadores, secretos y datos reales.

## 1. Cloudflare

- [ ] Crear una base D1 por ambiente.
- [ ] Crear un bucket R2 privado por ambiente.
- [ ] Crear una Queue por ambiente.
- [ ] Confirmar Workers AI en la cuenta.
- [ ] Elegir nombres del Worker web y Worker MCP.
- [ ] Configurar dominio o subdominio.
- [ ] Configurar Cloudflare Access para `/admin` y `/api/*`.
- [ ] Copiar el `aud` de la aplicación Access.
- [ ] Crear una política que permita solamente usuarios autorizados.

Variables del GitHub Environment:

- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_D1_DATABASE_NAME`
- `CLOUDFLARE_R2_BUCKET_NAME`
- `CLOUDFLARE_QUEUE_NAME`
- `CLOUDFLARE_WORKER_NAME`
- `CLOUDFLARE_MCP_WORKER_NAME`
- `APP_ORIGIN`
- `EMAIL_FROM`
- `CF_ACCESS_TEAM_DOMAIN`
- `CF_ACCESS_AUD`
- `OPENAI_MODEL`
- `MCP_ORGANIZATION_ID`
- `MCP_ALLOWED_HOSTNAME`

Secretos del Environment:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `OPENAI_API_KEY`
- `BOOTSTRAP_TOKEN`
- `MCP_SERVICE_TOKEN`

## 2. Correo

- [ ] Verificar el dominio remitente en Cloudflare Email Service.
- [ ] Autorizar `EMAIL_FROM`.
- [ ] Crear reglas de Email Routing para las direcciones de entrada.
- [ ] Registrar cada dirección en `organization_email_channels`.
- [ ] Probar entrada, adjuntos, salida, rebote y reintento.

## 3. Organización y usuarios

- [ ] Ejecutar migraciones D1.
- [ ] Ejecutar `/bootstrap` una sola vez con `BOOTSTRAP_TOKEN`.
- [ ] Crear grupos y niveles.
- [ ] Crear transiciones inmediatas autorizadas, por ejemplo 7→8.
- [ ] Importar personal mediante CSV.
- [ ] Registrar cursos, certificaciones y evidencias.
- [ ] Crear usuarios y roles vinculando `externalSubject` de Cloudflare Access.
- [ ] Configurar días festivos o turnos cuando no se usen días naturales.

## 4. IA

- [ ] Cargar una llave de proyecto OpenAI como secreto.
- [ ] Elegir un modelo compatible con Responses API y entradas de imagen.
- [ ] Verificar transcripción con Workers AI.
- [ ] Probar que audios, imágenes y correos producen únicamente borradores con revisión humana.
- [ ] Confirmar que `store:false` está activo.

## 5. MCP

- [ ] Desplegar el Worker MCP con la misma D1.
- [ ] Configurar `MCP_SERVICE_TOKEN`.
- [ ] Limitar `MCP_ALLOWED_HOSTNAME` al hostname final.
- [ ] Conectar ChatGPT o Claude al endpoint `/mcp`.
- [ ] Confirmar que todas las herramientas son de solo lectura.

## 6. Prueba final

- [ ] Cobertura de exactamente 5 días: rotación.
- [ ] Cobertura de 6 días: concurso.
- [ ] Nivel 7 cubre 8 y regresa a 7.
- [ ] Cancelación previa restaura fila.
- [ ] Fin anticipado regresa al nivel base.
- [ ] Dos solicitudes simultáneas no seleccionan a la misma persona.
- [ ] Corrección de calificación exige segundo aprobador.
- [ ] Usuario sin grupo no ve expedientes ajenos.
- [ ] Respaldo D1 y R2 restaurado en ambiente aislado.
