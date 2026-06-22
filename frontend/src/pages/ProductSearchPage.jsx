import React, { useState, useEffect } from "react";
import { Search, FileSpreadsheet, Loader2, Check } from "lucide-react";

// Định dạng tiền tệ
const fmtCurrency = (val, curr = "USD") => {
  if (val === undefined || val === null || val === "") return "-";
  const num = Number(val);
  if (isNaN(num)) return val;
  const currencyUpper = String(curr).trim().toUpperCase();
  if (currencyUpper === "VND") {
    return num.toLocaleString("vi-VN") + " ₫";
  }
  return num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 4 }) + " " + currencyUpper;
};

const S = {
  app: { display: "flex", minHeight: "100vh", background: "#FFF0F5", fontFamily: "'Nunito', 'Segoe UI', sans-serif" },
  main: { flex: 1, padding: "28px 32px", background: "#FFF0F5", overflowY: "auto", minWidth: 0 },
  card: { background: "#fff", borderRadius: 16, border: "1.5px solid #fce4ec", padding: "24px 28px", boxShadow: "0 10px 30px rgba(244,114,182,0.08)" },
  title: { margin: "0 0 8px 0", fontSize: 24, fontWeight: 800, color: "#1a1a2e", display: "flex", alignItems: "center", gap: 10 },
  subtitle: { margin: "0 0 24px 0", fontSize: 13, color: "#9e9e9e", fontWeight: 600 },
  
  // Form controls
  searchRow: { display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" },
  inputContainer: { display: "flex", flex: 1, minWidth: 280, height: 42, border: "1.5px solid #ffe0eb", borderRadius: 12, background: "white", padding: "0 14px", alignItems: "center", gap: 10, transition: "0.2s" },
  input: { border: "none", outline: "none", width: "100%", fontFamily: "inherit", fontSize: 14, color: "#333" },
  
  btnPrimary: { display: "flex", alignItems: "center", gap: 6, height: 42, padding: "0 22px", background: "linear-gradient(135deg, #FF6B9D, #FF8FA3)", border: "none", borderRadius: 12, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 12px rgba(255,107,157,0.3)" },
  btnOutline: { display: "flex", alignItems: "center", gap: 6, height: 42, padding: "0 18px", background: "#fff", border: "1.5px solid #43a047", borderRadius: 12, color: "#43a047", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" },
  
  // Sources filter
  sourcesRow: { display: "flex", gap: 20, alignItems: "center", marginBottom: 24, flexWrap: "wrap", background: "#fff8fa", padding: "10px 16px", borderRadius: 12, border: "1.5px solid #ffe0eb" },
  sourceLabel: { fontSize: 13, fontWeight: 700, color: "#e91e8c" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#555", cursor: "pointer" },
  checkbox: { width: 16, height: 16, accentColor: "#e91e8c", cursor: "pointer" },

  // Table
  tableWrapper: { overflowX: "auto", borderRadius: 16, border: "1.5px solid #ffe0eb", background: "white" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1400 },
  th: { padding: "12px 14px", textAlign: "center", fontWeight: 700, color: "#e91e8c", fontSize: 12, whiteSpace: "nowrap", background: "#FFF0F5", borderBottom: "2px solid #FFE0EB" },
  td: { padding: "12px 14px", textAlign: "center", color: "#444", borderBottom: "1px solid #FFF0F5", verticalAlign: "middle", fontSize: 12 },
  
  // Badges
  badge: (bg, color) => ({ background: bg, color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, display: "inline-block" })
};

export default function ProductSearchPage() {
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState({
    supplier: true,
    client: true,
    contract: true
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSourceChange = (key) => {
    setSources(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    const activeSources = Object.keys(sources).filter(k => sources[k]).join(",");
    if (!activeSources) {
      setError("Vui lòng chọn ít nhất một nguồn dữ liệu để tìm kiếm!");
      setResults([]);
      setLoading(false);
      return;
    }

    try {
      const url = `http://127.0.0.1:8000/invoices/products/search?q=${encodeURIComponent(query.trim())}&sources=${activeSources}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      } else {
        throw new Error("Lỗi khi tải kết quả tìm kiếm từ máy chủ.");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Đã xảy ra lỗi kết nối.");
    } finally {
      setLoading(false);
    }
  };

  // Quét động tất cả các cột dữ liệu tùy chỉnh & phụ trợ từ kết quả
  const getDynamicColumns = () => {
    const extraKeys = new Set();
    const customKeys = new Set();

    results.forEach(row => {
      // Quét extra_data
      if (row.extra_data) {
        Object.keys(row.extra_data).forEach(k => {
          if (row.extra_data[k] !== undefined && row.extra_data[k] !== null && row.extra_data[k] !== "") {
            extraKeys.add(k);
          }
        });
      }
      // Quét customFields
      if (row.customFields) {
        row.customFields.forEach(cf => {
          if (cf.key && cf.value !== undefined && cf.value !== null && cf.value !== "") {
            customKeys.add(cf.key);
          }
        });
      }
    });

    return {
      extraKeys: Array.from(extraKeys),
      customKeys: Array.from(customKeys)
    };
  };

  const { extraKeys, customKeys } = getDynamicColumns();

  // Xác định danh sách cột tiêu chuẩn để hiển thị
  const standardHeaders = [
    { key: "source", label: "Nguồn dữ liệu" },
    { key: "date", label: "Ngày" },
    { key: "code", label: "Mã Số" },
    { key: "partner", label: "Đối tác" },
    { key: "product_code", label: "Mã SP" },
    { key: "price", label: "Đơn Giá (Mua/Bán)" },
    { key: "qty", label: "Số lượng" },
    { key: "commission", label: "Hoa Hồng (%)" },
    { key: "margin", label: "Chiết khấu (%)" },
    { key: "profits", label: "Lợi Nhuận" },
    { key: "sc", label: "SC / Số SC" },
    { key: "payment", label: "Thanh Toán" },
    { key: "receiver", label: "Người Nhận" },
    { key: "note", label: "Ghi chú" }
  ];

  // Xuất file Excel với cấu trúc cột động gộp ô đầy đủ
  const handleExportExcel = async () => {
    if (results.length === 0) return;

    if (!window.XLSX) {
      setLoading(true);
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Không thể tải thư viện xuất Excel."));
          document.head.appendChild(script);
        });
      } catch (e) {
        alert(e.message);
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();

    // Dựng AoA (Array of Arrays) chứa dữ liệu xuất Excel
    const aoaData = [];
    aoaData.push(["KẾT QUẢ TRA CỨU SẢN PHẨM CHI TIẾT"]);
    aoaData.push([`Từ khóa tìm kiếm: "${query}" | Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}`]);
    aoaData.push([]); // Dòng trống

    // Xây dựng tiêu đề cột Excel
    const headers = [];
    standardHeaders.forEach(h => headers.push(h.label));
    extraKeys.forEach(k => headers.push(`Phụ trợ: ${k}`));
    customKeys.forEach(k => headers.push(`Tùy chỉnh: ${k}`));
    aoaData.push(headers);

    // Điền dữ liệu cho từng dòng kết quả
    results.forEach(row => {
      const rowData = [];

      // 1. Nguồn dữ liệu
      rowData.push(
        row.source === "supplier" 
          ? "Báo giá NCC" 
          : row.source === "client" 
            ? "Báo giá Khách" 
            : "Trong Hợp đồng"
      );

      // 2. Ngày
      rowData.push(row.date || "-");

      // 3. Mã Số
      rowData.push(
        row.source === "contract"
          ? `${row.code} (NCC: ${row.invoice_code_sup || "N/A"} - Khách: ${row.invoice_code_cli || "N/A"})`
          : row.code || "-"
      );

      // 4. Đối tác
      rowData.push(
        row.source === "contract"
          ? `NCC: ${row.partner_name_sup || "N/A"} | Khách: ${row.partner_name_cli || "N/A"}`
          : row.partner_name || "-"
      );

      // 5. Mã SP
      rowData.push(row.product_code || "-");

      // 6. Đơn giá
      rowData.push(
        row.source === "contract"
          ? `NCC: ${row.price_sup ?? "-"} | Khách: ${row.price_cli ?? "-"}`
          : row.base_price !== undefined ? row.base_price : "-"
      );

      // 7. Số lượng
      rowData.push(
        row.source === "contract"
          ? `NCC: ${row.qty_sup ?? "-"} | Khách: ${row.qty_cli ?? "-"}`
          : row.quantity !== undefined ? row.quantity : "-"
      );

      // 8-13. Các thông tin hợp đồng
      rowData.push(row.source === "contract" ? (row.commission ?? 0) : "-");
      rowData.push(row.source === "contract" ? (row.negotiation_margin ?? 0) : "-");
      rowData.push(row.source === "contract" ? (row.profits !== undefined ? `${row.profits} ${row.currency || "VND"}` : "-") : "-");
      rowData.push(row.source === "contract" ? (row.sc ? `Có (${row.sc_no || "N/A"})` : "Không") : "-");
      rowData.push(row.source === "contract" ? (row.payment_status || "-") : "-");
      rowData.push(row.source === "contract" ? (row.receiver || "-") : "-");

      // 14. Ghi chú
      rowData.push(row.note || "-");

      // 15. Dynamic extra_data columns
      extraKeys.forEach(key => {
        rowData.push(row.extra_data?.[key] ?? "-");
      });

      // 16. Dynamic customFields columns
      customKeys.forEach(key => {
        const cf = (row.customFields || []).find(f => f.key === key);
        rowData.push(cf ? String(cf.value) : "-");
      });

      aoaData.push(rowData);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoaData);
    XLSX.utils.book_append_sheet(wb, ws, "Sản Phẩm");
    XLSX.writeFile(wb, `Tracuu_Sanpham_${Date.now()}.xlsx`);
  };

  return (
    <div style={S.main}>
      <div>
          <h1 style={S.title}>🔍 Tra Cứu Sản Phẩm Liên Nguồn</h1>
          <p style={S.subtitle}>Tìm kiếm chi tiết thông tin sản phẩm và so sánh giá từ Báo giá NCC, Báo giá cho Khách và Hợp đồng đã lập.</p>
      </div>
      <div style={S.card}>
        

        {/* Form tìm kiếm */}
        <form onSubmit={handleSearch}>
          <div style={S.searchRow}>
            <div style={S.inputContainer}>
              <Search size={18} color="#f48fb1" />
              <input 
                type="text" 
                placeholder="Nhập mã sản phẩm cần tra cứu (ví dụ: SP01, Quality, ...)" 
                value={query} 
                onChange={(e) => setQuery(e.target.value)}
                style={S.input}
              />
            </div>
            
            <button type="submit" style={S.btnPrimary} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} /> : <Search size={16} />}
              Tìm kiếm
            </button>

            {results.length > 0 && (
              <button type="button" onClick={handleExportExcel} style={S.btnOutline}>
                <FileSpreadsheet size={16} /> Export Excel
              </button>
            )}
          </div>

          {/* Chọn nguồn lọc */}
          <div style={S.sourcesRow}>
            <span style={S.sourceLabel}>Nguồn tìm kiếm:</span>
            <label style={S.checkboxLabel}>
              <input 
                type="checkbox" 
                checked={sources.supplier} 
                onChange={() => handleSourceChange("supplier")}
                style={S.checkbox}
              />
              Báo giá Nhà cung cấp
            </label>
            <label style={S.checkboxLabel}>
              <input 
                type="checkbox" 
                checked={sources.client} 
                onChange={() => handleSourceChange("client")}
                style={S.checkbox}
              />
              Báo giá cho Khách
            </label>
            <label style={S.checkboxLabel}>
              <input 
                type="checkbox" 
                checked={sources.contract} 
                onChange={() => handleSourceChange("contract")}
                style={S.checkbox}
              />
              Hàng trong Hợp đồng
            </label>
          </div>
        </form>

        {error && (
          <div style={{ background: "#FFEBEE", color: "#C62828", padding: "12px 18px", borderRadius: 12, marginBottom: 20, fontSize: 13, fontWeight: 600, border: "1px solid #FFCDD2" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Bảng kết quả cột động */}
        <div style={S.tableWrapper}>
          <table style={S.table}>
            <thead>
              <tr>
                {standardHeaders.map(h => (
                  <th key={h.key} style={S.th}>{h.label}</th>
                ))}
                {extraKeys.map(k => (
                  <th key={`extra-${k}`} style={{ ...S.th, background: "#E8F5E9", color: "#2E7D32", borderBottom: "2px solid #C8E6C9" }}>
                    {k} (Phụ)
                  </th>
                ))}
                {customKeys.map(k => (
                  <th key={`custom-${k}`} style={{ ...S.th, background: "#E8EAF6", color: "#3F51B5", borderBottom: "2px solid #C5CAE9" }}>
                    {k} (Tùy biến)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={standardHeaders.length + extraKeys.length + customKeys.length} style={{ ...S.td, padding: "40px", color: "#e91e8c", fontWeight: 700 }}>
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
                      <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Đang truy vấn dữ liệu từ các nguồn...
                    </div>
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={standardHeaders.length + extraKeys.length + customKeys.length} style={{ ...S.td, padding: "40px 0", color: "#999", fontStyle: "italic" }}>
                    📭 Nhập mã sản phẩm và bấm Tìm kiếm để tra cứu thông tin giá cả.
                  </td>
                </tr>
              ) : (
                results.map((row, idx) => {
                  return (
                    <tr 
                      key={idx} 
                      style={{ background: idx % 2 !== 0 ? "#FFFAFC" : "white", transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.filter = "brightness(0.98)"}
                      onMouseLeave={e => e.currentTarget.style.filter = "none"}
                    >
                      {/* Nguồn */}
                      <td style={S.td}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          {row.source === "supplier" && (
                            <>
                              <span style={S.badge("#E3F2FD", "#1565C0")}>Báo giá NCC</span>
                              <div style={{ fontSize: 11, color: "#555", lineHeight: "1.3" }}>
                                <strong>{row.code}</strong>
                                {row.partner_name && <div style={{ color: "#777", fontSize: 10 }}>Từ: {row.partner_name}</div>}
                              </div>
                            </>
                          )}
                          {row.source === "client" && (
                            <>
                              <span style={S.badge("#F3E5F5", "#7B1FA2")}>Báo giá Khách</span>
                              <div style={{ fontSize: 11, color: "#555", lineHeight: "1.3" }}>
                                <strong>{row.code}</strong>
                                {row.partner_name && <div style={{ color: "#777", fontSize: 10 }}>Cho: {row.partner_name}</div>}
                              </div>
                            </>
                          )}
                          {row.source === "contract" && (
                            <>
                              <span style={S.badge("#E8F5E9", "#2E7D32")}>Hợp đồng chốt</span>
                              <div style={{ fontSize: 10, color: "#555", textAlign: "center", lineHeight: "1.3" }}>
                                <strong>HĐ: {row.code}</strong>
                                <div style={{ color: "#777", marginTop: 2, fontSize: 9 }}>
                                  NCC: {row.invoice_code_sup || "N/A"} ({row.partner_name_sup || "N/A"})<br/>
                                  Khách: {row.invoice_code_cli || "N/A"} ({row.partner_name_cli || "N/A"})
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Ngày */}
                      <td style={S.td}>{row.date ? new Date(row.date).toLocaleDateString("vi-VN") : "-"}</td>

                      {/* Mã Số */}
                      <td style={{ ...S.td, fontWeight: 700, color: "#e91e8c" }}>
                        {row.source === "contract" ? (
                          <div style={{ fontSize: 11 }}>
                            <strong>{row.code}</strong>
                            <div style={{ color: "#777", marginTop: 2 }}>
                              NCC: {row.invoice_code_sup || "N/A"}<br/>
                              Khách: {row.invoice_code_cli || "N/A"}
                            </div>
                          </div>
                        ) : row.code || "-"}
                      </td>

                      {/* Đối tác */}
                      <td style={S.td}>
                        {row.source === "contract" ? (
                          <div style={{ fontSize: 11, textAlign: "left" }}>
                            🏭 NCC: <strong>{row.partner_name_sup || "N/A"}</strong><br/>
                            👤 Khách: <strong>{row.partner_name_cli || "N/A"}</strong>
                          </div>
                        ) : row.partner_name || "-"}
                      </td>

                      {/* Mã SP */}
                      <td style={{ ...S.td, fontWeight: 700, color: "#333" }}>{row.product_code}</td>

                      {/* Đơn giá */}
                      <td style={S.td}>
                        {row.source === "contract" ? (
                          <div style={{ fontSize: 11 }}>
                            💸 Mua: {fmtCurrency(row.price_sup, row.currency)}<br/>
                            💰 Bán: {fmtCurrency(row.price_cli, row.currency)}
                          </div>
                        ) : fmtCurrency(row.base_price, row.currency)}
                      </td>

                      {/* Số lượng */}
                      <td style={S.td}>
                        {row.source === "contract" ? (
                          <div style={{ fontSize: 11 }}>
                            📦 Mua: {row.qty_sup !== null ? row.qty_sup.toLocaleString() : "-"}<br/>
                            📦 Bán: {row.qty_cli !== null ? row.qty_cli.toLocaleString() : "-"}
                          </div>
                        ) : row.quantity !== null ? row.quantity.toLocaleString() : "-"}
                      </td>

                      {/* Commission */}
                      <td style={S.td}>{row.source === "contract" ? `${row.commission ?? 0}%` : "-"}</td>

                      {/* Chiết khấu */}
                      <td style={S.td}>{row.source === "contract" ? `${row.negotiation_margin ?? 0}%` : "-"}</td>

                      {/* Lợi Nhuận */}
                      <td style={{ ...S.td, fontWeight: 700, color: "#2E7D32" }}>
                        {row.source === "contract" ? fmtCurrency(row.profits, row.currency) : "-"}
                      </td>

                      {/* SC */}
                      <td style={S.td}>
                        {row.source === "contract" ? (
                          row.sc ? (
                            <span style={S.badge("#E8F5E9", "#2E7D32")}>Có ({row.sc_no || "N/A"})</span>
                          ) : (
                            <span style={S.badge("#FFEBEE", "#C62828")}>Không</span>
                          )
                        ) : "-"}
                      </td>

                      {/* Trạng thái thanh toán */}
                      <td style={S.td}>
                        {row.source === "contract" ? (
                          <span style={S.badge(
                            row.payment_status === "paid" ? "#E8F5E9" : row.payment_status === "paid 50%" ? "#FFF8E1" : "#FFEBEE",
                            row.payment_status === "paid" ? "#2E7D32" : row.payment_status === "paid 50%" ? "#F57C00" : "#C62828"
                          )}>
                            {row.payment_status === "paid" ? "Đã trả" : row.payment_status === "paid 50%" ? "Trả 50%" : "Chưa trả"}
                          </span>
                        ) : "-"}
                      </td>

                      {/* Người nhận */}
                      <td style={S.td}>{row.source === "contract" ? (row.receiver || "-") : "-"}</td>

                      {/* Ghi chú */}
                      <td style={{ ...S.td, fontStyle: "italic", color: "#666", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.note}>{row.note || "-"}</td>

                      {/* Các cột extra_data động */}
                      {extraKeys.map(key => (
                        <td key={`extra-${key}`} style={S.td}>
                          {row.extra_data?.[key] !== undefined && row.extra_data?.[key] !== null && row.extra_data?.[key] !== ""
                            ? String(row.extra_data[key])
                            : "-"}
                        </td>
                      ))}

                      {/* Các cột customFields động */}
                      {customKeys.map(key => {
                        const cf = (row.customFields || []).find(f => f.key === key);
                        return (
                          <td key={`custom-${key}`} style={S.td}>
                            {cf ? (cf.value === true ? "Có" : cf.value === false ? "Không" : String(cf.value)) : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        <style>{`
          @keyframes spin {
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
