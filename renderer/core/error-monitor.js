(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CIADI_ERROR_MONITOR=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const MAX_MESSAGE=1200;
function clean(value,max=MAX_MESSAGE){return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
function safeErrorMessage(value){let message=clean(value);message=message.replace(/(password|token|secret|authorization|apikey|api_key)\s*[:=]\s*[^\s,;]+/gi,'$1=[redigido]').replace(/eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,'[token redigido]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email redigido]');return message||'Erro sem mensagem disponível.';}
function fingerprint(type,message){let h=2166136261;const value=type+'|'+message;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
function collectDiagnostics({windowRef={},documentRef={},stationLabel='CIADI ERP',profile={},poloCode=null,now=()=>new Date()}={}){
 const nav=windowRef.navigator||{};const screen=windowRef.screen||{};const location=windowRef.location||{};
 return Object.freeze({
  station:clean(stationLabel,100),profile:clean(profile?.tipo||'utilizador',80),
  polo:clean(poloCode||'Polo não identificado',100),page:clean(location.pathname||'não identificada',180),
  timestamp:now().toISOString(),browser:clean(nav.userAgent||'não identificado',300),
  platform:clean(nav.platform||'não identificado',100),language:clean(nav.language||'não identificado',35),
  online:typeof nav.onLine==='boolean'?nav.onLine:null,
  viewport:clean((windowRef.innerWidth||0)+'x'+(windowRef.innerHeight||0),30),
  screen:clean((screen.width||0)+'x'+(screen.height||0),30),
  appVersion:clean(windowRef.CIADI_BUILD_INFO?.version||windowRef.CIADI_VERSION||'não identificada',60),
  pageTitle:clean(documentRef.title||'CIADI',100)
 });
}
function buildReportDescription({type='Relato manual',message='',diagnostics={},reference=''}={}){
 return ['Origem: '+clean(type,80),'Descrição: '+safeErrorMessage(message),'--- Dados técnicos automáticos ---',
  'Estação: '+clean(diagnostics.station,100),'Perfil: '+clean(diagnostics.profile,80),
  'Polo: '+clean(diagnostics.polo,100),'Página: '+clean(diagnostics.page,180),
  'Título da página: '+clean(diagnostics.pageTitle,100),'Data/hora: '+clean(diagnostics.timestamp,50),
  'Navegador: '+clean(diagnostics.browser,300),'Sistema/plataforma: '+clean(diagnostics.platform,100),
  'Idioma: '+clean(diagnostics.language,35),'Ligação à Internet: '+(diagnostics.online===null?'não identificada':diagnostics.online?'online':'offline'),
  'Janela: '+clean(diagnostics.viewport,30),'Ecrã: '+clean(diagnostics.screen,30),
  'Versão da aplicação: '+clean(diagnostics.appVersion,60),'Referência técnica: '+clean(reference,32)
 ].join('\n').slice(0,4900);
}
function create({supabase,actorId,profile,poloCode=null,stationLabel='CIADI ERP',notify=()=>{},documentRef=typeof document!=='undefined'?document:null,windowRef=typeof window!=='undefined'?window:null,now=()=>new Date()}={}){
 if(!supabase||!actorId)throw new Error('Sessão autenticada e ligação ao CIADI obrigatórias.');
 const db=supabase.schema('ciadi_ti');let button=null;let modal=null;let lastSent=new Map();let installed=false;let latestError=null;
 const role=clean(profile?.tipo,80)||'utilizador';const location=clean(poloCode||'Polo não identificado',160);
 function diagnostics(){return collectDiagnostics({windowRef,documentRef,stationLabel,profile,poloCode,now});}
 async function submit(type,rawMessage,automatic=true,options={}){
  const message=safeErrorMessage(rawMessage);const key=fingerprint(type,message);const timestamp=now().getTime();const previous=lastSent.get(key)||0;
  if(automatic&&timestamp-previous<5*60*1000)return null;
  lastSent.set(key,timestamp);
  const technical=diagnostics();
  const description=buildReportDescription({type,message,diagnostics:technical,reference:key});
  const title=clean(options.title||('Erro ERP · '+type+' · '+message),160);
  const {data,error}=await db.from('helpdesk_tickets').insert({
   title,description,category:options.category||'software',priority:options.priority||(automatic?'high':'normal'),
   location:clean(options.location||location,160),affected_service:clean(options.affectedService||stationLabel,160),
   created_by:actorId,status:'open'
  }).select('id,ticket_number').single();
  if(error)throw error;
  return data;
 }
 function closeModal(){modal?.remove();modal=null;button?.focus?.();}
 function openReportForm(){
  if(!documentRef?.body||modal)return;
  modal=documentRef.createElement('div');modal.id='ciadi-error-report-modal';
  modal.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML='<section role="dialog" aria-modal="true" aria-labelledby="ciadi-error-title" style="background:#fff;color:#1f2937;width:min(620px,100%);max-height:92vh;overflow:auto;border-radius:18px;padding:22px;box-shadow:0 18px 60px rgba(0,0,0,.28);font:14px system-ui"><header style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><p style="margin:0;color:#6f351f;font-weight:700;font-size:11px;letter-spacing:.12em">CIADI · SUPORTE INFORMÁTICO</p><h2 id="ciadi-error-title" style="font-size:22px;font-weight:800;margin:5px 0">Reportar um erro</h2></div><button type="button" data-close aria-label="Fechar formulário" style="font-size:26px;border:0;background:transparent;cursor:pointer">×</button></header><p style="color:#64748b;margin:8px 0 16px">Descreva o que aconteceu. A aplicação anexará automaticamente informações técnicas para ajudar no diagnóstico.</p><form data-error-form><label style="display:block;font-weight:650;margin:10px 0">Título do problema<input name="title" required maxlength="150" placeholder="Ex.: Não consigo emitir uma factura" style="display:block;width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:9px;margin-top:5px"></label><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label style="display:block;font-weight:650">Categoria<select name="category" style="display:block;width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:9px;margin-top:5px"><option value="software">Software / funcionamento</option><option value="access">Acesso / permissões</option><option value="network">Rede / ligação</option><option value="hardware">Equipamento</option><option value="security">Segurança</option><option value="other">Outro</option></select></label><label style="display:block;font-weight:650">Prioridade<select name="priority" style="display:block;width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:9px;margin-top:5px"><option value="normal">Normal</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label></div><label style="display:block;font-weight:650;margin:10px 0">O que estava a fazer quando ocorreu?<textarea name="description" required minlength="10" maxlength="1800" rows="5" placeholder="Indique os passos, o resultado esperado e a mensagem apresentada." style="display:block;width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:9px;margin-top:5px;resize:vertical"></textarea></label><p style="font-size:12px;color:#64748b;background:#f8fafc;padding:10px;border-radius:9px">Serão anexados: estação, perfil, polo, página, data/hora, navegador, sistema, idioma, estado da ligação e dimensões do ecrã. Não são recolhidas palavras-passe, tokens, chaves ou dados clínicos.</p><p data-error-status role="status" aria-live="polite" style="min-height:20px;color:#9a3412"></p><footer style="display:flex;justify-content:flex-end;gap:9px"><button type="button" data-cancel style="padding:10px 15px;border:1px solid #cbd5e1;border-radius:9px">Cancelar</button><button type="submit" style="padding:10px 16px;background:#6f351f;color:white;border:0;border-radius:9px;font-weight:700">Enviar ao Suporte</button></footer></form></section>';
  documentRef.body.appendChild(modal);
  const form=modal.querySelector('[data-error-form]');const status=modal.querySelector('[data-error-status]');modal.querySelector('[data-close]').addEventListener('click',closeModal);modal.querySelector('[data-cancel]').addEventListener('click',closeModal);
  modal.addEventListener('click',event=>{if(event.target===modal)closeModal();});
  form.addEventListener('submit',async event=>{
   event.preventDefault();const submitButton=form.querySelector('[type="submit"]');const values=new FormData(form);
   const title=clean(values.get('title'),150);const detail=clean(values.get('description'),1800);
   if(title.length<5||detail.length<10){status.textContent='Preencha o título e a descrição com informação suficiente.';return;}
   submitButton.disabled=true;submitButton.textContent='A enviar…';status.textContent='A registar o incidente…';
   try{
    const extra=latestError?'Último erro técnico detectado automaticamente: '+safeErrorMessage(latestError):'';
    const ticket=await submit('Relato manual',detail+(extra?'\n\n'+extra:''),false,{title:'Erro reportado · '+title,category:clean(values.get('category'),32),priority:clean(values.get('priority'),16),affectedService:stationLabel});
    closeModal();notify('Relato enviado ao Suporte. Referência: '+(ticket?.ticket_number||ticket?.id||'registado'));
   }catch(error){status.textContent='Não foi possível enviar. Verifique a ligação e tente novamente.';submitButton.disabled=false;submitButton.textContent='Tentar novamente';}
  });
  form.elements.title.focus();
 }
 function reportButton(){
  if(!documentRef?.body||button)return;
  button=documentRef.createElement('button');button.type='button';button.textContent='Reportar um erro';button.setAttribute('aria-label','Abrir formulário para reportar um erro ao Suporte Informático CIADI');
  button.style.cssText='position:fixed;right:18px;bottom:18px;z-index:99999;background:#6f351f;color:#fff;border:0;border-radius:12px;padding:11px 16px;font:600 14px system-ui;box-shadow:0 4px 16px rgba(0,0,0,.18);cursor:pointer';
  button.addEventListener('click',openReportForm);documentRef.body.appendChild(button);
 }
 function onError(event){const message=event?.message||event?.error?.message||'Erro JavaScript não identificado';latestError=safeErrorMessage(message);submit('Erro JavaScript',latestError,true).catch(()=>{});}
 function onRejection(event){const reason=event?.reason;const message=reason?.message||reason||'Promessa rejeitada sem detalhe';latestError=safeErrorMessage(message);submit('Promessa rejeitada',latestError,true).catch(()=>{});}
 function install(){if(installed)return;installed=true;reportButton();windowRef?.addEventListener?.('error',onError);windowRef?.addEventListener?.('unhandledrejection',onRejection);}
 function destroy(){if(!installed)return;windowRef?.removeEventListener?.('error',onError);windowRef?.removeEventListener?.('unhandledrejection',onRejection);button?.remove();button=null;closeModal();installed=false;}
 return Object.freeze({install,destroy,report:(message)=>submit('Relato manual',message,false),openReportForm});
}
return Object.freeze({create,safeErrorMessage,collectDiagnostics,buildReportDescription});
});