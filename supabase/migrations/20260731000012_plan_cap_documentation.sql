-- La cuota de DOCUMENTAR. ⚠️ NO APLICADA — decision pendiente (2026-07-31).
--
-- El tope de CREAR ya esta en produccion (`20260731000010_plan_cap_processes.sql`).
-- Esto es la otra mitad y golpea distinto: hoy solo afecta a empresas heredadas que
-- ya exceden su cupo. Marsacot tiene 149 procesos y 52 documentados con cupo 20:
-- en cuanto esto entre, no puede documentar ni uno mas de los que YA creo.
--
-- La unidad del cupo es el PROCESO, no el artefacto: documentarlo lo desbloquea
-- entero, asi que uno con los siete artefactos cuenta igual que uno con un KPI.
-- Anadir el segundo artefacto a uno ya documentado NUNCA se bloquea.

-- ── Regla 2: las 7 tablas de documentacion ──────────────────────────────────
-- Se amplia `enforce_documentable_level()` en vez de crear 7 triggers nuevos: ya
-- cuelga de las 7. Un sitio, dos reglas, los mismos triggers.
-- Conserva intacta la comprobacion de nivel (mig. 20260731000005).

create or replace function public.enforce_documentable_level()
returns trigger
language plpgsql
as $$
declare
  v_depth      int;
  v_lowest     int;
  v_company    uuid;
  v_cap        int;
  v_documented int;
begin
  -- Sin proceso asociado no hay nivel ni cuota que validar (p.ej. un KPI suelto).
  if new.process_id is null then
    return new;
  end if;

  select case when p.parent_process_id is null then 1 else 2 end,
         case when coalesce(c.process_level_count, 3) <= 2 then 1 else 2 end,
         c.id
    into v_depth, v_lowest, v_company
  from processes p
  join companies c on c.id = p.company_id
  where p.id = new.process_id;

  -- Proceso inexistente: que lo resuelva la FK, no este trigger.
  if v_depth is null then
    return new;
  end if;

  -- (1) El nivel. Sin cambios respecto a 20260731000005.
  if v_depth <> v_lowest then
    raise exception
      'La documentacion solo se crea en el nivel mas bajo que declaro la empresa (nivel %). Este proceso esta en el nivel %.',
      v_lowest + 1, v_depth + 1
      using errcode = 'check_violation';
  end if;

  -- (2) La cuota del plan. Solo si el proceso AUN NO esta documentado: una vez
  -- dentro del cupo se le puede anadir todo lo demas sin volver a pagar.
  -- El check barato va primero a proposito.
  if not public.is_process_documented(new.process_id) then
    v_cap := public.plan_cap_for_company(v_company);
    if v_cap is not null then
      v_documented := public.documented_process_count(v_company);
      if v_documented >= v_cap then
        raise exception
          'Has llegado al límite de procesos documentados de tu plan: %. Muy pronto habilitaremos nuevos planes para que puedas seguir documentando.',
          v_cap
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ── Regla 2b: la MISMA cuota, en la puerta de atras ─────────────────────────
--
-- `is_process_documented()` cuenta tambien `processes.bpmn_xml` (la columna legacy),
-- pero la cuota de la Regla 2 solo cuelga de las 7 tablas de documentacion. Resultado
-- medido en la prueba de esfuerzo del 2026-07-31: estando en el tope, un UPDATE de
-- `bpmn_xml` documentaba un proceso mas (21 con cupo 20) sin que nada lo parara.
--
-- No es teorico: el consultor IA (`AiConsultantDrawer`), el chat de flujogramas
-- (`FlowchartChatMode`) y el onboarding (`FlowchartOnboardingPage`) escriben ahi.
-- Era la ruta principal de "diagramar" y se saltaba el tope entera.
--
-- Se amplia el trigger que YA existe sobre `processes` (mig. 20260731000006) en vez
-- de crear otro: un solo sitio por tabla.

create or replace function public.enforce_documentable_level_processes()
returns trigger
language plpgsql
as $$
declare
  v_depth      int;
  v_lowest     int;
  v_cap        int;
  v_documented int;
  -- Estructura: que es el proceso y donde vive. Un agrupador puede cambiarlas.
  k_estructurales text[] := array[
    'id','company_id','macroprocess_id','parent_process_id','level_definition_id',
    'name','code','sort_order','org_unit_id','created_at','updated_at'
  ];
begin
  select case when new.parent_process_id is null then 1 else 2 end,
         case when coalesce(c.process_level_count, 3) <= 2 then 1 else 2 end
    into v_depth, v_lowest
  from companies c
  where c.id = new.company_id;

  if v_depth is null then
    return new;
  end if;

  if v_depth = v_lowest then
    -- Es del nivel mas bajo: el nivel esta bien, solo queda la cuota. Y solo si
    -- este UPDATE es el que lo documenta. En BEFORE UPDATE la tabla aun tiene los
    -- valores viejos, asi que `is_process_documented` responde por el estado previo.
    if new.bpmn_xml is distinct from old.bpmn_xml
       and new.bpmn_xml is not null
       and length(new.bpmn_xml) > 100
       and not public.is_process_documented(new.id)
    then
      v_cap := public.plan_cap_for_company(new.company_id);
      if v_cap is not null then
        v_documented := public.documented_process_count(new.company_id);
        if v_documented >= v_cap then
          raise exception
            'Has llegado al límite de procesos documentados de tu plan: %. Muy pronto habilitaremos nuevos planes para que puedas seguir documentando.',
            v_cap
            using errcode = 'check_violation';
        end if;
      end if;
    end if;
    return new;
  end if;

  -- Es un agrupador: solo se le permiten cambios estructurales.
  if (to_jsonb(new) - k_estructurales) is distinct from (to_jsonb(old) - k_estructurales) then
    raise exception
      'Un proceso agrupador no se documenta. La caracterizacion y el diagrama van en el nivel mas bajo que declaro la empresa (nivel %); este proceso esta en el nivel %.',
      v_lowest + 1, v_depth + 1
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
