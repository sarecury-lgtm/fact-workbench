/* global window */
window.FACT_PROMPTS = {
  extraction(sourceText) {
    return `당신은 사실 검증 작업의 주장 추출기다.

아래 원문에서 의견, 욕설, 감정 표현, 가치판단은 제외하고 작성자가 자기 결론의 근거로 사용하는 검증 가능한 사실 주장만 추출하라.

규칙:
1. 아직 사실 여부를 판정하거나 반박하지 않는다.
2. 한 주장에는 하나의 검증 대상만 남긴다.
3. 사건의 존재, 수치, 판결 결과, 판결 이유, 수사 과정, 인과관계, 비교 주장을 서로 분리한다.
4. 작성자의 표현을 가장 합리적이고 유리한 의미로 해석하되, 원문에 없는 내용을 추가하지 않는다.
5. 동일한 주장이 반복되면 하나로 합치고 원문 발췌에는 대표 표현을 넣는다.
6. 검증할 수 없는 순수 평가나 명령은 제외한다.
7. 반드시 아래 JSON 형식만 출력한다. 마크다운 코드블록은 사용하지 않는다.

{
  "claims": [
    {
      "original_excerpt": "원문의 해당 부분",
      "claim": "검증 가능한 단일 사실 주장",
      "type": "사건|통계|법률|판결 결과|판결 이유|수사 과정|인과관계|비교|기타"
    }
  ]
}

<source_text>
${sourceText}
</source_text>`;
  },

  factCheck(claim, projectContext) {
    return `당신은 중립적인 사실 검증자다.

목표는 원 주장을 반박하거나 옹호하는 것이 아니라, 현재 공개된 신뢰 가능한 자료를 기준으로 실제 사실을 최대한 원형에 가깝게 복원하는 것이다.

작업 맥락:
${projectContext || "별도 맥락 없음"}

검증 대상:
- 원문 발췌: ${claim.originalExcerpt || "없음"}
- 검증 주장: ${claim.text}
- 주장 유형: ${claim.type || "기타"}

규칙:
1. 주장을 가장 합리적이고 유리한 의미로 먼저 재구성한다.
2. 주장을 지지하는 자료와 충돌하거나 범위를 제한하는 자료를 모두 찾는다.
3. 판결문, 법원·검찰·정부·공공기관 자료, 공식 통계, 원문 기록 등 1차 자료를 우선한다.
4. 1차 자료가 없으면 독립적인 신뢰 가능한 2차 자료를 교차 확인한다.
5. 사건의 존재, 수치, 법적 판단, 판결 이유, 수사 과정, 작성자의 해석을 섞지 않는다.
6. 검색 결과를 찾지 못한 것과 사실이 아닌 것을 구분한다.
7. 작성자의 고의, 성향, 도덕성은 판단하지 않는다.
8. 출처마다 실제로 그 자료에서 확인되는 내용만 적는다. 출처가 말하지 않은 내용을 출처에 귀속하지 않는다.
9. 판정은 정확함, 대체로 정확함, 일부 사실, 과장·맥락 누락, 사실과 다름, 근거 부족, 확인 불가 중 하나를 사용한다.
10. 반드시 아래 JSON 형식만 출력한다. 마크다운 코드블록은 사용하지 않는다.

{
  "fair_interpretation": "주장을 가장 유리하게 해석한 문장",
  "confirmed_facts": "자료에서 확인되는 사실",
  "unconfirmed_parts": "확인되지 않거나 공개 자료로 판단할 수 없는 부분",
  "differences": "원 주장과 실제 자료 사이의 구체적인 차이",
  "corrected_statement": "자료에 가장 가까운 정확한 서술",
  "verdict": "판정",
  "confidence": "낮음|중간|높음",
  "sources": [
    {
      "title": "출처명",
      "url": "URL",
      "grade": "1차 자료|신뢰 가능한 2차 자료|보조 자료|출처 품질 불명",
      "excerpt": "그 자료에서 직접 확인되는 내용"
    }
  ]
}`;
  },

  contextReview(claim, projectContext) {
    const fact = claim.fact || {};
    return `당신은 사실과 해석을 분리하는 맥락 검토자다.

이 단계에서는 새로운 사실을 임의로 추가하지 않는다. 아래 1차 검증 결과와 그 출처를 중심으로, 원 주장이 그 사실로부터 만든 함의가 적절한지만 검토한다.

작업 맥락:
${projectContext || "별도 맥락 없음"}

원 주장:
${claim.text}

1차 검증 결과:
- 확인된 사실: ${fact.confirmedFacts || "미입력"}
- 확인되지 않은 부분: ${fact.unconfirmedParts || "미입력"}
- 원문과 차이: ${fact.differences || "미입력"}
- 정확한 서술: ${fact.correctedStatement || "미입력"}
- 1차 판정: ${fact.verdict || "대기"}

규칙:
1. 원문이 이 사실을 이용해 뒷받침하려는 상위 결론을 명확히 적는다.
2. 사실이 존재한다는 것과 그 사실이 상위 결론을 증명한다는 것을 구분한다.
3. 중요 맥락 누락, 범위 확대, 인과관계 비약, 의도 추정, 비교 기준 부재, 사례 선택 편향, 가능성을 확정으로 표현했는지 점검한다.
4. 원 주장에 문제가 없다면 억지로 문제를 만들지 않는다.
5. 성별·정치 성향·작성자의 태도는 판정 근거로 사용하지 않는다.
6. 판정은 함의까지 대체로 타당, 부분적으로만 뒷받침, 중요 맥락 누락, 과장된 해석, 결론을 뒷받침하지 못함, 판단 보류 중 하나를 사용한다.
7. 반드시 아래 JSON 형식만 출력한다. 마크다운 코드블록은 사용하지 않는다.

{
  "broader_conclusion": "원문이 뒷받침하려는 상위 결론",
  "issues": ["발견된 문제 유형"],
  "support_assessment": "사실과 결론 사이의 연결성 평가",
  "missing_context": "빠진 맥락 또는 필요한 비교 자료",
  "neutral_interpretation": "과장 없이 다시 쓴 해석",
  "verdict": "2차 판정"
}`;
  },

  synthesis(project) {
    const compactClaims = (project.claims || []).map((claim) => ({
      id: claim.id,
      claim: claim.text,
      type: claim.type,
      fact: claim.fact,
      context: claim.context
    }));

    return `당신은 팩트체크 결과 종합 편집자다.

목표는 특정 작성자를 공격하는 것이 아니라, 검증된 사실과 원문의 차이를 독자가 쉽게 확인하도록 정리하는 것이다.

규칙:
1. 제공된 검증 결과 밖의 사실을 새로 만들지 않는다.
2. 정확했던 주장도 숨기지 않는다.
3. 틀림, 근거 부족, 확인 불가를 서로 구분한다.
4. 고의적인 거짓말이라고 단정하지 않는다.
5. 각 주장마다 원 주장, 확인된 사실, 차이, 정확한 표현, 출처를 간결하게 정리한다.
6. 마지막에는 전체 근거가 원문의 상위 결론을 어느 정도 뒷받침하는지 적되, 비교 통계가 없으면 그 한계를 명시한다.
7. 독자가 그대로 검토할 수 있도록 출처 URL을 남긴다.

프로젝트: ${project.title || "제목 없음"}

검증 데이터:
${JSON.stringify(compactClaims, null, 2)}`;
  }
};

// One-click handoff: copy the current prompt and open a fresh ChatGPT tab.
(() => {
  'use strict';
  const KEY = 'fact-workbench-state-v1';
  const $ = (selector) => document.querySelector(selector);

  function readState() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch { return {}; }
  }

  function showToast(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 1900);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
  }

  async function openChatGPTWithPrompt(text) {
    if (!text || !text.trim()) {
      showToast('먼저 원문이나 검증할 주장을 입력하세요.');
      return;
    }
    const tab = window.open('https://chatgpt.com/', '_blank');
    if (tab) tab.opener = null;
    await copyText(text);
    showToast(tab
      ? '프롬프트를 복사했습니다. 새 채팅에 붙여넣으세요.'
      : '프롬프트는 복사됐습니다. 팝업 차단을 해제하세요.');
  }

  function projectContext() {
    return `프로젝트: ${$('#projectTitle')?.value || '제목 없음'}\n원문 전체 맥락:\n${$('#sourceText')?.value || '원문 없음'}`;
  }

  function currentClaim(state) {
    const activeId = $('.claim-item.active .claim-id')?.textContent || state.selectedClaimId;
    return (state.claims || []).find((claim) => claim.id === activeId) || null;
  }

  function bindOneClickAI() {
    const extractButton = $('#copyExtractPromptBtn');
    const extractAgainButton = $('#copyExtractPromptBtn2');
    const factButton = $('#copyFactPromptBtn');
    const contextButton = $('#copyContextPromptBtn');
    const synthesisButton = $('#copySynthesisPromptBtn');
    const resultButton = $('.step-panel[data-panel="1"] .next-step[data-next="2"]');

    if (extractButton) {
      extractButton.textContent = '프롬프트 복사하고 AI 새 채팅 열기';
      extractButton.onclick = () => openChatGPTWithPrompt(window.FACT_PROMPTS.extraction($('#sourceText')?.value || ''));
    }
    if (extractAgainButton) {
      extractAgainButton.textContent = '프롬프트 다시 복사하고 AI 열기';
      extractAgainButton.onclick = () => openChatGPTWithPrompt(window.FACT_PROMPTS.extraction($('#sourceText')?.value || ''));
    }
    if (resultButton) resultButton.textContent = 'AI 결과 붙여넣기';

    if (factButton) {
      factButton.textContent = '1차 프롬프트 복사하고 AI 새 채팅 열기';
      factButton.onclick = () => {
        const claim = currentClaim(readState());
        if (claim) openChatGPTWithPrompt(window.FACT_PROMPTS.factCheck(claim, projectContext()));
      };
    }
    if (contextButton) {
      contextButton.textContent = '2차 프롬프트 복사하고 AI 새 채팅 열기';
      contextButton.onclick = () => {
        const claim = currentClaim(readState());
        if (claim) openChatGPTWithPrompt(window.FACT_PROMPTS.contextReview(claim, projectContext()));
      };
    }
    if (synthesisButton) {
      synthesisButton.textContent = '종합 프롬프트 복사하고 AI 열기';
      synthesisButton.onclick = () => openChatGPTWithPrompt(window.FACT_PROMPTS.synthesis(readState()));
    }

    if (!$('.workflow-guide')) {
      const notice = $('.step-panel[data-panel="1"] .notice');
      if (notice) {
        const guide = document.createElement('div');
        guide.className = 'workflow-guide';
        guide.innerHTML = '<strong>처음 쓰는 순서</strong><ol><li>원문을 붙여넣습니다.</li><li><b>프롬프트 복사하고 AI 새 채팅 열기</b>를 누릅니다.</li><li>새 채팅에 붙여넣기(Ctrl+V)하고 전송합니다.</li><li>AI의 JSON 결과를 2단계에 붙여넣습니다.</li></ol>';
        notice.before(guide);
      }
    }
  }

  window.addEventListener('DOMContentLoaded', () => setTimeout(bindOneClickAI, 0));
})();
