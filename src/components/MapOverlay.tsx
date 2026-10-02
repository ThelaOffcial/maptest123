import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { SRI_SUMANGALA_CENTER } from '../data/schools';

interface MapOverlayProps {
  residenceLocation: { lat: number; lng: number } | null;
  radius: number | null;
  isEducationCategory?: boolean;
  residenceRoadPath?: { lat: number; lng: number }[];
  workplaceRoadPath?: { lat: number; lng: number }[];
  workplaceLocation?: { lat: number; lng: number } | null;
}

export function MapOverlay({
  residenceLocation,
  radius,
  isEducationCategory = false,
  residenceRoadPath,
  workplaceRoadPath,
  workplaceLocation,
}: MapOverlayProps) {
  const map = useMap();
  const circleRef = useRef<google.maps.Circle | null>(null);
  const directPolylineRef = useRef<google.maps.Polyline | null>(null);
  const residenceRoadPolylineRef = useRef<google.maps.Polyline | null>(null);
  const workplaceRoadPolylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map) return;

    // Clean up previous overlays
    if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }
    if (directPolylineRef.current) {
      directPolylineRef.current.setMap(null);
      directPolylineRef.current = null;
    }
    if (residenceRoadPolylineRef.current) {
      residenceRoadPolylineRef.current.setMap(null);
      residenceRoadPolylineRef.current = null;
    }
    if (workplaceRoadPolylineRef.current) {
      workplaceRoadPolylineRef.current.setMap(null);
      workplaceRoadPolylineRef.current = null;
    }

    if (isEducationCategory) {
      // EDUCATION CATEGORY: Road routes only (no air distance circle)
      // 1. Permanent Residence Road Route
      if (residenceLocation && residenceRoadPath && residenceRoadPath.length > 0) {
        residenceRoadPolylineRef.current = new google.maps.Polyline({
          map,
          path: residenceRoadPath,
          strokeColor: '#0ea5e9', // Bright sky blue
          strokeOpacity: 0.95,
          strokeWeight: 5,
        });
      }

      // 2. Workplace Road Route
      if (workplaceLocation && workplaceRoadPath && workplaceRoadPath.length > 0) {
        workplaceRoadPolylineRef.current = new google.maps.Polyline({
          map,
          path: workplaceRoadPath,
          strokeColor: '#f59e0b', // Amber / Orange
          strokeOpacity: 0.95,
          strokeWeight: 5,
        });
      }
    } else {
      // STANDARD CATEGORIES: Great-circle radius vector & residence-centered circle
      if (!residenceLocation || radius === null) return;

      // Draw Polyline between Residence (Circle Center) and Sri Sumangala College (Radius Vector)
      directPolylineRef.current = new google.maps.Polyline({
        map,
        path: [
          residenceLocation,
          { lat: SRI_SUMANGALA_CENTER.lat, lng: SRI_SUMANGALA_CENTER.lng },
        ],
        strokeColor: '#10b981',
        strokeOpacity: 0.95,
        strokeWeight: 3,
      });

      // Draw Circle ALWAYS centered at applicant entering location (Residence)
      circleRef.current = new google.maps.Circle({
        map,
        center: residenceLocation,
        radius,
        strokeColor: '#059669',
        strokeOpacity: 0.9,
        strokeWeight: 2.5,
        fillColor: '#10b981',
        fillOpacity: 0.1,
      });
    }

    return () => {
      if (circleRef.current) circleRef.current.setMap(null);
      if (directPolylineRef.current) directPolylineRef.current.setMap(null);
      if (residenceRoadPolylineRef.current) residenceRoadPolylineRef.current.setMap(null);
      if (workplaceRoadPolylineRef.current) workplaceRoadPolylineRef.current.setMap(null);
    };
  }, [
    map,
    residenceLocation,
    radius,
    isEducationCategory,
    residenceRoadPath,
    workplaceRoadPath,
    workplaceLocation,
  ]);

  return null;
}
