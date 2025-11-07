import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/TransformControls.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1120);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
camera.position.set(300, 300, 300);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(128, 128, 128);

const grid = new THREE.GridHelper(256, 16, 0x4f9cff, 0x2a3b55);
grid.rotation.x = Math.PI / 2;
grid.position.set(128, 128, 128);
scene.add(grid);

const box = new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(256, 256, 256)), 0x1c7ed6);
scene.add(box);

const ambient = new THREE.AmbientLight(0xffffff, 0.6);
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(1, 1, 1);
scene.add(ambient, dir);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const pointMaterial = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0x331f0a });
const selectedMaterial = new THREE.MeshStandardMaterial({ color: 0x7fffd4, emissive: 0x1c4640 });

const pointGeometry = new THREE.SphereGeometry(2.5, 16, 16);

const points = [];
let selectedPoint = null;

const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.setMode('translate');
transformControls.addEventListener('dragging-changed', (event) => {
  controls.enabled = !event.value;
});
transformControls.addEventListener('objectChange', () => {
  if (!selectedPoint) return;
  const { x, y, z } = selectedPoint.mesh.position;
  selectedPoint.position.set(x, y, z);
});
scene.add(transformControls);

const deleteBtn = document.getElementById('deletePoint');
const addBtn = document.getElementById('addPoint');
const exportBtn = document.getElementById('exportBtn');
const fileInput = document.getElementById('fileInput');

function resizeRenderer() {
  const { clientWidth, clientHeight } = canvas;
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const width = clientWidth * pixelRatio;
  const height = clientHeight * pixelRatio;
  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  }
}

function animate() {
  requestAnimationFrame(animate);
  resizeRenderer();
  controls.update();
  renderer.render(scene, camera);
}
animate();

function clearPoints() {
  points.forEach(({ mesh }) => scene.remove(mesh));
  points.length = 0;
  transformControls.detach();
  selectedPoint = null;
  updateDeleteButton();
}

function createPoint(position) {
  const mesh = new THREE.Mesh(pointGeometry, pointMaterial.clone());
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  const point = {
    mesh,
    position: mesh.position,
    material: mesh.material,
  };
  points.push(point);
  return point;
}

function selectPoint(point) {
  if (selectedPoint === point) return;
  if (selectedPoint) {
    selectedPoint.mesh.material = pointMaterial.clone();
  }
  selectedPoint = point;
  if (selectedPoint) {
    selectedPoint.mesh.material = selectedMaterial.clone();
    transformControls.attach(selectedPoint.mesh);
  } else {
    transformControls.detach();
  }
  updateDeleteButton();
}

function updateDeleteButton() {
  deleteBtn.disabled = !selectedPoint;
}

function parseData(text) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return rows
    .map((line) => line.split(/[\s,]+/).map(Number))
    .filter((coords) => coords.length === 3 && coords.every((n) => Number.isFinite(n)))
    .map((coords) => new THREE.Vector3(...coords));
}

function loadData(text) {
  const vectors = parseData(text);
  clearPoints();
  vectors.forEach((vector) => {
    createPoint(vector);
  });
}

function exportData() {
  const lines = points.map(({ mesh }) => {
    const { x, y, z } = mesh.position;
    return `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'points.txt';
  link.click();
  URL.revokeObjectURL(url);
}

function onPointerDown(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(points.map((p) => p.mesh));
  if (intersections.length > 0) {
    const mesh = intersections[0].object;
    const point = points.find((p) => p.mesh === mesh);
    selectPoint(point);
  } else if (!transformControls.dragging) {
    selectPoint(null);
  }
}

canvas.addEventListener('pointerdown', onPointerDown);

addBtn.addEventListener('click', () => {
  const point = createPoint(new THREE.Vector3(0, 0, 0));
  selectPoint(point);
});

deleteBtn.addEventListener('click', () => {
  if (!selectedPoint) return;
  scene.remove(selectedPoint.mesh);
  const index = points.indexOf(selectedPoint);
  if (index >= 0) points.splice(index, 1);
  selectedPoint = null;
  transformControls.detach();
  updateDeleteButton();
});

exportBtn.addEventListener('click', exportData);

fileInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result;
    if (typeof text === 'string') {
      loadData(text);
    }
  };
  reader.readAsText(file);
});

window.addEventListener('resize', resizeRenderer);

const defaultTemplate = document.getElementById('defaultData');
if (defaultTemplate?.textContent.trim()) {
  loadData(defaultTemplate.textContent);
}
