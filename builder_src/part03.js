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
setActiveTool(null, { keepDrawer: true });
showToast('已放置頂點');
controls.enabled = true;
return;
}
if (activeTool === 'sphere' || activeTool === 'cone') {
const candidate = placementCandidate(event.clientX, event.clientY);
clearPreview();
if (candidate) {
const type = activeTool;
const solid = createSolid(type, candidate.position);
selectSolid(solid);
showToast(`已加入${type === 'sphere' ? '球體' : '圓錐'}`);
}
setActiveTool(null, { keepDrawer: true });
controls.enabled = true;
return;
}
if (activeTool === 'straight' || activeTool === 'free') {
const endpoint = endpointCandidate(event.clientX, event.clientY, edgeDraw?.start || null, true);
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
showToast('這兩點不是直線，請使用紫色斜稜');
setHint('請選紫色斜稜，再點兩個頂點', false);
controls.enabled = false;
return;
}
if (!result) {
showToast('這兩個頂點已經連接');
} else {
const progress = guideProgress();
if ((guideType === 'triPyramid' || guideType === 'squarePyramid') && progress) {
if (progress.completeLinks >= progress.totalLinks) {
setActiveTool(null, { keepDrawer: true });
showToast('錐體完成！已自動顯示半透明面');
controls.enabled = true;
return;
}
showToast(`已完成 ${progress.completeLinks}/${progress.totalLinks} 條稜；繼續點兩個位置`);
} else {
showToast('已完成連線；可繼續點兩個頂點');
}
}
setHint(activeTool === 'free' ? '先撳第一個紫色或藍色點，再撳第二個點' : '先撳第一個藍色點，再撳第二個點', true);
controls.enabled = false;
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
if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 8) {
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
pointerDown = null;
clearPreview();
if (edgeDraw?.start && (activeTool === 'straight' || activeTool === 'free')) {
showFirstEndpoint(edgeDraw.start, activeTool);
}
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
function chineseNumber(value) {
const names = {
3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九',
10: '十', 11: '十一', 12: '十二',
};
return names[value] || String(value);
}
function degreeMap() {
const degree = new Map(vertices.map((vertex) => [vertex, 0]));
edges.forEach((edge) => {
degree.set(edge.a, (degree.get(edge.a) || 0) + 1);
degree.set(edge.b, (degree.get(edge.b) || 0) + 1);
});
return degree;
}
function countEdgesWithin(vertexList) {
const set = new Set(vertexList);
return edges.filter((edge) => set.has(edge.a) && set.has(edge.b)).length;
}
function countEdgesBetween(firstList, secondList) {
const first = new Set(firstList);
const second = new Set(secondList);
return edges.filter((edge) =>
(first.has(edge.a) && second.has(edge.b)) ||
(first.has(edge.b) && second.has(edge.a)),
).length;
}
function internalDegree(vertex, vertexList) {
const set = new Set(vertexList);
return connectedEdges(vertex).filter((edge) => {
const other = edge.a === vertex ? edge.b : edge.a;
return set.has(other);
}).length;
}
function detectPyramid(degree) {
const vertexCount = vertices.length;
if (vertexCount < 4) return null;
const sides = vertexCount - 1;
if (edges.length !== sides * 2) return null;
if (sides === 3) {
if (vertices.every((vertex) => degree.get(vertex) === 3) && hasCompleteGraph(vertices)) {
return { sides, apex: null };
}
return null;
}
const apexCandidates = vertices.filter((vertex) => degree.get(vertex) === sides);
if (apexCandidates.length !== 1) return null;
const apex = apexCandidates[0];
const base = vertices.filter((vertex) => vertex !== apex);
if (!base.every((vertex) => degree.get(vertex) === 3)) return null;
if (!base.every((vertex) => edgeExists(vertex, apex))) return null;
if (countEdgesWithin(base) !== sides) return null;
if (!base.every((vertex) => internalDegree(vertex, base) === 2)) return null;
return { sides, apex };
}
function detectPrism(degree) {
const vertexCount = vertices.length;
if (vertexCount < 6 || vertexCount % 2 !== 0) return null;
const sides = vertexCount / 2;
if (edges.length !== sides * 3) return null;
if (!vertices.every((vertex) => degree.get(vertex) === 3)) return null;
const groups = new Map();
vertices.forEach((vertex) => {
const key = Math.round(vertex.position.y * 1000) / 1000;
if (!groups.has(key)) groups.set(key, []);
groups.get(key).push(vertex);
});
const layers = [...groups.values()];
if (layers.length !== 2 || layers.some((layer) => layer.length !== sides)) return null;
const [firstLayer, secondLayer] = layers;
if (countEdgesWithin(firstLayer) !== sides) return null;
if (countEdgesWithin(secondLayer) !== sides) return null;
if (countEdgesBetween(firstLayer, secondLayer) !== sides) return null;
if (!firstLayer.every((vertex) => internalDegree(vertex, firstLayer) === 2)) return null;
if (!secondLayer.every((vertex) => internalDegree(vertex, secondLayer) === 2)) return null;
if (!firstLayer.every((vertex) => connectedEdges(vertex).filter((edge) => {
const other = edge.a === vertex ? edge.b : edge.a;
return secondLayer.includes(other);
}).length === 1)) return null;
return { sides, layers };
}
function fourSidedPrismName(prism) {
const xs = [...new Set(vertices.map((vertex) => vertex.position.x))];
const ys = [...new Set(vertices.map((vertex) => vertex.position.y))];
const zs = [...new Set(vertices.map((vertex) => vertex.position.z))];
if (xs.length === 2 && ys.length === 2 && zs.length === 2) {
const lengths = [
Math.abs(xs[1] - xs[0]),
Math.abs(ys[1] - ys[0]),
Math.abs(zs[1] - zs[0]),
];
const equal = Math.max(...lengths) - Math.min(...lengths) < 0.01;
return equal ? '正方體（四角柱體）' : '長方體（四角柱體）';
}
return '四角柱體';
}
function prismName(prism) {
if (prism.sides === 4) return fourSidedPrismName(prism);
return `${chineseNumber(prism.sides)}角柱`;
}
function pyramidName(pyramid) {
return `${chineseNumber(pyramid.sides)}角錐`;
}
function analyse() {
const degree = degreeMap();
const levels = new Set([
...vertices.map((vertex) => vertex.position.y),
...solids.map((solid) => layerY(Math.round((solid.position.y - solid.userData.halfHeight - BASE_Y) / STEP))),
]).size;
const parts = componentsCount();
const sphereCount = solids.filter((solid) => solid.userData.solidType === 'sphere').length;
const coneCount = solids.filter((solid) => solid.userData.solidType === 'cone').length;
const slantedCount = edges.filter((edge) => edge.mode === 'free').length;
let name = '未能辨認完整立體圖形';
let message = '請檢查所有頂點是否已經正確連接，並確保模型沒有分開的部分。';
let recognized = false;
if (!vertices.length && !solids.length) {
name = '模型仍是空白';
message = '先展開工具，再加入頂點、稜、球體或圓錐。';
} else if (sphereCount === 1 && coneCount === 0 && !vertices.length) {
name = '球體';
message = '球體只有1個曲面，沒有平面、稜和頂點。';
recognized = true;
} else if (coneCount === 1 && sphereCount === 0 && !vertices.length) {
name = '圓錐';
message = '圓錐有1個尖頂、1個圓形平面及1個曲面。';
recognized = true;
} else if (solids.length) {
name = '混合立體模型';
message = `模型包含 ${sphereCount} 個球體、${coneCount} 個圓錐，以及自行組裝的頂點與稜。`;
recognized = true;
} else {
const pyramid = detectPyramid(degree);
const prism = detectPrism(degree);
if (pyramid) {
name = pyramidName(pyramid);
message = `${name}有 ${pyramid.sides + 1} 個頂點、${pyramid.sides * 2} 條稜和 ${pyramid.sides + 1} 個面。`;
recognized = true;
} else if (prism) {
name = prismName(prism);
message = `${name}有 ${prism.sides * 2} 個頂點、${prism.sides * 3} 條稜和 ${prism.sides + 2} 個面。`;
recognized = true;
} else if (parts > 1) {
name = '模型有未連接部分';
message = `目前共有 ${parts} 個分開部分，請先把它們連接起來。`;
}
}
return { degree, levels, parts, sphereCount, coneCount, slantedCount, name, message, recognized };
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
document.getElementById('shapeName').textContent = result.recognized ? `這是：${result.name}` : result.name;
document.getElementById('shapeMessage').textContent = result.message;
const details = [];
if (vertices.length) {
details.push(`<b>每個頂點連接的稜：</b><br>${vertices.map((vertex) => `頂點 ${vertex.userData.id}：${result.degree.get(vertex) || 0} 條`).join('　 ')}`);
}
if (result.slantedCount) details.push(`<b>斜稜：</b>${result.slantedCount} 條。`);
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
