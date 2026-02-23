import { useState, useEffect, useRef } from 'react';
import api from '../api';

// Dynamic import to avoid SSR issues with leaflet
let MapContainer, TileLayer, Marker, Popup, Polyline, useMap;

export default function Tracking() {
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [devices, setDevices] = useState([]);
  const [livePositions, setLivePositions] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [historyRange, setHistoryRange] = useState({
    from: new Date(Date.now() - 86400000).toISOString().slice(0, 16),
    to: new Date().toISOString().slice(0, 16),
  });
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState('live');
  const [loading, setLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const intervalRef = useRef(null);

  useEffect(() => {
    // Lazy load leaflet
    import('leaflet').then((L) => {
      import('react-leaflet').then((rl) => {
        MapContainer = rl.MapContainer;
        TileLayer = rl.TileLayer;
        Marker = rl.Marker;
        Popup = rl.Popup;
        Polyline = rl.Polyline;
        setLeafletLoaded(true);
      });
    });

    api.get('/tracking/devices').then((r) => setDevices(r.data));
    fetchLive();

    // Get webhook URL from settings
    api.get('/settings').then((r) => {
      setWebhookUrl(r.data.traccar_url || '');
    });
  }, []);

  async function fetchLive() {
    try {
      const { data } = await api.get('/tracking/live');
      setLivePositions(data);
    } catch {}
  }

  useEffect(() => {
    if (mode === 'live') {
      intervalRef.current = setInterval(fetchLive, 5000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [mode]);

  async function fetchHistory() {
    if (!selectedDevice) return;
    setLoading(true);
    try {
      const { data } = await api.get('/tracking/history', {
        params: { device_id: selectedDevice, from: historyRange.from, to: historyRange.to, limit: 1000 },
      });
      setHistory(data);
    } finally {
      setLoading(false);
    }
  }

  const defaultCenter = livePositions.length
    ? [parseFloat(livePositions[0].latitude), parseFloat(livePositions[0].longitude)]
    : [25.0, -80.0];

  const polylinePoints = history.map((h) => [parseFloat(h.latitude), parseFloat(h.longitude)]);

  return (
    <div>
      <div className="card">
        <div className="card-header"><span className="card-title">GPS Tracking</span></div>
        <div style={{ marginBottom: 12, padding: '10px 14px', background: '#f7f9ff', borderRadius: 8, fontSize: 13 }}>
          <strong>Traccar Webhook URL:</strong>{' '}
          <code style={{ background: '#e8eeff', padding: '2px 8px', borderRadius: 4 }}>
            {window.location.origin}/api/tracking
          </code>
          {' '}— Configure Traccar to POST to this endpoint.
        </div>

        <div className="tabs" style={{ marginBottom: 16 }}>
          <div className={`tab ${mode === 'live' ? 'active' : ''}`} onClick={() => setMode('live')}>Live View</div>
          <div className={`tab ${mode === 'history' ? 'active' : ''}`} onClick={() => setMode('history')}>History Playback</div>
        </div>

        {mode === 'history' && (
          <div className="search-bar" style={{ marginBottom: 16 }}>
            <select className="form-control" value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)} style={{ flex: 'initial', width: 200 }}>
              <option value="">Select device...</option>
              {devices.map((d) => (
                <option key={d.device_id} value={d.device_id}>{d.device_id} (last: {d.last_seen ? new Date(d.last_seen).toLocaleString() : '?'})</option>
              ))}
            </select>
            <input className="form-control" type="datetime-local" value={historyRange.from} onChange={(e) => setHistoryRange({ ...historyRange, from: e.target.value })} style={{ flex: 'initial', width: 200 }} />
            <input className="form-control" type="datetime-local" value={historyRange.to} onChange={(e) => setHistoryRange({ ...historyRange, to: e.target.value })} style={{ flex: 'initial', width: 200 }} />
            <button className="btn btn-primary" onClick={fetchHistory} disabled={!selectedDevice}>Load History</button>
          </div>
        )}

        {/* Map */}
        <div className="map-container" style={{ background: '#e0e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!leafletLoaded ? (
            <div className="loading-overlay"><div className="spinner" /> Loading map...</div>
          ) : (
            <MapContainer
              center={defaultCenter}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {mode === 'live' && livePositions.map((pos) => (
                <Marker key={pos.device_id} position={[parseFloat(pos.latitude), parseFloat(pos.longitude)]}>
                  <Popup>
                    <strong>{pos.device_id}</strong><br />
                    Speed: {pos.speed || 0} km/h<br />
                    Heading: {pos.heading || 0}°<br />
                    {pos.timestamp && new Date(pos.timestamp).toLocaleString()}
                  </Popup>
                </Marker>
              ))}
              {mode === 'history' && polylinePoints.length > 0 && (
                <>
                  <Polyline positions={polylinePoints} color="#6c8fff" weight={3} />
                  {history.length > 0 && (
                    <Marker position={[parseFloat(history[0].latitude), parseFloat(history[0].longitude)]}>
                      <Popup>Start</Popup>
                    </Marker>
                  )}
                  {history.length > 1 && (
                    <Marker position={[parseFloat(history[history.length - 1].latitude), parseFloat(history[history.length - 1].longitude)]}>
                      <Popup>End</Popup>
                    </Marker>
                  )}
                </>
              )}
            </MapContainer>
          )}
        </div>
      </div>

      {/* Known devices */}
      <div className="card">
        <div className="card-header"><span className="card-title">Known Devices</span>
          <button className="btn btn-secondary btn-sm" onClick={() => api.get('/tracking/devices').then((r) => setDevices(r.data))}>Refresh</button>
        </div>
        {devices.length === 0 ? (
          <p className="text-muted">No devices have reported data yet.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Device ID</th><th>Data Points</th><th>Last Seen</th></tr></thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.device_id}>
                    <td><strong>{d.device_id}</strong></td>
                    <td>{d.data_points}</td>
                    <td>{d.last_seen ? new Date(d.last_seen).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
