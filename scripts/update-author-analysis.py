from pathlib import Path
import re

path = Path('author-analysis.js')
text = path.read_text(encoding='utf-8')

independent_fn = r'''  function independentPrompt(data) {
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
'''

comparison_fn = r'''  function comparisonPrompt(data) {
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
'''

render_independent = r'''  function renderIndependent(ind) {
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
'''

markdown_fn = r'''  function analysisMarkdown() {
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
'''

text, n1 = re.subn(
    r"  function independentPrompt\(data\) \{.*?\n  \}\n(?=  function comparisonPrompt\(data\) \{)",
    lambda _: independent_fn,
    text,
    flags=re.S,
)
text, n2 = re.subn(
    r"  function comparisonPrompt\(data\) \{.*?\n  \}\n(?=  function normalizeIndependent\(d = \{\}\) \{)",
    lambda _: comparison_fn,
    text,
    flags=re.S,
)
text, n3 = re.subn(
    r"  function renderIndependent\(ind\) \{.*?\n  \}\n(?=  function renderComparison\(cmp\) \{)",
    lambda _: render_independent,
    text,
    flags=re.S,
)
text, n4 = re.subn(
    r"  function analysisMarkdown\(\) \{.*?\n  \}\n(?=  function download\()",
    lambda _: markdown_fn,
    text,
    flags=re.S,
)

replacements = {
    '작성자가 사실을 쓰는 방식을 해부합니다': '작성자가 실제로 무엇을 했는지 벗겨냅니다',
    '팩트 판정은 건드리지 않습니다. 원문과 검증 결과를 근거로 자료 선택, 추론, 반론 처리, 자기보호 구조를 따로 분석합니다.': '팩트 판정은 그대로 둡니다. 어려운 오류명을 나열하는 대신, 원문과 검증 결과를 근거로 작성자가 실제로 한 일을 평범한 말로 보여줍니다.',
    '분석은 기계적으로, 최종 판정은 차갑고 직설적으로': '분석은 기계적으로, 행동은 누구나 알아볼 말로',
    '욕설이나 정신진단은 하지 않습니다. 대신 확인된 자기봉쇄, 입증책임 전가, 골대 이동, 이중 기준, 도덕적 인질화 같은 행위를 억지로 순화하지 않습니다.': '전문용어는 보조로만 남깁니다. 메인 판정은 “비교를 흉내 냈다”, “증명 책임을 떠넘겼다”, “반박하면 나쁜 사람이 되게 만들었다”처럼 실제 행동으로 씁니다.',
    '사용자 의견 없이 원문과 팩트 결과만 보냅니다. 중심 패턴 세 개와 최종 해부를 뽑습니다.': '사용자 의견 없이 원문과 팩트 결과만 보냅니다. 가장 중요한 행동 세 개를 평범한 말로 뽑고 책임을 판정합니다.',
}
for old, new in replacements.items():
    text = text.replace(old, new)

if (n1, n2, n3, n4) != (1, 1, 1, 1):
    raise SystemExit(f'replacement count mismatch: {n1}, {n2}, {n3}, {n4}')

path.write_text(text, encoding='utf-8')
