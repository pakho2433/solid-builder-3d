kind: 'solid', item: object, startX: event.clientX, startY: event.clientY,
moved: false, original: object.position.clone(),
layer: Math.round((object.position.y - object.userData.halfHeight - BASE_Y) / STEP), candidate: null,
};
}
});
renderer.domElement.addEventListener('pointerup', (event) => {
const down = pointerDown;
pointerDown = null;
if (activeTool === 'vertex') {
const candidate = placementCandidate(event.clientX, event.clientY);
clearPreview();
if (!candidate) return;
const vertex = createVertex(candidate.position);
selectVertex(vertex);
const progress = guideProgress();
if (guideType === 'triPyramid' || guideType === 'squarePyramid') {
if (progress && progress.placed >= progress.totalPoints) {
setActiveTool('free', { keepDrawer: true });
showToast('全部頂點已放好。第二步：由一個頂點拖到另一個頂點畫斜稜');
} else {
showToast(`已放置 ${progress?.placed || 0}/${progress?.totalPoints || 0} 個導引頂點`);
}
} else {
setActiveTool(null, { keepDrawer: true });
showToast('已放置頂點');
}
controls.enabled = !activeTool;
return;
}
if (activeTool === 'sphere' || activeTool === 'cone') {
const candidate = placementCandidate(event.clientX, event.clientY);
clearPreview();
if (candidate) {
const solid = createSolid(activeTool, candidate.position);
selectSolid(solid);
showToast(`已加入${activeTool === 'sphere' ? '球體' : '圓錐'}`);
}
setActiveTool(null, { keepDrawer: true });
controls.enabled = true;
return;
}
if (edgeDraw) {
const draw = edgeDraw;
edgeDraw = null;
clearPreview();
const target = nearestVertex(event.clientX, event.clientY, draw.start)?.vertex || draw.target;
if (!target) {
showToast('未接到第二個頂點，請再試一次');
controls.enabled = false;
return;
}
if (draw.mode === 'straight' && !isAxisAligned(draw.start.position, target.position)) {
showToast('這兩點需要斜稜，請選紫色斜稜');
controls.enabled = false;
return;
}
const edge = createEdge(draw.start, target, draw.mode);
if (!edge) {
showToast('這兩個頂點已經連接');
} else {
selectEdge(edge);
const progress = guideProgress();
if ((guideType === 'triPyramid' || guideType === 'squarePyramid') && progress) {
if (progress.completeLinks >= progress.totalLinks) {
setActiveTool(null, { keepDrawer: true });
showToast('錐體完成！系統已自動顯示半透明面');
} else {
showToast(`已完成 ${progress.completeLinks}/${progress.totalLinks} 條導引稜`);
}
} else {
setActiveTool(null, { keepDrawer: true });
}
}
controls.enabled = !activeTool;
return;
}
if (objectDrag) {
const drag = objectDrag;
objectDrag = null;
clearPreview();
controls.enabled = true;
if (!drag.moved) {
if (drag.kind === 'vertex') selectVertex(drag.item);
else selectSolid(drag.item);
return;
}
if (!drag.candidate) {
drag.item.position.copy(drag.original);
edges.forEach(updateEdge);
showToast('未找到合適位置');
return;
}
if (drag.kind === 'vertex') {
let result = drag.item;
if (drag.candidate.type === 'merge') {
result = mergeVertices(drag.item, drag.candidate.vertex);
} else if (validVertexPosition(drag.item, drag.candidate.position)) {
drag.item.position.copy(drag.candidate.position);
} else {
drag.item.position.copy(drag.original);
showToast('這個位置會令直稜變斜');
}
edges.forEach(updateEdge);
updateFaces();
selectVertex(result);
} else {
selectSolid(drag.item);
}
return;
}
if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 6) {
const object = pickObject(event.clientX, event.clientY);
if (!object) {
clearSelection();
} else if (object.userData.kind === 'vertex') {
selectVertex(object);
} else if (object.userData.kind === 'edge') {
selectEdge(object.userData.edge);
} else {
selectSolid(object);
}
}
});
renderer.domElement.addEventListener('pointercancel', () => {
if (objectDrag?.item && objectDrag.original) objectDrag.item.position.copy(objectDrag.original);
objectDrag = null;
edgeDraw = null;
pointerDown = null;
clearPreview();
controls.enabled = !activeTool;
edges.forEach(updateEdge);
});
document.getElementById('layerUp').onclick = () => {
currentLayer = Math.min(MAX_LAYER - 1, currentLayer + 1);
updateUI();
showToast(`現在放置在第 ${currentLayer + 1} 層`);
};
document.getElementById('layerDown').onclick = () => {
currentLayer = Math.max(0, currentLayer - 1);
updateUI();
showToast(`現在放置在第 ${currentLayer + 1} 層`);
};
document.getElementById('moveUpBtn').onclick = () => moveSelectedLayer(1);
document.getElementById('moveDownBtn').onclick = () => moveSelectedLayer(-1);
document.getElementById('deleteBtn').onclick = deleteSelected;
document.getElementById('resetViewBtn').onclick = resetView;
document.getElementById('quickClearBtn').onclick = () => {
if (window.confirm('確定要立即清空所有頂點、稜、球體和圓錐嗎？')) {
clearAll();
showToast('已立即清空');
}
};
function componentsCount() {
const seen = new Set();
let count = 0;
vertices.forEach((vertex) => {
if (seen.has(vertex)) return;
count += 1;
const stack = [vertex];
seen.add(vertex);
while (stack.length) {
const current = stack.pop();
edges.forEach((edge) => {
const next = edge.a === current ? edge.b : edge.b === current ? edge.a : null;
if (next && !seen.has(next)) {
seen.add(next);
stack.push(next);
}
});
}
});
return count + solids.length;
}
function analyse() {
const degree = new Map(vertices.map((vertex) => [vertex, 0]));
edges.forEach((edge) => {
degree.set(edge.a, (degree.get(edge.a) || 0) + 1);
degree.set(edge.b, (degree.get(edge.b) || 0) + 1);
});
const values = vertices.map((vertex) => degree.get(vertex) || 0).sort((a, b) => a - b);
const levels = new Set([
...vertices.map((vertex) => vertex.position.y),
...solids.map((solid) => layerY(Math.round((solid.position.y - solid.userData.halfHeight - BASE_Y) / STEP))),
]).size;
const parts = componentsCount();
const sphereCount = solids.filter((solid) => solid.userData.solidType === 'sphere').length;
const coneCount = solids.filter((solid) => solid.userData.solidType === 'cone').length;
const slantedCount = edges.filter((edge) => edge.mode === 'free').length;
let name = '自由創作模型';
let message = '模型包含直稜、斜稜或曲面立體。';
if (!vertices.length && !solids.length) {
name = '模型仍是空白';
message = '先展開工具，再加入頂點、稜、球體或圓錐。';
} else if (vertices.length === 4 && edges.length === 6 && hasCompleteGraph(vertices)) {
name = '三角錐（四面體）';
message = '共有4個頂點、6條稜和4個三角形面。';
} else if (vertices.length === 5 && edges.length === 8 && values.join(',') === '3,3,3,3,4') {
name = '四角錐';
message = '共有5個頂點、8條稜、1個四邊形底面和4個三角形側面。';
} else if (vertices.length === 8 && edges.length === 12 && values.every((value) => value === 3)) {
const xValues = [...new Set(vertices.map((vertex) => vertex.position.x))];
const zValues = [...new Set(vertices.map((vertex) => vertex.position.z))];
const squareBase = xValues.length === 2 && zValues.length === 2 && Math.abs(xValues[1] - xValues[0]) === Math.abs(zValues[1] - zValues[0]);
name = squareBase ? '可能是正方體框架' : '可能是長方體框架';
message = '共有8個頂點、12條稜，每個頂點連接3條稜。';
} else if (sphereCount === 1 && coneCount === 0 && !vertices.length) {
name = '球體';
message = '球體只有一個曲面，沒有平面、稜和頂點。';
} else if (coneCount === 1 && sphereCount === 0 && !vertices.length) {
name = '圓錐';
message = '圓錐有一個尖頂、一個圓形平面及一個曲面。';
} else if (parts > 1) {
name = solids.length ? '混合立體模型' : '模型有未連接部分';
message = `目前共有 ${parts} 個分開部分。`;
}
return { degree, levels, parts, sphereCount, coneCount, slantedCount, name, message };
}
function showData() {
const result = analyse();
document.getElementById('resultVertices').textContent = vertices.length;
document.getElementById('resultEdges').textContent = edges.length;
document.getElementById('resultSlanted').textContent = result.slantedCount;
document.getElementById('resultSpheres').textContent = result.sphereCount;
document.getElementById('resultCones').textContent = result.coneCount;
document.getElementById('resultLevels').textContent = result.levels;
document.getElementById('resultParts').textContent = result.parts;
document.getElementById('shapeName').textContent = result.name;
document.getElementById('shapeMessage').textContent = result.message;
const details = [];
if (vertices.length) {
details.push(`<b>每個頂點連接的稜：</b><br>${vertices.map((vertex) => `頂點 ${vertex.userData.id}：${result.degree.get(vertex) || 0} 條`).join('　 ')}`);
}
if (result.slantedCount) details.push(`<b>斜稜：</b>${result.slantedCount} 條，可用來組裝三角錐和四角錐。`);
if (result.sphereCount) details.push('<b>球體：</b>只有1個曲面，沒有頂點和稜。');
if (result.coneCount) details.push('<b>圓錐：</b>有1個尖頂、1個圓形平面和1個曲面。');
document.getElementById('detail').innerHTML = details.join('<br><br>') || '尚未有模型資料。';
document.getElementById('dataModal').classList.add('show');
}
document.getElementById('finishBtn').onclick = showData;
document.getElementById('continueBtn').onclick = () => document.getElementById('dataModal').classList.remove('show');
document.getElementById('clearBtn').onclick = () => {
document.getElementById('dataModal').classList.remove('show');
clearAll();
resetView();
};
document.getElementById('helpBtn').onclick = () => document.getElementById('helpModal').classList.add('show');
document.getElementById('closeHelpBtn').onclick = () => document.getElementById('helpModal').classList.remove('show');
document.getElementById('dataModal').onclick = (event) => {
if (event.target.id === 'dataModal') event.currentTarget.classList.remove('show');
};
document.getElementById('helpModal').onclick = (event) => {
if (event.target.id === 'helpModal') event.currentTarget.classList.remove('show');
};
function animate() {
requestAnimationFrame(animate);
controls.update();
edges.forEach(updateEdge);
const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.1;
if (snapHaloA.visible) snapHaloA.scale.setScalar(pulse);
if (snapHaloB.visible) snapHaloB.scale.setScalar(pulse);
renderer.render(scene, camera);
}
animate();
updateUI();
