import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import api from '../api';

function TripReport() {
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState('');
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
    group_by: 'day',
  });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/trips').then((r) => setTrips(r.data));
  }, []);

  async function fetchReport() {
    if (!selectedTrip) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/reports/trips/${selectedTrip}`, { params: dateRange });
      setReport(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (selectedTrip) fetchReport(); }, [selectedTrip, dateRange]);

  async function exportCSV() {
    if (!selectedTrip) return;
    window.open(`/api/reports/export/trips/${selectedTrip}`, '_blank');
  }

  const chartData = report?.data?.map((d) => ({
    period: new Date(d.period).toLocaleDateString(),
    Allowed: parseInt(d.allowed),
    Denied: parseInt(d.denied),
    Total: parseInt(d.total_scans),
  })) || [];

  return (
    <div>
      <div className="search-bar" style={{ flexWrap: 'wrap' }}>
        <select className="form-control" value={selectedTrip} onChange={(e) => setSelectedTrip(e.target.value)}>
          <option value="">Select a trip...</option>
          {trips.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input className="form-control" type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} style={{ width: 150, flex: 'initial' }} />
        <input className="form-control" type="date" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} style={{ width: 150, flex: 'initial' }} />
        <select className="form-control" value={dateRange.group_by} onChange={(e) => setDateRange({ ...dateRange, group_by: e.target.value })} style={{ width: 130, flex: 'initial' }}>
          <option value="day">By Day</option>
          <option value="week">By Week</option>
          <option value="month">By Month</option>
        </select>
        {selectedTrip && <button className="btn btn-secondary" onClick={exportCSV}>Export CSV</button>}
      </div>

      {loading && <div className="loading-overlay"><div className="spinner" /> Loading...</div>}

      {report && !loading && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Ridership: {report.trip?.name}</span>
            <span className="text-muted">{chartData.reduce((s, d) => s + d.Total, 0)} total scans</span>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Allowed" fill="#38a169" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Denied" fill="#e53e3e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted">No data for this period.</p>
          )}
        </div>
      )}
    </div>
  );
}

function CustomerReport() {
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (customerSearch.length > 1) {
      api.get('/customers', { params: { search: customerSearch, limit: 8 } }).then((r) => setCustomers(r.data.customers));
    } else {
      setCustomers([]);
    }
  }, [customerSearch]);

  async function fetchReport(customerId) {
    setLoading(true);
    try {
      const { data } = await api.get(`/reports/customers/${customerId}`, { params: dateRange });
      setReport(data);
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    if (selectedCustomer) window.open(`/api/reports/export/customers/${selectedCustomer.id}`, '_blank');
  }

  return (
    <div>
      <div className="search-bar">
        <div style={{ position: 'relative', flex: 1 }}>
          <input className="form-control" placeholder="Search customer..." value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)} />
          {customers.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {customers.map((c) => (
                <div key={c.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                  onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setCustomers([]); fetchReport(c.id); }}>
                  <strong>{c.name}</strong> — {c.phone}
                </div>
              ))}
            </div>
          )}
        </div>
        <input className="form-control" type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} style={{ width: 150, flex: 'initial' }} />
        <input className="form-control" type="date" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} style={{ width: 150, flex: 'initial' }} />
        {selectedCustomer && (
          <>
            <button className="btn btn-outline" onClick={() => fetchReport(selectedCustomer.id)}>Refresh</button>
            <button className="btn btn-secondary" onClick={exportCSV}>Export CSV</button>
          </>
        )}
      </div>

      {loading && <div className="loading-overlay"><div className="spinner" /> Loading...</div>}

      {report && !loading && (
        <>
          <div className="card">
            <div className="card-header"><span className="card-title">{report.customer.name}</span></div>
            <div className="form-row-3">
              <div><div className="stat-label">Total Scans</div><div style={{ fontWeight: 700, fontSize: 22 }}>{report.scans.length}</div></div>
              <div><div className="stat-label">Allowed</div><div style={{ fontWeight: 700, fontSize: 22, color: '#38a169' }}>{report.scans.filter((s) => s.status === 'allowed').length}</div></div>
              <div><div className="stat-label">Denied</div><div style={{ fontWeight: 700, fontSize: 22, color: '#e53e3e' }}>{report.scans.filter((s) => s.status === 'denied').length}</div></div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Scan History</span></div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Date/Time</th><th>Trip</th><th>Status</th><th>Trips After</th></tr></thead>
                <tbody>
                  {report.scans.map((s) => (
                    <tr key={s.id}>
                      <td>{new Date(s.scanned_at).toLocaleString()}</td>
                      <td>{s.trip_name}</td>
                      <td><span className={`badge ${s.status === 'allowed' ? 'badge-success' : 'badge-danger'}`}>{s.status}</span></td>
                      <td>{s.trips_remaining_after_scan ?? '∞'}</td>
                    </tr>
                  ))}
                  {report.scans.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#888' }}>No scans in range</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Payment History</span></div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
                <tbody>
                  {report.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{new Date(p.created_at).toLocaleDateString()}</td>
                      <td>${parseFloat(p.amount).toFixed(2)}</td>
                      <td>{p.method}</td>
                      <td><span className={`badge ${p.status === 'completed' ? 'badge-success' : 'badge-secondary'}`}>{p.status}</span></td>
                    </tr>
                  ))}
                  {report.payments.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#888' }}>No payments</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Reports() {
  const [tab, setTab] = useState('trips');

  return (
    <div>
      <div className="tabs">
        <div className={`tab ${tab === 'trips' ? 'active' : ''}`} onClick={() => setTab('trips')}>Trip Ridership</div>
        <div className={`tab ${tab === 'customers' ? 'active' : ''}`} onClick={() => setTab('customers')}>Customer History</div>
      </div>
      {tab === 'trips' && <TripReport />}
      {tab === 'customers' && <CustomerReport />}
    </div>
  );
}
