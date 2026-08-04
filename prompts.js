/* global window */
window.FACT_PROMPTS = {
  extraction(sourceText) {
    return `당신은 사실 검증 작업의 주장 추출기다.

목표:
아래 원문에서 작성자가 자기 결론의 근거로 사용하는 검증 가능한 사실 주장만 추출하고, 같은 사건·같은 통계·같은 원자료로 확인할 수 있는 주장끼리 묶어라.

규칙:
1. 의견, 욕설, 감정 표현, 명령, 순수 가치판단은 제외한다.
2. 아직 사실 여부를 판정하거나 반박하지 않는다.
3. 한 주장에는 하나의 검증 대상만 남긴다.
4. 사건 존재, 수치, 판결 결과, 판결 이유, 수사 과정, 인과관계, 비교 주장을 분리한다.
5. 작성자의 표현을 가장 합리적이고 유리한 의미로 해석하되 원문에 없는 내용을 추가하지 않는다.
6. 반복된 주장은 하나로 합친다.
7. 같은 판결문·공식 통계·사건 자료로 함께 확인할 수 있는 주장 3~8개를 한 묶음으로 만든다.
8. 비교·총괄 주장은 개별 사건 묶음과 분리해 마지막 묶음에 둔다.
9. 반드시 아래 구조만 출력한다. 마크다운 코드블록과 설명은 쓰지 않는다.

{
  "groups": [
    {
      "id": "G1",
      "title": "사건 또는 검증 주제",
      "reason": "이 주장들을 함께 검증하는 이유",
      "claims": [
        {
          "id": "C1",
          "original_excerpt": "원문의 대표 발췌",
          "claim": "검증 가능한 단일 사실 주장",
          "type": "사건|통계|법률|판결 결과|판결 이유|수사 과정|인과관계|비교|기타"
        }
      ]
    }
  ]
}

<source_text>
${sourceText}
</source_text>`;
  },

  groupCheck(project, group) {
    const claims = group.claims.map(c => ({
      claim_id: c.id,
      original_excerpt: c.originalExcerpt,
      claim: c.text,
      type: c.type
    }));
    return `당신은 중립적인 사실 검증자다.

목표는 원 주장을 반박하거나 옹호하는 것이 아니라, 현재 공개된 신뢰 가능한 자료를 기준으로 실제 사실을 최대한 원형에 가깝게 복원하는 것이다.

프로젝트: ${project.title || '제목 없음'}
원문 전체 맥락:
${project.sourceText || '원문 없음'}

이번에 함께 검증할 묶음: ${group.title}
묶은 이유: ${group.reason || '같은 자료로 함께 확인 가능'}
검증 주장:
${JSON.stringify(claims, null, 2)}

조사 규칙:
1. 각 주장을 가장 합리적이고 유리한 의미로 먼저 해석한다.
2. 같은 사건의 주장들은 함께 조사하되, 판정은 claim_id별로 따로 내린다.
3. 주장을 지지하는 자료와 충돌하거나 범위를 제한하는 자료를 모두 찾는다.
4. 판결문, 법원·검찰·정부·공공기관 자료, 공식 통계, 원문 기록 등 1차 자료를 우선한다.
5. 1차 자료가 없으면 독립적인 신뢰 가능한 2차 자료를 교차 확인한다.
6. 사건 존재, 수치, 법적 판단, 판결 이유, 수사 과정, 작성자의 해석을 섞지 않는다.
7. 검색에서 찾지 못한 것과 사실이 아닌 것을 구분한다.
8. 작성자의 고의·성향·도덕성은 판단하지 않는다.
9. 출처마다 실제로 그 자료에서 확인되는 내용만 적는다.
10. 판정은 정확함, 대체로 정확함, 일부 사실, 과장·맥락 누락, 사실과 다름, 근거 부족, 확인 불가 중 하나를 사용한다.
11. 반드시 아래 구조만 출력한다. 마크다운 코드블록과 설명은 쓰지 않는다.

{
  "group_id": "${group.id}",
  "group_summary": "이 묶음에서 실제로 확인된 핵심 사실 요약",
  "results": [
    {
      "claim_id": "C1",
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
          "supports": "그 자료에서 직접 확인되는 내용"
        }
      ]
    }
  ]
}`;
  },

  contextReview(project) {
    const groups = project.groups.map(g => ({
      id: g.id,
      title: g.title,
      summary: g.summary,
      claims: g.claims.map(c => ({
        id: c.id,
        original_claim: c.text,
        verdict: c.result?.verdict || '미검증',
        confirmed_facts: c.result?.confirmedFacts || '',
        differences: c.result?.differences || '',
        corrected_statement: c.result?.correctedStatement || ''
      }))
    }));
    return `당신은 사실과 해석을 분리하는 최종 맥락 검토자다.

목표:
개별 주장에 대한 사실 검증 결과를 바탕으로, 원문이 제시한 전체 결론이 실제로 어느 정도 뒷받침되는지 검토하고 더 정확한 진실을 복원하라.

프로젝트: ${project.title || '제목 없음'}
원문:
${project.sourceText || '원문 없음'}

검증 결과:
${JSON.stringify(groups, null, 2)}

규칙:
1. 제공된 검증 결과를 중심으로 판단하고, 새로운 사실이 필요하면 신뢰 가능한 자료를 추가 조사하되 출처를 명시한다.
2. 개별 사건이 사실이라는 것과 전체 비교·일반화 주장이 입증된다는 것을 구분한다.
3. 비교 기준 부재, 사례 선택 편향, 중요 맥락 누락, 범위 확대, 인과관계 비약, 의도 추정을 점검한다.
4. 원문에서 정확했던 근거도 숨기지 않는다.
5. 틀림, 근거 부족, 확인 불가를 구분한다.
6. 작성자가 고의로 거짓말했다고 단정하지 않는다.
7. 독자가 실제 사실을 알 수 있도록, 원문 비판보다 정확한 사실 복원을 중심에 둔다.
8. 반드시 아래 구조만 출력한다. 마크다운 코드블록과 설명은 쓰지 않는다.

{
  "overall_verdict": "전체 판단",
  "what_was_accurate": ["정확하거나 대체로 정확했던 근거"],
  "what_was_distorted": ["사실과 달라졌거나 과장된 근거"],
  "unsupported_leaps": ["개별 사실에서 전체 결론으로 넘어갈 때의 비약"],
  "missing_comparisons": ["전체 결론을 입증하려면 추가로 필요한 비교 자료"],
  "accurate_reconstruction": "현재 공개 자료에 가장 가까운 전체 사실 복원",
  "concise_response": "감정과 인신공격 없이 핵심 사실만 제시하는 짧은 반박문",
  "sources": [
    {"title": "출처명", "url": "URL", "supports": "확인되는 내용"}
  ]
}`;
  }
};
