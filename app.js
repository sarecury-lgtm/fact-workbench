/* global FACT_PROMPTS */
(() => {
  'use strict';
  const KEY = 'fact-workbench-streamlined-v1';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const id = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const blank = () => ({ version: 2, step: 1, title: '', sourceText: '', extractionAnswer: '', groups: [], activeGroupId: null, contextAnswer: '', final: null, updatedAt: new Date().toISOString() });
  let state = load();
  let toastTimer;

  function load() {
    try { return { ...blank(), ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
    catch { return blank(); }
  }
  function save() {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(state));
    $('#saveStatus').textContent = '자동 저장';
  }
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }
  function hint(selector, message = '', type = '') {
    const el = $(selector);
    el.textContent = message;
    el.className = `hint ${type}`.trim();
  }
  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
  }
  function setStep(step) {
    state.step = Number(step);
    $$('.steps button').forEach(b => b.classList.toggle('active', Number(b.dataset.step) === state.step));
    $$('.panel').forEach(p => p.classList.toggle('active', Number(p.dataset.panel) === state.step));
    save();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function copySync(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    area.style.top = '0';
    document.body.append(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, area.value.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    area.remove();
    if (!ok && navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => {});
    return ok;
  }
  function handoff(prompt, after) {
    if (!prompt.trim()) return toast('먼저 필요한 내용을 입력하세요.');
    const copied = copySync(prompt);
    const tab = window.open('https://chatgpt.com/', '_blank');
    if (tab) tab.opener = null;
    if (after) after();
    toast(copied ? '복사했습니다. 새 채팅에서 Ctrl+V 하세요.' : '새 채팅을 열었습니다. 복사가 안 됐다면 버튼을 다시 누르세요.');
  }

  // JSON-like parser tolerant of fences, prose, trailing commas, omitted commas and multiline strings.
  function parseAIAnswer(raw) {
    let text = String(raw || '').replace(/^\uFEFF/, '').trim();
    if (!text) throw new Error('AI 답변을 붙여넣으세요.');
    text = text.replace(/^```(?:json|javascript|js)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const sliced = extractStructured(text);
    const attempts = [sliced, sliced.replace(/,\s*([}\]])/g, '$1')];
    for (const candidate of attempts) {
      try { return JSON.parse(candidate); } catch {}
    }
    try { return new LooseParser(sliced).parse(); }
    catch (error) { throw new Error('AI 답변 구조를 읽지 못했습니다. 답변 전체를 그대로 붙였는지 확인하세요.'); }
  }
  function extractStructured(text) {
    const firstObj = text.indexOf('{');
    const firstArr = text.indexOf('[');
    let start;
    if (firstObj < 0) start = firstArr;
    else if (firstArr < 0) start = firstObj;
    else start = Math.min(firstObj, firstArr);
    if (start < 0) return text;
    const opener = text[start];
    const closer = opener === '{' ? '}' : ']';
    const end = text.lastIndexOf(closer);
    return text.slice(start, end > start ? end + 1 : undefined).trim();
  }
  class LooseParser {
    constructor(text) { this.s = text; this.i = 0; }
    parse() { this.ws(); const v = this.value(); this.ws(); return v; }
    ws() {
      while (this.i < this.s.length) {
        if (/\s/.test(this.s[this.i])) { this.i++; continue; }
        if (this.s.startsWith('//', this.i)) { while (this.i < this.s.length && this.s[this.i] !== '\n') this.i++; continue; }
        if (this.s.startsWith('/*', this.i)) { const e = this.s.indexOf('*/', this.i + 2); this.i = e < 0 ? this.s.length : e + 2; continue; }
        break;
      }
    }
    value() {
      this.ws();
      const ch = this.s[this.i];
      if (ch === '{') return this.object();
      if (ch === '[') return this.array();
      if (ch === '"' || ch === "'") return this.string(false);
      const token = this.bare(/[\s,}\]]/);
      if (token === 'true') return true;
      if (token === 'false') return false;
      if (token === 'null') return null;
      if (token !== '' && !Number.isNaN(Number(token))) return Number(token);
      return token;
    }
    object() {
      const out = {}; this.i++; this.ws();
      while (this.i < this.s.length && this.s[this.i] !== '}') {
        let key;
        if (this.s[this.i] === '"' || this.s[this.i] === "'") key = this.string(true);
        else key = this.bare(/[:\s]/).trim();
        this.ws(); if (this.s[this.i] === ':') this.i++; else throw new Error('colon');
        const val = this.value(); out[key] = val; this.ws();
        if (this.s[this.i] === ',') { this.i++; this.ws(); }
        else if (this.s[this.i] !== '}') { this.ws(); }
      }
      if (this.s[this.i] === '}') this.i++;
      return out;
    }
    array() {
      const out = []; this.i++; this.ws();
      while (this.i < this.s.length && this.s[this.i] !== ']') {
        out.push(this.value()); this.ws();
        if (this.s[this.i] === ',') { this.i++; this.ws(); }
        else if (this.s[this.i] !== ']') { this.ws(); }
      }
      if (this.s[this.i] === ']') this.i++;
      return out;
    }
    string(isKey) {
      const quote = this.s[this.i++]; let out = '';
      while (this.i < this.s.length) {
        const ch = this.s[this.i++];
        if (ch === '\\') {
          const n = this.s[this.i++];
          const map = { n:'\n', r:'\r', t:'\t', b:'\b', f:'\f', '"':'"', "'":"'", '\\':'\\', '/':'/' };
          if (n === 'u') { const hex = this.s.slice(this.i, this.i + 4); if (/^[0-9a-f]{4}$/i.test(hex)) { out += String.fromCharCode(parseInt(hex, 16)); this.i += 4; } else out += 'u'; }
          else out += map[n] ?? n;
          continue;
        }
        if (ch === quote) {
          const rest = this.s.slice(this.i); const m = rest.match(/^\s*/); const offset = m?.[0].length || 0; const next = rest[offset];
          const nextLooksLikeKey = /^[\"'][^\"']+[\"']\s*:/.test(rest.slice(offset));
          const closes = isKey ? next === ':' : next === ',' || next === '}' || next === ']' || next === undefined || nextLooksLikeKey;
          if (closes) return out;
          out += ch; continue;
        }
        out += ch;
      }
      return out;
    }
    bare(stop) { const start = this.i; while (this.i < this.s.length && !stop.test(this.s[this.i])) this.i++; return this.s.slice(start, this.i).trim(); }
  }

  function normalizeExtraction(data) {
    let groups = data?.groups;
    if (!Array.isArray(groups) && Array.isArray(data)) groups = data;
    if (!Array.isArray(groups) && Array.isArray(data?.claims)) {
      const claims = data.claims;
      groups = [];
      for (let i = 0; i < claims.length; i += 5) groups.push({ title: `검증 묶음 ${groups.length + 1}`, reason: '같이 추출된 주장', claims: claims.slice(i, i + 5) });
    }
    if (!Array.isArray(groups) || !groups.length) throw new Error('추출된 주장 묶음을 찾지 못했습니다.');
    let claimCounter = 1;
    return groups.map((g, gi) => ({
      id: String(g.id || `G${gi + 1}`),
      title: String(g.title || g.group || `검증 묶음 ${gi + 1}`),
      reason: String(g.reason || ''),
      summary: '',
      status: '대기',
      claims: (Array.isArray(g.claims) ? g.claims : []).map(c => ({
        id: String(c.id || c.claim_id || `C${claimCounter++}`),
        originalExcerpt: String(c.original_excerpt ?? c.originalExcerpt ?? ''),
        text: String(c.claim ?? c.text ?? ''),
        type: String(c.type || '기타'),
        result: null
      })).filter(c => c.text.trim())
    })).filter(g => g.claims.length);
  }
  function normalizeGroupResults(data, group) {
    let results = data?.results;
    if (!Array.isArray(results) && Array.isArray(data?.claims)) results = data.claims;
    if (!Array.isArray(results) && Array.isArray(data)) results = data;
    if (!Array.isArray(results)) throw new Error('주장별 검증 결과를 찾지 못했습니다.');
    const byId = new Map(results.map((r, i) => [String(r.claim_id || r.id || group.claims[i]?.id || ''), r]));
    group.claims.forEach((claim, i) => {
      const r = byId.get(claim.id) || results[i];
      if (!r) return;
      claim.result = {
        fairInterpretation: String(r.fair_interpretation ?? r.fairInterpretation ?? ''),
        confirmedFacts: String(r.confirmed_facts ?? r.confirmedFacts ?? ''),
        unconfirmedParts: String(r.unconfirmed_parts ?? r.unconfirmedParts ?? ''),
        differences: String(r.differences ?? ''),
        correctedStatement: String(r.corrected_statement ?? r.correctedStatement ?? ''),
        verdict: String(r.verdict || '확인 불가'),
        confidence: String(r.confidence || '중간'),
        sources: (Array.isArray(r.sources) ? r.sources : []).map(s => ({ title: String(s.title || ''), url: String(s.url || ''), grade: String(s.grade || ''), supports: String(s.supports ?? s.excerpt ?? '') }))
      };
    });
    group.summary = String(data?.group_summary ?? data?.summary ?? '');
    const done = group.claims.filter(c => c.result).length;
    group.status = done === group.claims.length ? '완료' : done ? '일부 완료' : '대기';
  }

  function render() {
    $('#projectTitle').value = state.title;
    $('#sourceText').value = state.sourceText;
    $('#extractionAnswer').value = state.extractionAnswer;
    $('#contextAnswer').value = state.contextAnswer;
    renderGroups();
    renderFinal();
    setStepNoScroll(state.step);
  }
  function setStepNoScroll(step) {
    state.step = Number(step);
    $$('.steps button').forEach(b => b.classList.toggle('active', Number(b.dataset.step) === state.step));
    $$('.panel').forEach(p => p.classList.toggle('active', Number(p.dataset.panel) === state.step));
  }
  function renderGroups() {
    const list = $('#groupList');
    const completed = state.groups.filter(g => g.status === '완료').length;
    $('#groupProgress').textContent = `${completed} / ${state.groups.length} 완료`;
    list.innerHTML = '';
    if (!state.groups.length) { list.className = 'group-list empty'; list.textContent = '먼저 1단계에서 AI 답변을 적용하세요.'; return; }
    list.className = 'group-list';
    state.groups.forEach(group => {
      const card = document.createElement('section'); card.className = 'group-card';
      const statusClass = group.status === '완료' ? 'done' : group.status === '일부 완료' ? 'partial' : '';
      card.innerHTML = `
        <div class="group-head">
          <div><h3>${escapeHTML(group.title)}</h3><div class="group-meta">${group.claims.length}개 주장${group.reason ? ` · ${escapeHTML(group.reason)}` : ''}</div></div>
          <div class="group-actions">
            <span class="status ${statusClass}">${escapeHTML(group.status)}</span>
            <button class="button primary send-group" type="button">${group.status === '완료' ? '다시 검증' : '이 묶음 검증'}</button>
            ${group.status !== '대기' ? '<button class="small-button detail-group" type="button">세부 결과</button>' : ''}
          </div>
        </div>
        <ol class="claim-preview">${group.claims.map(c => `<li>${escapeHTML(c.text)}</li>`).join('')}</ol>
        ${group.summary ? `<div class="group-result"><div class="result-line"><b>핵심 사실</b><span>${escapeHTML(group.summary)}</span></div></div>` : ''}`;
      card.querySelector('.send-group').onclick = () => sendGroup(group.id);
      card.querySelector('.detail-group')?.addEventListener('click', () => openDetails(group.id));
      list.append(card);
    });
  }
  function renderFinal() {
    const box = $('#finalReport');
    if (!state.final) { box.className = 'report empty'; box.textContent = '아직 최종 결과가 없습니다.'; return; }
    box.className = 'report';
    box.innerHTML = finalHTML(state.final);
  }
  function finalHTML(f) {
    const list = (title, items) => Array.isArray(items) && items.length ? `<h3>${title}</h3><ul>${items.map(x => `<li>${escapeHTML(x)}</li>`).join('')}</ul>` : '';
    const sources = Array.isArray(f.sources) && f.sources.length ? `<h3>출처</h3><ul>${f.sources.map(s => `<li>${escapeHTML(s.title || '')}${s.url ? ` — <a href="${escapeHTML(s.url)}" target="_blank" rel="noopener">${escapeHTML(s.url)}</a>` : ''}${s.supports ? `<br>${escapeHTML(s.supports)}` : ''}</li>`).join('')}</ul>` : '';
    return `<h3>전체 판단</h3><p>${escapeHTML(f.overallVerdict || '')}</p>${list('정확했던 근거', f.whatWasAccurate)}${list('달라지거나 과장된 근거', f.whatWasDistorted)}${list('전체 결론으로 넘어갈 때의 비약', f.unsupportedLeaps)}${list('추가로 필요한 비교 자료', f.missingComparisons)}<h3>자료에 가장 가까운 전체 사실</h3><p>${escapeHTML(f.accurateReconstruction || '')}</p><h3>짧은 사실 중심 답변</h3><p>${escapeHTML(f.conciseResponse || '')}</p>${sources}`;
  }
  function finalMarkdown(f = state.final) {
    if (!f) return '';
    const sec = (title, items) => Array.isArray(items) && items.length ? `\n## ${title}\n${items.map(x => `- ${x}`).join('\n')}\n` : '';
    return `# ${state.title || '팩트체크 결과'}\n\n## 전체 판단\n${f.overallVerdict || ''}\n${sec('정확했던 근거', f.whatWasAccurate)}${sec('달라지거나 과장된 근거', f.whatWasDistorted)}${sec('전체 결론으로 넘어갈 때의 비약', f.unsupportedLeaps)}${sec('추가로 필요한 비교 자료', f.missingComparisons)}\n## 자료에 가장 가까운 전체 사실\n${f.accurateReconstruction || ''}\n\n## 짧은 사실 중심 답변\n${f.conciseResponse || ''}\n\n## 출처\n${(f.sources || []).map(s => `- ${s.title || ''}${s.url ? `: ${s.url}` : ''}${s.supports ? ` — ${s.supports}` : ''}`).join('\n')}`;
  }

  function sendGroup(groupId) {
    const group = state.groups.find(g => g.id === groupId); if (!group) return;
    state.activeGroupId = groupId;
    $('#activeReturn').classList.remove('hidden');
    $('#activeReturnTitle').textContent = `${group.title} 검증 결과 붙여넣기`;
    $('#groupAnswer').value = '';
    hint('#groupHint');
    save();
    handoff(FACT_PROMPTS.groupCheck(state, group), () => $('#activeReturn').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  function openDetails(groupId) {
    const group = state.groups.find(g => g.id === groupId); if (!group) return;
    $('#detailTitle').textContent = group.title;
    $('#detailBody').innerHTML = group.claims.map(c => {
      const r = c.result;
      if (!r) return `<section class="detail-claim"><h4>${escapeHTML(c.text)}</h4><p>아직 검증되지 않았습니다.</p></section>`;
      const sources = r.sources.length ? `<div><b>출처</b><ul class="source-list">${r.sources.map(s => `<li>${escapeHTML(s.title)}${s.url ? ` — <a href="${escapeHTML(s.url)}" target="_blank" rel="noopener">${escapeHTML(s.url)}</a>` : ''}${s.supports ? `<br>${escapeHTML(s.supports)}` : ''}</li>`).join('')}</ul></div>` : '';
      return `<section class="detail-claim"><h4>${escapeHTML(c.id)}. ${escapeHTML(c.text)}</h4><div class="detail-grid"><div><b>판정</b>${escapeHTML(r.verdict)} · 확신도 ${escapeHTML(r.confidence)}</div><div><b>확인된 사실</b>${escapeHTML(r.confirmedFacts)}</div><div><b>확인되지 않은 부분</b>${escapeHTML(r.unconfirmedParts)}</div><div><b>원문과 차이</b>${escapeHTML(r.differences)}</div><div><b>정확한 서술</b>${escapeHTML(r.correctedStatement)}</div>${sources}</div></section>`;
    }).join('');
    $('#detailDialog').showModal();
  }

  function normalizeFinal(data) {
    return {
      overallVerdict: String(data.overall_verdict ?? data.overallVerdict ?? ''),
      whatWasAccurate: arr(data.what_was_accurate ?? data.whatWasAccurate),
      whatWasDistorted: arr(data.what_was_distorted ?? data.whatWasDistorted),
      unsupportedLeaps: arr(data.unsupported_leaps ?? data.unsupportedLeaps),
      missingComparisons: arr(data.missing_comparisons ?? data.missingComparisons),
      accurateReconstruction: String(data.accurate_reconstruction ?? data.accurateReconstruction ?? ''),
      conciseResponse: String(data.concise_response ?? data.conciseResponse ?? ''),
      sources: (Array.isArray(data.sources) ? data.sources : []).map(s => ({ title:String(s.title || ''), url:String(s.url || ''), supports:String(s.supports ?? s.excerpt ?? '') }))
    };
  }
  function arr(v) { return Array.isArray(v) ? v.map(String) : v ? [String(v)] : []; }

  function bind() {
    $$('.steps button').forEach(b => b.onclick = () => setStep(b.dataset.step));
    $('#projectTitle').oninput = e => { state.title = e.target.value; save(); };
    $('#sourceText').oninput = e => { state.sourceText = e.target.value; save(); };
    $('#extractionAnswer').oninput = e => { state.extractionAnswer = e.target.value; save(); };
    $('#contextAnswer').oninput = e => { state.contextAnswer = e.target.value; save(); };

    $('#sendExtractionBtn').onclick = () => handoff(FACT_PROMPTS.extraction(state.sourceText));
    $('#applyExtractionBtn').onclick = () => {
      try {
        const data = parseAIAnswer(state.extractionAnswer);
        state.groups = normalizeExtraction(data);
        state.activeGroupId = null;
        save(); renderGroups(); hint('#extractionHint', `${state.groups.length}개 검증 묶음을 만들었습니다.`, 'success'); toast('주장 묶음을 만들었습니다.');
        setTimeout(() => setStep(2), 350);
      } catch (e) { hint('#extractionHint', e.message, 'error'); }
    };
    $('#applyGroupBtn').onclick = () => {
      const group = state.groups.find(g => g.id === state.activeGroupId);
      if (!group) return hint('#groupHint', '적용할 묶음을 먼저 선택하세요.', 'error');
      try {
        const data = parseAIAnswer($('#groupAnswer').value);
        normalizeGroupResults(data, group);
        save(); renderGroups(); hint('#groupHint', `${group.claims.filter(c => c.result).length}개 주장 결과를 적용했습니다.`, 'success'); toast('묶음 검증 결과를 적용했습니다.');
        $('#groupAnswer').value = '';
        setTimeout(() => $('#activeReturn').classList.add('hidden'), 700);
      } catch (e) { hint('#groupHint', e.message, 'error'); }
    };
    $('#cancelGroupPasteBtn').onclick = () => $('#activeReturn').classList.add('hidden');
    $('#goContextBtn').onclick = () => setStep(3);
    $('#sendContextBtn').onclick = () => {
      if (!state.groups.some(g => g.claims.some(c => c.result))) return toast('먼저 한 묶음 이상 검증하세요.');
      handoff(FACT_PROMPTS.contextReview(state));
    };
    $('#applyContextBtn').onclick = () => {
      try {
        state.final = normalizeFinal(parseAIAnswer(state.contextAnswer));
        save(); renderFinal(); hint('#contextHint', '최종 결과를 적용했습니다.', 'success'); toast('최종 결과를 적용했습니다.');
      } catch (e) { hint('#contextHint', e.message, 'error'); }
    };
    $('#closeDetailBtn').onclick = () => $('#detailDialog').close();
    $('#copyReportBtn').onclick = () => { const md = finalMarkdown(); if (!md) return toast('복사할 결과가 없습니다.'); copySync(md); toast('결과를 복사했습니다.'); };
    $('#downloadReportBtn').onclick = () => { const md = finalMarkdown(); if (!md) return toast('저장할 결과가 없습니다.'); download(`${safeName(state.title || 'fact-check')}.md`, md, 'text/markdown'); };
    $('#exportBtn').onclick = () => download(`${safeName(state.title || 'fact-workbench')}.json`, JSON.stringify(state, null, 2), 'application/json');
    $('#importFile').onchange = async e => {
      const file = e.target.files?.[0]; if (!file) return;
      try { state = { ...blank(), ...JSON.parse(await file.text()) }; save(); render(); toast('작업을 복구했습니다.'); }
      catch { toast('백업 파일을 읽지 못했습니다.'); }
      e.target.value = '';
    };
    $('#resetBtn').onclick = () => {
      if (!confirm('현재 작업을 지우고 새로 시작할까요?')) return;
      state = blank(); save(); render(); toast('새 작업을 시작했습니다.');
    };
  }
  function safeName(s) { return String(s).replace(/[\\/:*?"<>|]/g, '-'); }
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` })); a.download = name; document.body.append(a); a.click(); URL.revokeObjectURL(a.href); a.remove(); }

  bind(); render();
})();
