import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  Home, BarChart2, FileText, Clock, Settings,
  Heart, ShoppingBag, Users, Eye, Bell, ChevronDown,
  Calendar, MoreHorizontal, Globe, Info
} from "lucide-react";

// ── Data ──────────────────────────────────────────────────────────────────────
const revenueData = [
  { date: "12/05", value: 11 },
  { date: "13/05", value: 15 },
  { date: "14/05", value: 18 },
  { date: "15/05", value: 22 },
  { date: "16/05", value: 28.5 },
  { date: "17/05", value: 21 },
  { date: "18/05", value: 25 },
];

const channelData = [
  { name: "Website",    value: 45, color: "#F472B6" },
  { name: "Shopee",     value: 25, color: "#FCA5A5" },
  { name: "Lazada",     value: 20, color: "#C4B5FD" },
  { name: "TikTok Shop",value: 10, color: "#FDE68A" },
];

const tableData = [
  { channel: "Website",     icon: "🌐", revenue: "56.250.000 đ", orders: 562, customers: 420, cvr: "2.35%" },
  { channel: "Shopee",      icon: "🛍️", revenue: "31.250.000 đ", orders: 312, customers: 230, cvr: "2.18%" },
  { channel: "Lazada",      icon: "💜", revenue: "25.000.000 đ", orders: 230, customers: 180, cvr: "1.95%" },
  { channel: "TikTok Shop", icon: "⚫", revenue: "13.100.000 đ", orders: 136, customers: 98,  cvr: "1.68%" },
];

// ── Sub-components ─────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, iconBg, label, value, change }) => (
  <div style={{
    background: "#fff",
    borderRadius: 20,
    padding: "20px 24px",
    flex: 1,
    minWidth: 0,
    boxShadow: "0 2px 16px rgba(244,114,182,0.08)",
    border: "1.5px solid #fce7f3",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: iconBg,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={20} color="#F472B6" />
      </div>
      <span style={{ color: "#9ca3af", fontSize: 14, fontWeight: 500 }}>{label}</span>
    </div>
    <div style={{ fontSize: 32, fontWeight: 800, color: "#1f2937", letterSpacing: -1 }}>{value}</div>
    <div style={{ fontSize: 13, color: "#34d399", fontWeight: 600 }}>↑ {change} so với tuần trước</div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "#fff", borderRadius: 12, padding: "8px 14px",
        boxShadow: "0 4px 20px rgba(244,114,182,0.18)",
        border: "1px solid #fce7f3", fontSize: 13,
      }}>
        <div style={{ color: "#9ca3af", marginBottom: 2 }}>{label}</div>
        <div style={{ color: "#F472B6", fontWeight: 700 }}>{payload[0].value}M</div>
      </div>
    );
  }
  return null;
};

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {


  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #f5f3ff 100%)",
      fontFamily: "'Nunito', 'Segoe UI', sans-serif",
    }}>



      {/* ── Main Content ── */}
      <main style={{ flex: 1, padding: "32px 36px", overflowY: "auto", minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1f2937", margin: 0 }}>
              Xin chào, Cindy! 👋
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 14, margin: "6px 0 0" }}>
              Đây là tổng quan dữ liệu của bạn hôm nay.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#fff", borderRadius: 12, padding: "10px 16px",
              boxShadow: "0 2px 12px rgba(244,114,182,0.1)",
              border: "1.5px solid #fce7f3", fontSize: 13, color: "#6b7280",
              cursor: "pointer",
            }}>
              <Calendar size={15} color="#F472B6" />
              12/05/2024 - 18/05/2024
              <ChevronDown size={14} color="#9ca3af" />
            </div>
            <div style={{ position: "relative" }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 12px rgba(244,114,182,0.1)", border: "1.5px solid #fce7f3",
                cursor: "pointer",
              }}>
                <Bell size={18} color="#9ca3af" />
              </div>
              <div style={{
                position: "absolute", top: 6, right: 6,
                width: 16, height: 16, borderRadius: "50%",
                background: "#F472B6", color: "#fff",
                fontSize: 9, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>3</div>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
          <StatCard icon={Heart}      iconBg="#fce7f3" label="Tổng doanh thu" value="125.6M"  change="12.5%" />
          <StatCard icon={ShoppingBag}iconBg="#fce7f3" label="Đơn hàng"       value="1,240"   change="8.3%"  />
          <StatCard icon={Users}      iconBg="#f0fdf4" label="Khách hàng"     value="860"     change="5.6%"  />
          <StatCard icon={Eye}        iconBg="#eff6ff" label="Lượt xem"       value="25,680"  change="15.2%" />
        </div>

        {/* Charts Row */}
        <div style={{ display: "flex", gap: 20, marginBottom: 28 }}>

          {/* Pie Chart */}
          <div style={{
            background: "#fff", borderRadius: 20, padding: "24px 28px",
            boxShadow: "0 2px 16px rgba(244,114,182,0.08)",
            border: "1.5px solid #fce7f3", flex: "0 0 380px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>Tỷ lệ kênh bán hàng</span>
                <Info size={14} color="#d1d5db" />
              </div>
              <MoreHorizontal size={18} color="#d1d5db" style={{ cursor: "pointer" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div style={{ position: "relative", width: 180, height: 180 }}>
                <PieChart width={180} height={180}>
                  <Pie
                    data={channelData} cx={90} cy={90}
                    innerRadius={52} outerRadius={85}
                    dataKey="value" startAngle={90} endAngle={-270}
                    strokeWidth={3} stroke="#fff"
                  >
                    {channelData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
                <div style={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: "translate(-50%,-50%)",
                  fontSize: 28, lineHeight: 1,
                }}>🐰</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {channelData.map((item) => (
                  <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: item.color, flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 13, color: "#6b7280", minWidth: 80 }}>{item.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Line/Area Chart */}
          <div style={{
            background: "#fff", borderRadius: 20, padding: "24px 28px",
            boxShadow: "0 2px 16px rgba(244,114,182,0.08)",
            border: "1.5px solid #fce7f3", flex: 1, minWidth: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>Doanh thu theo ngày</span>
                <Info size={14} color="#d1d5db" />
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#fdf2f8", borderRadius: 10, padding: "6px 12px",
                fontSize: 13, color: "#6b7280", cursor: "pointer",
              }}>
                7 ngày qua <ChevronDown size={13} color="#9ca3af" />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="pinkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F472B6" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#F472B6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={v => `${v}M`}
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  axisLine={false} tickLine={false}
                  domain={[0, 40]} ticks={[0, 10, 20, 30, 40]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone" dataKey="value"
                  stroke="#F472B6" strokeWidth={2.5}
                  fill="url(#pinkGrad)"
                  dot={{ fill: "#fff", stroke: "#F472B6", strokeWidth: 2, r: 4 }}
                  activeDot={{ fill: "#F472B6", r: 6, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detail Table */}
        <div style={{
          background: "#fff", borderRadius: 20, padding: "24px 28px",
          boxShadow: "0 2px 16px rgba(244,114,182,0.08)",
          border: "1.5px solid #fce7f3",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>Bảng thống kê chi tiết</span>
            <MoreHorizontal size={18} color="#d1d5db" style={{ cursor: "pointer" }} />
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1.5px solid #fce7f3" }}>
                {["Kênh bán hàng", "Doanh thu", "Đơn hàng", "Khách hàng", "Tỷ lệ chuyển đổi"].map(col => (
                  <th key={col} style={{
                    padding: "10px 16px", textAlign: "left",
                    fontSize: 13, fontWeight: 700, color: "#F472B6",
                    whiteSpace: "nowrap",
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, i) => (
                <tr
                  key={row.channel}
                  style={{
                    borderBottom: i < tableData.length - 1 ? "1px solid #fdf2f8" : "none",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#fdf2f8"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "16px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 22 }}>{row.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{row.channel}</span>
                  </td>
                  <td style={{ padding: "16px", fontSize: 14, color: "#374151" }}>{row.revenue}</td>
                  <td style={{ padding: "16px", fontSize: 14, color: "#374151" }}>{row.orders}</td>
                  <td style={{ padding: "16px", fontSize: 14, color: "#374151" }}>{row.customers}</td>
                  <td style={{ padding: "16px", fontSize: 14, color: "#374151" }}>{row.cvr}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "1.5px solid #fce7f3", background: "#fdf2f8" }}>
                <td style={{ padding: "16px", fontSize: 14, fontWeight: 800, color: "#F472B6" }}>
                  Tổng cộng 🩷
                </td>
                <td style={{ padding: "16px", fontSize: 14, fontWeight: 800, color: "#F472B6" }}>125.600.000 đ</td>
                <td style={{ padding: "16px", fontSize: 14, fontWeight: 800, color: "#F472B6" }}>1.240</td>
                <td style={{ padding: "16px", fontSize: 14, fontWeight: 800, color: "#F472B6" }}>928</td>
                <td style={{ padding: "16px", fontSize: 14, fontWeight: 800, color: "#F472B6" }}>2.07%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#d1d5db" }}>
          🌸 Dữ liệu được cập nhật lúc 10:30 AM - 18/05/2024 🩷
        </div>
      </main>
    </div>
  );
}
