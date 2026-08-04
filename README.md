# Fact Workbench

댓글·게시글이 근거로 제시한 사건, 통계, 판결 내용을 단계적으로 검증하기 위한 정적 웹 작업대입니다.

## 핵심 원칙

- 작성자를 공격하기 전에 검증 가능한 사실 주장만 분리합니다.
- 원 주장을 가장 합리적이고 유리한 의미로 해석합니다.
- 지지 자료와 범위를 제한하는 자료를 함께 확인합니다.
- `찾지 못함`, `근거 부족`, `사실과 다름`을 구분합니다.
- 사실 검증(1차)과 사실을 이용한 해석 검토(2차)를 섞지 않습니다.
- 작성자의 고의나 성향은 판정하지 않습니다.

## 사용법

1. `index.html`을 브라우저로 엽니다.
2. 원문을 붙여넣고 `주장 추출 프롬프트 복사`를 누릅니다.
3. ChatGPT 등 웹 검색 가능한 AI에 붙여넣고 JSON 결과를 다시 작업대에 적용합니다.
4. 주장별로 1차 사실 검증 프롬프트를 복사하고 결과를 적용합니다.
5. 필요한 주장만 2차 맥락 검토를 진행합니다.
6. 마지막에 Markdown 보고서를 생성합니다.

모든 작업 데이터는 기본적으로 브라우저 `localStorage`에 저장됩니다. 중요한 작업은 상단의 `JSON 내보내기`로 백업하세요.

## 파일 구조

- `index.html`: 화면과 작업 단계
- `styles.css`: 밝고 단순한 UI
- `prompts.js`: 단계별 프롬프트
- `app.js`: 자동 저장, JSON 입출력, 주장·출처 관리, 보고서 생성
- `.nojekyll`: GitHub Pages 정적 배포용

## GitHub에 처음 연결하기

GitHub에서 `fact-workbench`라는 **빈 새 저장소**를 만든 뒤 이 폴더에서 아래 명령을 실행합니다.

```bash
git remote add origin https://github.com/<YOUR_USERNAME>/fact-workbench.git
git branch -M main
git push -u origin main
```

그 뒤 저장소의 Pages 설정에서 `main` 브랜치 루트(`/`)를 배포 대상으로 선택하면 됩니다.

## 업데이트

프롬프트는 `prompts.js`에서 수정합니다. UI와 기능은 각각 `index.html`, `styles.css`, `app.js`에서 수정한 뒤:

```bash
git add -- index.html styles.css prompts.js app.js README.md .nojekyll
git commit -m "Update fact-check workflow"
git push
```

실제 댓글 원문과 조사 데이터는 저장소에 넣지 않고 브라우저 또는 내보낸 개인 JSON 파일로 관리하는 것을 권장합니다.
