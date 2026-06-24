const length = Math.max(direction.length(), 0.01);
edge.mesh.position.copy(start).add(end).multiplyScalar(0.5);
edge.mesh.scale.set(1, length, 1);
edge.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
}
function setPreviewEdge(start, end, mode = 'straight') {
const direction = end.clone().sub(start);
const length = Math.max(direction.length(), 0.01);
previewEdge.position.copy(start).add(end).multiplyScalar(0.5);
previewEdge.scale.set(1, length, 1);
previewEdge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
previewEdge.material.color.setHex(mode === 'free' ? 0x8b5cf6 : 0x18b36e);
previewEdge.visible = true;
}
function createEdge(a, b, mode = 'straight') {
if (!a || !b || a === b || edgeExists(a, b)) return null;
if (mode === 'straight' && !isAxisAligned(a.position, b.position)) return null;
const mesh = new THREE.Mesh(edgeGeometry, makeEdgeMaterial(mode));
mesh.castShadow = true;
mesh.userData = { kind: 'edge' };
const edge = { id: nextEdgeId++, a, b, mode, mesh };
mesh.userData.edge = edge;
scene.add(mesh);
edges.push(edge);
updateEdge(edge);
updateUI();
updateFaces();
return edge;
}
function createSolid(type, basePosition) {
const sphere = type === 'sphere';
const halfHeight = sphere ? 0.78 : 0.8;
const geometry = sphere
? new THREE.SphereGeometry(0.78, 36, 24)
: new THREE.ConeGeometry(0.78, 1.6, 36, 1, false);
const material = new THREE.MeshStandardMaterial({
color: sphere ? 0x9333ea : 0xf97316,
roughness: 0.3,
metalness: 0.03,
emissive: 0x000000,
});
const mesh = new THREE.Mesh(geometry, material);
mesh.position.set(basePosition.x, basePosition.y + halfHeight, basePosition.z);
mesh.castShadow = true;
mesh.receiveShadow = true;
mesh.userData = { kind: 'solid', solidType: type, id: nextSolidId++, halfHeight };
scene.add(mesh);
solids.push(mesh);
updateUI();
return mesh;
}
function removeEdge(edge) {
scene.remove(edge.mesh);
const index = edges.indexOf(edge);
if (index >= 0) edges.splice(index, 1);
updateFaces();
}
function removeDuplicateEdges() {
for (let i = edges.length - 1; i >= 0; i -= 1) {
const edge = edges[i];
if (edge.a === edge.b) {
removeEdge(edge);
continue;
}
for (let j = 0; j < i; j += 1) {
const other = edges[j];
if ((other.a === edge.a && other.b === edge.b) || (other.a === edge.b && other.b === edge.a)) {
removeEdge(edge);
break;
}
}
}
}
function mergeVertices(source, target) {
if (source === target) return target;
edges.forEach((edge) => {
if (edge.a === source) edge.a = target;
if (edge.b === source) edge.b = target;
});
removeDuplicateEdges();
scene.remove(source);
const index = vertices.indexOf(source);
if (index >= 0) vertices.splice(index, 1);
updateUI();
updateFaces();
return target;
}
function clearPreview() {
snapHaloA.visible = false;
snapHaloB.visible = false;
previewEdge.visible = false;
previewVertex.visible = false;
snapHaloA.scale.setScalar(1);
snapHaloB.scale.setScalar(1);
}
function showPlacementPreview(position, text) {
clearPreview();
previewVertex.position.copy(position);
previewVertex.visible = true;
snapHaloA.position.copy(position);
snapHaloA.visible = true;
setHint(text, true);
}
function showConnectionPreview(start, target, mode) {
clearPreview();
snapHaloA.position.copy(start.position);
snapHaloB.position.copy(target.position);
snapHaloA.visible = true;
snapHaloB.visible = true;
setPreviewEdge(start.position, target.position, mode);
setHint(mode === 'free' ? '第二點亮綠色，撳一下完成連線' : '第二點亮綠色，撳一下完成直稜', true);
}
function clearSelection() {
if (selected?.type === 'vertex') {
selected.item.material.emissive.setHex(0);
selected.item.scale.setScalar(1);
}
if (selected?.type === 'edge') {
selected.item.mesh.material.emissive.setHex(0);
selected.item.mesh.scale.x = 1;
selected.item.mesh.scale.z = 1;
}
if (selected?.type === 'solid') {
selected.item.material.emissive.setHex(0);
selected.item.scale.setScalar(1);
}
selected = null;
ui.selection.classList.remove('show');
}
function showLayerButtons(show) {
document.getElementById('moveUpBtn').style.display = show ? 'block' : 'none';
document.getElementById('moveDownBtn').style.display = show ? 'block' : 'none';
}
function selectVertex(vertex) {
clearSelection();
selected = { type: 'vertex', item: vertex };
vertex.material.emissive.setHex(0x9a5b00);
vertex.scale.setScalar(1.17);
ui.selectionName.textContent = `頂點 ${vertex.userData.id}`;
ui.selection.classList.add('show');
showLayerButtons(true);
}
function selectEdge(edge) {
clearSelection();
selected = { type: 'edge', item: edge };
edge.mesh.material.emissive.setHex(0x9a5b00);
edge.mesh.scale.x = 1.25;
edge.mesh.scale.z = 1.25;
ui.selectionName.textContent = `${edge.mode === 'free' ? '斜稜' : '直稜'} ${edge.id}`;
ui.selection.classList.add('show');
showLayerButtons(false);
}
function selectSolid(solid) {
clearSelection();
selected = { type: 'solid', item: solid };
solid.material.emissive.setHex(0x704000);
solid.scale.setScalar(1.08);
ui.selectionName.textContent = `${solid.userData.solidType === 'sphere' ? '球體' : '圓錐'} ${solid.userData.id}`;
ui.selection.classList.add('show');
showLayerButtons(true);
}
function setActiveTool(tool, { keepDrawer = false, toggle = false } = {}) {
activeTool = toggle && activeTool === tool ? null : tool;
document.querySelectorAll('[data-tool]').forEach((card) => {
const cardTool = card.dataset.tool === 'free-edge' ? 'free' : card.dataset.tool === 'edge' ? 'straight' : card.dataset.tool;
card.classList.toggle('active', cardTool === activeTool);
});
clearSelection();
controls.enabled = !activeTool;
clearPreview();
edgeDraw = null;
if (!activeTool) {
setHint('撳下方箭嘴展開工具；綠色位置代表可自動吸附');
return;
}
const messages = {
vertex: '在畫布撳一下放置頂點；導引點會自動吸附',
straight: '先撳第一個點，再撳第二個點建立直稜',
free: '先撳第一個紫色或藍色點，再撳第二個點建立稜',
sphere: '在畫布撳一下放置球體',
cone: '在畫布撳一下放置圓錐',
};
setHint(messages[activeTool], true);
if (!keepDrawer) setToolsOpen(false);
}
function placementCandidate(clientX, clientY, layer = currentLayer, exceptVertex = null) {
const guide = nearestGuidePoint(clientX, clientY, exceptVertex);
if (guide) return { position: guide.position, fromGuide: true, guideIndex: guide.index };
const position = pointOnLayer(clientX, clientY, layer);
return position ? { position, fromGuide: false } : null;
}
function validVertexPosition(vertex, position, mergeTarget = null) {
if (position.y < BASE_Y || position.y > layerY(MAX_LAYER - 1)) return false;
const occupied = findVertexAt(position, vertex);
if (occupied && occupied !== mergeTarget) return false;
return connectedEdges(vertex).every((edge) => {
if (edge.mode === 'free') return true;
const neighbour = edge.a === vertex ? edge.b : edge.a;
if (mergeTarget && neighbour === mergeTarget) return true;
return isAxisAligned(position, neighbour.position);
});
}
function deleteSelected() {
if (!selected) return;
if (selected.type === 'edge') {
removeEdge(selected.item);
clearSelection();
updateUI();
showToast('已刪除稜');
return;
}
if (selected.type === 'solid') {
const solid = selected.item;
scene.remove(solid);
solids.splice(solids.indexOf(solid), 1);
clearSelection();
updateUI();
showToast('已刪除曲面立體');
return;
}
const vertex = selected.item;
[...connectedEdges(vertex)].forEach(removeEdge);
scene.remove(vertex);
vertices.splice(vertices.indexOf(vertex), 1);
clearSelection();
updateUI();
updateFaces();
showToast('已刪除頂點及相連稜');
}
function moveSelectedLayer(delta) {
if (!selected || selected.type === 'edge') return;
if (selected.type === 'solid') {
const solid = selected.item;
const oldLayer = Math.round((solid.position.y - solid.userData.halfHeight - BASE_Y) / STEP);
const newLayer = Math.max(0, Math.min(MAX_LAYER - 1, oldLayer + delta));
solid.position.y = layerY(newLayer) + solid.userData.halfHeight;
currentLayer = newLayer;
updateUI();
showToast(`${solid.userData.solidType === 'sphere' ? '球體' : '圓錐'}已移到第 ${newLayer + 1} 層`);
return;
}
const vertex = selected.item;
const nextPosition = vertex.position.clone();
nextPosition.y += delta * STEP;
if (!validVertexPosition(vertex, nextPosition)) {
showToast('直稜會變斜；請使用斜稜或先刪除直稜');
return;
}
vertex.position.copy(nextPosition);
currentLayer = Math.round((nextPosition.y - BASE_Y) / STEP);
edges.forEach(updateEdge);
updateFaces();
updateUI();
showToast(`頂點已移到第 ${currentLayer + 1} 層`);
}
function resetView() {
camera.position.set(9, 7.5, 11);
controls.target.set(0, -0.4, 0);
controls.update();
showToast('已重設視角');
}
function clearAll() {
clearSelection();
clearPreview();
vertices.forEach((vertex) => scene.remove(vertex));
edges.forEach((edge) => scene.remove(edge.mesh));
solids.forEach((solid) => scene.remove(solid));
vertices.length = 0;