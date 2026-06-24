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
