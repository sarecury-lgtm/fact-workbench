from pathlib import Path

js_path = Path('author-analysis.js')
text = js_path.read_text(encoding='utf-8')

text = text.replace(
    "<button id='aaSendIndependent' class='button aa-dark' type='button'>독립 해부를 AI에 맡기기</button>",
    "<button id='aaSendIndependent' class='button aa-dark' type='button'>독립 해부 작업문 만들기</button>"
)
text = text.replace(
    "<button id='aaSendComparison' class='button primary' type='button'>내 해석과 대조 맡기기</button>",
    "<button id='aaSendComparison' class='button primary' type='button'>대조 작업문 만들기</button>"
)

old_independent_ui = "</div><div class='return-box'><textarea id='aaIndependentAnswer' rows='12' placeholder='AI의 JSON 답변 전체를 붙여넣으세요'></textarea>"
new_independent_ui = "</div><div id='aaIndependentPromptBox' class='return-box aa-prompt-box hidden'><label class='field'><span>1. 아래 작업문을 복사하세요</span><textarea id='aaIndependentPrompt' rows='10' readonly placeholder='위 버튼을 누르면 작업문이 여기에 나타납니다.'></textarea></label><div class='row-actions'><button id='aaCopyIndependentPrompt' class='button aa-dark' type='button'>작업문 복사</button><button id='aaOpenIndependentChat' class='button quiet' type='button'>2. ChatGPT 열기</button><span class='hint'>ChatGPT에서 붙여넣고 전송한 뒤, 답변 JSON을 아래 칸에 붙여넣으세요.</span></div></div><div class='return-box'><textarea id='aaIndependentAnswer' rows='12' placeholder='3. ChatGPT의 JSON 답변 전체를 여기에 붙여넣으세요'></textarea>"
if old_independent_ui not in text:
    raise SystemExit('independent UI insertion point not found')
text = text.replace(old_independent_ui, new_independent_ui, 1)

old_comparison_ui = "</div></div><div class='return-box'><textarea id='aaComparisonAnswer' rows='10' placeholder='AI의 JSON 답변 전체를 붙여넣으세요'></textarea>"
new_comparison_ui = "</div></div><div id='aaComparisonPromptBox' class='return-box aa-prompt-box hidden'><label class='field'><span>1. 아래 대조 작업문을 복사하세요</span><textarea id='aaComparisonPrompt' rows='10' readonly placeholder='위 버튼을 누르면 작업문이 여기에 나타납니다.'></textarea></label><div class='row-actions'><button id='aaCopyComparisonPrompt' class='button primary' type='button'>작업문 복사</button><button id='aaOpenComparisonChat' class='button quiet' type='button'>2. ChatGPT 열기</button><span class='hint'>ChatGPT에서 붙여넣고 전송한 뒤, 답변 JSON을 아래 칸에 붙여넣으세요.</span></div></div><div class='return-box'><textarea id='aaComparisonAnswer' rows='10' placeholder='3. ChatGPT의 JSON 답변 전체를 여기에 붙여넣으세요'></textarea>"
if old_comparison_ui not in text:
    raise SystemExit('comparison UI insertion point not found')
text = text.replace(old_comparison_ui, new_comparison_ui, 1)

old_independent_handler = """    $('#aaSendIndependent').onclick = async () => {
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
new_independent_handler = """    $('#aaSendIndependent').onclick = async () => {
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
    $('#aaOpenIndependentChat').onclick = () => window.open('https://chatgpt.com/', '_blank', 'noopener');"""
if old_independent_handler not in text:
    raise SystemExit('independent handler not found')
text = text.replace(old_independent_handler, new_independent_handler, 1)

old_comparison_handler = """    $('#aaSendComparison').onclick = async () => {
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
new_comparison_handler = """    $('#aaSendComparison').onclick = async () => {
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
    $('#aaOpenComparisonChat').onclick = () => window.open('https://chatgpt.com/', '_blank', 'noopener');"""
if old_comparison_handler not in text:
    raise SystemExit('comparison handler not found')
text = text.replace(old_comparison_handler, new_comparison_handler, 1)

style_anchor = ".aa-stale{border:1px solid #edcd85;background:#fff8e8;color:#765009;border-radius:10px;padding:12px 14px;margin:12px 0;line-height:1.5}"
style_add = style_anchor + ".aa-prompt-box{margin-top:14px;border:1px solid #9ca3af;background:#f7f7f8}.aa-prompt-box textarea[readonly]{background:#fff;min-height:190px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:1.55}"
if style_anchor not in text:
    raise SystemExit('style anchor not found')
text = text.replace(style_anchor, style_add, 1)

js_path.write_text(text, encoding='utf-8')

index_path = Path('index.html')
index = index_path.read_text(encoding='utf-8')
index = index.replace('author-analysis.js?v=1', 'author-analysis.js?v=3')
index = index.replace('author-analysis.js?v=2', 'author-analysis.js?v=3')
index_path.write_text(index, encoding='utf-8')
