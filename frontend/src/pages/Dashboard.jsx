import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';

function fmt(n) {
  return parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/summary').then((r) => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-overlay"><div className="spinner" /> Loading dashboard...</div>;
  if (!data) return <div className="alert alert-error">Failed to load dashboard</div>;

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Active Subscribers</div>
          <div className="stat-value">{data.active_customers}</div>
          <div className="stat-sub">current active plans</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Monthly Revenue</div>
          <div className="stat-value">${fmt(data.revenue?.total_revenue)}</div>
          <div className="stat-sub">
            Cash: ${fmt(data.revenue?.cash_revenue)} · Card: ${fmt(data.revenue?.card_revenue)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Expiring Soon</div>
          <div className="stat-value" style={{ color: data.expiring_plans?.length > 0 ? '#e53e3e' : undefined }}>
            {data.expiring_plans?.length || 0}
          </div>
          <div className="stat-sub">within next 7 days</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Top Trips (30d)</div>
          <div className="stat-value">{data.busy_trips?.[0]?.scan_count || 0}</div>
          <div className="stat-sub">{data.busy_trips?.[0]?.name || '—'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Popular Plans */}
        <div className="card">
          <div className="card-header"><span className="card-title">Popular Plans</span></div>
          {data.popular_plans?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.popular_plans}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="subscriber_count" fill="#6c8fff" name="Subscribers" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted">No plan data yet.</p>
          )}
        </div>

        {/* Busiest Trips */}
        <div className="card">
          <div className="card-header"><span className="card-title">Busiest Trips (30 days)</span></div>
          {data.busy_trips?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.busy_trips}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="scan_count" fill="#38a169" name="Scans" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted">No scan data yet.</p>
          )}
        </div>
      </div>

      {/* Expiring Plans */}
      {data.expiring_plans?.length > 0 && (
        <div className="card mt-3">
          <div className="card-header">
            <span className="card-title">⚠️ Expiring Plans</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Plan</th>
                  <th>Expires</th>
                  <th>Trips Left</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.expiring_plans.map((p) => (
                  <tr key={p.id}>
                    <td>{p.customer_name}</td>
                    <td>{p.customer_phone}</td>
                    <td>{p.plan_name}</td>
                    <td>
                      <span className="badge badge-warning">{p.expiry_date?.slice(0, 10)}</span>
                    </td>
                    <td>{p.trips_remaining ?? '∞'}</td>
                    <td>
                      <button className="btn btn-sm btn-primary" onClick={() => navigate(`/customers/${p.customer_id}`)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
