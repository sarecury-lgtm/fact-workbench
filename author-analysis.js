(() => {
  'use strict';
  const KEY = 'fact-workbench-onepass-v1';
  const DB_NAME = 'fact-workbench-storage';
  const DB_VERSION = 1;
  const STORE_NAME = 'projects';
  const $ = s => document.querySelector(s);
  const arr = v => Array.isArray(v) ? v : (v == null ? [] : [v]);
  const pick = (o, ...keys) => { for (const k of keys) if (o && o[k] != null) return o[k]; return ''; };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const emptyAuthor = () => ({ independentAnswer:'', independent:null, hypothesis:'', comparisonAnswer:'', comparison:null, factSignature:'', stale:false, updatedAt:'' });
  let dbPromise = null;
  let project = null;
  let author = emptyAuthor();
  let originalPut = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }
  async function dbGet() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
  async function dbPut(value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
  function installPutMerge() {
    if (!window.IDBObjectStore || originalPut) return;
    originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, key) {
      if (this.name === STORE_NAME && key === KEY && value && typeof value === 'object' && author) {
        value = { ...value, version: Math.max(Number(value.version) || 0, 4), author };
      }
      return originalPut.call(this, value, key);
    };
  }
  function signature(data) {
    const text = JSON.stringify({
      sourceText: data?.sourceText || '',
      claims: arr(data?.claims).map(c => [c.id, c.text || c.claim, c.verdict, c.confirmedFacts || c.confirmed_facts, c.differences, c.correctedStatement || c.corrected_statement])
    });
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  }
  async function loadProject() {
    project = await dbGet() || {};
    author = Object.assign(emptyAuthor(), project.author || {});
    if (author.independent && author.factSignature && author.factSignature !== signature(project)) author.stale = true;
    return project;
  }
  async function saveAuthor() {
    const latest = await dbGet() || project || {};
    project = { ...latest, version: Math.max(Number(latest.version) || 0, 4), author, updatedAt: new Date().toISOString() };
    await dbPut(project);
  }
  function toast(message) {
    let el = $('#authorAnalysisToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'authorAnalysisToast';
      el.className = 'aa-toast';
      document.body.append(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function fallbackCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  function copy(text) {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    else fallbackCopy(text);
  }
  function handoff(text) {
    copy(text);
    window.open('https://chatgpt.com/', '_blank', 'noopener');
    toast('작업문을 복사했습니다. 새 채팅에서 붙여넣고 전송하세요.');
  }
  function stripFences(text) { return String(text || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim(); }
  function extractBalanced(text) {
    const starts = [text.indexOf('{'), text.indexOf('[')].filter(i => i >= 0);
    if (!starts.length) return '';
    const start = Math.min(...starts), open = text[start], close = open === '{' ? '}' : ']';
    let depth = 0, string = false, escape = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (string) { if (escape) escape = false; else if (ch === '\\') escape = true; else if (ch === '"') string = false; continue; }
      if (ch === '"') { string = true; continue; }
      if (ch === open) depth++;
      else if (ch === close && --depth === 0) return text.slice(start, i + 1);
    }
    return text.slice(start);
  }
  function parseAnswer(raw) {
    const source = extractBalanced(stripFences(raw));
    if (!source) throw new Error('JSON 데이터 부분을 찾지 못했습니다.');
    const attempts = [source, source.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, '$1')];
    let last;
    for (const candidate of attempts) { try { return JSON.parse(candidate); } catch (e) { last = e; } }
    throw new Error(`JSON을 읽지 못했습니다: ${last.message}`);
  }
  function compactFacts(data) {
    return arr(data?.claims).map(c => ({
      id: c.id,
      topic: c.topic,
      original_excerpt: c.originalExcerpt || c.original_excerpt,
      claim: c.text || c.claim,
      verdict: c.verdict,
      confidence: c.confidence,
      confirmed_facts: c.confirmedFacts || c.confirmed_facts,
      unconfirmed_parts: c.unconfirmedParts || c.unconfirmed_parts,
      differences: c.differences,
      corrected_statement: c.correctedStatement || c.corrected_statement,
      sources: arr(c.sources).map(s => ({ title:s.title, url:s.url, supports:s.supports }))
    }));
  }
  function independentPrompt(data) {
    return `아래에는 한 작성자의 전체 댓글 원문과 주장별 팩트 검증 결과가 들어 있다. 지금 바로 독립적으로 분석하라. 사용자의 사전 의견은 주어지지 않았다고 간주한다.

프로젝트: ${data.title || '제목 없음'}

<original_source>
${data.sourceText || ''}
</original_source>

<verified_claims>
${JSON.stringify(compactFacts(data), null, 2)}
</verified_claims>

목표:
이 사람이 사실을 어떻게 선택하고, 큰 결론으로 연결하고, 반론을 처리하고, 자신의 오류를 보호하는지를 자료에서 귀납적으로 해부하라. 성격검사나 정신진단이 아니라 이 대화에서 관찰되는 정보 처리와 논쟁 행동을 분석한다.

가장 중요한 출력 원칙:
오류의 어려운 이름을 붙이는 데서 멈추지 마라. 그 사람이 실제로 무엇을 했는지를 평범한 말로 번역하라. 독자가 전문용어를 몰라도 행동과 문제를 즉시 알아볼 수 있어야 한다.

분석 규칙:
1. 관찰 가능한 행동과 해석을 분리하고, 반드시 원문 발췌와 관련 claim id를 근거로 붙인다.
2. 사실 오류와 논리 비약을 구분한다. 개별 사실이 맞아도 최종 비교 결론을 입증하지 못할 수 있다.
3. 핵심 행동은 서로 다른 근거가 2개 이상일 때만 채택한다.
4. 각 핵심 행동의 메인 제목은 주어와 동사가 살아 있는 평범한 문장으로 쓴다. 예: ‘비교군도 없이 사건 숫자로 비교를 흉내 냈다’, ‘자기가 증명할 주장을 상대에게 전부 반박하라고 떠넘겼다’.
5. 사례 폭격, 선택편향, 입증책임 전가, 골대 이동, 도덕적 인질화 같은 분석 용어는 technical_label에만 보조적으로 적는다. 분석 용어 자체를 설명으로 대신하지 않는다.
6. actual_action에는 작성자가 구체적으로 한 일을 쓴다. argument_effect에는 그 행동이 논쟁의 규칙과 상대에게 어떤 결과를 만들었는지 쓴다.
7. 정확한 사실, 불리한 예외, 반대 근거도 반영한다. 날카로움 때문에 증거를 생략하거나 과장하지 않는다.
8. 고의적 거짓말, 자각, 악의, 내면, 정신질환, 성격장애는 직접 증거 없이는 추정하지 않는다. 의도를 모르면 ‘의도적으로’ 대신 ‘결과적으로 이런 구조를 만들었다’고 쓴다.
9. 문체는 차갑고 직설적으로 쓴다. 확인된 행동을 ‘조금 성급함’, ‘다소 아쉬움’처럼 순화하지 않는다.
10. 욕설·조롱·인신공격은 하지 않는다. 사람 전체의 가치가 아니라 이 글에서 실제로 수행한 행동과 책임을 판정한다.
11. 중심 판정과 최종 해부 앞에서 작성자의 장점이나 부분적 정확성을 의례적으로 다시 칭찬하지 않는다. 이미 인정한 사실은 그 사실을 어떻게 사용했는지 설명할 때만 언급한다.
12. ‘다만’, ‘물론’, ‘허구만 말하는 사람은 아니다’ 같은 자동 완충 문장을 습관적으로 붙이지 않는다. 실제 판단 한계가 있을 때만 제한을 별도 항목에 적는다.
13. 가장 중요한 행동은 정확히 3개만 순위를 매긴다.
14. 최종 문단은 설명을 반복하는 요약이 아니라 책임 판정이어야 한다. 마지막 한 문장은 전체 구조를 기억에 남는 평범한 말로 압축한다.

반드시 아래 JSON 객체 하나만 출력하라. 코드블록과 앞뒤 설명은 금지한다.
{
  "target_conclusion": {"claim":"궁극적으로 입증하려는 결론","verified_support":"자료가 실제 지지하는 범위","gap":"결론까지 남는 공백"},
  "core_assessment": {"summary":"결론부터 시작하는 중심 판정","one_sentence":"평범한 말로 압축한 한 문장 판정"},
  "top_patterns": [
    {"rank":1,"action_title":"실제로 한 일을 주어와 동사가 있는 평범한 문장으로 쓴 제목","technical_label":"보조 분석명. 예: 사례 폭격 · 선택편향","actual_action":"작성자가 구체적으로 한 행동","argument_effect":"그 행동이 논쟁에서 만든 결과","evidence":[{"excerpt":"원문 발췌","claim_ids":["C1"],"fact_connection":"팩트 결과와 연결"}],"counterevidence_or_exception":"반대 근거나 예외, 없으면 없음","alternative_explanation":"자료가 지지하는 다른 설명, 없으면 없음","confidence":"낮음|중간|높음"}
  ],
  "evidence_handling": {"selection":"자료를 무엇만 골라 썼는지 평범한 말로 설명","inference":"사실에서 결론으로 실제 어떻게 넘어갔는지 설명","standards":"자기 주장과 반론에 어떤 다른 기준을 적용했는지 설명","correction_response":"오류 지적을 받았을 때 실제로 무엇을 했는지 설명"},
  "rebuttal_handling": [{"mechanism":"평범한 말로 쓴 행동","evidence":"원문 근거","effect":"상대와 논쟁 규칙에 만든 결과"}],
  "strongest_evidence": [{"title":"결정적 장면","excerpt":"원문 발췌","claim_ids":["C1"],"why_decisive":"왜 중심 판정을 지지하는지"}],
  "limits": ["자료만으로 판단할 수 없는 부분"],
  "cold_assessment": {"paragraph":"결론부터 시작하고 실제 행동에 책임을 귀속하는 냉정하고 직설적인 최종 해부","one_line":"전문용어 없이 가장 정확하고 날카로운 한 문장"}
}`;
  }
  function comparisonPrompt(data) {
    return `앞선 독립 분석과 동일한 원자료를 기준으로 사용자의 가설을 별도로 평가하라. 앞선 독립 분석을 사용자의 의견에 맞게 수정하지 마라.

프로젝트: ${data.title || '제목 없음'}

<independent_analysis>
${JSON.stringify(author.independent, null, 2)}
</independent_analysis>

<user_hypothesis>
${author.hypothesis}
</user_hypothesis>

핵심 원칙:
사용자의 표현을 단순히 더 점잖은 학술용어로 바꾸지 마라. 가설에서 실제 자료가 지지하는 부분을 ‘이 사람이 실제로 무엇을 했는가’라는 평범한 행동 문장으로 다시 써라.

규칙:
1. 사용자의 기분에 맞추지 말고 원문·팩트 결과·독립 분석과의 일치 여부만 본다.
2. 가설이 맞는 부분, 지나친 부분, 충돌하는 자료를 분리한다.
3. 사람 전체의 본질이나 일반 지능이 아니라 이 댓글에서 실제로 드러난 정보 처리와 논쟁 행동으로 한정한다.
4. ‘선택편향이 있다’에서 멈추지 말고 ‘결론에 맞는 사건만 골랐고 비교에 필요한 반대 표본은 찾지 않았다’처럼 행동을 풀어 쓴다.
5. 근거가 강하면 불필요하게 완곡하게 쓰지 않는다. 반대로 자료가 없는 악의·고의·자각·위선은 단정하지 않는다.
6. 최종 문단은 결론부터 시작한다. 의례적인 칭찬이나 ‘다만’, ‘물론’ 같은 자동 완충 문장으로 칼끝을 무디게 하지 않는다.
7. 마지막 한 문장은 전문용어가 아니라 누구나 알아볼 수 있는 행동 언어로 압축한다.
8. JSON 객체 하나만 출력하고 코드블록과 설명은 금지한다.

{
  "supported_parts":[{"point":"가설에서 지지되는 부분을 실제 행동으로 번역한 문장","evidence":"근거","claim_ids":["C1"]}],
  "overstated_parts":[{"point":"과장·단순화된 부분","reason":"이유"}],
  "conflicting_evidence":[{"point":"가설과 충돌하는 자료","meaning":"그 자료가 뜻하는 제한"}],
  "refined_assessment":{"paragraph":"결론부터 시작하고 실제 행동을 평범한 말로 판정한 최종 해석","one_line":"전문용어 없이 압축한 한 문장"},
  "confidence":"낮음|중간|높음",
  "what_would_change_the_judgment":["판단을 바꾸거나 약화할 추가 자료"]
}`;
  }
  function normalizeIndependent(d = {}) {
    return {
      targetConclusion: pick(d, 'target_conclusion', 'targetConclusion') || {},
      coreAssessment: pick(d, 'core_assessment', 'coreAssessment') || {},
      topPatterns: arr(pick(d, 'top_patterns', 'topPatterns')),
      evidenceHandling: pick(d, 'evidence_handling', 'evidenceHandling') || {},
      rebuttalHandling: arr(pick(d, 'rebuttal_handling', 'rebuttalHandling')),
      strongestEvidence: arr(pick(d, 'strongest_evidence', 'strongestEvidence')),
      limits: arr(d.limits),
      coldAssessment: pick(d, 'cold_assessment', 'coldAssessment') || {}
    };
  }
  function normalizeComparison(d = {}) {
    return {
      supportedParts: arr(pick(d, 'supported_parts', 'supportedParts')),
      overstatedParts: arr(pick(d, 'overstated_parts', 'overstatedParts')),
      conflictingEvidence: arr(pick(d, 'conflicting_evidence', 'conflictingEvidence')),
      refinedAssessment: pick(d, 'refined_assessment', 'refinedAssessment') || {},
      confidence: pick(d, 'confidence'),
      whatWouldChange: arr(pick(d, 'what_would_change_the_judgment', 'whatWouldChange'))
    };
  }
  function inject() {
    if ($('#authorAnalysisPanel')) return;
    const style = document.createElement('style');
    style.textContent = `
      .steps{grid-template-columns:repeat(4,minmax(0,1fr))!important}.aa-panel{display:none}.aa-panel.active{display:block}
      .aa-intro{padding:17px 18px;border:1px solid #c8cdd6;border-radius:13px;background:#f7f7f8;margin-bottom:18px}.aa-intro strong{display:block;margin-bottom:7px}.aa-intro p{margin:0;color:#505661;line-height:1.6}
      .aa-stage{border:1px solid var(--line);border-radius:13px;padding:18px;margin:18px 0;background:#fff}.aa-stage.dark-edge{border-color:#aeb3bd}.aa-head{display:flex;justify-content:space-between;gap:15px;align-items:flex-start}.aa-head h3{margin:3px 0 6px}.aa-head p{margin:0;color:var(--muted);font-size:13px;line-height:1.55}
      .aa-number{display:inline-flex;width:27px;height:27px;border-radius:50%;align-items:center;justify-content:center;background:#252a32;color:#fff;font-size:12px;font-weight:800}.aa-status{font-size:12px;font-weight:750;color:var(--muted);background:var(--gray-soft);padding:7px 10px;border-radius:999px;white-space:nowrap}.aa-status.done{color:var(--green);background:var(--green-soft)}.aa-status.stale{color:var(--amber);background:var(--amber-soft)}
      .aa-dark{background:#252a32!important;color:#fff!important}.aa-result{display:grid;gap:13px;margin-top:18px}.aa-card{border:1px solid var(--line);border-radius:12px;padding:16px;background:#fff}.aa-card.core{border-color:#9ca3af;background:#f7f7f8}.aa-card.cold{border-color:#565b64;background:#292d34;color:#fff}.aa-card h4{margin:0 0 8px;font-size:15px}.aa-card p{margin:0;white-space:pre-wrap;line-height:1.65}.aa-card.cold .aa-muted{color:#cfd3da}.aa-muted{color:var(--muted)}
      .aa-patterns{display:grid;gap:11px}.aa-pattern{border:1px solid var(--line);border-radius:11px;padding:14px}.aa-pattern h5{margin:0 0 6px;font-size:14px}.aa-rank{display:inline-flex;min-width:25px;height:25px;align-items:center;justify-content:center;border-radius:50%;background:#252a32;color:#fff;margin-right:7px;font-size:12px}.aa-list{padding-left:20px;margin:9px 0 0}.aa-list li{margin:7px 0;line-height:1.55}.aa-chip{display:inline-flex;border-radius:999px;background:var(--gray-soft);padding:5px 8px;font-size:11px;color:#555d69;margin:8px 5px 0 0}
      .aa-stale{border:1px solid #edcd85;background:#fff8e8;color:#765009;border-radius:10px;padding:12px 14px;margin:12px 0;line-height:1.5}.aa-prompt-box{margin-top:14px;border:1px solid #9ca3af;background:#f7f7f8}.aa-prompt-box textarea[readonly]{background:#fff;min-height:190px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:1.55}.aa-hypothesis{background:#f8f8f9;border:1px solid var(--line);border-radius:11px;padding:14px;margin-top:14px}.aa-hypothesis textarea{min-height:110px}.aa-comparison{display:grid;grid-template-columns:1fr 1fr;gap:11px}.aa-comparison .aa-card:last-child{grid-column:1/-1}.aa-empty{color:var(--muted);text-align:center;padding:30px}.aa-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,15px);opacity:0;pointer-events:none;background:#20242b;color:#fff;padding:10px 14px;border-radius:9px;font-size:13px;transition:.18s;z-index:40;max-width:calc(100vw - 32px)}.aa-toast.show{opacity:1;transform:translate(-50%,0)}
      @media(max-width:760px){.aa-comparison{grid-template-columns:1fr}.aa-comparison .aa-card:last-child{grid-column:auto}}
    `;
    document.head.append(style);
    const nav = $('.steps');
    const navButton = document.createElement('button');
    navButton.id = 'authorAnalysisNav';
    navButton.type = 'button';
    navButton.innerHTML = '<b>4</b><span>작성자 해부</span>';
    nav.append(navButton);
    const panel = document.createElement('section');
    panel.id = 'authorAnalysisPanel';
    panel.className = 'panel aa-panel';
    panel.innerHTML = `
      <div class='panel-title'><div><span class='eyebrow'>4단계 · 메인 분석</span><h2>작성자가 실제로 무엇을 했는지 벗겨냅니다</h2><p>팩트 판정은 그대로 둡니다. 어려운 오류명을 나열하는 대신, 원문과 검증 결과를 근거로 작성자가 실제로 한 일을 평범한 말로 보여줍니다.</p></div><div id='aaProgress' class='progress-pill'>독립 분석 전</div></div>
      <div class='aa-intro'><strong>분석은 기계적으로, 행동은 누구나 알아볼 말로</strong><p>전문용어는 보조로만 남깁니다. 메인 판정은 “비교를 흉내 냈다”, “증명 책임을 떠넘겼다”, “반박하면 나쁜 사람이 되게 만들었다”처럼 실제 행동으로 씁니다.</p></div>
      <div id='aaStale' class='aa-stale hidden'>팩트 검증 결과가 독립 분석 이후 바뀌었습니다. 기존 해부는 보존되어 있으며, 현재 자료로 다시 실행할 수 있습니다.</div>
      <section class='aa-stage dark-edge'><div class='aa-head'><div><span class='aa-number'>1</span><h3>독립 해부</h3><p>사용자 의견 없이 원문과 팩트 결과만 보냅니다. 가장 중요한 행동 세 개를 평범한 말로 뽑고 책임을 판정합니다.</p></div><span id='aaIndependentStatus' class='aa-status'>미실행</span></div><div class='row-actions'><button id='aaSendIndependent' class='button aa-dark' type='button'>독립 해부 작업문 만들기</button><button id='aaClearIndependent' class='button quiet' type='button'>독립 결과만 지우기</button></div><div id='aaIndependentPromptBox' class='return-box aa-prompt-box hidden'><label class='field'><span>1. 아래 작업문을 복사하세요</span><textarea id='aaIndependentPrompt' rows='10' readonly placeholder='위 버튼을 누르면 작업문이 여기에 나타납니다.'></textarea></label><div class='row-actions'><button id='aaCopyIndependentPrompt' class='button aa-dark' type='button'>작업문 복사</button><button id='aaOpenIndependentChat' class='button quiet' type='button'>2. ChatGPT 열기</button><span class='hint'>ChatGPT에서 붙여넣고 전송한 뒤, 답변 JSON을 아래 칸에 붙여넣으세요.</span></div></div><div class='return-box'><textarea id='aaIndependentAnswer' rows='12' placeholder='3. ChatGPT의 JSON 답변 전체를 여기에 붙여넣으세요'></textarea><div class='row-actions'><button id='aaApplyIndependent' class='button aa-dark' type='button'>독립 해부 반영</button><span id='aaIndependentHint' class='hint'></span></div></div><div id='aaIndependentResult' class='aa-result aa-empty'>아직 독립 해부 결과가 없습니다.</div></section>
      <section class='aa-stage'><div class='aa-head'><div><span class='aa-number'>2</span><h3>내 해석과 대조</h3><p>독립 결과가 나온 뒤에만 내 가설을 공개합니다. AI가 맞는 부분과 과장을 따로 판정합니다.</p></div><span id='aaComparisonStatus' class='aa-status'>미실행</span></div><div class='aa-hypothesis'><label class='field'><span>내가 보는 이 사람의 핵심</span><textarea id='aaHypothesis' placeholder='예: 보고 싶은 사실만 모은 뒤, 자료의 양을 자기 결론의 정확성으로 착각하는 사람 같다.'></textarea></label><div class='row-actions'><button id='aaSendComparison' class='button primary' type='button'>대조 작업문 만들기</button><button id='aaClearComparison' class='button quiet' type='button'>대조 결과만 지우기</button></div></div><div id='aaComparisonPromptBox' class='return-box aa-prompt-box hidden'><label class='field'><span>1. 아래 대조 작업문을 복사하세요</span><textarea id='aaComparisonPrompt' rows='10' readonly placeholder='위 버튼을 누르면 작업문이 여기에 나타납니다.'></textarea></label><div class='row-actions'><button id='aaCopyComparisonPrompt' class='button primary' type='button'>작업문 복사</button><button id='aaOpenComparisonChat' class='button quiet' type='button'>2. ChatGPT 열기</button><span class='hint'>ChatGPT에서 붙여넣고 전송한 뒤, 답변 JSON을 아래 칸에 붙여넣으세요.</span></div></div><div class='return-box'><textarea id='aaComparisonAnswer' rows='10' placeholder='3. ChatGPT의 JSON 답변 전체를 여기에 붙여넣으세요'></textarea><div class='row-actions'><button id='aaApplyComparison' class='button primary' type='button'>대조 결과 반영</button><span id='aaComparisonHint' class='hint'></span></div></div><div id='aaComparisonResult' class='aa-result aa-empty'>아직 가설 대조 결과가 없습니다.</div></section>
      <section class='data-export'><div class='data-export-head'><div><h3>해부 결과 내보내기</h3><p>근거판과 냉정한 최종 해부를 함께 저장합니다.</p></div></div><div class='row-actions'><button id='aaCopy' class='button aa-dark' type='button'>해부 결과 복사</button><button id='aaDownloadMd' class='button quiet' type='button'>Markdown 저장</button><button id='aaDownloadJson' class='button quiet' type='button'>JSON 저장</button></div></section>
    `;
    $('main').append(panel);
    navButton.addEventListener('click', async () => {
      await loadProject();
      document.querySelectorAll('.steps button').forEach(b => b.classList.toggle('active', b === navButton));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      panel.classList.add('active');
      render();
      window.scrollTo({top:0,behavior:'smooth'});
    });
    document.querySelectorAll('.steps button:not(#authorAnalysisNav)').forEach(b => b.addEventListener('click', () => panel.classList.remove('active')));
    bind();
  }
  function renderIndependent(ind) {
    const el = $('#aaIndependentResult');
    if (!ind) { el.className = 'aa-result aa-empty'; el.textContent = '아직 독립 해부 결과가 없습니다.'; return; }
    const tc = ind.targetConclusion || {}, core = ind.coreAssessment || {}, eh = ind.evidenceHandling || {}, cold = ind.coldAssessment || {};
    el.className = 'aa-result';
    el.innerHTML = `
      <article class='aa-card core'><h4>결론부터</h4><p>${esc(core.summary || '')}</p>${core.one_sentence ? `<p class='aa-muted' style='margin-top:10px'><b>${esc(core.one_sentence)}</b></p>` : ''}</article>
      <article class='aa-card'><h4>주장한 것과 실제 자료가 증명한 것</h4><p><b>작성자가 내린 결론</b>\n${esc(tc.claim || '')}\n\n<b>자료가 실제로 보여주는 범위</b>\n${esc(tc.verified_support || '')}\n\n<b>증명하지 못한 부분</b>\n${esc(tc.gap || '')}</p></article>
      <section class='aa-card'><h4>실제로 한 행동 3개</h4><div class='aa-patterns'>${ind.topPatterns.map(p => {
        const title = p.action_title || p.actionTitle || p.name || '행동 판정';
        const technical = p.technical_label || p.technicalLabel || '';
        const action = p.actual_action || p.actualAction || p.plain_description || '';
        const effect = p.argument_effect || p.argumentEffect || p.argument_function || '';
        return `<article class='aa-pattern'><h5><span class='aa-rank'>${esc(p.rank)}</span>${esc(title)}</h5>${technical ? `<p class='aa-muted' style='font-size:12px;margin:0 0 9px'><b>분석명:</b> ${esc(technical)}</p>` : ''}<p>${esc(action)}</p><p class='aa-muted' style='margin-top:9px'><b>결과:</b> ${esc(effect)}</p>${arr(p.evidence).length ? `<ol class='aa-list'>${arr(p.evidence).map(e => `<li>“${esc(e.excerpt || '')}”<br><span class='aa-muted'>${esc(arr(e.claim_ids).join(', '))}${e.fact_connection ? ` · ${esc(e.fact_connection)}` : ''}</span></li>`).join('')}</ol>` : ''}<span class='aa-chip'>확신도 ${esc(p.confidence || '')}</span></article>`;
      }).join('')}</div></section>
      <article class='aa-card'><h4>자료를 실제로 다룬 방식</h4><p><b>무엇을 골랐나</b>\n${esc(eh.selection || '')}\n\n<b>어떻게 결론으로 바꿨나</b>\n${esc(eh.inference || '')}\n\n<b>자기와 상대에게 같은 기준을 썼나</b>\n${esc(eh.standards || '')}\n\n<b>틀린 점을 지적받았을 때 무엇을 했나</b>\n${esc(eh.correction_response || '')}</p></article>
      ${ind.strongestEvidence.length ? `<article class='aa-card'><h4>이 판정을 피하기 어려운 장면</h4><ol class='aa-list'>${ind.strongestEvidence.map(e => `<li><b>${esc(e.title || '')}</b><br>“${esc(e.excerpt || '')}”<br><span class='aa-muted'>${esc(arr(e.claim_ids).join(', '))} · ${esc(e.why_decisive || '')}</span></li>`).join('')}</ol></article>` : ''}
      <article class='aa-card cold'><h4>최종 판정</h4><p>${esc(cold.paragraph || '')}</p>${cold.one_line ? `<p class='aa-muted' style='margin-top:13px'><b>${esc(cold.one_line)}</b></p>` : ''}</article>
      ${ind.limits.length ? `<article class='aa-card'><h4>여기까지는 단정할 수 없음</h4><ul class='aa-list'>${ind.limits.map(x => `<li>${esc(x)}</li>`).join('')}</ul></article>` : ''}
    `;
  }
  function renderComparison(cmp) {
    const el = $('#aaComparisonResult');
    if (!cmp) { el.className = 'aa-result aa-empty'; el.textContent = '아직 가설 대조 결과가 없습니다.'; return; }
    const r = cmp.refinedAssessment || {};
    const card = (title, items) => `<article class='aa-card'><h4>${title}</h4>${items.length ? `<ul class='aa-list'>${items.map(x => `<li>${esc(x.point || '')}${x.evidence ? `<br><span class='aa-muted'>${esc(x.evidence)} ${arr(x.claim_ids).length ? `· ${esc(arr(x.claim_ids).join(', '))}` : ''}</span>` : ''}${x.reason ? `<br><span class='aa-muted'>${esc(x.reason)}</span>` : ''}${x.meaning ? `<br><span class='aa-muted'>${esc(x.meaning)}</span>` : ''}</li>`).join('')}</ul>` : `<p class='aa-muted'>없음</p>`}</article>`;
    el.className = 'aa-result aa-comparison';
    el.innerHTML = card('가설이 맞는 부분', cmp.supportedParts) + card('과장되거나 단순한 부분', cmp.overstatedParts) + card('가설과 충돌하는 자료', cmp.conflictingEvidence) + `<article class='aa-card cold'><h4>더 정확한 표현 · 확신도 ${esc(cmp.confidence || '')}</h4><p>${esc(r.paragraph || '')}</p>${r.one_line ? `<p class='aa-muted' style='margin-top:13px'><b>${esc(r.one_line)}</b></p>` : ''}</article>`;
  }
  function render() {
    $('#aaIndependentAnswer').value = author.independentAnswer || '';
    $('#aaHypothesis').value = author.hypothesis || '';
    $('#aaComparisonAnswer').value = author.comparisonAnswer || '';
    $('#aaStale').classList.toggle('hidden', !author.stale);
    $('#aaIndependentStatus').textContent = author.independent ? (author.stale ? '기존 결과 · 자료 변경' : '완료') : '미실행';
    $('#aaIndependentStatus').className = `aa-status ${author.independent ? (author.stale ? 'stale' : 'done') : ''}`;
    $('#aaComparisonStatus').textContent = author.comparison ? '완료' : '미실행';
    $('#aaComparisonStatus').className = `aa-status ${author.comparison ? 'done' : ''}`;
    $('#aaProgress').textContent = author.independent ? (author.comparison ? '독립·대조 완료' : '독립 분석 완료') : '독립 분석 전';
    renderIndependent(author.independent);
    renderComparison(author.comparison);
  }
  function analysisMarkdown() {
    const ind = author.independent, cmp = author.comparison;
    const lines = [`# ${project?.title || '작성자 해부'}`, '', '## 사용자 가설', author.hypothesis || '없음'];
    if (ind) {
      lines.push('', '## 독립 해부', '', '### 결론부터', '', ind.coreAssessment?.summary || '', '', `**한 문장:** ${ind.coreAssessment?.one_sentence || ''}`, '', '### 실제로 한 행동 3개');
      ind.topPatterns.forEach(p => {
        const title = p.action_title || p.actionTitle || p.name || '행동 판정';
        const technical = p.technical_label || p.technicalLabel || '';
        const action = p.actual_action || p.actualAction || p.plain_description || '';
        const effect = p.argument_effect || p.argumentEffect || p.argument_function || '';
        lines.push('', `#### ${p.rank}. ${title}`);
        if (technical) lines.push(`- 분석명: ${technical}`);
        lines.push(action, `- 결과: ${effect}`, `- 확신도: ${p.confidence || ''}`);
        arr(p.evidence).forEach(e => lines.push(`- 근거: “${e.excerpt || ''}” (${arr(e.claim_ids).join(', ')}) ${e.fact_connection || ''}`));
      });
      lines.push('', '### 최종 판정', '', ind.coldAssessment?.paragraph || '', '', `**한 문장:** ${ind.coldAssessment?.one_line || ''}`);
    }
    if (cmp) lines.push('', '## 사용자 가설 대조', '', cmp.refinedAssessment?.paragraph || '', '', `**한 문장:** ${cmp.refinedAssessment?.one_line || ''}`, `**확신도:** ${cmp.confidence || ''}`);
    return lines.join('\n');
  }
  function download(name, text, type = 'text/plain') {
    const url = URL.createObjectURL(new Blob([text], {type:`${type};charset=utf-8`}));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function safeName(v) { return String(v || 'fact-workbench').replace(/[\\/:*?"<>|]/g, '-'); }
  function bind() {
    $('#aaIndependentAnswer').addEventListener('input', e => { author.independentAnswer = e.target.value; });
    $('#aaHypothesis').addEventListener('input', e => { author.hypothesis = e.target.value; saveAuthor().catch(() => {}); });
    $('#aaComparisonAnswer').addEventListener('input', e => { author.comparisonAnswer = e.target.value; });
    $('#aaSendIndependent').onclick = async () => {
      await loadProject();
      if (!project.sourceText?.trim()) return toast('원문이 없습니다.');
      if (!arr(project.claims).length) return toast('먼저 팩트 검증 결과를 반영하세요.');
      const prompt = independentPrompt(project);
      $('#aaIndependentPrompt').value = prompt;
      $('#aaIndependentPromptBox').classList.remove('hidden');
      $('#aaIndependentPrompt').focus();
      $('#aaIndependentPrompt').select();
      toast('작업문을 만들었습니다. 아래에서 복사한 뒤 ChatGPT에 붙여넣으세요.');
    };
    $('#aaCopyIndependentPrompt').onclick = () => {
      const prompt = $('#aaIndependentPrompt').value;
      if (!prompt) return toast('먼저 독립 해부 작업문을 만드세요.');
      copy(prompt);
      toast('작업문을 복사했습니다.');
    };
    $('#aaOpenIndependentChat').onclick = () => window.open('https://chatgpt.com/', '_blank', 'noopener');
    $('#aaApplyIndependent').onclick = async () => {
      const hint = $('#aaIndependentHint');
      try {
        const n = normalizeIndependent(parseAnswer($('#aaIndependentAnswer').value));
        if (!n.coldAssessment?.paragraph && !n.coreAssessment?.summary) throw new Error('독립 해부 핵심 결과를 찾지 못했습니다.');
        author.independentAnswer = $('#aaIndependentAnswer').value;
        author.independent = n;
        author.factSignature = signature(project);
        author.stale = false;
        author.comparisonAnswer = '';
        author.comparison = null;
        author.updatedAt = new Date().toISOString();
        await saveAuthor(); render();
        hint.textContent = '독립 해부를 반영했습니다.'; hint.className = 'hint success';
      } catch (e) { hint.textContent = e.message; hint.className = 'hint error'; }
    };
    $('#aaClearIndependent').onclick = async () => {
      if (!confirm('독립 해부와 연결된 대조 결과를 지울까요?')) return;
      author.independentAnswer = ''; author.independent = null; author.comparisonAnswer = ''; author.comparison = null; author.factSignature = ''; author.stale = false;
      await saveAuthor(); render(); toast('독립 해부 결과를 지웠습니다.');
    };
    $('#aaSendComparison').onclick = async () => {
      author.hypothesis = $('#aaHypothesis').value.trim();
      if (!author.independent) return toast('먼저 독립 해부를 반영하세요.');
      if (!author.hypothesis) return toast('내 해석을 먼저 입력하세요.');
      await saveAuthor();
      const prompt = comparisonPrompt(project);
      $('#aaComparisonPrompt').value = prompt;
      $('#aaComparisonPromptBox').classList.remove('hidden');
      $('#aaComparisonPrompt').focus();
      $('#aaComparisonPrompt').select();
      toast('대조 작업문을 만들었습니다. 아래에서 복사하세요.');
    };
    $('#aaCopyComparisonPrompt').onclick = () => {
      const prompt = $('#aaComparisonPrompt').value;
      if (!prompt) return toast('먼저 대조 작업문을 만드세요.');
      copy(prompt);
      toast('대조 작업문을 복사했습니다.');
    };
    $('#aaOpenComparisonChat').onclick = () => window.open('https://chatgpt.com/', '_blank', 'noopener');
    $('#aaApplyComparison').onclick = async () => {
      const hint = $('#aaComparisonHint');
      try {
        const n = normalizeComparison(parseAnswer($('#aaComparisonAnswer').value));
        if (!n.refinedAssessment?.paragraph && !n.supportedParts.length) throw new Error('가설 대조 핵심 결과를 찾지 못했습니다.');
        author.comparisonAnswer = $('#aaComparisonAnswer').value;
        author.comparison = n;
        author.updatedAt = new Date().toISOString();
        await saveAuthor(); render();
        hint.textContent = '가설 대조를 반영했습니다.'; hint.className = 'hint success';
      } catch (e) { hint.textContent = e.message; hint.className = 'hint error'; }
    };
    $('#aaClearComparison').onclick = async () => { author.comparisonAnswer = ''; author.comparison = null; await saveAuthor(); render(); toast('대조 결과를 지웠습니다.'); };
    $('#aaCopy').onclick = () => { if (!author.independent) return toast('해부 결과가 없습니다.'); copy(analysisMarkdown()); toast('해부 결과를 복사했습니다.'); };
    $('#aaDownloadMd').onclick = () => { if (!author.independent) return toast('해부 결과가 없습니다.'); download(`${safeName(project?.title)}-작성자해부.md`, analysisMarkdown(), 'text/markdown'); };
    $('#aaDownloadJson').onclick = () => { if (!author.independent) return toast('해부 결과가 없습니다.'); download(`${safeName(project?.title)}-작성자해부.json`, JSON.stringify(author, null, 2), 'application/json'); };
    const exportButton = $('#exportBtn');
    if (exportButton) exportButton.addEventListener('click', async e => {
      e.preventDefault(); e.stopImmediatePropagation();
      const latest = await dbGet() || project || {};
      download(`${safeName(latest.title)}-backup.json`, JSON.stringify({...latest, version:Math.max(Number(latest.version)||0,4), author}, null, 2), 'application/json');
    }, true);
    const reset = $('#resetBtn');
    if (reset) reset.addEventListener('click', () => setTimeout(async () => { project = await dbGet() || {}; author = Object.assign(emptyAuthor(), project.author || {}); render(); }, 400));
  }
  installPutMerge();
  const start = async () => { inject(); await loadProject(); render(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();
