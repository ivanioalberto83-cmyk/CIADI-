(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CIADI_INSTITUTIONAL_IDENTITY=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const BRAND=Object.freeze({
  acronym:'CIADI',
  name:'CENTRO INTEGRADO DE APOIO E DESENVOLVIMENTO INDIVIDUAL',
  shortName:'Centro Integrado de Apoio e Desenvolvimento Individual',
  palette:Object.freeze({orange:'#f58200',peach:'#ffe7bf',yellow:'#ffdf19',brown:'#6f351f',white:'#fbfdff'}),
  fonts:'Poppins, Inter, Arial, sans-serif',
  logoAsset:'assets/ciadi-logo.png',
  website:'https://ciadi.ao',
  email:'geral@ciadi.ao',
  address:'Condomínio Jardim de Rosas, Talatona, Luanda, Angola',
  documentFooter:'Documento institucional CIADI. A autenticidade deve ser confirmada no serviço oficial.'
});
function getBrand(){return BRAND;}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderDocumentHeader({title,reference='',date='',logoUrl=BRAND.logoAsset}={}){
 return '<header class="ciadi-document-header"><div class="ciadi-brand">'+(logoUrl?'<img src="'+escapeHtml(logoUrl)+'" alt="Logótipo CIADI">':'')+'<div><strong>'+BRAND.acronym+'</strong><div>'+BRAND.name+'</div><small>'+BRAND.address+'</small></div></div><div class="ciadi-document-meta"><b>'+escapeHtml(title)+'</b><div>'+escapeHtml(reference)+'</div><div>'+escapeHtml(date)+'</div></div></header>';
}
return Object.freeze({getBrand,escapeHtml,renderDocumentHeader});
});
