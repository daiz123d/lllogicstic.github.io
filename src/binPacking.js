export const containerPresets = [
    { name: '1.25T (VN)', width: 1.6, height: 1.6, length: 3.1, maxWeight: 1000 },
    { name: '2.5T (VN)', width: 1.7, height: 1.65, length: 4.2, maxWeight: 1800 },
    { name: '3.5T (VN)', width: 1.8, height: 1.8, length: 4.7, maxWeight: 3100 },
    { name: '5T (VN)', width: 2.1, height: 2.0, length: 5.6, maxWeight: 4800 },
    { name: '8T (VN)', width: 2.25, height: 2.2, length: 6.9, maxWeight: 7400 },
    { name: '10T (VN)', width: 2.3, height: 2.33, length: 9.6, maxWeight: 8500 },
    { name: '45HQ (VN)', width: 2.35, height: 2.68, length: 13.5, maxWeight: 30000 },
    { name: 'Rào (VN)', width: 2.35, height: 2.4, length: 15.0, maxWeight: 30000 },
    { name: 'Sàn (VN)', width: 2.5, height: 2.7, length: 15.0, maxWeight: 30000 },
    { name: 'Fooc 15m (VN)', width: 3.2, height: 3.2, length: 14.0, maxWeight: 30000 },
    { name: 'Fooc 17m (VN)', width: 3.2, height: 3.2, length: 17.5, maxWeight: 30000 },
    { name: 'Fooc 18m5 (VN)', width: 3.2, height: 3.2, length: 18.5, maxWeight: 30000 },
    { name: 'Fooc 19m5 (VN)', width: 3.5, height: 3.2, length: 19.5, maxWeight: 30000 },
    { name: '3T (TQ)', width: 2.3, height: 1.8, length: 4.2, maxWeight: 3000 },
    { name: '5T (TQ)', width: 2.4, height: 2.4, length: 7.6, maxWeight: 5000 },
    { name: '10T (TQ)', width: 2.4, height: 2.4, length: 9.6, maxWeight: 9500 },
    { name: '45HQ (TQ)', width: 2.35, height: 2.68, length: 13.5, maxWeight: 30000 },
    { name: '53HQ (TQ)', width: 2.6, height: 2.8, length: 16.5, maxWeight: 30000 },
    { name: '4.2m bạt (TQ)', width: 2.3, height: 2.2, length: 4.2, maxWeight: 3000 },
    { name: '7.6m bạt (TQ)', width: 2.4, height: 2.8, length: 7.6, maxWeight: 5000 },
    { name: '9.6m bạt (TQ)', width: 2.4, height: 2.8, length: 9.6, maxWeight: 9500 },
    { name: '13m bạt (TQ)', width: 2.4, height: 2.8, length: 13.0, maxWeight: 30000 },
    { name: 'Sàn 13m (TQ)', width: 3.0, height: 3.0, length: 13.75, maxWeight: 30000 },
    { name: 'Sàn 17m5 (TQ)', width: 3.0, height: 3.0, length: 17.5, maxWeight: 30000 },
];

function normalizeQuantity(value) {
    const quantity = Number(value ?? 1);
    if (!Number.isFinite(quantity) || quantity <= 0) return 1;
    return Math.floor(quantity);
}

function normalizePackingBoxes(boxes) {
    return (boxes || []).map(box => ({
        ...box,
        quantity: normalizeQuantity(box.quantity)
    }));
}

function countPackingBoxes(boxes) {
    return normalizePackingBoxes(boxes).reduce((sum, box) => sum + normalizeQuantity(box.quantity), 0);
}

export function findBestContainer(boxes, options = {}) {
    const presets = [...containerPresets].sort((a, b) =>
        (a.length * a.width * a.height) - (b.length * b.width * b.height)
    );

    const aggregated = boxes; // boxes đã chứa quantity
    const packingBoxes = normalizePackingBoxes(aggregated);
    const totalBoxes = packingBoxes.reduce((s, b) => s + normalizeQuantity(b.quantity), 0);
    let bestZero = null;
    let bestFallback = null;

    presets.forEach(c => {
        const result = packBoxes(c.width, c.height, c.length, packingBoxes, c.maxWeight || 0, options);
        const leftover = result.unpacked.length;
        const volume = c.length * c.width * c.height;
        const packedCount = result.packed.length;
        const allPacked = leftover === 0 && packedCount >= totalBoxes;

        if (allPacked) {
            if (!bestZero || volume < bestZero.volume) {
                bestZero = { container: c, result, volume };
            }
            return;
        }

        // fallback: ít dư nhất -> nhiều hộp xếp được -> thể tích nhỏ
        if (!bestFallback ||
            leftover < bestFallback.leftover ||
            (leftover === bestFallback.leftover && packedCount > bestFallback.packedCount) ||
            (leftover === bestFallback.leftover && packedCount === bestFallback.packedCount && volume < bestFallback.volume)
        ) {
            bestFallback = { container: c, result, leftover, packedCount, volume };
        }
    });

    const chosen = bestZero || bestFallback;
    if (!chosen) return null;
    const totalWeight = chosen.result.packed.reduce((s, b) => s + (b.weight || 0), 0);
    const unpacked = chosen.result.unpacked || [];
    return {
        ...chosen.container,
        fitsAll: Boolean(bestZero),
        packed: chosen.result.packed,
        unpacked,
        packedCount: chosen.result.packed.length,
        totalBoxes,
        totalWeight,
        leftover: unpacked.length
    };
}

function findSmallestUsableContainer(boxes, options = {}) {
    const presets = [...containerPresets].sort((a, b) =>
        (a.length * a.width * a.height) - (b.length * b.width * b.height)
    );
    const packingBoxes = normalizePackingBoxes(boxes);
    const totalBoxes = countPackingBoxes(packingBoxes);

    for (const container of presets) {
        const result = packBoxes(
            container.width,
            container.height,
            container.length,
            packingBoxes,
            container.maxWeight || 0,
            options
        );
        if (result.packed.length <= 0) continue;

        const unpacked = result.unpacked || [];
        return {
            ...container,
            fitsAll: unpacked.length === 0 && result.packed.length >= totalBoxes,
            packed: result.packed,
            unpacked,
            packedCount: result.packed.length,
            totalBoxes,
            totalWeight: result.packed.reduce((sum, box) => sum + (box.weight || 0), 0),
            leftover: unpacked.length
        };
    }

    return null;
}

// Gom hộp đơn lẻ cùng đặc tính thành quantity
export function selectBestPresetContainers(boxes, options = {}) {
    let remaining = normalizePackingBoxes(boxes);
    const results = [];
    const maxContainers = Math.max(1, options.maxPresetContainers || countPackingBoxes(remaining));

    while (countPackingBoxes(remaining) > 0 && results.length < maxContainers) {
        const best = findSmallestUsableContainer(remaining, options);

        if (!best || best.packedCount <= 0) {
            break;
        }

        results.push({
            container: {
                name: best.name,
                width: best.width,
                height: best.height,
                length: best.length,
                maxWeight: best.maxWeight || 0,
                presetName: best.name
            },
            packed: best.packed,
            unpacked: best.unpacked,
            fitsAll: best.fitsAll
        });

        remaining = best.unpacked.map(box => ({ ...box, quantity: 1 }));
    }

    return {
        results,
        leftover: remaining,
        fitsAll: countPackingBoxes(remaining) === 0
    };
}

export function aggregateBoxes(items) {
    const map = new Map();
    (items || []).forEach(b => {
        const key = [b.width, b.height, b.length, b.color, b.stackable, b.weight || 0].join('|');
        if (!map.has(key)) {
            map.set(key, { ...b, quantity: 0 });
        }
        map.get(key).quantity += normalizeQuantity(b.quantity);
    });
    return Array.from(map.values());
}

function getBoxIdentity(box, fallback = '') {
    return box.boxKey || box.id || `${box.sourceIndex ?? ''}:${box.itemIndex ?? ''}:${box.order ?? fallback}`;
}

function isSameBox(a, b, fallback = '') {
    if (a.boxKey && b.boxKey && a.boxKey === b.boxKey) return true;
    if (a.id && b.id && a.id === b.id) return true;
    return (
        a.sourceIndex !== undefined &&
        b.sourceIndex !== undefined &&
        a.itemIndex !== undefined &&
        b.itemIndex !== undefined &&
        a.order !== undefined &&
        b.order !== undefined &&
        a.sourceIndex === b.sourceIndex &&
        a.itemIndex === b.itemIndex &&
        a.order === b.order
    ) || getBoxIdentity(a, fallback) === getBoxIdentity(b, fallback);
}

function boxesOverlap(a, b) {
    const epsilon = 1e-9;
    return (
        a.x < b.x + b.width - epsilon &&
        a.x + a.width > b.x + epsilon &&
        a.y < b.y + b.height - epsilon &&
        a.y + a.height > b.y + epsilon &&
        a.z < b.z + b.length - epsilon &&
        a.z + a.length > b.z + epsilon
    );
}

function isBoxSupported(candidate, boxes) {
    const epsilon = 1e-9;
    if (candidate.y <= epsilon) return true;

    return boxes.some(support => (
        !isSameBox(support, candidate) &&
        support.stackable !== false &&
        Math.abs((support.y + support.height) - candidate.y) <= epsilon &&
        candidate.x >= support.x - epsilon &&
        candidate.z >= support.z - epsilon &&
        candidate.x + candidate.width <= support.x + support.width + epsilon &&
        candidate.z + candidate.length <= support.z + support.length + epsilon
    ));
}

export function validateManualPlacement(container, packedBoxes, candidate) {
    const errors = [];
    const epsilon = 1e-9;
    const normalized = {
        ...candidate,
        x: Number(candidate.x),
        y: Number(candidate.y),
        z: Number(candidate.z),
        width: Number(candidate.width),
        height: Number(candidate.height),
        length: Number(candidate.length),
        weight: Number(candidate.weight || 0)
    };
    const others = (packedBoxes || []).filter((box, idx) => !isSameBox(box, normalized, idx));

    if (
        !Number.isFinite(normalized.x) ||
        !Number.isFinite(normalized.y) ||
        !Number.isFinite(normalized.z) ||
        !Number.isFinite(normalized.width) ||
        !Number.isFinite(normalized.height) ||
        !Number.isFinite(normalized.length) ||
        normalized.width <= 0 ||
        normalized.height <= 0 ||
        normalized.length <= 0
    ) {
        errors.push('invalid-number');
    }

    if (
        normalized.x < -epsilon ||
        normalized.y < -epsilon ||
        normalized.z < -epsilon ||
        normalized.x + normalized.width > container.width + epsilon ||
        normalized.y + normalized.height > container.height + epsilon ||
        normalized.z + normalized.length > container.length + epsilon
    ) {
        errors.push('out-of-bounds');
    }

    if (others.some(box => boxesOverlap(normalized, box))) {
        errors.push('collision');
    }

    if (normalized.stackable === false && normalized.y > epsilon) {
        errors.push('non-stackable-floor');
    }

    if (!isBoxSupported(normalized, others)) {
        errors.push('unsupported');
    }

    if (normalized.stackable === false) {
        const hasBoxAbove = others.some(box =>
            Math.abs(box.y - (normalized.y + normalized.height)) <= epsilon &&
            box.x >= normalized.x - epsilon &&
            box.z >= normalized.z - epsilon &&
            box.x + box.width <= normalized.x + normalized.width + epsilon &&
            box.z + box.length <= normalized.z + normalized.length + epsilon
        );
        if (hasBoxAbove) errors.push('non-stackable-support');
    }

    const totalWeight = others.reduce((sum, box) => sum + (Number(box.weight) || 0), 0) + normalized.weight;
    if (container.maxWeight > 0 && totalWeight > container.maxWeight + epsilon) {
        errors.push('overweight');
    }

    return {
        valid: errors.length === 0,
        errors: Array.from(new Set(errors)),
        totalWeight
    };
}

// Hàm chính để xếp hộp vào container
export function packBoxes(containerWidth, containerHeight, containerLength, boxes, containerMaxWeight = 0, options = {}) {
    const packingOptions = {
        strategy: options.strategy || 'minContainers',
        allowRotation: options.allowRotation !== false
    };
    const allBoxes = [];
    (boxes || []).forEach((box, sourceIndex) => {
        const quantity = normalizeQuantity(box.quantity);
        for (let i = 0; i < quantity; i++) {
            allBoxes.push({
                id: box.id,
                label: box.label || box.name || box.id || `Hộp ${sourceIndex + 1}`,
                sourceIndex: box.sourceIndex ?? sourceIndex,
                itemIndex: box.itemIndex ?? i,
                width: box.width,
                height: box.height,
                length: box.length,
                color: box.color,
                stackable: box.stackable,
                weight: box.weight
            });
        }
    });

    allBoxes.sort((a, b) => {
        if (packingOptions.strategy === 'inputOrder') {
            return a.sourceIndex - b.sourceIndex || a.itemIndex - b.itemIndex;
        }
        if (packingOptions.strategy === 'heavyBottom') {
            const weightDiff = (b.weight || 0) - (a.weight || 0);
            if (weightDiff !== 0) return weightDiff;
        }
        const volumeDiff = (b.width * b.height * b.length) - (a.width * a.height * a.length);
        if (volumeDiff !== 0) return volumeDiff;
        return (b.weight || 0) - (a.weight || 0);
    });

    const container = {
        width: containerWidth,
        height: containerHeight,
        length: containerLength
    };

    const packed = [];
    const unpacked = [];
    let spaces = [{
        x: 0, y: 0, z: 0,
        width: containerWidth,
        height: containerHeight,
        length: containerLength
    }];

    function isContained(a, b) {
        return (
            a.x >= b.x &&
            a.y >= b.y &&
            a.z >= b.z &&
            a.x + a.width <= b.x + b.width &&
            a.y + a.height <= b.y + b.height &&
            a.z + a.length <= b.z + b.length
        );
    }

    function pruneSpaces(spaces) {
        return spaces.filter((s, i, arr) =>
            !arr.some((other, j) => j !== i && isContained(s, other))
        );
    }

    function getOrientations(box) {
        const dims = [box.width, box.height, box.length];
        const orientations = [];
        if (!packingOptions.allowRotation) {
            return [{
                width: box.width,
                height: box.height,
                length: box.length,
                color: box.color,
                stackable: box.stackable,
                weight: box.weight,
                id: box.id,
                label: box.label,
                sourceIndex: box.sourceIndex,
                itemIndex: box.itemIndex
            }];
        }
        [
            [0, 1, 2],
            [0, 2, 1],
            [1, 0, 2],
            [1, 2, 0],
            [2, 0, 1],
            [2, 1, 0]
        ].forEach(order => {
            orientations.push({
                width: dims[order[0]],
                height: dims[order[1]],
                length: dims[order[2]],
                color: box.color,
                stackable: box.stackable,
                weight: box.weight,
                id: box.id,
                label: box.label,
                sourceIndex: box.sourceIndex,
                itemIndex: box.itemIndex
            });
        });
        return orientations.filter((o, idx, arr) =>
            arr.findIndex(oo => oo.width === o.width && oo.height === o.height && oo.length === o.length) === idx
        );
    }

    function overlaps(a, b) {
        const epsilon = 1e-9;
        return (
            a.x < b.x + b.width - epsilon &&
            a.x + a.width > b.x + epsilon &&
            a.y < b.y + b.height - epsilon &&
            a.y + a.height > b.y + epsilon &&
            a.z < b.z + b.length - epsilon &&
            a.z + a.length > b.z + epsilon
        );
    }

    function isSupported(candidate) {
        const epsilon = 1e-9;
        if (candidate.y <= epsilon) return true;
        if (candidate.stackable === false) return false;

        return packed.some(support => (
            support.stackable !== false &&
            Math.abs((support.y + support.height) - candidate.y) <= epsilon &&
            candidate.x >= support.x - epsilon &&
            candidate.z >= support.z - epsilon &&
            candidate.x + candidate.width <= support.x + support.width + epsilon &&
            candidate.z + candidate.length <= support.z + support.length + epsilon
        ));
    }

    function canPlaceAt(space, orientation) {
        const candidate = {
            x: space.x,
            y: space.y,
            z: space.z,
            width: orientation.width,
            height: orientation.height,
            length: orientation.length,
            stackable: orientation.stackable
        };

        if (
            candidate.x + candidate.width > container.width + 1e-9 ||
            candidate.y + candidate.height > container.height + 1e-9 ||
            candidate.z + candidate.length > container.length + 1e-9
        ) {
            return false;
        }

        if (!isSupported(candidate)) return false;
        return !packed.some(existing => overlaps(candidate, existing));
    }

    function findBestSpace(box, spaces) {
        let best = null;
        let bestIdx = -1;
        let bestOrientation = null;
        let bestY = Infinity, bestX = Infinity, bestZ = Infinity, bestWaste = Infinity;
        const orientations = getOrientations(box);
        for (let i = 0; i < spaces.length; i++) {
            const s = spaces[i];
            for (const o of orientations) {
                if (o.width <= s.width && o.height <= s.height && o.length <= s.length && canPlaceAt(s, o)) {
                    const waste = (s.width * s.height * s.length) - (o.width * o.height * o.length);
                    if (
                        s.y < bestY ||
                        (s.y === bestY && s.x < bestX) ||
                        (s.y === bestY && s.x === bestX && s.z < bestZ) ||
                        (s.y === bestY && s.x === bestX && s.z === bestZ && waste < bestWaste)
                    ) {
                        best = s;
                        bestIdx = i;
                        bestOrientation = o;
                        bestY = s.y;
                        bestX = s.x;
                        bestZ = s.z;
                        bestWaste = waste;
                    }
                }
            }
        }
        return best ? { idx: bestIdx, orientation: bestOrientation } : null;
    }

    let currentWeight = 0;

    allBoxes.forEach(box => {
        const boxWeight = box.weight || 0;
        if (containerMaxWeight > 0 && currentWeight + boxWeight > containerMaxWeight) {
            unpacked.push({ ...box, reason: 'overweight' });
            return;
        }
        const found = findBestSpace(box, spaces);
        if (!found) {
            const fitsBySize = getOrientations(box).some(o =>
                o.width <= container.width &&
                o.height <= container.height &&
                o.length <= container.length
            );
            unpacked.push({ ...box, reason: fitsBySize ? 'no-space' : 'oversize' });
            return;
        }
        const { idx, orientation } = found;
        const space = spaces[idx];
        packed.push({
            id: orientation.id,
            label: orientation.label,
            sourceIndex: orientation.sourceIndex,
            itemIndex: orientation.itemIndex,
            order: packed.length + 1,
            x: space.x,
            y: space.y,
            z: space.z,
            width: orientation.width,
            height: orientation.height,
            length: orientation.length,
            color: orientation.color,
            weight: orientation.weight,
            stackable: orientation.stackable
        });
        currentWeight += boxWeight;

        const newSpaces = [];
        if (space.width - orientation.width > 0) {
            newSpaces.push({
                x: space.x + orientation.width,
                y: space.y,
                z: space.z,
                width: space.width - orientation.width,
                height: space.height,
                length: space.length
            });
        }
        if (space.height - orientation.height > 0 && box.stackable !== false) {
            newSpaces.push({
                x: space.x,
                y: space.y + orientation.height,
                z: space.z,
                width: space.width,
                height: space.height - orientation.height,
                length: space.length
            });
        }
        if (space.length - orientation.length > 0) {
            newSpaces.push({
                x: space.x,
                y: space.y,
                z: space.z + orientation.length,
                width: space.width,
                height: space.height,
                length: space.length - orientation.length
            });
        }

        spaces.splice(idx, 1);
        spaces.push(...newSpaces);
        spaces = pruneSpaces(spaces);
    });

    return { container, packed, unpacked };
}

// Xếp nhiều container: thử nhiều thứ tự, ưu tiên ít hộp dư và dùng ít container
export function packMultipleContainers(containers, boxes, options = {}) {
    const packingOptions = {
        strategy: options.strategy || 'minContainers',
        allowRotation: options.allowRotation !== false
    };
    const normalized = (containers || [])
        .filter(c => c && c.width > 0 && c.height > 0 && c.length > 0)
        .map((c, idx) => ({
            id: c.id ?? `c${idx}`,
            name: c.name,
            width: c.width,
            height: c.height,
            length: c.length,
            maxWeight: c.maxWeight || 0
        }));

    const expandedBoxes = [];
    (boxes || []).forEach((box, sourceIndex) => {
        const quantity = normalizeQuantity(box.quantity);
        for (let i = 0; i < quantity; i++) {
            expandedBoxes.push({
                id: box.id,
                label: box.label || box.name || box.id || `Hộp ${sourceIndex + 1}`,
                sourceIndex,
                itemIndex: i,
                width: box.width,
                height: box.height,
                length: box.length,
                color: box.color,
                stackable: box.stackable,
                weight: box.weight
            });
        }
    });
    expandedBoxes.sort((a, b) => {
        if (packingOptions.strategy === 'inputOrder') {
            return a.sourceIndex - b.sourceIndex || a.itemIndex - b.itemIndex;
        }
        if (packingOptions.strategy === 'heavyBottom') {
            const weightDiff = (b.weight || 0) - (a.weight || 0);
            if (weightDiff !== 0) return weightDiff;
        }
        return (b.width * b.height * b.length) - (a.width * a.height * a.length);
    });

    const volume = c => c.width * c.height * c.length;
    const candidateOrders = [];
    candidateOrders.push([...normalized]);
    candidateOrders.push([...normalized].sort((a, b) => volume(b) - volume(a)));
    candidateOrders.push([...normalized].sort((a, b) => volume(a) - volume(b)));
    candidateOrders.push([...normalized].sort((a, b) => b.length - a.length));
    candidateOrders.push([...normalized].sort((a, b) => b.height - a.height));

    let best = null;

    function simulate(order) {
        let remaining = expandedBoxes.slice();
        const results = [];
        order.forEach(c => {
            if (!remaining.length) return;
            const packedRes = packBoxes(
                c.width,
                c.height,
                c.length,
                remaining.map(box => ({ ...box, quantity: 1 })),
                c.maxWeight || 0,
                packingOptions
            );
            results.push({ container: c, packed: packedRes.packed, unpacked: packedRes.unpacked });
            remaining = packedRes.unpacked;
        });
        return { results, leftover: remaining };
    }

    candidateOrders.forEach(order => {
        const sim = simulate(order);
        const leftoverCount = sim.leftover.length;
        const packedCount = sim.results.reduce((acc, r) => acc + r.packed.length, 0);
        const usedContainers = sim.results.filter(r => r.packed.length > 0).length;
        const usedVolume = sim.results.reduce((acc, r) =>
            acc + r.packed.reduce((sum, b) => sum + b.width * b.height * b.length, 0), 0);
        const containerVolume = sim.results
            .filter(r => r.packed.length > 0)
            .reduce((acc, r) => acc + volume(r.container), 0);
        const fillRatio = containerVolume ? usedVolume / containerVolume : 0;

        if (!best ||
            leftoverCount < best.leftoverCount ||
            (packingOptions.strategy === 'maxFill' && leftoverCount === best.leftoverCount && fillRatio > best.fillRatio) ||
            (packingOptions.strategy !== 'maxFill' && leftoverCount === best.leftoverCount && usedContainers < best.usedContainers) ||
            (leftoverCount === best.leftoverCount && usedContainers === best.usedContainers && packedCount > best.packedCount)
        ) {
            best = {
                leftoverCount,
                packedCount,
                usedContainers,
                fillRatio,
                results: sim.results,
                leftover: sim.leftover
            };
        }
    });

    return {
        results: best ? best.results : [],
        leftover: best ? best.leftover : expandedBoxes
    };
}
