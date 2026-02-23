import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';

const RESULT_TIMEOUT = 6000; // ms before clearing result

export default function Kiosk() {
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState('Shuttle Check-In');
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // Load trips and settings
    api.get('/kiosk/trips').then((r) => {
      setTrips(r.data);
      // Auto-select currently active trip
      const active = r.data.find((t) => t.is_currently_active);
      if (active) setSelectedTrip(active.id);
    });

    api.get('/settings').then((r) => {
      if (r.data.kiosk_title) setCompanyName(r.data.kiosk_title);
    }).catch(() => {});
  }, []);

  // Keep input focused at all times
  useEffect(() => {
    const focusInput = () => { if (inputRef.current) inputRef.current.focus(); };
    document.addEventListener('click', focusInput);
    focusInput();
    return () => document.removeEventListener('click', focusInput);
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setScanInput('');
    if (inputRef.current) inputRef.current.focus();
  }, []);

  async function handleScan(userId) {
    if (!userId.trim() || !selectedTrip) return;
    if (loading) return;

    setLoading(true);
    setScanInput('');

    try {
      const { data } = await api.post('/kiosk/scan', {
        user_id: userId.trim(),
        trip_id: selectedTrip,
      });
      setResult(data);
    } catch (err) {
      setResult({
        status: 'denied',
        reason: err.response?.data?.error || 'Scan error — please try again',
        customer: null,
      });
    } finally {
      setLoading(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(clearResult, RESULT_TIMEOUT);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      handleScan(scanInput);
    }
  }

  // NFC/RFID wedge typically sends Enter after the ID
  function handleInputChange(e) {
    const val = e.target.value;
    setScanInput(val);
    // Some wedges include a CR character or tab, auto-submit
    if (val.includes('\n') || val.includes('\r') || val.includes('\t')) {
      handleScan(val.replace(/[\n\r\t]/g, '').trim());
    }
  }

  const resultConfig = {
    allowed: { icon: '✅', label: 'ALLOWED', bg: '#166534', border: '#4ade80' },
    denied: { icon: '🚫', label: 'DENIED', bg: '#7f1d1d', border: '#f87171' },
    warning: { icon: '⚠️', label: 'WARNING', bg: '#713f12', border: '#fbbf24' },
  };

  const rc = result ? resultConfig[result.status] : null;

  return (
    <div className="kiosk-page" onClick={() => inputRef.current?.focus()}>
      <div className="kiosk-title">{companyName}</div>
      <div className="kiosk-subtitle">Tap your card or scan your ID to check in</div>

      {/* Trip selector */}
      <div className="kiosk-trip-select">
        <label style={{ color: '#aab0cc', fontSize: 13, marginBottom: 6, display: 'block' }}>Select Trip</label>
        <select
          className="form-control kiosk-input"
          value={selectedTrip}
          onChange={(e) => setSelectedTrip(e.target.value)}
          style={{ fontSize: 16, background: '#252540', color: '#fff', borderColor: '#3d3d6b' }}
        >
          <option value="">-- Select a trip --</option>
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.start_time?.slice(0, 5)} – {t.end_time?.slice(0, 5)})
              {t.is_currently_active ? ' 🟢' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Scan input (hidden but focused) */}
      <div className="kiosk-input-area">
        <input
          ref={inputRef}
          className="kiosk-input"
          value={scanInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={selectedTrip ? 'Scan card or type ID + Enter' : 'Select a trip first'}
          disabled={!selectedTrip || loading}
          autoComplete="off"
          autoFocus
        />
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ color: '#aab0cc', fontSize: 20, textAlign: 'center' }}>
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, margin: '0 auto 12px' }} />
          Checking...
        </div>
      )}

      {/* Result panel */}
      {result && rc && !loading && (
        <div
          className={`kiosk-result ${result.status}`}
          style={{ background: rc.bg, borderColor: rc.border, cursor: 'pointer' }}
          onClick={clearResult}
        >
          <div className="kiosk-icon">{rc.icon}</div>
          <div className="kiosk-status" style={{ color: result.status === 'allowed' ? '#4ade80' : result.status === 'denied' ? '#f87171' : '#fbbf24' }}>
            {rc.label}
          </div>

          {result.customer && (
            <div className="kiosk-name">{result.customer.name}</div>
          )}

          {result.status === 'allowed' && (
            <>
              <div className="kiosk-detail">
                {result.plan?.name} — {result.plan?.type}
              </div>
              {result.expiry_date && (
                <div className="kiosk-detail">
                  Valid until {new Date(result.expiry_date).toLocaleDateString()}
                </div>
              )}
              {result.trips_remaining !== null && result.trips_remaining !== undefined && (
                <div className="kiosk-detail" style={{ fontWeight: 700, fontSize: 24, marginTop: 8 }}>
                  {result.trips_remaining} trips remaining
                </div>
              )}
              {result.trips_remaining === null && (
                <div className="kiosk-detail">Unlimited trips</div>
              )}
              {result.charge && result.charge.charged && (
                <div className="kiosk-detail" style={{ marginTop: 8 }}>
                  Charged: ${parseFloat(result.charge.amount).toFixed(2)}
                </div>
              )}
              {result.charge && result.charge.cash && (
                <div className="kiosk-detail" style={{ marginTop: 8, color: '#fbbf24' }}>
                  Cash: ${parseFloat(result.charge.amount).toFixed(2)} due
                </div>
              )}
            </>
          )}

          {result.status === 'denied' && (
            <div className="kiosk-detail">{result.reason}</div>
          )}

          {result.near_expiry && result.status === 'allowed' && (
            <div style={{
              marginTop: 16, background: 'rgba(251,191,36,0.2)', border: '2px solid #fbbf24',
              borderRadius: 8, padding: '10px 16px', color: '#fbbf24', fontWeight: 600, fontSize: 18
            }}>
              ⚠️ Plan expires in {result.days_until_expiry} day{result.days_until_expiry !== 1 ? 's' : ''} — Please renew soon
            </div>
          )}

          <div style={{ marginTop: 24, color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
            Tap anywhere to dismiss
          </div>
        </div>
      )}

      {!result && !loading && (
        <div style={{ color: '#3d3d6b', fontSize: 14, marginTop: 20 }}>
          {selectedTrip ? 'Ready for scan' : 'Select a trip to begin'}
        </div>
      )}
    </div>
  );
}
