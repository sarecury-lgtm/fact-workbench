/* global FACT_PROMPTS */
(() => {
  'use strict';

  const KEY = 'fact-workbench-state-v1';
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  const blankFact = () => ({ fairInterpretation:'', confirmedFacts:'', unconfirmedParts:'', differences:'', correctedStatement:'', verdict:'대기', confidence:'중간', sources:[] });
  const blankContext = () => ({ broaderConclusion:'', issues:[], supportAssessment:'', missingContext:'', neutralInterpretation:'', verdict:'대기' });
  const blankState = () => ({ version:1, title:'', sourceText:'', extractionResult:'', currentStep:1, selectedClaimId:null, claims:[], report:'', updatedAt:new Date().toISOString() });

  const normalizeSource = (x={}) => ({ id:x.id||uuid(), title:x.title||'', url:x.url||'', grade:x.grade||'출처 품질 불명', excerpt:x.excerpt||'' });
  const normalizeClaim = (x={}, i=0) => ({
    id:x.id||`C${i+1}`,
    originalExcerpt:x.originalExcerpt ?? x.original_excerpt ?? '',
    text:x.text ?? x.claim ?? '',
    type:x.type||'기타',
    fact:{ ...blankFact(), ...(x.fact||{}), fairInterpretation:x.fact?.fairInterpretation ?? x.fact?.fair_interpretation ?? '', confirmedFacts:x.fact?.confirmedFacts ?? x.fact?.confirmed_facts ?? '', unconfirmedParts:x.fact?.unconfirmedParts ?? x.fact?.unconfirmed_parts ?? '', correctedStatement:x.fact?.correctedStatement ?? x.fact?.corrected_statement ?? '', sources:(x.fact?.sources||[]).map(normalizeSource) },
    context:{ ...blankContext(), ...(x.context||{}), broaderConclusion:x.context?.broaderConclusion ?? x.context?.broader_conclusion ?? '', supportAssessment:x.context?.supportAssessment ?? x.context?.support_assessment ?? '', missingContext:x.context?.missingContext ?? x.context?.missing_context ?? '', neutralInterpretation:x.context?.neutralInterpretation ?? x.context?.neutral_interpretation ?? '' }
  });

  function load(){
    try { const x=JSON.parse(localStorage.getItem(KEY)); return x ? { ...blankState(), ...x, claims:(x.claims||[]).map(normalizeClaim) } : blankState(); }
    catch { return blankState(); }
  }
  let state=load(), saveTimer, toastTimer;
  const N = Object.fromEntries([
    'projectTitle','sourceText','extractResult','claimList','claimEditorList','claimStats','saveStatus','toast','claimDialog','claimDialogForm','claimDialogTitle','dialogOriginal','dialogClaim','dialogType','dialogClaimId','sourceDialog','sourceDialogForm','sourceTitle','sourceUrl','sourceGrade','sourceExcerpt','sourceEditId','noClaimStep3','factForm','selectedClaimBadge','factClaimText','factOriginalExcerpt','factJsonBox','factResultJson','fairInterpretation','confirmedFacts','unconfirmedParts','factDifferences','correctedStatement','factVerdict','confidence','sourceList','noClaimStep4','contextForm','contextJsonBox','contextResultJson','contextClaimText','contextFactSummary','broaderConclusion','supportAssessment','missingContext','neutralInterpretation','contextVerdict','reportOutput'
  ].map(id=>[id,q(`#${id}`)]));

  function save(label='저장됨'){
    state.updatedAt=new Date().toISOString();
    N.saveStatus.textContent='저장 중…';
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{ localStorage.setItem(KEY,JSON.stringify(state)); N.saveStatus.textContent=label; },120);
  }
  function toast(msg){ N.toast.textContent=msg; N.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>N.toast.classList.remove('show'),1700); }
  function selected(){ return state.claims.find(c=>c.id===state.selectedClaimId)||null; }
  function parseJSON(text){ const t=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''); if(!t) throw Error('내용이 비어 있습니다.'); return JSON.parse(t); }
  async function copy(text,msg){ if(!text?.trim()) return toast('복사할 내용이 없습니다.'); try{ await navigator.clipboard.writeText(text); }catch{ const a=document.createElement('textarea'); a.value=text; document.body.append(a); a.select(); document.execCommand('copy'); a.remove(); } toast(msg||'복사했습니다.'); }
  function download(name,text,type='text/plain'){ const u=URL.createObjectURL(new Blob([text],{type:`${type};charset=utf-8`})); const a=document.createElement('a'); a.href=u;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(u); }
  function safeName(s){ return (s||'fact-workbench').replace(/[\\/:*?"<>|]/g,'-'); }
  function contextText(){ return `프로젝트: ${state.title||'제목 없음'}\n원문 전체 맥락:\n${state.sourceText||'원문 없음'}`; }

  function setStep(n){ state.currentStep=Number(n); qa('#stepNav button').forEach(b=>b.classList.toggle('active',+b.dataset.step===state.currentStep)); qa('.step-panel').forEach(p=>p.classList.toggle('active',+p.dataset.panel===state.currentStep)); if(state.currentStep===5) summary(); save(); }
  function selectClaim(id){ state.selectedClaimId=id; renderClaimList(); renderFact(); renderContext(); save(); }
  function adjacent(d){ if(!state.claims.length)return; let i=Math.max(0,state.claims.findIndex(c=>c.id===state.selectedClaimId)); i=Math.max(0,Math.min(state.claims.length-1,i+d)); selectClaim(state.claims[i].id); }

  function renderClaimList(){
    const done=state.claims.filter(c=>c.fact.verdict!=='대기').length;
    N.claimStats.textContent=`${state.claims.length}개 · 1차 완료 ${done}개`;
    N.claimList.innerHTML='';
    if(!state.claims.length){ N.claimList.className='claim-list empty-state'; N.claimList.textContent='아직 추출된 주장이 없습니다.'; return; }
    N.claimList.className='claim-list';
    state.claims.forEach(c=>{
      const b=document.createElement('button'); b.type='button'; b.className='claim-item'+(c.id===state.selectedClaimId?' active':'');
      const top=document.createElement('div'); top.className='claim-item-top'; top.innerHTML=`<span class="claim-id">${escapeHTML(c.id)}</span><span class="claim-type">${escapeHTML(c.type)}</span>`;
      const p=document.createElement('p');p.textContent=c.text; const s=document.createElement('small');s.textContent=c.fact.verdict;
      b.append(top,p,s); b.onclick=()=>selectClaim(c.id); N.claimList.append(b);
    });
  }
  function escapeHTML(s){ return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  function renderEditors(){
    N.claimEditorList.innerHTML='';
    if(!state.claims.length){ N.claimEditorList.className='editor-list empty-state'; N.claimEditorList.textContent='추출 결과를 적용하면 여기에 표시됩니다.'; return; }
    N.claimEditorList.className='editor-list';
    state.claims.forEach(c=>{
      const row=document.createElement('div');row.className='claim-editor';
      const id=document.createElement('div');id.className='id-box';id.textContent=c.id;
      const ta=document.createElement('textarea');ta.value=c.text;ta.oninput=()=>{c.text=ta.value;renderClaimList();renderFact();renderContext();save();};
      const sel=document.createElement('select'); ['사건','통계','법률','판결 결과','판결 이유','수사 과정','인과관계','비교','기타'].forEach(t=>{const o=new Option(t,t,t===c.type,t===c.type);sel.add(o);}); sel.onchange=()=>{c.type=sel.value;renderClaimList();save();};
      const act=document.createElement('div');act.className='claim-editor-actions';
      const edit=document.createElement('button');edit.className='icon-button';edit.type='button';edit.textContent='✎';edit.title='편집';edit.onclick=()=>openClaim(c);
      const del=document.createElement('button');del.className='icon-button';del.type='button';del.textContent='−';del.title='삭제';del.onclick=()=>removeClaim(c.id);
      act.append(edit,del);row.append(id,ta,sel,act);N.claimEditorList.append(row);
    });
  }
  function openClaim(c=null){ N.claimDialogTitle.textContent=c?'주장 편집':'주장 추가';N.dialogClaimId.value=c?.id||'';N.dialogOriginal.value=c?.originalExcerpt||'';N.dialogClaim.value=c?.text||'';N.dialogType.value=c?.type||'사건';N.claimDialog.showModal(); }
  function saveClaim(e){ e.preventDefault(); const text=N.dialogClaim.value.trim(); if(!text)return toast('주장을 입력하세요.'); const id=N.dialogClaimId.value; if(id){ const c=state.claims.find(x=>x.id===id);Object.assign(c,{text,originalExcerpt:N.dialogOriginal.value.trim(),type:N.dialogType.value}); }else{ const n=state.claims.length+1; state.claims.push(normalizeClaim({id:`C${n}`,text,originalExcerpt:N.dialogOriginal.value.trim(),type:N.dialogType.value},n-1)); state.selectedClaimId=`C${n}`; } N.claimDialog.close();renderClaims();renderFact();renderContext();save(); }
  function removeClaim(id){ if(!confirm('이 주장과 검증 결과를 삭제할까요?'))return; state.claims=state.claims.filter(c=>c.id!==id); if(state.selectedClaimId===id)state.selectedClaimId=state.claims[0]?.id||null; renderClaims();renderFact();renderContext();save(); }
  function addClaims(arr){ const start=state.claims.length; arr.forEach((x,i)=>state.claims.push(normalizeClaim({...x,id:`C${start+i+1}`},start+i))); if(!state.selectedClaimId)state.selectedClaimId=state.claims[0]?.id||null; renderClaims();renderFact();renderContext();save(); }
  function renderClaims(){renderClaimList();renderEditors();}

  const factFields=['fairInterpretation','confirmedFacts','unconfirmedParts','factDifferences','correctedStatement','factVerdict','confidence'];
  function renderFact(){
    const c=selected(), show=!!c; N.noClaimStep3.classList.toggle('hidden',show);N.factForm.classList.toggle('hidden',!show);N.selectedClaimBadge.textContent=c?`${c.id} · ${c.fact.verdict}`:'주장 미선택'; if(!c)return;
    N.factClaimText.textContent=c.text;N.factOriginalExcerpt.textContent=c.originalExcerpt?`원문: ${c.originalExcerpt}`:'';
    N.fairInterpretation.value=c.fact.fairInterpretation;N.confirmedFacts.value=c.fact.confirmedFacts;N.unconfirmedParts.value=c.fact.unconfirmedParts;N.factDifferences.value=c.fact.differences;N.correctedStatement.value=c.fact.correctedStatement;N.factVerdict.value=c.fact.verdict;N.confidence.value=c.fact.confidence;renderSources();
  }
  function writeFact(){ const c=selected();if(!c)return;c.fact.fairInterpretation=N.fairInterpretation.value;c.fact.confirmedFacts=N.confirmedFacts.value;c.fact.unconfirmedParts=N.unconfirmedParts.value;c.fact.differences=N.factDifferences.value;c.fact.correctedStatement=N.correctedStatement.value;c.fact.verdict=N.factVerdict.value;c.fact.confidence=N.confidence.value;renderClaimList();N.selectedClaimBadge.textContent=`${c.id} · ${c.fact.verdict}`;save(); }
  function applyFact(){ try{const d=parseJSON(N.factResultJson.value),c=selected();if(!c)return;c.fact={...c.fact,fairInterpretation:d.fair_interpretation??d.fairInterpretation??'',confirmedFacts:d.confirmed_facts??d.confirmedFacts??'',unconfirmedParts:d.unconfirmed_parts??d.unconfirmedParts??'',differences:d.differences||'',correctedStatement:d.corrected_statement??d.correctedStatement??'',verdict:d.verdict||'대기',confidence:d.confidence||'중간',sources:(d.sources||[]).map(normalizeSource)};N.factResultJson.value='';N.factJsonBox.classList.add('hidden');renderFact();renderClaimList();save();toast('1차 검증 결과를 적용했습니다.');}catch(e){toast(`JSON 오류: ${e.message}`);} }
  function renderSources(){ const c=selected();N.sourceList.innerHTML=''; if(!c?.fact.sources.length){N.sourceList.className='source-list empty-state';N.sourceList.textContent='등록된 출처가 없습니다.';return;} N.sourceList.className='source-list';c.fact.sources.forEach(s=>{const card=document.createElement('div');card.className='source-card';const head=document.createElement('div');head.className='source-card-head';const left=document.createElement('div');const strong=document.createElement('strong');strong.textContent=s.title;const grade=document.createElement('div');grade.className='grade';grade.textContent=s.grade;left.append(strong,grade);const acts=document.createElement('div');acts.className='card-actions';const e=document.createElement('button');e.type='button';e.textContent='편집';e.onclick=()=>openSource(s);const d=document.createElement('button');d.type='button';d.textContent='삭제';d.onclick=()=>{c.fact.sources=c.fact.sources.filter(x=>x.id!==s.id);renderSources();save();};acts.append(e,d);head.append(left,acts);const p=document.createElement('p');p.textContent=s.excerpt;card.append(head,p);if(s.url){const a=document.createElement('a');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=s.url;card.append(a);}N.sourceList.append(card);}); }
  function openSource(s=null){N.sourceEditId.value=s?.id||'';N.sourceTitle.value=s?.title||'';N.sourceUrl.value=s?.url||'';N.sourceGrade.value=s?.grade||'1차 자료';N.sourceExcerpt.value=s?.excerpt||'';N.sourceDialog.showModal();}
  function saveSource(e){e.preventDefault();const c=selected();if(!c)return;const data=normalizeSource({id:N.sourceEditId.value||undefined,title:N.sourceTitle.value.trim(),url:N.sourceUrl.value.trim(),grade:N.sourceGrade.value,excerpt:N.sourceExcerpt.value.trim()});if(!data.title||!data.excerpt)return toast('출처명과 확인 내용을 입력하세요.');const i=c.fact.sources.findIndex(s=>s.id===data.id);if(i>=0)c.fact.sources[i]=data;else c.fact.sources.push(data);N.sourceDialog.close();renderSources();save();}

  function renderContext(){ const c=selected(),show=!!c;N.noClaimStep4.classList.toggle('hidden',show);N.contextForm.classList.toggle('hidden',!show);if(!c)return;N.contextClaimText.textContent=c.text;N.contextFactSummary.textContent=c.fact.correctedStatement?`1차 사실: ${c.fact.correctedStatement}`:`1차 판정: ${c.fact.verdict}`;N.broaderConclusion.value=c.context.broaderConclusion;N.supportAssessment.value=c.context.supportAssessment;N.missingContext.value=c.context.missingContext;N.neutralInterpretation.value=c.context.neutralInterpretation;N.contextVerdict.value=c.context.verdict;qa('.issue-grid input').forEach(x=>x.checked=c.context.issues.includes(x.value)); }
  function writeContext(){const c=selected();if(!c)return;c.context.broaderConclusion=N.broaderConclusion.value;c.context.supportAssessment=N.supportAssessment.value;c.context.missingContext=N.missingContext.value;c.context.neutralInterpretation=N.neutralInterpretation.value;c.context.verdict=N.contextVerdict.value;c.context.issues=qa('.issue-grid input:checked').map(x=>x.value);save();}
  function applyContext(){try{const d=parseJSON(N.contextResultJson.value),c=selected();if(!c)return;c.context={...c.context,broaderConclusion:d.broader_conclusion??d.broaderConclusion??'',issues:Array.isArray(d.issues)?d.issues:[],supportAssessment:d.support_assessment??d.supportAssessment??'',missingContext:d.missing_context??d.missingContext??'',neutralInterpretation:d.neutral_interpretation??d.neutralInterpretation??'',verdict:d.verdict||'대기'};N.contextResultJson.value='';N.contextJsonBox.classList.add('hidden');renderContext();save();toast('2차 검토 결과를 적용했습니다.');}catch(e){toast(`JSON 오류: ${e.message}`);}}

  function summary(){const total=state.claims.length,done=state.claims.filter(c=>c.fact.verdict!=='대기').length,m=new Set(['일부 사실','과장·맥락 누락','사실과 다름']),u=new Set(['근거 부족','확인 불가']);q('#summaryTotal').textContent=total;q('#summaryDone').textContent=done;q('#summaryMismatch').textContent=state.claims.filter(c=>m.has(c.fact.verdict)).length;q('#summaryUnknown').textContent=state.claims.filter(c=>u.has(c.fact.verdict)).length;}
  function sourceMD(a){return a?.length?a.map(s=>`- [${s.grade}] ${s.title}${s.url?` — ${s.url}`:''}\n  - 확인 내용: ${s.excerpt}`).join('\n'):'- 등록된 출처 없음';}
  function report(){const L=[`# ${state.title||'팩트체크 보고서'}`,'',`- 생성 시각: ${new Date().toLocaleString('ko-KR')}`,`- 전체 주장: ${state.claims.length}개`,'','## 검증 원칙','','- 작성자의 태도나 성향이 아니라 검증 가능한 주장만 다뤘다.','- 원 주장을 합리적으로 해석한 뒤 지지·제한 자료를 함께 확인했다.','- 찾지 못함, 근거 부족, 사실과 다름을 구분했다.','- 고의적인 거짓말 여부는 판단하지 않았다.',''];state.claims.forEach(c=>{L.push(`## ${c.id}. ${c.text}`,'');if(c.originalExcerpt)L.push(`> 원문: ${c.originalExcerpt}`,'');L.push(`- **유형:** ${c.type}`,`- **1차 판정:** ${c.fact.verdict} (확신도: ${c.fact.confidence})`,`- **확인된 사실:** ${c.fact.confirmedFacts||'미입력'}`,`- **확인되지 않은 부분:** ${c.fact.unconfirmedParts||'미입력'}`,`- **원문과 차이:** ${c.fact.differences||'미입력'}`,`- **가장 정확한 서술:** ${c.fact.correctedStatement||'미입력'}`,`- **2차 판정:** ${c.context.verdict}`);if(c.context.issues.length)L.push(`- **맥락 문제:** ${c.context.issues.join(', ')}`);if(c.context.supportAssessment)L.push(`- **상위 결론 지지력:** ${c.context.supportAssessment}`);if(c.context.missingContext)L.push(`- **필요한 맥락·비교:** ${c.context.missingContext}`);if(c.context.neutralInterpretation)L.push(`- **과장 없이 다시 쓴 해석:** ${c.context.neutralInterpretation}`);L.push('','### 출처','',sourceMD(c.fact.sources),'');});L.push('## 남은 한계','','- 공개 자료가 제한된 항목은 확정하지 않았다.','- 개별 사례만으로 집단 간 전체 경향을 입증할 수 없는 경우 별도 비교 통계가 필요하다.','');state.report=L.join('\n');N.reportOutput.value=state.report;save();toast('보고서를 생성했습니다.');}

  function renderAll(){N.projectTitle.value=state.title;N.sourceText.value=state.sourceText;N.extractResult.value=state.extractionResult;N.reportOutput.value=state.report;renderClaims();renderFact();renderContext();summary();setStep(state.currentStep||1);}
  function bind(){
    N.projectTitle.oninput=()=>{state.title=N.projectTitle.value;save();};N.sourceText.oninput=()=>{state.sourceText=N.sourceText.value;save();};N.extractResult.oninput=()=>{state.extractionResult=N.extractResult.value;save();};N.reportOutput.oninput=()=>{state.report=N.reportOutput.value;save();};
    qa('#stepNav button').forEach(b=>b.onclick=()=>setStep(b.dataset.step));qa('.next-step').forEach(b=>b.onclick=()=>setStep(b.dataset.next));
    const extract=()=>copy(FACT_PROMPTS.extraction(state.sourceText),'주장 추출 프롬프트를 복사했습니다.');q('#copyExtractPromptBtn').onclick=extract;q('#copyExtractPromptBtn2').onclick=extract;
    q('#applyExtractBtn').onclick=()=>{try{const d=parseJSON(N.extractResult.value);if(!Array.isArray(d.claims))throw Error('claims 배열이 없습니다.');if(state.claims.length&&!confirm('기존 주장 뒤에 새 결과를 추가할까요?'))return;addClaims(d.claims);toast(`${d.claims.length}개 주장을 적용했습니다.`);}catch(e){toast(`JSON 오류: ${e.message}`);}};
    q('#addClaimBtn').onclick=()=>openClaim();q('#addClaimBtn2').onclick=()=>openClaim();N.claimDialogForm.addEventListener('submit',saveClaim);
    q('#copyFactPromptBtn').onclick=()=>{const c=selected();if(c)copy(FACT_PROMPTS.factCheck(c,contextText()),'1차 검증 프롬프트를 복사했습니다.');};q('#toggleFactJsonBtn').onclick=()=>N.factJsonBox.classList.toggle('hidden');q('#applyFactJsonBtn').onclick=applyFact;factFields.forEach(id=>N[id].addEventListener('input',writeFact));q('#addSourceBtn').onclick=()=>openSource();N.sourceDialogForm.addEventListener('submit',saveSource);q('#saveFactBtn').onclick=()=>{writeFact();adjacent(1);toast('1차 결과를 저장했습니다.');};
    q('#copyContextPromptBtn').onclick=()=>{const c=selected();if(c)copy(FACT_PROMPTS.contextReview(c,contextText()),'2차 검토 프롬프트를 복사했습니다.');};q('#toggleContextJsonBtn').onclick=()=>N.contextJsonBox.classList.toggle('hidden');q('#applyContextJsonBtn').onclick=applyContext;[N.broaderConclusion,N.supportAssessment,N.missingContext,N.neutralInterpretation,N.contextVerdict].forEach(x=>x.addEventListener('input',writeContext));qa('.issue-grid input').forEach(x=>x.addEventListener('change',writeContext));q('#saveContextBtn').onclick=()=>{writeContext();adjacent(1);toast('2차 결과를 저장했습니다.');};qa('.select-prev-claim').forEach(b=>b.onclick=()=>adjacent(-1));
    q('#generateReportBtn').onclick=report;q('#copyReportBtn').onclick=()=>copy(N.reportOutput.value,'보고서를 복사했습니다.');q('#downloadReportBtn').onclick=()=>{if(!N.reportOutput.value.trim())report();download(`${safeName(state.title||'fact-check-report')}.md`,N.reportOutput.value,'text/markdown');};q('#copySynthesisPromptBtn').onclick=()=>copy(FACT_PROMPTS.synthesis(state),'종합 프롬프트를 복사했습니다.');
    q('#exportBtn').onclick=()=>{download(`${safeName(state.title)}.json`,JSON.stringify(state,null,2),'application/json');toast('작업 데이터를 내보냈습니다.');};q('#importFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);state={...blankState(),...x,claims:(x.claims||[]).map(normalizeClaim)};renderAll();save('가져오기 완료');toast('작업 데이터를 가져왔습니다.');}catch(err){toast(`가져오기 실패: ${err.message}`);}};r.readAsText(f,'utf-8');e.target.value='';};q('#resetBtn').onclick=()=>{if(!confirm('현재 작업을 모두 초기화할까요? 먼저 JSON 백업을 권장합니다.'))return;localStorage.removeItem(KEY);state=blankState();renderAll();save();toast('초기화했습니다.');};
  }
  bind();renderAll();
})();
