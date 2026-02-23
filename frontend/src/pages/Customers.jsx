import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const PLAN_TYPES = ['monthly', 'bi-monthly', 'pay-as-you-go', 'manual'];

function AddCustomerModal({ onClose, onSaved }) {
  const [step, setStep] = useState(1);
  const [details, setDetails] = useState({ name: '', phone: '', address: '', email: '', payment_method: 'cash' });
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (step === 2) {
      api.get('/plans').then((r) => setPlans(r.data.filter((p) => p.is_active)));
    }
  }, [step]);

  async function handleCreateCustomer(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/customers', details);
      setCustomer(data);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe() {
    if (!selectedPlan) return;
    setError('');
    setLoading(true);
    try {
      await api.post(`/customers/${customer.id}/subscribe`, {
        plan_id: selectedPlan.id,
        payment_method: payMethod,
      });
      onSaved(customer);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to subscribe');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-title">Add New Customer</div>

        <div className="steps">
          {['Details', 'Plan', 'Payment'].map((label, i) => (
            <div className="flex items-center" key={label} style={{ flex: i < 2 ? '1' : 'initial', display: 'flex', alignItems: 'center' }}>
              <div className="step">
                <div className={`step-circle ${step > i + 1 ? 'done' : step === i + 1 ? 'active' : 'pending'}`}>
                  {step > i + 1 ? '✓' : i + 1}
                </div>
                <span className="step-label">{label}</span>
              </div>
              {i < 2 && <div className={`step-line ${step > i + 1 ? 'done' : ''}`} />}
            </div>
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {step === 1 && (
          <form onSubmit={handleCreateCustomer}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-control" required value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} placeholder="Jane Doe" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone *</label>
                <input className="form-control" required value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} placeholder="555-1234" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Address *</label>
              <input className="form-control" required value={details.address} onChange={(e) => setDetails({ ...details, address: e.target.value })} placeholder="123 Main St" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Email (optional)</label>
                <input className="form-control" type="email" value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} placeholder="jane@example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Default Payment</label>
                <select className="form-control" value={details.payment_method} onChange={(e) => setDetails({ ...details, payment_method: e.target.value })}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>Next →</button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div>
            <div className="form-group">
              <label className="form-label">Select Plan</label>
              {plans.length === 0 ? (
                <p className="text-muted">No active plans available. <a href="/plans">Create one first.</a></p>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {plans.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlan(p)}
                      style={{
                        padding: '12px 16px', borderRadius: 8,
                        border: `2px solid ${selectedPlan?.id === p.id ? '#6c8fff' : '#e0e0e0'}`,
                        cursor: 'pointer', background: selectedPlan?.id === p.id ? '#f0f4ff' : '#fff',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                        {p.type} · ${parseFloat(p.total_cost).toFixed(2)}
                        {p.trip_limit ? ` · ${p.trip_limit} trips` : ' · Unlimited trips'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" disabled={!selectedPlan} onClick={() => setStep(3)}>Next →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {['cash', 'card'].map((m) => (
                  <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: payMethod === m ? 600 : 400 }}>
                    <input type="radio" value={m} checked={payMethod === m} onChange={() => setPayMethod(m)} />
                    {m === 'cash' ? '💵 Cash' : '💳 Card'}
                  </label>
                ))}
              </div>
            </div>
            <div className="card" style={{ background: '#f7f9ff', marginTop: 12 }}>
              <div><strong>Customer:</strong> {customer?.name}</div>
              <div><strong>Plan:</strong> {selectedPlan?.name} (${parseFloat(selectedPlan?.total_cost || 0).toFixed(2)})</div>
              <div><strong>Payment:</strong> {payMethod}</div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#888' }}>ID: {customer?.id}</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-success" onClick={handleSubscribe} disabled={loading}>
                {loading ? 'Saving...' : '✓ Create & Subscribe'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function statusBadge(status) {
  const map = { active: 'badge-success', expired: 'badge-danger', cancelled: 'badge-secondary' };
  return <span className={`badge ${map[status] || 'badge-secondary'}`}>{status || 'none'}</span>;
}

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/customers', { params: { search, page, limit: 25 } });
      setCustomers(data.customers);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const totalPages = Math.ceil(total / 25);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Customers ({total})</span>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Customer</button>
        </div>
        <div className="search-bar">
          <input
            className="form-control"
            placeholder="Search by name, phone, or ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        {loading ? (
          <div className="loading-overlay"><div className="spinner" /> Loading...</div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Expires</th>
                    <th>Trips Left</th>
                    <th>Payment</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.phone}</td>
                      <td>{c.plan_name || <span className="text-muted">—</span>}</td>
                      <td>{statusBadge(c.plan_status)}</td>
                      <td>{c.expiry_date ? c.expiry_date.slice(0, 10) : <span className="text-muted">—</span>}</td>
                      <td>{c.trips_remaining ?? <span className="text-muted">∞</span>}</td>
                      <td>
                        <span className={`badge ${c.payment_method === 'card' ? 'badge-info' : 'badge-secondary'}`}>
                          {c.payment_method}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={() => navigate(`/customers/${c.id}`)}>View</button>
                      </td>
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: '#888' }}>No customers found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
                <span style={{ fontSize: 13, color: '#888' }}>Page {page} of {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {showAdd && (
        <AddCustomerModal
          onClose={() => setShowAdd(false)}
          onSaved={(c) => {
            setShowAdd(false);
            navigate(`/customers/${c.id}`);
          }}
        />
      )}
    </div>
  );
}
