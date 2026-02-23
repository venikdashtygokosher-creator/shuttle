import { useState, useEffect } from 'react';
import api from '../api';

const EMPTY_PLAN = {
  name: '', type: 'monthly', total_cost: '', trip_limit: '',
  duration_months: 1, manual_expiry_date: '', is_active: true,
  unlimited: true,
};

function PlanModal({ plan, onClose, onSaved }) {
  const [form, setForm] = useState(
    plan
      ? { ...plan, unlimited: plan.trip_limit === null, trip_limit: plan.trip_limit ?? '' }
      : { ...EMPTY_PLAN }
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const payload = {
      name: form.name,
      type: form.type,
      total_cost: parseFloat(form.total_cost) || 0,
      trip_limit: form.unlimited ? null : parseInt(form.trip_limit) || null,
      duration_months: ['monthly', 'bi-monthly'].includes(form.type) ? parseInt(form.duration_months) : null,
      manual_expiry_date: form.type === 'manual' ? form.manual_expiry_date || null : null,
      is_active: form.is_active,
    };
    try {
      let data;
      if (plan) {
        data = (await api.put(`/plans/${plan.id}`, payload)).data;
      } else {
        data = (await api.post('/plans', payload)).data;
      }
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-title">{plan ? 'Edit Plan' : 'Create Plan'}</div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSave}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Plan Name *</label>
              <input className="form-control" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Monthly Standard" />
            </div>
            <div className="form-group">
              <label className="form-label">Type *</label>
              <select className="form-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="monthly">Monthly</option>
                <option value="bi-monthly">Bi-Monthly</option>
                <option value="pay-as-you-go">Pay-As-You-Go</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Total Cost ($)</label>
              <input className="form-control" type="number" step="0.01" min="0" value={form.total_cost} onChange={(e) => setForm({ ...form, total_cost: e.target.value })} placeholder="99.00" />
            </div>
            {(form.type === 'monthly' || form.type === 'bi-monthly') && (
              <div className="form-group">
                <label className="form-label">Duration (months)</label>
                <select className="form-control" value={form.duration_months} onChange={(e) => setForm({ ...form, duration_months: e.target.value })}>
                  <option value={1}>1 Month</option>
                  <option value={2}>2 Months</option>
                </select>
              </div>
            )}
            {form.type === 'manual' && (
              <div className="form-group">
                <label className="form-label">Expiry Date</label>
                <input className="form-control" type="date" value={form.manual_expiry_date} onChange={(e) => setForm({ ...form, manual_expiry_date: e.target.value })} />
              </div>
            )}
          </div>

          {form.type !== 'pay-as-you-go' && (
            <div className="form-group">
              <label className="form-label">Trip Limit</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.unlimited} onChange={(e) => setForm({ ...form, unlimited: e.target.checked })} />
                  Unlimited trips
                </label>
              </div>
              {!form.unlimited && (
                <input className="form-control" type="number" min="1" value={form.trip_limit} onChange={(e) => setForm({ ...form, trip_limit: e.target.value })} placeholder="e.g. 20" />
              )}
            </div>
          )}

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <span className="form-label" style={{ margin: 0 }}>Active (available for subscription)</span>
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Plan'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = closed, false = new, plan obj = edit
  const [error, setError] = useState('');

  async function fetchPlans() {
    setLoading(true);
    try {
      const { data } = await api.get('/plans');
      setPlans(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPlans(); }, []);

  async function handleDelete(plan) {
    if (!confirm(`Delete plan "${plan.name}"?`)) return;
    try {
      await api.delete(`/plans/${plan.id}`);
      fetchPlans();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  }

  function handleSaved(savedPlan) {
    setEditing(null);
    fetchPlans();
  }

  const typeColors = { monthly: 'badge-success', 'bi-monthly': 'badge-info', 'pay-as-you-go': 'badge-warning', manual: 'badge-secondary' };

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Plans ({plans.length})</span>
          <button className="btn btn-primary" onClick={() => setEditing(false)}>+ Create Plan</button>
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
                  <th>Cost</th>
                  <th>Trip Limit</th>
                  <th>Duration</th>
                  <th>Subscribers</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td><span className={`badge ${typeColors[p.type] || 'badge-secondary'}`}>{p.type}</span></td>
                    <td>${parseFloat(p.total_cost).toFixed(2)}</td>
                    <td>{p.trip_limit ?? '∞'}</td>
                    <td>
                      {p.type === 'monthly' || p.type === 'bi-monthly' ? `${p.duration_months} mo` : ''}
                      {p.type === 'manual' ? (p.manual_expiry_date?.slice(0, 10) || '—') : ''}
                      {p.type === 'pay-as-you-go' ? 'Per trip' : ''}
                    </td>
                    <td>{p.active_subscribers || 0}</td>
                    <td><span className={`badge ${p.is_active ? 'badge-success' : 'badge-secondary'}`}>{p.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => setEditing(p)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {plans.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: '#888' }}>No plans yet. Create your first plan!</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing !== null && (
        <PlanModal plan={editing || null} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
