from pathlib import Path
import re

js_path = Path('author-analysis.js')
text = js_path.read_text(encoding='utf-8')

independent_function = r'''  function independentPrompt(data) {
    return `아래에는 한 작성자의 전체 댓글 원문과 주장별 팩트 검증 결과가 들어 있다. 지금 바로 독립적으로 분석하라. 사용자의 사전 의견은 주어지지 않았다고 간주한다.

프로젝트: ${data.title || '제목 없음'}

<original_source>
${data.sourceText || ''}
</original_source>

<verified_claims>
${JSON.stringify(compactFacts(data), null, 2)}
</verified_claims>

목표:
이 사람이 사실을 어떻게 선택하고, 큰 결론으로 연결하고, 반론을 처리하는지를 자료에서 귀납적으로 해부하라. 성격검사나 정신진단이 아니라 이 대화에서 관찰되는 정보 처리와 논쟁 행동을 분석한다.

최우선 원칙:
아픈 문장을 먼저 정한 뒤 근거를 붙이지 마라. 먼저 확인된 행동을 복원하고, 그 행동이 만든 직접 결과를 설명한 뒤, 그로부터 피하기 어려운 판정까지만 밀어붙여라. 팩폭은 목표가 아니라 정확한 분석의 부산물이어야 한다. 근거가 충분한 판정을 중립적으로 보이기 위해 약화하지도 말고, 타격감을 위해 근거보다 세게 말하지도 마라.

분석 규칙:
1. 모든 핵심 문제를 네 층으로 분리한다.
   - observed_action: 원문과 검증 결과에서 직접 확인되는 행동
   - immediate_effect: 그 행동이 논증과 상대에게 만든 직접 결과
   - warranted_judgment: 앞의 사실들에서 강하게 따라오는 가장 강한 판정
   - unwarranted_extension: 여기서 더 나가면 의도·내면·사람 전체에 대한 추정이 되는 부분
2. observed_action과 evidence는 사실 보고처럼 써야 한다. 작성자가 실제로 하지 않은 행동이나 속마음을 추가하지 않는다.
3. warranted_judgment는 단순 오류명이나 ‘증명하지 못했다’에서 멈추지 말고, 무엇을 어떤 방식으로 했기 때문에 결론이 무너지는지 판정한다.
4. 핵심 행동은 서로 다른 근거가 2개 이상일 때만 채택하고 정확히 3개만 순위를 매긴다.
5. 메인 제목은 주어와 동사가 살아 있는 평범한 문장으로 쓴다. 예: ‘비교군도 없이 사건 숫자로 비교를 한 것처럼 만들었다’.
6. 사례 폭격, 선택편향, 입증책임 전가 같은 용어는 technical_label에만 보조적으로 적는다.
7. 정확한 사실, 불리한 예외, 반대 근거도 반영한다. 개별 사실이 맞아도 더 큰 비교 결론을 입증하지 못할 수 있다.
8. 고의적 거짓말, 자각, 악의, 지능, 성격, 정신질환, 사람 전체의 본질은 직접 증거 없이는 단정하지 않는다. ‘찾지 않았다’보다 ‘이 글에는 찾아 시험한 흔적이 없다’처럼 자료 범위를 명시한다.
9. central_contradiction에서는 작성자가 스스로 내세운 기준이나 태도와 실제로 확인된 행동이 충돌할 때만 모순을 판정한다. 원문에 없는 자기인식은 만들어내지 않는다.
10. 문체는 차갑고 직설적으로 쓰되 욕설·조롱·인신공격은 하지 않는다. 확인된 행동을 ‘다소 아쉬움’처럼 순화하지 않는다.
11. 최종 판정은 observed_action과 warranted_judgment만으로 작성한다. unwarranted_extension의 내용을 최종 판정에 섞지 않는다.
12. 마지막 한 문장은 재치보다 정확성을 우선한다. 읽는 사람이 아프다고 느낀다면 빠져나갈 근거가 없기 때문에 아파야 한다.
13. ‘다만’, ‘물론’ 같은 자동 완충 문장은 실제 판단 한계를 밝힐 때만 쓴다.
14. 사용자에게 유리한 결론을 만들지 말고, 독립적으로 같은 자료에서 반복 도출될 결론을 작성한다.

반드시 아래 JSON 객체 하나만 출력하라. 코드블록과 앞뒤 설명은 금지한다.
{
  "target_conclusion": {"claim":"궁극적으로 입증하려는 결론","verified_support":"자료가 실제 지지하는 범위","gap":"결론까지 남는 공백"},
  "core_assessment": {"summary":"확인된 행동에서 출발한 중심 판정","one_sentence":"근거보다 약하지도 강하지도 않은 한 문장"},
  "top_patterns": [
    {
      "rank":1,
      "action_title":"실제로 한 일을 주어와 동사가 있는 평범한 문장으로 쓴 제목",
      "technical_label":"보조 분석명",
      "observed_action":"원문과 검증 결과에서 직접 확인된 행동",
      "immediate_effect":"그 행동이 논증과 상대에게 만든 직접 결과",
      "warranted_judgment":"확인된 행동에서 강하게 따라오는 가장 강한 판정",
      "unwarranted_extension":"여기서 더 나가면 근거 없는 의도·내면·사람 전체 추정이 되는 부분",
      "evidence":[{"excerpt":"원문 발췌","claim_ids":["C1"],"fact_connection":"팩트 결과와 연결"}],
      "counterevidence_or_exception":"반대 근거나 예외, 없으면 없음",
      "alternative_explanation":"자료가 지지하는 다른 설명, 없으면 없음",
      "confidence":"낮음|중간|높음"
    }
  ],
  "central_contradiction": {
    "self_presentation":"원문에서 작성자가 내세운 기준·태도·자기 주장",
    "actual_behavior":"그와 대조되는 직접 확인된 행동",
    "contradiction":"둘이 정확히 어떻게 충돌하는지. 충돌이 없으면 없음",
    "evidence":[{"excerpt":"원문 발췌","claim_ids":["C1"]}],
    "confidence":"낮음|중간|높음"
  },
  "evidence_handling": {"selection":"무엇을 골랐는지","inference":"사실에서 결론으로 어떻게 넘어갔는지","standards":"자기 주장과 반론에 같은 기준을 썼는지","correction_response":"오류 지적 뒤 실제로 무엇을 했는지"},
  "rebuttal_handling": [{"mechanism":"평범한 행동 문장","evidence":"원문 근거","effect":"논쟁 규칙에 만든 결과"}],
  "strongest_evidence": [{"title":"결정적 장면","excerpt":"원문 발췌","claim_ids":["C1"],"why_decisive":"왜 중심 판정을 지지하는지"}],
  "limits": ["자료만으로 판단할 수 없는 부분"],
  "cold_assessment": {"paragraph":"확인된 행동과 피하기 어려운 판정만 연결한 최종 책임 판정","one_line":"전문용어 없이 가장 정확하고 날카로운 한 문장"}
}`;
  }
'''

comparison_function = r'''  function comparisonPrompt(data) {
    return `앞선 독립 분석과 동일한 원자료를 기준으로 사용자의 가설을 별도로 평가하라. 앞선 독립 분석을 사용자의 의견에 맞게 수정하지 마라.

프로젝트: ${data.title || '제목 없음'}

<independent_analysis>
${JSON.stringify(author.independent, null, 2)}
</independent_analysis>

<user_hypothesis>
${author.hypothesis}
</user_hypothesis>

최우선 원칙:
사용자가 보고 싶어 하는 아픈 문장을 만들어 주지 마라. 가설의 각 부분이 확인된 행동에서 실제로 따라오는지 검사하라. 가설보다 더 강한 결론이 자료에서 독립적으로 입증되면 분명히 말하되, 의도·지능·성격처럼 자료를 넘어가는 부분은 잘라낸다.

규칙:
1. 사용자의 기분이 아니라 원문·팩트 결과·독립 분석과의 일치 여부만 본다.
2. 가설과 일치하는 부분, 가설보다 더 강하게 확인된 부분, 가설이 증거를 넘어간 부분, 가설 없이도 독립 분석에서 나온 부분을 분리한다.
3. 사람 전체의 본질이나 일반 지능이 아니라 이 댓글에서 실제로 드러난 행동으로 한정한다.
4. 오류명을 붙이는 데서 멈추지 말고 ‘무엇을 했고 그 결과 무엇이 성립하지 않았는지’로 쓴다.
5. ‘의도적으로 숨겼다’와 ‘이 글에는 반대 자료를 찾아 시험한 흔적이 없다’를 구별한다.
6. 최종 판정은 확인된 행동과 강하게 지지되는 해석만 사용한다. 근거 없는 추정을 섞지 않는다.
7. 근거가 강한 판정을 자동 완충 문장으로 약화하지 않는다. 반대로 시원함을 위해 과장하지 않는다.
8. JSON 객체 하나만 출력하고 코드블록과 설명은 금지한다.

{
  "supported_parts":[{"point":"가설과 일치하는 부분을 실제 행동으로 번역한 문장","evidence":"근거","claim_ids":["C1"]}],
  "stronger_than_hypothesis":[{"point":"가설보다 더 강하게 확인된 결론","evidence":"근거","claim_ids":["C1"]}],
  "overstated_parts":[{"point":"가설이 증거를 넘어간 부분","reason":"왜 판단할 수 없는지","safer_expression":"자료가 허용하는 정확한 표현"}],
  "independent_only_findings":[{"point":"사용자 가설 없이 독립 분석에서 도출된 결론","evidence":"근거"}],
  "conflicting_evidence":[{"point":"가설과 충돌하는 자료","meaning":"그 자료가 뜻하는 제한"}],
  "refined_assessment":{"paragraph":"확인된 행동에서 출발한 최종 해석","one_line":"근거보다 약하지도 강하지도 않은 한 문장"},
  "confidence":"낮음|중간|높음",
  "what_would_change_the_judgment":["판단을 바꾸거나 약화할 추가 자료"]
}`;
  }
'''

normalize_independent = r'''  function normalizeIndependent(d = {}) {
    return {
      targetConclusion: pick(d, 'target_conclusion', 'targetConclusion') || {},
      coreAssessment: pick(d, 'core_assessment', 'coreAssessment') || {},
      topPatterns: arr(pick(d, 'top_patterns', 'topPatterns')),
      centralContradiction: pick(d, 'central_contradiction', 'centralContradiction') || {},
      evidenceHandling: pick(d, 'evidence_handling', 'evidenceHandling') || {},
      rebuttalHandling: arr(pick(d, 'rebuttal_handling', 'rebuttalHandling')),
      strongestEvidence: arr(pick(d, 'strongest_evidence', 'strongestEvidence')),
      limits: arr(d.limits),
      coldAssessment: pick(d, 'cold_assessment', 'coldAssessment') || {}
    };
  }
'''

normalize_comparison = r'''  function normalizeComparison(d = {}) {
    return {
      supportedParts: arr(pick(d, 'supported_parts', 'supportedParts')),
      strongerParts: arr(pick(d, 'stronger_than_hypothesis', 'strongerThanHypothesis')),
      overstatedParts: arr(pick(d, 'overstated_parts', 'overstatedParts')),
      independentFindings: arr(pick(d, 'independent_only_findings', 'independentOnlyFindings')),
      conflictingEvidence: arr(pick(d, 'conflicting_evidence', 'conflictingEvidence')),
      refinedAssessment: pick(d, 'refined_assessment', 'refinedAssessment') || {},
      confidence: pick(d, 'confidence'),
      whatWouldChange: arr(pick(d, 'what_would_change_the_judgment', 'whatWouldChange'))
    };
  }
'''

render_independent = r'''  function renderIndependent(ind) {
    const el = $('#aaIndependentResult');
    if (!ind) { el.className = 'aa-result aa-empty'; el.textContent = '아직 독립 해부 결과가 없습니다.'; return; }
    const tc = ind.targetConclusion || {}, core = ind.coreAssessment || {}, eh = ind.evidenceHandling || {}, cold = ind.coldAssessment || {}, cc = ind.centralContradiction || {};
    el.className = 'aa-result';
    el.innerHTML = `
      <article class='aa-card core'><h4>결론부터</h4><p>${esc(core.summary || '')}</p>${core.one_sentence ? `<p class='aa-muted' style='margin-top:10px'><b>${esc(core.one_sentence)}</b></p>` : ''}</article>
      <article class='aa-card'><h4>주장한 것과 실제 자료가 증명한 것</h4><p><b>작성자가 내린 결론</b>\n${esc(tc.claim || '')}\n\n<b>자료가 실제로 보여주는 범위</b>\n${esc(tc.verified_support || '')}\n\n<b>결론까지 남는 공백</b>\n${esc(tc.gap || '')}</p></article>
      <section class='aa-card'><h4>근거를 끝까지 밀어붙인 핵심 3개</h4><div class='aa-patterns'>${ind.topPatterns.map(p => {
        const title = p.action_title || p.actionTitle || p.name || '행동 판정';
        const technical = p.technical_label || p.technicalLabel || '';
        const observed = p.observed_action || p.observedAction || p.actual_action || p.actualAction || p.plain_description || '';
        const effect = p.immediate_effect || p.immediateEffect || p.argument_effect || p.argumentEffect || p.argument_function || '';
        const judgment = p.warranted_judgment || p.warrantedJudgment || title;
        const extension = p.unwarranted_extension || p.unwarrantedExtension || '';
        return `<article class='aa-pattern'><h5><span class='aa-rank'>${esc(p.rank)}</span>${esc(title)}</h5>${technical ? `<p class='aa-muted' style='font-size:12px;margin:0 0 9px'><b>분석명:</b> ${esc(technical)}</p>` : ''}<p><b>확인된 행동</b>\n${esc(observed)}</p><p style='margin-top:11px'><b>그 행동이 만든 결과</b>\n${esc(effect)}</p><p style='margin-top:11px'><b>피하기 어려운 판정</b>\n${esc(judgment)}</p>${extension ? `<p class='aa-muted' style='margin-top:11px'><b>여기서부터는 추정</b>\n${esc(extension)}</p>` : ''}${arr(p.evidence).length ? `<ol class='aa-list'>${arr(p.evidence).map(e => `<li>“${esc(e.excerpt || '')}”<br><span class='aa-muted'>${esc(arr(e.claim_ids).join(', '))}${e.fact_connection ? ` · ${esc(e.fact_connection)}` : ''}</span></li>`).join('')}</ol>` : ''}<span class='aa-chip'>확신도 ${esc(p.confidence || '')}</span></article>`;
      }).join('')}</div></section>
      <article class='aa-card'><h4>자료를 실제로 다룬 방식</h4><p><b>무엇을 골랐나</b>\n${esc(eh.selection || '')}\n\n<b>어떻게 결론으로 바꿨나</b>\n${esc(eh.inference || '')}\n\n<b>자기와 상대에게 같은 기준을 썼나</b>\n${esc(eh.standards || '')}\n\n<b>틀린 점을 지적받았을 때 무엇을 했나</b>\n${esc(eh.correction_response || '')}</p></article>
      ${cc.contradiction && cc.contradiction !== '없음' ? `<article class='aa-card core'><h4>핵심 모순</h4><p><b>스스로 내세운 기준이나 태도</b>\n${esc(cc.self_presentation || cc.selfPresentation || '')}\n\n<b>실제로 확인된 행동</b>\n${esc(cc.actual_behavior || cc.actualBehavior || '')}\n\n<b>둘이 충돌하는 지점</b>\n${esc(cc.contradiction || '')}</p><span class='aa-chip'>확신도 ${esc(cc.confidence || '')}</span></article>` : ''}
      ${ind.strongestEvidence.length ? `<article class='aa-card'><h4>이 판정을 피하기 어려운 장면</h4><ol class='aa-list'>${ind.strongestEvidence.map(e => `<li><b>${esc(e.title || '')}</b><br>“${esc(e.excerpt || '')}”<br><span class='aa-muted'>${esc(arr(e.claim_ids).join(', '))} · ${esc(e.why_decisive || '')}</span></li>`).join('')}</ol></article>` : ''}
      <article class='aa-card cold'><h4>최종 판정</h4><p>${esc(cold.paragraph || '')}</p>${cold.one_line ? `<p class='aa-muted' style='margin-top:13px'><b>${esc(cold.one_line)}</b></p>` : ''}</article>
      ${ind.limits.length ? `<article class='aa-card'><h4>자료가 허용하지 않는 단정</h4><ul class='aa-list'>${ind.limits.map(x => `<li>${esc(x)}</li>`).join('')}</ul></article>` : ''}
    `;
  }
'''

render_comparison = r'''  function renderComparison(cmp) {
    const el = $('#aaComparisonResult');
    if (!cmp) { el.className = 'aa-result aa-empty'; el.textContent = '아직 가설 대조 결과가 없습니다.'; return; }
    const r = cmp.refinedAssessment || {};
    const card = (title, items) => `<article class='aa-card'><h4>${title}</h4>${items.length ? `<ul class='aa-list'>${items.map(x => `<li>${esc(x.point || '')}${x.evidence ? `<br><span class='aa-muted'>${esc(x.evidence)} ${arr(x.claim_ids).length ? `· ${esc(arr(x.claim_ids).join(', '))}` : ''}</span>` : ''}${x.reason ? `<br><span class='aa-muted'>${esc(x.reason)}</span>` : ''}${x.safer_expression ? `<br><span class='aa-muted'><b>정확한 선:</b> ${esc(x.safer_expression)}</span>` : ''}${x.meaning ? `<br><span class='aa-muted'>${esc(x.meaning)}</span>` : ''}</li>`).join('')}</ul>` : `<p class='aa-muted'>없음</p>`}</article>`;
    el.className = 'aa-result aa-comparison';
    el.innerHTML = card('가설과 일치하는 부분', cmp.supportedParts) + card('가설보다 더 강하게 확인된 부분', cmp.strongerParts) + card('가설이 증거를 넘어간 부분', cmp.overstatedParts) + card('가설 없이도 나온 결론', cmp.independentFindings) + card('가설과 충돌하는 자료', cmp.conflictingEvidence) + `<article class='aa-card cold'><h4>더 정확한 표현 · 확신도 ${esc(cmp.confidence || '')}</h4><p>${esc(r.paragraph || '')}</p>${r.one_line ? `<p class='aa-muted' style='margin-top:13px'><b>${esc(r.one_line)}</b></p>` : ''}</article>`;
  }
'''

analysis_markdown = r'''  function analysisMarkdown() {
    const ind = author.independent, cmp = author.comparison;
    const lines = [`# ${project?.title || '작성자 해부'}`, '', '## 사용자 가설', author.hypothesis || '없음'];
    if (ind) {
      lines.push('', '## 독립 해부', '', '### 결론부터', '', ind.coreAssessment?.summary || '', '', `**한 문장:** ${ind.coreAssessment?.one_sentence || ''}`, '', '### 근거를 끝까지 밀어붙인 핵심 3개');
      ind.topPatterns.forEach(p => {
        const title = p.action_title || p.actionTitle || p.name || '행동 판정';
        const technical = p.technical_label || p.technicalLabel || '';
        const observed = p.observed_action || p.observedAction || p.actual_action || p.actualAction || p.plain_description || '';
        const effect = p.immediate_effect || p.immediateEffect || p.argument_effect || p.argumentEffect || p.argument_function || '';
        const judgment = p.warranted_judgment || p.warrantedJudgment || title;
        const extension = p.unwarranted_extension || p.unwarrantedExtension || '';
        lines.push('', `#### ${p.rank}. ${title}`);
        if (technical) lines.push(`- 분석명: ${technical}`);
        lines.push(`- 확인된 행동: ${observed}`, `- 그 행동이 만든 결과: ${effect}`, `- 피하기 어려운 판정: ${judgment}`);
        if (extension) lines.push(`- 여기서부터는 추정: ${extension}`);
        lines.push(`- 확신도: ${p.confidence || ''}`);
        arr(p.evidence).forEach(e => lines.push(`- 근거: “${e.excerpt || ''}” (${arr(e.claim_ids).join(', ')}) ${e.fact_connection || ''}`));
      });
      const cc = ind.centralContradiction || {};
      if (cc.contradiction && cc.contradiction !== '없음') lines.push('', '### 핵심 모순', '', `- 스스로 내세운 기준이나 태도: ${cc.self_presentation || cc.selfPresentation || ''}`, `- 실제로 확인된 행동: ${cc.actual_behavior || cc.actualBehavior || ''}`, `- 충돌: ${cc.contradiction || ''}`, `- 확신도: ${cc.confidence || ''}`);
      lines.push('', '### 최종 판정', '', ind.coldAssessment?.paragraph || '', '', `**한 문장:** ${ind.coldAssessment?.one_line || ''}`);
      if (ind.limits?.length) lines.push('', '### 자료가 허용하지 않는 단정', '', ...ind.limits.map(x => `- ${x}`));
    }
    if (cmp) {
      lines.push('', '## 사용자 가설 대조');
      const add = (title, items) => { lines.push('', `### ${title}`); if (!items?.length) lines.push('', '- 없음'); else items.forEach(x => lines.push('', `- ${x.point || ''}${x.evidence ? ` — ${x.evidence}` : ''}${x.reason ? ` — ${x.reason}` : ''}${x.safer_expression ? ` — 정확한 선: ${x.safer_expression}` : ''}`)); };
      add('가설과 일치하는 부분', cmp.supportedParts);
      add('가설보다 더 강하게 확인된 부분', cmp.strongerParts);
      add('가설이 증거를 넘어간 부분', cmp.overstatedParts);
      add('가설 없이도 나온 결론', cmp.independentFindings);
      lines.push('', '### 더 정확한 표현', '', cmp.refinedAssessment?.paragraph || '', '', `**한 문장:** ${cmp.refinedAssessment?.one_line || ''}`, `**확신도:** ${cmp.confidence || ''}`);
    }
    return lines.join('\n');
  }
'''

replacements = [
    (r"  function independentPrompt\(data\) \{.*?\n  \}\n  function comparisonPrompt", independent_function + "  function comparisonPrompt"),
    (r"  function comparisonPrompt\(data\) \{.*?\n  \}\n  function normalizeIndependent", comparison_function + "  function normalizeIndependent"),
    (r"  function normalizeIndependent\(d = \{\}\) \{.*?\n  \}\n  function normalizeComparison", normalize_independent + "  function normalizeComparison"),
    (r"  function normalizeComparison\(d = \{\}\) \{.*?\n  \}\n  function inject", normalize_comparison + "  function inject"),
    (r"  function renderIndependent\(ind\) \{.*?\n  \}\n  function renderComparison", render_independent + "  function renderComparison"),
    (r"  function renderComparison\(cmp\) \{.*?\n  \}\n  function render\(\)", render_comparison + "  function render()"),
    (r"  function analysisMarkdown\(\) \{.*?\n  \}\n  function download", analysis_markdown + "  function download"),
]

for pattern, replacement in replacements:
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'Expected exactly one replacement for: {pattern[:70]} / got {count}')

text = text.replace(
    "<div class='aa-intro'><strong>분석은 기계적으로, 행동은 누구나 알아볼 말로</strong><p>전문용어는 보조로만 남깁니다. 메인 판정은 “비교를 흉내 냈다”, “증명 책임을 떠넘겼다”, “반박하면 나쁜 사람이 되게 만들었다”처럼 실제 행동으로 씁니다.</p></div>",
    "<div class='aa-intro'><strong>아픈 결론은 목표가 아니라 정확한 분석의 결과</strong><p>확인된 행동 → 직접 결과 → 피하기 어려운 판정 → 넘어가면 추정의 순서로 보여줍니다. 근거가 충분한 판정을 약화하지도 않고, 타격감을 위해 근거보다 세게 말하지도 않습니다.</p></div>"
)
text = text.replace(
    "<p>사용자 의견 없이 원문과 팩트 결과만 보냅니다. 가장 중요한 행동 세 개를 평범한 말로 뽑고 책임을 판정합니다.</p>",
    "<p>사용자 의견 없이 원문과 팩트 결과만 보냅니다. 확인된 행동에서 출발해 근거가 허용하는 가장 강한 판정까지 연결합니다.</p>"
)

js_path.write_text(text, encoding='utf-8')

index_path = Path('index.html')
index = index_path.read_text(encoding='utf-8')
index, count = re.subn(r'author-analysis\.js\?v=\d+', 'author-analysis.js?v=4', index, count=1)
if count != 1:
    raise SystemExit('author-analysis cache-bust script tag not found')
index_path.write_text(index, encoding='utf-8')

print('Updated author-analysis.js and index.html')
