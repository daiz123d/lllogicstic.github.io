import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.122.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.122.0/examples/jsm/controls/OrbitControls.js';
import { packMultipleContainers, aggregateBoxes, containerPresets, findBestContainer, validateManualPlacement } from './binPacking.js';

let scene, camera, renderer, controls, raycaster, pointer;
let boxes = [];
let containers = []; // base container definitions (with quantity)
let packResults = new Map(); // containerId -> { container, packed, unpacked }
let selectedContainerId = null;
let lastLeftoverCount = 0;
let lastPackData = null;

let stepIndex = 0;
let stepPacked = [];
let stepContainerId = null;
let stepTimer = null;
let activeViewMode = '3d';
let selectedBoxKey = null;
let selectedBoxData = null;
let boxMeshes = new Map();

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
const statContainers = document.getElementById('statContainers');
const statBoxes = document.getElementById('statBoxes');
const statPacked = document.getElementById('statPacked');
const statLeftover = document.getElementById('statLeftover');
const packingStrategySelect = document.getElementById('packingStrategy');
const allowRotationInput = document.getElementById('allowRotationInput');
const stepPlayBtn = document.getElementById('stepPlayBtn');
const stepSlider = document.getElementById('stepSlider');
const stepLabel = document.getElementById('stepLabel');
const stepSpeedSelect = document.getElementById('stepSpeedSelect');
const planCanvas = document.getElementById('planCanvas');
const selectedBoxInfo = document.getElementById('selectedBoxInfo');
const optimizationInsights = document.getElementById('optimizationInsights');
const loadingOrderTableBody = document.querySelector('#loadingOrderTable tbody');
const manualEditPanel = document.getElementById('manualEditPanel');
const manualEditStatus = document.getElementById('manualEditStatus');
const manualInputs = {
  x: document.getElementById('manualX'),
  y: document.getElementById('manualY'),
  z: document.getElementById('manualZ'),
  length: document.getElementById('manualLength'),
  width: document.getElementById('manualWidth'),
  height: document.getElementById('manualHeight')
};
const rotateLengthWidthBtn = document.getElementById('rotateLengthWidthBtn');
const rotateLengthHeightBtn = document.getElementById('rotateLengthHeightBtn');
const rotateWidthHeightBtn = document.getElementById('rotateWidthHeightBtn');
const validateManualBtn = document.getElementById('validateManualBtn');
const applyManualBtn = document.getElementById('applyManualBtn');

init();

function init() {
  bindEvents();
  initScene();
  addDefaultData();
  renderContainerList();
  renderPresetList();
  renderContainerSelect();
  renderPreview();
  updateBoxList();
  setManualControlsEnabled(false);
  updateDashboardStats();
}

function bindEvents() {
  document.getElementById('addContainerBtn').addEventListener('click', addContainerFromForm);
  document.getElementById('chooseFileBtn').addEventListener('click', () => containerFileInput.click());
  document.getElementById('importContainerBtn').addEventListener('click', () => containerFileInput.click());
  containerFileInput.addEventListener('change', onContainerFileChange);
  document.getElementById('autoPresetBtn').addEventListener('click', pickBestPreset);

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
    clearPackingResults();
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
  stepPlayBtn.addEventListener('click', toggleStepPlay);
  stepSlider.addEventListener('input', () => applyStepIndex(parseInt(stepSlider.value, 10) || 0));
  stepSpeedSelect.addEventListener('change', () => {
    if (stepTimer) {
      stepPause();
      toggleStepPlay();
    }
  });
  packingStrategySelect.addEventListener('change', clearPackingResults);
  allowRotationInput.addEventListener('change', clearPackingResults);
  document.querySelectorAll('[data-view-mode]').forEach(btn => {
    btn.addEventListener('click', () => switchViewMode(btn.dataset.viewMode));
  });
  rotateLengthWidthBtn.addEventListener('click', () => rotateManualDimensions('length', 'width'));
  rotateLengthHeightBtn.addEventListener('click', () => rotateManualDimensions('length', 'height'));
  rotateWidthHeightBtn.addEventListener('click', () => rotateManualDimensions('width', 'height'));
  validateManualBtn.addEventListener('click', () => validateManualEdit({ showSuccess: true }));
  applyManualBtn.addEventListener('click', applyManualEdit);
  Object.values(manualInputs).forEach(input => {
    input.addEventListener('input', () => setManualStatus('muted', 'Chưa kiểm tra'));
  });
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
  scene.fog = new THREE.Fog(0x0f172a, 3000, 9000);

  camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 20000);
  camera.position.set(600, 500, 600);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.physicallyCorrectLights = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  containerElem.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  renderer.domElement.addEventListener('click', onCanvasClick);

  const hemiLight = new THREE.HemisphereLight(0xcfe7ff, 0x0b1324, 0.7);
  scene.add(hemiLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
  dirLight.position.set(500, 800, 400);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 200;
  dirLight.shadow.camera.far = 4000;
  dirLight.shadow.camera.left = -1500;
  dirLight.shadow.camera.right = 1500;
  dirLight.shadow.camera.top = 1500;
  dirLight.shadow.camera.bottom = -1500;
  scene.add(dirLight);

  const ambient = new THREE.AmbientLight(0xffffff, 0.2);
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
  selectedBoxKey = null;
  selectedBoxData = null;

  const expanded = expandContainers(containers);
  if (!expanded.length) {
    showModal('Lỗi', 'Không có container hợp lệ.', 'danger');
    return;
  }

  const packingOptions = getPackingOptions();
  const data = packMultipleContainers(expanded, boxes, packingOptions);
  lastPackData = data;
  const leftoverGrouped = aggregateBoxes(data.leftover);
  lastLeftoverCount = data.leftover.length;
  data.results.forEach(r => {
    packResults.set(r.container.id, { container: r.container, packed: r.packed, unpacked: [] });
  });

  renderResults(data.results, leftoverGrouped);
  renderOptimizationInsights(data.results, data.leftover, packingOptions);
  updateLoadingOrderTable(getAllPackedRows());

  if (expanded.length > 1) {
    selectedContainerId = '__all__';
  } else if (!packResults.has(selectedContainerId) && expanded[0]) {
    selectedContainerId = expanded[0].id;
  }
  renderContainerSelect();
  renderPreview();
  updatePackedBoxTable(getPackedForSelected());
  updateStepControls();
  updateDashboardStats();
}

function getPackingOptions() {
  return {
    strategy: packingStrategySelect.value || 'minContainers',
    allowRotation: allowRotationInput.checked
  };
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
  clearPackingResults();
  renderContainerList();
  renderPresetList();
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
      if (field === 'maxWeight') {
        const w = parseFloat(value);
        if (isNaN(w) || w < 0) {
          showModal('Lỗi', 'Tải trọng phải >= 0.', 'danger');
          renderContainerList();
          return;
        }
        updateContainerField(id, field, w);
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
  } else if (field === 'maxWeight') {
    containers[idx][field] = parseFloat(value) || 0;
  } else if (field === 'name') {
    containers[idx][field] = value;
  } else {
    containers[idx][field] = parseFloat(value);
  }
  clearPackingResults();
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
  clearPackingResults();
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
      clearPackingResults();
      renderPreview();
    });
  });

  boxList.querySelectorAll('button[data-action="removeBox"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      boxes.splice(idx, 1);
      clearPackingResults();
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

function renderPresetList() {
  const body = document.getElementById('presetListBody');
  if (!body) return;
  body.innerHTML = '';
  containerPresets.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${p.length}</td>
      <td>${p.width}</td>
      <td>${p.height}</td>
      <td>${p.maxWeight || ''}</td>
    `;
    body.appendChild(tr);
  });
}

function pickBestPreset() {
  if (!boxes.length) {
    showModal('Lỗi', 'Hãy nhập hộp trước khi chọn container.', 'danger');
    return;
  }
  const aggregated = aggregateBoxes(boxes);
  const best = findBestContainer(aggregated, getPackingOptions());
  if (!best) {
    showModal('Lỗi', 'Không tìm được container phù hợp.', 'danger');
    return;
  }
  // Tự động tạo container từ preset, thay thế danh sách hiện tại và xếp luôn
  const newContainer = {
    id: generateId(),
    name: best.name,
    length: best.length,
    width: best.width,
    height: best.height,
    maxWeight: best.maxWeight || 0,
    quantity: 1
  };
  containers = [newContainer];
  selectedContainerId = newContainer.id;

  document.getElementById('containerLengthInput').value = best.length;
  document.getElementById('containerWidthInput').value = best.width;
  document.getElementById('containerHeightInput').value = best.height;
  document.getElementById('containerWeightInput').value = best.maxWeight || '';

  renderContainerList();
  renderContainerSelect();
  renderPreview();
  packAll(); // Xếp hộp ngay sau khi chọn

  showModal('Đã chọn', `Đã chọn: ${best.name} (${best.length} x ${best.width} x ${best.height} m, tải ${best.maxWeight || 'N/A'} kg) và xếp hộp.`, 'success');
}

// 3D rendering
function renderPreview() {
  clearDrawnObjects();
  const expanded = expandContainers(containers);
  if (!expanded.length) return;

  const is3D = activeViewMode === '3d';
  document.getElementById('threeD-container').hidden = !is3D;
  planCanvas.hidden = is3D;

  if (selectedContainerId === '__all__' && expanded.length > 1) {
    if (is3D) {
      drawAllContainers(expanded);
    } else {
      drawPlanView(expanded, getPackedForSelected(true), activeViewMode);
    }
    updatePackedBoxTable(getPackedForSelected(true));
    return;
  }

  const container = expanded.find(c => c.id === selectedContainerId) || expanded[0];
  if (!container) return;
  const packed = getPackedForSelected();

  if (is3D) {
    drawContainer(container, { x: 0, z: 0 });
    drawBoxes(packed, { x: 0, z: 0 });
    focusCamera([container], [{ x: 0, z: 0 }]);
  } else {
    drawPlanView([container], packed, activeViewMode);
  }
  updatePackedBoxTable(packed);
  updateStepControls();
}

function clearDrawnObjects() {
  scene.children
    .filter(c => c.userData && (c.userData.isBox || c.userData.isContainer))
    .forEach(c => scene.remove(c));
  boxMeshes.clear();
}

function clearBoxesOnly() {
  scene.children
    .filter(c => c.userData && c.userData.isBox)
    .forEach(c => scene.remove(c));
  boxMeshes.clear();
}

function drawContainer(container, offset) {
  const geom = new THREE.BoxGeometry(container.width * scale, container.height * scale, container.length * scale);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x4fb2ff,
    transparent: true,
    opacity: 0.15,
    roughness: 0.08,
    metalness: 0.35,
    clearcoat: 0.4,
    clearcoatRoughness: 0.05
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(offset.x + container.width * scale / 2, container.height * scale / 2, offset.z + container.length * scale / 2);
  mesh.userData.isContainer = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const edges = new THREE.EdgesGeometry(geom);
  const lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x9de9ff, linewidth: 2 }));
  lines.position.copy(mesh.position);
  lines.userData.isContainer = true;
  scene.add(lines);
}

function drawBoxes(packed, offset, opts = { clear: true }) {
  if (opts.clear) clearBoxesOnly();
  packed.forEach((b, idx) => {
    const boxKey = b.boxKey || getBoxKey(b, idx, opts.containerId || selectedContainerId);
    const g = new THREE.BoxGeometry(b.width * scale, b.height * scale, b.length * scale);
    const m = new THREE.MeshStandardMaterial({
      color: b.color || randomColor(),
      roughness: 0.32,
      metalness: 0.35,
      envMapIntensity: 1.1,
      emissive: boxKey === selectedBoxKey ? 0xffd166 : 0x000000,
      emissiveIntensity: boxKey === selectedBoxKey ? 0.35 : 0
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(
      offset.x + (b.x + b.width / 2) * scale,
      (b.y + b.height / 2) * scale,
      offset.z + (b.z + b.length / 2) * scale
    );
    mesh.userData.isBox = true;
    mesh.userData.box = {
      ...b,
      boxKey,
      containerId: b.containerId || opts.containerId || (selectedContainerId !== '__all__' ? selectedContainerId : ''),
      containerName: b.containerName || opts.containerName || (packResults.get(selectedContainerId)?.container.name || ''),
      order: b.order || idx + 1
    };
    mesh.userData.boxKey = boxKey;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    boxMeshes.set(boxKey, mesh);
  });
}

function getBoxKey(box, index, containerId = selectedContainerId) {
  const source = box.sourceIndex ?? index;
  const item = box.itemIndex ?? index;
  const order = box.order ?? index + 1;
  return `${containerId || box.containerName || 'container'}:${source}:${item}:${order}`;
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
      val.packed.forEach(p => rows.push({ ...p, containerId: id, containerName: name }));
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
    const boxKey = box.boxKey || getBoxKey(box, index, box.containerId || selectedContainerId);
    const containerName = box.containerName || (packResults.get(selectedContainerId)?.container.name || '');
    const enrichedBox = { ...box, boxKey, containerName, order: box.order || index + 1 };
    row.dataset.boxKey = boxKey;
    row.className = boxKey === selectedBoxKey ? 'selected-row' : '';
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${containerName}</td>
      <td>${box.length}</td>
      <td>${box.width}</td>
      <td>${box.height}</td>
      <td>(${box.x}, ${box.y}, ${box.z})</td>
    `;
    row.addEventListener('mouseenter', () => selectBox(enrichedBox, { silent: true }));
    row.addEventListener('click', () => selectBox(enrichedBox));
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
    drawBoxes(packed, offsets[idx], { clear: false, containerId: c.id, containerName: c.name });
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

function switchViewMode(mode) {
  activeViewMode = mode || '3d';
  document.querySelectorAll('[data-view-mode]').forEach(btn => {
    const active = btn.dataset.viewMode === activeViewMode;
    btn.classList.toggle('btn-primary', active);
    btn.classList.toggle('btn-outline-light', !active);
  });
  renderPreview();
}

function drawPlanView(containerList, packedRows, mode) {
  const ctx = planCanvas.getContext('2d');
  const rect = document.getElementById('threeDCard').getBoundingClientRect();
  const cssWidth = Math.max(320, Math.floor(rect.width - 34));
  const cssHeight = 460;
  const dpr = window.devicePixelRatio || 1;
  planCanvas.style.width = `${cssWidth}px`;
  planCanvas.style.height = `${cssHeight}px`;
  planCanvas.width = cssWidth * dpr;
  planCanvas.height = cssHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  if (!containerList.length) return;
  const container = containerList[0];
  const view = getPlanViewMetrics(container, mode);
  const margin = 28;
  const ratio = Math.min((cssWidth - margin * 2) / view.width, (cssHeight - margin * 2) / view.height);
  const originX = (cssWidth - view.width * ratio) / 2;
  const originY = (cssHeight - view.height * ratio) / 2;

  ctx.strokeStyle = '#9de9ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(originX, originY, view.width * ratio, view.height * ratio);
  ctx.fillStyle = '#d7ecf8';
  ctx.font = '700 13px Space Grotesk, sans-serif';
  ctx.fillText(getPlanViewLabel(mode), originX, Math.max(18, originY - 10));

  packedRows.forEach((box, idx) => {
    const boxKey = box.boxKey || getBoxKey(box, idx, selectedContainerId);
    const rect2d = projectBox(box, mode);
    const x = originX + rect2d.x * ratio;
    const y = originY + (view.height - rect2d.y - rect2d.height) * ratio;
    const w = Math.max(2, rect2d.width * ratio);
    const h = Math.max(2, rect2d.height * ratio);
    ctx.fillStyle = box.color || '#6dd3ff';
    ctx.globalAlpha = boxKey === selectedBoxKey ? 1 : 0.72;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = boxKey === selectedBoxKey ? '#ffd166' : '#ffffff';
    ctx.lineWidth = boxKey === selectedBoxKey ? 3 : 1;
    ctx.strokeRect(x, y, w, h);
    if (w > 22 && h > 16) {
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 11px Space Grotesk, sans-serif';
      ctx.fillText(String(box.order || idx + 1), x + 5, y + 14);
    }
  });
}

function getPlanViewMetrics(container, mode) {
  if (mode === 'side') return { width: container.length, height: container.height };
  if (mode === 'front') return { width: container.width, height: container.height };
  return { width: container.width, height: container.length };
}

function getPlanViewLabel(mode) {
  if (mode === 'side') return 'Mặt bên: dài x cao';
  if (mode === 'front') return 'Mặt trước: rộng x cao';
  return 'Mặt bằng: rộng x dài';
}

function projectBox(box, mode) {
  if (mode === 'side') {
    return { x: box.z, y: box.y, width: box.length, height: box.height };
  }
  if (mode === 'front') {
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }
  return { x: box.x, y: box.z, width: box.width, height: box.length };
}

function onCanvasClick(event) {
  if (!raycaster || !pointer || activeViewMode !== '3d') return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(Array.from(boxMeshes.values()), false);
  if (hits[0]?.object?.userData?.box) {
    selectBox(hits[0].object.userData.box);
  }
}

function selectBox(box, opts = {}) {
  const containerId = box.containerId || (selectedContainerId !== '__all__' ? selectedContainerId : '');
  selectedBoxKey = box.boxKey;
  selectedBoxData = { ...box, containerId };
  renderSelectedBoxInfo(selectedBoxData);
  populateManualEdit(selectedBoxData);
  highlightSelectedBox();
  if (!opts.silent && activeViewMode !== '3d') {
    renderPreview();
  }
  document.querySelectorAll('[data-box-key]').forEach(row => {
    row.classList.toggle('selected-row', row.dataset.boxKey === selectedBoxKey);
  });
}

function highlightSelectedBox() {
  boxMeshes.forEach((mesh, key) => {
    if (!mesh.material?.emissive) return;
    const active = key === selectedBoxKey;
    mesh.material.emissive.setHex(active ? 0xffd166 : 0x000000);
    mesh.material.emissiveIntensity = active ? 0.35 : 0;
  });
}

function renderSelectedBoxInfo(box) {
  selectedBoxInfo.innerHTML = `
    <div class="fw-bold"><i class="fas fa-box me-1"></i>${box.label || `Hộp ${box.order || ''}`}</div>
    <div class="detail-grid mt-2">
      <span>Thứ tự</span><strong>${box.order || '-'}</strong>
      <span>Container</span><strong>${box.containerName || '-'}</strong>
      <span>Kích thước</span><strong>${box.length} x ${box.width} x ${box.height} m</strong>
      <span>Khối lượng</span><strong>${box.weight || 0} kg</strong>
      <span>Vị trí</span><strong>(${box.x}, ${box.y}, ${box.z})</strong>
    </div>
  `;
}

function setManualControlsEnabled(enabled) {
  Object.values(manualInputs).forEach(input => {
    input.disabled = !enabled;
  });
  [
    rotateLengthWidthBtn,
    rotateLengthHeightBtn,
    rotateWidthHeightBtn,
    validateManualBtn,
    applyManualBtn
  ].forEach(btn => {
    btn.disabled = !enabled;
  });
}

function populateManualEdit(box) {
  const canEdit = Boolean(box.containerId && packResults.has(box.containerId));
  setManualControlsEnabled(canEdit);
  if (!canEdit) {
    setManualStatus('invalid', 'Chọn một container cụ thể');
    return;
  }
  manualInputs.x.value = box.x;
  manualInputs.y.value = box.y;
  manualInputs.z.value = box.z;
  manualInputs.length.value = box.length;
  manualInputs.width.value = box.width;
  manualInputs.height.value = box.height;
  setManualStatus('muted', 'Sẵn sàng chỉnh');
}

function setManualStatus(type, message) {
  manualEditStatus.className = `manual-status ${type}`;
  manualEditStatus.textContent = message;
}

function rotateManualDimensions(first, second) {
  if (!selectedBoxData) return;
  const current = manualInputs[first].value;
  manualInputs[first].value = manualInputs[second].value;
  manualInputs[second].value = current;
  setManualStatus('muted', 'Đã xoay, cần kiểm tra');
}

function getManualCandidate() {
  if (!selectedBoxData) return null;
  return {
    ...selectedBoxData,
    x: parseFloat(manualInputs.x.value),
    y: parseFloat(manualInputs.y.value),
    z: parseFloat(manualInputs.z.value),
    length: parseFloat(manualInputs.length.value),
    width: parseFloat(manualInputs.width.value),
    height: parseFloat(manualInputs.height.value)
  };
}

function validateManualEdit(opts = {}) {
  const candidate = getManualCandidate();
  if (!candidate || !candidate.containerId) {
    setManualStatus('invalid', 'Chưa chọn hộp');
    return null;
  }
  const result = packResults.get(candidate.containerId);
  if (!result) {
    setManualStatus('invalid', 'Không tìm thấy container');
    return null;
  }
  const validation = validateManualPlacement(result.container, result.packed, candidate);
  if (validation.valid) {
    if (opts.showSuccess) setManualStatus('valid', 'Hợp lệ');
  } else {
    setManualStatus('invalid', getManualErrorMessage(validation.errors));
  }
  return validation;
}

function getManualErrorMessage(errors) {
  const labels = {
    'invalid-number': 'Số không hợp lệ',
    'out-of-bounds': 'Vượt container',
    collision: 'Va chạm hộp khác',
    unsupported: 'Không có điểm đỡ hợp lệ',
    'non-stackable-support': 'Hộp này không cho xếp chồng',
    overweight: 'Vượt tải trọng'
  };
  return (errors || []).map(error => labels[error] || error).join(', ');
}

function applyManualEdit() {
  const candidate = getManualCandidate();
  const validation = validateManualEdit();
  if (!candidate || !validation?.valid) return;
  const result = packResults.get(candidate.containerId);
  const idx = result.packed.findIndex((box, index) =>
    getBoxKey(box, index, candidate.containerId) === selectedBoxKey
  );
  if (idx === -1) {
    setManualStatus('invalid', 'Không tìm thấy hộp');
    return;
  }

  const updated = {
    ...result.packed[idx],
    x: roundMetric(candidate.x),
    y: roundMetric(candidate.y),
    z: roundMetric(candidate.z),
    length: roundMetric(candidate.length),
    width: roundMetric(candidate.width),
    height: roundMetric(candidate.height)
  };
  result.packed[idx] = updated;
  selectedBoxData = {
    ...updated,
    boxKey: selectedBoxKey,
    containerId: candidate.containerId,
    containerName: result.container.name || candidate.containerId
  };
  refreshAfterManualEdit();
  selectBox(selectedBoxData, { silent: true });
  setManualStatus('valid', 'Đã áp dụng');
}

function roundMetric(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function getCurrentResults() {
  return Array.from(packResults.values()).map(value => ({
    container: value.container,
    packed: value.packed,
    unpacked: value.unpacked || []
  }));
}

function refreshAfterManualEdit() {
  const currentResults = getCurrentResults();
  const leftover = lastPackData?.leftover || [];
  renderResults(currentResults, aggregateBoxes(leftover));
  renderOptimizationInsights(currentResults, leftover, getPackingOptions());
  updateLoadingOrderTable(getAllPackedRows());
  renderPreview();
  updateDashboardStats();
}

// Step controls
function resetStepState() {
  stepPause();
  stepIndex = 0;
  stepPacked = [];
  stepContainerId = selectedContainerId;
  updateStepControls();
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
  if (stepIndex < res.packed.length) {
    applyStepIndex(stepIndex + 1);
  } else {
    stepPause();
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
    applyStepIndex(stepIndex - 1);
  }
}

function stepPause() {
  if (stepTimer) {
    clearInterval(stepTimer);
    stepTimer = null;
  }
  if (stepPlayBtn) stepPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
}

function toggleStepPlay() {
  if (stepTimer) {
    stepPause();
    return;
  }
  const res = packResults.get(selectedContainerId);
  if (!res || !res.packed.length || selectedContainerId === '__all__') {
    showModal('Thông báo', 'Hãy chọn một container đã xếp để phát từng bước.', 'warning');
    return;
  }
  stepPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
  stepTimer = setInterval(() => {
    if (stepIndex >= res.packed.length) {
      stepPause();
      return;
    }
    applyStepIndex(stepIndex + 1);
  }, parseInt(stepSpeedSelect.value, 10) || 700);
}

function applyStepIndex(nextIndex) {
  const res = packResults.get(selectedContainerId);
  if (!res || selectedContainerId === '__all__') return;
  stepContainerId = selectedContainerId;
  stepIndex = Math.max(0, Math.min(nextIndex, res.packed.length));
  stepPacked = res.packed.slice(0, stepIndex);

  if (activeViewMode === '3d') {
    clearDrawnObjects();
    drawContainer(res.container, { x: 0, z: 0 });
    drawBoxes(stepPacked, { x: 0, z: 0 }, { clear: false, containerId: selectedContainerId, containerName: res.container.name });
  } else {
    drawPlanView([res.container], stepPacked, activeViewMode);
  }
  updatePackedBoxTable(stepPacked);
  updateStepControls();
}

function updateStepControls() {
  const res = selectedContainerId && selectedContainerId !== '__all__' ? packResults.get(selectedContainerId) : null;
  const total = res ? res.packed.length : 0;
  if (stepSlider) {
    stepSlider.max = total;
    stepSlider.value = Math.min(stepIndex, total);
    stepSlider.disabled = total === 0;
  }
  if (stepLabel) {
    stepLabel.textContent = total ? `Hộp ${Math.min(stepIndex, total)} / ${total}` : '0 / 0';
  }
}

// Export/import
function exportBoxes() {
  if (!boxes.length) {
    showModal('Lỗi', 'Không có hộp để xuất.', 'danger');
    return;
  }
  const data = boxes.map(box => ({
    length: box.length,
    width: box.width,
    height: box.height,
    quantity: box.quantity,
    color: box.color,
    weight: box.weight || 0,
    stackable: box.stackable !== false
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'boxes');
  XLSX.writeFile(wb, 'boxes.xlsx');
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
      clearPackingResults();
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
      clearPackingResults();
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

function getAllPackedRows() {
  const rows = [];
  packResults.forEach((value, containerId) => {
    value.packed.forEach((box, index) => {
      rows.push({
        ...box,
        containerId,
        containerName: value.container.name || containerId,
        boxKey: getBoxKey(box, index, containerId)
      });
    });
  });
  return rows.sort((a, b) => (a.order || 0) - (b.order || 0));
}

function updateLoadingOrderTable(rows) {
  if (!loadingOrderTableBody) return;
  loadingOrderTableBody.innerHTML = '';
  rows.forEach((box, index) => {
    const row = loadingOrderTableBody.insertRow();
    row.dataset.boxKey = box.boxKey;
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${box.label || `Hộp ${index + 1}`}</td>
      <td>${box.containerName || ''}</td>
      <td>${box.length} x ${box.width} x ${box.height}</td>
      <td>(${box.x}, ${box.y}, ${box.z})</td>
    `;
    row.addEventListener('click', () => selectBox({ ...box, order: index + 1 }));
  });
}

function renderOptimizationInsights(results, leftover, packingOptions) {
  if (!optimizationInsights) return;
  const messages = [];
  const totalVolume = results.reduce((sum, r) => sum + r.container.width * r.container.height * r.container.length, 0);
  const usedVolume = results.reduce((sum, r) =>
    sum + r.packed.reduce((acc, b) => acc + b.width * b.height * b.length, 0), 0);
  const freeVolume = Math.max(0, totalVolume - usedVolume);
  const fill = totalVolume ? ((usedVolume / totalVolume) * 100).toFixed(1) : '0.0';

  messages.push(`<div class="insight success"><i class="fas fa-chart-pie"></i><span>Độ đầy tổng: <strong>${fill}%</strong>, còn trống khoảng <strong>${freeVolume.toFixed(2)} m³</strong>.</span></div>`);

  results.forEach(r => {
    const containerVolume = r.container.width * r.container.height * r.container.length;
    const packedVolume = r.packed.reduce((sum, b) => sum + b.width * b.height * b.length, 0);
    const containerFill = containerVolume ? (packedVolume / containerVolume) * 100 : 0;
    if (containerFill < 50 && r.packed.length) {
      messages.push(`<div class="insight warning"><i class="fas fa-triangle-exclamation"></i><span>${r.container.name || 'Container'} mới đầy ${containerFill.toFixed(1)}%. Có thể thử container nhỏ hơn hoặc gộp chuyến.</span></div>`);
    }
  });

  if (leftover.length) {
    const reasonLabels = {
      oversize: 'quá kích thước',
      overweight: 'vượt tải trọng',
      'no-space': 'không còn vùng trống phù hợp'
    };
    const grouped = leftover.reduce((map, box) => {
      const reason = reasonLabels[box.reason] || 'chưa xác định';
      map.set(reason, (map.get(reason) || 0) + 1);
      return map;
    }, new Map());
    const detail = Array.from(grouped.entries()).map(([reason, count]) => `${count} hộp ${reason}`).join(', ');
    messages.push(`<div class="insight danger"><i class="fas fa-box-open"></i><span>Còn ${leftover.length} hộp chưa xếp: ${detail}.</span></div>`);
  } else {
    messages.push(`<div class="insight success"><i class="fas fa-check-circle"></i><span>Tất cả hộp đã được xếp trong cấu hình hiện tại.</span></div>`);
  }

  const bestPreset = findBestContainer(aggregateBoxes(boxes), packingOptions);
  if (bestPreset) {
    messages.push(`<div class="insight"><i class="fas fa-magic"></i><span>Gợi ý preset: <strong>${bestPreset.name}</strong> (${bestPreset.length} x ${bestPreset.width} x ${bestPreset.height} m), còn dư ${bestPreset.leftover || 0} hộp.</span></div>`);
  }

  optimizationInsights.innerHTML = messages.join('');
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
  lastLeftoverCount = 0;
  lastPackData = null;
  selectedBoxKey = null;
  selectedBoxData = null;
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
  optimizationInsights.innerHTML = '<div class="text-muted">Bấm “Xếp hộp” để xem gợi ý tối ưu.</div>';
  if (loadingOrderTableBody) loadingOrderTableBody.innerHTML = '';
  resetManualPanel();
  updateDashboardStats();
  showModal('Đã đặt lại', 'Toàn bộ dữ liệu đã được làm mới.', 'success');
}

// Utils
function clearPackingResults() {
  packResults.clear();
  lastLeftoverCount = 0;
  lastPackData = null;
  selectedBoxKey = null;
  selectedBoxData = null;
  containerResultsDiv.innerHTML = '';
  resultDiv.style.display = 'none';
  containerTypeInfo.style.display = 'none';
  optimizationInsights.innerHTML = '<div class="text-muted">Bấm “Xếp hộp” để xem gợi ý tối ưu.</div>';
  if (loadingOrderTableBody) loadingOrderTableBody.innerHTML = '';
  selectedBoxInfo.innerHTML = `
    <div class="fw-bold"><i class="fas fa-hand-pointer me-1"></i>Thông tin hộp</div>
    <div class="text-muted small">Click một hộp trong 3D hoặc chọn một dòng trong bảng để xem chi tiết.</div>
  `;
  resetManualPanel();
  updatePackedBoxTable([]);
  resetStepState();
  updateDashboardStats();
}

function resetManualPanel() {
  setManualControlsEnabled(false);
  Object.values(manualInputs).forEach(input => {
    input.value = '';
  });
  setManualStatus('muted', 'Chưa chọn hộp');
}

function updateDashboardStats() {
  const expandedContainers = expandContainers(containers).length;
  const totalBoxes = boxes.reduce((sum, box) => sum + (parseInt(box.quantity, 10) || 0), 0);
  const packedBoxes = Array.from(packResults.values()).reduce((sum, result) => sum + result.packed.length, 0);

  if (statContainers) statContainers.textContent = expandedContainers;
  if (statBoxes) statBoxes.textContent = totalBoxes;
  if (statPacked) statPacked.textContent = packedBoxes;
  if (statLeftover) statLeftover.textContent = lastLeftoverCount;
}

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
