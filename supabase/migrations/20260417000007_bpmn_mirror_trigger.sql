-- Mirror trigger: al upsert en bpmn_diagrams copia diagram_xml a processes.bpmn_xml
-- para que el UI siga leyendo desde processes sin cambios de código (H-A del plan de validación).

CREATE OR REPLACE FUNCTION public.mirror_bpmn_xml_to_processes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.processes
  SET bpmn_xml = NEW.diagram_xml, updated_at = now()
  WHERE id = NEW.process_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bpmn_diagrams_mirror
  AFTER INSERT OR UPDATE OF diagram_xml ON public.bpmn_diagrams
  FOR EACH ROW EXECUTE FUNCTION public.mirror_bpmn_xml_to_processes();

-- Backfill único: espejar la fila existente
UPDATE public.processes p
SET bpmn_xml = b.diagram_xml
FROM public.bpmn_diagrams b
WHERE b.process_id = p.id AND p.bpmn_xml IS NULL;
