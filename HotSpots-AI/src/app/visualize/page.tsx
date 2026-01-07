'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { ScatterplotLayer } from '@deck.gl/layers';
import StaticMap, { NavigationControl } from 'react-map-gl';
import Link from 'next/link';
import Image from 'next/image';
import { InteractiveHoverButton, InteractiveHoverBackButton } from '@/components/magicui/interactive-hover-button';
import { AnimatedSubscribeButton } from '@/components/magicui/animated-subscribe-button';

const INITIAL_VIEW_STATE = {
  latitude: 28.6304,
  longitude: 77.2177,
  zoom: 13,
  pitch: 60,
  bearing: 0,
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type PointData = {
  position: [number, number];
  weight: number;
  ndvi?: number;
  bldDensity?: number;
  vulnerability?: number;
  aqi?: number;
  pop?: number;
};

type TooltipInfo = {
  x: number;
  y: number;
  ndvi: number;
  bldDensity: number;
  vulnerability: number;
  aqi: number;
  pop: number;
} | null;

type AIPlan = {
  plan: string;
  is_mock: boolean;
};

function formatTime(date: Date | null) {
  if (!date) return 'Loading...';
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const mins = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${mins} ${ampm}`;
}

export default function Visualize() {
  const [data, setData] = useState<PointData[]>([]);
  const [mode, setMode] = useState<'gradient' | 'circle'>('circle');
  const [vizMode, setVizMode] = useState<'heat' | 'aqi' | 'risk' | 'pop'>('heat');
  const [tooltip, setTooltip] = useState<TooltipInfo>(null);
  const [quantiles, setQuantiles] = useState<{ q1: number, q2: number }>({ q1: 0.33, q2: 0.66 });
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [mapContainerRef, setMapContainerRef] = useState<HTMLDivElement | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchOptions, setSearchOptions] = useState<{ name: string; coords: [number, number] }[]>([]);
  const [aiPlan, setAiPlan] = useState<AIPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [shakePanel, setShakePanel] = useState(false);
  const [showGreenRx, setShowGreenRx] = useState(false);
  const [calculatingRx, setCalculatingRx] = useState(false);

  useEffect(() => {
    setLastUpdated(new Date());
  }, []);

  // Loaded from API

  const filteredOptions = searchOptions.filter(option =>
    option.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearch = (location: { name: string; coords: [number, number] }) => {
    setViewState({
      ...viewState,
      latitude: location.coords[0],
      longitude: location.coords[1],
      zoom: 16
    });
    setSearchQuery('');
  };

  const toggleFullscreen = () => {
    if (mapContainerRef) {
      if (!document.fullscreenElement) {
        mapContainerRef.requestFullscreen();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    // Fetch config from the backend (Relative path works for both Local and Vercel)
    fetch('/api/config')
      .then(res => res.json())
      .then(config => {
        if (config.initial_view) {
          setViewState(prev => ({
            ...prev,
            ...config.initial_view
          }));
        }
        if (config.locations) {
          setSearchOptions(config.locations);
        }
      })
      .catch(console.error);

    fetch(`/api/vulnerability-points?v=${new Date().getTime()}`)
      .then((res) => res.json())
      .then((geojson) => {
        const pts: PointData[] = geojson.features.map((f: any) => ({
          position: f.geometry.coordinates,
          weight: f.properties.vulnerability,
          ndvi: f.properties.ndvi,
          bldDensity: f.properties.bldDensity,
          vulnerability: f.properties.vulnerability,
          aqi: f.properties.aqi,
          pop: f.properties.pop,
        }));
        setData(pts);
        if (pts.length > 0) {
          const sorted = [...pts].sort((a, b) => a.weight - b.weight);
          const q1 = sorted[Math.floor(0.33 * sorted.length)]?.weight ?? 0.33;
          const q2 = sorted[Math.floor(0.66 * sorted.length)]?.weight ?? 0.66;
          setQuantiles({ q1, q2 });
        }
      })
      .catch(console.error);
  }, []);

  const heatmapLayer = new HeatmapLayer<PointData>({
    id: `heat-shield-heatmap-${vizMode}`,
    data,
    getPosition: (d) => d.position,
    getWeight: (d) => {
      if (vizMode === 'aqi') return (d.aqi || 0) / 500;
      if (vizMode === 'pop') return (d.pop || 0) / 60000;
      if (vizMode === 'risk') {
        const aqiNorm = Math.min((d.aqi || 0) / 500, 1);
        const heatNorm = d.weight;
        const popNorm = Math.min((d.pop || 0) / 60000, 1);
        return (aqiNorm + heatNorm + popNorm) / 3;
      }
      return d.weight;
    },
    radiusPixels: 50, // Increase radius for smoother blend
    intensity: 1,
    threshold: 0.05,
    // Use the explicit Heat colors (Green->Yellow->Red)
    colorRange: [
      [0, 255, 0, 25],     // Green (Faint)
      [255, 255, 0, 85],   // Yellow
      [255, 140, 0, 155],  // Orange
      [255, 0, 0, 255]     // Red
    ],
    updateTriggers: {
      getWeight: [vizMode]
    },
    // Removed colorDomain to allow auto-scaling based on viewport max density
  });


  const scatterLayer = new ScatterplotLayer<PointData>({
    id: 'heat-shield-circles',
    data,
    getPosition: (d) => d.position,
    getRadius: (d) => 80 + 200 * d.weight,
    getFillColor: (d) => {
      if (vizMode === 'aqi') {
        const val = d.aqi || 0;
        // AQI Scale: Green(0-50) -> Yellow(51-100) -> Orange(101-200) -> Red(201-300) -> Maroon(300+)
        if (val <= 50) return [0, 228, 0, 200];
        if (val <= 100) return [255, 255, 0, 200];
        if (val <= 200) return [255, 126, 0, 200];
        if (val <= 300) return [255, 0, 0, 200];
        return [126, 0, 35, 220];
      }
      if (vizMode === 'pop') {
        const val = d.pop || 0;
        // Pop Scale: Light Blue -> Dark Purple
        const norm = Math.min(val / 30000, 1);
        return [100 + 100 * norm, 100 - 100 * norm, 255, 180 + 75 * norm];
      }
      if (vizMode === 'risk') {
        // Risk = Heat + AQI combined
        const aqiNorm = Math.min((d.aqi || 0) / 400, 1);
        const heatNorm = (d.vulnerability || 0);
        const risk = (aqiNorm + heatNorm) / 2;
        if (risk > 0.6) return [255, 0, 0, 255]; // Extreme
        if (risk > 0.4) return [255, 140, 0, 220]; // High
        return [255, 255, 0, 180]; // Moderate
      }

      // Default: Heat Vulnerability
      const v = d.weight;
      if (v < quantiles.q1) return [255, 255, 0, 180];
      if (v < quantiles.q2) return [255, 165, 0, 200];
      return [255, 100, 0, 220];
    },
    pickable: true,
    radiusMinPixels: 4,
    radiusMaxPixels: 40,
    stroked: false,
    filled: true,
    onClick: info => {
      // MODAL LOCK: Only lock if actively viewing a plan or generating one
      // If just viewing stats (tooltip only), allow switching points
      if (aiPlan || loadingPlan) {
        setShakePanel(true);
        setTimeout(() => setShakePanel(false), 500); // Reset shake after animation
        return;
      }

      if (info && info.object) {
        setTooltip({
          x: info.x,
          y: info.y,
          ndvi: info.object.ndvi ?? 0,
          bldDensity: info.object.bldDensity ?? 0,
          vulnerability: info.object.vulnerability ?? info.object.weight ?? 0,
          aqi: info.object.aqi ?? 0,
          pop: info.object.pop ?? 0,
        });
      } else {
        setTooltip(null);
      }
    },
    updateTriggers: {
      getFillColor: [quantiles, vizMode]
    }
  });

  const generatePlan = async (info: TooltipInfo) => {
    if (!info) return;
    setLoadingPlan(true);
    setAiPlan(null);
    setChatHistory([]);
    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vulnerability: info.vulnerability,
          bldDensity: info.bldDensity,
          ndvi: info.ndvi
        })
      });
      const data = await res.json();
      setAiPlan(data);
    } catch (e) {
      console.error(e);
      alert("Failed to generate plan");
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const newMessage = { role: 'user', content: chatInput };
    const updatedHistory = [...chatHistory, newMessage];
    setChatHistory(updatedHistory);
    setChatInput('');
    setLoadingChat(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: newMessage.content,
          history: chatHistory,
          context: tooltip ? {
            city: 'Selected Location',
            vulnerability: tooltip.vulnerability,
            bldDensity: tooltip.bldDensity,
            ndvi: tooltip.ndvi
          } : null
        })
      });
      const data = await res.json();
      setChatHistory([...updatedHistory, { role: 'assistant', content: data.reply }]);
    } catch (e) {
      console.error(e);
      setChatHistory([...updatedHistory, { role: 'assistant', content: "Error connecting to expert." }]);
    } finally {
      setLoadingChat(false);
    }
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      // Do NOT reset currentTime to 0 to allow resuming
    }
    setPlayingAudio(false);
  };

  const playPlan = async () => {
    if (playingAudio) {
      stopAudio();
      return;
    }

    if (!aiPlan || !aiPlan.plan) return;

    if (aiPlan.is_mock) {
      alert("Audio generation requires a valid Azure Speech Key. (This is a mock plan)");
      return;
    }

    // Resume if paused
    if (audioRef.current && !audioRef.current.ended) {
      audioRef.current.play();
      setPlayingAudio(true);
      return;
    }

    setPlayingAudio(true);
    try {
      const res = await fetch('/api/speak-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiPlan.plan.replace(/[#*-]/g, '') }) // Clean markdown for speech
      });

      if (!res.ok) throw new Error("Audio generation failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingAudio(false);
        // Optional: Reset to 0 when actually finished? 
        // audio.currentTime = 0; 
      };

      audio.play();
    } catch (e) {
      console.error(e);
      alert("Could not generate audio (Check Azure keys)");
      setPlayingAudio(false);
    }
  };


  const handleMapLoad = useCallback((event: any) => {
    const map = event.target;
    map.once('style.load', () => {
      const layers = map.getStyle().layers || [];
      const labelLayerId = layers.find(
        (layer: any) =>
          layer.type === 'symbol' &&
          layer.layout &&
          layer.layout['text-field']
      )?.id;

      if (map.getLayer('3d-buildings')) {
        map.removeLayer('3d-buildings');
      }

      map.addLayer(
        {
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#aaa',
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              14,
              0,
              14.05,
              ['get', 'height'],
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              14,
              0,
              14.05,
              ['get', 'min_height'],
            ],
            'fill-extrusion-opacity': 0.9,
          },
        },
        labelLayerId
      );
    });
  }, []);

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      width: '100vw',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      fontFamily: 'NeueHaasDisplay, Neue, sans-serif',
      position: 'relative',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <style>{`
        .sidebar-scroll-hide::-webkit-scrollbar {
          display: none;
        }
        .sidebar-scroll-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <div className="visualize-back-btn">
        <Link href="/" style={{ textDecoration: 'none' }}>
          <InteractiveHoverBackButton style={{
            margin: '24px 0 0 24px',
            padding: '12px 24px',
            fontWeight: 600,
            fontSize: '16px',
            borderRadius: '12px',
            minWidth: '120px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            Back
          </InteractiveHoverBackButton>
        </Link>
      </div>



      {/* Desktop Hero */}


      <div style={{
        padding: '0',
        width: '100%',
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 0
      }}>
        <div style={{
          background: 'white',
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
          overflow: 'hidden',
          border: 'none',
          display: 'flex',
          height: 'calc(100% - 24px)',
          minHeight: '520px',
          maxWidth: '90vw',
          width: '100%',
          margin: '0'
        }}>
          <div style={{
            width: '300px',
            background: 'rgba(42, 42, 42, 0.95)',
            borderRight: '1px solid #374151',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden', // Ensure it doesn't expand
            minHeight: 0 // Allow shrinking to fit parent
          }}>
            <div className="sidebar-scroll-hide" style={{
              padding: '18px 10px',
              overflowY: 'auto',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}>
              <div className="sidebar-fade-border" style={{
                background: 'rgba(42, 42, 42, 0.95)',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
                border: '1px solid #374151',
                transition: 'border-color 0.25s',
                cursor: 'pointer'
              }}>
                <h3 style={{
                  margin: '0 0 20px 0',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#F86D10',
                  letterSpacing: '-0.01em'
                }}>
                  Data Overview
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 500 }}>Total Points:</span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{data.length.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 500 }}>Max Vulnerability:</span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                      {data.length > 0 ? Math.max(...data.map(d => d.weight)).toFixed(3) : '0.000'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 500 }}>Avg Vulnerability:</span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                      {data.length > 0 ? (data.reduce((sum, d) => sum + d.weight, 0) / data.length).toFixed(3) : '0.000'}
                    </span>
                  </div>
                </div>
                <div style={{
                  marginTop: '18px',
                  fontSize: '13px',
                  color: '#888',
                  textAlign: 'left',
                  fontWeight: 400,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px'
                }}>
                  <span style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#10b981',
                    marginRight: '2px',
                  }} />
                  Last updated: {formatTime(lastUpdated)}
                </div>
              </div>

              <div style={{
                background: 'rgba(42, 42, 42, 0.95)',
                borderRadius: '16px',
                padding: '14px',
                boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
                border: '1px solid #374151',
                transition: 'border-color 0.25s',
                cursor: 'pointer'
              }}>
                <h3 style={{
                  margin: '0 0 20px 0',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#F86D10',
                  letterSpacing: '-0.01em'
                }}>
                  Visualization Mode
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <AnimatedSubscribeButton
                    className="visualization-mode-btn"
                    subscribeStatus={mode === 'gradient'}
                    onClick={() => setMode('gradient')}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      borderRadius: '10px',
                      padding: 0,
                      background: mode === 'gradient' ? '#F86D10' : '#2a2a2a',
                      color: mode === 'gradient' ? '#2a2a2a' : '#bdbdbd',
                      border: mode === 'gradient' ? '2px solid #F86D10' : '2px solid #232323',
                      boxShadow: mode === 'gradient' ? '0 4px 16px rgba(248,109,16,0.12)' : '0 2px 8px rgba(0,0,0,0.10)',
                      fontWeight: 600,
                      fontSize: '13px',
                      height: '40px',
                    }}
                  >
                    <span>Heatmap</span>
                    <span>Heatmap</span>
                  </AnimatedSubscribeButton>
                  <AnimatedSubscribeButton
                    className="visualization-mode-btn"
                    subscribeStatus={mode === 'circle'}
                    onClick={() => setMode('circle')}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      borderRadius: '10px',
                      padding: 0,
                      background: mode === 'circle' ? '#F86D10' : '#2a2a2a',
                      color: mode === 'circle' ? '#2a2a2a' : '#bdbdbd',
                      border: mode === 'circle' ? '2px solid #F86D10' : '2px solid #232323',
                      boxShadow: mode === 'circle' ? '0 4px 16px rgba(248,109,16,0.12)' : '0 2px 8px rgba(0,0,0,0.10)',
                      fontWeight: 600,
                      fontSize: '13px',
                      height: '40px',
                    }}
                  >
                    <span>Points</span>
                    <span>Points</span>
                  </AnimatedSubscribeButton>
                </div>
              </div>

              <div style={{
                background: 'rgba(42, 42, 42, 0.95)',
                borderRadius: '16px',
                padding: '14px',
                boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
                border: '1px solid #374151',
                marginTop: '-12px'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 600, color: '#F86D10' }}>
                  Visualization Layer
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { id: 'heat', label: 'Heat Vuln.' },
                    { id: 'aqi', label: 'Air Quality' },
                    { id: 'pop', label: 'Population' },
                    { id: 'risk', label: 'Health Risk' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setVizMode(opt.id as any);
                      }}
                      style={{
                        padding: '8px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: vizMode === opt.id ? '2px solid #F86D10' : '2px solid transparent',
                        background: vizMode === opt.id ? 'rgba(248,109,16,0.2)' : 'rgba(255,255,255,0.05)',
                        color: vizMode === opt.id ? '#F86D10' : '#888',
                        transition: 'all 0.2s'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>


              {/* Contextual Legend */}
              <div className="sidebar-fade-border" style={{
                background: 'rgba(42, 42, 42, 0.95)',
                borderRadius: '16px',
                padding: '24px',
                // marginTop: '24px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                border: '1px solid #d1d5db',
                transition: 'border-color 0.25s',
                cursor: 'pointer'
              }}>
                {vizMode === 'heat' && (
                  <>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 600, color: '#F86D10' }}>Vulnerability Levels</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255, 255, 0, 0.8)', border: '2px solid rgba(255, 255, 0, 0.3)' }} />
                        <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 500 }}>Low Risk</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255, 165, 0, 0.8)', border: '2px solid rgba(255, 165, 0, 0.3)' }} />
                        <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 500 }}>Medium Risk</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255, 100, 0, 0.8)', border: '2px solid rgba(255, 100, 0, 0.3)' }} />
                        <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 500 }}>High Risk</span>
                      </div>
                    </div>
                  </>
                )}
                {vizMode === 'aqi' && (
                  <>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 600, color: '#F86D10' }}>AQI Levels</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: 16, height: 16, background: 'rgb(0, 228, 0)', borderRadius: '4px' }} /> <span style={{ color: '#ccc', fontSize: 13 }}>Good (0-50)</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: 16, height: 16, background: 'rgb(255, 255, 0)', borderRadius: '4px' }} /> <span style={{ color: '#ccc', fontSize: 13 }}>Moderate (51-100)</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: 16, height: 16, background: 'rgb(255, 126, 0)', borderRadius: '4px' }} /> <span style={{ color: '#ccc', fontSize: 13 }}>Unhealthy (101-200)</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: 16, height: 16, background: 'rgb(255, 0, 0)', borderRadius: '4px' }} /> <span style={{ color: '#ccc', fontSize: 13 }}>Very Unhealthy</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: 16, height: 16, background: 'rgb(126, 0, 35)', borderRadius: '4px' }} /> <span style={{ color: '#ccc', fontSize: 13 }}>Hazardous (300+)</span></div>
                    </div>
                  </>
                )}
                {vizMode === 'risk' && (
                  <>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 600, color: '#F86D10' }}>Health Risk (Heat + AQI)</h3>
                    <div style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>Combined index of heat vulnerability and poor air quality.</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: 16, height: 16, background: 'rgb(255, 0, 0)', borderRadius: '4px' }} /> <span style={{ color: '#ccc', fontSize: 13 }}>Severe Risk</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: 16, height: 16, background: 'rgb(255, 140, 0)', borderRadius: '4px' }} /> <span style={{ color: '#ccc', fontSize: 13 }}>Elevated Risk</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: 16, height: 16, background: 'rgb(255, 255, 0)', borderRadius: '4px' }} /> <span style={{ color: '#ccc', fontSize: 13 }}>Moderate Risk</span></div>
                    </div>
                  </>
                )}
                {vizMode === 'pop' && (
                  <>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 600, color: '#F86D10' }}>Population Density</h3>
                    <div style={{ height: '12px', background: 'linear-gradient(90deg, #ADD8E6, #00008B)', borderRadius: '6px' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginTop: 4 }}>
                      <span>Low</span><span>High</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div
            ref={setMapContainerRef}
            style={{
              flex: 1,
              position: 'relative',
              background: '#f8fafc'
            }}
          >
            <button
              onClick={toggleFullscreen}
              style={{
                position: 'absolute',
                top: '36px',
                right: '34px',
                zIndex: 1000,
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '8px',
                padding: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 6px 25px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';
              }}
            >
              {isFullscreen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              )}
            </button>

            <DeckGL
              initialViewState={viewState}
              controller
              layers={[mode === 'gradient' ? heatmapLayer : scatterLayer]}
              style={{ borderRadius: '0' }}
            >
              <StaticMap
                mapboxAccessToken={MAPBOX_TOKEN}
                mapStyle="mapbox://styles/mapbox/standard"
                onLoad={handleMapLoad}
                onError={(e) => console.error("Map Error:", e)}
                style={{ width: '100%', height: '100%' }}
              >
                <NavigationControl position="top-left" />
              </StaticMap>
              {/* AI Plan Modal/Overlay */}
              {/* Right-Side Detail Panel (replaces floating tooltip) */}

            </DeckGL>

            {mode === 'circle' && tooltip && (
              <div
                className="detail-panel"
                onWheel={(e) => e.stopPropagation()} // Prevent map zoom when scrolling panel
                onClick={(e) => e.stopPropagation()} // Prevent click-through to map
                style={{
                  position: 'absolute',
                  top: '24px',
                  right: '24px',
                  bottom: '24px',
                  width: '380px',
                  background: 'rgba(30, 30, 30, 0.95)',
                  color: '#fff',
                  borderRadius: '20px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(16px)',
                  fontFamily: 'NeueHaasDisplay, Neue, sans-serif',
                  overflow: 'hidden', // Main container doesn't scroll, content does
                  transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                {/* Header / Close Button */}
                <div style={{
                  padding: '20px',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  justifyContent: 'center', // Center content nicely
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  // gap removed since button is absolute
                  position: 'relative', // Context for absolute button
                  minHeight: '32px' // Ensure height if button is taller
                }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTooltip(null);
                    }}
                    style={{
                      background: '#ffffff', // High visibility solid white
                      border: '1px solid #ffffff',
                      color: '#000000', // Black icon
                      cursor: 'pointer',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      zIndex: 60, // Ensure it's above panel content if needed
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      position: 'absolute',
                      left: '20px', // Anchor to left
                      top: '50%',
                      transform: 'translateY(-50%)' // Perfect vertical center
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f0f0f0';
                      e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'; // Keep transform
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; // Keep transform
                    }}
                    title="Close"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                  <div style={{ fontWeight: 600, color: '#F86D10', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📍 Selected Location
                  </div>
                </div>

                {/* Scrollable Content Area */}
                <div
                  onWheel={(e) => e.stopPropagation()}
                  style={{
                    padding: '20px',
                    overflowY: 'auto',
                    overscrollBehavior: 'contain', // Critical: prevents scroll chaining to map
                    flex: 1, // Takes remaining height
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}
                >

                  {/* Stats Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px' }}>
                      <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}>Vulnerability</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{tooltip.vulnerability.toFixed(3)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px' }}>
                      <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}>AQI</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: tooltip.aqi > 200 ? '#ff4d4d' : '#4dff4d' }}>{tooltip.aqi}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px' }}>
                      <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}>Population</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{tooltip.pop?.toLocaleString()}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px' }}>
                      <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}>Risk Level</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>
                        {(() => {
                          const score = tooltip.vulnerability + (tooltip.aqi / 500);
                          if (score > 1.2) return 'SEVERE';
                          if (score > 0.8) return 'MODERATE';
                          return 'LOW';
                        })()}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px' }}>
                      <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}>NDVI</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{tooltip.ndvi.toFixed(3)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px', gridColumn: 'span 2' }}>
                      <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}>Building Density</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{tooltip.bldDensity.toFixed(3)}</div>
                    </div>
                  </div>

                  {/* Action Area */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                    {!aiPlan && !loadingPlan && (
                      <button
                        onClick={() => generatePlan(tooltip)}
                        style={{
                          width: '100%',
                          background: 'linear-gradient(135deg, #F86D10 0%, #ff8c00 100%)',
                          border: 'none',
                          borderRadius: '12px',
                          color: 'white',
                          padding: '14px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '14px',
                          boxShadow: '0 4px 12px rgba(248, 109, 16, 0.3)',
                          transition: 'transform 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                        Generate AI Heat Plan ✨
                      </button>
                    )}

                    {/* Green Rx Simulator */}
                    {!aiPlan && !loadingPlan && (
                      <div style={{ marginTop: '12px' }}>
                        <button
                          onClick={() => {
                            if (!showGreenRx) {
                              setShowGreenRx(true);
                              setCalculatingRx(true);
                              setTimeout(() => setCalculatingRx(false), 4500);
                            } else {
                              setShowGreenRx(false);
                            }
                          }}
                          style={{
                            width: '100%',
                            background: showGreenRx ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            border: showGreenRx ? '1px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px',
                            color: showGreenRx ? '#22c55e' : '#fff',
                            padding: '12px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '14px',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                        >
                          {calculatingRx ? '⏳ Running Bio-Model...' : '🌱 Simulate Green Intervention'}
                        </button>

                        {showGreenRx && (
                          <div style={{
                            marginTop: '12px',
                            background: 'rgba(34, 197, 94, 0.05)',
                            border: '1px solid rgba(34, 197, 94, 0.2)',
                            borderRadius: '12px',
                            padding: '16px',
                            animation: 'fadeIn 0.3s ease-out'
                          }}>
                            {calculatingRx ? (
                              <div style={{ textAlign: 'center', padding: '10px 0', color: '#86efac', fontSize: '13px' }}>
                                <i>Analyzing micro-climate data...</i>
                              </div>
                            ) : (
                              <>
                                <div style={{ fontSize: '13px', color: '#86efac', marginBottom: '12px', fontWeight: 500 }}>
                                  Scenario: Planting 50 Native Trees & 200m² Green Roof
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>Proj. Temp Drop</div>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                                      -{((tooltip.bldDensity || 0.5) * 4 + 0.5).toFixed(1)}°C 📉
                                    </div>
                                  </div>
                                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>AQI Improvement</div>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                                      -{Math.round((tooltip.aqi || 200) * 0.15)} Pts 🍃
                                    </div>
                                  </div>
                                </div>
                                <div style={{ marginTop: '12px', fontSize: '12px', color: '#fff', borderTop: '1px solid rgba(34, 197, 94, 0.2)', paddingTop: '8px' }}>
                                  <span style={{ color: '#22c55e', fontWeight: 700 }}>Outcome:</span>
                                  {(() => {
                                    const tempDrop = (tooltip.bldDensity || 0.5) * 4 + 0.5;
                                    const currentScore = tooltip.vulnerability + (tooltip.aqi / 500);
                                    // Boost: Temp drop also reduces vulnerability score (0.08 per degree)
                                    const newScore = Math.max(0, (tooltip.vulnerability - (tempDrop * 0.08)) + ((tooltip.aqi * 0.85) / 500));

                                    const getLabel = (s: number) => s > 1.2 ? 'Severe' : s > 0.8 ? 'Moderate' : 'Low';
                                    const start = getLabel(currentScore);
                                    const end = getLabel(newScore);

                                    if (start === end) {
                                      return <span> Risk significantly mitigated within <b>{start}</b> levels.</span>;
                                    }
                                    return <span> Health Risk reduced from <b>{start}</b> to <b>{end}</b>.</span>;
                                  })()}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {loadingPlan && (
                      <div style={{
                        background: 'rgba(248, 109, 16, 0.1)',
                        color: '#F86D10',
                        padding: '12px',
                        borderRadius: '12px',
                        textAlign: 'center',
                        fontSize: '14px',
                        border: '1px solid rgba(248, 109, 16, 0.2)'
                      }}>
                        Generating plan with Azure OpenAI...
                      </div>
                    )}

                    {aiPlan && (
                      <div className="ai-content">
                        <button
                          onClick={() => {
                            setAiPlan(null);
                            setChatHistory([]); // Clear chat on reset
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#9ca3af',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginBottom: '12px',
                            padding: 0
                          }}
                        >
                          ← Back to Generate
                        </button>
                        <div style={{
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '12px',
                          padding: '14px',
                          fontSize: '13px',
                          color: '#e5e7eb',
                          lineHeight: '1.6',
                          whiteSpace: 'pre-wrap',
                          marginBottom: '16px',
                          border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                          {aiPlan.plan}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                          <InteractiveHoverButton
                            onClick={playPlan}
                            disabled={loadingPlan}
                            style={{
                              flex: 1,
                              background: playingAudio ? '#ef4444' : '#0ea5e9',
                              border: 'none',
                              color: 'white',
                              padding: '12px',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '13px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                            }}
                          >
                            {playingAudio ? <>⏸️ Pause Audio</> : <>🔊 Listen to Plan</>}
                          </InteractiveHoverButton>
                        </div>

                        {/* Chat Interface */}
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#F86D10', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            💬 Ask the City Expert
                          </div>

                          <div style={{
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: '12px',
                            padding: '12px',
                            minHeight: '120px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            marginBottom: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            {chatHistory.length === 0 && (
                              <div style={{ color: '#666', fontSize: '12px', textAlign: 'center', marginTop: '10px' }}>
                                Have questions about the plan? Ask here.
                              </div>
                            )}
                            {chatHistory.map((msg, idx) => (
                              <div key={idx} style={{
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                background: msg.role === 'user' ? '#0ea5e9' : 'rgba(255,255,255,0.1)',
                                color: '#fff',
                                padding: '8px 12px',
                                borderRadius: '12px',
                                borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                                borderBottomLeftRadius: msg.role === 'assistant' ? '2px' : '12px',
                                fontSize: '12px',
                                maxWidth: '85%',
                                lineHeight: '1.4'
                              }}>
                                {msg.content}
                              </div>
                            ))}
                            {loadingChat && <div style={{ fontSize: '11px', color: '#aaa', fontStyle: 'italic' }}>Expert is typing...</div>}
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                              placeholder="Type your question..."
                              style={{
                                flex: 1,
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                padding: '10px 12px',
                                color: 'white',
                                fontSize: '13px',
                                outline: 'none',
                                transition: 'border-color 0.2s'
                              }}
                              onFocus={(e) => e.target.style.borderColor = '#F86D10'}
                              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                            />
                            <button
                              onClick={handleSendMessage}
                              disabled={loadingChat}
                              style={{
                                background: '#F86D10',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '0 16px',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 600
                              }}
                            >
                              Send
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}


          </div>
        </div >
      </div >

      <style jsx global>{`
        @font-face {
          font-family: 'NeueHaasDisplay';
          src: url('/fonts/NeueHaasDisplayMediu.woff') format('woff');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        @keyframes sloganPulse {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
        .mobile-overlay {
          display: none;
        }
        @media (max-width: 900px) {
          .visualize-hero {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            min-height: 100vh !important;
            margin-bottom: 0 !important;
          }
          .visualize-hero ~ * {
            display: none !important;
          }
          body > div > div:not(.visualize-hero) {
            display: none !important;
          }
          body > div > .visualize-hero {
            display: flex !important;
          }
          .visualize-hero .city-mobile {
            display: block !important;
            margin-top: 0.5em;
            font-size: 0.9em;
            color: #888;
            font-weight: 200;
            letter-spacing: 0.01em;
          }
          .visualize-desktop-hero {
            display: none !important;
          }
        }
        @media (min-width: 901px) {
          .visualize-back-btn {
            position: relative;
            z-index: 1001;
            align-self: flex-start;
          }
          .visualize-desktop-hero {
            display: block !important;
            width: 100%;
          }
        }
        html, body, #__next, body > div:first-child {
          margin: 0 !important;
          padding: 0 !important;
        }
        .ai-grey {
          color: #888;
          font-size: 0.7em;
          font-weight: 500;
          margin-left: 2px;
          letter-spacing: 0;
          vertical-align: middle;
          position: relative;
          top: 4px;
          left: -2px;
        }
        .sidebar-fade-border:hover {
          border-color: #f3f4f6 !important;
        }
        .visualization-mode-btn {
          transition: border-color 0.22s, box-shadow 0.22s;
        }
        .visualization-mode-btn:hover {
          border-color: #fff !important;
          box-shadow: 0 0 0 2px #fff2;
        }
      `}</style>
    </div >
  );
} 