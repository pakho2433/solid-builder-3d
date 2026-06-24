import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const STEP = 2;
const BASE_Y = -2;
const MAX_LAYER = 4;
const GUIDE_SNAP_PX = 82;
const TARGET_SNAP_PX = 78;
const wrap = document.getElementById('canvasWrap');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xedf4fb);
const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 1000);
camera.position.set(9, 7.5, 11);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
wrap.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff, 0x72879c, 2.25));
const sun = new THREE.DirectionalLight(0xffffff, 2.05);
sun.position.set(8, 13, 9);
sun.castShadow = true;
scene.add(sun);
const grid = new THREE.GridHelper(24, 12, 0x8ca4c0, 0xc9d7e7);
grid.position.y = BASE_Y;
scene.add(grid);
const floor = new THREE.Mesh(
new THREE.PlaneGeometry(24, 24),
new THREE.ShadowMaterial({ color: 0x0f172a, opacity: 0.07 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = BASE_Y + 0.01;
floor.receiveShadow = true;
scene.add(floor);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, -0.4, 0);
controls.minDistance = 5;
controls.maxDistance = 28;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const workPlane = new THREE.Plane();
const workPoint = new THREE.Vector3();
const vertexGeometry = new THREE.SphereGeometry(0.29, 28, 20);
const edgeGeometry = new THREE.CylinderGeometry(0.085, 0.085, 1, 18);
const vertices = [];
const edges = [];
const solids = [];
let nextVertexId = 1;
let nextEdgeId = 1;
let nextSolidId = 1;
let currentLayer = 0;
let selected = null;
let activeTool = null;
let objectDrag = null;
let edgeDraw = null;
let pointerDown = null;
let toastTimer;
let guideType = 'none';
let guidePoints = [];
let guideLinks = [];
const guideGroup = new THREE.Group();
const faceGroup = new THREE.Group();
const previewGroup = new THREE.Group();
scene.add(guideGroup, faceGroup, previewGroup);
const ui = {
vertexCount: document.getElementById('vertexCount'),
edgeCount: document.getElementById('edgeCount'),
solidCount: document.getElementById('solidCount'),
selection: document.getElementById('selection'),
selectionName: document.getElementById('selectionName'),
toast: document.getElementById('toast'),
layerValue: document.getElementById('layerValue'),
hint: document.getElementById('hint'),
toolbox: document.getElementById('toolbox'),
toolToggle: document.getElementById('toolToggle'),
toolToggleText: document.getElementById('toolToggleText'),
guideSelect: document.getElementById('guideSelect'),
};
const haloGeometry = new THREE.SphereGeometry(0.43, 22, 16);
const haloMaterial = new THREE.MeshBasicMaterial({
color: 0x20c77b,
transparent: true,
opacity: 0.48,
depthWrite: false,
});
const snapHaloA = new THREE.Mesh(haloGeometry, haloMaterial.clone());
const snapHaloB = new THREE.Mesh(haloGeometry, haloMaterial.clone());
snapHaloA.visible = false;
snapHaloB.visible = false;
previewGroup.add(snapHaloA, snapHaloB);
const previewEdge = new THREE.Mesh(
new THREE.CylinderGeometry(0.06, 0.06, 1, 14),
new THREE.MeshBasicMaterial({
color: 0x18b36e,
transparent: true,
opacity: 0.8,
depthWrite: false,
}),
);
previewEdge.visible = false;
previewGroup.add(previewEdge);
const previewVertex = new THREE.Mesh(
vertexGeometry,
new THREE.MeshStandardMaterial({
color: 0x20c77b,
transparent: true,
opacity: 0.76,
roughness: 0.25,
}),
);
previewVertex.visible = false;
previewGroup.add(previewVertex);
function makeVertexMaterial() {
return new THREE.MeshStandardMaterial({
color: 0x315eea,
roughness: 0.27,
emissive: 0x000000,
});
}
function makeEdgeMaterial(mode) {
return new THREE.MeshStandardMaterial({
color: mode === 'free' ? 0x6d28d9 : 0x1f2937,
roughness: 0.33,
emissive: 0x000000,
});
}
function resize() {
const width = wrap.clientWidth;
const height = wrap.clientHeight;
renderer.setSize(width, height, false);
camera.aspect = width / Math.max(height, 1);
camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
function showToast(text) {
clearTimeout(toastTimer);
ui.toast.textContent = text;
ui.toast.classList.add('show');
toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1900);
}
function setHint(text, active = false) {
ui.hint.textContent = text;
ui.hint.classList.toggle('snap', active);
}
function setToolsOpen(open) {
ui.toolbox.classList.toggle('collapsed', !open);
document.body.classList.toggle('tools-open', open);
ui.toolToggle.setAttribute('aria-expanded', String(open));
ui.toolToggleText.textContent = open ? '收起零件工具' : '展開零件工具';
}
ui.toolToggle.addEventListener('click', () => {
setToolsOpen(ui.toolbox.classList.contains('collapsed'));
});
setToolsOpen(false);
function setPointer(clientX, clientY) {
const rect = renderer.domElement.getBoundingClientRect();
pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
raycaster.setFromCamera(pointer, camera);
}
function worldToScreen(position) {
const projected = position.clone().project(camera);
const rect = renderer.domElement.getBoundingClientRect();
return {
x: rect.left + ((projected.x + 1) / 2) * rect.width,
y: rect.top + ((-projected.y + 1) / 2) * rect.height,
};
}
function screenDistance(position, x, y) {
const point = worldToScreen(position);
return Math.hypot(point.x - x, point.y - y);
}
function layerY(layer = currentLayer) {
return BASE_Y + layer * STEP;
}
function pointOnLayer(clientX, clientY, layer = currentLayer) {
setPointer(clientX, clientY);
workPlane.set(new THREE.Vector3(0, 1, 0), -layerY(layer));
if (!raycaster.ray.intersectPlane(workPlane, workPoint)) return null;
return new THREE.Vector3(
Math.round(workPoint.x / STEP) * STEP,
layerY(layer),
Math.round(workPoint.z / STEP) * STEP,
);
}
function pointKey(position) {
return [
Math.round(position.x / STEP),
Math.round((position.y - BASE_Y) / STEP),
Math.round(position.z / STEP),
].join(',');
}
function findVertexAt(position, except = null) {
const key = pointKey(position);
return vertices.find((vertex) => vertex !== except && pointKey(vertex.position) === key) || null;
}
function pickObject(clientX, clientY) {
setPointer(clientX, clientY);
return raycaster.intersectObjects(
[...vertices, ...edges.map((edge) => edge.mesh), ...solids],
false,
)[0]?.object || null;
}
function nearestVertex(clientX, clientY, except = null, maxDistance = TARGET_SNAP_PX) {
let best = null;
vertices.forEach((vertex) => {
if (vertex === except) return;
const distance = screenDistance(vertex.position, clientX, clientY);
if (distance <= maxDistance && (!best || distance < best.distance)) {
best = { vertex, distance };
}
});
return best;
}
function nearestGuidePoint(clientX, clientY, exceptVertex = null) {
let best = null;
guidePoints.forEach((position, index) => {
const occupied = findVertexAt(position, exceptVertex);
if (occupied && occupied !== exceptVertex) return;
const distance = screenDistance(position, clientX, clientY);
if (distance <= GUIDE_SNAP_PX && (!best || distance < best.distance)) {
best = { position: position.clone(), index, distance };
}
});
return best;
}
function isAxisAligned(a, b) {
const changedAxes = [
Math.abs(a.x - b.x) > 0.01,
Math.abs(a.y - b.y) > 0.01,
Math.abs(a.z - b.z) > 0.01,
].filter(Boolean).length;
return changedAxes === 1;
}
function edgeExists(a, b, except = null) {
return edges.some(
(edge) => edge !== except && ((edge.a === a && edge.b === b) || (edge.a === b && edge.b === a)),
);
}
function connectedEdges(vertex) {
return edges.filter((edge) => edge.a === vertex || edge.b === vertex);
}
function updateUI() {
ui.vertexCount.textContent = vertices.length;
ui.edgeCount.textContent = edges.length;
ui.solidCount.textContent = solids.length;
ui.layerValue.textContent = currentLayer + 1;
}
function createVertex(position) {
const existing = findVertexAt(position);
if (existing) return existing;
const mesh = new THREE.Mesh(vertexGeometry, makeVertexMaterial());
mesh.position.copy(position);
mesh.castShadow = true;
mesh.userData = { kind: 'vertex', id: nextVertexId++ };
scene.add(mesh);
vertices.push(mesh);
updateUI();
updateFaces();
return mesh;
}
function updateEdge(edge) {
const start = edge.a.position;
const end = edge.b.position;
const direction = end.clone().sub(start);
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
vertices.length = 0;edges.length = 0;
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
guideGroup.visible = true;
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
opacity: 0.48,
depthWrite: false,
});
const edgeMaterial = new THREE.MeshBasicMaterial({
color: pyramid ? 0x8b5cf6 : 0x60a5fa,
transparent: true,
opacity: 0.28,
depthWrite: false,
});
guidePoints.forEach((point) => {
const marker = new THREE.Mesh(new THREE.SphereGeometry(0.31, 18, 14), vertexMaterial.clone());
marker.position.copy(point);
guideGroup.add(marker);
});
guideLinks.forEach(([a, b]) => addGuideEdge(guidePoints[a], guidePoints[b], edgeMaterial.clone()));
}
function faceMaterial() {
return new THREE.MeshStandardMaterial({
color: 0xf59e0b,
transparent: true,
opacity: 0.25,
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
function guideVertices() {
return guidePoints.map((point) => findVertexAt(point));
}
function guideIsComplete() {
if (!guidePoints.length) return false;
const mapped = guideVertices();
if (mapped.some((vertex) => !vertex)) return false;
return guideLinks.every(([a, b]) => edgeExists(mapped[a], mapped[b]));
}
function updateFaces() {
clearGroup(faceGroup);
guideGroup.visible = true;
if ((guideType === 'triPyramid' || guideType === 'squarePyramid') && guideIsComplete()) {
const mapped = guideVertices();
if (guideType === 'triPyramid') {
addTriangleFace(mapped[0].position, mapped[1].position, mapped[2].position);
addTriangleFace(mapped[0].position, mapped[1].position, mapped[3].position);
addTriangleFace(mapped[0].position, mapped[2].position, mapped[3].position);
addTriangleFace(mapped[1].position, mapped[2].position, mapped[3].position);
} else {
addTriangleFace(mapped[0].position, mapped[1].position, mapped[2].position);
addTriangleFace(mapped[0].position, mapped[2].position, mapped[3].position);
addTriangleFace(mapped[0].position, mapped[1].position, mapped[4].position);
addTriangleFace(mapped[1].position, mapped[2].position, mapped[4].position);
addTriangleFace(mapped[2].position, mapped[3].position, mapped[4].position);
addTriangleFace(mapped[3].position, mapped[0].position, mapped[4].position);
}
guideGroup.visible = false;
return;
}
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
function endpointCandidate(clientX, clientY, exceptVertex = null, createMissing = false) {
const existing = nearestVertex(clientX, clientY, exceptVertex, 92);
if (existing) return { vertex: existing.vertex, position: existing.vertex.position.clone(), fromGuide: false };
const guide = nearestGuidePoint(clientX, clientY, exceptVertex);
if (!guide) return null;
let vertex = findVertexAt(guide.position, exceptVertex);
if (!vertex && createMissing) vertex = createVertex(guide.position);
return { vertex, position: guide.position.clone(), fromGuide: true, guideIndex: guide.index };
}
function showFirstEndpoint(vertex, mode) {
clearPreview();
snapHaloA.position.copy(vertex.position);
snapHaloA.visible = true;
setHint(mode === 'free' ? '已選第一點；再撳另一個紫色或藍色點' : '已選第一點；再撳第二個藍色點', true);
}
function createConnection(start, target, requestedMode) {
if (!start || !target || start === target) return null;
const actualMode = requestedMode === 'free'
? (isAxisAligned(start.position, target.position) ? 'straight' : 'free')
: 'straight';
if (actualMode === 'straight' && !isAxisAligned(start.position, target.position)) return 'needs-free';
return createEdge(start, target, actualMode);
}
ui.guideSelect.addEventListener('change', (event) => {
setGuide(event.target.value);
if (event.target.value === 'triPyramid' || event.target.value === 'squarePyramid') {
setToolsOpen(false);
setActiveTool('free', { keepDrawer: true });
showToast('直接撳兩個紫色或藍色點連線；缺少的頂點會自動建立');
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
setActiveTool(tool, { toggle: true });
});
});
renderer.domElement.addEventListener('pointermove', (event) => {
if (activeTool === 'vertex' && !pointerDown) {
const candidate = placementCandidate(event.clientX, event.clientY);
if (candidate) showPlacementPreview(candidate.position, candidate.fromGuide ? '撳下會吸附到導引點' : '撳下放置頂點');
return;
}
if ((activeTool === 'straight' || activeTool === 'free') && edgeDraw?.start) {
const candidate = endpointCandidate(event.clientX, event.clientY, edgeDraw.start, false);
if (candidate && candidate.position) {
showConnectionPreview(edgeDraw.start, candidate.vertex || { position: candidate.position }, activeTool);
} else {
showFirstEndpoint(edgeDraw.start, activeTool);
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
if (activeTool === 'vertex' || activeTool === 'sphere' || activeTool === 'cone') {
event.preventDefault();
controls.enabled = false;
return;
}
if (activeTool === 'straight' || activeTool === 'free') {
event.preventDefault();
controls.enabled = false;
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
objectDrag = {kind: 'solid', item: object, startX: event.clientX, startY: event.clientY,
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
