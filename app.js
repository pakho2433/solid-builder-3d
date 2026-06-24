import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const STEP = 2;
const BASE_Y = -2;
const MAX_LAYER = 4;
const SNAP_PX = 72;

const DIRECTIONS = [
  new THREE.Vector3(STEP, 0, 0),
  new THREE.Vector3(-STEP, 0, 0),
  new THREE.Vector3(0, 0, STEP),
  new THREE.Vector3(0, 0, -STEP),
  new THREE.Vector3(0, STEP, 0),
  new THREE.Vector3(0, -STEP, 0),
];

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
let toolDrag = null;
let objectDrag = null;
let toastTimer;

const guideGroup = new THREE.Group();
scene.add(guideGroup);

const ui = {
  vertexCount: document.getElementById('vertexCount'),
  edgeCount: document.getElementById('edgeCount'),
  solidCount: document.getElementById('solidCount'),
  selection: document.getElementById('selection'),
  selectionName: document.getElementById('selectionName'),
  toast: document.getElementById('toast'),
  ghost: document.getElementById('dragGhost'),
  ghostIcon: document.getElementById('ghostIcon'),
  ghostText: document.getElementById('ghostText'),
  layerValue: document.getElementById('layerValue'),
  hint: document.getElementById('hint'),
};

const snapGroup = new THREE.Group();
scene.add(snapGroup);

const haloGeometry = new THREE.SphereGeometry(0.43, 22, 16);
const haloMaterial = new THREE.MeshBasicMaterial({
  color: 0x20c77b,
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
});

const snapHaloA = new THREE.Mesh(haloGeometry, haloMaterial.clone());
const snapHaloB = new THREE.Mesh(haloGeometry, haloMaterial.clone());
snapHaloA.visible = false;
snapHaloB.visible = false;
snapGroup.add(snapHaloA, snapHaloB);

const snapEdge = new THREE.Mesh(
  new THREE.CylinderGeometry(0.055, 0.055, 1, 12),
  new THREE.MeshBasicMaterial({
    color: 0x18b36e,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  }),
);
snapEdge.visible = false;
snapGroup.add(snapEdge);

const previewVertex = new THREE.Mesh(
  vertexGeometry,
  new THREE.MeshStandardMaterial({
    color: 0x20c77b,
    transparent: true,
    opacity: 0.72,
    roughness: 0.25,
  }),
);
previewVertex.visible = false;
scene.add(previewVertex);

function makeVertexMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x315eea,
    roughness: 0.27,
    emissive: 0x000000,
  });
}

function makeEdgeMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x1f2937,
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
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1700);
}

function setHint(text, isSnap = false) {
  ui.hint.textContent = text;
  ui.hint.classList.toggle('snap', isSnap);
  ui.ghost.classList.toggle('snap', isSnap);
}

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
    (edge) =>
      edge !== except &&
      ((edge.a === a && edge.b === b) || (edge.a === b && edge.b === a)),
  );
}

function connectedEdges(vertex) {
  return edges.filter((edge) => edge.a === vertex || edge.b === vertex);
}

function updateUI() {
  ui.vertexCount.textContent = vertices.length;
  ui.edgeCount.textContent = edges.length;
  if (ui.solidCount) ui.solidCount.textContent = solids.length;
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
  return mesh;
}

function updateEdge(edge) {
  const start = edge.a.position;
  const end = edge.b.position;
  const direction = end.clone().sub(start);
  const length = Math.max(direction.length(), 0.01);

  edge.mesh.position.copy(start).add(end).multiplyScalar(0.5);
  edge.mesh.scale.set(1, length, 1);
  edge.mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
}

function createEdge(a, b) {
  if (!a || !b || a === b || !isAxisAligned(a.position, b.position) || edgeExists(a, b)) {
    return null;
  }

  const mesh = new THREE.Mesh(edgeGeometry, makeEdgeMaterial());
  mesh.castShadow = true;
  mesh.userData = { kind: 'edge' };

  const edge = { id: nextEdgeId++, a, b, mesh };
  mesh.userData.edge = edge;

  scene.add(mesh);
  edges.push(edge);
  updateEdge(edge);
  updateUI();
  return edge;
}

function createSolid(type, basePosition) {
  const isSphere = type === 'sphere';
  const halfHeight = isSphere ? 0.78 : 0.8;
  const geometry = isSphere
    ? new THREE.SphereGeometry(0.78, 36, 24)
    : new THREE.ConeGeometry(0.78, 1.6, 36, 1, false);

  const material = new THREE.MeshStandardMaterial({
    color: isSphere ? 0x9333ea : 0xf97316,
    roughness: 0.3,
    metalness: 0.03,
    emissive: 0x000000,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(basePosition.x, basePosition.y + halfHeight, basePosition.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    kind: 'solid',
    solidType: type,
    id: nextSolidId++,
    halfHeight,
  };

  scene.add(mesh);
  solids.push(mesh);
  updateUI();
  return mesh;
}

function removeEdge(edge) {
  scene.remove(edge.mesh);
  const index = edges.indexOf(edge);
  if (index >= 0) edges.splice(index, 1);
}

function removeDuplicateEdges() {
  for (let index = edges.length - 1; index >= 0; index -= 1) {
    const edge = edges[index];
    if (edge.a === edge.b) {
      removeEdge(edge);
      continue;
    }

    for (let earlier = 0; earlier < index; earlier += 1) {
      const other = edges[earlier];
      const duplicate =
        (other.a === edge.a && other.b === edge.b) ||
        (other.a === edge.b && other.b === edge.a);
      if (duplicate) {
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
  return target;
}

function clearSnapVisual() {
  snapHaloA.visible = false;
  snapHaloB.visible = false;
  snapEdge.visible = false;
  previewVertex.visible = false;
  snapHaloA.scale.setScalar(1);
  snapHaloB.scale.setScalar(1);
  setHint('拖動頂點或稜；綠色位置代表放手後會自動連接', false);
}

function setGhostEdge(start, end) {
  const direction = end.clone().sub(start);
  const length = Math.max(direction.length(), 0.01);
  snapEdge.position.copy(start).add(end).multiplyScalar(0.5);
  snapEdge.scale.set(1, length, 1);
  snapEdge.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  snapEdge.visible = true;
}

function showVertexSnap(candidate) {
  clearSnapVisual();
  previewVertex.position.copy(candidate.position);
  previewVertex.visible = true;
  snapHaloA.position.copy(candidate.position);
  snapHaloA.visible = true;

  if (candidate.source) {
    snapHaloB.position.copy(candidate.source.position);
    snapHaloB.visible = true;
    setGhostEdge(candidate.source.position, candidate.position);
  }

  setHint(
    candidate.merge
      ? '放手後會合併到綠色頂點'
      : '放手後會自動吸附及連接',
    true,
  );
}

function showEdgeSnap(candidate) {
  clearSnapVisual();
  snapHaloA.position.copy(candidate.aPos);
  snapHaloB.position.copy(candidate.bPos);
  snapHaloA.visible = true;
  snapHaloB.visible = true;
  setGhostEdge(candidate.aPos, candidate.bPos);
  setHint('放手後稜會自動接到綠色位置', true);
}

function showSolidSnap(candidate, type) {
  clearSnapVisual();
  snapHaloA.position.set(
    candidate.position.x,
    candidate.position.y + 0.08,
    candidate.position.z,
  );
  snapHaloA.scale.setScalar(1.45);
  snapHaloA.visible = true;
  setHint(`放手後放置${type === 'sphere' ? '球體' : '圓錐'}`, true);
}

function validVertexPosition(vertex, position, mergeTarget = null) {
  if (position.y < BASE_Y || position.y > layerY(MAX_LAYER - 1)) return false;

  const occupied = findVertexAt(position, vertex);
  if (occupied && occupied !== mergeTarget) return false;

  return connectedEdges(vertex).every((edge) => {
    const neighbour = edge.a === vertex ? edge.b : edge.a;
    if (mergeTarget && neighbour === mergeTarget) return true;
    return isAxisAligned(position, neighbour.position);
  });
}

function candidateForVertex(vertex, x, y, layer) {
  let best = null;

  vertices.forEach((target) => {
    if (target === vertex) return;
    const distance = screenDistance(target.position, x, y);
    if (
      distance < SNAP_PX &&
      validVertexPosition(vertex, target.position, target) &&
      (!best || distance < best.distance)
    ) {
      best = {
        type: 'merge',
        merge: target,
        position: target.position.clone(),
        distance,
      };
    }
  });

  vertices.forEach((source) => {
    if (source === vertex) return;
    DIRECTIONS.forEach((direction) => {
      const position = source.position.clone().add(direction);
      if (!validVertexPosition(vertex, position)) return;
      const distance = screenDistance(position, x, y);
      if (distance < SNAP_PX && (!best || distance < best.distance)) {
        best = { type: 'connect', source, position, distance };
      }
    });
  });

  const freePosition = pointOnLayer(x, y, layer);
  if (freePosition && validVertexPosition(vertex, freePosition)) {
    const distance = screenDistance(freePosition, x, y);
    if (!best || distance < best.distance) {
      best = { type: 'free', position: freePosition, distance };
    }
  }

  return best;
}

function candidateForNewVertex(x, y) {
  let best = null;

  vertices.forEach((target) => {
    const distance = screenDistance(target.position, x, y);
    if (distance < SNAP_PX && (!best || distance < best.distance)) {
      best = {
        type: 'existing',
        existing: target,
        position: target.position.clone(),
        distance,
      };
    }
  });

  vertices.forEach((source) => {
    DIRECTIONS.forEach((direction) => {
      const position = source.position.clone().add(direction);
      if (findVertexAt(position)) return;
      const distance = screenDistance(position, x, y);
      if (distance < SNAP_PX && (!best || distance < best.distance)) {
        best = { type: 'connect', source, position, distance };
      }
    });
  });

  const freePosition = pointOnLayer(x, y, currentLayer);
  if (freePosition) {
    const existing = findVertexAt(freePosition);
    const distance = screenDistance(freePosition, x, y);
    if (!best || distance < best.distance) {
      best = existing
        ? {
            type: 'existing',
            existing,
            position: existing.position.clone(),
            distance,
          }
        : { type: 'free', position: freePosition, distance };
    }
  }

  return best;
}

function potentialSegments(exceptEdge = null) {
  const candidates = [];

  for (let first = 0; first < vertices.length; first += 1) {
    for (let second = first + 1; second < vertices.length; second += 1) {
      const a = vertices[first];
      const b = vertices[second];
      if (
        isAxisAligned(a.position, b.position) &&
        !edgeExists(a, b, exceptEdge)
      ) {
        candidates.push({
          a,
          b,
          aPos: a.position.clone(),
          bPos: b.position.clone(),
        });
      }
    }
  }

  vertices.forEach((a) => {
    DIRECTIONS.forEach((direction) => {
      const bPosition = a.position.clone().add(direction);
      const b = findVertexAt(bPosition);
      if (b) {
        if (!edgeExists(a, b, exceptEdge)) {
          candidates.push({
            a,
            b,
            aPos: a.position.clone(),
            bPos: b.position.clone(),
          });
        }
      } else {
        candidates.push({
          a,
          b: null,
          aPos: a.position.clone(),
          bPos: bPosition,
        });
      }
    });
  });

  return candidates;
}

function candidateForEdge(x, y, exceptEdge = null) {
  let best = null;

  potentialSegments(exceptEdge).forEach((candidate) => {
    const midpoint = candidate.aPos.clone().add(candidate.bPos).multiplyScalar(0.5);
    const distance = screenDistance(midpoint, x, y);
    if (distance < 100 && (!best || distance < best.distance)) {
      best = { ...candidate, distance };
    }
  });

  if (best) return best;

  const aPos = pointOnLayer(x, y, currentLayer);
  if (!aPos) return null;

  const bPos = aPos.clone().add(new THREE.Vector3(STEP, 0, 0));
  return {
    a: findVertexAt(aPos),
    b: findVertexAt(bPos),
    aPos,
    bPos,
    distance: 999,
  };
}

function candidateForSolid(x, y, layer) {
  const position = pointOnLayer(x, y, layer);
  return position ? { position } : null;
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
  ui.selectionName.textContent = `稜 ${edge.id}`;
  ui.selection.classList.add('show');
  showLayerButtons(false);
}

function selectSolid(solid) {
  clearSelection();
  selected = { type: 'solid', item: solid };
  solid.material.emissive.setHex(0x704000);
  solid.scale.setScalar(1.08);
  ui.selectionName.textContent = `${
    solid.userData.solidType === 'sphere' ? '球體' : '圓錐'
  } ${solid.userData.id}`;
  ui.selection.classList.add('show');
  showLayerButtons(true);
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
  showToast('已刪除頂點及相連稜');
}

function moveSelectedLayer(delta) {
  if (!selected || selected.type === 'edge') return;

  if (selected.type === 'solid') {
    const solid = selected.item;
    const oldLayer = Math.round(
      (solid.position.y - solid.userData.halfHeight - BASE_Y) / STEP,
    );
    const newLayer = Math.max(0, Math.min(MAX_LAYER - 1, oldLayer + delta));
    solid.position.y = layerY(newLayer) + solid.userData.halfHeight;
    currentLayer = newLayer;
    updateUI();
    showToast(
      `${solid.userData.solidType === 'sphere' ? '球體' : '圓錐'}已移到第 ${
        newLayer + 1
      } 層`,
    );
    return;
  }

  const vertex = selected.item;
  const nextPosition = vertex.position.clone();
  nextPosition.y += delta * STEP;

  if (!validVertexPosition(vertex, nextPosition)) {
    showToast('這個位置會令稜變斜或重疊');
    return;
  }

  vertex.position.copy(nextPosition);
  currentLayer = Math.round((nextPosition.y - BASE_Y) / STEP);
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
  clearSnapVisual();
  vertices.forEach((vertex) => scene.remove(vertex));
  edges.forEach((edge) => scene.remove(edge.mesh));
  solids.forEach((solid) => scene.remove(solid));
  vertices.length = 0;
  edges.length = 0;
  solids.length = 0;
  nextVertexId = 1;
  nextEdgeId = 1;
  nextSolidId = 1;
  updateUI();
}

function moveGhost(x, y) {
  ui.ghost.style.left = `${x}px`;
  ui.ghost.style.top = `${y}px`;
}

function iconClass(type) {
  if (type === 'vertex') return 'vertex-icon';
  if (type === 'edge') return 'edge-icon';
  if (type === 'sphere') return 'sphere-icon';
  return 'cone-icon';
}

function toolName(type) {
  if (type === 'vertex') return '頂點';
  if (type === 'edge') return '稜';
  if (type === 'sphere') return '球體';
  return '圓錐';
}

function startToolDrag(event, type) {
  event.preventDefault();
  toolDrag = { type, candidate: null };
  controls.enabled = false;
  ui.ghost.classList.add('show');
  ui.ghostIcon.className = iconClass(type);
  ui.ghostText.textContent = toolName(type);
  moveGhost(event.clientX, event.clientY);

  window.addEventListener('pointermove', onToolMove);
  window.addEventListener('pointerup', endToolDrag, { once: true });
}

function onToolMove(event) {
  if (!toolDrag) return;

  moveGhost(event.clientX, event.clientY);
  const rect = renderer.domElement.getBoundingClientRect();

  const outside =
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom;

  if (outside) {
    toolDrag.candidate = null;
    clearSnapVisual();
    return;
  }

  let candidate = null;
  if (toolDrag.type === 'vertex') {
    candidate = candidateForNewVertex(event.clientX, event.clientY);
    if (candidate) showVertexSnap(candidate);
  } else if (toolDrag.type === 'edge') {
    candidate = candidateForEdge(event.clientX, event.clientY);
    if (candidate) showEdgeSnap(candidate);
  } else {
    candidate = candidateForSolid(event.clientX, event.clientY, currentLayer);
    if (candidate) showSolidSnap(candidate, toolDrag.type);
  }

  toolDrag.candidate = candidate;
}

function endToolDrag() {
  window.removeEventListener('pointermove', onToolMove);
  ui.ghost.classList.remove('show', 'snap');
  controls.enabled = true;

  if (!toolDrag) return;

  const { type, candidate } = toolDrag;
  toolDrag = null;
  clearSnapVisual();

  if (!candidate) {
    showToast('請將物件拖入圖格');
    return;
  }

  if (type === 'vertex') {
    if (candidate.type === 'existing') {
      selectVertex(candidate.existing);
      showToast('已選取最近的頂點');
      return;
    }

    const vertex = createVertex(candidate.position);
    if (candidate.source && !edgeExists(candidate.source, vertex)) {
      createEdge(candidate.source, vertex);
    }
    selectVertex(vertex);
    showToast(candidate.source ? '頂點已自動吸附並連接' : '已放置頂點');
    return;
  }

  if (type === 'edge') {
    const a = candidate.a || createVertex(candidate.aPos);
    const b = candidate.b || createVertex(candidate.bPos);
    const edge = createEdge(a, b);
    if (edge) {
      selectEdge(edge);
      showToast('稜已自動吸附連接');
    } else {
      showToast('這個位置已有稜');
    }
    return;
  }

  const solid = createSolid(type, candidate.position);
  selectSolid(solid);
  showToast(`已加入${type === 'sphere' ? '球體' : '圓錐'}`);
}

document.querySelectorAll('[data-tool]').forEach((element) => {
  element.addEventListener('pointerdown', (event) => {
    startToolDrag(event, element.dataset.tool);
  });
});

renderer.domElement.addEventListener('pointerdown', (event) => {
  const object = pickObject(event.clientX, event.clientY);

  if (!object) {
    objectDrag = {
      kind: 'orbit',
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    return;
  }

  event.preventDefault();
  controls.enabled = false;

  if (object.userData.kind === 'vertex') {
    objectDrag = {
      kind: 'vertex',
      item: object,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      original: object.position.clone(),
      layer: Math.round((object.position.y - BASE_Y) / STEP),
      candidate: null,
    };
    return;
  }

  if (object.userData.kind === 'edge') {
    const edge = object.userData.edge;
    objectDrag = {
      kind: 'edge',
      item: edge,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      candidate: null,
    };
    edge.mesh.material.transparent = true;
    edge.mesh.material.opacity = 0.25;
    return;
  }

  const layer = Math.round(
    (object.position.y - object.userData.halfHeight - BASE_Y) / STEP,
  );
  objectDrag = {
    kind: 'solid',
    item: object,
    x: event.clientX,
    y: event.clientY,
    moved: false,
    original: object.position.clone(),
    layer,
    candidate: null,
  };
});

renderer.domElement.addEventListener('pointermove', (event) => {
  if (!objectDrag || objectDrag.kind === 'orbit') return;

  if (Math.hypot(event.clientX - objectDrag.x, event.clientY - objectDrag.y) > 5) {
    objectDrag.moved = true;
  }
  if (!objectDrag.moved) return;

  if (objectDrag.kind === 'vertex') {
    const candidate = candidateForVertex(
      objectDrag.item,
      event.clientX,
      event.clientY,
      objectDrag.layer,
    );
    objectDrag.candidate = candidate;
    if (candidate) {
      objectDrag.item.position.copy(candidate.position);
      edges.forEach(updateEdge);
      showVertexSnap(candidate);
    }
    return;
  }

  if (objectDrag.kind === 'edge') {
    const candidate = candidateForEdge(
      event.clientX,
      event.clientY,
      objectDrag.item,
    );
    objectDrag.candidate = candidate;
    if (candidate) showEdgeSnap(candidate);
    return;
  }

  const candidate = candidateForSolid(
    event.clientX,
    event.clientY,
    objectDrag.layer,
  );
  objectDrag.candidate = candidate;
  if (candidate) {
    objectDrag.item.position.set(
      candidate.position.x,
      candidate.position.y + objectDrag.item.userData.halfHeight,
      candidate.position.z,
    );
    showSolidSnap(candidate, objectDrag.item.userData.solidType);
  }
});

renderer.domElement.addEventListener('pointerup', () => {
  if (!objectDrag) return;

  const drag = objectDrag;
  objectDrag = null;

  if (drag.kind === 'orbit') return;

  controls.enabled = true;
  clearSnapVisual();

  if (drag.kind === 'vertex') {
    if (!drag.moved) {
      selectVertex(drag.item);
      return;
    }

    const candidate = drag.candidate;
    if (!candidate) {
      drag.item.position.copy(drag.original);
      edges.forEach(updateEdge);
      showToast('未找到合適連接位置');
      return;
    }

    let result = drag.item;
    if (candidate.type === 'merge') {
      result = mergeVertices(drag.item, candidate.merge);
    } else {
      drag.item.position.copy(candidate.position);
      if (candidate.source && !edgeExists(candidate.source, drag.item)) {
        createEdge(candidate.source, drag.item);
      }
    }

    edges.forEach(updateEdge);
    selectVertex(result);
    showToast(
      candidate.type === 'free'
        ? '頂點已移到格點'
        : '頂點已自動吸附連接',
    );
    return;
  }

  if (drag.kind === 'solid') {
    if (!drag.moved) drag.item.position.copy(drag.original);
    selectSolid(drag.item);
    if (drag.moved) {
      showToast(
        `${drag.item.userData.solidType === 'sphere' ? '球體' : '圓錐'}已移動`,
      );
    }
    return;
  }

  drag.item.mesh.material.opacity = 1;
  drag.item.mesh.material.transparent = false;

  if (!drag.moved) {
    selectEdge(drag.item);
    return;
  }

  const candidate = drag.candidate;
  if (!candidate) {
    showToast('未找到合適連接位置');
    selectEdge(drag.item);
    return;
  }

  const a = candidate.a || createVertex(candidate.aPos);
  const b = candidate.b || createVertex(candidate.bPos);

  if (edgeExists(a, b, drag.item)) {
    showToast('這個位置已有稜');
    selectEdge(drag.item);
    return;
  }

  drag.item.a = a;
  drag.item.b = b;
  updateEdge(drag.item);
  selectEdge(drag.item);
  showToast('稜已自動轉移並連接');
});

renderer.domElement.addEventListener('pointercancel', () => {
  if (objectDrag?.kind === 'vertex' || objectDrag?.kind === 'solid') {
    objectDrag.item.position.copy(objectDrag.original);
  }
  if (objectDrag?.kind === 'edge') {
    objectDrag.item.mesh.material.opacity = 1;
    objectDrag.item.mesh.material.transparent = false;
  }
  objectDrag = null;
  controls.enabled = true;
  clearSnapVisual();
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

function addGuideEdge(start, end, material) {
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1, 10),
    material,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.set(1, direction.length(), 1);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  guideGroup.add(mesh);
}

function showGuide(type) {
  while (guideGroup.children.length) {
    const child = guideGroup.children.pop();
    child.geometry?.dispose();
    child.material?.dispose();
  }

  if (type === 'none') return;

  const x = type === 'cube' ? 2 : 4;
  const z = 2;
  const bottom = BASE_Y;
  const top = BASE_Y + STEP;

  const points = [
    [-x, bottom, -z],
    [x, bottom, -z],
    [x, bottom, z],
    [-x, bottom, z],
    [-x, top, -z],
    [x, top, -z],
    [x, top, z],
    [-x, top, z],
  ].map((point) => new THREE.Vector3(...point));

  const vertexMaterial = new THREE.MeshBasicMaterial({
    color: 0x60a5fa,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const edgeMaterial = vertexMaterial.clone();

  points.forEach((point) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 12),
      vertexMaterial.clone(),
    );
    marker.position.copy(point);
    guideGroup.add(marker);
  });

  [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ].forEach(([start, end]) => {
    addGuideEdge(points[start], points[end], edgeMaterial.clone());
  });
}

document.getElementById('guideSelect').onchange = (event) => {
  showGuide(event.target.value);
  showToast(
    event.target.value === 'none' ? '已關閉導引' : '已顯示淡色導引',
  );
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
        const next =
          edge.a === current ? edge.b : edge.b === current ? edge.a : null;
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

  const degreeValues = vertices
    .map((vertex) => degree.get(vertex) || 0)
    .sort((a, b) => a - b);

  const occupiedLevels = new Set([
    ...vertices.map((vertex) => vertex.position.y),
    ...solids.map((solid) => {
      const layer = Math.round(
        (solid.position.y - solid.userData.halfHeight - BASE_Y) / STEP,
      );
      return layerY(layer);
    }),
  ]);

  const levels = occupiedLevels.size;
  const parts = componentsCount();
  const sphereCount = solids.filter(
    (solid) => solid.userData.solidType === 'sphere',
  ).length;
  const coneCount = solids.filter(
    (solid) => solid.userData.solidType === 'cone',
  ).length;

  let name = '自由創作模型';
  let message = '模型包含直稜框架或曲面立體。';

  if (!vertices.length && !solids.length) {
    name = '模型仍是空白';
    message = '先由零件盒拖出頂點、稜、球體或圓錐。';
  } else if (sphereCount === 1 && coneCount === 0 && !vertices.length) {
    name = '球體';
    message = '球體只有一個曲面，沒有平面、稜和頂點。';
  } else if (coneCount === 1 && sphereCount === 0 && !vertices.length) {
    name = '圓錐';
    message = '圓錐有一個尖頂、一個圓形平面及一個曲面。';
  } else if (solids.length && !vertices.length) {
    name = '曲面立體組合';
    message = `模型包含 ${sphereCount} 個球體和 ${coneCount} 個圓錐。`;
  } else if (parts > 1) {
    name = solids.length ? '混合立體模型' : '模型有未連接部分';
    message = `目前共有 ${parts} 個分開部分。`;
  } else if (
    vertices.length === 8 &&
    edges.length === 12 &&
    degreeValues.every((value) => value === 3)
  ) {
    const xValues = [...new Set(vertices.map((vertex) => vertex.position.x))];
    const zValues = [...new Set(vertices.map((vertex) => vertex.position.z))];
    const squareBase =
      xValues.length === 2 &&
      zValues.length === 2 &&
      Math.abs(xValues[1] - xValues[0]) ===
        Math.abs(zValues[1] - zValues[0]);

    name = squareBase ? '可能是正方體框架' : '可能是長方體框架';
    message = '共有8個頂點、12條稜，每個頂點連接3條稜。';
  } else if (
    vertices.length === 4 &&
    edges.length === 4 &&
    degreeValues.every((value) => value === 2)
  ) {
    name = '可能是正方形或長方形框架';
    message = '共有4個頂點和4條稜。';
  }

  return {
    degree,
    levels,
    parts,
    name,
    message,
    sphereCount,
    coneCount,
  };
}

function showData() {
  const result = analyse();

  document.getElementById('resultVertices').textContent = vertices.length;
  document.getElementById('resultEdges').textContent = edges.length;
  document.getElementById('resultSpheres').textContent = result.sphereCount;
  document.getElementById('resultCones').textContent = result.coneCount;
  document.getElementById('resultLevels').textContent = result.levels;
  document.getElementById('resultParts').textContent = result.parts;
  document.getElementById('shapeName').textContent = result.name;
  document.getElementById('shapeMessage').textContent = result.message;

  const details = [];

  if (vertices.length) {
    details.push(
      `<b>每個頂點連接的稜：</b><br>${vertices
        .map(
          (vertex) =>
            `頂點 ${vertex.userData.id}：${result.degree.get(vertex) || 0} 條`,
        )
        .join('　 ')}`,
    );
  }

  if (result.sphereCount) {
    details.push('<b>球體：</b>只有1個曲面，沒有頂點和稜。');
  }

  if (result.coneCount) {
    details.push('<b>圓錐：</b>有1個尖頂、1個圓形平面和1個曲面。');
  }

  document.getElementById('detail').innerHTML =
    details.join('<br><br>') || '尚未有模型資料。';

  document.getElementById('dataModal').classList.add('show');
}

document.getElementById('finishBtn').onclick = showData;
document.getElementById('continueBtn').onclick = () => {
  document.getElementById('dataModal').classList.remove('show');
};
document.getElementById('clearBtn').onclick = () => {
  document.getElementById('dataModal').classList.remove('show');
  clearAll();
  resetView();
};
document.getElementById('helpBtn').onclick = () => {
  document.getElementById('helpModal').classList.add('show');
};
document.getElementById('closeHelpBtn').onclick = () => {
  document.getElementById('helpModal').classList.remove('show');
};
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
