import { useState, useEffect, useCallback } from 'react';
import api from '../api';

function ManualPaymentModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ customer_id: '', amount: '', method: 'cash', notes: '' });
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (customerSearch.length > 1) {
      api.get('/customers', { params: { search: customerSearch, limit: 10 } })
        .then((r) => setCustomers(r.data.customers));
    } else {
      setCustomers([]);
    }
  }, [customerSearch]);

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/payments', form);
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
        <div className="modal-title">Record Manual Payment</div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Search Customer</label>
            <input className="form-control" placeholder="Type name or phone..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
            {customers.length > 0 && (
              <div style={{ border: '1px solid #e0e0e0', borderRadius: 6, marginTop: 4 }}>
                {customers.map((c) => (
                  <div key={c.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                    onClick={() => { setForm({ ...form, customer_id: c.id }); setCustomerSearch(`${c.name} (${c.phone})`); setCustomers([]); }}>
                    <strong>{c.name}</strong> — {c.phone}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Amount ($) *</label>
              <input className="form-control" type="number" step="0.01" min="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="50.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Method</label>
              <select className="form-control" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-control" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={loading || !form.customer_id}>{loading ? 'Saving...' : 'Record Payment'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ from: '', to: '', method: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/payments', { params: { ...filters, page, limit: 25 } });
      setPayments(data.payments);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  async function handleRefund(payment) {
    if (!confirm(`Refund $${parseFloat(payment.amount).toFixed(2)} to ${payment.customer_name}?`)) return;
    try {
      await api.post(`/payments/${payment.id}/refund`);
      fetchPayments();
    } catch (err) {
      alert(err.response?.data?.error || 'Refund failed');
    }
  }

  const totalPages = Math.ceil(total / 25);

  const totalRevenue = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Showing ({total} total)</div>
          <div className="stat-value">{payments.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Revenue (this view)</div>
          <div className="stat-value">${totalRevenue.toFixed(2)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Payments</span>
          <button className="btn btn-primary" onClick={() => setShowManual(true)}>+ Record Cash Payment</button>
        </div>

        {/* Filters */}
        <div className="search-bar" style={{ flexWrap: 'wrap' }}>
          <input className="form-control" type="date" placeholder="From" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} style={{ flex: 'initial', width: 150 }} />
          <input className="form-control" type="date" placeholder="To" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} style={{ flex: 'initial', width: 150 }} />
          <select className="form-control" value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })} style={{ flex: 'initial', width: 130 }}>
            <option value="">All Methods</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
          <select className="form-control" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} style={{ flex: 'initial', width: 140 }}>
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <button className="btn btn-secondary" onClick={() => { setFilters({ from: '', to: '', method: '', status: '' }); setPage(1); }}>Clear</button>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="spinner" /> Loading...</div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Date</th><th>Customer</th><th>Amount</th><th>Method</th><th>Status</th><th>Notes</th><th></th></tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{new Date(p.created_at).toLocaleString()}</td>
                      <td>{p.customer_name || '—'}</td>
                      <td><strong>${parseFloat(p.amount).toFixed(2)}</strong></td>
                      <td><span className={`badge ${p.method === 'card' ? 'badge-info' : 'badge-secondary'}`}>{p.method}</span></td>
                      <td>
                        <span className={`badge ${p.status === 'completed' ? 'badge-success' : p.status === 'failed' ? 'badge-danger' : p.status === 'refunded' ? 'badge-warning' : 'badge-secondary'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="text-muted">{p.notes || '—'}</td>
                      <td>
                        {p.status === 'completed' && (
                          <button className="btn btn-sm btn-danger" onClick={() => handleRefund(p)}>Refund</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: '#888' }}>No payments found</td></tr>
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

      {showManual && <ManualPaymentModal onClose={() => setShowManual(false)} onSaved={() => { setShowManual(false); fetchPayments(); }} />}
    </div>
  );
}
