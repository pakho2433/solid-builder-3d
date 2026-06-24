function normalizeShapeTerminology() {
  const replacements = [
    ['四角柱體', '四角柱'],
    ['正方體（四角柱體）', '正方體（四角柱）'],
    ['長方體（四角柱體）', '長方體（四角柱）'],
  ];

  document.querySelectorAll('#shapeName, #shapeMessage, #detail').forEach((element) => {
    let text = element.textContent;
    replacements.forEach(([from, to]) => {
      text = text.replaceAll(from, to);
    });
    element.textContent = text;
  });
}

const resultModal = document.getElementById('dataModal');
if (resultModal) {
  const observer = new MutationObserver(normalizeShapeTerminology);
  observer.observe(resultModal, { childList: true, subtree: true, characterData: true });
}

document.getElementById('finishBtn')?.addEventListener('click', () => {
  requestAnimationFrame(normalizeShapeTerminology);
});
