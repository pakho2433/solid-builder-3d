edges.length = 0;
solids.length = 0;
nextVertexId = 1;
nextEdgeId = 1;
nextSolidId = 1;
activeTool = null;
controls.enabled = true;
document.querySelectorAll('[data-tool]').forEach((card) => card.classList.remove('active'));
updateUI();
updateFaces();
setHint('撳下方箭嘴展開工具；綠色位置代表可自動吸附');
}
function clearGroup(group) {
while (group.children.length) {
const child = group.children.pop();
child.geometry?.dispose();
child.material?.dispose();
}
}
function addGuideEdge(start, end, material) {
const direction = end.clone().sub(start);
const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 10), material);
mesh.position.copy(start).add(end).multiplyScalar(0.5);
mesh.scale.set(1, direction.length(), 1);
mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
guideGroup.add(mesh);
}
function setGuide(type) {
guideType = type;
clearGroup(guideGroup);
guidePoints = [];
guideLinks = [];
if (type === 'none') return;
const bottom = BASE_Y;
const top = BASE_Y + STEP;
if (type === 'cube' || type === 'cuboid') {
const x = type === 'cube' ? 2 : 4;
const z = 2;
guidePoints = [
[-x, bottom, -z], [x, bottom, -z], [x, bottom, z], [-x, bottom, z],
[-x, top, -z], [x, top, -z], [x, top, z], [-x, top, z],
].map((point) => new THREE.Vector3(...point));
guideLinks = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
} else if (type === 'triPyramid') {
guidePoints = [
[-2, bottom, -2], [2, bottom, -2], [0, bottom, 2], [0, top, 0],
].map((point) => new THREE.Vector3(...point));
guideLinks = [[0,1],[1,2],[2,0],[0,3],[1,3],[2,3]];
} else {
guidePoints = [
[-2, bottom, -2], [2, bottom, -2], [2, bottom, 2], [-2, bottom, 2], [0, top, 0],
].map((point) => new THREE.Vector3(...point));
guideLinks = [[0,1],[1,2],[2,3],[3,0],[0,4],[1,4],[2,4],[3,4]];
}
const pyramid = type === 'triPyramid' || type === 'squarePyramid';
const vertexMaterial = new THREE.MeshBasicMaterial({
color: pyramid ? 0xa78bfa : 0x60a5fa,
transparent: true,
opacity: 0.42,
depthWrite: false,
});
const edgeMaterial = new THREE.MeshBasicMaterial({
color: pyramid ? 0x8b5cf6 : 0x60a5fa,
transparent: true,
opacity: 0.28,
depthWrite: false,
});
guidePoints.forEach((point) => {
const marker = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), vertexMaterial.clone());
marker.position.copy(point);
guideGroup.add(marker);
});
guideLinks.forEach(([a, b]) => addGuideEdge(guidePoints[a], guidePoints[b], edgeMaterial.clone()));
}
function faceMaterial() {
return new THREE.MeshStandardMaterial({
color: 0xf59e0b,
transparent: true,
opacity: 0.22,
side: THREE.DoubleSide,
depthWrite: false,
roughness: 0.55,
});
}
function addTriangleFace(a, b, c) {
const geometry = new THREE.BufferGeometry();
geometry.setAttribute(
'position',
new THREE.Float32BufferAttribute([
a.x, a.y, a.z,
b.x, b.y, b.z,
c.x, c.y, c.z,
], 3),
);
geometry.computeVertexNormals();
const mesh = new THREE.Mesh(geometry, faceMaterial());
mesh.renderOrder = 1;
faceGroup.add(mesh);
}
function hasCompleteGraph(vertexList) {
for (let i = 0; i < vertexList.length; i += 1) {
for (let j = i + 1; j < vertexList.length; j += 1) {
if (!edgeExists(vertexList[i], vertexList[j])) return false;
}
}
return true;
}
function updateFaces() {
clearGroup(faceGroup);
if (vertices.length === 4 && edges.length === 6 && hasCompleteGraph(vertices)) {
addTriangleFace(vertices[0].position, vertices[1].position, vertices[2].position);
addTriangleFace(vertices[0].position, vertices[1].position, vertices[3].position);
addTriangleFace(vertices[0].position, vertices[2].position, vertices[3].position);
addTriangleFace(vertices[1].position, vertices[2].position, vertices[3].position);
return;
}
if (vertices.length === 5 && edges.length === 8) {
const degree = new Map(vertices.map((vertex) => [vertex, 0]));
edges.forEach((edge) => {
degree.set(edge.a, degree.get(edge.a) + 1);
degree.set(edge.b, degree.get(edge.b) + 1);
});
const apex = vertices.find((vertex) => degree.get(vertex) === 4);
if (!apex) return;
const base = vertices.filter((vertex) => vertex !== apex && degree.get(vertex) === 3);
if (base.length !== 4 || !base.every((vertex) => edgeExists(vertex, apex))) return;
const centre = base.reduce((sum, vertex) => sum.add(vertex.position), new THREE.Vector3()).multiplyScalar(0.25);
base.sort((a, b) =>
Math.atan2(a.position.z - centre.z, a.position.x - centre.x) -
Math.atan2(b.position.z - centre.z, b.position.x - centre.x),
);
addTriangleFace(base[0].position, base[1].position, base[2].position);
addTriangleFace(base[0].position, base[2].position, base[3].position);
for (let i = 0; i < 4; i += 1) {
addTriangleFace(base[i].position, base[(i + 1) % 4].position, apex.position);
}
}
}
function guideProgress() {
if (!guidePoints.length) return null;
const placed = guidePoints.filter((point) => findVertexAt(point)).length;
const completeLinks = guideLinks.filter(([a, b]) => {
const va = findVertexAt(guidePoints[a]);
const vb = findVertexAt(guidePoints[b]);
return va && vb && edgeExists(va, vb);
}).length;
return { placed, totalPoints: guidePoints.length, completeLinks, totalLinks: guideLinks.length };
}
ui.guideSelect.addEventListener('change', (event) => {
setGuide(event.target.value);
if (event.target.value === 'triPyramid' || event.target.value === 'squarePyramid') {
setToolsOpen(false);
setActiveTool('vertex', { keepDrawer: true });
showToast('第一步：撳淡紫色圓點放置全部頂點');
} else {
setActiveTool(null, { keepDrawer: true });
showToast(event.target.value === 'none' ? '已關閉導引' : '已顯示淡色導引');
}
});
document.querySelectorAll('[data-tool]').forEach((card) => {
card.addEventListener('click', () => {
const tool = card.dataset.tool === 'edge'
? 'straight'
: card.dataset.tool === 'free-edge'
? 'free'
: card.dataset.tool;
setActiveTool(tool);
});
});
renderer.domElement.addEventListener('pointermove', (event) => {
if (activeTool === 'vertex' && !pointerDown) {
const candidate = placementCandidate(event.clientX, event.clientY);
if (candidate) showPlacementPreview(candidate.position, candidate.fromGuide ? '放手／撳下會吸附到導引點' : '撳下放置頂點');
return;
}
if (edgeDraw) {
const nearest = nearestVertex(event.clientX, event.clientY, edgeDraw.start);
edgeDraw.target = nearest?.vertex || null;
if (edgeDraw.target) {
const valid = edgeDraw.mode === 'free' || isAxisAligned(edgeDraw.start.position, edgeDraw.target.position);
if (valid) showConnectionPreview(edgeDraw.start, edgeDraw.target, edgeDraw.mode);
else {
clearPreview();
setHint('直稜只可水平、前後或垂直；請改用斜稜', false);
}
} else {
clearPreview();
snapHaloA.position.copy(edgeDraw.start.position);
snapHaloA.visible = true;
setHint('拖到第二個頂點，目標會亮綠色', true);
}
return;
}
if (!objectDrag) return;
if (Math.hypot(event.clientX - objectDrag.startX, event.clientY - objectDrag.startY) > 5) {
objectDrag.moved = true;
}
if (!objectDrag.moved) return;
if (objectDrag.kind === 'vertex') {
const targetVertex = nearestVertex(event.clientX, event.clientY, objectDrag.item);
if (targetVertex && validVertexPosition(objectDrag.item, targetVertex.vertex.position, targetVertex.vertex)) {
objectDrag.candidate = { type: 'merge', vertex: targetVertex.vertex, position: targetVertex.vertex.position.clone() };
} else {
const candidate = placementCandidate(event.clientX, event.clientY, objectDrag.layer, objectDrag.item);
objectDrag.candidate = candidate ? { type: 'move', ...candidate } : null;
}
if (objectDrag.candidate && validVertexPosition(objectDrag.item, objectDrag.candidate.position, objectDrag.candidate.vertex || null)) {
objectDrag.item.position.copy(objectDrag.candidate.position);
edges.forEach(updateEdge);
showPlacementPreview(objectDrag.candidate.position, objectDrag.candidate.type === 'merge' ? '放手後合併頂點' : '放手後移到綠色位置');
}
return;
}
if (objectDrag.kind === 'solid') {
const candidate = placementCandidate(event.clientX, event.clientY, objectDrag.layer);
objectDrag.candidate = candidate;
if (candidate) {
objectDrag.item.position.set(
candidate.position.x,
candidate.position.y + objectDrag.item.userData.halfHeight,
candidate.position.z,
);
clearPreview();
snapHaloA.position.copy(candidate.position);
snapHaloA.visible = true;
setHint('放手後移到綠色位置', true);
}
}
});
renderer.domElement.addEventListener('pointerdown', (event) => {
pointerDown = { x: event.clientX, y: event.clientY };
if (activeTool === 'vertex') {
event.preventDefault();
controls.enabled = false;
return;
}
if (activeTool === 'sphere' || activeTool === 'cone') {
event.preventDefault();
controls.enabled = false;
return;
}
if (activeTool === 'straight' || activeTool === 'free') {
event.preventDefault();
controls.enabled = false;
const start = nearestVertex(event.clientX, event.clientY, null, 60)?.vertex;
if (!start) {
showToast('請由第一個藍色頂點開始拖動');
return;
}
edgeDraw = { start, target: null, mode: activeTool };
snapHaloA.position.copy(start.position);
snapHaloA.visible = true;
setHint('拖到第二個頂點，目標會亮綠色', true);
return;
}
const object = pickObject(event.clientX, event.clientY);
if (!object) return;
event.preventDefault();
controls.enabled = false;
if (object.userData.kind === 'vertex') {
objectDrag = {
kind: 'vertex', item: object, startX: event.clientX, startY: event.clientY,
moved: false, original: object.position.clone(),
layer: Math.round((object.position.y - BASE_Y) / STEP), candidate: null,
};
} else if (object.userData.kind === 'solid') {
objectDrag = {
