// supabase/functions/cleanup-attachments/index.ts
// Edge Function de limpeza de anexos (retenção de 15 dias).
//
// Fluxo:
//  1) chama a função do banco cleanup_expired_attachments() (migration 024), que apaga os
//     registros de attachments com mais de 15 dias e RETORNA os storage_path correspondentes;
//  2) remove os arquivos físicos do bucket "attachments" via Storage API (a deleção direta
//     em storage.objects é bloqueada pelo trigger protect_objects_delete);
//  3) registra logs claros: quantidade removida, caminhos e falhas.
//
// Não cria cron interno — agende externamente (ex.: Scheduled Functions / cron HTTP).
// Variáveis de ambiente (injetadas automaticamente no runtime de Edge Functions):
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY   (necessária: bypassa RLS e usa a Storage API)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "attachments";

Deno.serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    console.error("[cleanup-attachments] missing env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    return json({ error: "missing_env" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1) apaga registros expirados e obtém os caminhos a remover do Storage
  const { data: paths, error: rpcError } = await supabase.rpc("cleanup_expired_attachments");
  if (rpcError) {
    console.error("[cleanup-attachments] rpc error:", rpcError.message);
    return json({ error: "rpc_failed", message: rpcError.message }, 500);
  }

  const pathList: string[] = Array.isArray(paths) ? (paths as string[]) : [];
  console.log(`[cleanup-attachments] registros removidos do banco: ${pathList.length}`);
  console.log(`[cleanup-attachments] caminhos: ${JSON.stringify(pathList)}`);

  let storageRemoved = 0;
  const failures: { path: string; error: string }[] = [];

  // 2) remove os arquivos físicos via Storage API (em lote)
  if (pathList.length > 0) {
    const { data: removed, error: rmError } = await supabase.storage.from(BUCKET).remove(pathList);
    if (rmError) {
      console.error("[cleanup-attachments] storage remove error:", rmError.message);
      for (const p of pathList) failures.push({ path: p, error: rmError.message });
    } else {
      storageRemoved = removed?.length ?? 0;
      // caminhos que voltaram na resposta = efetivamente removidos
      const removedNames = new Set((removed ?? []).map((o) => o.name));
      for (const p of pathList) {
        if (!removedNames.has(p)) failures.push({ path: p, error: "não removido (não encontrado?)" });
      }
    }
  }

  const result = {
    db_records_removed: pathList.length,
    storage_objects_removed: storageRemoved,
    paths: pathList,
    failures,
  };
  console.log(`[cleanup-attachments] resumo: ${JSON.stringify(result)}`);

  return json(result, 200);
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
