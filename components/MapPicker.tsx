import React, { useEffect, useRef, useState } from 'react';
import { MapSearchResult } from '../types';
import L from 'leaflet';

interface MapPickerProps {
  coordinates: string;
  onLocationSelect: (lat: number, lng: number, roadName?: string, area?: string) => void;
}

// Fix for default Leaflet icons in webpack/react environments
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const MapPicker: React.FC<MapPickerProps> = ({ coordinates, onLocationSelect }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize Map
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const initialLat = -1.286389; // Nairobi default
      const initialLng = 36.817223;

      const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      map.on('click', (e) => {
        handleMarkerUpdate(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      
      // Force a resize calculation after mount to prevent grey tiles
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
    
    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external coordinates changes to map (e.g. from GPS button or Search)
  useEffect(() => {
    if (coordinates && mapInstanceRef.current) {
      const [lat, lng] = coordinates.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        updateMapVisuals(lat, lng, false); 
      }
    }
  }, [coordinates]);

  const updateMapVisuals = (lat: number, lng: number, triggerCallback = true) => {
    if (!mapInstanceRef.current) return;

    // Place or Move Marker (The Sticky Pin)
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current);
    }
    
    mapInstanceRef.current.setView([lat, lng], 16);

    if (triggerCallback) {
       // Reverse Geocode
       fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`, {
        headers: { 'User-Agent': 'FiberInstallationApp/1.0' }
      })
        .then(r => r.json())
        .then(d => {
          if (d.address) {
            const a = d.address;
            // Prioritize road name elements
            const road = a.road || a.pedestrian || a.footway || a.path || '';
            // Get general area
            const area = a.suburb || a.neighbourhood || a.village || a.town || a.city || '';
            
            onLocationSelect(lat, lng, road, area);
          } else {
            onLocationSelect(lat, lng);
          }
        })
        .catch(() => onLocationSelect(lat, lng));
    }
  };

  const handleMarkerUpdate = (lat: number, lng: number) => {
    updateMapVisuals(lat, lng, true);
  };

  const handleGPS = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        handleMarkerUpdate(pos.coords.latitude, pos.coords.longitude);
      }, (err) => {
        alert('Could not get GPS location: ' + err.message);
      });
    } else {
      alert('Geolocation not supported');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`, {
        headers: { 'User-Agent': 'FiberInstallationApp/1.0' }
      });
      const data: MapSearchResult[] = await res.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        handleMarkerUpdate(parseFloat(lat), parseFloat(lon));
      } else {
        alert('Location not found');
      }
    } catch (e) {
      console.error(e);
      alert('Search failed');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input 
          type="text" 
          placeholder="Search map location..." 
          className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button 
          type="button" 
          onClick={handleSearch}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700"
        >
          Search
        </button>
      </div>

      {/* Map Container - Increased height for better visibility */}
      <div ref={mapContainerRef} className="h-72 w-full rounded-xl border-2 border-indigo-200 relative z-0" />
      
      <div className="flex gap-2 items-center">
        <input 
          readOnly 
          placeholder="Lat, Lng" 
          value={coordinates} 
          className="flex-1 bg-gray-100 p-2 rounded border border-gray-300 text-sm"
        />
        <button 
          type="button" 
          onClick={handleGPS}
          className="text-sm bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 whitespace-nowrap"
        >
          📍 Use GPS
        </button>
      </div>
    </div>
  );
};

export default MapPicker;