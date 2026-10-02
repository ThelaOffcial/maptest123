import { calculateGreatCircleDistance } from '../data/schools';

export interface RoadRouteResult {
  distanceMeters: number;
  distanceKm: number;
  durationText?: string;
  path: { lat: number; lng: number }[];
  status: 'ok' | 'fallback' | 'error';
  source: 'google' | 'osrm' | 'estimate';
}

/**
 * Fetch shortest road driving route between origin and destination.
 * Attempts Google Maps DirectionsService first; if unavailable or fails,
 * falls back to high-performance OSRM driving service or geodetic road model.
 */
export async function fetchRoadRoute(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number }
): Promise<RoadRouteResult> {
  // 1. Try Google Maps DirectionsService if loaded in browser
  if (typeof window !== 'undefined' && window.google?.maps?.DirectionsService) {
    try {
      const googleResult = await new Promise<RoadRouteResult | null>((resolve) => {
        const ds = new google.maps.DirectionsService();
        ds.route(
          {
            origin: new google.maps.LatLng(origin.lat, origin.lng),
            destination: new google.maps.LatLng(dest.lat, dest.lng),
            travelMode: google.maps.TravelMode.DRIVING,
            provideRouteAlternatives: true,
          },
          (res, status) => {
            if (status === google.maps.DirectionsStatus.OK && res && res.routes.length > 0) {
              let shortestRoute = res.routes[0];
              let minDistance = Infinity;

              for (const route of res.routes) {
                let dist = 0;
                for (const leg of route.legs) {
                  dist += leg.distance?.value || 0;
                }
                if (dist < minDistance) {
                  minDistance = dist;
                  shortestRoute = route;
                }
              }

              const path: { lat: number; lng: number }[] = [];
              if (shortestRoute.overview_path) {
                for (let i = 0; i < shortestRoute.overview_path.length; i++) {
                  const pt = shortestRoute.overview_path[i];
                  path.push({ lat: pt.lat(), lng: pt.lng() });
                }
              }

              const durationText = shortestRoute.legs[0]?.duration?.text || '';

              resolve({
                distanceMeters: minDistance,
                distanceKm: minDistance / 1000,
                durationText,
                path,
                status: 'ok',
                source: 'google',
              });
            } else {
              resolve(null);
            }
          }
        );
      });

      if (googleResult) {
        return googleResult;
      }
    } catch {
      // Fall through to OSRM
    }
  }

  // 2. OSRM Driving Routing fallback
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceMeters = Math.round(route.distance);
        const distanceKm = distanceMeters / 1000;
        const durationSec = Math.round(route.duration);
        const mins = Math.round(durationSec / 60);
        const durationText = mins >= 60 ? `${Math.floor(mins / 60)} hr ${mins % 60} mins` : `${mins} mins`;

        const coordinates: [number, number][] = route.geometry?.coordinates || [];
        const path = coordinates.map(([lng, lat]) => ({ lat, lng }));

        return {
          distanceMeters,
          distanceKm,
          durationText,
          path,
          status: 'ok',
          source: 'osrm',
        };
      }
    }
  } catch {
    // Fall through to geodetic model
  }

  // 3. Fallback: Great circle * 1.25 road detour factor for coastal Sri Lanka
  const directMeters = calculateGreatCircleDistance(origin.lat, origin.lng, dest.lat, dest.lng);
  const roadMeters = Math.round(directMeters * 1.25);
  return {
    distanceMeters: roadMeters,
    distanceKm: roadMeters / 1000,
    durationText: `${Math.round(roadMeters / 500)} mins`,
    path: [origin, dest],
    status: 'fallback',
    source: 'estimate',
  };
}
