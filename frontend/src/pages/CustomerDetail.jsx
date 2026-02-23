import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

function EditModal({ customer, onClose, onSaved }) {
  const [form, setForm] = useState({ ...customer });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.put(`/customers/${customer.id}`, form);
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
        <div className="modal-title">Edit Customer</div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSave}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-control" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input className="form-control" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Address *</label>
            <input className="form-control" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select className="form-control" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SubscribeModal({ customerId, onClose, onSaved }) {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/plans').then((r) => setPlans(r.data.filter((p) => p.is_active)));
  }, []);

  async function handleSubscribe() {
    if (!selectedPlan) return;
    setLoading(true);
    try {
      await api.post(`/customers/${customerId}/subscribe`, {
        plan_id: selectedPlan.id,
        payment_method: payMethod,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-title">Subscribe / Renew Plan</div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-group">
          <label className="form-label">Choose Plan</label>
          <div style={{ display: 'grid', gap: 8 }}>
            {plans.map((p) => (
              <div key={p.id} onClick={() => setSelectedPlan(p)}
                style={{ padding: '10px 14px', borderRadius: 8, border: `2px solid ${selectedPlan?.id === p.id ? '#6c8fff' : '#e0e0e0'}`, cursor: 'pointer', background: selectedPlan?.id === p.id ? '#f0f4ff' : '#fff' }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {p.type} · ${parseFloat(p.total_cost).toFixed(2)} · {p.trip_limit ? `${p.trip_limit} trips` : 'Unlimited'}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Payment Method</label>
          <select className="form-control" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" disabled={!selectedPlan || loading} onClick={handleSubscribe}>
            {loading ? 'Processing...' : 'Confirm Subscription'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [scans, setScans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [subHistory, setSubHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info');
  const [showEdit, setShowEdit] = useState(false);
  const [showSubscribe, setShowSubscribe] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const [cRes, sRes, pRes, shRes] = await Promise.all([
        api.get(`/customers/${id}`),
        api.get(`/customers/${id}/scans`),
        api.get(`/customers/${id}/payments`),
        api.get(`/customers/${id}/plans`),
      ]);
      setCustomer(cRes.data);
      setScans(sRes.data);
      setPayments(pRes.data);
      setSubHistory(shRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [id]);

  async function handleDelete() {
    if (!confirm('Delete this customer? This cannot be undone.')) return;
    try {
      await api.delete(`/customers/${id}`);
      navigate('/customers');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  }

  if (loading) return <div className="loading-overlay"><div className="spinner" /> Loading...</div>;
  if (!customer) return <div className="alert alert-error">Customer not found.</div>;

  const hasPlan = customer.plan_status === 'active';

  return (
    <div>
      {/* Header */}
      <div className="card">
        <div className="card-header">
          <div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/customers')} style={{ marginBottom: 10 }}>← Back</button>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{customer.name}</div>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>ID: {customer.id}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => setShowEdit(true)}>✏️ Edit</button>
            <button className="btn btn-success btn-sm" onClick={() => setShowSubscribe(true)}>
              {hasPlan ? '🔄 Renew/Change Plan' : '+ Subscribe'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleDelete}>🗑 Delete</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div><div className="stat-label">Phone</div><div>{customer.phone}</div></div>
          <div><div className="stat-label">Address</div><div>{customer.address}</div></div>
          <div><div className="stat-label">Email</div><div>{customer.email || '—'}</div></div>
          <div><div className="stat-label">Payment Default</div>
            <span className={`badge ${customer.payment_method === 'card' ? 'badge-info' : 'badge-secondary'}`}>{customer.payment_method}</span>
          </div>
          {hasPlan && (
            <>
              <div>
                <div className="stat-label">Active Plan</div>
                <div style={{ fontWeight: 600 }}>{customer.plan_name}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>{customer.plan_type}</div>
              </div>
              <div><div className="stat-label">Expires</div><div>{customer.expiry_date?.slice(0, 10)}</div></div>
              <div><div className="stat-label">Trips Remaining</div><div style={{ fontWeight: 600 }}>{customer.trips_remaining ?? '∞'}</div></div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['info', 'scans', 'payments', 'history'].map((t) => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'info' && 'Plan Info'}
            {t === 'scans' && `Scan History (${scans.length})`}
            {t === 'payments' && `Payments (${payments.length})`}
            {t === 'history' && 'Subscription History'}
          </div>
        ))}
      </div>

      {tab === 'info' && (
        <div className="card">
          {hasPlan ? (
            <div>
              <div className="form-row-3">
                <div><div className="stat-label">Plan Name</div><div style={{ fontWeight: 600 }}>{customer.plan_name}</div></div>
                <div><div className="stat-label">Type</div><span className="chip">{customer.plan_type}</span></div>
                <div><div className="stat-label">Cost</div><div>${parseFloat(customer.total_cost || 0).toFixed(2)}</div></div>
                <div><div className="stat-label">Start Date</div><div>{customer.start_date?.slice(0, 10)}</div></div>
                <div><div className="stat-label">Expiry</div><div>{customer.expiry_date?.slice(0, 10)}</div></div>
                <div><div className="stat-label">Trips Remaining</div><div style={{ fontWeight: 700, fontSize: 20 }}>{customer.trips_remaining ?? '∞'}</div></div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
              No active plan. <button className="btn btn-primary btn-sm" onClick={() => setShowSubscribe(true)}>Subscribe Now</button>
            </div>
          )}
        </div>
      )}

      {tab === 'scans' && (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Date/Time</th><th>Trip</th><th>Status</th><th>Trips After</th><th>Reason</th></tr>
              </thead>
              <tbody>
                {scans.map((s) => (
                  <tr key={s.id}>
                    <td>{new Date(s.scanned_at).toLocaleString()}</td>
                    <td>{s.trip_name}</td>
                    <td><span className={`badge ${s.status === 'allowed' ? 'badge-success' : 'badge-danger'}`}>{s.status}</span></td>
                    <td>{s.trips_remaining_after_scan ?? '∞'}</td>
                    <td className="text-muted">{s.deny_reason || '—'}</td>
                  </tr>
                ))}
                {scans.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: '#888' }}>No scans yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.created_at).toLocaleDateString()}</td>
                    <td><strong>${parseFloat(p.amount).toFixed(2)}</strong></td>
                    <td><span className={`badge ${p.method === 'card' ? 'badge-info' : 'badge-secondary'}`}>{p.method}</span></td>
                    <td><span className={`badge ${p.status === 'completed' ? 'badge-success' : p.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>{p.status}</span></td>
                    <td className="text-muted">{p.notes || '—'}</td>
                  </tr>
                ))}
                {payments.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: '#888' }}>No payments yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Plan</th><th>Type</th><th>Start</th><th>Expires</th><th>Status</th><th>Payment</th></tr>
              </thead>
              <tbody>
                {subHistory.map((s) => (
                  <tr key={s.id}>
                    <td>{s.plan_name}</td>
                    <td><span className="chip">{s.plan_type}</span></td>
                    <td>{s.start_date?.slice(0, 10)}</td>
                    <td>{s.expiry_date?.slice(0, 10)}</td>
                    <td><span className={`badge ${s.status === 'active' ? 'badge-success' : s.status === 'expired' ? 'badge-danger' : 'badge-secondary'}`}>{s.status}</span></td>
                    <td>{s.payment_method}</td>
                  </tr>
                ))}
                {subHistory.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#888' }}>No history</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showEdit && <EditModal customer={customer} onClose={() => setShowEdit(false)} onSaved={(c) => { setCustomer({ ...customer, ...c }); setShowEdit(false); }} />}
      {showSubscribe && <SubscribeModal customerId={id} onClose={() => setShowSubscribe(false)} onSaved={() => { setShowSubscribe(false); fetchData(); }} />}
    </div>
  );
}
