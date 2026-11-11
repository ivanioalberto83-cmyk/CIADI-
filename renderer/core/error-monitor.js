(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CIADI_ERROR_MONITOR=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const MAX_MESSAGE=1200;
function clean(value,max=MAX_MESSAGE){return String(value??'').replace(/[\\u0000-\\u001f\\u007f]/g,' ').replace(/\\s+/g,' ').trim().slice(0,max);}
function safeErrorMessage(value){let message=clean(value);message=message.replace(/(password|token|secret|authorization|apikey|api_key)\\s*[:=]\\s*[^\\s,;]+/gi,'$1=[redigido]').replace(/eyJ[a-zA-Z0-9_-]{20,}\\.[a-zA-Z0-9_-]{10,}\\.[a-zA-Z0-9_-]{10,}/g,'[token redigido]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi,'[email redigido]');return message||'Erro sem mensagem disponível.';}
function fingerprint(type,message){let h=2166136261;const value=type+'|'+message;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
function create({supabase,actorId,profile,poloCode=null,stationLabel='CIADI ERP',notify=()=>{},documentRef=typeof document!=='undefined'?document:null,windowRef=typeof window!=='undefined'?window:null,now=()=>new Date()}={}){
 if(!supabase||!actorId)throw new Error('Sessão autenticada e ligação ao CIADI obrigatórias.');
 const db=supabase.schema('ciadi_ti');let button=null;let lastSent=new Map();let installed=false;
 const role=clean(profile?.tipo,80)||'utilizador';const location=clean(poloCode||'Polo não identificado',160);
 async function submit(type,rawMessage,automatic=true){
  const message=safeErrorMessage(rawMessage);const key=fingerprint(type,message);const timestamp=now().getTime();const previous=lastSent.get(key)||0;
  if(automatic&&timestamp-previous<5*60*1000)return null;
  lastSent.set(key,timestamp);
  const description=['Origem: '+clean(type,80),'Mensagem: '+message,'Estação: '+clean(stationLabel,100),'Perfil: '+role,'Polo: '+location,'Página: '+clean(windowRef?.location?.pathname||'não identificada',180),'Data: '+now().toISOString(),'Referência: '+key].join('\\n');
  const {data,error}=await db.from('helpdesk_tickets').insert({title:clean('Erro ERP · '+type+' · '+message,160),description:description.slice(0,4900),category:'software',priority:automatic?'high':'normal',location,affected_service:'CIADI ERP',created_by:actorId,status:'open'}).select('id,ticket_number').single();
  if(error)throw error;
  return data;
 }
 function reportButton(){
  if(!documentRef?.body||button)return;
  button=documentRef.createElement('button');button.type='button';button.textContent='Reportar erro';button.setAttribute('aria-label','Reportar erro ao Suporte Informático CIADI');
  button.style.cssText='position:fixed;right:18px;bottom:18px;z-index:99999;background:#6f351f;color:#fff;border:0;border-radius:12px;padding:11px 16px;font:600 14px system-ui;box-shadow:0 4px 16px rgba(0,0,0,.18);cursor:pointer';
  button.addEventListener('click',async()=>{const detail=windowRef?.prompt?.('Descreva o problema. Não inclua dados clínicos, palavras-passe ou códigos de acesso:');if(!detail||!clean(detail,1000))return;button.disabled=true;try{const ticket=await submit('Relato manual',detail,false);notify('Erro reportado ao Suporte. Referência: '+(ticket?.ticket_number||ticket?.id||'criada'));}catch(e){notify('Não foi possível enviar o relato. Verifique a ligação e tente novamente.');}finally{button.disabled=false;}});
  documentRef.body.appendChild(button);
 }
 function onError(event){const message=event?.message||event?.error?.message||'Erro JavaScript não identificado';submit('Erro JavaScript',message,true).catch(()=>{});}
 function onRejection(event){const reason=event?.reason;const message=reason?.message||reason||'Promessa rejeitada sem detalhe';submit('Promessa rejeitada',message,true).catch(()=>{});}
 function install(){if(installed)return;installed=true;reportButton();windowRef?.addEventListener?.('error',onError);windowRef?.addEventListener?.('unhandledrejection',onRejection);}
 function destroy(){if(!installed)return;windowRef?.removeEventListener?.('error',onError);windowRef?.removeEventListener?.('unhandledrejection',onRejection);button?.remove();button=null;installed=false;}
 return Object.freeze({install,destroy,report:(message)=>submit('Relato manual',message,false)});
}
return Object.freeze({create,safeErrorMessage});
});