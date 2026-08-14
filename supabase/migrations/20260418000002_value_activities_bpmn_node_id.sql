-- Decoupling entre el PK de DB (uuid) y el ID del nodo BPMN (string).
-- Antes, ValueActivity.id guardaba "Task_5" (node id del BPMN) y el store lo
-- mandaba como id a la columna uuid de value_activities. Eso hacia fallar el
-- INSERT con "invalid input syntax for type uuid: Task_5" y el UPDATE con
-- .eq('id', 'Task_5') tambien. Tabla estaba vacia por eso.
--
-- Ahora:
--   value_activities.id            uuid        (PK, generado por DB)
--   value_activities.bpmn_node_id  text        (ref al nodo BPMN del diagrama)

ALTER TABLE public.value_activities
  ADD COLUMN bpmn_node_id text;

CREATE INDEX idx_value_activities_process_bpmn_node
  ON public.value_activities(process_id, bpmn_node_id);