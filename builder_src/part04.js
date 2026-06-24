
function normalizePrismName() {
  document.querySelectorAll('#shapeName, #shapeMessage, #detail').forEach((element) => {
    element.textContent = element.textContent.replaceAll('四角柱體', '四角柱');
  });
}

const resultArea = document.getElementById('dataModal');
if (resultArea) {
  new MutationObserver(normalizePrismName).observe(resultArea, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

document.getElementById('finishBtn')?.addEventListener('click', () => {
  requestAnimationFrame(normalizePrismName);
});
