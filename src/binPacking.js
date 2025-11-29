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

export function findBestContainer(boxes) {
    const presets = [...containerPresets].sort((a, b) =>
        (a.length * a.width * a.height) - (b.length * b.width * b.height)
    );

    const aggregated = boxes; // boxes đã chứa quantity
    let bestZero = null;
    let bestFallback = null;

    presets.forEach(c => {
        const result = packBoxes(c.width, c.height, c.length, aggregated, c.maxWeight || 0);
        const leftover = result.unpacked.length;
        const volume = c.length * c.width * c.height;
        const packedCount = result.packed.length;
        const totalBoxes = aggregated.reduce((s, b) => s + (b.quantity || 0), 0);
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
    return {
        ...chosen.container,
        packed: chosen.result.packed,
        totalWeight,
        leftover: chosen.result.unpacked ? chosen.result.unpacked.length : (bestZero ? 0 : chosen.leftover)
    };
}

// Gom hộp đơn lẻ cùng đặc tính thành quantity
export function aggregateBoxes(items) {
    const map = new Map();
    (items || []).forEach(b => {
        const key = [b.width, b.height, b.length, b.color, b.stackable, b.weight || 0].join('|');
        if (!map.has(key)) {
            map.set(key, { ...b, quantity: 0 });
        }
        map.get(key).quantity += (b.quantity || 1);
    });
    return Array.from(map.values());
}

// Hàm chính để xếp hộp vào container
export function packBoxes(containerWidth, containerHeight, containerLength, boxes, containerMaxWeight = 0) {
    const allBoxes = [];
    boxes.forEach(box => {
        for (let i = 0; i < box.quantity; i++) {
            allBoxes.push({
                width: box.width,
                height: box.height,
                length: box.length,
                color: box.color,
                stackable: box.stackable,
                weight: box.weight
            });
        }
    });

    allBoxes.sort((a, b) => (b.width * b.height * b.length) - (a.width * a.height * a.length));

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
                weight: box.weight
            });
        });
        return orientations.filter((o, idx, arr) =>
            arr.findIndex(oo => oo.width === o.width && oo.height === o.height && oo.length === o.length) === idx
        );
    }

    function findBestSpace(box, spaces) {
        let best = null;
        let bestIdx = -1;
        let bestOrientation = null;
        let bestY = Infinity, bestX = Infinity, bestZ = Infinity;
        const orientations = getOrientations(box);
        for (let i = 0; i < spaces.length; i++) {
            const s = spaces[i];
            for (const o of orientations) {
                if (o.width <= s.width && o.height <= s.height && o.length <= s.length) {
                    if (
                        s.y < bestY ||
                        (s.y === bestY && s.x < bestX) ||
                        (s.y === bestY && s.x === bestX && s.z < bestZ)
                    ) {
                        best = s;
                        bestIdx = i;
                        bestOrientation = o;
                        bestY = s.y;
                        bestX = s.x;
                        bestZ = s.z;
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
            unpacked.push(box);
            return;
        }
        const found = findBestSpace(box, spaces);
        if (!found) {
            unpacked.push(box);
            return;
        }
        const { idx, orientation } = found;
        const space = spaces[idx];
        packed.push({
            x: space.x,
            y: space.y,
            z: space.z,
            width: orientation.width,
            height: orientation.height,
            length: orientation.length,
            color: orientation.color,
            weight: orientation.weight
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
export function packMultipleContainers(containers, boxes) {
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
    (boxes || []).forEach(box => {
        for (let i = 0; i < (box.quantity || 0); i++) {
            expandedBoxes.push({
                width: box.width,
                height: box.height,
                length: box.length,
                color: box.color,
                stackable: box.stackable,
                weight: box.weight
            });
        }
    });
    expandedBoxes.sort((a, b) => (b.width * b.height * b.length) - (a.width * a.height * a.length));

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
            const packedRes = packBoxes(c.width, c.height, c.length, aggregateBoxes(remaining), c.maxWeight || 0);
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

        if (!best ||
            leftoverCount < best.leftoverCount ||
            (leftoverCount === best.leftoverCount && usedContainers < best.usedContainers) ||
            (leftoverCount === best.leftoverCount && usedContainers === best.usedContainers && packedCount > best.packedCount)
        ) {
            best = {
                leftoverCount,
                packedCount,
                usedContainers,
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
