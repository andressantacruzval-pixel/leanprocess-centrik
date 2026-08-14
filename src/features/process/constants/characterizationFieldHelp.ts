// Textos de ayuda contextual para los campos de la pestaña Caracterización del Proceso.
// Se muestran al usuario al pasar el cursor (o tocar) el icono "i" junto al label.

export const CHARACTERIZATION_FIELD_HELP: Record<string, string> = {
  description:
    "Objetivo del proceso: para qué existe y qué resultado entrega. Ej: 'Procesar facturas de proveedores y emitir pagos en menos de 5 días hábiles'.",
  update_date:
    'Fecha de la última edición. Se actualiza automáticamente al guardar; no es editable.',
  version:
    'Número de versión del documento. Sube al aprobar y publicar, no al guardar: ' +
    'así identifica una versión emitida y no cuántas veces se tocó el borrador.',
  entity:
    'Empresa, sucursal o unidad legal a la que pertenece este proceso.',
  process_type:
    'Naturaleza del proceso: estratégico (define rumbo), productivo (entrega valor al cliente) o de apoyo (soporte interno).',
  execution_frequency:
    'Cada cuánto se ejecuta el proceso: diario, semanal, mensual, por demanda, etc.',
  execution_level:
    'Alcance organizacional del proceso: corporativo, regional, local o individual.',
  management:
    'Gerencia o dirección responsable del proceso. Se carga desde tu organigrama.',
  coordination:
    'Área o coordinación específica dentro de la gerencia seleccionada.',
  business_line:
    'Línea de negocio o producto al que da soporte este proceso.',
  supervision_level:
    'Cargo o nivel del responsable que supervisa la ejecución del proceso.',
  responsible:
    'Persona responsable directa del proceso (dueño del proceso).',
  delivery_method:
    'Cómo se entrega el resultado del proceso: presencial, digital, mixto, etc.',
  execution_type:
    'Tipo de ejecución: manual, semi-automatizado o automatizado.',
  provided_by_third_party:
    'Marca si una parte significativa del proceso la ejecuta un proveedor externo.',
  is_critical:
    'Marca si una falla en este proceso detiene la operación o afecta gravemente al negocio.',
  involves_cash_movement:
    'Marca si el proceso implica entrada o salida de dinero.',
  has_contingency_plan:
    'Marca si existe un plan documentado para continuar el proceso ante una falla mayor.',
  has_tax_operations:
    'Marca si el proceso genera obligaciones fiscales o tributarias.',
  affects_accounting:
    'Marca si el proceso produce asientos contables o impacta los estados financieros.',
  handles_personal_data:
    'Marca si el proceso recopila o trata datos personales (relevante para cumplimiento de privacidad).',
}
