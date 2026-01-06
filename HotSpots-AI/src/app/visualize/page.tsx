'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { ScatterplotLayer } from '@deck.gl/layers';
import StaticMap, { NavigationControl } from 'react-map-gl';
import Link from 'next/link';
import Image from 'next/image';
import { InteractiveHoverButton } from '@/components/magicui/interactive-hover-button';
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
};

type TooltipInfo = {
  x: number;
  y: number;
  ndvi: number;
  bldDensity: number;
  vulnerability: number;
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
    id: 'heat-shield-heatmap',
    data,
    getPosition: (d) => d.position,
    getWeight: (d) => d.weight,
    radiusPixels: 600,
    intensity: 1,
    threshold: 0.1,
    colorRange: [
      [0, 255, 255, 0],
      [0, 255, 255, 50],
      [0, 200, 255, 100],
      [100, 255, 0, 150],
      [255, 255, 0, 200],
      [255, 140, 0, 220],
      [255, 0, 0, 255],
    ],
    colorDomain: [0, Math.max(...data.map((d) => d.weight), 1)],
  });

  const scatterLayer = new ScatterplotLayer<PointData>({
    id: 'heat-shield-circles',
    data,
    getPosition: (d) => d.position,
    getRadius: (d) => 80 + 200 * d.weight,
    getFillColor: (d) => {
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
      if (info && info.object) {
        setTooltip({
          x: info.x,
          y: info.y,
          ndvi: info.object.ndvi ?? 0,
          bldDensity: info.object.bldDensity ?? 0,
          vulnerability: info.object.vulnerability ?? info.object.weight ?? 0,
        });
      } else {
        setTooltip(null);
      }
    },
    updateTriggers: {
      getFillColor: [quantiles]
    }
  });

  const generatePlan = async (info: TooltipInfo) => {
    if (!info) return;
    setLoadingPlan(true);
    setAiPlan(null);
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

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
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
      audio.onended = () => setPlayingAudio(false);
      audio.play();
    } catch (e) {
      console.error(e);
      alert("Failed to play audio (Check Azure Keys)");
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
      minHeight: '100vh',
      width: '100vw',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      fontFamily: 'NeueHaasDisplay, Neue, sans-serif',
      position: 'relative',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div className="visualize-back-btn">
        <Link href="/" style={{ textDecoration: 'none' }}>
          <InteractiveHoverButton style={{ margin: '24px 0 0 24px', padding: '12px 24px', fontWeight: 600, fontSize: '16px', borderRadius: '12px' }}>
            Back
          </InteractiveHoverButton>
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
            flexDirection: 'column'
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

              <div className="sidebar-fade-border" style={{
                background: 'rgba(42, 42, 42, 0.95)',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                border: '1px solid #d1d5db',
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
                  {mode === 'gradient' ? 'Heatmap Legend' : 'Vulnerability Levels'}
                </h3>

                {mode === 'gradient' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 500 }}>Low to High Vulnerability</span>
                    </div>
                    <div style={{
                      height: '12px',
                      background: 'linear-gradient(90deg, #00ffff, #64ff00, #ffff00, #ff8c00, #ff0000)',
                      borderRadius: '6px',
                      marginTop: '8px'
                    }} />
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      color: '#888',
                      marginTop: '8px',
                      fontWeight: 500
                    }}>
                      <span>Low</span>
                      <span>High</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 0, 0.8)',
                        border: '2px solid rgba(255, 255, 0, 0.3)'
                      }} />
                      <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 500 }}>Low Risk</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'rgba(255, 165, 0, 0.8)',
                        border: '2px solid rgba(255, 165, 0, 0.3)'
                      }} />
                      <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 500 }}>Medium Risk</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'rgba(255, 100, 0, 0.8)',
                        border: '2px solid rgba(255, 100, 0, 0.3)'
                      }} />
                      <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 500 }}>High Risk</span>
                    </div>
                  </div>
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
                top: '20px',
                right: '20px',
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
              {/* Enhanced Tooltip */}
              {mode === 'circle' && tooltip && (
                <div
                  style={{
                    position: 'absolute',
                    pointerEvents: 'auto',
                    right: '20px',
                    bottom: '20px',
                    background: 'rgba(42, 42, 42, 0.95)',
                    color: '#fff',
                    padding: '16px 20px',
                    borderRadius: '16px',
                    fontSize: '14px',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
                    zIndex: 20,
                    minWidth: '300px',
                    maxWidth: '400px',
                    maxHeight: '60vh',
                    overflowY: 'auto',
                    lineHeight: 1.6,
                    border: '1px solid rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(12px)',
                    fontFamily: 'NeueHaasDisplay, Neue, sans-serif'
                  }}
                >
                  <div style={{ marginBottom: '12px', fontWeight: 600, color: '#F86D10', fontSize: '15px' }}>
                    📍 Vulnerability Point
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#9ca3af', fontWeight: 500 }}>Vulnerability:</span>
                    <span style={{ fontWeight: 600, color: '#fff' }}>{tooltip.vulnerability.toFixed(3)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#9ca3af', fontWeight: 500 }}>NDVI:</span>
                    <span style={{ fontWeight: 600, color: '#fff' }}>{tooltip.ndvi.toFixed(3)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#9ca3af', fontWeight: 500 }}>Building Density:</span>
                    <span style={{ fontWeight: 600, color: '#fff' }}>{tooltip.bldDensity.toFixed(3)}</span>
                  </div>
                  <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
                    {!aiPlan && !loadingPlan && (
                      <button
                        onClick={() => generatePlan(tooltip)}
                        style={{
                          width: '100%',
                          background: '#F86D10',
                          border: 'none',
                          borderRadius: '8px',
                          color: 'white',
                          padding: '8px',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        Generate AI Heat Plan ✨
                      </button>
                    )}
                    {loadingPlan && <div style={{ color: '#aaa', fontSize: '13px' }}>Generating plan with Azure OpenAI...</div>}

                    {aiPlan && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{
                          maxHeight: '200px',
                          overflowY: 'auto',
                          fontSize: '13px',
                          color: '#ddd',
                          marginBottom: '8px',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {aiPlan.plan}
                        </div>
                        <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                          <InteractiveHoverButton
                            onClick={playPlan}
                            disabled={loadingPlan}
                            style={{
                              flex: 1,
                              background: playingAudio ? '#ef4444' : '#0ea5e9', // Red for stop, Blue for play
                              border: 'none',
                              color: 'white',
                              padding: '10px 16px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '13px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            {playingAudio ? (
                              <>🛑 Stop Audio</>
                            ) : (
                              <>🔊 Listen to Plan</>
                            )}
                          </InteractiveHoverButton>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* AI Plan Modal/Overlay */}
              {mode === 'circle' && tooltip && (
                <div style={{
                  position: 'absolute',
                  top: '20px',
                  left: '20px',
                  zIndex: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  {/* "Generate Plan" Button inside the main tooltip or separate? 
                         Let's put it in the tooltip for better UX */}
                </div>
              )}
            </DeckGL>
          </div>
        </div>
      </div>

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