export function adminHtml(): string {
  return `<!doctype html>
<html lang="es-MX">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>YRAK Coberturas</title>
  <style>
    :root{font-family:Inter,system-ui,sans-serif;color:#172033;background:#f4f6f9}
    body{margin:0}.shell{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
    aside{background:#111827;color:#fff;padding:24px}aside h1{font-size:20px;margin:0 0 28px}
    nav a{display:block;color:#d1d5db;text-decoration:none;padding:10px 0}main{padding:32px}
    .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px}
    .card{background:#fff;border-radius:14px;padding:20px;box-shadow:0 4px 20px #1118270d}
    .number{font-size:34px;font-weight:750;margin-top:8px}.muted{color:#64748b}
    .status{margin-top:28px;background:#fff;padding:20px;border-radius:14px}
    @media(max-width:760px){.shell{grid-template-columns:1fr}aside{display:none}main{padding:20px}}
  </style>
</head>
<body>
<div class="shell"><aside><h1>YRAK Coberturas</h1><nav>
<a href="#">Resumen</a><a href="#">Coberturas</a><a href="#">Rotaciones</a>
<a href="#">Concursos</a><a href="#">Requisitos</a><a href="#">Auditoría</a>
</nav></aside><main><h2>Centro de control</h2><p class="muted">Rotaciones, concursos y asignaciones temporales.</p>
<div class="cards" id="cards"><div class="card">Cargando…</div></div>
<div class="status"><strong>Regla activa</strong><p>1–5 días: rotación. 6+ días: requisitos y examen. El nivel base nunca cambia.</p></div>
</main></div>
<script>
const labels={activeCoverages:'Coberturas activas',openCompetitions:'Concursos abiertos',requirementIssues:'Requisitos con incidencia',pendingApprovals:'Aprobaciones pendientes'};
fetch('/api/v1/dashboard').then(r=>r.json()).then(data=>{
 document.querySelector('#cards').innerHTML=Object.entries(labels).map(([key,label])=>'<div class="card"><div class="muted">'+label+'</div><div class="number">'+(data[key]??0)+'</div></div>').join('');
}).catch(()=>{document.querySelector('#cards').innerHTML='<div class="card">Inicia sesión mediante Cloudflare Access.</div>'});
</script></body></html>`;
}
