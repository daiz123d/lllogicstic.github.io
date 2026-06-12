const EARTH_RADIUS_KM = 6371;

function toRadians(value) {
  return value * Math.PI / 180;
}

export function haversineDistanceKm(from, to) {
  if (!from || !to) return 0;
  const [lat1, lng1] = from.map(Number);
  const [lat2, lng2] = to.map(Number);
  if ([lat1, lng1, lat2, lng2].some(value => !Number.isFinite(value))) return 0;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function routeDistanceKm(points = []) {
  return points.reduce((sum, point, index) => {
    if (index === 0) return sum;
    return sum + haversineDistanceKm(points[index - 1], point);
  }, 0);
}

export function estimateEtaMinutes(distanceKm, speedKmh) {
  const distance = Number(distanceKm);
  const speed = Number(speedKmh);
  if (!Number.isFinite(distance) || !Number.isFinite(speed) || distance < 0 || speed <= 0) return null;
  return Math.ceil((distance / speed) * 60);
}

export function addMinutes(date, minutes) {
  const source = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(minutes) || Number.isNaN(source.getTime())) return null;
  return new Date(source.getTime() + minutes * 60 * 1000);
}

export function minutesBetween(later, earlier) {
  const laterDate = later instanceof Date ? later : new Date(later);
  const earlierDate = earlier instanceof Date ? earlier : new Date(earlier);
  if (Number.isNaN(laterDate.getTime()) || Number.isNaN(earlierDate.getTime())) return null;
  return Math.max(0, Math.round((laterDate.getTime() - earlierDate.getTime()) / 60000));
}

export function getGpsHealth(lastUpdateAt, now = new Date()) {
  const ageMinutes = minutesBetween(now, lastUpdateAt);
  if (ageMinutes === null) return { state: 'lost', ageMinutes: null };
  if (ageMinutes <= 5) return { state: 'online', ageMinutes };
  if (ageMinutes <= 20) return { state: 'stale', ageMinutes };
  return { state: 'lost', ageMinutes };
}

export function getSlaStatus(etaAt, slaAt, warningMinutes = 30) {
  const eta = new Date(etaAt);
  const sla = new Date(slaAt);
  if (Number.isNaN(eta.getTime()) || Number.isNaN(sla.getTime())) return 'unknown';
  const diffMinutes = Math.round((sla.getTime() - eta.getTime()) / 60000);
  if (diffMinutes < 0) return 'late';
  if (diffMinutes <= warningMinutes) return 'at-risk';
  return 'on-time';
}

export function buildTripAlerts(trip = {}, now = new Date()) {
  const alerts = [];
  const gps = getGpsHealth(trip.gpsLastAt, now);
  const slaStatus = getSlaStatus(trip.etaAt, trip.slaAt);

  if (gps.state === 'lost') {
    alerts.push({
      code: 'gps-lost',
      level: 'danger',
      message: `Mất tín hiệu GPS${gps.ageMinutes !== null ? ` ${gps.ageMinutes} phút` : ''}`
    });
  } else if (gps.state === 'stale') {
    alerts.push({
      code: 'gps-stale',
      level: 'warning',
      message: `GPS chưa cập nhật ${gps.ageMinutes} phút`
    });
  }

  if (slaStatus === 'late') {
    alerts.push({ code: 'sla-late', level: 'danger', message: 'ETA đã vượt SLA giao hàng' });
  } else if (slaStatus === 'at-risk') {
    alerts.push({ code: 'sla-risk', level: 'warning', message: 'ETA sát hạn SLA, cần theo dõi' });
  }

  if ((Number(trip.speedKmh) || 0) <= 1 && (Number(trip.stoppedMinutes) || 0) >= 30) {
    alerts.push({ code: 'long-stop', level: 'warning', message: `Xe dừng ${trip.stoppedMinutes} phút` });
  }

  if ((Number(trip.deviationKm) || 0) >= 2) {
    alerts.push({ code: 'route-deviation', level: 'warning', message: `Lệch tuyến ${Number(trip.deviationKm).toFixed(1)} km` });
  }

  if (trip.podStatus === 'pending') {
    alerts.push({ code: 'pod-pending', level: 'info', message: 'Chưa có POD/chứng từ giao hàng' });
  }

  return alerts;
}

export function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit'
  });
}
