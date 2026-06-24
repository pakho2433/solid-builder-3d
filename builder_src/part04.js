
function normalizePrismName() {
  document.querySelectorAll('#shapeName, #shapeMessage, #detail').forEach((element) => {
    const currentText = element.textContent;
    const correctedText = currentText.replaceAll('四角柱體', '四角柱');
    if (correctedText !== currentText) {
      element.textContent = correctedText;
    }
  });
}

document.getElementById('finishBtn')?.addEventListener('click', () => {
  requestAnimationFrame(normalizePrismName);
});
