
// Continuous tool mode: the selected construction tool stays active until
// the student taps the same tool again or chooses another tool.
function deactivateConstructionTool() {
  activeTool = null;
  edgeDraw = null;
  pointerDown = null;
  objectDrag = null;
  clearSelection();
  clearPreview();
  document.querySelectorAll('[data-tool]').forEach((card) => {
    card.classList.remove('active');
  });
  controls.enabled = true;
  setHint('已取消工具：現在可以自由旋轉、縮放及觀看立體圖形', false);
  setToolsOpen(false);
  showToast('已取消工具，可自由觀看視角');
}

function activateContinuousTool(tool) {
  activeTool = tool;
  document.querySelectorAll('[data-tool]').forEach((card) => {
    const cardTool = card.dataset.tool === 'free-edge'
      ? 'free'
      : card.dataset.tool === 'edge'
        ? 'straight'
        : card.dataset.tool;
    card.classList.toggle('active', cardTool === activeTool);
  });
  clearSelection();
  clearPreview();
  edgeDraw = null;
  pointerDown = null;
  objectDrag = null;
  controls.enabled = false;

  const messages = {
    vertex: '頂點工具已持續啟用：可連續撳畫布加入頂點；再撳頂點可取消',
    straight: '直稜工具已持續啟用：先撳第一點，再撳第二點；再撳直稜可取消',
    free: '斜稜工具已持續啟用：先撳第一點，再撳第二點；再撳斜稜可取消',
    sphere: '球體工具已持續啟用：可連續撳畫布加入球體；再撳球體可取消',
    cone: '圓錐工具已持續啟用：可連續撳畫布加入圓錐；再撳圓錐可取消',
  };
  setHint(messages[activeTool], true);
  setToolsOpen(false);
}

function toggleContinuousTool(tool) {
  if (activeTool === tool) {
    deactivateConstructionTool();
    return;
  }
  activateContinuousTool(tool);
}

// Capture tool-card clicks before the older handler. Pressing the same tool
// cancels it; pressing another tool switches directly to the new tool.
document.querySelectorAll('[data-tool]').forEach((card) => {
  card.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const tool = card.dataset.tool === 'edge'
      ? 'straight'
      : card.dataset.tool === 'free-edge'
        ? 'free'
        : card.dataset.tool;
    toggleContinuousTool(tool);
  }, true);
});

// Handle construction taps before the original pointer-up handler so that
// vertex, solid and edge tools remain active after each completed action.
renderer.domElement.addEventListener('pointerup', (event) => {
  if (!activeTool) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  pointerDown = null;

  if (activeTool === 'vertex') {
    const candidate = placementCandidate(event.clientX, event.clientY);
    clearPreview();
    if (!candidate) {
      showToast('請在圖格內撳一下');
      controls.enabled = false;
      return;
    }
    createVertex(candidate.position);
    clearSelection();
    showToast('已放置頂點，可繼續加入下一個');
    setHint('頂點工具持續啟用：繼續撳畫布加入頂點；再撳頂點可取消', true);
    controls.enabled = false;
    return;
  }

  if (activeTool === 'sphere' || activeTool === 'cone') {
    const type = activeTool;
    const candidate = placementCandidate(event.clientX, event.clientY);
    clearPreview();
    if (!candidate) {
      showToast('請在圖格內撳一下');
      controls.enabled = false;
      return;
    }
    createSolid(type, candidate.position);
    clearSelection();
    showToast(`已加入${type === 'sphere' ? '球體' : '圓錐'}，可繼續加入下一個`);
    setHint(`${type === 'sphere' ? '球體' : '圓錐'}工具持續啟用：繼續撳畫布加入；再撳相同工具可取消`, true);
    controls.enabled = false;
    return;
  }

  if (activeTool === 'straight' || activeTool === 'free') {
    const endpoint = endpointCandidate(
      event.clientX,
      event.clientY,
      edgeDraw?.start || null,
      true,
    );

    if (!endpoint?.vertex) {
      showToast('請撳紫色導引點或藍色頂點');
      if (edgeDraw?.start) showFirstEndpoint(edgeDraw.start, activeTool);
      controls.enabled = false;
      return;
    }

    if (!edgeDraw?.start) {
      edgeDraw = { start: endpoint.vertex, mode: activeTool };
      showFirstEndpoint(endpoint.vertex, activeTool);
      showToast('已選第一點，現在撳第二個點');
      controls.enabled = false;
      return;
    }

    const start = edgeDraw.start;
    const target = endpoint.vertex;
    if (start === target) {
      showFirstEndpoint(start, activeTool);
      showToast('第二點要揀另一個位置');
      controls.enabled = false;
      return;
    }

    const result = createConnection(start, target, activeTool);
    edgeDraw = null;
    clearPreview();

    if (result === 'needs-free') {
      showToast('這兩點需要斜稜，請改選紫色斜稜');
      setHint('直稜工具仍然啟用；改選斜稜可連接斜向頂點', false);
      controls.enabled = false;
      return;
    }

    if (!result) {
      showToast('這兩個頂點已經連接，可選另一對頂點');
    } else {
      const progress = guideProgress();
      if ((guideType === 'triPyramid' || guideType === 'squarePyramid') && progress) {
        if (progress.completeLinks >= progress.totalLinks) {
          showToast('錐體完成！工具仍然保持啟用');
        } else {
          showToast(`已完成 ${progress.completeLinks}/${progress.totalLinks} 條稜；可繼續連線`);
        }
      } else {
        showToast('已完成連線，可繼續選下一對頂點');
      }
    }

    setHint(
      activeTool === 'free'
        ? '斜稜工具持續啟用：先撳第一點，再撳第二點；再撳斜稜可取消'
        : '直稜工具持續啟用：先撳第一點，再撳第二點；再撳直稜可取消',
      true,
    );
    controls.enabled = false;
  }
}, true);
