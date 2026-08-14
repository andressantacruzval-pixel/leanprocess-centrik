-- Agrega UNIQUE constraint en process_id para que el upsert con onConflict funcione.
-- El código en useBpmnAutoSave hace .upsert(..., { onConflict: 'process_id' })
-- lo cual requiere una constraint UNIQUE, no solo un índice normal.
ALTER TABLE public.bpmn_diagrams
  ADD CONSTRAINT bpmn_diagrams_process_id_key UNIQUE (process_id);
