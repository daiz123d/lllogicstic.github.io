import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.122.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.122.0/examples/jsm/controls/OrbitControls.js';
import { packMultipleContainers, aggregateBoxes } from './binPacking.js';

let scene, camera, renderer, controls;
let boxes = [];
let containers = []; // base container definitions (with quantity)
let packResults = new Map(); // containerId -> { container, packed, unpacked }
let selectedContainerId = null;

let stepIndex = 0;
let stepPacked = [];
let stepContainerId = null;

const scale = 100;

// DOM references
const containerSelect = document.getElementById('containerSelect');
const containerListBody = document.getElementById('containerListBody');
const containerFileInput = document.getElementById('containerFileInput');
const boxFileInput = document.getElementById('boxFileInput');
const resultDiv = document.getElementById('result');
const containerTypeInfo = document.getElementById('containerTypeInfo');
const packedTableBody = document.querySelector('#packedBoxesTable tbody');
const containerResultsDiv = document.getElementById('containerResults');

init();

function init() {
  bindEvents();
  initScene();
  addDefaultData();
  renderContainerList();
  renderContainerSelect();
  renderPreview();
  updateBoxList();
}

function bindEvents() {
  document.getElementById('addContainerBtn').addEventListener('click', addContainerFromForm);
  document.getElementById('chooseFileBtn').addEventListener('click', () => containerFileInput.click());
  document.getElementById('importContainerBtn').addEventListener('click', () => containerFileInput.click());
  containerFileInput.addEventListener('change', onContainerFileChange);

  containerSelect.addEventListener('change', (e) => {
    selectedContainerId = e.target.value;
    resetStepState();
    renderPreview();
    updatePackedBoxTable(getPackedForSelected());
  });

  document.getElementById('addBoxBtn').addEventListener('click', () => {
    const modal = new bootstrap.Modal(document.getElementById('addBoxModal'));
    resetBoxModalDefaults();
    modal.show();
  });

  document.getElementById('confirmAddBoxBtn').addEventListener('click', () => {
    const width = parseFloat(document.getElementById('boxWidth').value);
    const height = parseFloat(document.getElementById('boxHeight').value);
    const length = parseFloat(document.getElementById('boxLength').value);
    const quantity = parseInt(document.getElementById('boxQuantity').value, 10) || 1;
    const color = document.getElementById('boxColor').value || '#ff6dd3';
    const weight = parseFloat(document.getElementById('boxWeight').value) || 0;
    const stackable = document.getElementById('boxStackable').checked;

    if ([width, height, length].some(v => isNaN(v) || v <= 0) || quantity <= 0) {
      showModal('Lỗi', 'Vui lòng nhập thông tin hộp hợp lệ.', 'danger');
      return;
    }
    boxes.push({ width, height, length, quantity, color, weight, stackable });
    updateBoxList();
    renderPreview();
    bootstrap.Modal.getInstance(document.getElementById('addBoxModal')).hide();
  });

  document.getElementById('exportBoxBtn').addEventListener('click', exportBoxes);
  document.getElementById('exportContainersBtn').addEventListener('click', exportContainers);
  document.getElementById('submitBtn').addEventListener('click', packAll);
  document.getElementById('resetBtn').addEventListener('click', resetAll);
  document.getElementById('importBoxBtn').addEventListener('click', () => boxFileInput.click());
  document.getElementById('chooseBoxFileBtn').addEventListener('click', () => boxFileInput.click());
  boxFileInput.addEventListener('change', onBoxFileChange);

  document.getElementById('stepNextBtn').addEventListener('click', stepNext);
  document.getElementById('stepPrevBtn').addEventListener('click', stepPrev);
  document.getElementById('stepPauseBtn').addEventListener('click', stepPause);
}

function addDefaultData() {
  const defaultContainer = {
    id: generateId(),
    name: 'Container 1',
    width: 5,
    height: 3,
    length: 4,
    maxWeight: 0,
    quantity: 1
  };
  containers.push(defaultContainer);
  selectedContainerId = defaultContainer.id;
  // Default box sample
  boxes.push({ width: 1, height: 1, length: 1, quantity: 4, color: '#6dd3ff', weight: 1, stackable: true });
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

// Scene setup
function initScene() {
  const containerElem = document.getElementById('threeD-container');
  const width = containerElem.clientWidth;
  const height = containerElem.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a);

  camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 20000);
  camera.position.set(600, 500, 600);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  containerElem.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x111827, 0.8);
  scene.add(hemiLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(200, 400, 300);
  scene.add(dirLight);

  const ambient = new THREE.AmbientLight(0x7090b0, 0.35);
  scene.add(ambient);

  const grid = new THREE.GridHelper(4000, 40, 0x1f2a44, 0x1f2a44);
  grid.material.opacity = 0.35;
  grid.material.transparent = true;
  scene.add(grid);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(5000, 5000),
    new THREE.MeshStandardMaterial({ color: 0x0b1324, roughness: 0.9, metalness: 0.1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1;
  ground.receiveShadow = true;
  scene.add(ground);

  window.addEventListener('resize', onWindowResize);
  animate();
}

function onWindowResize() {
  const containerElem = document.getElementById('threeD-container');
  const width = containerElem.clientWidth;
  const height = containerElem.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// Packing
function packAll() {
  if (!containers.length) {
    showModal('Lỗi', 'Hãy thêm ít nhất một container.', 'danger');
    return;
  }
  if (boxes.length === 0) {
    showModal('Lỗi', 'Hãy thêm ít nhất một hộp.', 'danger');
    return;
  }
  if (!validateBoxes()) {
    showModal('Lỗi', 'Kiểm tra lại kích thước/khối lượng hộp.', 'danger');
    return;
  }

  stepPause();
  resetStepState();
  packResults = new Map();

  const expanded = expandContainers(containers);
  if (!expanded.length) {
    showModal('Lỗi', 'Không có container hợp lệ.', 'danger');
    return;
  }

  const data = packMultipleContainers(expanded, boxes);
  const leftoverGrouped = aggregateBoxes(data.leftover);
  data.results.forEach(r => {
    packResults.set(r.container.id, { container: r.container, packed: r.packed, unpacked: [] });
  });

  renderResults(data.results, leftoverGrouped);

  if (expanded.length > 1) {
    selectedContainerId = '__all__';
  } else if (!packResults.has(selectedContainerId) && expanded[0]) {
    selectedContainerId = expanded[0].id;
  }
  renderContainerSelect();
  renderPreview();
  updatePackedBoxTable(getPackedForSelected());
}

function renderResults(results, leftover) {
  if (!results.length) {
    containerResultsDiv.innerHTML = '<div class="text-muted">Chưa có kết quả.</div>';
    return;
  }

  const blocks = results.map(r => {
    const { container, packed, unpacked } = r;
    const volumeContainer = container.width * container.height * container.length;
    const volumeUsed = packed.reduce((acc, b) => acc + b.width * b.height * b.length, 0);
    const fill = volumeContainer ? Math.min(100, (volumeUsed / volumeContainer) * 100).toFixed(1) : 0;
    const weightTotal = packed.reduce((acc, b) => acc + (b.weight || 0), 0);
    return `
      <div class="mb-3 p-3 border rounded" style="border-color: var(--glass-border);">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong>${container.name || 'Container'}</strong>
          <span class="pill">${container.length} x ${container.width} x ${container.height} m</span>
        </div>
        <div class="d-flex gap-3 flex-wrap small">
          <span class="tag"><i class="fas fa-box me-1"></i>Đã xếp: ${packed.length}</span>
          <span class="tag"><i class="fas fa-border-none me-1"></i>Chưa xếp: ${unpacked.length}</span>
          <span class="tag"><i class="fas fa-percentage me-1"></i>Độ đầy: ${fill}%</span>
          ${container.maxWeight ? `<span class="tag"><i class="fas fa-weight-hanging me-1"></i>Tải: ${weightTotal}/${container.maxWeight} kg</span>` : ''}
        </div>
      </div>
    `;
  });

  if (leftover.length) {
    blocks.push(`<div class="alert alert-warning mt-2 mb-0"><i class="fas fa-exclamation-circle me-1"></i>Còn ${leftover.reduce((acc, b) => acc + (b.quantity || 1), 0)} hộp chưa xếp.</div>`);
  }

  containerResultsDiv.innerHTML = blocks.join('');

  resultDiv.style.display = 'block';
  resultDiv.innerHTML = `<strong>Tổng container:</strong> ${results.length} | <strong>Đã xếp:</strong> ${
    results.reduce((acc, r) => acc + r.packed.length, 0)
  }`;
  containerTypeInfo.style.display = 'none';
}

// Containers
function addContainerFromForm() {
  const name = document.getElementById('containerNameInput').value.trim() || `Container ${containers.length + 1}`;
  const width = parseFloat(document.getElementById('containerWidthInput').value);
  const height = parseFloat(document.getElementById('containerHeightInput').value);
  const length = parseFloat(document.getElementById('containerLengthInput').value);
  const quantity = Math.max(1, parseInt(document.getElementById('containerQuantityInput').value, 10) || 1);
  const maxWeight = parseFloat(document.getElementById('containerWeightInput').value) || 0;

  if ([width, height, length].some(v => isNaN(v) || v <= 0)) {
    showModal('Lỗi', 'Kích thước container phải là số dương.', 'danger');
    return;
  }

  const newContainer = { id: generateId(), name, width, height, length, quantity, maxWeight };
  containers.push(newContainer);
  selectedContainerId = newContainer.id;
  renderContainerList();
  renderContainerSelect();
  renderPreview();
}

function renderContainerList() {
  containerListBody.innerHTML = '';
  containers.forEach((c, idx) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${idx + 1}</td>
      <td><input type="text" class="form-control form-control-sm" value="${c.name || ''}" data-field="name" data-id="${c.id}"></td>
      <td><input type="number" class="form-control form-control-sm" value="${c.length}" data-field="length" data-id="${c.id}" min="0.1" step="0.1"></td>
      <td><input type="number" class="form-control form-control-sm" value="${c.width}" data-field="width" data-id="${c.id}" min="0.1" step="0.1"></td>
      <td><input type="number" class="form-control form-control-sm" value="${c.height}" data-field="height" data-id="${c.id}" min="0.1" step="0.1"></td>
      <td><input type="number" class="form-control form-control-sm" value="${c.maxWeight || 0}" data-field="maxWeight" data-id="${c.id}" min="0" step="1"></td>
      <td><input type="number" class="form-control form-control-sm" value="${c.quantity || 1}" data-field="quantity" data-id="${c.id}" min="1" step="1"></td>
      <td><button class="btn btn-danger btn-sm" data-action="remove" data-id="${c.id}"><i class="fas fa-trash"></i></button></td>
    `;
    containerListBody.appendChild(row);
  });

  containerListBody.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', e => {
      const id = e.target.dataset.id;
      const field = e.target.dataset.field;
      let value = e.target.value;
      if (field === 'quantity') {
        const q = parseInt(value, 10);
        if (isNaN(q) || q <= 0) {
          showModal('Lỗi', 'Số lượng phải >= 1.', 'danger');
          renderContainerList();
          return;
        }
        updateContainerField(id, field, q);
        return;
      }
      if (field !== 'name') {
        value = parseFloat(value);
        if (isNaN(value) || value <= 0) {
          showModal('Lỗi', 'Kích thước phải > 0.', 'danger');
          renderContainerList();
          return;
        }
      }
      updateContainerField(id, field, value);
    });
  });

  containerListBody.querySelectorAll('button[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', () => {
      removeContainer(btn.dataset.id);
    });
  });
}

function updateContainerField(id, field, value) {
  const idx = containers.findIndex(c => c.id === id);
  if (idx === -1) return;
  if (field === 'quantity') {
    containers[idx][field] = parseInt(value, 10);
  } else if (field === 'name') {
    containers[idx][field] = value;
  } else {
    containers[idx][field] = parseFloat(value);
  }
  packResults.clear();
  containerResultsDiv.innerHTML = '';
  resultDiv.style.display = 'none';
  updatePackedBoxTable([]);
  renderContainerSelect();
  renderPreview();
}

function removeContainer(id) {
  containers = containers.filter(c => c.id !== id);
  const expanded = expandContainers(containers);
  if (!expanded.find(c => c.id === selectedContainerId) && expanded[0]) {
    selectedContainerId = expanded[0].id;
  } else if (!expanded.length) {
    selectedContainerId = null;
  }
  packResults.clear();
  containerResultsDiv.innerHTML = '';
  resultDiv.style.display = 'none';
  updatePackedBoxTable([]);
  renderContainerList();
  renderContainerSelect();
  renderPreview();
}

function renderContainerSelect() {
  containerSelect.innerHTML = '';
  const expanded = expandContainers(containers);
  if (expanded.length > 1) {
    const optAll = document.createElement('option');
    optAll.value = '__all__';
    optAll.textContent = `Tất cả container (${expanded.length})`;
    containerSelect.appendChild(optAll);
  }
  expanded.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name || 'Container'} (${c.length}x${c.width}x${c.height}m)`;
    containerSelect.appendChild(opt);
  });
  const ids = expanded.map(c => c.id);
  if (selectedContainerId === '__all__' && expanded.length > 1) {
    containerSelect.value = '__all__';
  } else if (selectedContainerId && ids.includes(selectedContainerId)) {
    containerSelect.value = selectedContainerId;
  } else if (expanded[0]) {
    selectedContainerId = expanded[0].id;
    containerSelect.value = selectedContainerId;
  } else {
    selectedContainerId = null;
  }
}

// Boxes
function updateBoxList() {
  const boxList = document.getElementById('boxList');
  boxList.innerHTML = '';
  boxes.forEach((b, i) => {
    const color = b.color || randomColor();
    b.color = color;
    const row = boxList.insertRow();
    row.innerHTML = `
      <td><input type="number" class="form-control form-control-sm" value="${b.length}" min="0.1" step="0.1" data-index="${i}" data-field="length" /></td>
      <td><input type="number" class="form-control form-control-sm" value="${b.width}" min="0.1" step="0.1" data-index="${i}" data-field="width" /></td>
      <td><input type="number" class="form-control form-control-sm" value="${b.height}" min="0.1" step="0.1" data-index="${i}" data-field="height" /></td>
      <td><input type="number" class="form-control form-control-sm" value="${b.quantity}" min="1" step="1" data-index="${i}" data-field="quantity" /></td>
      <td><input type="color" class="form-control form-control-sm" value="${color}" data-index="${i}" data-field="color" /></td>
      <td><input type="number" class="form-control form-control-sm" value="${b.weight || 0}" min="0" step="any" data-index="${i}" data-field="weight" /></td>
      <td class="text-center"><input type="checkbox" ${b.stackable !== false ? 'checked' : ''} data-index="${i}" data-field="stackable" /></td>
      <td><button class="btn btn-danger btn-sm" data-action="removeBox" data-index="${i}">Xóa</button></td>
    `;
  });

  boxList.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.index, 10);
      const field = e.target.dataset.field;
      if (field === 'stackable') {
        boxes[idx][field] = e.target.checked;
      } else if (field === 'color') {
        boxes[idx][field] = e.target.value;
      } else {
        const val = parseFloat(e.target.value);
        if (isNaN(val) || val <= 0) {
          showModal('Lỗi', 'Giá trị phải > 0.', 'danger');
          updateBoxList();
          return;
        }
        boxes[idx][field] = field === 'quantity' ? parseInt(val, 10) : val;
      }
      renderPreview();
    });
  });

  boxList.querySelectorAll('button[data-action="removeBox"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      boxes.splice(idx, 1);
      updateBoxList();
      renderPreview();
    });
  });
}

function randomColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

function validateBoxes() {
  return boxes.every(b => b.width > 0 && b.height > 0 && b.length > 0 && b.quantity > 0);
}

function expandContainers(baseContainers) {
  const list = [];
  (baseContainers || []).forEach(c => {
    const qty = Math.max(1, parseInt(c.quantity || 1, 10));
    for (let i = 0; i < qty; i++) {
      const suffix = qty > 1 ? ` #${i + 1}` : '';
      list.push({
        id: qty > 1 ? `${c.id}#${i + 1}` : c.id,
        baseId: c.id,
        name: `${c.name || 'Container'}${suffix}`,
        width: c.width,
        height: c.height,
        length: c.length,
        maxWeight: c.maxWeight || 0
      });
    }
  });
  return list;
}

// 3D rendering
function renderPreview() {
  clearDrawnObjects();
  const expanded = expandContainers(containers);
  if (!expanded.length) return;

  if (selectedContainerId === '__all__' && expanded.length > 1) {
    drawAllContainers(expanded);
    updatePackedBoxTable(getPackedForSelected(true));
    return;
  }

  const container = expanded.find(c => c.id === selectedContainerId) || expanded[0];
  if (!container) return;
  const packed = getPackedForSelected();

  drawContainer(container, { x: 0, z: 0 });
  drawBoxes(packed, { x: 0, z: 0 });
  focusCamera([container], [{ x: 0, z: 0 }]);
  updatePackedBoxTable(packed);
}

function clearDrawnObjects() {
  scene.children
    .filter(c => c.userData && (c.userData.isBox || c.userData.isContainer))
    .forEach(c => scene.remove(c));
}

function clearBoxesOnly() {
  scene.children
    .filter(c => c.userData && c.userData.isBox)
    .forEach(c => scene.remove(c));
}

function drawContainer(container, offset) {
  const geom = new THREE.BoxGeometry(container.width * scale, container.height * scale, container.length * scale);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x4fb2ff,
    transparent: true,
    opacity: 0.15,
    roughness: 0.1,
    metalness: 0.3
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(offset.x + container.width * scale / 2, container.height * scale / 2, offset.z + container.length * scale / 2);
  mesh.userData.isContainer = true;
  scene.add(mesh);

  const edges = new THREE.EdgesGeometry(geom);
  const lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x7ee0b4, linewidth: 2 }));
  lines.position.copy(mesh.position);
  lines.userData.isContainer = true;
  scene.add(lines);
}

function drawBoxes(packed, offset, opts = { clear: true }) {
  if (opts.clear) clearBoxesOnly();
  packed.forEach(b => {
    const g = new THREE.BoxGeometry(b.width * scale, b.height * scale, b.length * scale);
    const m = new THREE.MeshStandardMaterial({ color: b.color || randomColor(), roughness: 0.35, metalness: 0.1 });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(
      offset.x + (b.x + b.width / 2) * scale,
      (b.y + b.height / 2) * scale,
      offset.z + (b.z + b.length / 2) * scale
    );
    mesh.userData.isBox = true;
    scene.add(mesh);
  });
}

function focusCamera(containerList, offsets) {
  if (!containerList.length) return;
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity, maxDim = 0, maxY = 0;
  containerList.forEach((c, idx) => {
    const off = offsets[idx];
    minX = Math.min(minX, off.x);
    minZ = Math.min(minZ, off.z);
    maxX = Math.max(maxX, off.x + c.width * scale);
    maxZ = Math.max(maxZ, off.z + c.length * scale);
    maxDim = Math.max(maxDim, c.width, c.height, c.length);
    maxY = Math.max(maxY, c.height * scale);
  });
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const distance = Math.max(maxX - minX, maxZ - minZ, maxDim * scale) * 1.8;
  camera.position.set(centerX + distance, maxY + distance * 0.5, centerZ + distance);
  controls.target.set(centerX, maxY / 2, centerZ);
  controls.update();
}

function getPackedForSelected(includeAll = false) {
  if (includeAll && selectedContainerId === '__all__') {
    const rows = [];
    packResults.forEach((val, id) => {
      const name = val.container.name || id;
      val.packed.forEach(p => rows.push({ ...p, containerName: name }));
    });
    return rows;
  }
  if (!selectedContainerId) return [];
  const res = packResults.get(selectedContainerId);
  return res ? res.packed : [];
}

function updatePackedBoxTable(packedBoxes) {
  packedTableBody.innerHTML = '';
  packedBoxes.forEach((box, index) => {
    const row = packedTableBody.insertRow();
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${box.containerName || (packResults.get(selectedContainerId)?.container.name || '')}</td>
      <td>${box.length}</td>
      <td>${box.width}</td>
      <td>${box.height}</td>
      <td>(${box.x}, ${box.y}, ${box.z})</td>
    `;
  });
}

function drawAllContainers(expanded) {
  const offsets = computeOffsets(expanded);
  clearDrawnObjects();
  const packedMap = new Map();
  packResults.forEach((v, k) => packedMap.set(k, v.packed));

  expanded.forEach((c, idx) => {
    drawContainer(c, offsets[idx]);
    const packed = packedMap.get(c.id) || [];
    drawBoxes(packed, offsets[idx], { clear: false });
  });
  focusCamera(expanded, offsets);
}

function computeOffsets(list) {
  if (!list.length) return [];
  const maxFootprint = list.reduce((acc, c) => Math.max(acc, c.width * scale, c.length * scale), 0);
  const padding = maxFootprint * 0.3 + 200;
  const cols = Math.ceil(Math.sqrt(list.length));
  return list.map((_, idx) => {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    return { x: col * (maxFootprint + padding), z: row * (maxFootprint + padding) };
  });
}

// Step controls
function resetStepState() {
  stepIndex = 0;
  stepPacked = [];
  stepContainerId = selectedContainerId;
}

function stepNext() {
  if (selectedContainerId === '__all__') {
    showModal('Thông báo', 'Tua hộp chỉ áp dụng cho một container. Hãy chọn container cụ thể.', 'warning');
    return;
  }
  const res = packResults.get(selectedContainerId);
  if (!res || !res.packed.length) {
    showModal('Thông báo', 'Hãy xếp hộp trước hoặc container này chưa có kết quả.', 'warning');
    return;
  }
  if (stepContainerId !== selectedContainerId) {
    resetStepState();
  }
  if (stepIndex === 0) {
    clearDrawnObjects();
    drawContainer(res.container, { x: 0, z: 0 });
    drawBoxes([], { x: 0, z: 0 });
  }
  if (stepIndex < res.packed.length) {
    stepPacked.push(res.packed[stepIndex]);
    drawBoxes(stepPacked, { x: 0, z: 0 });
    updatePackedBoxTable(stepPacked);
    stepIndex += 1;
  } else {
    showModal('Thông báo', 'Đã xếp hết các hộp cho container này.', 'success');
  }
}

function stepPrev() {
  if (selectedContainerId === '__all__') {
    showModal('Thông báo', 'Tua hộp chỉ áp dụng cho một container. Hãy chọn container cụ thể.', 'warning');
    return;
  }
  const res = packResults.get(selectedContainerId);
  if (!res || !res.packed.length) return;
  if (stepContainerId !== selectedContainerId) {
    resetStepState();
    return;
  }
  if (stepIndex > 0) {
    stepIndex -= 1;
    stepPacked.pop();
    drawBoxes(stepPacked, { x: 0, z: 0 });
    updatePackedBoxTable(stepPacked);
  }
}

function stepPause() {
  // reserved for future auto-play; here only reset buffer
}

// Export/import
function exportBoxes() {
  if (!boxes.length) {
    showModal('Lỗi', 'Không có hộp để xuất.', 'danger');
    return;
  }
  const data = boxes.map(box => ({
    'Rộng (m)': box.width,
    'Cao (m)': box.height,
    'Dài (m)': box.length,
    'Số Lượng': box.quantity,
    'Màu': box.color,
    'Khối lượng (kg)': box.weight || 0,
    'Xếp chồng': box.stackable !== false
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hop');
  XLSX.writeFile(wb, 'hop.xlsx');
  showModal('Thành công', 'Đã xuất danh sách hộp.', 'success');
}

function exportContainers() {
  if (!containers.length) {
    showModal('Lỗi', 'Không có container để lưu.', 'danger');
    return;
  }
  const data = containers.map(c => ({
    name: c.name,
    width: c.width,
    height: c.height,
    length: c.length,
    maxWeight: c.maxWeight || 0,
    quantity: c.quantity || 1
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Container');
  XLSX.writeFile(wb, 'container.xlsx');
  showModal('Thành công', 'Đã lưu danh sách container.', 'success');
}

function onContainerFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();

  reader.onload = evt => {
    try {
      let imported = [];
      if (ext === 'json') {
        imported = parseContainerJSON(evt.target.result);
      } else if (ext === 'csv') {
        imported = parseContainerCSV(evt.target.result);
      } else if (ext === 'xlsx' || ext === 'xls') {
        imported = parseContainerXLSX(evt.target.result);
      } else {
        showModal('Lỗi', 'Định dạng file không hỗ trợ.', 'danger');
        return;
      }
      if (!imported.length) {
        showModal('Thông báo', 'Không đọc được container từ file.', 'warning');
        return;
      }
      imported.forEach(c => containers.push({ ...c, id: generateId() }));
      selectedContainerId = containers[containers.length - 1].id;
      renderContainerList();
      renderContainerSelect();
      renderPreview();
      showModal('Thành công', `Đã nhập ${imported.length} container.`, 'success');
    } catch (err) {
      showModal('Lỗi', 'Không thể đọc file container.', 'danger');
    } finally {
      containerFileInput.value = '';
    }
  };

  if (ext === 'xlsx' || ext === 'xls') {
    reader.readAsBinaryString(file);
  } else {
    reader.readAsText(file);
  }
}

function onBoxFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();

  reader.onload = evt => {
    try {
      let imported = [];
      if (ext === 'json') {
        imported = parseBoxJSON(evt.target.result);
      } else if (ext === 'csv') {
        imported = parseBoxCSV(evt.target.result);
      } else if (ext === 'xlsx' || ext === 'xls') {
        imported = parseBoxXLSX(evt.target.result);
      } else {
        showModal('Lỗi', 'Định dạng file không hỗ trợ.', 'danger');
        return;
      }
      if (!imported.length) {
        showModal('Thông báo', 'Không đọc được hộp từ file.', 'warning');
        return;
      }
      imported.forEach(b => boxes.push(b));
      updateBoxList();
      renderPreview();
      showModal('Thành công', `Đã nhập ${imported.length} dòng hộp.`, 'success');
    } catch (err) {
      showModal('Lỗi', 'Không thể đọc file hộp.', 'danger');
    } finally {
      boxFileInput.value = '';
    }
  };

  if (ext === 'xlsx' || ext === 'xls') {
    reader.readAsBinaryString(file);
  } else {
    reader.readAsText(file);
  }
}

function parseContainerJSON(text) {
  const arr = JSON.parse(text);
  if (!Array.isArray(arr)) return [];
  return arr.map(n => normalizeContainerRecord(n)).filter(Boolean);
}

function parseContainerCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const hasHeader = headers.some(h => ['width', 'height', 'length', 'dai', 'rong', 'cao', 'maxweight', 'tai_trong'].includes(h));
  const records = [];
  const startIdx = hasHeader ? 1 : 0;
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const rec = {};
    if (hasHeader) {
      headers.forEach((h, idx) => rec[h] = cols[idx]);
    } else {
      // Không header: giả định thứ tự Dài, Rộng, Cao, Tên?, SL?, Tải trọng?
      rec.length = cols[0];
      rec.width = cols[1];
      rec.height = cols[2];
      rec.name = cols[3] || '';
      rec.quantity = cols[4];
      rec.maxWeight = cols[5];
    }
    const normalized = normalizeContainerRecord(rec);
    if (normalized) records.push(normalized);
  }
  return records;
}

function parseContainerXLSX(binary) {
  const wb = XLSX.read(binary, { type: 'binary' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws);
  return json.map(row => normalizeContainerRecord(row)).filter(Boolean);
}

function normalizeContainerRecord(rec) {
  if (!rec) return null;
  const length = parseFloat(rec.length || rec.dai || rec.chieudai);
  const width = parseFloat(rec.width || rec.rong || rec.chieurong);
  const height = parseFloat(rec.height || rec.cao || rec.chieucao);
  if ([width, height, length].some(v => isNaN(v) || v <= 0)) return null;
  const quantity = Math.max(1, parseInt(rec.quantity || rec.so_luong || rec.sl || 1, 10));
  const maxWeight = parseFloat(rec.maxWeight || rec.maxweight || rec.tai_trong || rec.taitrong || rec.taitai) || 0;
  return {
    name: rec.name || rec.ten || '',
    width,
    height,
    length,
    maxWeight,
    quantity
  };
}

function parseBoxJSON(text) {
  const arr = JSON.parse(text);
  if (!Array.isArray(arr)) return [];
  return arr.map(n => normalizeBoxRecord(n)).filter(Boolean);
}

function parseBoxCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const hasHeader = headers.some(h => ['width', 'height', 'length', 'dai', 'rong', 'cao'].includes(h));
  const records = [];
  const startIdx = hasHeader ? 1 : 0;
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const rec = {};
    if (hasHeader) {
      headers.forEach((h, idx) => rec[h] = cols[idx]);
    } else {
      // Không header: giả định thứ tự Dài, Rộng, Cao, Số lượng, Màu, Khối lượng, Stackable
      rec.length = cols[0];
      rec.width = cols[1];
      rec.height = cols[2];
      rec.quantity = cols[3] || 1;
      rec.color = cols[4];
      rec.weight = cols[5];
      rec.stackable = cols[6];
    }
    const normalized = normalizeBoxRecord(rec);
    if (normalized) records.push(normalized);
  }
  return records;
}

function parseBoxXLSX(binary) {
  const wb = XLSX.read(binary, { type: 'binary' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws);
  return json.map(row => normalizeBoxRecord(row)).filter(Boolean);
}

function normalizeBoxRecord(rec) {
  if (!rec) return null;
  const length = parseFloat(rec.length || rec.dai || rec.chieudai);
  const width = parseFloat(rec.width || rec.rong || rec.chieurong);
  const height = parseFloat(rec.height || rec.cao || rec.chieucao);
  const quantity = Math.max(1, parseInt(rec.quantity || rec.so_luong || rec.sl || 1, 10));
  if ([width, height, length].some(v => isNaN(v) || v <= 0)) return null;
  const weight = parseFloat(rec.weight ?? rec.khoi_luong) || 0;
  const color = rec.color || rec.mau || randomColor();
  const stackableRaw = rec.stackable ?? rec.xepchong ?? rec.stack ?? rec.stk;
  const stackable = typeof stackableRaw === 'string'
    ? ['1', 'true', 'yes', 'y', 'ok', 'x'].includes(stackableRaw.toLowerCase())
    : stackableRaw === undefined || Boolean(stackableRaw);
  return {
    width,
    height,
    length,
    quantity,
    color,
    weight,
    stackable
  };
}

// Reset
function resetAll() {
  boxes = [];
  containers = [];
  packResults = new Map();
  selectedContainerId = null;
  stepPause();
  resetStepState();
  resultDiv.style.display = 'none';
  containerResultsDiv.innerHTML = '';
  addDefaultData();
  document.getElementById('containerNameInput').value = '';
  document.getElementById('containerWidthInput').value = 5;
  document.getElementById('containerHeightInput').value = 3;
  document.getElementById('containerLengthInput').value = 4;
  document.getElementById('containerWeightInput').value = '';
  document.getElementById('containerQuantityInput').value = 1;
  renderContainerList();
  renderContainerSelect();
  updateBoxList();
  renderPreview();
  showModal('Đã đặt lại', 'Toàn bộ dữ liệu đã được làm mới.', 'success');
}

// Utils
let notificationModalInstance = null;
function showModal(title, message, type = 'primary') {
  document.getElementById('notificationModalLabel').textContent = title;
  document.getElementById('notificationMessage').innerHTML = message;
  const modalHeader = document.querySelector('#notificationModal .modal-header');
  modalHeader.className = `modal-header bg-${type} text-white`;
  if (!notificationModalInstance) {
    notificationModalInstance = new bootstrap.Modal(document.getElementById('notificationModal'));
  }
  notificationModalInstance.show();
  setTimeout(() => {
    notificationModalInstance.hide();
    document.querySelectorAll('.modal-backdrop').forEach(e => e.remove());
    document.body.classList.remove('modal-open');
    document.body.style = '';
  }, 1500);
}

function resetBoxModalDefaults() {
  document.getElementById('boxWidth').value = 1;
  document.getElementById('boxHeight').value = 1;
  document.getElementById('boxLength').value = 1;
  document.getElementById('boxQuantity').value = 1;
  document.getElementById('boxColor').value = randomColor();
  document.getElementById('boxWeight').value = 1;
  document.getElementById('boxStackable').checked = true;
}

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}
