export interface SearchResult {
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
  source: 'google' | 'nominatim';
}

/**
 * Searches locations in Sri Lanka using Google Maps Geocoder/Places with Nominatim fallback.
 */
export async function searchLocationQuery(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const results: SearchResult[] = [];

  // 1. Try Google Maps Geocoder if loaded in window
  if (typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
    try {
      const googleResults = await new Promise<SearchResult[]>((resolve) => {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode(
          {
            address: trimmed,
            componentRestrictions: { country: 'LK' },
          },
          (res, status) => {
            if (status === google.maps.GeocoderStatus.OK && res && res.length > 0) {
              const mapped = res.slice(0, 5).map((item) => {
                const parts = item.formatted_address.split(',');
                const title = parts[0] || item.formatted_address;
                const subtitle = parts.slice(1).join(',').trim();
                return {
                  title,
                  subtitle: subtitle || undefined,
                  lat: item.geometry.location.lat(),
                  lng: item.geometry.location.lng(),
                  source: 'google' as const,
                };
              });
              resolve(mapped);
            } else {
              resolve([]);
            }
          }
        );
      });

      if (googleResults.length > 0) {
        return googleResults;
      }
    } catch {
      // Fall through to Nominatim
    }
  }

  // 2. OpenStreetMap Nominatim fallback
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      trimmed
    )}&countrycodes=lk&limit=6&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en,si',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        for (const item of data) {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            const parts = item.display_name.split(',');
            const title = parts[0] || item.display_name;
            const subtitle = parts.slice(1, 4).join(',').trim();
            results.push({
              title,
              subtitle: subtitle || undefined,
              lat,
              lng,
              source: 'nominatim',
            });
          }
        }
      }
    }
  } catch {
    // Ignore fetch error
  }

  return results;
}
