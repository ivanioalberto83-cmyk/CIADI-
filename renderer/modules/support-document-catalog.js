(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CIADI_SUPPORT_DOCUMENT_CATALOG=api;
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const MOTORS=Object.freeze([
 {id:'procurement',code:'COM',title:'Compras e Aprovisionamento',description:'Pedidos, cotações, aquisição, fornecedores e recepção de bens.',sources:['ciadi_ti.purchase_requests','ciadi_ti.purchase_request_lines','ciadi_ti.suppliers','ciadi_ti.items']},
 {id:'stock',code:'STK',title:'Armazém e Stock',description:'Entradas, saídas, transferências, contagens e existências.',sources:['ciadi_ti.stock_movements','ciadi_ti.items','ciadi_ti.warehouses','ciadi_ti.inventory_counts','ciadi_ti.inventory_count_lines']},
 {id:'losses',code:'QUE',title:'Quebras, Avarias e Abates',description:'Ocorrências, danos, perdas, quebras, inutilizações e abates.',sources:['ciadi_ti.assets','ciadi_ti.stock_movements','ciadi_ti.audit_events']},
 {id:'assets',code:'PAT',title:'Equipamentos e Património',description:'Cadastro, atribuição, manutenção e localização dos activos.',sources:['ciadi_ti.assets','ciadi_ti.items','ciadi_ti.warehouses']},
 {id:'technical',code:'TEC',title:'Assistência Técnica e Operações',description:'Helpdesk, ordens de trabalho, incidentes e intervenções.',sources:['ciadi_ti.assets','ciadi_ti.audit_events','public.auditoria']},
 {id:'security',code:'SEG',title:'Sistemas, Segurança e Continuidade',description:'Backups, recuperação, acessos, segurança e auditoria técnica.',sources:['ciadi_ti.audit_events','public.auditoria']},
 {id:'administration',code:'ADM',title:'Gestão Administrativa do Suporte',description:'Planos, actas, comunicações, memorandos e relatórios de actividade.',sources:['public.auditoria']},
 {id:'analytics',code:'ANA',title:'Relatórios, Gráficos e Análises',description:'Indicadores calculados a partir dos registos operacionais confirmados.',sources:['ciadi_ti.purchase_requests','ciadi_ti.stock_movements','ciadi_ti.assets','ciadi_ti.inventory_counts','ciadi_ti.audit_events']}
]);
const GROUPS=[
 ['procurement',[
 'Pedido de aquisição','Requisição interna de compra','Pedido de cotação','Mapa comparativo de propostas','Parecer técnico de aquisição','Autorização de compra','Ordem de compra','Nota de encomenda','Ficha de fornecedor','Contrato de fornecimento','Guia de remessa','Nota de recepção de mercadorias','Auto de conferência da entrega','Relatório de divergência de fornecimento','Nota de devolução ao fornecedor','Relatório de compras'
 ]],
 ['stock',[
 'Guia de entrada em armazém','Guia de saída de armazém','Guia de transferência de stock','Guia de devolução de material','Requisição interna de material','Ficha individual de artigo','Ficha de controlo de stock','Mapa de existências','Folha de contagem física','Auto de inventário','Relatório de diferenças de inventário','Relatório de stock mínimo','Relatório de stock máximo','Relatório de produtos sem movimento','Relatório de consumo de materiais'
 ]],
 ['losses',[
 'Relatório de quebra','Relatório de avaria','Participação de ocorrência','Auto de constatação de danos','Relatório de perda ou extravio','Auto de inutilização','Proposta de abate','Auto de abate de equipamento','Relatório de avaliação de danos','Relatório de reposição de material','Histórico de ocorrências por equipamento'
 ]],
 ['assets',[
 'Ficha de equipamento','Termo de atribuição de equipamento','Termo de responsabilidade','Guia de entrega de equipamento','Guia de devolução de equipamento','Auto de transferência de equipamento','Ficha de manutenção','Plano de manutenção preventiva','Relatório de manutenção correctiva','Auto de recolha de equipamento','Relatório de estado do equipamento','Mapa de equipamentos por polo','Inventário de activos informáticos'
 ]],
 ['technical',[
 'Pedido de assistência técnica','Ordem de trabalho','Ficha de intervenção técnica','Relatório de intervenção','Relatório de resolução de incidente','Relatório de falha de sistema','Registo de instalação de software','Registo de configuração','Registo de alteração técnica','Relatório de manutenção de sistemas','Relatório de disponibilidade dos serviços','Relatório de incidentes recorrentes','Acta de verificação técnica','Auto de homologação técnica'
 ]],
 ['security',[
 'Relatório de backup','Relatório de teste de recuperação','Auto de validação de recuperação','Registo de actualização de sistema','Relatório de vulnerabilidades técnicas','Relatório de auditoria informática','Registo de alterações de acessos','Relatório de controlo de utilizadores','Relatório de disponibilidade da rede','Relatório de segurança informática'
 ]],
 ['administration',[
 'Plano anual de actividades','Plano mensal de actividades','Plano de necessidades informáticas','Relatório diário de actividades','Relatório semanal','Relatório mensal','Relatório trimestral','Relatório semestral','Relatório anual','Acta de reunião técnica','Memorando interno','Comunicação interna','Informação técnica','Parecer técnico','Termo de entrega de serviço','Relatório de acompanhamento de tarefas'
 ]],
 ['analytics',[
 'Mapa de despesas de aprovisionamento','Mapa de custos por equipamento','Mapa de custos por polo','Relatório de consumo por departamento','Relatório de compras por fornecedor','Relatório de execução do orçamento informático','Mapa de necessidades de aquisição','Relatório de custos de manutenção','Relatório de perdas e desperdícios','Relatório de eficiência operacional','Gráfico de entradas e saídas de stock','Gráfico de evolução das compras','Gráfico de consumo por período','Gráfico de avarias e quebras','Gráfico de equipamentos por estado','Gráfico de custos por polo','Gráfico de despesas por categoria','Gráfico de desempenho das intervenções','Mapa de stock por armazém','Mapa de necessidades de reposição','Painel de indicadores do Suporte Informática'
 ]]
];
const LEGACY_TEMPLATES=Object.freeze({
 'Requisição interna de compra':'SUP-REQ',
 'Ordem de trabalho':'SUP-OT',
 'Ficha de equipamento':'SUP-EQP',
 'Guia de entrega de equipamento':'SUP-GUI',
 'Ficha de manutenção':'SUP-MAN',
 'Relatório de resolução de incidente':'SUP-INC',
 'Registo de alterações de acessos':'SUP-ACC',
 'Relatório de backup':'SUP-BKP',
 'Acta de verificação técnica':'SUP-HOM',
 'Relatório de intervenção':'SUP-REL'
});

const pf=(key,label,type='text',required=true,options=[])=>Object.freeze({key,label,type,required,options:Object.freeze(options)});
const PROCUREMENT_FORM_FIELDS=Object.freeze({
 'Pedido de aquisição':[
  pf('requester','Unidade requisitante'),pf('department','Departamento'),pf('destination','Polo de destino'),
  pf('need_description','Necessidade a satisfazer','textarea'),pf('estimated_value','Valor estimado (Kz)','number'),
  pf('required_date','Data pretendida','date'),pf('justification','Fundamentação','textarea'),pf('priority','Prioridade','select',true,['Normal','Alta','Urgente'])
 ],
 'Requisição interna de compra':[
  pf('requester','Requisitante'),pf('cost_center','Centro de custo'),pf('item_code','Código do artigo','text',false),
  pf('item_description','Descrição do artigo','textarea'),pf('quantity','Quantidade','number'),pf('unit','Unidade de medida'),
  pf('required_date','Data necessária','date'),pf('purpose','Finalidade','textarea')
 ],
 'Pedido de cotação':[
  pf('quotation_reference','Referência do pedido'),pf('supplier_candidates','Fornecedores convidados','textarea'),
  pf('scope','Objecto da cotação','textarea'),pf('quantity','Quantidade','number'),pf('submission_deadline','Prazo de entrega das propostas','date'),
  pf('delivery_location','Local de entrega'),pf('commercial_conditions','Condições comerciais pretendidas','textarea')
 ],
 'Mapa comparativo de propostas':[
  pf('quotation_reference','Referência da cotação'),pf('supplier_a','Fornecedor A'),pf('price_a','Preço A (Kz)','number'),
  pf('supplier_b','Fornecedor B'),pf('price_b','Preço B (Kz)','number'),pf('supplier_c','Fornecedor C','text',false),
  pf('price_c','Preço C (Kz)','number',false),pf('technical_comparison','Comparação técnica','textarea'),pf('recommended_supplier','Fornecedor recomendado')
 ],
 'Parecer técnico de aquisição':[
  pf('request_reference','Referência da requisição'),pf('technical_requirements','Requisitos técnicos','textarea'),
  pf('compliance_analysis','Análise de conformidade','textarea'),pf('alternatives','Alternativas avaliadas','textarea',false),
  pf('technical_recommendation','Recomendação técnica','textarea'),pf('reviewer','Responsável pelo parecer'),pf('review_date','Data do parecer','date')
 ],
 'Autorização de compra':[
  pf('purchase_request','Pedido de compra'),pf('approved_supplier','Fornecedor proposto'),pf('approved_amount','Montante autorizado (Kz)','number'),
  pf('budget_reference','Referência orçamental'),pf('approval_conditions','Condições da autorização','textarea',false),
  pf('authorization_date','Data da autorização','date'),pf('authorization_reference','Referência da autorização')
 ],
 'Ordem de compra':[
  pf('purchase_order_number','Número da ordem'),pf('supplier','Fornecedor'),pf('supplier_tax_id','NIF do fornecedor'),
  pf('delivery_address','Morada de entrega','textarea'),pf('order_lines','Artigos, quantidades e preços','textarea'),
  pf('total_amount','Valor total (Kz)','number'),pf('delivery_deadline','Prazo de entrega','date'),pf('payment_terms','Condições de pagamento','textarea')
 ],
 'Nota de encomenda':[
  pf('order_reference','Referência da encomenda'),pf('supplier','Fornecedor'),pf('supplier_contact','Contacto do fornecedor'),
  pf('ordered_items','Descrição dos bens/serviços','textarea'),pf('net_amount','Valor líquido (Kz)','number'),
  pf('tax_amount','Impostos (Kz)','number'),pf('gross_amount','Total (Kz)','number'),pf('expected_delivery','Entrega prevista','date')
 ],
 'Ficha de fornecedor':[
  pf('legal_name','Denominação social'),pf('tax_id','NIF'),pf('commercial_registration','Registo comercial','text',false),
  pf('address','Endereço','textarea'),pf('contact_person','Pessoa de contacto'),pf('phone','Telefone'),pf('email','Correio electrónico','text',false),
  pf('bank_details','Dados bancários','textarea',false),pf('supplied_categories','Categorias fornecidas','textarea')
 ],
 'Contrato de fornecimento':[
  pf('contract_reference','Referência do contrato'),pf('supplier_legal_name','Denominação do fornecedor'),pf('supplier_tax_id','NIF'),
  pf('contract_object','Objecto do contrato','textarea'),pf('contract_value','Valor contratual (Kz)','number'),
  pf('start_date','Início de vigência','date'),pf('end_date','Fim de vigência','date'),pf('obligations','Obrigações e condições','textarea')
 ],
 'Guia de remessa':[
  pf('delivery_note_number','Número da guia'),pf('supplier','Fornecedor'),pf('purchase_order','Ordem de compra'),
  pf('dispatch_date','Data de expedição','date'),pf('transport_reference','Referência de transporte','text',false),
  pf('packages','Volumes/embalagens','number'),pf('goods_description','Descrição dos bens','textarea'),pf('destination','Destino')
 ],
 'Nota de recepção de mercadorias':[
  pf('goods_receipt_reference','Referência da recepção'),pf('supplier','Fornecedor'),pf('purchase_order','Ordem de compra'),
  pf('delivery_note','Guia de remessa'),pf('received_date','Data de recepção','date'),pf('received_by','Recebido por'),
  pf('received_quantities','Quantidades recebidas por artigo','textarea'),pf('warehouse','Armazém de entrada')
 ],
 'Auto de conferência da entrega':[
  pf('inspection_reference','Referência do auto'),pf('goods_receipt','Nota de recepção'),pf('inspection_date','Data da conferência','date'),
  pf('inspected_items','Artigos conferidos','textarea'),pf('accepted_quantity','Quantidade aceite','number'),
  pf('damaged_quantity','Quantidade danificada','number'),pf('rejected_quantity','Quantidade rejeitada','number'),
  pf('inspection_result','Resultado da conferência','select',true,['Conforme','Conforme com reservas','Não conforme'])
 ],
 'Relatório de divergência de fornecimento':[
  pf('discrepancy_reference','Referência da divergência'),pf('supplier','Fornecedor'),pf('purchase_order','Ordem de compra'),
  pf('expected_delivery','Entrega esperada','textarea'),pf('actual_delivery','Entrega verificada','textarea'),
  pf('discrepancy_type','Tipo de divergência','select',true,['Falta','Excesso','Dano','Qualidade','Atraso','Outro']),
  pf('impact','Impacto operacional','textarea'),pf('corrective_action','Acção correctiva proposta','textarea')
 ],
 'Nota de devolução ao fornecedor':[
  pf('return_reference','Referência da devolução'),pf('supplier','Fornecedor'),pf('original_receipt','Recepção original'),
  pf('return_date','Data da devolução','date'),pf('returned_items','Artigos e quantidades devolvidas','textarea'),
  pf('return_reason','Motivo da devolução','textarea'),pf('transport_reference','Referência de transporte','text',false),
  pf('supplier_acknowledgement','Comprovativo de recepção do fornecedor','text',false)
 ],
 'Relatório de compras':[
  pf('report_period','Período do relatório'),pf('purchase_count','Número de compras','number'),
  pf('total_committed','Valor total comprometido (Kz)','number'),pf('supplier_breakdown','Compras por fornecedor','textarea'),
  pf('category_breakdown','Compras por categoria','textarea'),pf('delivery_performance','Desempenho das entregas','textarea'),
  pf('variances','Divergências e desvios','textarea'),pf('conclusions','Conclusões e recomendações','textarea')
 ]
});


const OPERATIONAL_FORM_KEYS=Object.freeze({
 'Guia de entrada em armazém':['entry_reference','supplier_reference','warehouse_location','received_by','received_at','item_quantities','condition_notes'],
 'Guia de saída de armazém':['issue_reference','request_reference','requesting_unit','destination_location','issued_by','issued_at','item_quantities'],
 'Guia de transferência de stock':['transfer_reference','origin_warehouse','destination_warehouse','transfer_reason','authorised_by','transfer_date','item_quantities'],
 'Guia de devolução de material':['return_reference','original_issue_reference','returning_unit','return_reason','received_by','return_date','returned_quantities'],
 'Requisição interna de material':['material_request_reference','requesting_department','requester_name','required_date','purpose_description','requested_items','delivery_location'],
 'Ficha individual de artigo':['item_code','item_description','item_category','measurement_unit','minimum_stock','maximum_stock','storage_location'],
 'Ficha de controlo de stock':['stock_control_reference','item_code','warehouse_code','opening_balance','entries_quantity','exits_quantity','closing_balance','period_start'],
 'Mapa de existências':['stock_report_period','warehouse_scope','item_count','total_quantity','stock_valuation','low_stock_items','prepared_by'],
 'Folha de contagem física':['count_sheet_reference','warehouse_code','count_date','counter_name','item_code','system_quantity','counted_quantity','count_notes'],
 'Auto de inventário':['inventory_reference','warehouse_scope','inventory_date','inventory_team','counted_items','inventory_method','inventory_conclusion'],
 'Relatório de diferenças de inventário':['variance_report_reference','inventory_reference','item_code','system_quantity','physical_quantity','variance_quantity','variance_reason','corrective_action'],
 'Relatório de stock mínimo':['minimum_stock_period','warehouse_scope','items_below_minimum','minimum_threshold','replenishment_quantity','risk_assessment'],
 'Relatório de stock máximo':['maximum_stock_period','warehouse_scope','items_above_maximum','maximum_threshold','excess_quantity','storage_risk'],
 'Relatório de produtos sem movimento':['no_movement_period','warehouse_scope','inactive_items','last_movement_date','total_immobilised_quantity','recommended_action'],
 'Relatório de consumo de materiais':['consumption_period','department_scope','material_categories','consumed_quantities','consumption_cost','consumption_variance','prepared_by'],
 'Relatório de quebra':['breakage_reference','item_or_asset_code','occurrence_location','occurrence_date','quantity_damaged','breakage_description','immediate_action','reported_by'],
 'Relatório de avaria':['failure_reference','asset_code','failure_detected_at','asset_location','failure_symptoms','operational_impact','initial_diagnosis','reported_by'],
 'Participação de ocorrência':['occurrence_reference','occurrence_type','reported_at','occurrence_location','involved_assets','witnesses','event_description','reporter_identity'],
 'Auto de constatação de danos':['damage_assessment_reference','asset_or_item_code','inspection_date','inspection_location','observed_damage','damage_severity','evidence_reference','inspection_team'],
 'Relatório de perda ou extravio':['loss_reference','missing_item_description','last_known_location','last_seen_at','quantity_missing','search_actions','estimated_value','reported_by'],
 'Auto de inutilização':['disposal_assessment_reference','item_or_asset_code','invalidation_reason','technical_condition','inspection_findings','disposal_method','assessment_date','assessed_by'],
 'Proposta de abate':['writeoff_proposal_reference','asset_code','acquisition_date','acquisition_value','current_condition','writeoff_justification','supporting_evidence','proposed_by'],
 'Auto de abate de equipamento':['writeoff_record_reference','asset_code','approved_proposal_reference','writeoff_date','writeoff_method','asset_destination','committee_members','final_observations'],
 'Relatório de avaliação de danos':['damage_report_reference','asset_code','damage_description','repairability_assessment','estimated_repair_cost','replacement_cost','technical_conclusion','assessor_name'],
 'Relatório de reposição de material':['replacement_report_reference','original_occurrence_reference','material_code','replacement_quantity','replacement_source','replacement_date','delivery_reference','responsible_unit'],
 'Ficha de equipamento':['asset_tag','equipment_description','manufacturer','model_reference','serial_number','acquisition_date','acquisition_value','assigned_location'],
 'Termo de atribuição de equipamento':['assignment_reference','asset_tag','assigned_employee','employee_department','assignment_location','assignment_date','equipment_condition','handover_responsible'],
 'Termo de responsabilidade':['responsibility_term_reference','asset_tag','responsible_person','personnel_number','department_name','responsibility_start_date','usage_conditions','acknowledgement'],
 'Guia de entrega de equipamento':['equipment_delivery_reference','asset_tag','recipient_name','delivery_location','delivery_date','delivered_accessories','condition_at_delivery','delivered_by'],
 'Guia de devolução de equipamento':['equipment_return_reference','asset_tag','returning_person','return_date','return_reason','returned_accessories','condition_at_return','received_by'],
 'Auto de transferência de equipamento':['asset_transfer_reference','asset_tag','origin_unit','destination_unit','origin_location','destination_location','transfer_date','transfer_authorisation'],
 'Ficha de manutenção':['maintenance_record_reference','asset_tag','maintenance_type','maintenance_date','maintenance_provider','work_performed','parts_replaced','next_maintenance_date'],
 'Plano de manutenção preventiva':['preventive_plan_reference','asset_category','maintenance_scope','frequency_interval','planned_start_date','planned_tasks','assigned_technician','next_review_date'],
 'Relatório de manutenção correctiva':['corrective_maintenance_reference','asset_tag','failure_reference','repair_start_date','repair_completion_date','root_cause','repair_actions','service_result'],
 'Auto de recolha de equipamento':['equipment_collection_reference','asset_tag','collection_reason','collection_location','collection_date','equipment_condition','collected_accessories','collected_by'],
 'Relatório de estado do equipamento':['equipment_status_reference','asset_tag','assessment_date','physical_condition','functional_condition','performance_findings','recommended_action','assessor'],
 'Pedido de assistência técnica':['support_request_reference','requester_name','requesting_department','affected_asset','problem_category','problem_description','urgency_level','preferred_contact'],
 'Ordem de trabalho':['work_order_reference','linked_ticket_reference','assigned_technician','work_location','work_scope','planned_start','planned_completion','required_materials'],
 'Ficha de intervenção técnica':['technical_intervention_reference','work_order_reference','asset_or_service','intervention_start','intervention_end','diagnostic_findings','actions_performed','technician_name'],
 'Relatório de intervenção':['intervention_report_reference','ticket_or_order_reference','affected_service','incident_context','technical_analysis','resolution_steps','validation_result','technician'],
 'Relatório de resolução de incidente':['incident_resolution_reference','incident_reference','service_affected','incident_start','resolved_at','root_cause','resolution_summary','service_validation'],
 'Relatório de falha de sistema':['system_failure_reference','system_name','failure_detected_at','failure_duration','affected_users_or_units','technical_symptoms','recovery_actions','failure_cause'],
 'Registo de instalação de software':['software_installation_reference','software_name','software_version','target_device','installation_date','licence_reference','installation_result','installed_by'],
 'Registo de configuração':['configuration_record_reference','system_or_device','configuration_scope','previous_configuration','new_configuration','change_date','validation_evidence','changed_by'],
 'Registo de alteração técnica':['technical_change_reference','change_request','affected_component','change_reason','implementation_steps','rollback_plan','change_window','validated_by'],
 'Relatório de manutenção de sistemas':['systems_maintenance_reference','systems_scope','maintenance_window','maintenance_tasks','service_interruption','maintenance_result','pending_actions','maintenance_lead'],
 'Acta de verificação técnica':['technical_inspection_reference','system_or_asset','inspection_scope','inspection_date','verification_checks','findings','nonconformities','inspection_decision'],
 'Auto de homologação técnica':['technical_acceptance_reference','system_name','version_tested','acceptance_scope','test_cases','test_results','open_issues','acceptance_decision'],
 'Relatório de backup':['backup_execution_reference','source_system','backup_type','backup_started_at','backup_completed_at','backup_size','integrity_checksum','backup_result'],
 'Relatório de teste de recuperação':['recovery_test_reference','backup_reference','target_environment','test_started_at','test_completed_at','restored_data_scope','integrity_result','recovery_duration'],
 'Auto de validação de recuperação':['recovery_validation_reference','recovery_test_reference','validation_scope','validation_checks','data_consistency_result','service_start_result','validation_decision','validated_by'],
 'Registo de actualização de sistema':['system_update_reference','system_name','previous_version','new_version','update_date','update_source','post_update_checks','update_result'],
 'Relatório de vulnerabilidades técnicas':['vulnerability_report_reference','system_scope','assessment_date','vulnerability_identifier','severity_level','affected_component','mitigation_plan','assessor'],
 'Relatório de auditoria informática':['it_audit_reference','audit_period','systems_in_scope','audit_criteria','evidence_summary','findings_summary','risk_rating','audit_conclusion'],
 'Registo de alterações de acessos':['access_change_reference','system_resource','change_type','request_reference','subject_account','change_date','change_justification','change_evidence'],
 'Relatório de controlo de utilizadores':['user_control_report_reference','review_period','system_scope','accounts_reviewed','inactive_accounts','exceptions_found','review_conclusion','reviewer'],
 'Relatório de disponibilidade da rede':['network_availability_reference','monitoring_period','network_scope','total_uptime','total_downtime','outage_events','availability_percentage','prepared_by'],
 'Relatório de segurança informática':['security_report_reference','reporting_period','systems_scope','security_events','controls_reviewed','incidents_summary','risk_recommendations','security_reviewer'],
 'Plano anual de actividades':['annual_plan_reference','calendar_year','strategic_objectives','planned_activities','expected_deliverables','resource_requirements','performance_indicators','plan_owner'],
 'Plano mensal de actividades':['monthly_plan_reference','reference_month','monthly_objectives','scheduled_activities','responsible_teams','expected_deliverables','dependencies','plan_coordinator'],
 'Plano de necessidades informáticas':['it_needs_plan_reference','planning_period','requesting_units','hardware_needs','software_needs','network_needs','estimated_budget','justification'],
 'Relatório diário de actividades':['daily_activity_reference','activity_date','activities_completed','tickets_handled','pending_tasks','incidents_escalated','hours_worked','prepared_by'],
 'Relatório semanal':['weekly_report_reference','week_start','week_end','completed_activities','open_work_orders','service_incidents','operational_metrics','next_week_priorities'],
 'Relatório mensal':['monthly_report_reference','report_month','service_requests_total','tickets_resolved','maintenance_completed','stock_movements_summary','pending_issues','monthly_conclusion'],
 'Relatório trimestral':['quarterly_report_reference','report_quarter','quarter_objectives','deliverables_completed','service_performance','resource_consumption','risks_and_constraints','quarter_conclusion'],
 'Relatório semestral':['half_year_report_reference','report_half_year','strategic_progress','service_quality_summary','major_incidents','budget_execution','improvement_actions','management_conclusion'],
 'Relatório anual':['annual_report_reference','report_year','annual_objectives','key_deliverables','service_indicators','asset_and_stock_summary','major_risks','annual_conclusion'],
 'Acta de reunião técnica':['technical_meeting_minutes_reference','meeting_date','meeting_location','participants','agenda_items','decisions_taken','action_owners','next_meeting_date'],
 'Memorando interno':['internal_memo_reference','memo_date','sender_unit','recipient_unit','memo_subject','memo_context','requested_action','response_deadline'],
 'Comunicação interna':['internal_communication_reference','communication_date','origin_unit','destination_units','communication_subject','message_body','required_response','communication_channel'],
 'Informação técnica':['technical_information_reference','information_date','subject_system','technical_context','observations','technical_implications','recommended_measure','author_name'],
 'Parecer técnico':['technical_opinion_reference','request_reference','subject_matter','technical_requirements','assessment_method','technical_findings','recommendation','reviewer_name'],
 'Termo de entrega de serviço':['service_handover_reference','service_description','delivering_unit','receiving_unit','handover_date','deliverables_list','acceptance_conditions','handover_signatories'],
 'Relatório de acompanhamento de tarefas':['task_followup_reference','reporting_period','task_register','completed_tasks','delayed_tasks','blocking_issues','responsible_parties','followup_actions']
});
const FORM_FIELD_LABELS=Object.freeze({
 'reference':'Referência','requester':'Requisitante','department':'Departamento','location':'Localização','date':'Data',
 'description':'Descrição','quantity':'Quantidade','condition':'Estado','reason':'Motivo','result':'Resultado',
 'responsible':'Responsável','reporter':'Participante','notes':'Observações','code':'Código','period':'Período',
 'value':'Valor','cost':'Custo','status':'Estado','scope':'Âmbito','summary':'Resumo','actions':'Acções',
 'evidence':'Evidência','decision':'Decisão','validation':'Validação','reviewer':'Revisor','team':'Equipa'
});
const FORM_NUMBER_KEYS=new Set(['estimated_value','quantity','packages','minimum_stock','maximum_stock','opening_balance','entries_quantity','exits_quantity','closing_balance','system_quantity','counted_quantity','variance_quantity','excess_quantity','total_quantity','stock_valuation','consumption_cost','estimated_repair_cost','replacement_cost','acquisition_value','total_uptime','total_downtime','availability_percentage','hours_worked','service_requests_total','tickets_resolved']);
const FORM_DATE_KEYS=new Set(Object.keys(FORM_FIELD_LABELS).filter(k=>k.endsWith('_date')||k.endsWith('_at')||k.endsWith('_start')||k.endsWith('_end')));
function operationalFields(title){
 const keys=OPERATIONAL_FORM_KEYS[title];
 if(!keys)return null;
 return Object.freeze(keys.map(key=>{
  const words=key.replace(/_/g,' ');
  const label=FORM_FIELD_LABELS[key]||words.charAt(0).toUpperCase()+words.slice(1);
  const type=FORM_NUMBER_KEYS.has(key)?'number':FORM_DATE_KEYS.has(key)?'date':/(description|summary|analysis|actions|findings|justification|recommendation|observations|conclusion|tasks|deliverables|requirements|context|evidence|items|quantities|conditions|steps|criteria|checks|scope|agenda|decisions|risks|objectives|priorities|resources|members|participants|owners|units|categories|symptoms|measures|plan|body|message|notes|causes|mitigation|impact|assessment|method|dependencies|exceptions|outage|issues|results|statistics|criteria|indicators|needs|software|hardware|network|materials|accessories|checks|actions)/i.test(key)?'textarea':'text';
  return pf(key,label,type,!/(notes|evidence|deadline|provider|contact|serial_number|licence_reference|witnesses|transport_reference)/.test(key));
 }));
}

const sourceFor=m=>m.sources;
const documents=[];
for(const [motorId,titles] of GROUPS){
 const motor=MOTORS.find(x=>x.id===motorId);
 titles.forEach((title,index)=>{
  const outputKind=motorId==='analytics'?(title.startsWith('Gráfico')||title.startsWith('Painel')?'dashboard':'report'):
   (/^Relatório|^Mapa|^Histórico|^Inventário/.test(title)?'report':'document');
  documents.push(Object.freeze({
   code:'SUP-'+motor.code+'-'+String(index+1).padStart(3,'0'),
   title,motorId,outputKind,
   description:title+' do motor '+motor.title+'.',
   dataSources:Object.freeze(sourceFor(motor)),
   formProfile:outputKind==='document'?motorId:'report',
   formFields:motorId==='procurement'?PROCUREMENT_FORM_FIELDS[title]:operationalFields(title),
   lifecycle:outputKind==='document'?Object.freeze(['draft','submitted','validated','approved','issued','archived','cancelled']):Object.freeze(['available','generated','archived']),
   requiresServerNumber:outputKind==='document',
   immutableAfterIssue:outputKind==='document',
   legacyTemplateCode:LEGACY_TEMPLATES[title]||null,
   implementationStatus:LEGACY_TEMPLATES[title]?'draft-template-available':'catalogued'
  }));
 });
}
const frozenDocuments=Object.freeze(documents);
function listMotors(){return MOTORS;}
function listDocuments(){return frozenDocuments;}
function findDocument(code){return frozenDocuments.find(x=>x.code===String(code||'').trim())||null;}
function getDocumentsByMotor(motorId){return frozenDocuments.filter(x=>x.motorId===motorId);}
function validateCatalog(){
 const errors=[],motorIds=new Set(MOTORS.map(x=>x.id)),codes=new Set();
 if(MOTORS.length!==8)errors.push('O catálogo deve conter oito motores.');
 if(frozenDocuments.length!==116)errors.push('O catálogo deve conter 116 tipos.');
 for(const d of frozenDocuments){
  if(codes.has(d.code))errors.push('Código repetido: '+d.code);codes.add(d.code);
  if(!motorIds.has(d.motorId))errors.push('Motor desconhecido: '+d.code);
  if(!['document','report','dashboard'].includes(d.outputKind))errors.push('Saída inválida: '+d.code);
  if(!d.title||!d.description||!d.dataSources.length)errors.push('Metadados incompletos: '+d.code);
 }
 for(const m of MOTORS)if(!getDocumentsByMotor(m.id).length)errors.push('Motor sem documentos: '+m.id);
 return Object.freeze({valid:errors.length===0,errors:Object.freeze(errors),motorCount:MOTORS.length,documentCount:frozenDocuments.length});
}
return Object.freeze({MOTORS,frozenDocuments,listMotors,listDocuments,findDocument,getDocumentsByMotor,validateCatalog});
});
