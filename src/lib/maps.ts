/** A point on the map in decimal degrees (`settings.contacts.coordinates`). */
export type LatLng = { lat: number; lng: number };

/** Half the side of the embedded map's bounding box, in degrees: a few streets around the pin. */
const embedSpan = 0.008;

/** Six decimals is about 10 cm: enough for any pin, short enough for a URL. */
const fixed = (value: number) => Number(value.toFixed(6)).toString();

/**
 * OpenStreetMap's embeddable map around the point, with a marker on it. It is
 * the only third-party frame the CSP allows (`frame-src`), and the location
 * page loads it only when the visitor asks for the map.
 */
export function osmEmbedUrl({ lat, lng }: LatLng): string {
  const bbox = [lng - embedSpan, lat - embedSpan, lng + embedSpan, lat + embedSpan]
    .map(fixed)
    .join(",");
  const params = new URLSearchParams({
    bbox,
    layer: "mapnik",
    marker: `${fixed(lat)},${fixed(lng)}`,
  });
  return `https://www.openstreetmap.org/export/embed.html?${params}`;
}

/** Links that open the point in the visitor's own map app, in a new page. */
export function mapAppLinks({ lat, lng }: LatLng, label: string) {
  const point = `${fixed(lat)},${fixed(lng)}`;
  return {
    google: `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: point })}`,
    apple: `https://maps.apple.com/?${new URLSearchParams({ ll: point, q: label })}`,
    waze: `https://waze.com/ul?${new URLSearchParams({ ll: point, navigate: "yes" })}`,
  } as const;
}

export type MapApp = keyof ReturnType<typeof mapAppLinks>;
