import { useState, useEffect } from 'react';
import api from '../api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EMPTY_TRIP = {
  name: '', type: 'daily', start_time: '08:00', end_time: '09:00',
  days_of_week: [], trip_date: '', is_active: true,
};

function TripModal({ trip, onClose, onSaved }) {
  const [form, setForm] = useState(trip ? { ...trip, days_of_week: trip.days_of_week || [] } : { ...EMPTY_TRIP });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function toggleDay(day) {
    const days = form.days_of_week.includes(day)
      ? form.days_of_week.filter((d) => d !== day)
      : [...form.days_of_week, day].sort();
    setForm({ ...form, days_of_week: days });
  }

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const payload = {
      name: form.name,
      type: form.type,
      start_time: form.start_time,
      end_time: form.end_time,
      days_of_week: form.type === 'weekly' ? form.days_of_week : null,
      trip_date: form.type === 'single' ? form.trip_date || null : null,
      is_active: form.is_active,
    };
    try {
      let data;
      if (trip) {
        data = (await api.put(`/trips/${trip.id}`, payload)).data;
      } else {
        data = (await api.post('/trips', payload)).data;
      }
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save trip');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-title">{trip ? 'Edit Trip' : 'Create Trip'}</div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSave}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Trip Name *</label>
              <input className="form-control" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Morning Route" />
            </div>
            <div className="form-group">
              <label className="form-label">Type *</label>
              <select className="form-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="single">Single (one-time)</option>
                <option value="daily">Daily (every day)</option>
                <option value="weekly">Weekly (specific days)</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Time *</label>
              <input className="form-control" type="time" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">End Time *</label>
              <input className="form-control" type="time" required value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>

          {form.type === 'single' && (
            <div className="form-group">
              <label className="form-label">Trip Date *</label>
              <input className="form-control" type="date" required={form.type === 'single'} value={form.trip_date} onChange={(e) => setForm({ ...form, trip_date: e.target.value })} />
            </div>
          )}

          {form.type === 'weekly' && (
            <div className="form-group">
              <label className="form-label">Days of Week</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DAYS.map((d, i) => (
                  <button
                    key={i} type="button"
                    onClick={() => toggleDay(i)}
                    className={`btn btn-sm ${form.days_of_week.includes(i) ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <span className="form-label" style={{ margin: 0 }}>Active</span>
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Trip'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Trips() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  async function fetchTrips() {
    setLoading(true);
    try {
      const { data } = await api.get('/trips');
      setTrips(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTrips(); }, []);

  async function handleDelete(trip) {
    if (!confirm(`Delete trip "${trip.name}"?`)) return;
    try {
      await api.delete(`/trips/${trip.id}`);
      fetchTrips();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  }

  async function handleToggleActive(trip) {
    try {
      await api.put(`/trips/${trip.id}`, { ...trip, is_active: !trip.is_active });
      fetchTrips();
    } catch {}
  }

  const typeColors = { single: 'badge-info', daily: 'badge-success', weekly: 'badge-warning' };

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Trips ({trips.length})</span>
          <button className="btn btn-primary" onClick={() => setEditing(false)}>+ Create Trip</button>
        </div>
        {loading ? (
          <div className="loading-overlay"><div className="spinner" /> Loading...</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Time</th>
                  <th>Schedule</th>
                  <th>Scans Today</th>
                  <th>Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {trips.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.name}</strong></td>
                    <td><span className={`badge ${typeColors[t.type] || 'badge-secondary'}`}>{t.type}</span></td>
                    <td>{t.start_time?.slice(0, 5)} – {t.end_time?.slice(0, 5)}</td>
                    <td>
                      {t.type === 'weekly' && (t.days_of_week || []).map((d) => DAYS[d]).join(', ')}
                      {t.type === 'single' && (t.trip_date ? new Date(t.trip_date).toLocaleDateString() : '—')}
                      {t.type === 'daily' && 'Every day'}
                    </td>
                    <td>{t.total_scans_today || 0}</td>
                    <td>
                      <button
                        className={`btn btn-sm ${t.is_active ? 'btn-success' : 'btn-secondary'}`}
                        onClick={() => handleToggleActive(t)}
                      >
                        {t.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => setEditing(t)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {trips.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: '#888' }}>No trips yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing !== null && (
        <TripModal trip={editing || null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); fetchTrips(); }} />
      )}
    </div>
  );
}
