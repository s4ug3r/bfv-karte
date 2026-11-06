/**
 * Interaktive Google-Karte mit farbigen Markern, Clustering, Suchradius und InfoWindows.
 * Über das Ref-Handle kann die Liste ein Spiel fokussieren ("Auf Karte zeigen").
 */
import { MarkerClusterer, type Renderer } from '@googlemaps/markerclusterer';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { config } from '../../config';
import type { SelectedLocation } from '../../types/filters';
import type { LatLng, MatchWithDistance } from '../../types/match';
import { CATEGORY_COLOR } from '../../utils/classify';
import { spreadOverlapping } from '../../utils/maps';
import { createInfoWindowContent } from './infoWindowContent';

export interface MapViewHandle {
  /** Zentriert die Karte auf das Spiel und öffnet sein InfoWindow. */
  focusMatch: (id: string) => void;
}

interface Props {
  location: SelectedLocation;
  radiusKm: number;
  matches: MatchWithDistance[];
}

const GLYPH: Record<MatchWithDistance['category'], string> = { herren: 'H', jugend: 'J', unbekannt: '?' };

/** Cluster-Darstellung: dunkelblaue Kreise mit Anzahl, Größe wächst mit der Menge. */
const clusterRenderer: Renderer = {
  render: ({ count, position }) => {
    const size = Math.min(56, 30 + Math.log2(count) * 6);
    const div = document.createElement('div');
    div.className =
      'flex items-center justify-center rounded-full bg-bfv-800/90 text-white font-bold shadow-lg ring-4 ring-white/70';
    div.style.width = div.style.height = `${size}px`;
    div.style.fontSize = count > 99 ? '12px' : '13px';
    div.textContent = String(count);
    return new google.maps.marker.AdvancedMarkerElement({
      position,
      content: div,
      title: `${count} Spiele – zum Vergrößern klicken`,
      zIndex: 1000 + count,
    });
  },
};

export const MapView = forwardRef<MapViewHandle, Props>(function MapView({ location, radiusKm, matches }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const centerMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const positionsRef = useRef<Map<string, LatLng>>(new Map());
  const matchesRef = useRef<MatchWithDistance[]>(matches);
  const openIdRef = useRef<string | null>(null);
  const locationRef = useRef(location);
  matchesRef.current = matches;
  locationRef.current = location;
  /** Nur { lat, lng } – Google lehnt Objekte mit Zusatzfeldern (label, source) teils ab. */
  const center = { lat: location.lat, lng: location.lng };

  /** Öffnet das InfoWindow an der Markerposition (funktioniert auch für geclusterte Marker). */
  const openInfo = (match: MatchWithDistance) => {
    const map = mapRef.current;
    const info = infoRef.current;
    const pos = positionsRef.current.get(match.id) ?? match.venue.location;
    if (!map || !info) return;
    info.setContent(createInfoWindowContent(match, { lat: locationRef.current.lat, lng: locationRef.current.lng }));
    info.setPosition(pos);
    info.open({ map });
    openIdRef.current = match.id;
  };

  // ─── Karte einmalig initialisieren ───────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new google.maps.Map(containerRef.current, {
      center,
      zoom: 11,
      mapId: config.googleMapsMapId,
      gestureHandling: 'greedy',
      clickableIcons: false,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
      zoomControl: true,
    });
    mapRef.current = map;
    infoRef.current = new google.maps.InfoWindow({ pixelOffset: new google.maps.Size(0, -38), maxWidth: 340 });
    infoRef.current.addListener('closeclick', () => (openIdRef.current = null));
    clustererRef.current = new MarkerClusterer({ map, renderer: clusterRenderer });
    circleRef.current = new google.maps.Circle({
      map,
      strokeColor: '#1b6446',
      strokeOpacity: 0.6,
      strokeWeight: 2,
      fillColor: '#23805a',
      fillOpacity: 0.06,
      clickable: false,
    });

    return () => {
      clustererRef.current?.clearMarkers();
      clustererRef.current?.setMap(null);
      circleRef.current?.setMap(null);
      if (centerMarkerRef.current) centerMarkerRef.current.map = null;
      infoRef.current?.close();
      mapRef.current = null;
      clustererRef.current = null;
      circleRef.current = null;
      centerMarkerRef.current = null;
      infoRef.current = null;
    };
    // nur beim ersten Rendern
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Standort + Radius ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const circle = circleRef.current;
    if (!map || !circle) return;

    circle.setCenter(center);
    circle.setRadius(radiusKm * 1000);

    if (!centerMarkerRef.current) {
      const dot = document.createElement('div');
      dot.className = 'relative h-4 w-4 rounded-full text-bfv-600';
      const core = document.createElement('div');
      core.className = 'bfv-pulse relative h-4 w-4 rounded-full border-2 border-white bg-bfv-600 shadow-md';
      dot.append(core);
      centerMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map,
        content: dot,
        zIndex: 2000,
      });
    }
    centerMarkerRef.current.position = center;
    centerMarkerRef.current.title = `Gewählter Standort: ${location.label}`;

    const bounds = circle.getBounds();
    if (bounds) map.fitBounds(bounds, 24);
  }, [location, radiusKm]);

  // ─── Spiel-Marker ────────────────────────────────────────────────────────
  useEffect(() => {
    const clusterer = clustererRef.current;
    if (!clusterer) return;

    const positions = spreadOverlapping(matches.map((m) => ({ id: m.id, position: m.venue.location })));
    positionsRef.current = positions;

    const markers = matches.map((m) => {
      const pin = new google.maps.marker.PinElement({
        background: CATEGORY_COLOR[m.category],
        borderColor: '#ffffff',
        glyph: GLYPH[m.category],
        glyphColor: '#ffffff',
        scale: 1,
      });
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: positions.get(m.id),
        content: pin.element,
        title: `${m.homeTeam} – ${m.awayTeam}`,
      });
      marker.addListener('click', () => openInfo(m));
      return marker;
    });

    clusterer.clearMarkers(true);
    clusterer.addMarkers(markers);

    // Offenes InfoWindow schließen, wenn das Spiel herausgefiltert wurde
    if (openIdRef.current && !matches.some((m) => m.id === openIdRef.current)) {
      infoRef.current?.close();
      openIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  useImperativeHandle(ref, () => ({
    focusMatch: (id: string) => {
      const map = mapRef.current;
      const match = matchesRef.current.find((m) => m.id === id);
      if (!map || !match) return;
      const pos = positionsRef.current.get(id) ?? match.venue.location;
      // Weit genug hineinzoomen, damit der Cluster sich auflöst
      map.setZoom(Math.max(map.getZoom() ?? 12, 17));
      map.panTo(pos);
      openInfo(match);
    },
  }));

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      role="region"
      aria-label="Karte mit Spielen in der Nähe"
    />
  );
});
