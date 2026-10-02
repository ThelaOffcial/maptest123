import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  MapMouseEvent,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  SRI_SUMANGALA_CENTER,
  SCHOOL_DATA,
  School,
  CategoryKey,
  CATEGORY_RULES,
  calculateGreatCircleDistance,
  getPermanentAddressRoadMarks,
  getWorkplaceRoadMarks,
} from './data/schools';
import { MapOverlay } from './components/MapOverlay';
import { PrintReport } from './components/PrintReport';
import { SSCLogo } from './components/SSCLogo';
import { useApplicantLookup } from './hooks/useApplicantLookup';
import { saveDistanceMarks } from './firebase';
import { fetchRoadRoute } from './utils/roadDistance';
import { searchLocationQuery, SearchResult } from './utils/searchLocation';
import {
  School as SchoolIcon,
  MapPin,
  Crosshair,
  RotateCcw,
  Printer,
  Award,
  Layers,
  CheckCircle2,
  Eye,
  X,
  Briefcase,
  Building2,
  Route,
  Navigation,
  Search,
  Loader2,
} from 'lucide-react';

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyB2fS_e5lTyS3RfbD088y0lHJMRTs6BHKk';

const DEMO_MAP_ID = 'DEMO_MAP_ID';

const WORKPLACE_PRESETS = [
  { name: 'Kalutara Zonal Education Office', lat: 6.5854, lng: 79.9607, tier: '< 20 KM (5 pts)' },
  { name: 'Horana Zonal Education Office', lat: 6.7161, lng: 80.0632, tier: '20-40 KM (10 pts)' },
  { name: 'MoE Isurupaya, Battaramulla', lat: 6.8998, lng: 79.9234, tier: '20-40 KM (10 pts)' },
  { name: 'Avissawella Zonal Office', lat: 6.9535, lng: 80.2098, tier: '40-70 KM (15 pts)' },
  { name: 'Galle Zonal Education Office', lat: 6.0535, lng: 80.2210, tier: '70-100 KM (20 pts)' },
  { name: 'Kandy Provincial Dept of Education', lat: 7.2906, lng: 80.6337, tier: '> 100 KM (25 pts)' },
];

/**
 * Controller to smoothly pan & zoom map to searched/chosen location
 */
function MapPanController({
  targetLocation,
}: {
  targetLocation: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map || !targetLocation) return;
    map.panTo(targetLocation);
    const zoom = map.getZoom() || 15;
    if (zoom < 15) {
      map.setZoom(16);
    }
  }, [map, targetLocation]);
  return null;
}

export default function App() {
  const [mode, setMode] = useState<'search' | 'click' | 'coords'>('search');
  const [mapTypeId, setMapTypeId] = useState<string>('hybrid');
  const [category, setCategory] = useState<CategoryKey>('Closest Residence');

  // Search Location State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);
  const [panTarget, setPanTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [pinnedLocationName, setPinnedLocationName] = useState<string | null>(null);

  // Locations State
  const [residence, setResidence] = useState<{ lat: number; lng: number } | null>(null);
  const [inputLat, setInputLat] = useState<string>('');
  const [inputLng, setInputLng] = useState<string>('');

  // Education Category Specific Locations State
  const [activeTarget, setActiveTarget] = useState<'residence' | 'workplace'>('residence');
  const [workplace, setWorkplace] = useState<{ lat: number; lng: number } | null>(null);
  const [workplaceName, setWorkplaceName] = useState<string>('Ministry of Education / Office / School');
  const [inputWorkLat, setInputWorkLat] = useState<string>('');
  const [inputWorkLng, setInputWorkLng] = useState<string>('');

  // Road Routing Data for Education Category
  const [residenceRoadKm, setResidenceRoadKm] = useState<number | null>(null);
  const [residenceRoadPath, setResidenceRoadPath] = useState<{ lat: number; lng: number }[]>([]);
  const [residenceRoadDuration, setResidenceRoadDuration] = useState<string>('');
  const [loadingResRoad, setLoadingResRoad] = useState<boolean>(false);

  const [workplaceRoadKm, setWorkplaceRoadKm] = useState<number | null>(null);
  const [workplaceRoadPath, setWorkplaceRoadPath] = useState<{ lat: number; lng: number }[]>([]);
  const [workplaceRoadDuration, setWorkplaceRoadDuration] = useState<string>('');
  const [loadingWorkRoad, setLoadingWorkRoad] = useState<boolean>(false);

  // Form Details
  const [applicationNo, setApplicationNo] = useState<string>('');
  const [childName, setChildName] = useState<string>('');
  const [parentNic, setParentNic] = useState<string>('');
  const [parentName, setParentName] = useState<string>('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const { status: dbStatus, count: dbCount, lookup } = useApplicantLookup();
  const autoFilled = useRef<boolean>(false);
  const lookupResult = useMemo(() => lookup(applicationNo), [lookup, applicationNo]);

  useEffect(() => {
    if (lookupResult.status === 'found') {
      setChildName(lookupResult.record.name);
      setParentName(lookupResult.record.parentName);
      if (lookupResult.record.nicOrId) setParentNic(lookupResult.record.nicOrId);
      autoFilled.current = true;
    } else if (autoFilled.current) {
      setChildName('');
      setParentName('');
      setParentNic('');
      autoFilled.current = false;
    }
  }, [lookupResult]);

  // Selected School info popup
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [showCollegeInfo, setShowCollegeInfo] = useState<boolean>(false);
  const [locatingUser, setLocatingUser] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    const w = window as any;
    const prev = w.gm_authFailure;
    w.gm_authFailure = () => {
      setMapError(
        'Google Maps rejected the API key. In Google Cloud Console enable "Maps JavaScript API" and billing, and add ' +
          window.location.origin +
          '/* to the key\'s allowed HTTP referrers.'
      );
      if (typeof prev === 'function') prev();
    };
    return () => {
      w.gm_authFailure = prev;
    };
  }, []);

  const isEducationCategory = category === 'Education';

  // Live Location Search (Debounced 300ms)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      searchLocationQuery(trimmed)
        .then((res) => {
          setSearchResults(res);
          setShowSearchDropdown(true);
        })
        .catch(() => {
          setSearchResults([]);
        })
        .finally(() => setIsSearching(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Compute straight line (air) distance from Sri Sumangala College to applicant residence
  const distance = useMemo(() => {
    if (!residence) return null;
    return calculateGreatCircleDistance(
      SRI_SUMANGALA_CENTER.lat,
      SRI_SUMANGALA_CENTER.lng,
      residence.lat,
      residence.lng
    );
  }, [residence]);

  // Find schools closer to applicant residence than Sri Sumangala College (for circular deduction categories)
  const nearbySchools = useMemo(() => {
    if (isEducationCategory || !residence || distance === null) return [];
    return SCHOOL_DATA.filter((s) => {
      const dFromResidence = calculateGreatCircleDistance(
        residence.lat,
        residence.lng,
        s.lat,
        s.lng
      );
      return dFromResidence < distance;
    });
  }, [residence, distance, isEducationCategory]);

  // Automatic Road Route Calculation for Education Category
  useEffect(() => {
    if (!isEducationCategory) return;

    if (residence) {
      setLoadingResRoad(true);
      fetchRoadRoute(residence, { lat: SRI_SUMANGALA_CENTER.lat, lng: SRI_SUMANGALA_CENTER.lng })
        .then((res) => {
          setResidenceRoadKm(res.distanceKm);
          setResidenceRoadPath(res.path);
          setResidenceRoadDuration(res.durationText || '');
        })
        .finally(() => setLoadingResRoad(false));
    } else {
      setResidenceRoadKm(null);
      setResidenceRoadPath([]);
      setResidenceRoadDuration('');
    }
  }, [isEducationCategory, residence]);

  useEffect(() => {
    if (!isEducationCategory) return;

    if (workplace) {
      setLoadingWorkRoad(true);
      fetchRoadRoute(workplace, { lat: SRI_SUMANGALA_CENTER.lat, lng: SRI_SUMANGALA_CENTER.lng })
        .then((res) => {
          setWorkplaceRoadKm(res.distanceKm);
          setWorkplaceRoadPath(res.path);
          setWorkplaceRoadDuration(res.durationText || '');
        })
        .finally(() => setLoadingWorkRoad(false));
    } else {
      setWorkplaceRoadKm(null);
      setWorkplaceRoadPath([]);
      setWorkplaceRoadDuration('');
    }
  }, [isEducationCategory, workplace]);

  // Marks Calculation
  const categoryRule = CATEGORY_RULES[category];

  const residenceRoadMarks = useMemo(() => {
    return getPermanentAddressRoadMarks(residenceRoadKm);
  }, [residenceRoadKm]);

  const workplaceRoadMarks = useMemo(() => {
    return getWorkplaceRoadMarks(workplaceRoadKm);
  }, [workplaceRoadKm]);

  const maxMarks = categoryRule.max;
  const deduction = isEducationCategory ? 0 : nearbySchools.length * categoryRule.perSchool;
  const netMarks = isEducationCategory
    ? (residence ? residenceRoadMarks.marks : 0) + (workplace ? workplaceRoadMarks.marks : 0)
    : Math.max(0, maxMarks - deduction);

  const handleSelectSearchResult = (result: SearchResult) => {
    const pos = { lat: result.lat, lng: result.lng };
    if (isEducationCategory && activeTarget === 'workplace') {
      setWorkplace(pos);
      setWorkplaceName(result.title);
      setInputWorkLat(result.lat.toFixed(6));
      setInputWorkLng(result.lng.toFixed(6));
      setPinnedLocationName(`Workplace: ${result.title}`);
    } else {
      setResidence(pos);
      setInputLat(result.lat.toFixed(6));
      setInputLng(result.lng.toFixed(6));
      setPinnedLocationName(`Residence: ${result.title}`);
    }
    setPanTarget(pos);
    setShowSearchDropdown(false);
    setErrorMsg(null);
  };

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    try {
      const results = await searchLocationQuery(query);
      setSearchResults(results);
      if (results.length > 0) {
        handleSelectSearchResult(results[0]);
      } else {
        setErrorMsg(`No locations found matching "${query}". Try searching a nearby road, town, or landmark.`);
      }
    } catch {
      setErrorMsg('Location search failed. Please try again or click directly on the map.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (e.detail.latLng) {
        const newPos = { lat: e.detail.latLng.lat, lng: e.detail.latLng.lng };

        if (isEducationCategory && activeTarget === 'workplace') {
          setWorkplace(newPos);
          setInputWorkLat(newPos.lat.toFixed(6));
          setInputWorkLng(newPos.lng.toFixed(6));
          setPinnedLocationName(`Workplace pinned at ${newPos.lat.toFixed(4)}°, ${newPos.lng.toFixed(4)}°`);
        } else {
          setResidence(newPos);
          setInputLat(newPos.lat.toFixed(6));
          setInputLng(newPos.lng.toFixed(6));
          setPinnedLocationName(`Residence pinned at ${newPos.lat.toFixed(4)}°, ${newPos.lng.toFixed(4)}°`);
        }
        setPanTarget(newPos);
        setErrorMsg(null);
      }
    },
    [isEducationCategory, activeTarget]
  );

  const handleCheckCoordinates = () => {
    const isTargetWorkplace = isEducationCategory && activeTarget === 'workplace';
    const latStr = isTargetWorkplace ? inputWorkLat : inputLat;
    const lngStr = isTargetWorkplace ? inputWorkLng : inputLng;

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setErrorMsg('Please enter valid numeric latitude (-90 to 90) and longitude (-180 to 180).');
      return;
    }
    setErrorMsg(null);

    const pos = { lat, lng };
    if (isTargetWorkplace) {
      setWorkplace(pos);
      setPinnedLocationName(`Workplace coordinates applied`);
    } else {
      setResidence(pos);
      setPinnedLocationName(`Residence coordinates applied`);
    }
    setPanTarget(pos);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser or device.');
      return;
    }
    setLocatingUser(true);
    setErrorMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingUser(false);
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (isEducationCategory && activeTarget === 'workplace') {
          setWorkplace(newPos);
          setInputWorkLat(newPos.lat.toFixed(6));
          setInputWorkLng(newPos.lng.toFixed(6));
          setPinnedLocationName('Workplace set to Current GPS Location');
        } else {
          setResidence(newPos);
          setInputLat(newPos.lat.toFixed(6));
          setInputLng(newPos.lng.toFixed(6));
          setPinnedLocationName('Residence set to Current GPS Location');
        }
        setPanTarget(newPos);
      },
      (err) => {
        setLocatingUser(false);
        setErrorMsg(`Unable to retrieve location: ${err.message}. Please search or enter coordinates manually.`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSelectWorkplacePreset = (preset: typeof WORKPLACE_PRESETS[0]) => {
    const pos = { lat: preset.lat, lng: preset.lng };
    setWorkplace(pos);
    setWorkplaceName(preset.name);
    setInputWorkLat(preset.lat.toFixed(6));
    setInputWorkLng(preset.lng.toFixed(6));
    setPanTarget(pos);
    setPinnedLocationName(`Workplace: ${preset.name}`);
    setErrorMsg(null);
  };

  const handleReset = () => {
    setResidence(null);
    setInputLat('');
    setInputLng('');
    setWorkplace(null);
    setInputWorkLat('');
    setInputWorkLng('');
    setWorkplaceName('Ministry of Education / Office / School');
    setResidenceRoadKm(null);
    setResidenceRoadPath([]);
    setWorkplaceRoadKm(null);
    setWorkplaceRoadPath([]);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchDropdown(false);
    setPanTarget(null);
    setPinnedLocationName(null);
    setSelectedSchool(null);
    setShowCollegeInfo(false);
    setErrorMsg(null);
    setApplicationNo('');
    setChildName('');
    setParentName('');
    setParentNic('');
    setCategory('Closest Residence');
  };

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 6000);
  };

  // Save the marks to the matching applicant in Realtime DB, then print.
  const handlePrint = async () => {
    if (lookupResult.status === 'found') {
      const rec = lookupResult.record;
      const label = rec.categoryNo || rec.applicantNo;
      try {
        await saveDistanceMarks(rec.sheetKey, rec.applicantKey, {
          distanceMarks: netMarks,
          distanceMaxMarks: maxMarks,
          distanceCategory: category,
          distanceRoadKm: isEducationCategory ? residenceRoadKm : null,
        });
        showToast('success', `${label} → ${netMarks} marks saved to Realtime Database`);
      } catch (err) {
        console.error('Save marks failed:', err);
        showToast('error', `Could not save marks for ${label} to the database`);
      }
    } else {
      showToast('error', 'Marks not saved: enter a valid application number found in the database');
    }
    setTimeout(() => window.print(), 300);
  };

  return (
    <>
      {toast && (
        <div className={`no-print fixed top-4 right-4 z-[100] max-w-sm px-4 py-3 rounded-xl shadow-2xl border text-sm font-semibold backdrop-blur-xl ${toast.type === 'success' ? 'bg-emerald-600/95 border-emerald-300/40 text-white' : 'bg-rose-600/95 border-rose-300/40 text-white'}`}>
          {toast.type === 'success' ? '✅ ' : '⚠️ '}{toast.text}
        </div>
      )}
      {/* Screen Interactive App */}
      <div className="no-print min-h-screen text-[#f4f7fb]">
        <div className="max-w-[1440px] mx-auto p-4 md:p-6 lg:p-7">
          {/* Topbar Header */}
          <header className="flex flex-wrap md:flex-nowrap items-center gap-4 p-4 md:p-5 rounded-2xl bg-white/6 border border-white/14 backdrop-blur-xl shadow-2xl mb-6">
            <SSCLogo className="w-14 h-16 drop-shadow-xl hover:scale-105 transition-transform" />
            <div className="flex-1 min-w-[240px]">
              <p className="text-amber-300 text-xs md:text-sm font-semibold tracking-wider uppercase mb-0.5">
                Grade 1 · New Kids Registration
              </p>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-white leading-tight font-heading">
                Primary Section Admission — Distance Check
              </h1>
              <p className="text-slate-300 text-xs md:text-sm mt-0.5 font-medium">
                Sri Sumangala College, Panadura (ශ්‍රී සුමංගල විද්‍යාලය, පාණදුර)
              </p>
            </div>
            <div className="text-left md:text-right text-xs text-slate-400 leading-relaxed border-t md:border-t-0 pt-2 md:pt-0 border-white/10 w-full md:w-auto">
              <span className="font-semibold text-slate-300">Principal</span>
              <br />
              W. T. Raweendra Pushpakumara
              <br />
              <span className="text-[11px] text-slate-500">© All rights reserved</span>
            </div>
          </header>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Map Column (7 cols on lg) */}
            <section className="lg:col-span-7 bg-white/6 border border-white/14 rounded-2xl backdrop-blur-xl p-3.5 md:p-4 shadow-2xl">
              {/* Map Mode Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="inline-flex bg-black/40 border border-white/14 rounded-full p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setMode('search')}
                    className={`px-3.5 py-1.5 rounded-full text-xs md:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      mode === 'search'
                        ? 'bg-gradient-to-r from-amber-400 to-amber-300 text-slate-950 shadow-md font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Search location</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('click')}
                    className={`px-3.5 py-1.5 rounded-full text-xs md:text-sm font-semibold transition-all cursor-pointer ${
                      mode === 'click'
                        ? 'bg-gradient-to-r from-amber-400 to-amber-300 text-slate-950 shadow-md font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Click on map
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('coords')}
                    className={`px-3.5 py-1.5 rounded-full text-xs md:text-sm font-semibold transition-all cursor-pointer ${
                      mode === 'coords'
                        ? 'bg-gradient-to-r from-amber-400 to-amber-300 text-slate-950 shadow-md font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Enter coordinates
                  </button>
                </div>

                {/* Map Type Switcher */}
                <div className="flex items-center gap-1.5 bg-black/30 border border-white/10 px-2.5 py-1 rounded-lg text-xs">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-slate-400 hidden sm:inline">Layer:</span>
                  <select
                    value={mapTypeId}
                    onChange={(e) => setMapTypeId(e.target.value)}
                    className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs"
                  >
                    <option value="hybrid" className="bg-slate-900 text-white">Hybrid</option>
                    <option value="roadmap" className="bg-slate-900 text-white">Roadmap</option>
                    <option value="satellite" className="bg-slate-900 text-white">Satellite</option>
                  </select>
                </div>
              </div>

              {/* SEARCH LOCATION PANEL (Active when mode === 'search') */}
              {mode === 'search' && (
                <div className="mb-3.5 p-3.5 rounded-xl bg-black/35 border border-amber-400/30 animate-fadeIn relative">
                  <form onSubmit={handleSearchSubmit} className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowSearchDropdown(true);
                        }}
                        onFocus={() => {
                          if (searchResults.length > 0) setShowSearchDropdown(true);
                        }}
                        placeholder={
                          isEducationCategory && activeTarget === 'workplace'
                            ? 'Search workplace (e.g. Horana Zonal Office, Colombo, Kalutara, school)...'
                            : 'Search residence address, road, town (e.g. Nalluruwa, Walana, Panadura)...'
                        }
                        className="w-full bg-white/10 border border-white/20 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setSearchResults([]);
                            setShowSearchDropdown(false);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isSearching || !searchQuery.trim()}
                      className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 font-bold text-xs rounded-xl shadow transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      {isSearching ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                      <span>Search</span>
                    </button>
                  </form>

                  {/* Autocomplete / Results dropdown */}
                  {showSearchDropdown && searchResults.length > 0 && (
                    <div className="absolute left-3.5 right-3.5 top-full mt-1.5 z-40 bg-slate-900/95 border border-amber-400/40 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl max-h-60 overflow-y-auto divide-y divide-white/10">
                      {searchResults.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSearchResult(item)}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-amber-400/15 transition-colors flex items-start gap-2.5 cursor-pointer text-slate-200 group"
                        >
                          <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-white group-hover:text-amber-200 truncate">
                              {item.title}
                            </p>
                            {item.subtitle && (
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.subtitle}</p>
                            )}
                            <p className="text-[10px] text-amber-400/80 font-mono mt-0.5">
                              {item.lat.toFixed(5)}° N, {item.lng.toFixed(5)}° E
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quick Popular Location Chips */}
                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-1.5 flex-wrap text-[11px]">
                    <span className="text-slate-400 text-[10px] shrink-0 font-medium">Quick locations:</span>
                    {['Panadura Town', 'Walana', 'Nalluruwa', 'Pinwatta', 'Wadduwa', 'Horana Road', 'Dibbedda'].map(
                      (place, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSearchQuery(place);
                            setIsSearching(true);
                            searchLocationQuery(place)
                              .then((res) => {
                                if (res.length > 0) handleSelectSearchResult(res[0]);
                              })
                              .finally(() => setIsSearching(false));
                          }}
                          className="px-2 py-0.5 rounded bg-white/5 hover:bg-amber-400/20 text-slate-300 hover:text-amber-200 border border-white/10 hover:border-amber-400/30 transition-colors cursor-pointer text-[10px]"
                        >
                          {place}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* EDUCATION CATEGORY TARGET SWITCHER (Permanent Residence vs Workplace) */}
              {isEducationCategory && (
                <div className="mb-3 p-2.5 rounded-xl bg-gradient-to-r from-blue-950/70 via-indigo-950/60 to-amber-950/50 border border-blue-400/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
                      <Route className="w-3.5 h-3.5 text-sky-400" />
                      Education Category: Active Target Pin
                    </span>
                    <span className="text-[10px] bg-blue-500/20 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full font-medium">
                      Road Distance Only (No Air Distance)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTarget('residence')}
                      className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-between gap-1.5 border transition-all cursor-pointer ${
                        activeTarget === 'residence'
                          ? 'bg-sky-600 text-white border-sky-300 shadow-md ring-2 ring-sky-400/40'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                        1. Permanent Address
                      </span>
                      <span className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded bg-black/30">
                        {residence ? `${(residenceRoadKm ?? 0).toFixed(1)} km` : 'Not set'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTarget('workplace')}
                      className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-between gap-1.5 border transition-all cursor-pointer ${
                        activeTarget === 'workplace'
                          ? 'bg-amber-600 text-white border-amber-300 shadow-md ring-2 ring-amber-400/40'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Briefcase className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        2. Workplace
                      </span>
                      <span className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded bg-black/30">
                        {workplace ? `${(workplaceRoadKm ?? 0).toFixed(1)} km` : 'Not set'}
                      </span>
                    </button>
                  </div>

                  {/* Workplace Quick Presets Bar */}
                  {activeTarget === 'workplace' && (
                    <div className="mt-2.5 pt-2 border-t border-white/10">
                      <div className="flex items-center justify-between text-[11px] text-amber-200/90 mb-1.5">
                        <span className="font-semibold flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-amber-400" />
                          Quick Workplace Presets across distance tiers:
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {WORKPLACE_PRESETS.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectWorkplacePreset(preset)}
                            className="text-[10px] bg-black/40 hover:bg-amber-500/20 text-slate-200 hover:text-amber-200 border border-white/10 hover:border-amber-400/40 px-2 py-1 rounded transition-colors cursor-pointer flex items-center gap-1"
                            title={`${preset.name} (${preset.tier})`}
                          >
                            <span>{preset.name.split(' ')[0]}</span>
                            <span className="text-amber-400 font-mono text-[9px]">({preset.tier})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Coordinates Inputs Row (Active when mode === 'coords') */}
              {mode === 'coords' && (
                <div className="mb-3.5 p-3 rounded-xl bg-black/30 border border-white/10 flex flex-wrap items-end gap-3 animate-fadeIn">
                  <div className="flex-1 min-w-[130px]">
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                      {isEducationCategory && activeTarget === 'workplace'
                        ? 'Workplace Latitude'
                        : 'Permanent Residence Latitude'}
                    </label>
                    <input
                      type="text"
                      value={isEducationCategory && activeTarget === 'workplace' ? inputWorkLat : inputLat}
                      onChange={(e) =>
                        isEducationCategory && activeTarget === 'workplace'
                          ? setInputWorkLat(e.target.value)
                          : setInputLat(e.target.value)
                      }
                      placeholder="e.g. 6.70860"
                      className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="flex-1 min-w-[130px]">
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                      {isEducationCategory && activeTarget === 'workplace'
                        ? 'Workplace Longitude'
                        : 'Permanent Residence Longitude'}
                    </label>
                    <input
                      type="text"
                      value={isEducationCategory && activeTarget === 'workplace' ? inputWorkLng : inputLng}
                      onChange={(e) =>
                        isEducationCategory && activeTarget === 'workplace'
                          ? setInputWorkLng(e.target.value)
                          : setInputLng(e.target.value)
                      }
                      placeholder="e.g. 79.91470"
                      className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckCoordinates}
                    className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-300 text-slate-950 font-bold text-xs rounded-lg hover:shadow-lg transition-transform active:scale-95 cursor-pointer"
                  >
                    Apply coordinates
                  </button>
                  <button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={locatingUser}
                    className="px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/20 text-slate-200 text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Crosshair className={`w-3.5 h-3.5 ${locatingUser ? 'animate-spin' : ''}`} />
                    <span>{locatingUser ? 'Locating…' : 'My GPS location'}</span>
                  </button>
                </div>
              )}

              {/* Status / Confirmation Badge */}
              {pinnedLocationName && (
                <div className="mb-2 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between animate-fadeIn">
                  <span className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">
                      Pinned: <strong className="text-white">{pinnedLocationName}</strong>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPinnedLocationName(null)}
                    className="text-emerald-400 hover:text-white text-xs cursor-pointer ml-2"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Error Alert */}
              {errorMsg && (
                <div className="mb-3 px-3 py-2 bg-red-950/60 border border-red-500/40 rounded-lg text-xs text-red-200">
                  {errorMsg}
                </div>
              )}

              {/* Helper prompt below toolbar */}
              <div className="text-xs text-slate-400 mb-2.5 flex items-center justify-between">
                <span>
                  {mode === 'search'
                    ? '🔍 Type an address, road, or town above to search and pin location automatically.'
                    : mode === 'click'
                      ? isEducationCategory
                        ? activeTarget === 'workplace'
                          ? '🏢 Click on the map to set Workplace location.'
                          : '🏠 Click on the map to set Permanent Address location.'
                        : '🎯 Click anywhere on the map or drag the applicant marker to measure distance.'
                      : '⌨️ Type coordinates, then click "Apply coordinates".'}
                </span>
                <span className="text-amber-400/90 font-medium hidden sm:inline">
                  {isEducationCategory ? 'Driving Road Network Active' : '35 Area Schools Mapped'}
                </span>
              </div>

              {/* Google Map Container */}
              <div className="w-full h-[540px] md:h-[600px] rounded-xl overflow-hidden border border-white/15 relative bg-[#0a1626]">
                <APIProvider
                  apiKey={GOOGLE_MAPS_API_KEY}
                  libraries={['routes', 'places']}
                  onError={(e) => setMapError(`Google Maps failed to load: ${String((e as any)?.message || e)}`)}
                >
                  <Map
                    defaultCenter={{ lat: SRI_SUMANGALA_CENTER.lat, lng: SRI_SUMANGALA_CENTER.lng }}
                    defaultZoom={15}
                    mapId={DEMO_MAP_ID}
                    mapTypeId={mapTypeId}
                    onClick={handleMapClick}
                    gestureHandling="greedy"
                    disableDefaultUI={false}
                    clickableIcons={false}
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    className="w-full h-full"
                  >
                    {/* Controller to smooth pan to search results */}
                    <MapPanController targetLocation={panTarget} />

                    {/* Sri Sumangala College Marker */}
                    <AdvancedMarker
                      position={{ lat: SRI_SUMANGALA_CENTER.lat, lng: SRI_SUMANGALA_CENTER.lng }}
                      onClick={() => setShowCollegeInfo(true)}
                      title={SRI_SUMANGALA_CENTER.en}
                    >
                      <div className="relative group cursor-pointer transition-transform hover:scale-110">
                        <SSCLogo className="w-10 h-12 filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]" />
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900 shadow"></span>
                      </div>
                    </AdvancedMarker>

                    {showCollegeInfo && (
                      <InfoWindow
                        position={{ lat: SRI_SUMANGALA_CENTER.lat, lng: SRI_SUMANGALA_CENTER.lng }}
                        onCloseClick={() => setShowCollegeInfo(false)}
                      >
                        <div className="p-1 text-slate-900 max-w-xs">
                          <h4 className="font-bold text-sm text-[#0b1f3a]">
                            {SRI_SUMANGALA_CENTER.en}
                          </h4>
                          <p className="text-xs text-slate-600 mt-0.5">{SRI_SUMANGALA_CENTER.name}</p>
                          <p className="text-[11px] text-amber-700 font-semibold mt-1">
                            Principal's Office (Measurement Destination)
                          </p>
                        </div>
                      </InfoWindow>
                    )}

                    {/* Surrounding Schools Markers (shown only for circular deduction categories) */}
                    {!isEducationCategory &&
                      SCHOOL_DATA.map((school, i) => {
                        const distFromRes = residence
                          ? calculateGreatCircleDistance(
                              residence.lat,
                              residence.lng,
                              school.lat,
                              school.lng
                            )
                          : null;
                        const isCloser =
                          distFromRes !== null &&
                          distance !== null &&
                          distFromRes < distance;

                        return (
                          <AdvancedMarker
                            key={i}
                            position={{ lat: school.lat, lng: school.lng }}
                            onClick={() => setSelectedSchool(school)}
                            title={`${school.en} (${school.name})`}
                          >
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center border text-xs shadow-md transition-transform hover:scale-110 cursor-pointer ${
                                isCloser
                                  ? 'bg-rose-600 text-white border-white ring-2 ring-rose-400'
                                  : 'bg-[#123057] text-amber-300 border-amber-300/60'
                              }`}
                            >
                              <SchoolIcon className="w-3.5 h-3.5" />
                            </div>
                          </AdvancedMarker>
                        );
                      })}

                    {selectedSchool && !isEducationCategory && (
                      <InfoWindow
                        position={{ lat: selectedSchool.lat, lng: selectedSchool.lng }}
                        onCloseClick={() => setSelectedSchool(null)}
                      >
                        <div className="p-1 text-slate-900 max-w-xs">
                          <h4 className="font-bold text-xs text-[#0b1f3a]">{selectedSchool.en}</h4>
                          <p className="text-xs text-slate-600 mt-0.5">{selectedSchool.name}</p>
                          <div className="text-[11px] text-slate-600 mt-1 space-y-1">
                            {residence && distance !== null ? (
                              <>
                                <p className="font-semibold text-slate-800">
                                  Distance to Residence (Center):{' '}
                                  {calculateGreatCircleDistance(
                                    residence.lat,
                                    residence.lng,
                                    selectedSchool.lat,
                                    selectedSchool.lng
                                  ).toFixed(0)}{' '}
                                  m
                                </p>
                                <p>
                                  Distance to SSC:{' '}
                                  {calculateGreatCircleDistance(
                                    SRI_SUMANGALA_CENTER.lat,
                                    SRI_SUMANGALA_CENTER.lng,
                                    selectedSchool.lat,
                                    selectedSchool.lng
                                  ).toFixed(0)}{' '}
                                  m
                                </p>
                                <p
                                  className={
                                    calculateGreatCircleDistance(
                                      residence.lat,
                                      residence.lng,
                                      selectedSchool.lat,
                                      selectedSchool.lng
                                    ) < distance
                                      ? 'text-rose-600 font-bold'
                                      : 'text-emerald-700 font-medium'
                                  }
                                >
                                  {calculateGreatCircleDistance(
                                    residence.lat,
                                    residence.lng,
                                    selectedSchool.lat,
                                    selectedSchool.lng
                                  ) < distance
                                    ? '⚠️ Inside Residence Radius (Closer than SSC - Deducts marks)'
                                    : '✓ Outside Residence Radius (Farther than SSC - No deduction)'}
                                </p>
                              </>
                            ) : (
                              <p>
                                Distance to SSC:{' '}
                                {calculateGreatCircleDistance(
                                  SRI_SUMANGALA_CENTER.lat,
                                  SRI_SUMANGALA_CENTER.lng,
                                  selectedSchool.lat,
                                  selectedSchool.lng
                                ).toFixed(0)}{' '}
                                m
                              </p>
                            )}
                          </div>
                        </div>
                      </InfoWindow>
                    )}

                    {/* Applicant Residence Marker */}
                    {residence && (
                      <AdvancedMarker
                        position={residence}
                        title={
                          isEducationCategory
                            ? `Permanent Residence · Road: ${(residenceRoadKm ?? 0).toFixed(2)} km`
                            : 'Applicant Residence (Circle Center)'
                        }
                        draggable={true}
                        onDragEnd={(e) => {
                          if (e.latLng) {
                            const newPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                            setResidence(newPos);
                            setInputLat(newPos.lat.toFixed(6));
                            setInputLng(newPos.lng.toFixed(6));
                            setPinnedLocationName(`Residence moved to ${newPos.lat.toFixed(4)}°, ${newPos.lng.toFixed(4)}°`);
                          }
                        }}
                      >
                        <div className="flex flex-col items-center cursor-move group">
                          <div
                            className={`px-2 py-0.5 rounded text-[10px] font-bold shadow mb-0.5 whitespace-nowrap flex items-center gap-1 border ${
                              isEducationCategory
                                ? 'bg-sky-950 text-sky-200 border-sky-400'
                                : 'bg-black/90 text-amber-300 border-amber-300/50'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                            {isEducationCategory
                              ? `Residence: ${residenceRoadKm !== null ? `${residenceRoadKm.toFixed(2)} km` : 'measuring…'}`
                              : 'Residence (Circle Center)'}
                          </div>
                          <div
                            className={`w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-white font-bold text-xs ring-4 ${
                              isEducationCategory
                                ? 'bg-sky-500 ring-sky-500/30'
                                : 'bg-emerald-500 ring-emerald-500/30'
                            }`}
                          >
                            <MapPin className="w-4 h-4" />
                          </div>
                        </div>
                      </AdvancedMarker>
                    )}

                    {/* Workplace Marker (Education Category) */}
                    {isEducationCategory && workplace && (
                      <AdvancedMarker
                        position={workplace}
                        title={`Workplace: ${workplaceName} · Road: ${(workplaceRoadKm ?? 0).toFixed(2)} km`}
                        draggable={true}
                        onDragEnd={(e) => {
                          if (e.latLng) {
                            const newPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                            setWorkplace(newPos);
                            setInputWorkLat(newPos.lat.toFixed(6));
                            setInputWorkLng(newPos.lng.toFixed(6));
                            setPinnedLocationName(`Workplace moved to ${newPos.lat.toFixed(4)}°, ${newPos.lng.toFixed(4)}°`);
                          }
                        }}
                      >
                        <div className="flex flex-col items-center cursor-move group">
                          <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-200 border border-amber-400 shadow mb-0.5 whitespace-nowrap flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                            Workplace: {workplaceRoadKm !== null ? `${workplaceRoadKm.toFixed(2)} km` : 'measuring…'}
                          </div>
                          <div className="w-8 h-8 rounded-full bg-amber-500 border-2 border-white shadow-xl flex items-center justify-center text-white font-bold text-xs ring-4 ring-amber-500/30">
                            <Briefcase className="w-4 h-4" />
                          </div>
                        </div>
                      </AdvancedMarker>
                    )}

                    {/* Polyline / Road Route / Circle Overlay */}
                    <MapOverlay
                      residenceLocation={residence}
                      radius={distance}
                      isEducationCategory={isEducationCategory}
                      residenceRoadPath={residenceRoadPath}
                      workplaceRoadPath={workplaceRoadPath}
                      workplaceLocation={workplace}
                    />
                  </Map>
                </APIProvider>

                {mapError && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-[#0a1626]/95 text-center">
                    <div className="max-w-md text-sm text-red-200 bg-red-950/70 border border-red-500/40 rounded-xl p-4">
                      {mapError}
                    </div>
                  </div>
                )}

                {/* Road Routing Loading Indicator */}
                {isEducationCategory && (loadingResRoad || loadingWorkRoad) && (
                  <div className="absolute top-3 left-3 z-10 bg-slate-900/90 border border-sky-400/40 text-sky-200 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg backdrop-blur">
                    <Navigation className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    <span>Calculating shortest road route…</span>
                  </div>
                )}
              </div>

              {/* Quick Actions Footer below map */}
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 mt-3 px-1 gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <SSCLogo className="w-3.5 h-4 inline-block" />
                    Principal's Office (Destination)
                  </span>

                  {isEducationCategory ? (
                    <>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-sky-500 inline-block border border-white"></span>
                        Permanent Address (Road Route)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-amber-500 inline-block border border-white"></span>
                        Workplace (Road Route)
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block border border-white"></span>
                        Residence (Circle Center)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-rose-600 inline-block border border-white"></span>
                        Closer School (Deduction)
                      </span>
                    </>
                  )}
                </div>

                {(residence || workplace) && (
                  <button
                    onClick={handleReset}
                    className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Clear all pins
                  </button>
                )}
              </div>
            </section>

            {/* Sidebar Column (5 cols on lg) */}
            <aside className="lg:col-span-5 flex flex-col gap-5">
              {/* Category & Marks Selection Card */}
              <div className="bg-white/6 border border-white/14 rounded-2xl backdrop-blur-xl p-5 shadow-2xl">
                <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-3 font-heading">
                  <Award className="w-4 h-4 text-amber-400" />
                  Category & Marks Evaluation
                </h2>

                <div className="mb-4">
                  <label className="block text-xs text-slate-300 mb-1.5 font-medium">
                    Admission Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CategoryKey)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="Closest Residence" className="bg-slate-900">
                      Closest Residence (ආසන්නතම පදිංචිකරු) - 50 Max
                    </option>
                    <option value="Brotherhood" className="bg-slate-900">
                      Brotherhood (සොහොයුරු සහෝදර) - 30 Max
                    </option>
                    <option value="Transfer" className="bg-slate-900">
                      Transfer (සේවා මාරුවීම්) - 30 Max
                    </option>
                    <option value="Foreign Travel" className="bg-slate-900">
                      Foreign Travel (විදේශගතව පැමිණි) - 35 Max
                    </option>
                    <option value="Education" className="bg-slate-900 text-amber-300 font-semibold">
                      Education (අධ්‍යාපන ක්ෂේත්‍රයේ නිලධාරීන්) - 35 Max (Road Distance)
                    </option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1.5">{categoryRule.description}</p>
                </div>

                {/* Score Summary Banner */}
                <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/70 to-teal-900/50 border border-emerald-500/40 flex items-center justify-between shadow-lg">
                  <div>
                    <span className="block text-xs font-semibold text-emerald-200">
                      Total Allocated Marks
                    </span>
                    <span className="text-[11px] text-emerald-300/80">
                      {isEducationCategory
                        ? residence && workplace
                          ? 'Road distance calculated for both locations'
                          : residence
                            ? 'Awaiting workplace location'
                            : 'Set residence & workplace via search or map'
                        : residence
                          ? 'Score calculated'
                          : 'Awaiting residence point'}
                    </span>
                  </div>
                  <div className="text-3xl font-extrabold text-emerald-300 font-mono">
                    {netMarks} / {maxMarks}
                  </div>
                </div>
              </div>

              {/* SPECIFIC EVALUATION CARD: EDUCATION CATEGORY vs STANDARD CIRCLE */}
              {isEducationCategory ? (
                /* EDUCATION ROAD DISTANCE BREAKDOWN CARD */
                <div className="bg-white/6 border border-white/14 rounded-2xl backdrop-blur-xl p-5 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-white flex items-center gap-2 font-heading">
                        <Route className="w-4 h-4 text-sky-400" />
                        Education Road Distance Evaluation
                      </h2>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Road driving distance only · Circular deductions do not apply
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">
                      {netMarks} / 35 Pts
                    </span>
                  </div>

                  {/* 1. Permanent Address Section */}
                  <div className="bg-white/5 border border-sky-500/30 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-sky-400" />
                        1. Permanent Address → Principal's Office
                      </span>
                      <span className="text-xs font-mono font-bold text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded border border-sky-500/30">
                        {residence ? `${residenceRoadMarks.marks} / 10 Marks` : '0 / 10 Marks'}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-xs py-1 border-b border-white/10">
                      <span className="text-slate-300">Shortest Road Distance</span>
                      <span className="font-bold text-white font-mono text-sm">
                        {residenceRoadKm !== null ? `${residenceRoadKm.toFixed(2)} km` : '—'}
                      </span>
                    </div>

                    {residenceRoadDuration && (
                      <div className="flex items-baseline justify-between text-[11px] py-1 text-slate-400">
                        <span>Estimated Drive Time</span>
                        <span className="font-mono text-slate-300">{residenceRoadDuration}</span>
                      </div>
                    )}

                    {/* Criteria Scale for Residence */}
                    <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-4 gap-1 text-center text-[10px]">
                      <div
                        className={`p-1 rounded border ${
                          residenceRoadKm !== null && residenceRoadKm <= 1.0
                            ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400 font-bold'
                            : 'bg-white/5 text-slate-400 border-white/5'
                        }`}
                      >
                        <div className="font-semibold">&lt; 1 KM</div>
                        <div className="text-emerald-400 font-bold">10 pts</div>
                      </div>
                      <div
                        className={`p-1 rounded border ${
                          residenceRoadKm !== null && residenceRoadKm > 1.0 && residenceRoadKm <= 3.0
                            ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400 font-bold'
                            : 'bg-white/5 text-slate-400 border-white/5'
                        }`}
                      >
                        <div className="font-semibold">1 - 3 KM</div>
                        <div className="text-emerald-400 font-bold">8 pts</div>
                      </div>
                      <div
                        className={`p-1 rounded border ${
                          residenceRoadKm !== null && residenceRoadKm > 3.0 && residenceRoadKm <= 5.0
                            ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400 font-bold'
                            : 'bg-white/5 text-slate-400 border-white/5'
                        }`}
                      >
                        <div className="font-semibold">3 - 5 KM</div>
                        <div className="text-emerald-400 font-bold">6 pts</div>
                      </div>
                      <div
                        className={`p-1 rounded border ${
                          residenceRoadKm !== null && residenceRoadKm > 5.0
                            ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400 font-bold'
                            : 'bg-white/5 text-slate-400 border-white/5'
                        }`}
                      >
                        <div className="font-semibold">&gt; 5 KM</div>
                        <div className="text-emerald-400 font-bold">4 pts</div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Workplace Section */}
                  <div className="bg-white/5 border border-amber-500/30 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                        2. Workplace → Principal's Office
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                        {workplace ? `${workplaceRoadMarks.marks} / 25 Marks` : '0 / 25 Marks'}
                      </span>
                    </div>

                    <div className="mb-2">
                      <label className="block text-[10px] text-slate-400 mb-1">Workplace / Institution Name</label>
                      <input
                        type="text"
                        value={workplaceName}
                        onChange={(e) => setWorkplaceName(e.target.value)}
                        placeholder="e.g. Zonal Education Office / School"
                        className="w-full bg-white/10 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="flex items-baseline justify-between text-xs py-1 border-b border-white/10">
                      <span className="text-slate-300">Shortest Road Distance</span>
                      <span className="font-bold text-white font-mono text-sm">
                        {workplaceRoadKm !== null ? `${workplaceRoadKm.toFixed(2)} km` : '—'}
                      </span>
                    </div>

                    {workplaceRoadDuration && (
                      <div className="flex items-baseline justify-between text-[11px] py-1 text-slate-400">
                        <span>Estimated Drive Time</span>
                        <span className="font-mono text-slate-300">{workplaceRoadDuration}</span>
                      </div>
                    )}

                    {/* Criteria Scale for Workplace */}
                    <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-5 gap-1 text-center text-[9px]">
                      <div
                        className={`p-1 rounded border ${
                          workplaceRoadKm !== null && workplaceRoadKm >= 100.0
                            ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400 font-bold'
                            : 'bg-white/5 text-slate-400 border-white/5'
                        }`}
                      >
                        <div className="font-semibold">&gt; 100 KM</div>
                        <div className="text-emerald-400 font-bold">25 pts</div>
                      </div>
                      <div
                        className={`p-1 rounded border ${
                          workplaceRoadKm !== null && workplaceRoadKm >= 70.0 && workplaceRoadKm < 100.0
                            ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400 font-bold'
                            : 'bg-white/5 text-slate-400 border-white/5'
                        }`}
                      >
                        <div className="font-semibold">70-100 KM</div>
                        <div className="text-emerald-400 font-bold">20 pts</div>
                      </div>
                      <div
                        className={`p-1 rounded border ${
                          workplaceRoadKm !== null && workplaceRoadKm >= 40.0 && workplaceRoadKm < 70.0
                            ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400 font-bold'
                            : 'bg-white/5 text-slate-400 border-white/5'
                        }`}
                      >
                        <div className="font-semibold">40-70 KM</div>
                        <div className="text-emerald-400 font-bold">15 pts</div>
                      </div>
                      <div
                        className={`p-1 rounded border ${
                          workplaceRoadKm !== null && workplaceRoadKm >= 20.0 && workplaceRoadKm < 40.0
                            ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400 font-bold'
                            : 'bg-white/5 text-slate-400 border-white/5'
                        }`}
                      >
                        <div className="font-semibold">20-40 KM</div>
                        <div className="text-emerald-400 font-bold">10 pts</div>
                      </div>
                      <div
                        className={`p-1 rounded border ${
                          workplaceRoadKm !== null && workplaceRoadKm < 20.0
                            ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400 font-bold'
                            : 'bg-white/5 text-slate-400 border-white/5'
                        }`}
                      >
                        <div className="font-semibold">&lt; 20 KM</div>
                        <div className="text-emerald-400 font-bold">5 pts</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* STANDARD CATEGORIES: CLOSER SCHOOLS DEDUCTION CARD */
                <>
                  {/* Location details card */}
                  <div className="bg-white/6 border border-white/14 rounded-2xl backdrop-blur-xl p-5 shadow-2xl">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-3.5 font-heading">
                      <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#e9b949]"></span>
                      Location & Distance Measurements
                    </h2>
                    <div className="divide-y divide-white/8 text-sm">
                      <div className="py-2.5 flex justify-between items-baseline">
                        <span className="text-slate-300">Distance to school (Radius)</span>
                        <span className="font-bold text-white font-mono text-base">
                          {distance !== null ? `${distance.toFixed(1)} m` : '—'}
                        </span>
                      </div>
                      <div className="py-2 flex justify-between items-baseline">
                        <span className="text-slate-400 text-xs">Distance in Kilometers</span>
                        <span className="font-semibold text-slate-200 font-mono text-xs">
                          {distance !== null ? `${(distance / 1000).toFixed(3)} km` : '—'}
                        </span>
                      </div>
                      <div className="py-2 flex justify-between items-baseline">
                        <span className="text-slate-300">Latitude</span>
                        <span className="font-mono text-slate-200 text-xs">
                          {residence ? residence.lat.toFixed(6) : '—'}
                        </span>
                      </div>
                      <div className="py-2 flex justify-between items-baseline">
                        <span className="text-slate-300">Longitude</span>
                        <span className="font-mono text-slate-200 text-xs">
                          {residence ? residence.lng.toFixed(6) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Schools closer than SSC */}
                  <div className="bg-white/6 border border-white/14 rounded-2xl backdrop-blur-xl p-5 shadow-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h2 className="text-sm font-bold text-white flex items-center gap-2 font-heading">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]"></span>
                          Schools Closer to Residence
                        </h2>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Inside circle (Center: Residence, Radius: {distance ? `${distance.toFixed(0)}m` : 'SSC'})
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                          nearbySchools.length === 0
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {nearbySchools.length} {nearbySchools.length === 1 ? 'school' : 'schools'}
                      </span>
                    </div>

                    <div className="max-h-52 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                      {nearbySchools.length === 0 ? (
                        <div className="text-center py-6 text-slate-300 text-xs bg-emerald-500/10 rounded-xl border border-emerald-500/20 px-3">
                          {residence
                            ? '✅ No closer schools found inside the residence circle! Zero deductions.'
                            : 'Search or place an entering location to evaluate closer schools.'}
                        </div>
                      ) : (
                        nearbySchools.map((s, idx) => {
                          const dFromRes = residence
                            ? calculateGreatCircleDistance(
                                residence.lat,
                                residence.lng,
                                s.lat,
                                s.lng
                              )
                            : null;
                          return (
                            <div
                              key={idx}
                              className="bg-white/5 hover:bg-white/10 border border-rose-500/20 rounded-xl p-2.5 transition-colors flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-100 truncate">{s.name}</p>
                                <p className="text-[11px] text-slate-400 truncate">{s.en}</p>
                                {dFromRes !== null && (
                                  <p className="text-[10px] text-amber-300/90 font-mono mt-0.5">
                                    📍 {dFromRes.toFixed(0)} m from residence{' '}
                                    {distance !== null && (
                                      <span className="text-rose-300">
                                        ({(distance - dFromRes).toFixed(0)} m closer than SSC)
                                      </span>
                                    )}
                                  </p>
                                )}
                              </div>
                              <span className="text-[11px] font-bold text-rose-400 shrink-0 font-mono bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                                -{categoryRule.perSchool} pts
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Deductions line */}
                    <div className="flex items-baseline justify-between pt-3 mt-3 border-t border-white/10 text-xs">
                      <span className="text-slate-300">
                        Total Deduction ({nearbySchools.length} × {categoryRule.perSchool})
                      </span>
                      <span className="text-sm font-bold text-rose-400 font-mono">- {deduction}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Applicant Details & Print Actions */}
              <div className="bg-white/6 border border-white/14 rounded-2xl backdrop-blur-xl p-5 shadow-2xl">
                <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-3.5 font-heading">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#e9b949]"></span>
                  Applicant Information
                </h2>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Application No.</label>
                    <input
                      type="text"
                      value={applicationNo}
                      onChange={(e) => setApplicationNo(e.target.value)}
                      placeholder="e.g. 2027/0142"
                      className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                    {dbStatus === 'loading' && (
                      <p className="mt-1 text-[11px] text-slate-400">Connecting to applicant database…</p>
                    )}
                    {dbStatus === 'error' && (
                      <p className="mt-1 text-[11px] text-rose-300">Could not reach the applicant database. Enter the name manually.</p>
                    )}
                    {dbStatus === 'ready' && lookupResult.status === 'found' && (
                      <p className="mt-1 text-[11px] text-emerald-300">
                        Found in {lookupResult.record.sheetName || 'database'} · {lookupResult.record.categoryNo || lookupResult.record.applicantNo}
                      </p>
                    )}
                    {dbStatus === 'ready' && lookupResult.status === 'not-found' && (
                      <p className="mt-1 text-[11px] text-amber-300">No applicant found with this number ({dbCount} loaded).</p>
                    )}
                    {dbStatus === 'ready' && lookupResult.status === 'ambiguous' && (
                      <p className="mt-1 text-[11px] text-amber-300">{lookupResult.count} applicants share this number. Type the full number, e.g. HS - 01.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Child's Full Name</label>
                    <input
                      type="text"
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      placeholder="Child's full name"
                      className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Parent's Name</label>
                    <input
                      type="text"
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      placeholder="Parent's / guardian's name"
                      className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Parent / Guardian NIC</label>
                    <input
                      type="text"
                      value={parentNic}
                      onChange={(e) => setParentNic(e.target.value)}
                      placeholder="e.g. 198512345678 / 851234567V"
                      className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="pt-1 flex items-start gap-2 text-xs text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      I certify that the information entered above and the residence/workplace locations
                      plotted are true and accurate for Grade 1 admission.
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="flex-1 min-w-[130px] py-2.5 px-4 bg-gradient-to-r from-amber-400 to-amber-300 text-slate-950 font-bold text-sm rounded-full shadow-lg hover:shadow-amber-400/20 transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    Print report
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPreview(true)}
                    className="py-2.5 px-3.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-semibold text-sm rounded-full transition-all active:scale-98 cursor-pointer flex items-center gap-1.5"
                    title="Preview printable report with map area"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="py-2.5 px-3.5 bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 font-semibold text-sm rounded-full transition-all active:scale-98 cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </aside>
          </div>

          {/* Footer */}
          <footer className="text-center text-xs text-slate-400 mt-10 mb-6 space-y-2 border-t border-white/10 pt-6">
            <p>
              Sri Sumangala College, Panadura · Principal's Office (6.71007° N, 79.91440° E). Distance measurement system
              compliant with Ministry of Education Grade 1 circular guidelines.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1 font-medium text-slate-300">
              <SSCLogo className="w-5 h-6 drop-shadow" />
              <span>
                Developed By <strong className="text-amber-400 font-bold tracking-wide">SSCICTS</strong> (Sri Sumangala College ICT Society)
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-normal tracking-wide pt-0.5">
              Developed By Samithu Dewapriya  0770613478
            </p>
          </footer>
        </div>
      </div>

      {/* Report Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 md:p-6 overflow-y-auto no-print">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
            {/* Modal Bar */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-white/10 text-white">
              <div className="flex items-center gap-2.5">
                <SSCLogo className="w-6 h-7" />
                <div>
                  <span className="font-bold text-sm tracking-wide block">
                    Printable Report Preview (Includes Map Area)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Official Grade 1 Admission Distance Verification
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-1.5 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 font-bold text-xs rounded-full flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Document
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-3 md:p-6 bg-slate-800/80">
              <PrintReport
                applicationNo={applicationNo}
                childName={childName}
                parentName={parentName}
                parentNic={parentNic}
                category={category}
                distance={distance}
                latitude={residence?.lat ?? null}
                longitude={residence?.lng ?? null}
                nearbySchools={nearbySchools}
                maxMarks={maxMarks}
                deduction={deduction}
                netMarks={netMarks}
                isPreview={true}
                workplaceLocation={workplace}
                workplaceName={workplaceName}
                residenceRoadKm={residenceRoadKm}
                workplaceRoadKm={workplaceRoadKm}
                residenceRoadMarks={residenceRoadMarks}
                workplaceRoadMarks={workplaceRoadMarks}
                residenceRoadPath={residenceRoadPath}
                workplaceRoadPath={workplaceRoadPath}
              />
            </div>
          </div>
        </div>
      )}

      {/* Printable Report Component (shown only when printing) */}
      <PrintReport
        applicationNo={applicationNo}
        childName={childName}
        parentName={parentName}
        parentNic={parentNic}
        category={category}
        distance={distance}
        latitude={residence?.lat ?? null}
        longitude={residence?.lng ?? null}
        nearbySchools={nearbySchools}
        maxMarks={maxMarks}
        deduction={deduction}
        netMarks={netMarks}
        workplaceLocation={workplace}
        workplaceName={workplaceName}
        residenceRoadKm={residenceRoadKm}
        workplaceRoadKm={workplaceRoadKm}
        residenceRoadMarks={residenceRoadMarks}
        workplaceRoadMarks={workplaceRoadMarks}
        residenceRoadPath={residenceRoadPath}
        workplaceRoadPath={workplaceRoadPath}
      />
    </>
  );
}
