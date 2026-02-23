import { useState, useEffect } from 'react';
import api from '../api';

function AdminsPanel() {
  const [admins, setAdmins] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function fetchAdmins() {
    try {
      const { data } = await api.get('/auth/admins');
      setAdmins(data);
    } catch {}
  }

  useEffect(() => { fetchAdmins(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await api.post('/auth/admins', form);
      setForm({ name: '', email: '', password: '', role: 'admin' });
      setShowAdd(false);
      fetchAdmins();
      setSuccess('Admin added successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    }
  }

  async function handleDelete(admin) {
    if (!confirm(`Delete admin "${admin.name}"?`)) return;
    try {
      await api.delete(`/auth/admins/${admin.id}`);
      fetchAdmins();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Admin Users</span>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>+ Add Admin</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showAdd && (
        <form onSubmit={handleAdd} style={{ marginBottom: 16, padding: 16, background: '#f7f9ff', borderRadius: 8 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-control" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-control" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input className="form-control" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-control" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-success btn-sm">Add Admin</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="table-wrapper">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.name}</strong></td>
                <td>{a.email}</td>
                <td><span className="chip">{a.role}</span></td>
                <td>{new Date(a.created_at).toLocaleDateString()}</td>
                <td><button className="btn btn-sm btn-danger" onClick={() => handleDelete(a)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/settings').then((r) => setSettings(r.data)).finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setSuccess(''); setError('');
    try {
      await api.put('/settings', settings);
      setSuccess('Settings saved successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-overlay"><div className="spinner" /> Loading...</div>;

  return (
    <div>
      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSave}>
        {/* General Settings */}
        <div className="card">
          <div className="card-header"><span className="card-title">General</span></div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input className="form-control" value={settings.company_name || ''} onChange={(e) => setSettings({ ...settings, company_name: e.target.value })} placeholder="Shuttle Co" />
            </div>
            <div className="form-group">
              <label className="form-label">Kiosk Title</label>
              <input className="form-control" value={settings.kiosk_title || ''} onChange={(e) => setSettings({ ...settings, kiosk_title: e.target.value })} placeholder="Shuttle Check-In" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Renewal Reminder (days before expiry)</label>
              <input className="form-control" type="number" min="0" max="30" value={settings.renewal_reminder_days ?? 3} onChange={(e) => setSettings({ ...settings, renewal_reminder_days: parseInt(e.target.value) })} />
              <div className="text-muted mt-1" style={{ fontSize: 11 }}>Show a renewal warning on the kiosk N days before plan expiry</div>
            </div>
            <div className="form-group">
              <label className="form-label">Default Payment Method</label>
              <select className="form-control" value={settings.default_payment_method || 'cash'} onChange={(e) => setSettings({ ...settings, default_payment_method: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stripe Settings */}
        <div className="card">
          <div className="card-header"><span className="card-title">Stripe Configuration</span></div>
          <div className="form-group">
            <label className="form-label">Stripe Publishable Key</label>
            <input className="form-control" value={settings.stripe_publishable_key || ''} onChange={(e) => setSettings({ ...settings, stripe_publishable_key: e.target.value })} placeholder="pk_live_..." />
            <div className="text-muted mt-1" style={{ fontSize: 11 }}>Configure STRIPE_SECRET_KEY in backend .env</div>
          </div>
          <div style={{ padding: '10px 14px', background: '#f0f4ff', borderRadius: 8, fontSize: 13 }}>
            <strong>Stripe Webhook Endpoint:</strong>{' '}
            <code style={{ background: '#e0e8ff', padding: '2px 8px', borderRadius: 4 }}>
              {window.location.origin}/api/payments/stripe/webhook
            </code>
          </div>
        </div>

        {/* Traccar Settings */}
        <div className="card">
          <div className="card-header"><span className="card-title">GPS Tracking (Traccar)</span></div>
          <div className="form-group">
            <label className="form-label">Traccar Server URL (optional)</label>
            <input className="form-control" value={settings.traccar_url || ''} onChange={(e) => setSettings({ ...settings, traccar_url: e.target.value })} placeholder="https://traccar.example.com" />
          </div>
          <div style={{ padding: '10px 14px', background: '#f0f4ff', borderRadius: 8, fontSize: 13 }}>
            <strong>Incoming Webhook URL:</strong>{' '}
            <code style={{ background: '#e0e8ff', padding: '2px 8px', borderRadius: 4 }}>
              {window.location.origin}/api/tracking
            </code>
            <div className="text-muted mt-1">Configure Traccar to forward GPS data to the above URL</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Admin Users */}
      <AdminsPanel />
    </div>
  );
}
