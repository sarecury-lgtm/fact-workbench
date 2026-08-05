from pathlib import Path

path = Path("author-analysis.js")
text = path.read_text(encoding="utf-8")

old_independent = """    $('#aaSendIndependent').onclick = async () => {
      await loadProject();
      if (!project.sourceText?.trim()) return toast('원문이 없습니다.');
      if (!arr(project.claims).length) return toast('먼저 팩트 검증 결과를 반영하세요.');
      handoff(independentPrompt(project));
    };"""

new_independent = """    $('#aaSendIndependent').onclick = async () => {
      const chatWindow = window.open('about:blank', '_blank');
      await loadProject();
      if (!project.sourceText?.trim()) { chatWindow?.close(); return toast('원문이 없습니다.'); }
      if (!arr(project.claims).length) { chatWindow?.close(); return toast('먼저 팩트 검증 결과를 반영하세요.'); }
      const prompt = independentPrompt(project);
      copy(prompt);
      if (chatWindow) chatWindow.location.href = 'https://chatgpt.com/';
      else toast('팝업이 차단됐습니다. 작업문은 복사됐으니 ChatGPT를 직접 열어 붙여넣으세요.');
      if (chatWindow) toast('작업문을 복사했습니다. 새 채팅에서 붙여넣고 전송하세요.');
    };"""

old_comparison = """    $('#aaSendComparison').onclick = async () => {
      author.hypothesis = $('#aaHypothesis').value.trim();
      if (!author.independent) return toast('먼저 독립 해부를 반영하세요.');
      if (!author.hypothesis) return toast('내 해석을 먼저 입력하세요.');
      await saveAuthor(); handoff(comparisonPrompt(project));
    };"""

new_comparison = """    $('#aaSendComparison').onclick = async () => {
      const chatWindow = window.open('about:blank', '_blank');
      author.hypothesis = $('#aaHypothesis').value.trim();
      if (!author.independent) { chatWindow?.close(); return toast('먼저 독립 해부를 반영하세요.'); }
      if (!author.hypothesis) { chatWindow?.close(); return toast('내 해석을 먼저 입력하세요.'); }
      await saveAuthor();
      const prompt = comparisonPrompt(project);
      copy(prompt);
      if (chatWindow) chatWindow.location.href = 'https://chatgpt.com/';
      else toast('팝업이 차단됐습니다. 작업문은 복사됐으니 ChatGPT를 직접 열어 붙여넣으세요.');
      if (chatWindow) toast('작업문을 복사했습니다. 새 채팅에서 붙여넣고 전송하세요.');
    };"""

if old_independent not in text:
    raise SystemExit("independent handler not found")
if old_comparison not in text:
    raise SystemExit("comparison handler not found")

text = text.replace(old_independent, new_independent)
text = text.replace(old_comparison, new_comparison)
path.write_text(text, encoding="utf-8")
