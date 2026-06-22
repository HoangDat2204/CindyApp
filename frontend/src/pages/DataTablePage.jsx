import React, { useState, useEffect, ReactNode } from "react";
import {
  LayoutGrid, BarChart2, FileText, Clock, Settings,
  Sparkles, Filter, RefreshCw, FileSpreadsheet,
  ChevronDown, ChevronLeft, ChevronRight,
  ArrowUpDown, Bell, Search, MoreHorizontal,
  Edit, Trash2, FileCheck, Truck, Users, X, Plus
} from "lucide-react";

// ── Constants & Helpers ──────────────────────────────────────────────────────
const CURRENCY_CONFIG = {
  VND: { locale: "vi-VN", symbol: "đ", symbolBefore: false, decimals: 0 },
  USD: { locale: "en-US", symbol: "$", symbolBefore: true, decimals: 2 },
  EUR: { locale: "de-DE", symbol: "€", symbolBefore: false, decimals: 2 },
  JPY: { locale: "ja-JP", symbol: "¥", symbolBefore: true, decimals: 0 },
  CNY: { locale: "zh-CN", symbol: "¥", symbolBefore: true, decimals: 2 },
};

function CustomNotificationModal({ config, onClose }) {
  if (!config) return null;
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.35)",
      backdropFilter: "blur(3px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999
    }} onClick={config.showCancel ? undefined : onClose}>
      <div style={{
        background: "white",
        borderRadius: 18,
        padding: "26px 28px",
        width: 400,
        textAlign: "center",
        border: "1.5px solid #FFE0EB",
        boxShadow: "0 20px 60px rgba(255,107,157,0.2)"
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          {/* SVG Bunny */}
          <svg width="60" height="60" viewBox="0 0 80 80" fill="none">
            <ellipse cx="40" cy="50" rx="22" ry="20" fill="#FFB6C1" />
            <ellipse cx="40" cy="48" rx="18" ry="16" fill="#FFC0CB" />
            <ellipse cx="28" cy="22" rx="7" ry="14" fill="#FFB6C1" />
            <ellipse cx="52" cy="22" rx="7" ry="14" fill="#FFB6C1" />
            <ellipse cx="28" cy="22" rx="4" ry="10" fill="#FF8FA3" />
            <ellipse cx="52" cy="22" rx="4" ry="10" fill="#FF8FA3" />
            <circle cx="40" cy="46" r="14" fill="#FFE4E8" />
            <ellipse cx="34" cy="43" rx="3" ry="3.5" fill="#1a1a2e" />
            <ellipse cx="46" cy="43" rx="3" ry="3.5" fill="#1a1a2e" />
            <circle cx="35" cy="42" r="1" fill="white" />
            <circle cx="47" cy="42" r="1" fill="white" />
            <ellipse cx="40" cy="49" rx="3" ry="2" fill="#FF8FA3" />
            <path d="M37 51 Q40 53 43 51" stroke="#FF8FA3" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            <circle cx="33" cy="47" r="2.5" fill="#FFB3C6" opacity="0.7" />
            <circle cx="47" cy="47" r="2.5" fill="#FFB3C6" opacity="0.7" />
          </svg>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#e91e8c" }}>{config.title || "Thông báo 🌸"}</h3>
          <p style={{ fontSize: 13, color: "#555", margin: "8px 0 16px", lineHeight: "1.5", whiteSpace: "pre-line" }}>{config.message}</p>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          {config.showCancel && (
            <button 
              onClick={() => {
                if (config.onCancel) config.onCancel();
                onClose();
              }} 
              style={{
                background: "none",
                color: "#FF8FA3",
                border: "1.5px solid #FFD6E0",
                borderRadius: 10,
                padding: "10px 20px",
                fontSize: 13,
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              Hủy
            </button>
          )}
          <button 
            onClick={() => {
              if (config.onConfirm) config.onConfirm();
              onClose();
            }} 
            style={{
              background: "linear-gradient(135deg, #FF6B9D, #FF8FA3)",
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "10px 22px",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(255,107,157,0.3)"
            }}
          >
            Đồng ý
          </button>
        </div>
      </div>
    </div>
  );
}

const getSafeSheetName = (code) => {
  if (!code) return "Sheet";
  return code.toString().replace(/[:\\/?*\[\]]/g, "_").substring(0, 31);
};

const fmtCurrency = (n, currency = "USD") => {
  if (n === null || n === undefined) return "0";
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.USD;
  const formatted = Number(n).toLocaleString(cfg.locale, {
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals,
  });
  return cfg.symbolBefore ? `${cfg.symbol}${formatted}` : `${formatted} ${cfg.symbol}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const statusColor = (s) => ({
  verified: { bg: "#E8F5E9", color: "#388E3C" },
  pending:  { bg: "#FFF8E1", color: "#F57C00" },
  rejected: { bg: "#FFEBEE", color: "#C62828" },
  draft:    { bg: "#F3E5F5", color: "#7B1FA2" },
}[s?.toLowerCase()] || { bg: "#F5F5F5", color: "#888" });

// Hàm tính Tổng tiền SP
const calcTotalItemsAmount = (items) => {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((sum, it) => {
    const price = Number(it.base_price) || 0;
    const qty = Number(it.quantity) || 0;
    return sum + (price * qty);
  }, 0);
};

// Trích xuất các key độc nhất của extra_data sản phẩm
const getExtraDataKeys = (items) => {
  if (!items || !Array.isArray(items)) return [];
  const keysSet = new Set();
  items.forEach((item) => {
    if (item.extra_data && typeof item.extra_data === "object") {
      Object.keys(item.extra_data).forEach((k) => {
        if (item.extra_data[k] !== undefined && item.extra_data[k] !== null) {
          keysSet.add(k);
        }
      });
    }
  });
  return Array.from(keysSet);
};

// Thu gọn key dài
const getShortKey = (key) => {
  if (!key) return "";
  const parts = key.split(" - ");
  return parts[parts.length - 1] || key;
};

const getLabel = (key) => {
  const labels = {
    date: "Ngày PI / Quotation",
    code: "Mã HĐ / Quotation",
    supplier: "ID Đối tác",
    customer: "Tên đối tác",
    totalCIF: "Tổng CIF",
    currency: "Tiền tệ",
    paymentMethod: "Thanh toán",
    status: "Trạng thái",
    note: "Ghi chú",
    product_code: "Mã SP",
    base_price: "Đơn giá",
    quantity: "Số lượng (SL)",
  };
  return labels[key] || getShortKey(key) || key;
};

// Trích xuất các key độc nhất của customFields sản phẩm
const getCustomFieldKeys = (items) => {
  if (!items || !Array.isArray(items)) return [];
  const keysSet = new Set();
  items.forEach((item) => {
    if (item.customFields && Array.isArray(item.customFields)) {
      item.customFields.forEach((cf) => {
        if (cf.key !== undefined && cf.key !== null && cf.key !== "") {
          keysSet.add(cf.key);
        }
      });
    }
  });
  return Array.from(keysSet);
};

// Biên dịch công thức Excel tự động nếu bắt đầu bằng dấu "="
const evaluateFormula = (formulaStr, context) => {
  if (!formulaStr || typeof formulaStr !== "string" || !formulaStr.startsWith("=")) return formulaStr;
  let expression = formulaStr.substring(1);
  const regex = /\{([^}]+)\}/g;
  expression = expression.replace(regex, (match, key) => {
    let val = undefined;
    if (context[key] !== undefined) {
      val = context[key];
    } else if (context.extra_data && context.extra_data[key] !== undefined) {
      val = context.extra_data[key];
    } else if (context.customFields) {
      const cf = context.customFields.find((f) => f.key === key);
      if (cf) val = cf.value;
    }
    if (val === undefined || val === null || val === "") return "0";
    if (typeof val === "string") {
      const stripped = val.replace(/,/g, "");
      if (!isNaN(Number(stripped)) && stripped.trim() !== "") {
        return stripped;
      }
      return JSON.stringify(val);
    }
    return val;
  });
  try {
    const ifElseRegex = /\bif\s*\((.*?)\)\s*(.*?)\s*else\s*(.*)/i;
    if (ifElseRegex.test(expression)) {
      expression = expression.replace(ifElseRegex, "($1) ? ($2) : ($3)");
    }
    const result = new Function(`return (${expression})`)();
    return result !== undefined && result !== null ? result : "";
  } catch (e) {
    return "#VALUE!";
  }
};

const getDisplayValue = (val, context) => {
  if (typeof val === "string" && val.startsWith("=")) {
    return evaluateFormula(val, context);
  }
  return val;
};

const TABS = [
  { id: "contract", label: "Hợp đồng", icon: FileCheck },
  { id: "supplier", label: "Báo giá Nhà cung cấp", icon: Truck },
  { id: "client", label: "Báo giá Khách Hàng", icon: Users },
];

const generatePagination = (current, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, "...", totalPages];
  if (current >= totalPages - 2) return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "...", current - 1, current, current + 1, "...", totalPages];
};

// ── Styles (JS objects) ───────────────────────────────────────────────────────
const S = {
  app: { display: "flex", minHeight: "100vh", background: "linear-gradient(135deg, #fff5f8 0%, #fce4ec 60%, #f8f0ff 100%)", fontFamily: "'Nunito', 'Segoe UI', sans-serif" },
  main: { flex: 1, padding: "28px 32px", overflowY: "auto", minWidth: 0 },
  card: { background: "#fff", borderRadius: 16, border: "1.5px solid #fce4ec", padding: "16px 18px" },
  btnOutline: { display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", background: "#fff", border: "1.5px solid #f48fb1", borderRadius: 10, color: "#f06292", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  btnPrimary: { display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 16px", background: "linear-gradient(135deg, #FF6B9D, #FF8FA3)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 12px rgba(255,107,157,0.3)" },
  
  // Table
  th: { padding: "10px 10px", textAlign: "center", fontWeight: 700, color: "#e91e8c", fontSize: 12, whiteSpace: "nowrap", background: "#FFF0F5", borderBottom: "2px solid #FFE0EB", minWidth:"80px" },
  td: { padding: "10px 10px", textAlign: "center", color: "#444", borderBottom: "1px solid #FFF0F5", verticalAlign: "middle", fontSize: 12 },
  btnDetail: { background: "#EDE7FF", color: "#7B61FF", border: "1px solid #D1C4E9", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" },
  
  tabBox: { display: "flex", gap: 10, marginBottom: 20, background: "white", padding: 6, borderRadius: 12, width: "fit-content", border: "1px solid #FFE0EB" },
  tabBtn: (active) => ({ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, transition: "0.2s", background: active ? "linear-gradient(135deg, #FF6B9D, #FF8FA3)" : "transparent", color: active ? "white" : "#888", boxShadow: active ? "0 4px 10px rgba(255,107,157,0.3)" : "none" }),

  // Modal Styles
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalBox: { background: "white", borderRadius: 18, padding: "24px 28px", width: "min(96vw, 1150px)", maxHeight: "90vh", overflowY: "auto", border: "1px solid #FFE0EB", boxShadow: "0 20px 60px rgba(255,107,157,0.2)" },
  modalClose: { background: "#FFF0F5", border: "1px solid #FFD6E0", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 14, color: "#e91e8c", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
};

// ── Sub-components ────────────────────────────────────────────────────────────
function PageBtn({ page, active, onClick }) {
  if (page === "...") return <span style={{ color: "#bdbdbd", padding: "0 4px", fontSize: 13 }}>...</span>;
  return (
    <button onClick={onClick} style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${active ? "#e91e8c" : "#fce4ec"}`, background: active ? "#e91e8c" : "#fff", color: active ? "#fff" : "#757575", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", transition: "all 0.15s" }}>
      {page}
    </button>
  );
}

function Chip({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: "8px 14px", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 11, color: "#757575", marginBottom: 2, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// ─── Component Modal Chi Tiết Hợp Đồng (Chi tiết so sánh 2 hóa đơn) ─────────
function ContractDetailModal({ record, onClose, onSaveSuccess }) {
  if (!record) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsEditing(false);
    setEditForm(null);
  }, [record]);

  const paymentStatusColor = (s) => {
    if (s === "paid") return { bg: "#E8F5E9", color: "#388E3C", label: "Đã thanh toán" };
    if (s === "paid 50%") return { bg: "#FFF8E1", color: "#F57C00", label: "Thanh toán 50%" };
    return { bg: "#FFEBEE", color: "#C62828", label: "Chưa thanh toán" };
  };

  const pColorSupplier = paymentStatusColor(record.payment_status_supplier || "not yet paid");
  const pColorCustomer = paymentStatusColor(record.payment_status_customer || "not yet paid");

  const startEditing = () => {
    setEditForm(JSON.parse(JSON.stringify(record)));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm(null);
  };

  const handleHeaderChange = (field, val) => {
    setEditForm({ ...editForm, [field]: val });
  };

  const handleAddCustomField = () => {
    const existing = editForm.customFields || [];
    setEditForm({ ...editForm, customFields: [...existing, { key: "", type: "text", value: "" }] });
  };

  const handleRemoveCustomField = (index) => {
    const updated = (editForm.customFields || []).filter((_, i) => i !== index);
    setEditForm({ ...editForm, customFields: updated });
  };

  const handleCustomFieldChange = (index, field, val) => {
    const updated = [...(editForm.customFields || [])];
    updated[index] = { ...updated[index], [field]: val };
    setEditForm({ ...editForm, customFields: updated });
  };

  const handleSave = async () => {
    if (!editForm.contract_code || !editForm.contract_code.trim()) {
      alert("Vui lòng nhập Mã Hợp Đồng!");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/contracts/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_code: editForm.contract_code,
          date: editForm.date || null,
          commission: Number(editForm.commission) || 0.0,
          nego_margin: Number(editForm.nego_margin) || 0.0,
          supplier_discount: Number(editForm.supplier_discount) || 0.0,
          customer_discount: Number(editForm.customer_discount) || 0.0,
          na_col: Number(editForm.na_col) || 0.0,
          profits: editForm.profits !== "" && editForm.profits !== null ? Number(editForm.profits) : null,
          receiver: editForm.receiver || null,
          status: editForm.status || null,
          payment_status_supplier: editForm.payment_status_supplier,
          payment_status_customer: editForm.payment_status_customer,
          note: editForm.note || null,
          customFields: (editForm.customFields || []).filter(f => f.key.trim() !== "").map(f => ({
            key: f.key,
            type: f.type,
            value: f.type === "number" ? Number(f.value) : f.type === "boolean" ? (f.value === "true" || f.value === true) : f.value
          }))
        })
      });

      if (response.ok) {
        alert("✅ Cập nhật hợp đồng thành công!");
        setIsEditing(false);
        if (onSaveSuccess) onSaveSuccess();
        onClose();
      } else {
        const err = await response.json().catch(() => ({}));
        alert(`❌ Cập nhật thất bại! Lý do: ${err.detail || "Lỗi không xác định."}`);
      }
    } catch (e) {
      console.error(e);
      alert("🔌 Lỗi kết nối đến server!");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={{ ...S.modalBox, width: "min(96vw, 950px)" }} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1a1a2e" }}>
              {isEditing ? "Chỉnh sửa Hợp đồng" : "Hợp đồng"}: <span style={{ color: "#e91e8c" }}>{record.contract_code}</span>
            </h2>
            {!isEditing && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, fontSize: 12 }}>
                <span style={{ background: "#F5F5F5", padding: "3px 10px", borderRadius: 6, color: "#555", fontWeight: 600 }}>📅 Ngày chốt: {formatDate(record.date)}</span>
                <span style={{ background: pColorSupplier.bg, color: pColorSupplier.color, padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>Thanh toán NCC: {pColorSupplier.label}</span>
                <span style={{ background: pColorCustomer.bg, color: pColorCustomer.color, padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>Thanh toán Khách: {pColorCustomer.label}</span>
                <span style={{ background: "#EDE7FF", color: "#7B61FF", padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>Trạng thái: {record.status || "N/A"}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={S.modalClose}><X size={16}/></button>
        </div>

        {isEditing ? (
          <div>
            {/* Form chỉnh sửa */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 16 }}>
              {/* Cột Trái */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>Mã Hợp Đồng *</label>
                  <input 
                    type="text"
                    value={editForm.contract_code}
                    onChange={(e) => handleHeaderChange("contract_code", e.target.value)}
                    required
                    style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>Ngày chốt hợp đồng *</label>
                  <input 
                    type="date"
                    value={editForm.date || ""}
                    onChange={(e) => handleHeaderChange("date", e.target.value)}
                    required
                    style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>Người nhận bảng chào</label>
                  <input 
                    type="text"
                    value={editForm.receiver || ""}
                    onChange={(e) => handleHeaderChange("receiver", e.target.value)}
                    style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>Trạng thái hợp đồng</label>
                  <input 
                    type="text"
                    value={editForm.status || ""}
                    onChange={(e) => handleHeaderChange("status", e.target.value)}
                    style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>Thanh toán Supplier</label>
                    <select
                      value={editForm.payment_status_supplier || "not yet paid"}
                      onChange={(e) => handleHeaderChange("payment_status_supplier", e.target.value)}
                      style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box", background: "white", fontSize: 11 }}
                    >
                      <option value="not yet paid">Chưa thanh toán</option>
                      <option value="paid 50%">Thanh toán 50%</option>
                      <option value="paid">Đã thanh toán</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>Khách hàng thanh toán</label>
                    <select
                      value={editForm.payment_status_customer || "not yet paid"}
                      onChange={(e) => handleHeaderChange("payment_status_customer", e.target.value)}
                      style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box", background: "white", fontSize: 11 }}
                    >
                      <option value="not yet paid">Chưa thanh toán</option>
                      <option value="paid 50%">Thanh toán 50%</option>
                      <option value="paid">Đã thanh toán</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Cột Phải */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>Commission (%)</label>
                    <input 
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={editForm.commission ?? 0}
                      onChange={(e) => handleHeaderChange("commission", e.target.value)}
                      style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>Nego margin (%)</label>
                    <input 
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={editForm.nego_margin ?? 0}
                      onChange={(e) => handleHeaderChange("nego_margin", e.target.value)}
                      style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>Supplier discount</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={editForm.supplier_discount ?? 0}
                      onChange={(e) => handleHeaderChange("supplier_discount", e.target.value)}
                      style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>Customer discount</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={editForm.customer_discount ?? 0}
                      onChange={(e) => handleHeaderChange("customer_discount", e.target.value)}
                      style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>Lợi nhuận thực tế</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={editForm.profits ?? ""}
                      onChange={(e) => handleHeaderChange("profits", e.target.value)}
                      style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>NA</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={editForm.na_col ?? 0}
                      onChange={(e) => handleHeaderChange("na_col", e.target.value)}
                      style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>Ghi chú hợp đồng</label>
                  <textarea 
                    rows={2}
                    value={editForm.note || ""}
                    onChange={(e) => handleHeaderChange("note", e.target.value)}
                    style={{ width: "100%", border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "8px 10px", outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "inherit", fontSize: 12 }}
                  />
                </div>
              </div>
            </div>

            {/* Custom Fields khu vực */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#e91e8c" }}>✨ Trường tùy chỉnh (Custom Fields)</label>
                <button 
                  type="button" 
                  onClick={handleAddCustomField}
                  style={{ display: "flex", alignItems: "center", gap: 4, background: "#FFE4EE", color: "#e91e8c", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  <Plus size={12} /> Thêm trường
                </button>
              </div>
              {(!editForm.customFields || editForm.customFields.length === 0) ? (
                <div style={{ fontSize: 11, color: "#999", fontStyle: "italic", padding: "10px", border: "1px dashed #FFE0EB", borderRadius: 8, textAlign: "center" }}>
                  Chưa có trường tùy chỉnh nào. Nhấn "Thêm trường" để tự tạo cấu trúc thông tin riêng của bạn.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 150, overflowY: "auto", paddingRight: 4 }}>
                  {editForm.customFields.map((field, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input 
                        type="text" 
                        placeholder="Tên trường (VD: Mã vận đơn)"
                        value={field.key}
                        onChange={(e) => handleCustomFieldChange(idx, "key", e.target.value)}
                        required
                        style={{ flex: 2, height: 32, border: "1px solid #FFE0EB", borderRadius: 6, padding: "0 8px", fontSize: 12, outline: "none" }}
                      />
                      <select 
                        value={field.type}
                        onChange={(e) => handleCustomFieldChange(idx, "type", e.target.value)}
                        style={{ flex: 1, height: 32, border: "1px solid #FFE0EB", borderRadius: 6, padding: "0 4px", fontSize: 12, outline: "none", background: "white" }}
                      >
                        <option value="text">Chữ (Text)</option>
                        <option value="number">Số (Number)</option>
                        <option value="boolean">Boolean (True/False)</option>
                      </select>
                      {field.type === "boolean" ? (
                        <select
                          value={field.value}
                          onChange={(e) => handleCustomFieldChange(idx, "value", e.target.value)}
                          style={{ flex: 2, height: 32, border: "1px solid #FFE0EB", borderRadius: 6, padding: "0 8px", fontSize: 12, outline: "none", background: "white" }}
                        >
                          <option value="false">Không (False)</option>
                          <option value="true">Có (True)</option>
                        </select>
                      ) : (
                        <input 
                          type={field.type === "number" ? "number" : "text"}
                          placeholder="Giá trị"
                          value={field.value}
                          onChange={(e) => handleCustomFieldChange(idx, "value", e.target.value)}
                          required
                          style={{ flex: 2, height: 32, border: "1px solid #FFE0EB", borderRadius: 6, padding: "0 8px", fontSize: 12, outline: "none" }}
                        />
                      )}
                      <button 
                        type="button"
                        onClick={() => handleRemoveCustomField(idx)}
                        style={{ background: "#FFEBEE", border: "1px solid #FFCDD2", color: "#D32F2F", borderRadius: 6, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #FFE0EB", paddingTop: 16 }}>
              <button 
                type="button"
                onClick={cancelEditing}
                disabled={isSaving}
                style={{ background: "#F5F5F5", border: "1px solid #DDD", padding: "8px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 700, color: "#555" }}
              >
                Hủy
              </button>
              <button 
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #FF6B9D, #FF8FA3)", border: "none", borderRadius: 10, color: "white", padding: "8px 24px", fontWeight: 700, cursor: "pointer" }}
              >
                {isSaving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Khối tài chính */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
              <Chip 
                label="💸 Lợi nhuận thực tế (Profits)" 
                value={record.currency === "Không thống nhất" 
                  ? "Không thống nhất tiền tệ ⚠️" 
                  : fmtCurrency(record.profits, record.currency)} 
                color={record.currency === "Không thống nhất" ? "#D32F2F" : "#2e7d32"} 
                bg={record.currency === "Không thống nhất" ? "#FFEBEE" : "#E8F5E9"} 
              />
              <Chip label="📈 Commission" value={`${record.commission || 0}%`} color="#1565C0" bg="#E3F2FD" />
              <Chip label="📉 Nego margin" value={`${record.nego_margin || 0}%`} color="#F57C00" bg="#FFF8E1" />
              <Chip label="🏷️ Supplier discount" value={`${record.supplier_discount || 0}%`} color="#2E7D32" bg="#E8F5E9" />
              <Chip label="🏷️ Customer discount" value={`${record.customer_discount || 0}%`} color="#c2185b" bg="#fce4ec" />
              <Chip label="ℹ️ NA" value={`${record.na_col || 0}`} color="#00796b" bg="#e0f2f1" />
              <Chip label="👤 Người nhận" value={record.receiver || "N/A"} color="#7B1FA2" bg="#F3E5F5" />
            </div>

            {/* So sánh hai bên Hóa đơn chốt */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16, marginBottom: 20 }}>
              
              {/* Hóa đơn NCC */}
              <div style={{ border: "1.5px solid #E3F2FD", borderRadius: 14, padding: 16, background: "#FAFDFE" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#1565C0", display: "flex", gap: 6, alignItems: "center" }}><Truck size={16}/> Hóa đơn Nhà cung cấp (Đầu vào)</h3>
                {record.supplier_invoice ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                    <div><strong>Mã báo giá/hóa đơn:</strong> <span style={{ color: "#1565C0", fontWeight: 700 }}>{record.supplier_invoice.invoice_code}</span></div>
                    <div><strong>Nhà cung cấp:</strong> {record.supplier_invoice.supplier_name || "N/A"}</div>
                    <div><strong>Ngày lập:</strong> {record.supplier_invoice.date || "N/A"}</div>
                    <div><strong>Tổng tiền CIF:</strong> <strong style={{ color: "#1565C0" }}>{fmtCurrency(record.supplier_invoice.total_amount_CIF, record.supplier_invoice.currency)}</strong></div>
                    <div><strong>Số lượng sản phẩm:</strong> {record.supplier_invoice.items?.length || 0}</div>
                    {record.supplier_invoice.suppliers_pdf_file_path && (
                      <div style={{ marginTop: 4 }}>
                        <strong>Tài liệu gốc:</strong>{" "}
                        <a 
                          href={`http://127.0.0.1:8000${record.supplier_invoice.suppliers_pdf_file_path}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: "#1565C0", fontWeight: 700, textDecoration: "underline" }}
                        >
                          📄 Mở File Gốc
                        </a>
                      </div>
                    )}
                  </div>
                ) : <div style={{ color: "#888", fontStyle: "italic", fontSize: 12 }}>Không tìm thấy thông tin hóa đơn đầu vào.</div>}
              </div>

              {/* Hóa đơn Client */}
              <div style={{ border: "1.5px solid #FFF0F5", borderRadius: 14, padding: 16, background: "#FFFDFD" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#e91e8c", display: "flex", gap: 6, alignItems: "center" }}><Users size={16}/> Hóa đơn Khách hàng (Đầu ra)</h3>
                {record.client_invoice ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                    <div><strong>Mã báo giá/hóa đơn:</strong> <span style={{ color: "#e91e8c", fontWeight: 700 }}>{record.client_invoice.invoice_code}</span></div>
                    <div><strong>Khách hàng (Client):</strong> {record.client_invoice.client_name || "N/A"}</div>
                    <div><strong>Ngày lập:</strong> {record.client_invoice.date || "N/A"}</div>
                    <div><strong>Tổng tiền CIF:</strong> <strong style={{ color: "#e91e8c" }}>{fmtCurrency(record.client_invoice.total_amount_CIF, record.client_invoice.currency)}</strong></div>
                    <div><strong>Số lượng sản phẩm:</strong> {record.client_invoice.items?.length || 0}</div>
                    {record.client_invoice.clients_pdf_file_path && (
                      <div style={{ marginTop: 4 }}>
                        <strong>Tài liệu gốc:</strong>{" "}
                        <a 
                          href={`http://127.0.0.1:8000${record.client_invoice.clients_pdf_file_path}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: "#e91e8c", fontWeight: 700, textDecoration: "underline" }}
                        >
                          📄 Mở File Gốc
                        </a>
                      </div>
                    )}
                  </div>
                ) : <div style={{ color: "#888", fontStyle: "italic", fontSize: 12 }}>Không tìm thấy thông tin hóa đơn đầu ra.</div>}
              </div>

            </div>

            {/* Ghi chú */}
            {record.note && (
              <div style={{ background: "#F9F9F9", border: "1px dashed #DDD", padding: "12px 16px", borderRadius: 10, fontSize: 13, color: "#555", marginBottom: 20 }}>
                <strong>📝 Ghi chú hợp đồng:</strong> {record.note}
              </div>
            )}

            {/* Custom Fields */}
            {record.customFields && record.customFields.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#555", fontWeight: 700 }}>✨ Thông tin bổ sung (Custom Fields)</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {record.customFields.map((cf, idx) => (
                    <div key={idx} style={{ background: "#FFF0F5", border: "1px solid #FFE0EB", padding: "6px 12px", borderRadius: 8, fontSize: 13 }}>
                      <span style={{ color: "#e91e8c", marginRight: 6 }}>{cf.key}:</span>
                      <strong style={{ color: "#333" }}>{cf.value !== undefined && cf.value !== null ? String(cf.value) : "-"}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button 
                onClick={startEditing}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#E3F2FD", border: "1px solid #90CAF9", color: "#1565C0", padding: "8px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}
              >
                <Edit size={14} /> Chỉnh sửa
              </button>
              <button onClick={onClose} style={{ background: "#F5F5F5", border: "1px solid #DDD", padding: "8px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 700, color: "#555" }}>
                Đóng
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const FIELD_TYPES = [
  { value: "text", label: "Văn bản (Text)" },
  { value: "number", label: "Số (Number)" },
  { value: "date", label: "Ngày (Date)" },
  { value: "boolean", label: "Có/Không (Boolean)" },
];

// COMPONENT: Gợi ý các tên trường có sẵn khi gõ dấu '{'
function FormulaSuggestions({ text, context, onSelect }) {
  const keys = React.useMemo(() => {
    const list = [];
    Object.keys(context).forEach((k) => {
      if (typeof context[k] !== "object" && k !== "items") list.push(k);
    });
    if (context.extra_data) {
      Object.keys(context.extra_data).forEach((k) => list.push(k));
    }
    if (context.customFields && Array.isArray(context.customFields)) {
      context.customFields.forEach((f) => f.key && list.push(f.key));
    }

    const lastIdx = text.lastIndexOf("{");
    const query = text.substring(lastIdx + 1).toLowerCase();
    return list.filter((k) => k.toLowerCase().includes(query));
  }, [context, text]);

  if (keys.length === 0) return null;

  return (
    <div style={{
      position: "absolute",
      top: "100%",
      left: 0,
      background: "white",
      border: "1px solid #FFD6E0",
      borderRadius: 8,
      zIndex: 10,
      maxHeight: 150,
      overflowY: "auto",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      width: "250px"
    }}>
      {keys.map((k) => (
        <div 
          key={k} 
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(k);
          }}
          style={{
            padding: "8px 12px",
            fontSize: 12,
            cursor: "pointer",
            borderBottom: "1px solid #FFF0F5",
            color: "#e91e8c",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <span>🔑 {getLabel(k)}</span>
          <span style={{ color: "#bbb", fontSize: 10 }}>({k})</span>
        </div>
      ))}
    </div>
  );
}

// COMPONENT: Ô nhập liệu thông minh tích hợp Formula & Gợi ý trường
function FormulaInput({ value, onChange, onRealTimeChange, placeholder, context, style, type, onFocus }) {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value ?? "");

  React.useEffect(() => {
    if (!isFocused) {
      setLocalValue(value ?? "");
    }
  }, [value, isFocused]);

  const handleBlur = () => {
    setIsFocused(false);
    let cleanValue = localValue;
    if (type === "number" && typeof cleanValue === "string" && !cleanValue.startsWith("=")) {
      cleanValue = cleanValue.replace(/,/g, "");
    }
    if (onChange) onChange(cleanValue);
  };

  const handleChange = (e) => {
    let val = e.target.value;
    if (type === "number" && !val.startsWith("=")) {
      val = val.replace(/[^0-9.,-]/g, "");
    }
    setLocalValue(val);
    if (onRealTimeChange) onRealTimeChange(val);
  };

  const evaluated = React.useMemo(() => {
    if (typeof localValue === "string" && localValue.startsWith("=")) {
      return evaluateFormula(localValue, context);
    }
    if (type === "number" && localValue && !isNaN(Number(localValue.toString().replace(/,/g, "")))) {
      const numVal = Number(localValue.toString().replace(/,/g, ""));
      return numVal.toLocaleString("en-US");
    }
    return localValue;
  }, [localValue, context, type]);

  const showSuggestions = isFocused && typeof localValue === "string" && localValue.includes("{") && !localValue.endsWith("}");

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        value={isFocused ? localValue : (typeof localValue === "string" && localValue.startsWith("=") ? `= ${evaluated}` : evaluated)}
        onChange={handleChange}
        onFocus={() => {
          setIsFocused(true);
          if (onFocus) onFocus();
        }}
        onBlur={handleBlur}
        placeholder={placeholder}
        style={style}
      />
      {showSuggestions && (
        <FormulaSuggestions 
          text={localValue} 
          context={context} 
          onSelect={(fieldKey) => {
            const lastCurlyIdx = localValue.lastIndexOf("{");
            const newVal = localValue.substring(0, lastCurlyIdx) + `{${fieldKey}}`;
            setLocalValue(newVal);
            if (onRealTimeChange) onRealTimeChange(newVal);
          }} 
        />
      )}
    </div>
  );
}

// COMPONENT: Hộp thoại thêm trường tùy chỉnh
function AddCustomFieldDialog({ onAdd, onClose }) {
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState("text");

  const handleSubmit = () => {
    const trimmed = fieldName.trim();
    if (!trimmed) return;
    onAdd({ key: trimmed, type: fieldType, value: fieldType === "boolean" ? false : "" });
    onClose();
  };

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={{ ...S.modalBox, width: 380, padding: "24px 28px" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>➕ Thêm trường tùy chỉnh</h3>
          <button onClick={onClose} style={S.modalClose}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "#555", fontWeight: 600 }}>Tên trường *</label>
            <input 
              value={fieldName} 
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="Vd: Số container, Cảng đến..." 
              style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1.5px solid #FFD6E0", borderRadius: 8, outline: "none", background: "#FFFAFC", color: "#333", boxSizing: "border-box", marginTop: 6 }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()} 
              autoFocus 
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#555", fontWeight: 600 }}>Kiểu dữ liệu *</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {FIELD_TYPES.map((ft) => (
                <label key={ft.value} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 12px", borderRadius: 8, background: fieldType === ft.value ? "#FFF0F5" : "#FFFAFC", border: fieldType === ft.value ? "1.5px solid #FF8FA3" : "1.5px solid #FFD6E0", transition: "all 0.15s" }}>
                  <input type="radio" name="fieldType" value={ft.value} checked={fieldType === ft.value} onChange={() => setFieldType(ft.value)} style={{ accentColor: "#e91e8c" }} />
                  <span style={{ fontSize: 13, color: fieldType === ft.value ? "#e91e8c" : "#555", fontWeight: fieldType === ft.value ? 600 : 400 }}>{ft.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ background: "none", color: "#FF8FA3", border: "1.5px solid #FFD6E0", borderRadius: 10, padding: "10px 18px", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>Hủy</button>
          <button onClick={handleSubmit} style={{ background: "linear-gradient(135deg, #FF6B9D, #FF8FA3)", color: "white", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 12px rgba(255,107,157,0.35)" }}>Thêm trường</button>
        </div>
      </div>
    </div>
  );
}

function InvoiceDetailModal({ record, onClose, activeTab, onSaveSuccess }) {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(5);

  // Chế độ chỉnh sửa và form cục bộ
  const [isEditing, setIsEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState(null);
  const [showDialog, setShowDialog] = React.useState(false);
  const [showItemCustomDialog, setShowItemCustomDialog] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setPage(1);
    setLimit(5);
    setIsEditing(false);
    setEditForm(null);
  }, [record]);

  const items = React.useMemo(() => {
    if (!record || !record.items) return [];
    return [...record.items].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
  }, [record]);

  // Các helper tính toán đơn giá/số lượng công thức Excel
  const getEvaluatedPrice = (item) => {
    const raw = item.base_price;
    if (typeof raw === "string" && raw.startsWith("=")) {
      const res = evaluateFormula(raw, item);
      return isNaN(Number(res)) ? 0 : Number(res);
    }
    return Number(raw) || 0;
  };

  const getEvaluatedQty = (item) => {
    const raw = item.quantity;
    if (typeof raw === "string" && raw.startsWith("=")) {
      const res = evaluateFormula(raw, item);
      return isNaN(Number(res)) ? 0 : Number(res);
    }
    return Number(raw) || 0;
  };

  const getCustomFieldType = (itemsList, fieldKey) => {
    for (const item of itemsList) {
      const cf = (item.customFields || []).find(f => f.key === fieldKey);
      if (cf && cf.type) return cf.type;
    }
    return "text";
  };

  // Cập nhật thông tin chung của hóa đơn
  const handleHeaderChange = (field, val) => {
    setEditForm({
      ...editForm,
      [field]: val
    });
  };

  const handlePartnerChange = (e) => {
    const val = e.target.value;
    if (activeTab === "client") {
      setEditForm({ ...editForm, client_name: val });
    } else {
      setEditForm({ ...editForm, supplier_name: val });
    }
  };

  // Cập nhật trường tùy chỉnh cấp hóa đơn
  const handleCustomFieldChange = (idx, val) => {
    const updated = editForm.customFields.map((f, i) => i === idx ? { ...f, value: val } : f);
    setEditForm({ ...editForm, customFields: updated });
  };

  const handleAddCustomField = (newField) => {
    const existing = editForm.customFields || [];
    setEditForm({ ...editForm, customFields: [...existing, newField] });
  };

  const handleRemoveCustomField = (idx) => {
    const updated = editForm.customFields.filter((_, i) => i !== idx);
    setEditForm({ ...editForm, customFields: updated });
  };

  // Quản lý cột tùy chỉnh sản phẩm (Item-level custom fields)
  const handleAddCustomCol = (newField) => {
    const updatedItems = (editForm.items || []).map((item) => ({
      ...item,
      customFields: [
        ...(item.customFields || []),
        { key: newField.key, type: newField.type, value: newField.type === "boolean" ? false : "" }
      ]
    }));
    setEditForm({ ...editForm, items: updatedItems });
  };

  const handleRemoveCustomCol = (colKey) => {
    const updatedItems = (editForm.items || []).map((item) => ({
      ...item,
      customFields: (item.customFields || []).filter((f) => f.key !== colKey)
    }));
    setEditForm({ ...editForm, items: updatedItems });
  };

  // Sửa đổi dữ liệu dòng sản phẩm
  const handleItemFieldChange = (idx, field, val) => {
    const updatedItems = (editForm.items || []).map((it, i) => {
      if (i !== idx) return it;
      let cleanedVal = val;
      if (field === "base_price" || field === "quantity") {
        cleanedVal = val === "" ? "" : (isNaN(Number(val)) ? val : Number(val));
      }
      return { ...it, [field]: cleanedVal };
    });
    setEditForm({ ...editForm, items: updatedItems });
  };

  const handleItemExtraDataChange = (idx, key, val) => {
    const updatedItems = (editForm.items || []).map((it, i) => {
      if (i !== idx) return it;
      return {
        ...it,
        extra_data: {
          ...(it.extra_data || {}),
          [key]: val
        }
      };
    });
    setEditForm({ ...editForm, items: updatedItems });
  };

  const handleItemCustomFieldChange = (idx, key, type, val) => {
    const updatedItems = (editForm.items || []).map((it, i) => {
      if (i !== idx) return it;
      const existing = (it.customFields || []).filter(cf => cf.key !== key);
      return {
        ...it,
        customFields: [...existing, { key, type, value: val }]
      };
    });
    setEditForm({ ...editForm, items: updatedItems });
  };

  // Thêm dòng và xóa dòng sản phẩm
  const handleAddRow = () => {
    const extraKeys = getExtraDataKeys(editForm.items || []);
    const customFieldKeys = getCustomFieldKeys(editForm.items || []);
    
    const extra_data = {};
    extraKeys.forEach((k) => { extra_data[k] = ""; });
    
    const itemCFs = [];
    customFieldKeys.forEach((key) => {
      const type = getCustomFieldType(editForm.items || [], key);
      itemCFs.push({ key, type, value: type === "boolean" ? false : "" });
    });

    const newItem = {
      product_code: "",
      base_price: "",
      quantity: "",
      note: "no info",
      extra_data,
      customFields: itemCFs
    };
    setEditForm({ ...editForm, items: [...(editForm.items || []), newItem] });
  };

  const handleRemoveRow = (idx) => {
    const updated = (editForm.items || []).filter((_, i) => i !== idx);
    setEditForm({ ...editForm, items: updated });
  };

  // Bật/tắt chế độ sửa
  const startEditing = () => {
    setEditForm(JSON.parse(JSON.stringify(record)));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm(null);
  };

  // Lưu hóa đơn đã sửa
  const handleSave = async () => {
    const codeVal = editForm.invoice_code || editForm.quotation_id;
    if (!codeVal || !codeVal.trim()) {
      alert("Vui lòng nhập Mã số hóa đơn / báo giá!");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/invoices/${record.id}?invoice_type=${activeTab}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        alert("✅ Lưu thông tin thành công!");
        setIsEditing(false);
        setEditForm(null);
        if (onSaveSuccess) onSaveSuccess();
      } else {
        const err = await response.json().catch(() => ({}));
        alert(`❌ Lưu thất bại! Lý do: ${err.detail || "Lỗi không xác định."}`);
      }
    } catch (e) {
      console.error(e);
      alert("🔌 Lỗi kết nối đến server!");
    } finally {
      setIsSaving(false);
    }
  };

  const renderCustomFieldInput = (f, idx) => {
    if (f.type === "boolean") {
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", height: 38 }}>
          <input 
            type="checkbox" 
            checked={!!f.value} 
            onChange={(e) => handleCustomFieldChange(idx, e.target.checked)} 
            style={{ accentColor: "#e91e8c", width: 16, height: 16 }} 
          />
          <span style={{ fontSize: 13, color: f.value ? "#388E3C" : "#888" }}>{f.value ? "Có" : "Không"}</span>
        </label>
      );
    }
    return (
      <FormulaInput
        value={f.value ?? ""}
        onChange={(val) => handleCustomFieldChange(idx, val)}
        placeholder={`Nhập ${f.key}...`}
        style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1.5px solid #FFD6E0", borderRadius: 8, outline: "none", background: "#FFFAFC", color: "#333", boxSizing: "border-box" }}
        type={f.type}
        context={editForm}
      />
    );
  };

  // ─── THÊM HÀM XUẤT EXCEL CHO RIÊNG LẺ HÓA ĐƠN NÀY ───
  const handleSingleExport = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.XLSX) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Không thể tải thư viện xuất Excel."));
          document.head.appendChild(script);
        });
      } catch (err) {
        alert(err.message);
        return;
      }
    }

    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();

    const codeVal = record.invoice_code || record.quotation_id || record.code;
    const itemsAmount = calcTotalItemsAmount(record.items);
    
    const partnerNameForExport = activeTab === "client"
      ? (record.client_name || record.client?.name || "N/A")
      : (record.supplier_name || record.supplier?.name || "N/A");
      
    const clientVal = activeTab === "client" ? "Công ty của bạn" : (record.client || "N/A");
    const totalCIFVal = record.total_amount_CIF || record.total_amount || 0;

    const aoaData = [];
    
    aoaData.push(["THÔNG TIN HÓA ĐƠN / BÁO GIÁ"]);
    aoaData.push(["Mã Số", codeVal]);
    aoaData.push(["Ngày lập", record.date || "-"]);
    aoaData.push([activeTab === "client" ? "Khách hàng" : "Nhà cung cấp", partnerNameForExport]);
    aoaData.push([activeTab === "client" ? "Người lập" : "Khách mua (Client)", clientVal]);
    aoaData.push(["Tổng CIF", totalCIFVal, record.currency || "USD"]);
    aoaData.push(["Tổng tiền sản phẩm", itemsAmount, record.currency || "USD"]);
    aoaData.push(["Phương thức thanh toán", record.payment_method || "N/A"]);
    aoaData.push(["Trạng thái", record.status || "-"]);
    
    if (record.note && record.note !== "no info" && record.note !== "No note exists") {
      aoaData.push(["Ghi chú hóa đơn", record.note]);
    }
    
    aoaData.push([]);
    aoaData.push(["DANH SÁCH SẢN PHẨM"]);
    
    const extraDataKeys = getExtraDataKeys(record.items);
    const customFieldKeys = getCustomFieldKeys(record.items);
    
    const tableHeaders = [
      "STT", 
      "Mã SP", 
      "Đơn giá", 
      "SL (PCS)", 
      ...extraDataKeys.map(k => getShortKey(k)), 
      ...customFieldKeys.map(k => getShortKey(k)), 
      "Thành tiền", 
      "Ghi chú sản phẩm"
    ];
    aoaData.push(tableHeaders);
    
    const currentItemsList = items;
    currentItemsList.forEach((item, idx) => {
      const basePrice = Number(item.base_price) || 0;
      const qty = Number(item.quantity) || 0;
      const thanhTien = basePrice * qty;
      
      const rowData = [
        idx + 1,
        item.product_code || "-",
        basePrice,
        qty,
      ];
      
      extraDataKeys.forEach(key => {
        rowData.push(item.extra_data?.[key] ?? "-");
      });
      
      customFieldKeys.forEach(key => {
        const cf = (item.customFields || []).find(f => f.key === key);
        const val = getDisplayValue(cf?.value, item);
        rowData.push(val === true ? "Có" : val === false ? "Không" : (val ?? "-"));
      });
      
      rowData.push(thanhTien);
      rowData.push(item.note && item.note !== "no info" ? item.note : "-");
      
      aoaData.push(rowData);
    });
    
    const totalRow = ["Tổng cộng", "", "", currentItemsList.reduce((s, it) => s + (Number(it.quantity) || 0), 0)];
    
    extraDataKeys.forEach(key => {
      let total = 0;
      let isNumeric = false;
      currentItemsList.forEach((it) => {
        const valStr = it.extra_data?.[key];
        if (valStr !== undefined && valStr !== null && valStr !== "") {
          const parsed = typeof valStr === "number" ? valStr : Number(String(valStr).replace(/,/g, ""));
          if (!isNaN(parsed)) {
            total += parsed;
            isNumeric = true;
          }
        }
      });
      totalRow.push(isNumeric ? total : "");
    });
    
    customFieldKeys.forEach(() => totalRow.push(""));
    totalRow.push(itemsAmount);
    
    aoaData.push(totalRow);
    
    const ws = XLSX.utils.aoa_to_sheet(aoaData);
    XLSX.utils.book_append_sheet(wb, ws, getSafeSheetName(codeVal));
    XLSX.writeFile(wb, `Export_${codeVal}.xlsx`);
  };

  if (!record) return null;

  // Giao diện chế độ Chỉnh sửa
  if (isEditing && editForm) {
    const editItems = editForm.items || [];
    const editTotalItemsAmount = editItems.reduce((s, it) => s + getEvaluatedPrice(it) * getEvaluatedQty(it), 0);
    const editExtraDataKeys = getExtraDataKeys(editItems);
    const editCustomFieldKeys = getCustomFieldKeys(editItems);
    const editPartnerName = activeTab === "client" ? (editForm.client_name || "") : (editForm.supplier_name || "");

    return (
      <div style={S.modalOverlay} onClick={onClose}>
        <div style={S.modalBox} onClick={(e) => e.stopPropagation()}>
          {isSaving && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
              <div style={{ background: "white", padding: 20, borderRadius: 12, border: "1.5px solid #FFD6E0", display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #FFE0EB", borderTopColor: "#e91e8c", animation: "spin 0.6s linear infinite" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#e91e8c" }}>Đang lưu dữ liệu...</span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1a1a2e" }}>
                Chỉnh sửa: <span style={{ color: "#e91e8c" }}>{editForm.invoice_code || editForm.quotation_id || ""}</span>
              </h2>
            </div>
            <button onClick={cancelEditing} style={S.modalClose}><X size={16}/></button>
          </div>

          <h4 style={{ margin: "0 0 10px", fontSize: 14, color: "#e91e8c", fontWeight: 700 }}>Thông tin chung</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px 18px", marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 12, color: "#555", fontWeight: 600 }}>Mã số hóa đơn / báo giá *</label>
              <input 
                value={editForm.invoice_code || ""} 
                onChange={(e) => handleHeaderChange("invoice_code", e.target.value)} 
                style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1.5px solid #FFD6E0", borderRadius: 8, outline: "none", background: "#FFFAFC", marginTop: 4 }} 
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#555", fontWeight: 600 }}>Ngày lập</label>
              <input 
                type="date" 
                value={editForm.date || ""} 
                onChange={(e) => handleHeaderChange("date", e.target.value)} 
                style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1.5px solid #FFD6E0", borderRadius: 8, outline: "none", background: "#FFFAFC", marginTop: 4 }} 
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#555", fontWeight: 600 }}>Tiền tệ</label>
              <select 
                value={editForm.currency || "USD"} 
                onChange={(e) => handleHeaderChange("currency", e.target.value)} 
                style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1.5px solid #FFD6E0", borderRadius: 8, outline: "none", background: "#FFFAFC", marginTop: 4 }}
              >
                <option value="USD">USD</option>
                <option value="VND">VND</option>
                <option value="EUR">EUR</option>
                <option value="JPY">JPY</option>
                <option value="CNY">CNY</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#555", fontWeight: 600 }}>Trạng thái</label>
              <select 
                value={editForm.status || "pending"} 
                onChange={(e) => handleHeaderChange("status", e.target.value)} 
                style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1.5px solid #FFD6E0", borderRadius: 8, outline: "none", background: "#FFFAFC", marginTop: 4 }}
              >
                <option value="pending">pending</option>
                <option value="verified">verified</option>
                <option value="rejected">rejected</option>
                <option value="draft">draft</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#555", fontWeight: 600 }}>Thanh toán</label>
              <input 
                value={editForm.payment_method || ""} 
                onChange={(e) => handleHeaderChange("payment_method", e.target.value)} 
                style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1.5px solid #FFD6E0", borderRadius: 8, outline: "none", background: "#FFFAFC", marginTop: 4 }} 
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#555", fontWeight: 600 }}>Tổng CIF</label>
              <input 
                type="number" 
                value={editForm.total_amount_CIF ?? ""} 
                onChange={(e) => handleHeaderChange("total_amount_CIF", e.target.value === "" ? "" : Number(e.target.value))} 
                style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1.5px solid #FFD6E0", borderRadius: 8, outline: "none", background: "#FFFAFC", marginTop: 4 }} 
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#555", fontWeight: 600 }}>{activeTab === "client" ? "Tên Khách hàng" : "Tên Nhà cung cấp"}</label>
              <input 
                value={editPartnerName} 
                onChange={handlePartnerChange} 
                style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1.5px solid #FFD6E0", borderRadius: 8, outline: "none", background: "#FFFAFC", marginTop: 4 }} 
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#555", fontWeight: 600 }}>Ghi chú hóa đơn</label>
              <input 
                value={editForm.note || ""} 
                onChange={(e) => handleHeaderChange("note", e.target.value)} 
                style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1.5px solid #FFD6E0", borderRadius: 8, outline: "none", background: "#FFFAFC", marginTop: 4 }} 
              />
            </div>
          </div>

          <div style={{ marginBottom: 20, borderTop: "1px solid #FFE0EB", paddingTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 14, color: "#e91e8c", fontWeight: 700 }}>✨ Thông tin bổ sung (Trường tùy chỉnh)</h4>
              <button 
                onClick={() => setShowDialog(true)} 
                style={{ background: "#EDE7FF", color: "#7B61FF", border: "1px solid #D1C4E9", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
              >
                + Thêm trường
              </button>
            </div>
            {(editForm.customFields || []).length === 0 ? (
              <p style={{ fontSize: 12, color: "#888", fontStyle: "italic", margin: 0 }}>Chưa có trường tùy chỉnh nào.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px 18px" }}>
                {(editForm.customFields || []).map((f, idx) => (
                  <div key={idx} style={{ position: "relative" }}>
                    <label style={{ fontSize: 12, color: "#555", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      {f.key}
                      <span style={{ fontSize: 10, background: "#EDE7FF", color: "#7B61FF", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>{f.type}</span>
                    </label>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                      <div style={{ flex: 1 }}>{renderCustomFieldInput(f, idx)}</div>
                      <button 
                        onClick={() => handleRemoveCustomField(idx)} 
                        style={{ background: "#FFF0F0", border: "none", borderRadius: 8, width: 34, height: 34, cursor: "pointer", color: "#E53935", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid #FFE0EB", paddingTop: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 14, color: "#e91e8c", fontWeight: 700 }}>📦 Danh sách sản phẩm</h4>
              <div style={{ display: "flex", gap: 8 }}>
                <button 
                  onClick={() => setShowItemCustomDialog(true)} 
                  style={{ background: "#EDE7FF", color: "#7B61FF", border: "1px solid #D1C4E9", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                >
                  + Thêm cột
                </button>
                <button 
                  onClick={handleAddRow} 
                  style={{ background: "linear-gradient(135deg, #FF6B9D, #FF8FA3)", color: "white", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}
                >
                  + Thêm dòng
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #FFE0EB" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1000 }}>
                <thead style={{ background: "#FFF0F5" }}>
                  <tr>
                    <th style={{ ...S.th, width: 50 }}>STT</th>
                    <th style={{ ...S.th, width: 150 }}>Mã SP</th>
                    <th style={{ ...S.th, width: 120 }}>Đơn giá</th>
                    <th style={{ ...S.th, width: 100 }}>SL (PCS)</th>
                    {editExtraDataKeys.map((key) => (
                      <th key={key} style={S.th}>{getShortKey(key)}</th>
                    ))}
                    {editCustomFieldKeys.map((key) => (
                      <th key={key} style={S.th}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{getShortKey(key)}</span>
                          <button 
                            onClick={() => handleRemoveCustomCol(key)} 
                            style={{ background: "none", border: "none", color: "#e91e8c", cursor: "pointer", fontWeight: 700, fontSize: 12 }}
                            title={`Xóa cột ${key}`}
                          >
                            ✕
                          </button>
                        </div>
                      </th>
                    ))}
                    <th style={{ ...S.th, width: 150 }}>Ghi chú sản phẩm</th>
                    <th style={{ ...S.th, textAlign: "right", width: 120 }}>Thành tiền</th>
                    <th style={{ ...S.th, width: 50, textAlign: "center" }}>Xóa</th>
                  </tr>
                </thead>
                <tbody>
                  {editItems.length === 0 ? (
                    <tr>
                      <td colSpan={6 + editExtraDataKeys.length + editCustomFieldKeys.length} style={{ textAlign: "center", padding: "20px", color: "#888" }}>
                        Chưa có sản phẩm nào. Bấm "+ Thêm dòng" để bắt đầu.
                      </td>
                    </tr>
                  ) : (
                    editItems.map((item, i) => {
                      const basePrice = getEvaluatedPrice(item);
                      const qty = getEvaluatedQty(item);
                      const thanhTien = basePrice * qty;
                      const cellStyle = { width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #FFD6E0", borderRadius: 6, background: "#FFFAFC", outline: "none", boxSizing: "border-box" };

                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#FFFAFC" }}>
                          <td style={{ ...S.td, fontWeight: 600, color: "#aaa" }}>{i + 1}</td>
                          <td style={S.td}>
                            <input 
                              value={item.product_code || ""} 
                              onChange={(e) => handleItemFieldChange(i, "product_code", e.target.value)} 
                              style={cellStyle} 
                            />
                          </td>
                          <td style={S.td}>
                            <FormulaInput
                              value={item.base_price ?? ""}
                              onChange={(val) => handleItemFieldChange(i, "base_price", val)}
                              style={cellStyle}
                              type="number"
                              context={item}
                            />
                          </td>
                          <td style={S.td}>
                            <FormulaInput
                              value={item.quantity ?? ""}
                              onChange={(val) => handleItemFieldChange(i, "quantity", val)}
                              style={cellStyle}
                              type="number"
                              context={item}
                            />
                          </td>
                          {editExtraDataKeys.map((key) => (
                            <td key={key} style={S.td}>
                              <input 
                                value={item.extra_data?.[key] ?? ""} 
                                onChange={(e) => handleItemExtraDataChange(i, key, e.target.value)} 
                                style={cellStyle} 
                              />
                            </td>
                          ))}
                          {editCustomFieldKeys.map((key) => {
                            const cf = (item.customFields || []).find((f) => f.key === key);
                            const cfType = cf?.type || "text";
                            
                            if (cfType === "boolean") {
                              return (
                                <td key={key} style={{ ...S.td, textAlign: "center" }}>
                                  <input 
                                    type="checkbox" 
                                    checked={!!cf?.value} 
                                    onChange={(e) => handleItemCustomFieldChange(i, key, "boolean", e.target.checked)} 
                                    style={{ accentColor: "#e91e8c", width: 15, height: 15 }} 
                                  />
                                </td>
                              );
                            }
                            
                            return (
                              <td key={key} style={S.td}>
                                <FormulaInput
                                  value={cf?.value ?? ""}
                                  onChange={(val) => handleItemCustomFieldChange(i, key, cfType, val)}
                                  style={cellStyle}
                                  type={cfType}
                                  context={item}
                                />
                              </td>
                            );
                          })}
                          <td style={S.td}>
                            <input 
                              value={item.note || ""} 
                              onChange={(e) => handleItemFieldChange(i, "note", e.target.value)} 
                              style={cellStyle} 
                            />
                          </td>
                          <td style={{ ...S.td, textAlign: "right", fontWeight: 700, color: "#1565C0" }}>
                            {fmtCurrency(thanhTien, editForm.currency)}
                          </td>
                          <td style={{ ...S.td, textAlign: "center" }}>
                            <button 
                              onClick={() => handleRemoveRow(i)} 
                              style={{ background: "#FFF0F0", border: "none", borderRadius: 6, width: 28, height: 28, cursor: "pointer", color: "#E53935", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {editItems.length > 0 && (
                  <tfoot style={{ background: "#FFF5F8", borderTop: "2px solid #FFD6E0" }}>
                    <tr>
                      <td colSpan={3} style={{ ...S.td, fontWeight: 800, color: "#e91e8c", textAlign: "right" }}>TỔNG CỘNG:</td>
                      <td style={{ ...S.td, fontWeight: 800, color: "#e91e8c" }}>
                        {editItems.reduce((s, it) => s + getEvaluatedQty(it), 0).toLocaleString()}
                      </td>
                      {editExtraDataKeys.map((key) => <td key={key} style={S.td} />)}
                      {editCustomFieldKeys.map((key) => <td key={key} style={S.td} />)}
                      <td style={S.td} />
                      <td style={{ ...S.td, fontWeight: 800, color: "#1565C0", textAlign: "right" }}>
                        {fmtCurrency(editTotalItemsAmount, editForm.currency)}
                      </td>
                      <td style={S.td} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
            <button 
              onClick={handleSave} 
              style={{ background: "linear-gradient(135deg, #FF6B9D, #FF8FA3)", border: "none", padding: "8px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 700, color: "white", fontSize: 13, boxShadow: "0 4px 12px rgba(255,107,157,0.35)" }}
            >
              Lưu thay đổi
            </button>
            <button 
              onClick={cancelEditing} 
              style={{ background: "#F5F5F5", border: "1px solid #DDD", padding: "8px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 700, color: "#555", fontSize: 13 }}
            >
              Hủy
            </button>
          </div>

          {showDialog && (
            <AddCustomFieldDialog 
              onAdd={handleAddCustomField} 
              onClose={() => setShowDialog(false)} 
            />
          )}
          {showItemCustomDialog && (
            <AddCustomFieldDialog 
              onAdd={handleAddCustomCol} 
              onClose={() => setShowItemCustomDialog(false)} 
            />
          )}
        </div>
      </div>
    );
  }

  const sc = statusColor(record.status);
  const totalItemsAmount = calcTotalItemsAmount(items);

  const extraDataKeys = getExtraDataKeys(items);
  const customFieldKeys = getCustomFieldKeys(items);

  const partnerName = (record.supplier_name || record.supplier?.name || record.supplier_id || "N/A").toUpperCase();
  const partnerLabel =  "🏭 Nhà cung cấp";
  const customerLabel =  "👤 Khách nhận (Client)";
  const customerValue = (record.client_name || record.client?.name || record.client || "N/A").toUpperCase();

  const totalItems = items.length;
  const actualLimit = limit === "all" ? Math.max(totalItems, 1) : limit;
  const totalPages = Math.max(1, Math.ceil(totalItems / actualLimit));
  const currentItems = items.slice((page - 1) * actualLimit, page * actualLimit);

  const handleLimitChange = (e) => {
    const val = e.target.value;
    setLimit(val === "all" ? "all" : Number(val));
    setPage(1);
  };

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalBox} onClick={(e) => e.stopPropagation()}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1a1a2e" }}>
              Chi tiết: <span style={{ color: "#e91e8c" }}>{record.invoice_code || record.quotation_id || record.code}</span>
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, fontSize: 12 }}>
              <span style={{ background: "#F5F5F5", padding: "3px 10px", borderRadius: 6, color: "#555", fontWeight: 600 }}>📅 Ngày: {record.date}</span>
              <span style={{ background: "#EDE7FF", color: "#7B61FF", padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>Tiền tệ: {record.currency || "USD"}</span>
              <span style={{ background: sc.bg, color: sc.color, padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>Trạng thái: {record.status}</span>
              <span style={{ background: "#E3F2FD", color: "#1565C0", padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>Thanh toán: {record.payment_method || "N/A"}</span>
              {(record.clients_pdf_file_path || record.suppliers_pdf_file_path) && (
                <a 
                  href={`http://127.0.0.1:8000${record.clients_pdf_file_path || record.suppliers_pdf_file_path}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    background: "#FBE9E7", 
                    color: "#FF5722", 
                    padding: "3px 10px", 
                    borderRadius: 6, 
                    fontWeight: 600, 
                    textDecoration: "none",
                    border: "1px solid #FFCCBC",
                    display: "inline-flex",
                    alignItems: "center"
                  }}
                >
                  📄 Xem File Gốc (PDF/Ảnh)
                </a>
              )}
            </div>
          </div>
          <button onClick={onClose} style={S.modalClose}><X size={16}/></button>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          {activeTab === "supplier" && <Chip label={partnerLabel} value={partnerName} color="#333" bg="#F5F5F5" />}
          {activeTab === "client" && <Chip label={customerLabel} value={customerValue} color="#333" bg="#F5F5F5" />}
          <Chip label="💰 Tổng CIF" value={fmtCurrency(record.total_amount_CIF || record.total_amount, record.currency)} color="#e91e8c" bg="#FFE4EE" />
          <Chip label="💵 Tổng tiền SP" value={fmtCurrency(totalItemsAmount, record.currency)} color="#1565C0" bg="#E3F2FD" />
        </div>

        {record.note && record.note.trim() !== "" && record.note !== "no info" && (
          <div style={{ background: "#FFF8E1", padding: "10px 14px", borderRadius: 10, fontSize: 13, color: "#F57C00", marginBottom: 20, border: "1px solid #FFE082" }}>
            <strong>📝 Ghi chú:</strong> {record.note}
          </div>
        )}

        {record.customFields && record.customFields.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#555", fontWeight: 700 }}>✨ Thông tin bổ sung</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {record.customFields.map((cf, idx) => {
                const evaluatedVal = getDisplayValue(cf.value, record);
                const displayVal = evaluatedVal === true ? "Có" : evaluatedVal === false ? "Không" : evaluatedVal;
                return (
                  <div key={idx} style={{ background: "#F9F9F9", border: "1px solid #EEE", padding: "6px 12px", borderRadius: 8, fontSize: 13 }}>
                    <span style={{ color: "#888", marginRight: 6 }}>{cf.key}:</span>
                    <strong style={{ color: "#333" }}>{displayVal !== undefined && displayVal !== null ? String(displayVal) : "-"}</strong>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <hr style={{ border: "none", borderTop: "1px solid #FFE0EB", margin: "24px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>📦 Danh sách Sản phẩm</span>
          <span style={{ background: "#FFE4EE", color: "#e91e8c", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
            Tổng {totalItems} SP
          </span>
        </div>

        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #FFE0EB" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
            <thead style={{ background: "#FFF0F5" }}>
              <tr>
                <th style={S.th}>STT</th>
                <th style={S.th}>Mã SP</th>
                <th style={S.th}>Đơn giá</th>
                <th style={S.th}>SL (PCS)</th>
                {extraDataKeys.map((key) => (
                  <th key={key} style={S.th}>{getShortKey(key)}</th>
                ))}
                {customFieldKeys.map((key) => (
                  <th key={key} style={S.th}>{getShortKey(key)}</th>
                ))}
                <th style={{ ...S.th, textAlign: "right" }}>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr><td colSpan={5 + extraDataKeys.length + customFieldKeys.length} style={{ textAlign: "center", padding: "20px", color: "#888" }}>Không có sản phẩm nào.</td></tr>
              ) : (
                currentItems.map((item, i) => {
                  const basePrice = Number(item.base_price) || 0;
                  const qty = Number(item.quantity) || 0;
                  const thanhTien = basePrice * qty;
                  const stt = (page - 1) * actualLimit + i + 1;
                  
                  return (
                    <React.Fragment key={`frag-${item.id || i}`}>
                      <tr style={{ background: i % 2 === 0 ? "white" : "#FFFAFC" }}>
                        <td style={{ ...S.td, fontWeight: 600, color:"#aaa" }}>{stt}</td>
                        <td style={{ ...S.td, fontWeight: 700, color: "#333" }}>{item.product_code || "-"}</td>
                        <td style={S.td}>{basePrice.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 4 })}</td>
                        <td style={S.td}>{qty.toLocaleString()}</td>
                        
                        {extraDataKeys.map((key) => (
                          <td key={key} style={S.td}>
                            {item.extra_data?.[key] !== undefined && item.extra_data?.[key] !== null && item.extra_data?.[key] !== ""
                              ? item.extra_data[key]
                              : "-"}
                          </td>
                        ))}

                        {customFieldKeys.map((key) => {
                          const cf = (item.customFields || []).find((f) => f.key === key);
                          const val = getDisplayValue(cf?.value, item);
                          return (
                            <td key={key} style={S.td}>
                              {val === true ? "Có" : val === false ? "Không" : val !== undefined && val !== null && val !== "" ? val : "-"}
                            </td>
                          );
                        })}

                        <td style={{ ...S.td, textAlign: "right", fontWeight: 700, color: "#1565C0" }}>
                          {fmtCurrency(thanhTien, record.currency)}
                        </td>
                      </tr>
                      {item.note && item.note.trim() !== "" && item.note !== "no info" && (
                        <tr style={{ background: i % 2 === 0 ? "white" : "#FFFAFC" }}>
                          <td colSpan={5 + extraDataKeys.length + customFieldKeys.length} style={{ padding: "4px 10px 10px 36px", borderBottom: "1px solid #FFF0F5" }}>
                            <div style={{ fontSize: 11, color: "#C62828", fontStyle: "italic", background: "#FFEBEE", padding: "4px 10px", borderRadius: 6, borderLeft: "3px solid #E53935", display: "inline-block" }}>
                              ⚠️ <strong>Lưu ý:</strong> {item.note}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {items.length > 0 && (
              <tfoot style={{ background: "#FFF5F8", borderTop: "2px solid #FFD6E0" }}>
                <tr>
                  <td colSpan={3} style={{ ...S.td, fontWeight: 800, color: "#e91e8c", textAlign: "right" }}>TỔNG CỘNG:</td>
                  <td style={{ ...S.td, fontWeight: 800, color: "#e91e8c" }}>
                    {items.reduce((s, it) => s + (Number(it.quantity) || 0), 0).toLocaleString()}
                  </td>
                  {extraDataKeys.map((key) => {
                    let total = 0;
                    let isNumeric = false;
                    items.forEach((it) => {
                      const valStr = it.extra_data?.[key];
                      if (valStr !== undefined && valStr !== null && valStr !== "") {
                        const parsed = typeof valStr === "number" ? valStr : Number(String(valStr).replace(/,/g, ""));
                        if (!isNaN(parsed)) {
                          total += parsed;
                          isNumeric = true;
                        }
                      }
                    });
                    return (
                      <td key={key} style={{ ...S.td, fontWeight: 800, color: "#e91e8c" }}>
                        {isNumeric ? (Number.isInteger(total) ? total : total.toFixed(2)) : ""}
                      </td>
                    );
                  })}
                  {customFieldKeys.map((key) => <td key={key} style={S.td} />)}
                  <td style={{ ...S.td, fontWeight: 800, color: "#1565C0", textAlign: "right" }}>
                    {fmtCurrency(totalItemsAmount, record.currency)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {totalItems > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0 0 0", marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#757575" }}>
              Hiển thị
              <select 
                value={limit} 
                onChange={handleLimitChange} 
                style={{ height: 26, border: "1px solid #fce4ec", borderRadius: 6, padding: "0 4px", fontSize: 12, outline: "none", background: "#fff8fa", cursor: "pointer" }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value="all">Tất cả</option>
              </select>
              dòng / trang
            </div>

            {totalPages > 1 && limit !== "all" && (
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#888" }}>
                  Đang xem {(page - 1) * actualLimit + 1} - {Math.min(page * actualLimit, totalItems)} / {totalItems} SP
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))} 
                    disabled={page === 1}
                    style={{ background: page === 1 ? "#F5F5F5" : "#FFF0F5", color: page === 1 ? "#CCC" : "#e91e8c", border: "none", borderRadius: 6, padding: "4px 10px", cursor: page === 1 ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700 }}
                  >
                    Trước
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#333", display: "flex", alignItems: "center", padding: "0 4px" }}>{page} / {totalPages}</span>
                  <button 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                    disabled={page === totalPages}
                    style={{ background: page === totalPages ? "#F5F5F5" : "#FFF0F5", color: page === totalPages ? "#CCC" : "#e91e8c", border: "none", borderRadius: 6, padding: "4px 10px", cursor: page === totalPages ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700 }}
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button 
            onClick={startEditing} 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 6, 
              background: "linear-gradient(135deg, #FF6B9D, #FF8FA3)", 
              border: "none", 
              borderRadius: 8, 
              color: "white", 
              padding: "8px 20px", 
              cursor: "pointer", 
              fontWeight: 700,
              fontSize: 13,
              boxShadow: "0 4px 12px rgba(255,107,157,0.35)"
            }}
          >
            Chỉnh sửa
          </button>
          {/* NÚT XUẤT EXCEL ĐƯỢC CHÈN THÊM VÀO ĐÂY */}
          <button 
            onClick={handleSingleExport} 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 6, 
              background: "#fff", 
              border: "1.5px solid #43a047", 
              borderRadius: 8, 
              color: "#43a047", 
              padding: "8px 20px", 
              cursor: "pointer", 
              fontWeight: 700,
              fontSize: 13
            }}
          >
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          <button onClick={onClose} style={{ background: "#F5F5F5", border: "1px solid #DDD", padding: "8px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 700, color: "#555", fontSize: 13 }}>
            Đóng
          </button>
        </div>
      </div>
      
    </div>
  );
}

// ─── Component Modal Tạo Hợp Đồng (Gợi ý & Caching cục bộ cực nhanh) ────────
// ─── Component Modal Tạo Hợp Đồng (Đã chặn triệt để lỗi tự động submit) ───
function CreateContractModal({ isOpen, onClose, onSubmit, triggerAlert }) {
  if (!isOpen) return null;

  // ─── THÊM STATE NÀY ───
  const [contractCode, setContractCode] = useState(""); 
  // States các trường nhập của form
  const [date, setDate] = useState("");
  const [commission, setCommission] = useState(0);
  const [negoMargin, setNegoMargin] = useState(0);
  const [supplierDiscount, setSupplierDiscount] = useState(0);
  const [customerDiscount, setCustomerDiscount] = useState(0);
  const [naCol, setNaCol] = useState(0);
  const [receiver, setReceiver] = useState("");
  const [statusText, setStatusText] = useState("");
  const [paymentStatusSupplier, setPaymentStatusSupplier] = useState("not yet paid");
  const [paymentStatusCustomer, setPaymentStatusCustomer] = useState("not yet paid");
  const [note, setNote] = useState("");
  const [customFields, setCustomFields] = useState([]);
  const [profits, setProfits] = useState(""); // State cho lợi nhuận hợp đồng

  // States Autocomplete hóa đơn NCC
  const [supplierSearch, setSupplierSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  // States Autocomplete hóa đơn khách hàng
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Local RAM Cache lưu trữ kết quả tìm kiếm của user
  const [localSearchCache, setLocalSearchCache] = useState({ supplier: {}, client: {} });

  // 1. Debounce tìm kiếm hóa đơn Nhà cung cấp (Sau khi gõ 300ms và có sử dụng Local Cache)
  useEffect(() => {
    if (!supplierSearch.trim()) {
      setSupplierSuggestions([]);
      return;
    }
    
    // Nếu trong RAM Cache cục bộ đã lưu kết quả này, sử dụng ngay không gọi API [1]
    if (localSearchCache.supplier[supplierSearch]) {
      setSupplierSuggestions(localSearchCache.supplier[supplierSearch]);
      return;
    }

    const handler = setTimeout(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/contracts/suggest/supplier?q=${supplierSearch}`);
        if (res.ok) {
          const data = await res.json();
          setSupplierSuggestions(data);
          // Ghi vào RAM Cache [1]
          setLocalSearchCache(prev => ({
            ...prev,
            supplier: { ...prev.supplier, [supplierSearch]: data }
          }));
        }
      } catch (err) {
        console.error("Lỗi gợi ý hóa đơn NCC:", err);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [supplierSearch]);

  // 2. Debounce tìm kiếm hóa đơn Khách hàng
  useEffect(() => {
    if (!clientSearch.trim()) {
      setClientSuggestions([]);
      return;
    }

    if (localSearchCache.client[clientSearch]) {
      setClientSuggestions(localSearchCache.client[clientSearch]);
      return;
    }

    const handler = setTimeout(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/contracts/suggest/client?q=${clientSearch}`);
        if (res.ok) {
          const data = await res.json();
          setClientSuggestions(data);
          // Ghi vào RAM Cache [1]
          setLocalSearchCache(prev => ({
            ...prev,
            client: { ...prev.client, [clientSearch]: data }
          }));
        }
      } catch (err) {
        console.error("Lỗi gợi ý hóa đơn khách hàng:", err);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [clientSearch]);

  const handleAddCustomField = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCustomFields([...customFields, { key: "", type: "text", value: "" }]);
  };

  const handleRemoveCustomField = (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleCustomFieldChange = (index, field, val) => {
    const updated = [...customFields];
    updated[index][field] = val;
    setCustomFields(updated);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!contractCode.trim()) {
      triggerAlert("Vui lòng nhập Mã Hợp Đồng!");
      return;
    }
    if (!selectedClient) {
      triggerAlert("Vui lòng tìm và chọn Hóa đơn Khách hàng!");
      return;
    }
    if (!selectedSupplier) {
      triggerAlert("Vui lòng tìm và chọn Hóa đơn Nhà cung cấp!");
      return;
    }

    const payload = {
      contract_code: contractCode,
      date: date || null,
      supplier_invoice_id: selectedSupplier.id,
      client_invoice_id: selectedClient.id,
      commission: Number(commission) || 0.0,
      nego_margin: Number(negoMargin) || 0.0,
      supplier_discount: Number(supplierDiscount) || 0.0,
      customer_discount: Number(customerDiscount) || 0.0,
      na_col: Number(naCol) || 0.0,
      profits: profits !== "" ? Number(profits) : null,
      receiver: receiver || null,
      status: statusText || null,
      payment_status_supplier: paymentStatusSupplier,
      payment_status_customer: paymentStatusCustomer,
      note: note || null,
      customFields: customFields.filter(f => f.key.trim() !== "").map(f => ({
        key: f.key,
        type: f.type,
        value: f.type === "number" ? Number(f.value) : f.type === "boolean" ? (f.value === "true" || f.value === true) : f.value
      }))
    };

    onSubmit(payload);
  };

  return (
    <div 
      style={S.modalOverlay} 
      onClick={(e) => {
        e.preventDefault(); // Ngăn chặn hành vi không mong muốn khi click nền overlay
        onClose();
      }}
    >
      <div 
        style={{ ...S.modalBox, width: "min(96vw, 850px)" }} 
        onClick={(e) => {
          e.stopPropagation(); // Ngăn chặn sự kiện click lan truyền ra lớp overlay ngoài
        }}
      >
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1a1a2e" }}>
            Tạo Hợp Đồng Mới 🌸
          </h2>
          <button 
            type="button"  // Khai báo rõ loại button để tránh kích hoạt submit form ngầm
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }} 
            style={S.modalClose}
          >
            <X size={16}/>
          </button>
        </div>

        <form onSubmit={handleFormSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            
            {/* Cột Trái */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              
              {/* Tìm hóa đơn NCC */}
              <div style={{ position: "relative" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>
                  Mã Hóa đơn Nhà cung cấp *
                </label>
                {selectedSupplier ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#E8F5E9", border: "1px solid #C8E6C9", borderRadius: 8 }}>
                    <div>
                      <strong style={{ color: "#2E7D32" }}>{selectedSupplier.invoice_code}</strong>
                      <span style={{ fontSize: 11, color: "#666", marginLeft: 8 }}>({selectedSupplier.supplier_name})</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={(e) => { 
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedSupplier(null); 
                        setSupplierSearch(""); 
                      }}
                      style={{ background: "none", border: "none", color: "#D32F2F", cursor: "pointer", fontWeight: 700 }}
                    >
                      Xóa
                    </button>
                  </div>
                ) : (
                  <div>
                    <input 
                      type="text"
                      placeholder="Gõ tìm kiếm mã hóa đơn..."
                      value={supplierSearch}
                      onChange={(e) => { setSupplierSearch(e.target.value); setShowSupplierDropdown(true); }}
                      onFocus={() => setShowSupplierDropdown(true)}
                      style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                    />
                    {showSupplierDropdown && supplierSuggestions.length > 0 && (
                      <ul style={{ position: "absolute", zIndex: 110, top: "100%", left: 0, right: 0, background: "white", border: "1.5px solid #FFE0EB", borderRadius: 8, padding: 0, margin: "4px 0 0", listStyle: "none", maxHeight: 150, overflowY: "auto", boxShadow: "0 10px 25px rgba(255,107,157,0.15)" }}>
                        {supplierSuggestions.map((item) => (
                          <li 
                            key={item.id} 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation(); // Chặn lan truyền click tránh submit form
                              setSelectedSupplier(item);
                              setShowSupplierDropdown(false);
                            }}
                            style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #FFF0F5", fontSize: 12 }}
                            onMouseEnter={e => e.currentTarget.style.background = "#FFF0F5"}
                            onMouseLeave={e => e.currentTarget.style.background = "none"}
                          >
                            <strong>{item.invoice_code}</strong> - {item.supplier_name} ({fmtCurrency(item.total_amount_CIF, item.currency)})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Tìm hóa đơn Khách hàng */}
              <div style={{ position: "relative" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>
                  Mã Hóa đơn Khách mua *
                </label>
                {selectedClient ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#E8F5E9", border: "1px solid #C8E6C9", borderRadius: 8 }}>
                    <div>
                      <strong style={{ color: "#2E7D32" }}>{selectedClient.invoice_code}</strong>
                      <span style={{ fontSize: 11, color: "#666", marginLeft: 8 }}>({selectedClient.client_name})</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={(e) => { 
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedClient(null); 
                        setClientSearch(""); 
                      }}
                      style={{ background: "none", border: "none", color: "#D32F2F", cursor: "pointer", fontWeight: 700 }}
                    >
                      Xóa
                    </button>
                  </div>
                ) : (
                  <div>
                    <input 
                      type="text"
                      placeholder="Gõ tìm kiếm mã hóa đơn..."
                      value={clientSearch}
                      onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                      onFocus={() => setShowClientDropdown(true)}
                      style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                    />
                    {showClientDropdown && clientSuggestions.length > 0 && (
                      <ul style={{ position: "absolute", zIndex: 110, top: "100%", left: 0, right: 0, background: "white", border: "1.5px solid #FFE0EB", borderRadius: 8, padding: 0, margin: "4px 0 0", listStyle: "none", maxHeight: 150, overflowY: "auto", boxShadow: "0 10px 25px rgba(255,107,157,0.15)" }}>
                        {clientSuggestions.map((item) => (
                          <li 
                            key={item.id} 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedClient(item);
                              setShowClientDropdown(false);
                            }}
                            style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #FFF0F5", fontSize: 12 }}
                            onMouseEnter={e => e.currentTarget.style.background = "#FFF0F5"}
                            onMouseLeave={e => e.currentTarget.style.background = "none"}
                          >
                            <strong>{item.invoice_code}</strong> - {item.client_name} ({fmtCurrency(item.total_amount_CIF, item.currency)})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>
                  Mã Số Hợp Đồng *
                </label>
                <input 
                  type="text"
                  placeholder="Nhập mã hợp đồng duy nhất (VD: HD-001)..."
                  value={contractCode}
                  onChange={(e) => setContractCode(e.target.value)}
                  required
                  style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              {/* Ngày chốt hợp đồng */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>
                  Ngày chốt hợp đồng *
                </label>
                <input 
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* Người nhận bảng chào */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>
                  Người nhận bảng chào
                </label>
                <input 
                  type="text"
                  placeholder="Nhập tên người nhận..."
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* Trạng thái hợp đồng */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>
                  Trạng thái hợp đồng
                </label>
                <input 
                  type="text"
                  placeholder="Nhập trạng thái hợp đồng..."
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                />
              </div>

            </div>

            {/* Cột Phải */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              
              {/* Trạng thái thanh toán (Split) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>
                    Thanh toán Supplier
                  </label>
                  <select
                    value={paymentStatusSupplier}
                    onChange={(e) => setPaymentStatusSupplier(e.target.value)}
                    style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box", background: "white", fontSize: 11 }}
                  >
                    <option value="not yet paid">Chưa thanh toán</option>
                    <option value="paid 50%">Thanh toán 50%</option>
                    <option value="paid">Đã thanh toán</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>
                    Khách hàng thanh toán
                  </label>
                  <select
                    value={paymentStatusCustomer}
                    onChange={(e) => setPaymentStatusCustomer(e.target.value)}
                    style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box", background: "white", fontSize: 11 }}
                  >
                    <option value="not yet paid">Chưa thanh toán</option>
                    <option value="paid 50%">Thanh toán 50%</option>
                    <option value="paid">Đã thanh toán</option>
                  </select>
                </div>
              </div>

              {/* Commission & Nego Margin */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>
                    Commission (%)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="VD: 5"
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                    style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>
                    Nego margin (%)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="VD: 2"
                    value={negoMargin}
                    onChange={(e) => setNegoMargin(e.target.value)}
                    style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Supplier & Customer discount */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>
                    Supplier discount
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={supplierDiscount}
                    onChange={(e) => setSupplierDiscount(e.target.value)}
                    style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>
                    Customer discount
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={customerDiscount}
                    onChange={(e) => setCustomerDiscount(e.target.value)}
                    style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Lợi nhuận & NA */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>
                    Lợi nhuận thực tế (Profits)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="Nhập số tiền lợi nhuận..."
                    value={profits}
                    onChange={(e) => setProfits(e.target.value)}
                    style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>
                    NA
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="NA..."
                    value={naCol}
                    onChange={(e) => setNaCol(e.target.value)}
                    style={{ width: "100%", height: 36, border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "0 10px", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#e91e8c", display: "block", marginBottom: 4 }}>
                  Ghi chú hợp đồng
                </label>
                <textarea 
                  placeholder="Nhập ghi chú chi tiết nếu có..."
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{ width: "100%", border: "1.5px solid #FFE0EB", borderRadius: 8, padding: "8px 10px", outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "inherit", fontSize: 12 }}
                />
              </div>

            </div>
          </div>

          {/* Custom Fields khu vực */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#e91e8c" }}>✨ Trường tùy chỉnh (Custom Fields)</label>
              <button 
                type="button" 
                onClick={handleAddCustomField}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "#FFE4EE", color: "#e91e8c", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
              >
                <Plus size={12} /> Thêm trường
              </button>
            </div>
            {customFields.length === 0 ? (
              <div style={{ fontSize: 11, color: "#999", fontStyle: "italic", padding: "10px", border: "1px dashed #FFE0EB", borderRadius: 8, textAlign: "center" }}>
                Chưa có trường tùy chỉnh nào. Nhấn "Thêm trường" để tự tạo cấu trúc thông tin riêng của bạn.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 150, overflowY: "auto", paddingRight: 4 }}>
                {customFields.map((field, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input 
                      type="text" 
                      placeholder="Tên trường (VD: Mã vận đơn)"
                      value={field.key}
                      onChange={(e) => handleCustomFieldChange(idx, "key", e.target.value)}
                      required
                      style={{ flex: 2, height: 32, border: "1px solid #FFE0EB", borderRadius: 6, padding: "0 8px", fontSize: 12, outline: "none" }}
                    />
                    <select 
                      value={field.type}
                      onChange={(e) => handleCustomFieldChange(idx, "type", e.target.value)}
                      style={{ flex: 1, height: 32, border: "1px solid #FFE0EB", borderRadius: 6, padding: "0 4px", fontSize: 12, outline: "none", background: "white" }}
                    >
                      <option value="text">Chữ (Text)</option>
                      <option value="number">Số (Number)</option>
                      <option value="boolean">Boolean (True/False)</option>
                    </select>
                    {field.type === "boolean" ? (
                      <select
                        value={field.value}
                        onChange={(e) => handleCustomFieldChange(idx, "value", e.target.value)}
                        style={{ flex: 2, height: 32, border: "1px solid #FFE0EB", borderRadius: 6, padding: "0 8px", fontSize: 12, outline: "none", background: "white" }}
                      >
                        <option value="false">Không (False)</option>
                        <option value="true">Có (True)</option>
                      </select>
                    ) : (
                      <input 
                        type={field.type === "number" ? "number" : "text"}
                        placeholder="Giá trị"
                        value={field.value}
                        onChange={(e) => handleCustomFieldChange(idx, "value", e.target.value)}
                        required
                        style={{ flex: 2, height: 32, border: "1px solid #FFE0EB", borderRadius: 6, padding: "0 8px", fontSize: 12, outline: "none" }}
                      />
                    )}
                    <button 
                      type="button"
                      onClick={(e) => handleRemoveCustomField(idx, e)}
                      style={{ background: "#FFEBEE", border: "1px solid #FFCDD2", color: "#D32F2F", borderRadius: 6, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer nút hành động */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #FFE0EB", paddingTop: 16 }}>
            <button 
              type="button" // Khai báo rõ ràng type="button" và xử lý sự kiện click
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }} 
              style={{ background: "#F5F5F5", border: "1px solid #DDD", padding: "8px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 700, color: "#555" }}
            >
              Hủy
            </button>
            <button 
              type="submit" 
              style={{ ...S.btnPrimary, height: 38 }}
            >
              Lập hợp đồng
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component DataTablePage ──────────────────────────────────────────────
export default function DataTablePage() {
  const [activeTab, setActiveTab] = useState("contract");
  const [notification, setNotification] = useState(null);

  // ─── THÊM CÁC STATE NÀY ĐỂ QUẢN LÝ TÌM KIẾM ĐỘNG ───
  const [searchTerm, setSearchTerm] = useState("");              // Chữ đang gõ trong ô tìm kiếm
  const [suggestions, setSuggestions] = useState([]);            // Danh sách hóa đơn gợi ý
  const [showSuggestions, setShowSuggestions] = useState(false);  // Trạng thái ẩn/hiện danh sách gợi ý
  const [activeSearchQuery, setActiveSearchQuery] = useState("");  // Từ khóa thực tế đang áp dụng vào bảng

  // Data States
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // States mở Modal chi tiết
  const [detailRecord, setDetailRecord] = useState(null);
  const [contractDetailRecord, setContractDetailRecord] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Cache state lưu trữ cấu trúc: { [tab]: { [page-limit]: { rows, totalRecords } } }
  const [cachedData, setCachedData] = useState({
    contract: {},
    supplier: {},
    client: {},
  });

  // Pagination States
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0); 

  // Selection
  const [selectedIds, setSelectedIds] = useState([]);

  const triggerAlert = (message, title = "Thông báo 🌸") => {
    setNotification({ title, message, showCancel: false, onConfirm: () => setNotification(null) });
  };

  const triggerConfirm = (message, onConfirm, onCancel = null, title = "Xác nhận ❓") => {
    setNotification({
      title,
      message,
      showCancel: true,
      onConfirm: () => {
        onConfirm();
        setNotification(null);
      },
      onCancel: () => {
        if (onCancel) onCancel();
        setNotification(null);
      }
    });
  };

  // ─── API Fetching có Cache xử lý (Tích hợp thêm Tab Hợp Đồng) ───────────────
  const fetchInvoices = async (forceRefresh = false) => {
    const cacheKey = `page-${page}-limit-${limit}`;
    
    // ─── THÊM BIẾN KIỂM TRA ĐANG TÌM KIẾM ───
    const hasSearch = activeSearchQuery.trim() !== ""; 

    // ─── SỬA ĐIỀU KIỆN ĐỌC CACHE: Chỉ đọc cache khi KHÔNG có truy vấn tìm kiếm ───
    if (!hasSearch && !forceRefresh && cachedData[activeTab] && cachedData[activeTab][cacheKey]) {
      const cached = cachedData[activeTab][cacheKey];
      setRows(cached.rows);
      setTotalRecords(cached.totalRecords);
      return;
    }

    setLoading(true);
    try {
      const skip = (page - 1) * limit;
      let url = "";
      
      if (activeTab === "contract") {
        if (activeSearchQuery.trim() !== "") {
          url = `http://127.0.0.1:8000/contracts/search?q=${activeSearchQuery}&skip=${skip}&limit=${limit}`;
        } else {
          url = `http://127.0.0.1:8000/contracts/?skip=${skip}&limit=${limit}`;
        }
      } else {
        if (activeSearchQuery.trim() !== "") {
          url = `http://127.0.0.1:8000/invoices/search?invoice_type=${activeTab}&invoice_code=${activeSearchQuery}&skip=${skip}&limit=${limit}`;
        } else {
          url = `http://127.0.0.1:8000/invoices?invoice_type=${activeTab}&skip=${skip}&limit=${limit}`;
        }
      }

      const response = await fetch(url);
      const data = await response.json();
      
      let items = [];
      let total = 0;
      if (Array.isArray(data)) {
        items = data;
        total = items.length === limit ? page * limit + 1 : (page - 1) * limit + items.length;
      } else {
        items = data.items || [];
        total = data.total || items.length;
      }
      
      setRows(items);
      setTotalRecords(total);
      
      // ─── SỬA ĐIỀU KIỆN LƯU CACHE: Chỉ lưu cache cho danh sách xem thông thường ───
      if (!hasSearch) {
        setCachedData((prev) => ({
          ...prev,
          [activeTab]: {
            ...prev[activeTab],
            [cacheKey]: { rows: items, totalRecords: total }
          }
        }));
      }

      if (items.length === 0 && page > 1) setPage(1);
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
      triggerAlert("Không thể kết nối đến server để lấy dữ liệu.");
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    const handleGlobalClick = () => setShowSuggestions(false);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  // 2. Tự động tải danh sách gợi ý (Autocomplete) từ API search khi người dùng gõ
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      return;
    }
    const handler = setTimeout(async () => {
      try {
        let url = "";
        // Gọi API tương ứng tùy theo lĩnh vực của Tab đang chọn
        if (activeTab === "contract") {
          url = `http://127.0.0.1:8000/contracts/search?q=${searchTerm}&limit=5`;
        } else {
          url = `http://127.0.0.1:8000/invoices/search?invoice_type=${activeTab}&invoice_code=${searchTerm}&limit=5`;
        }
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
        }
      } catch (error) {
        console.error("Lỗi lấy danh sách gợi ý:", error);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm, activeTab]);

  // 3. Hàm xử lý khi người dùng ấn Enter để kích hoạt tìm kiếm cập nhật trực tiếp vào bảng chính
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setShowSuggestions(false);
    setActiveSearchQuery(searchTerm); // Cập nhật query thực tế để gọi tải bảng chính
    setPage(1); // Quay về trang 1
  };

  useEffect(() => {
    fetchInvoices(false);
    setSelectedIds([]);
  }, [activeTab, page, limit, activeSearchQuery])

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleToggleTab = (tabId) => {
    setActiveTab(tabId);
    setPage(1);
    // ─── THÊM THIẾT LẬP LẠI TÌM KIẾM KHI ĐỔI TAB ───
    setSearchTerm("");
    setActiveSearchQuery("");
    setSuggestions([]);
  };

  const handleCheckbox = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleToggleAll = () => {
    if (selectedIds.length === rows.length) setSelectedIds([]);
    else setSelectedIds(rows.map(r => r.id));
  };

  // Làm sạch Cache của Tab đang hoạt động khi Tải lại hoặc Xóa
  const handleRefresh = () => {
    setCachedData((prev) => ({
      ...prev,
      [activeTab]: {}
    }));
    setTimeout(() => {
      fetchInvoices(true);
    }, 100);
  };

  // Xử lý Gửi Form Lập Hợp Đồng Lên Backend
  const handleCreateContractSubmit = async (payload) => {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/contracts/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        triggerAlert("✅ Đã lập hợp đồng và đồng bộ thành công!");
        setCreateModalOpen(false);
        // Làm sạch cache tab contract
        setCachedData((prev) => ({ ...prev, contract: {} }));
        setTimeout(() => fetchInvoices(true), 100);
      } else {
        const errorData = await res.json().catch(() => ({}));
        triggerAlert(`❌ Lập hợp đồng thất bại!\nLý do: ${errorData.detail || "Vui lòng kiểm tra lại thông tin."}`);
      }
    } catch (err) {
      console.error("Lỗi lập hợp đồng:", err);
      triggerAlert("🔌 Lỗi mạng! Không thể kết nối đến máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  const executeDelete = async (id, code) => {
    try {
      let url = "";
      if (activeTab === "contract") {
        url = `http://127.0.0.1:8000/contracts/${id}`;
      } else {
        url = `http://127.0.0.1:8000/invoices/${id}?invoice_type=${activeTab}`;
      }

      const res = await fetch(url, { method: "DELETE" });

      if (res.ok) {
        triggerAlert(`✅ Đã xóa thành công ${activeTab === "contract" ? "hợp đồng" : "hóa đơn"} ${code}!`);
        setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
        
        // Làm sạch cache của Tab đang hoạt động
        setCachedData((prev) => ({
          ...prev,
          [activeTab]: {}
        }));
        
        setTimeout(() => {
          fetchInvoices(true);
        }, 100);
      } else {
        const errorData = await res.json().catch(() => ({}));
        triggerAlert(`❌ Xóa thất bại!\nLý do: ${errorData.detail || "Lỗi không xác định từ máy chủ."}`);
      }
    } catch (error) {
      console.error("Lỗi xóa:", error);
      triggerAlert("🔌 Lỗi mạng! Không thể kết nối đến máy chủ.");
    }
  };

  const handleViewDetail = (row) => {
    if (activeTab === "contract") {
      setContractDetailRecord(row);
    } else {
      setDetailRecord(row);
    }
  };

  // ─── Export Excel (Cập nhật thông minh cho cả Hợp Đồng) ───────────────────────
  const handleExportExcel = async () => {
    const selectedRows = rows.filter(r => selectedIds.includes(r.id));
    if (selectedRows.length === 0) {
      triggerAlert("Vui lòng chọn ít nhất một dòng dữ liệu để xuất!");
      return;
    }

    // Tự động tải thư viện SheetJS qua CDN nếu chưa có sẵn
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
        triggerAlert(e.message);
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();

    if (activeTab === "contract") {
      // Logic xuất file Excel riêng cho Tab HỢP ĐỒNG
      const aoaData = [];
      aoaData.push(["DANH SÁCH HỢP ĐỒNG ĐÃ CHỐT"]);
      
      // Tìm tất cả các key customFields độc nhất của các hợp đồng được chọn
      const cfKeysSet = new Set();
      selectedRows.forEach(row => {
        if (row.customFields) {
          row.customFields.forEach(cf => { if (cf.key) cfKeysSet.add(cf.key); });
        }
      });
      const uniqueCfKeys = Array.from(cfKeysSet);

      const headers = [
        "Mã Hợp Đồng",
        "Ngày Chốt",
        "Hóa đơn NCC",
        "Hóa đơn Khách",
        "Commission (%)",
        "Nego Margin (%)",
        "Supplier Discount",
        "Customer Discount",
        "NA",
        "Lợi Nhuận (Profits)",
        "Tiền Tệ",
        "Người Nhận Bảng Chào",
        "Trạng Thái",
        "Thanh toán Supplier",
        "Thanh toán Khách",
        "Ghi Chú",
        ...uniqueCfKeys
      ];
      aoaData.push(headers);

      selectedRows.forEach(row => {
        const rowData = [
          row.contract_code,
          formatDate(row.date),
          row.supplier_invoice?.invoice_code || "N/A",
          row.client_invoice?.invoice_code || "N/A",
          row.commission || 0,
          row.nego_margin || 0,
          row.supplier_discount || 0,
          row.customer_discount || 0,
          row.na_col || 0,
          row.profits || 0,
          row.currency || "VND",
          row.receiver || "N/A",
          row.status || "N/A",
          row.payment_status_supplier || "N/A",
          row.payment_status_customer || "N/A",
          row.note || ""
        ];

        // Điền các cột trường tùy chỉnh động
        uniqueCfKeys.forEach(key => {
          const cf = (row.customFields || []).find(f => f.key === key);
          rowData.push(cf ? String(cf.value) : "-");
        });

        aoaData.push(rowData);
      });

      const ws = XLSX.utils.aoa_to_sheet(aoaData);
      XLSX.utils.book_append_sheet(wb, ws, "HopDong");
      XLSX.writeFile(wb, `Export_Contracts_${Date.now()}.xlsx`);

    } else {
      // Duyệt qua từng hóa đơn đã chọn để tạo một Sheet tương ứng (Nhà cung cấp / Khách hàng)
      selectedRows.forEach(row => {
        const codeVal = row.invoice_code || row.quotation_id || row.code;
        const itemsAmount = calcTotalItemsAmount(row.items);
        
        const partnerName = activeTab === "client"
          ? (row.client_name || row.client?.name || "N/A")
          : (row.supplier_name || row.supplier?.name || "N/A");
          
        const clientVal = activeTab === "client" ? "Công ty của bạn" : (row.client || "N/A");
        const totalCIFVal = row.total_amount_CIF || row.total_amount || 0;

        const aoaData = [];
        
        aoaData.push(["THÔNG TIN HÓA ĐƠN / BÁO GIÁ"]);
        aoaData.push(["Mã Số", codeVal]);
        aoaData.push(["Ngày lập", row.date || "-"]);
        aoaData.push([activeTab === "client" ? "Khách hàng" : "Nhà cung cấp", partnerName]);
        aoaData.push([activeTab === "client" ? "Người lập" : "Khách mua (Client)", clientVal]);
        aoaData.push(["Tổng CIF", totalCIFVal, row.currency || "USD"]);
        aoaData.push(["Tổng tiền sản phẩm", itemsAmount, row.currency || "USD"]);
        aoaData.push(["Phương thức thanh toán", row.payment_method || "N/A"]);
        aoaData.push(["Trạng thái", row.status || "-"]);
        
        if (row.note && row.note !== "no info" && row.note !== "No note exists") {
          aoaData.push(["Ghi chú hóa đơn", row.note]);
        }
        
        aoaData.push([]);
        aoaData.push(["DANH SÁCH SẢN PHẨM"]);
        
        const extraDataKeys = getExtraDataKeys(row.items);
        const customFieldKeys = getCustomFieldKeys(row.items);
        
        const tableHeaders = [
          "STT", 
          "Mã SP", 
          "Đơn giá", 
          "SL (PCS)", 
          ...extraDataKeys.map(k => getShortKey(k)), 
          ...customFieldKeys.map(k => getShortKey(k)), 
          "Thành tiền", 
          "Ghi chú sản phẩm"
        ];
        aoaData.push(tableHeaders);
        
        const items = row.items 
        ? [...row.items].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0)) 
        : [];
        items.forEach((item, idx) => {
          const basePrice = Number(item.base_price) || 0;
          const qty = Number(item.quantity) || 0;
          const thanhTien = basePrice * qty;
          
          const rowData = [
            idx + 1,
            item.product_code || "-",
            basePrice,
            qty,
          ];
          
          extraDataKeys.forEach(key => {
            rowData.push(item.extra_data?.[key] ?? "-");
          });
          
          customFieldKeys.forEach(key => {
            const cf = (item.customFields || []).find(f => f.key === key);
            const val = getDisplayValue(cf?.value, item);
            rowData.push(val === true ? "Có" : val === false ? "Không" : (val ?? "-"));
          });
          
          rowData.push(thanhTien);
          rowData.push(item.note && item.note !== "no info" ? item.note : "-");
          
          aoaData.push(rowData);
        });
        
        const totalRow = ["Tổng cộng", "", "", items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)];
        
        extraDataKeys.forEach(key => {
          let total = 0;
          let isNumeric = false;
          items.forEach((it) => {
            const valStr = it.extra_data?.[key];
            if (valStr !== undefined && valStr !== null && valStr !== "") {
              const parsed = typeof valStr === "number" ? valStr : Number(String(valStr).replace(/,/g, ""));
              if (!isNaN(parsed)) {
                total += parsed;
                isNumeric = true;
              }
            }
          });
          totalRow.push(isNumeric ? total : "");
        });
        
        customFieldKeys.forEach(() => totalRow.push(""));
        totalRow.push(itemsAmount);
        
        aoaData.push(totalRow);
        
        const ws = XLSX.utils.aoa_to_sheet(aoaData);
        XLSX.utils.book_append_sheet(wb, ws, getSafeSheetName(codeVal));
      });

      const codes = selectedRows.map(r => r.invoice_code || r.quotation_id || r.code);
      const fileName = `Export_${codes.join("_")}.xlsx`;
      XLSX.writeFile(wb, fileName);
    }
  };

  // ─── Render Math ──────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
  const isAllChecked = rows.length > 0 && selectedIds.length === rows.length;

  return (
    <div style={S.app}>
      <main style={S.main}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#2d2d2d", margin: 0 }}>
            Quản lý dữ liệu <span style={{ fontSize: 20 }}>🩷</span>
          </h1>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <div style={{ width: 38, height: 38, background: "#fff", border: "1.5px solid #fce4ec", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Bell size={17} color="#bdbdbd" /></div>
            <div style={{ width: 38, height: 38, background: "linear-gradient(135deg, #ffd6e7, #ffb3cc)", borderRadius: 10, border: "1.5px solid #fce4ec", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, cursor: "pointer" }}>🐰</div>
          </div>
        </div>

        {/* Tab Navigator */}
        <div style={S.tabBox}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} style={S.tabBtn(activeTab === tab.id)} onClick={() => handleToggleTab(tab.id)}>
                <Icon size={16} /> {tab.label}
              </button>
            )
          })}
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button style={S.btnOutline}><Filter size={14} /> Bộ lọc</button>
          <button style={S.btnOutline} onClick={handleRefresh}><RefreshCw size={14} /> Tải lại</button>
          
          {/* ─── BỔ SUNG KHỐI INPUT TÌM KIẾM & DROPDOWN GỢI Ý TẠI ĐÂY ─── */}
          <div style={{ position: "relative", width: 320 }} onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSearchSubmit} style={{ display: "flex", width: "100%" }}>
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  type="text"
                  placeholder={
                    activeTab === "contract" 
                      ? "Tìm mã HĐ, hóa đơn chốt, đối tác, SP..." 
                      : activeTab === "supplier"
                        ? "Tìm mã HĐ NCC, NCC, Khách, mã SP..."
                        : "Tìm mã HĐ Khách, Khách, NCC, mã SP..."
                  }
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  style={{
                    width: "100%",
                    height: 36,
                    border: "1.5px solid #fce4ec",
                    borderRadius: 10,
                    padding: "0 32px 0 12px",
                    fontSize: 12,
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
                <Search size={14} style={{ position: "absolute", right: 10, top: 11, color: "#f06292" }} />
              </div>
            </form>

            {/* Dropdown danh sách gợi ý hiển thị linh hoạt theo từng loại Tab */}
            {showSuggestions && suggestions.length > 0 && (
              <div 
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "#fff",
                  border: "1.5px solid #fce4ec",
                  borderRadius: 10,
                  marginTop: 6,
                  boxShadow: "0 10px 25px rgba(255,107,157,0.15)",
                  zIndex: 999,
                  maxHeight: 200,
                  overflowY: "auto"
                }}
              >
                {suggestions.map((item) => {
                  // Xác định nhãn hiển thị tùy thuộc vào loại dữ liệu trong gợi ý
                  const displayCode = activeTab === "contract" ? item.contract_code : item.invoice_code;
                  
                  const displayPartner = activeTab === "contract"
                    ? (item.client_invoice?.client_name || item.supplier_invoice?.supplier_name || "Hợp đồng")
                    : activeTab === "client" 
                      ? (item.client_name || "N/A") 
                      : (item.supplier_name || "N/A");

                  return (
                    <div
                      key={item.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowSuggestions(false);
                        // Kích hoạt xem chi tiết đúng loại Modal (Modal hợp đồng hoặc Modal hóa đơn)
                        handleViewDetail(item);
                      }}
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        cursor: "pointer",
                        borderBottom: "1px solid #FFF0F5",
                        textAlign: "left"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#FFF0F5"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                    >
                      <strong style={{ color: "#e91e8c" }}>{displayCode}</strong> - {displayPartner}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {activeTab === "contract"  && (
            <button 
              style={S.btnPrimary} 
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus size={15} /> Lập hợp đồng mới
            </button>
          )}

          {selectedIds.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", height: 36, padding: "0 14px", background: "#fff0f5", border: "1.5px solid #fce4ec", borderRadius: 10, color: "#f06292", fontSize: 13, fontWeight: 600 }}>
              Đã chọn {selectedIds.length} dòng
            </div>
          )}

          <button 
            onClick={handleExportExcel} 
            disabled={selectedIds.length === 0}
            style={{
              marginLeft: "auto", 
              display: "flex", 
              alignItems: "center", 
              gap: 6, 
              height: 36, 
              padding: "0 14px", 
              background: "#fff", 
              border: selectedIds.length > 0 ? "1.5px solid #43a047" : "1.5px solid #ccc", 
              borderRadius: 10, 
              color: selectedIds.length > 0 ? "#43a047" : "#aaa", 
              fontSize: 13, 
              fontWeight: 700, 
              cursor: selectedIds.length > 0 ? "pointer" : "not-allowed",
              opacity: selectedIds.length > 0 ? 1 : 0.5,
              transition: "all 0.2s"
            }}
          >
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
        </div>

        {/* Table Area */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #fce4ec", overflow: "hidden", position: "relative" }}>
          
          {loading && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.6)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
              <span style={{ background: "#FFE4EE", padding: "8px 20px", borderRadius: 20, color: "#e91e8c", fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}>
                <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }}/> Đang tải dữ liệu...
              </span>
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1200 }}>
              <thead>
                {activeTab === "contract" ? (
                  // Headers dành riêng cho TAB HỢP ĐỒNG
                  <tr>
                    <th style={{ ...S.th, width: 40, textAlign: "center" }}>
                      <input type="checkbox" checked={isAllChecked} onChange={handleToggleAll} style={{ accentColor: "#e91e8c", cursor: "pointer" }} />
                    </th>
                    <th style={S.th}>STT</th>
                    <th style={S.th}>Ngày chốt</th>
                    <th style={S.th}>Mã Hợp Đồng</th>
                    <th style={S.th}>Mã hóa đơn NCC</th>
                    <th style={S.th}>Mã hóa đơn Khách</th>
                    <th style={S.th}>Commission (%)</th>
                    <th style={S.th}>Nego margin (%)</th>
                    <th style={S.th}>Supplier discount</th>
                    <th style={S.th}>Customer discount</th>
                    <th style={S.th}>NA</th>
                    <th style={S.th}>Lợi Nhuận (Profits)</th>
                    <th style={S.th}>Người nhận bảng chào</th>
                    <th style={S.th}>Trạng thái hợp đồng</th>
                    <th style={S.th}>Thanh toán Supplier</th>
                    <th style={S.th}>Thanh toán Khách</th>
                    <th style={S.th}>Chi tiết</th>
                    <th style={S.th}>Thao tác</th>
                  </tr>
                ) : (
                  // Headers dành cho TAB HÓA ĐƠN (NCC hoặc Khách Hàng)
                  <tr>
                    <th style={{ ...S.th, width: 40, textAlign: "center" }}>
                      <input type="checkbox" checked={isAllChecked} onChange={handleToggleAll} style={{ accentColor: "#e91e8c", cursor: "pointer" }} />
                    </th>
                    <th style={S.th}>STT</th>
                    <th style={S.th}>Ngày lập</th>
                    <th style={S.th}>Mã hóa đơn / Báo giá</th>
                    {activeTab === "supplier" ? (
                      <th style={S.th}>Nhà cung cấp</th>
                    ) : (
                      <th style={S.th}>Khách hàng</th>
                    )}
                    <th style={S.th}>Tổng CIF</th>
                    <th style={S.th}>Tổng tiền SP</th>
                    <th style={S.th}>Thanh toán</th>
                    <th style={S.th}>Chi tiết</th>
                    <th style={S.th}>Thao tác</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={18} style={{ textAlign: "center", padding: "40px 0", color: "#888", fontSize: 13 }}>
                      📭 Không có dữ liệu nào trong mục này.
                    </td>
                  </tr>
                ) : activeTab === "contract" ? (
                  // RENDER THÔNG TIN BẢNG HỢP ĐỒNG
                  rows.map((row, idx) => {
                    const stt = (page - 1) * limit + idx + 1;
                    
                    const paymentStatusLabel = (status) => {
                      if (status === "paid") return { label: "Đã thanh toán", bg: "#E8F5E9", color: "#388E3C" };
                      if (status === "paid 50%") return { label: "Thanh toán 50%", bg: "#FFF8E1", color: "#F57C00" };
                      return { label: "Chưa thanh toán", bg: "#FFEBEE", color: "#C62828" };
                    };
                    const pStatusSupplier = paymentStatusLabel(row.payment_status_supplier);
                    const pStatusCustomer = paymentStatusLabel(row.payment_status_customer);
 
                    return (
                      <tr key={row.id} style={{ background: idx % 2 !== 0 ? "#FFFAFC" : "white", transition: "background 0.12s" }} onMouseEnter={e => e.currentTarget.style.filter = "brightness(0.97)"} onMouseLeave={e => e.currentTarget.style.filter = "none"}>
                        <td style={{ ...S.td, textAlign: "center" }}>
                          <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => handleCheckbox(row.id)} style={{ accentColor: "#e91e8c", cursor: "pointer" }} />
                        </td>
                        <td style={S.td}>{stt}</td>
                        <td style={S.td}>{formatDate(row.date)}</td>
                        <td style={{ ...S.td, color: "#e91e8c", fontWeight: 700 }}>{row.contract_code}</td>
                        <td style={{ ...S.td, color: "#1565C0", fontWeight: 600 }}>{row.supplier_invoice?.invoice_code || "N/A"}</td>
                        <td style={{ ...S.td, color: "#7B1FA2", fontWeight: 600 }}>{row.client_invoice?.invoice_code || "N/A"}</td>
                        <td style={S.td}>{row.commission || 0}%</td>
                        <td style={S.td}>{row.nego_margin || 0}%</td>
                        <td style={S.td}>{row.supplier_discount !== null && row.supplier_discount !== undefined ? row.supplier_discount : 0}</td>
                        <td style={S.td}>{row.customer_discount !== null && row.customer_discount !== undefined ? row.customer_discount : 0}</td>
                        <td style={S.td}>{row.na_col !== null && row.na_col !== undefined ? row.na_col : 0}</td>
                        <td style={{ ...S.td, fontWeight: 700, color: row.currency === "Không thống nhất" ? "#D32F2F" : "#2E7D32" }}>
                          {row.currency === "Không thống nhất" 
                            ? "Không thống nhất tiền tệ" 
                            : fmtCurrency(row.profits, row.currency)}
                        </td>
                        <td style={S.td}>{row.receiver || "N/A"}</td>
                        <td style={S.td}><span style={{ background: "#EDE7FF", color: "#7B61FF", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700 }}>{row.status || "N/A"}</span></td>
                        <td style={S.td}><span style={{ background: pStatusSupplier.bg, color: pStatusSupplier.color, padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700 }}>{pStatusSupplier.label}</span></td>
                        <td style={S.td}><span style={{ background: pStatusCustomer.bg, color: pStatusCustomer.color, padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700 }}>{pStatusCustomer.label}</span></td>
                        <td style={S.td}>
                          <button onClick={() => handleViewDetail(row)} style={S.btnDetail} title="Xem chi tiết hợp đồng">
                            🔍 So sánh hóa đơn
                          </button>
                        </td>
                        <td style={{ ...S.td, textAlign: "center" }}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerConfirm(
                                <span>
                                  Bạn có chắc chắn muốn xóa hợp đồng <strong style={{ color: "#e91e8c" }}>{row.contract_code}</strong> không?
                                  <br />
                                  <span style={{ display: "inline-block", marginTop: 8, color: "#D32F2F" }}>
                                    Hành động này sẽ không làm mất các hóa đơn gốc bên trong nhưng sẽ <strong>xóa vĩnh viễn cấu trúc liên kết hợp đồng này</strong>!
                                  </span>
                                </span>,
                                () => executeDelete(row.id, row.contract_code),
                                null,
                                "Xác nhận xóa hợp đồng ⚠️"
                              );
                            }}
                            title="Xóa"
                            style={{ background: "#FFEBEE", border: "1px solid #FFCDD2", color: "#D32F2F", borderRadius: 6, width: 30, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  // RENDER THÔNG TIN BẢNG HÓA ĐƠN
                  rows.map((row, idx) => {
                    const stt = (page - 1) * limit + idx + 1;
                    const itemsAmount = calcTotalItemsAmount(row.items);
                    const codeVal = row.invoice_code || row.quotation_id || row.code;
                    
                    const partnerName = (row.supplier_name || row.supplier?.name || "N/A");
                    const clientVal = (row.client_name || row.client || "N/A") ;
                    
                    return (
                      <tr key={row.id} style={{ background: idx % 2 !== 0 ? "#FFFAFC" : "white", transition: "background 0.12s" }} onMouseEnter={e => e.currentTarget.style.filter = "brightness(0.97)"} onMouseLeave={e => e.currentTarget.style.filter = "none"}>
                        <td style={{ ...S.td, textAlign: "center" }}>
                          <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => handleCheckbox(row.id)} style={{ accentColor: "#e91e8c", cursor: "pointer" }} />
                        </td>
                        <td style={S.td}>{stt}</td>
                        <td style={S.td}>{row.date}</td>
                        <td style={{ ...S.td, color: "#e91e8c", fontWeight: 700 }}>{codeVal}</td>
                        {activeTab === "supplier" ? (
                          <td style={{ ...S.td, maxWidth: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={partnerName}>{partnerName}</td>
                        ) : (
                          <td style={{ ...S.td, maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={clientVal}>{clientVal}</td>
                        )}
                        <td style={{ ...S.td, fontWeight: 700 }}>{fmtCurrency(row.total_amount_CIF, row.currency)}</td>
                        <td style={{ ...S.td, fontWeight: 700, color: "#1565C0" }}>{fmtCurrency(itemsAmount, row.currency)}</td>
                        <td style={{ ...S.td, maxWidth: 100, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={row.payment_method}><span style={{ background: "#E3F2FD", color: "#1565C0", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>{row.payment_method || "N/A"}</span></td>
                        <td style={S.td}>
                          <button onClick={() => handleViewDetail(row)} style={S.btnDetail} title="Xem chi tiết sản phẩm">
                            🔍 {row.items?.length > 0 ? `${row.items.length} SP` : "Xem"}
                          </button>
                        </td>
                        <td style={{ ...S.td, textAlign: "center" }}>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              triggerConfirm(
                                <span>
                                  Bạn có chắc chắn muốn xóa hóa đơn <strong style={{ color: "#e91e8c" }}>{codeVal}</strong> không?
                                  <br />
                                  <span style={{ display: "inline-block", marginTop: 8 }}>
                                    Hành động này sẽ <strong style={{ color: "#D32F2F" }}>xóa luôn toàn bộ sản phẩm liên quan</strong> bên trong và <strong style={{ color: "#D32F2F" }}>không thể hoàn tác</strong>!
                                  </span>
                                </span>,
                                () => executeDelete(row.id, codeVal),
                                null,
                                "Xác nhận xóa dữ liệu ⚠️"
                              );
                            }}
                            title="Xóa" 
                            style={{ background: "#FFEBEE", border: "1px solid #FFCDD2", color: "#D32F2F", borderRadius: 6, width: 30, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "13px 16px", borderTop: "1px solid #fff0f5", fontSize: 13, color: "#757575" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Hiển thị
              <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} style={{ height: 28, border: "1.5px solid #fce4ec", borderRadius: 8, padding: "0 6px", fontSize: 12, outline: "none", background: "#fff8fa", fontFamily: "inherit" }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              dòng / trang
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4, margin: "0 auto" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ background: "none", border: "none", color: page === 1 ? "#ccc" : "#f48fb1", cursor: page === 1 ? "not-allowed" : "pointer", padding: "4px 5px" }}>
                <ChevronLeft size={16} />
              </button>
              
              {generatePagination(page, totalPages).map((p, i) => (
                <PageBtn key={i} page={p} active={p === page} onClick={() => typeof p === "number" && setPage(p)} />
              ))}
              
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ background: "none", border: "none", color: page >= totalPages ? "#ccc" : "#f48fb1", cursor: page >= totalPages ? "not-allowed" : "pointer", padding: "4px 5px" }}>
                <ChevronRight size={16} />
              </button>
            </div>

            <div style={{ marginLeft: "auto", fontSize: 13, color: "#9e9e9e" }}>
              Tổng {totalRecords} bản ghi
            </div>
          </div>
        </div>

        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </main>
      
      {/* Component Modal Chi Tiết Hóa Đơn */}
      <InvoiceDetailModal record={detailRecord} onClose={() => setDetailRecord(null)} activeTab={activeTab} onSaveSuccess={handleRefresh} />
      
      {/* Component Modal Chi Tiết Hợp Đồng */}
      <ContractDetailModal record={contractDetailRecord} onClose={() => setContractDetailRecord(null)} onSaveSuccess={handleRefresh} />
      
      {/* Component Modal Lập Hợp Đồng Mới */}
      <CreateContractModal 
        isOpen={createModalOpen} 
        onClose={() => setCreateModalOpen(false)} 
        onSubmit={handleCreateContractSubmit} 
        triggerAlert={triggerAlert}
      />

      <CustomNotificationModal config={notification} onClose={() => setNotification(null)} />
    </div>
  );
}
