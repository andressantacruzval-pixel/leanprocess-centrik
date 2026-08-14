-- Agrega la columna bpmn_xml a la tabla processes.
-- El código TypeScript (useBpmnAutoSave, processStore) guarda el XML del diagrama
-- directamente en esta columna como campo de referencia rápida.

ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS bpmn_xml TEXT;
