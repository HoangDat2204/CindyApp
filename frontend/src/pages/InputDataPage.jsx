import React, { useState, useEffect, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCY_CONFIG = {
  VND: { locale: "vi-VN", symbol: "đ", symbolBefore: false, decimals: 0 },
  USD: { locale: "en-US", symbol: "$", symbolBefore: true, decimals: 2 },
  EUR: { locale: "de-DE", symbol: "€", symbolBefore: false, decimals: 2 },
  JPY: { locale: "ja-JP", symbol: "¥", symbolBefore: true, decimals: 0 },
  CNY: { locale: "zh-CN", symbol: "¥", symbolBefore: true, decimals: 2 },
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
        width: 360,
        textAlign: "center",
        border: "1.5px solid #FFE0EB",
        boxShadow: "0 20px 60px rgba(255,107,157,0.2)"
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          {/* SVG Bunny dễ thương */}
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

const PAYMENT_METHODS = ["ADVANCE", "L/C", "T/T", "D/P", "D/A", "O/A", "Khác", "30 DAYS FROM BL/AWB"]; 
const INVOICE_STATUSES = ["verified", "pending", "rejected", "draft"];
const INVOICE_SOURCES = ["supplier", "customer", "internal"];
const FIELD_TYPES = [
  { value: "text", label: "Văn bản (Text)" },
  { value: "number", label: "Số (Number)" },
  { value: "date", label: "Ngày (Date)" },
  { value: "boolean", label: "Có/Không (Boolean)" },
];

const fmtCurrency = (n, currency = "VND") => {
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.VND;
  const formatted = Number(n).toLocaleString(cfg.locale, {
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals,
  });
  return cfg.symbolBefore ? `${cfg.symbol}${formatted}` : `${formatted} ${cfg.symbol}`;
};

const statusColor = (s) => ({
  verified: { bg: "#E8F5E9", color: "#388E3C" },
  pending:  { bg: "#FFF8E1", color: "#F57C00" },
  rejected: { bg: "#FFEBEE", color: "#C62828" },
  draft:    { bg: "#F3E5F5", color: "#7B1FA2" },
}[s] || { bg: "#F5F5F5", color: "#888" });

// Tính tổng tiền sản phẩm (Σ base_price * quantity)
const calcTotalItemsAmount = (items) => {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((sum, it) => {
    const price = Number(it.base_price) || 0;
    const qty = Number(it.quantity) || 0;
    return sum + (price * qty);
  }, 0);
};



// Trích xuất tất cả các keys độc nhất có trong extra_data của danh sách items
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

const getShortKey = (key) => {
  if (!key) return "";
  const parts = key.split(" - ");
  return parts[parts.length - 1] || key;
};

// ─── Initial demo data ────────────────────────────────────────────────────────

const initialData = [];

// HÀM MỚI: Đánh giá và thực thi công thức dạng Excel
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
    
    // Nếu là chuỗi, kiểm tra có phải là số chứa dấu phẩy phân cách không
    if (typeof val === "string") {
      const stripped = val.replace(/,/g, ""); // Xóa dấu phẩy phân cách hàng nghìn
      if (!isNaN(Number(stripped)) && stripped.trim() !== "") {
        return stripped; // Trả về số sạch để tính toán
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

// COMPONENT MỚI: Gợi ý các tên trường có sẵn khi gõ dấu '{'
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

// COMPONENT MỚI: Ô nhập liệu thông minh tích hợp Formula & Gợi ý trường
// SỬA ĐỔI: Thêm prop onRealTimeChange để đồng bộ hóa giá trị liên tục khi đang gõ
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
    if (onChange) onChange(cleanValue); // Gọi khi blur -> Kích hoạt prompt hỏi áp dụng hàng loạt
  };

  const handleChange = (e) => {
    let val = e.target.value;
    if (type === "number" && !val.startsWith("=")) {
      val = val.replace(/[^0-9.,-]/g, "");
    }
    setLocalValue(val);
    if (onRealTimeChange) onRealTimeChange(val); // Đồng bộ thời gian thực lên thanh công thức (không hiện prompt)
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
            if (onRealTimeChange) onRealTimeChange(newVal); // Cập nhật ngay khi chọn từ menu gợi ý
          }} 
        />
      )}
    </div>
  );
}

// ─── Default form state ───────────────────────────────────────────────────────
function LoadingOverlay({ isSaving }) {
  if (!isSaving) return null;

  return (
    <div style={styles.loadingOverlay}>
      <div style={styles.loadingBox}>
        <div style={{ animation: "bounce 0.6s infinite alternate", marginTop: 10 }}>
          <BunnyIcon size={70} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
          <div style={styles.spinner}></div>
          <span style={{ color: "#e91e8c", fontWeight: 700, fontSize: 16 }}>
            Đang lưu xuống Database... 🌸
          </span>
        </div>
      </div>
      <style>
        {`
          @keyframes bounce {
            0% { transform: translateY(0); }
            100% { transform: translateY(-15px); }
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

const defaultForm = () => ({
  date: "", code: "", supplier: "", customer: "",
  totalCIF: "", currency: "USD",
  paymentMethod: "ADVANCE", invoiceSource: "supplier",
  status: "pending", note: "",
  _items: [], customFields: [],
  _ocrFilename: "",
  client_pdf_file_path: null,
  supplier_pdf_file_path: null,
});

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const BunnyIcon = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
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
);

const HeartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#FF8FA3">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

const UploadIcon = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#FF8FA3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

// ─── Custom Field Adder ───────────────────────────────────────────────────────

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
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modalBox, width: 380, padding: "24px 28px" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>➕ Thêm trường tùy chỉnh</h3>
          <button onClick={onClose} style={styles.modalClose}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={styles.labelSm}>Tên trường *</label>
            <input value={fieldName} onChange={(e) => setFieldName(e.target.value)}
              placeholder="Vd: Số container, Cảng đến..." style={{ ...styles.input, marginTop: 6 }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()} autoFocus />
          </div>
          <div>
            <label style={styles.labelSm}>Kiểu dữ liệu *</label>
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
          <button onClick={onClose} style={styles.btnGhost}>Hủy</button>
          <button onClick={handleSubmit} style={styles.btnPrimary}>Thêm trường</button>
        </div>
      </div>
    </div>
  );
}

// ─── Custom fields renderer (invoice-level) ───────────────────────────────────

function CustomFieldsBlock({ fields, onChange, context }) {
  const [showDialog, setShowDialog] = useState(false);

  const handleAdd = (newField) => onChange([...fields, newField]);
  const handleRemove = (idx) => onChange(fields.filter((_, i) => i !== idx));
  const handleChange = (idx, val) => onChange(fields.map((f, i) => i === idx ? { ...f, value: val } : f));

  const renderInput = (f, idx) => {
    if (f.type === "boolean")
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={!!f.value} onChange={(e) => handleChange(idx, e.target.checked)} style={{ accentColor: "#e91e8c", width: 16, height: 16 }} />
          <span style={{ fontSize: 13, color: f.value ? "#388E3C" : "#888" }}>{f.value ? "Có" : "Không"}</span>
        </label>
      );
    return (
      <FormulaInput
        value={f.value ?? ""}
        onChange={(val) => handleChange(idx, val)}
        placeholder={`Nhập ${f.key}...`}
        style={styles.input}
        type={f.type}
        context={context}
      />
    );
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={() => setShowDialog(true)} style={styles.btnAddCustom}>+ Thêm trường</button>
      </div>
      {fields.length > 0 && (
        <div style={styles.customFieldsGrid}>
          {fields.map((f, idx) => (
            <div key={idx} style={{ position: "relative" }}>
              <label style={{ ...styles.labelSm, display: "flex", alignItems: "center", gap: 6 }}>
                {f.key}
                <span style={{ fontSize: 10, background: "#EDE7FF", color: "#7B61FF", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>{f.type}</span>
              </label>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
                <div style={{ flex: 1 }}>{renderInput(f, idx)}</div>
                <button onClick={() => handleRemove(idx)} style={{ background: "#FFF0F0", border: "none", borderRadius: 6, width: 28, height: 28, cursor: "pointer", color: "#E53935", fontSize: 14, flexShrink: 0 }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {showDialog && <AddCustomFieldDialog onAdd={handleAdd} onClose={() => setShowDialog(false)} />}
    </div>
  );
}

// ─── Blank item template (Dynamic) ──────────────────────────────────────────

const blankItem = (extraKeys = []) => {
  const extra_data = {};
  extraKeys.forEach((key) => {
    extra_data[key] = "";
  });
  return {
    product_code: "", base_price: "", quantity: "", note: null,
    extra_data,
    customFields: [],
  };
};

// ─── Items Editor (Dynamic Extra Data) ──────────────────────────────────────

function ItemsEditor({ items, onChange, triggerConfirm }) { // <-- THÊM triggerConfirm ở đây
  const [showCustomDialog, setShowCustomDialog] = useState(null);
  const [itemCustomCols, setItemCustomCols] = useState([]);

  React.useEffect(() => {
    if (!items || items.length === 0) {
      setItemCustomCols([]);
      return;
    }
    const keysSet = new Set(itemCustomCols.map((c) => c.key));
    const newCols = [];
    items.forEach((item) => {
      if (item.customFields && Array.isArray(item.customFields)) {
        item.customFields.forEach((cf) => {
          if (cf.key && !keysSet.has(cf.key)) {
            keysSet.add(cf.key);
            newCols.push({ key: cf.key, type: cf.type || "text" });
          }
        });
      }
    });
    if (newCols.length > 0) {
      setItemCustomCols((prev) => {
        const prevKeys = new Set(prev.map(c => c.key));
        const filteredNew = newCols.filter(c => !prevKeys.has(c.key));
        if (filteredNew.length === 0) return prev;
        return [...prev, ...filteredNew];
      });
    }
  }, [items]);

  const [selectedCell, setSelectedCell] = useState(null); // { rowIndex, fieldKey, isCustom, isExtra }
  const [barInputVal, setBarInputVal] = useState("");
  const [isBarFocused, setIsBarFocused] = useState(false);

  
  const extraDataKeys = getExtraDataKeys(items);
  
  const handleCustomFieldSingle = (itemIdx, colKey, value) => {
    onChange(items.map((item, i) => {
      if (i !== itemIdx) return item;
      const existing = (item.customFields || []).filter((f) => f.key !== colKey);
      const colInfo = itemCustomCols.find((c) => c.key === colKey);
      const colType = colInfo ? colInfo.type : "text";
      return { 
        ...item, 
        customFields: [...existing, { key: colKey, type: colType, value }] 
      };
    }));
  };

  const getSelectedCellValue = React.useCallback(() => {
    if (!selectedCell) return "";
    const { rowIndex, fieldKey, isCustom, isExtra } = selectedCell;
    const item = items[rowIndex];
    if (!item) return "";
    if (isCustom) {
      const cf = (item.customFields || []).find((f) => f.key === fieldKey);
      return cf?.value ?? "";
    }
    if (isExtra) {
      return item.extra_data?.[fieldKey] ?? "";
    }
    return item[fieldKey] ?? "";
  }, [selectedCell, items]);

  const currentCellValue = getSelectedCellValue();

  // Đồng bộ giá trị thực của ô lên thanh công thức khi đổi ô hoặc đổi dữ liệu
  React.useEffect(() => {
    if (!isBarFocused) {
      setBarInputVal(currentCellValue);
    }
  }, [currentCellValue, isBarFocused]);

  // Xử lý khi gõ trên thanh công thức (Cập nhật real-time xuống ô dưới bảng)
  const handleFormulaBarChange = (e) => {
    if (!selectedCell) return;
    const val = e.target.value;
    setBarInputVal(val);

    const { rowIndex, fieldKey, isCustom, isExtra } = selectedCell;
    if (isCustom) {
      handleCustomFieldSingle(rowIndex, fieldKey, val);
    } else if (isExtra) {
      handleExtraDataField(rowIndex, fieldKey, val);
    } else {
      handleField(rowIndex, fieldKey, val);
    }
  };

  // Chỉ hỏi áp dụng hàng loạt khi rời khỏi (blur) thanh công thức
  const handleFormulaBarBlur = () => {
    setIsBarFocused(false);
    if (!selectedCell) return;
    const { rowIndex, fieldKey, isCustom } = selectedCell;

    if (isCustom && items.length > 1) {
      const currentValue = getSelectedCellValue();
      
      // KIỂM TRA: Nếu là công thức (chứa dấu '=') thì mới kích hoạt Confirm
      const hasFormula = typeof currentValue === "string" && currentValue.includes("=");

      const applyUpdates = () => {
        onChange(items.map((item) => {
          const existing = (item.customFields || []).filter((f) => f.key !== fieldKey);
          const colInfo = itemCustomCols.find((c) => c.key === fieldKey);
          const colType = colInfo ? colInfo.type : "text";
          return { 
            ...item, 
            customFields: [...existing, { key: fieldKey, type: colType, value: currentValue }] 
          };
        }));
      };

      if (hasFormula) {
        if (triggerConfirm) {
          triggerConfirm(
            `Bạn có muốn áp dụng công thức này cho tất cả các sản phẩm ở cột "${getLabel(fieldKey)}" không?`,
            applyUpdates,
            () => {} // Hủy -> Giữ nguyên thay đổi đơn lẻ đã gõ
          );
        } else {
          const applyToAll = window.confirm(`Bạn có muốn áp dụng công thức này cho tất cả các sản phẩm ở cột "${getLabel(fieldKey)}" không?`);
          if (applyToAll) applyUpdates();
        }
      }
      // Nếu không chứa dấu '=', hệ thống tự lưu đơn lẻ âm thầm (đã được handle ở bước RealTime)
    }
  };


  const handleField = (idx, field, value) => {
    onChange(items.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, [field]: value };
    }));
  };

  const handleExtraDataField = (idx, key, value) => {
    onChange(items.map((item, i) => {
      if (i !== idx) return item;
      return {
        ...item,
        extra_data: {
          ...(item.extra_data || {}),
          [key]: value,
        },
      };
    }));
  };

  const handleCustomField = (itemIdx, colKey, value) => {
    const doUpdate = (applyToAll) => {
      onChange(items.map((item, i) => {
        if (!applyToAll && i !== itemIdx) return item;

        const existing = (item.customFields || []).filter((f) => f.key !== colKey);
        const colInfo = itemCustomCols.find((c) => c.key === colKey);
        const colType = colInfo ? colInfo.type : "text";

        return { 
          ...item, 
          customFields: [...existing, { key: colKey, type: colType, value }] 
        };
      }));
    };

    // KIỂM TRA: Nếu ô có chứa dấu '=' thì mới kích hoạt Confirm
    const hasFormula = typeof value === "string" && value.includes("=");

    if (items.length > 1 && hasFormula) {
      if (triggerConfirm) {
        triggerConfirm(
          `Bạn có muốn áp dụng công thức này cho tất cả các sản phẩm ở cột "${getLabel(colKey)}" không?`,
          () => doUpdate(true),
          () => doUpdate(false)
        );
      } else {
        const applyToAll = window.confirm(
          `Bạn có muốn áp dụng công thức này cho tất cả các sản phẩm ở cột "${getLabel(colKey)}" không?`
        );
        doUpdate(applyToAll);
      }
    } else {
      // Nếu rỗng hoặc không có dấu '=', tự động cập nhật đơn lẻ ngay lập tức
      doUpdate(false);
    }
  };

  const handleAddCustomCol = (newField) => {
    setItemCustomCols([...itemCustomCols, newField]);
    onChange(items.map((item) => ({
      ...item,
      customFields: [...(item.customFields || []), { key: newField.key, type: newField.type, value: newField.type === "boolean" ? false : "" }],
    })));
  };

  const handleRemoveCustomCol = (colKey) => {
    setItemCustomCols(itemCustomCols.filter((c) => c.key !== colKey));
    onChange(items.map((item) => ({ ...item, customFields: (item.customFields || []).filter((f) => f.key !== colKey) })));
  };

  const handleRemoveExtraCol = (colKey) => {
    onChange(items.map((item) => {
      const updatedExtra = { ...item.extra_data };
      delete updatedExtra[colKey];
      return { ...item, extra_data: updatedExtra };
    }));
  };

  const handleAddRow = () => {
    const newItem = blankItem(extraDataKeys);
    newItem.customFields = itemCustomCols.map((c) => ({ key: c.key, type: c.type, value: c.type === "boolean" ? false : "" }));
    onChange([...items, newItem]);
  };

  const handleDeleteRow = (idx) => onChange(items.filter((_, i) => i !== idx));
  
  const baseHeaders = ["#", "Mã SP", "Đơn giá", "SL (PCS)"];
  const allHeaders = [...baseHeaders, ...extraDataKeys, ...itemCustomCols.map((c) => c.key), ""];

  if (items.length === 0) {
    return (
      <div style={{ marginTop: 20, padding: "16px 20px", background: "#FFF8FA", borderRadius: 12, border: "1px dashed #FFB3C6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ margin: 0, fontSize: 13, color: "#888" }}>📦 Chưa có sản phẩm nào. Thêm dòng mới hoặc upload OCR.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowCustomDialog("new-col")} style={styles.btnAddCustom}>+ Thêm cột</button>
          <button onClick={handleAddRow} style={styles.btnAddRow}>+ Thêm dòng</button>
        </div>
        {showCustomDialog === "new-col" && <AddCustomFieldDialog onAdd={handleAddCustomCol} onClose={() => setShowCustomDialog(null)} />}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>📦 Danh sách sản phẩm</span>
          <span style={styles.badge}>{items.length} dòng</span>
        </div>
        <div style={styles.fxinputspace}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#e91e8c", fontFamily: "monospace", flexShrink: 0 }}>fx</span>
            <div style={{ width: 1, height: 14, background: "#FFD6E0" }} />
            <input 
              value={barInputVal}
              onChange={handleFormulaBarChange}
              onFocus={() => setIsBarFocused(true)}
              onBlur={handleFormulaBarBlur}
              placeholder={selectedCell ? `Sửa ô [${getLabel(selectedCell.fieldKey)}] (Dòng ${selectedCell.rowIndex + 1})...` : "Chọn một ô bất kỳ bên dưới để viết công thức..."}
              disabled={!selectedCell}
              style={{ background: "transparent", border: "none", outline: "none", fontSize: 12, width: "100%", color: "#333" }}
            />

            {/* KHỐI GỢI Ý MỚI: Hiển thị danh sách gợi ý trường khi gõ dấu '{' trên thanh công thức */}
            {isBarFocused && selectedCell && barInputVal.includes("{") && !barInputVal.endsWith("}") && (
              <FormulaSuggestions 
                text={barInputVal} 
                context={items[selectedCell.rowIndex] || {}} 
                onSelect={(fieldKey) => {
                  const lastCurlyIdx = barInputVal.lastIndexOf("{");
                  const newVal = barInputVal.substring(0, lastCurlyIdx) + `{${fieldKey}}`;
                  setBarInputVal(newVal);
                  
                  // Đồng bộ dữ liệu xuống ô tương ứng dưới bảng ngay lập tức
                  const { rowIndex, fieldKey: cellKey, isCustom, isExtra } = selectedCell;
                  if (isCustom) {
                    handleCustomFieldSingle(rowIndex, cellKey, newVal);
                  } else if (isExtra) {
                    handleExtraDataField(rowIndex, cellKey, newVal);
                  } else {
                    handleField(rowIndex, cellKey, newVal);
                  }
                }} 
              />
            )}
          </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={() => setShowCustomDialog("new-col")} style={styles.btnAddCustom}>+ Thêm cột</button>
          <button onClick={handleAddRow} style={styles.btnAddRow}>+ Thêm dòng</button>
        </div>
      </div>

      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #FFE0EB" }}>
        <table style={{ ...styles.table, fontSize: 12, minWidth: 900 }}>
          <thead>
            <tr style={styles.thead}>
              {allHeaders.map((h, hi) => {
                const isDynamicCol = extraDataKeys.includes(h);
                const isCustomCol = itemCustomCols.find((c) => c.key === h);
                return (
                  <th key={hi} title={h} style={{ ...styles.th, fontSize: 11, padding: "8px 8px", position: "relative", maxWidth: isDynamicCol ? 140 : "initial", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {isDynamicCol ? getShortKey(h) : h}
                    {(isCustomCol || isDynamicCol) && (
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isCustomCol) {
                            handleRemoveCustomCol(h);
                          } else {
                            handleRemoveExtraCol(h);
                          }
                        }} 
                        title="Xóa cột" 
                        style={{ marginLeft: 4, background: "none", border: "none", cursor: "pointer", color: "#E53935", fontSize: 10, padding: 0 }}
                      >
                        ✕
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <React.Fragment key={`frag-${i}`}>
                <tr key={`row-${i}`} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                  <td style={{ ...styles.tdSm, color: "#aaa", fontWeight: 600 }}>{i + 1}</td>
                  <td style={styles.tdSm}>
                    <input 
                        value={item.product_code ?? ""} 
                        onChange={(e) => handleField(i, "product_code", e.target.value)} 
                        onFocus={() => setSelectedCell({ rowIndex: i, fieldKey: "product_code", isCustom: false, isExtra: false })} // <-- THÊM DÒNG NÀY
                        style={{ ...styles.cellInput, minWidth: "80px" }} 
                        placeholder="Mã SP" 
                    />
                  </td>
                  <td style={styles.tdSm}>
                  <input 
                      value={item.base_price ?? ""} 
                      onChange={(e) => handleField(i, "base_price", e.target.value)} 
                      onFocus={() => setSelectedCell({ rowIndex: i, fieldKey: "base_price", isCustom: false, isExtra: false })} // <-- THÊM DÒNG NÀY
                      style={{ ...styles.cellInput, width: 80 }} 
                      type="number" step="0.0001" placeholder="0.0000" 
                  />
                  </td>
                  <td style={styles.tdSm}>
                    <input 
                        value={item.quantity ?? ""} 
                        onChange={(e) => handleField(i, "quantity", e.target.value)} 
                        onFocus={() => setSelectedCell({ rowIndex: i, fieldKey: "quantity", isCustom: false, isExtra: false })} // <-- THÊM DÒNG NÀY
                        style={{ ...styles.cellInput, width: 80 }} 
                        type="number" placeholder="0" 
                    />
                  </td>

                  {extraDataKeys.map((key) => (
                    <td key={key} style={styles.tdSm}>
                      <input 
                        value={item.extra_data?.[key] ?? ""} 
                        onChange={(e) => handleExtraDataField(i, key, e.target.value)} 
                        onFocus={() => setSelectedCell({ rowIndex: i, fieldKey: key, isCustom: false, isExtra: true })} // <-- THÊM DÒNG NÀY
                        style={{ ...styles.cellInput, minWidth: 100 }} 
                        placeholder="-" 
                      />
                    </td>
                  ))}

                  {/* Hiển thị các cột thuộc custom fields tự tạo */}
                  {itemCustomCols.map((col) => {
                    const cf = (item.customFields || []).find((f) => f.key === col.key);
                    const val = cf?.value ?? (col.type === "boolean" ? false : "");
                    return (
                      <td key={col.key} style={styles.tdSm}>
                        {col.type === "boolean"
                          ? <input type="checkbox" checked={!!val} onChange={(e) => handleCustomField(i, col.key, e.target.checked)} style={{ accentColor: "#e91e8c" }} />
                          : <FormulaInput
                              value={val}
                              onChange={(newVal) => handleCustomField(i, col.key, newVal)}
                              onFocus={() => setSelectedCell({ rowIndex: i, fieldKey: col.key, isCustom: true, isExtra: false })} // <-- THÊM DÒNG NÀY
                              style={{ ...styles.cellInput, width: 80 }}
                              type={col.type}
                              context={item}
                            />
                        }
                      </td>
                    );
                  })}

                  <td style={styles.tdSm}>
                    <button onClick={() => handleDeleteRow(i)} style={{ background: "#FFF0F0", border: "none", borderRadius: 6, width: 26, height: 26, cursor: "pointer", color: "#E53935", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                  </td>
                </tr>

                {item.note && (
                  <tr key={`note-${i}`} style={{ background: i % 2 === 0 ? "#FFFAFC" : "white" }}>
                    <td colSpan={allHeaders.length} style={{ padding: "4px 10px 8px 36px", borderBottom: "1px solid #FFF0F5" }}>
                      <span style={{ fontSize: 11, color: "#C62828", fontStyle: "italic", background: "#FFEBEE", padding: "2px 10px", borderRadius: 5, borderLeft: "3px solid #E53935" }}>
                        ⚠️ {item.note}
                      </span>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr style={styles.tfoot}>
              <td colSpan={3} style={{ ...styles.tdSm, fontWeight: 700, color: "#e91e8c" }}>Tổng cộng</td>
              <td style={{ ...styles.tdSm, fontWeight: 700, color: "#e91e8c" }}>{items.reduce((s, it) => s + (Number(it.quantity) || 0), 0).toLocaleString()}</td>
              
              {extraDataKeys.map((key) => {
                let total = 0;
                let isNumeric = false;
                items.forEach((it) => {
                  const valStr = it.extra_data?.[key];
                  if (valStr !== undefined && valStr !== null && valStr !== "") {
                    const parsed = Number(valStr);
                    if (!isNaN(parsed)) {
                      total += parsed;
                      isNumeric = true;
                    }
                  }
                });
                return (
                  <td key={key} style={{ ...styles.tdSm, fontWeight: 700, color: "#e91e8c" }}>
                    {isNumeric ? (Number.isInteger(total) ? total : total.toFixed(2)) : ""}
                  </td>
                );
              })}
              
              
              <td style={styles.tdSm} />
            </tr>
          </tfoot>
        </table>
      </div>

      {showCustomDialog === "new-col" && <AddCustomFieldDialog onAdd={handleAddCustomCol} onClose={() => setShowCustomDialog(null)} />}
    </div>
  );
}

// ─── Items Detail Modal ───────────────────────────────────────────────────────

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

// HELPER: Tự động tính toán công thức nếu giá trị bắt đầu bằng dấu '='
const getDisplayValue = (val, context) => {
  if (typeof val === "string" && val.startsWith("=")) {
    return evaluateFormula(val, context);
  }
  return val;
};

function ItemsModal({ record, onClose }) {
  const sc = statusColor(record.status);
  const items = record.items || [];
  
  // Quét động các tiêu đề cột dưới bảng
  const extraDataKeys = getExtraDataKeys(items);
  const customFieldKeys = getCustomFieldKeys(items);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modalBox, width: "min(96vw, 1150px)", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1a1a2e" }}>
              {record.invoiceSource === "customer" ? "Chi tiết báo giá " : "Chi tiết báo giá "}
              <span style={{ color: "#e91e8c" }}>{record.code}</span>
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, fontSize: 12, color: "#666" }}>
              <span>📅 {record.date}</span>
              {record.invoiceSource === "customer" ? (
                <span>👤 KH: <strong>{record.customer}</strong></span>
              ) : (
                <>
                  <span>🏭 NCC: <strong>{record.supplier_name || record.supplier}</strong></span>
                </>
              )}
              <span style={{ background: "#EDE7FF", color: "#7B61FF", padding: "1px 8px", borderRadius: 5, fontWeight: 600 }}>{record.currency}</span>
              <span style={{ background: sc.bg, color: sc.color, padding: "1px 8px", borderRadius: 5, fontWeight: 600 }}>{record.status}</span>
              {record.paymentMethod && <span style={{ background: "#E3F2FD", color: "#1565C0", padding: "1px 8px", borderRadius: 5, fontWeight: 600 }}>{record.paymentMethod}</span>}
              {record.invoiceSource && <span style={{ background: "#FFF8E1", color: "#F57C00", padding: "1px 8px", borderRadius: 5, fontWeight: 600 }}>Từ: {record.invoiceSource}</span>}
            </div>
          </div>
          <button onClick={onClose} style={styles.modalClose}>✕</button>
        </div>

        {/* Khu vực thông số tóm tắt & Các trường tùy chỉnh (Custom fields) cấp hóa đơn */}
        <div style={{ display: "flex", gap: 10, margin: "14px 0", flexWrap: "wrap" }}>
          <Chip label="Tổng CIF" value={fmtCurrency(record.totalCIF, record.currency)} color="#e91e8c" bg="#FFE4EE" />
          <Chip label="Tổng tiền SP" value={fmtCurrency(calcTotalItemsAmount(items), record.currency)} color="#1565C0" bg="#E3F2FD" />
  
          <Chip label="Số dòng SP" value={items.length + " dòng"} color="#7B61FF" bg="#F0EDFF" />
          
          {record.suppliers_pdf_file_path && (
            <a 
              href={`http://127.0.0.1:8000${record.suppliers_pdf_file_path}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ textDecoration: "none" }}
            >
              <Chip label="Tài liệu" value="📄 Xem File Gốc" color="#FF5722" bg="#FBE9E7" />
            </a>
          )}
          
          {/* HIỂN THỊ CÁC TRƯỜNG TÙY CHỈNH PHÍA TRÊN (Tự động biên dịch công thức nếu có) */}
          {(record.customFields || []).map((cf, idx) => {
            const evaluatedVal = getDisplayValue(cf.value, record);
            const displayVal = evaluatedVal === true ? "Có" : evaluatedVal === false ? "Không" : evaluatedVal;
            return (
              <Chip 
                key={idx} 
                label={cf.key} 
                value={displayVal !== undefined && displayVal !== null && displayVal !== "" ? displayVal : "-"} 
                color="#7B61FF" 
                bg="#F0EDFF" 
              />
            );
          })}
        </div>

        {/* Bảng hiển thị danh sách sản phẩm tĩnh (Read-Only) */}
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #FFE0EB", marginTop: 16 }}>
          <table style={{ ...styles.table, fontSize: 12, minWidth: 800 }}>
            <thead>
              <tr style={styles.thead}>
                {["#", "Mã SP", "Đơn giá", "SL (PCS)", ...extraDataKeys, ...customFieldKeys].map((h, idx) => (
                  <th key={idx} style={styles.th}>
                    {extraDataKeys.includes(h) || customFieldKeys.includes(h) ? getShortKey(h) : h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4 + extraDataKeys.length + customFieldKeys.length} style={{ ...styles.td, textAlign: "center", color: "#999", padding: "20px" }}>
                    Không có dữ liệu sản phẩm nào
                  </td>
                </tr>
              ) : (
                items.map((item, i) => (
                  <React.Fragment key={i}>
                    <tr style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                      <td style={styles.td}>{i + 1}</td>
                      <td style={{ ...styles.td, fontWeight: 600, color: "#e91e8c", minWidth:"100px" }}>{item.product_code || "-"}</td>
                      <td style={styles.td}>
                        {item.base_price !== "" && item.base_price !== null && !isNaN(Number(item.base_price))
                          ? Number(item.base_price).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 4 })
                          : "-"}
                      </td>
                      <td style={styles.td}>
                        {item.quantity !== "" && item.quantity !== null && !isNaN(Number(item.quantity))
                          ? Number(item.quantity).toLocaleString()
                          : "-"}
                      </td>
                      
                      {/* 1. Hiển thị động các dữ liệu phụ trợ (extra_data) */}
                      {extraDataKeys.map((key) => (
                        <td key={key} style={styles.td}>
                          {item.extra_data?.[key] !== undefined && item.extra_data?.[key] !== null && item.extra_data?.[key] !== ""
                            ? item.extra_data[key]
                            : "-"}
                        </td>
                      ))}

                      {/* 2. Hiển thị động các cột tự tạo mới (Đã sửa lỗi: biên dịch công thức dạng = thành giá trị thực) */}
                      {customFieldKeys.map((key) => {
                        const cf = (item.customFields || []).find((f) => f.key === key);
                        const rawVal = cf?.value;
                        const evaluatedVal = getDisplayValue(rawVal, item); // Tự động xử lý biểu thức nếu có
                        return (
                          <td key={key} style={styles.td}>
                            {evaluatedVal === true ? "Có" : evaluatedVal === false ? "Không" : evaluatedVal !== undefined && evaluatedVal !== null && evaluatedVal !== "" ? evaluatedVal : "-"}
                          </td>
                        );
                      })}
                    </tr>
                    
                    {/* Hàng ghi chú / Cảnh báo */}
                    {item.note && (
                      <tr style={{ background: i % 2 === 0 ? "#FFFAFC" : "white" }}>
                        <td colSpan={4 + extraDataKeys.length + customFieldKeys.length} style={{ padding: "4px 10px 8px 36px", borderBottom: "1px solid #FFF0F5" }}>
                          <span style={{ fontSize: 11, color: "#C62828", fontStyle: "italic", background: "#FFEBEE", padding: "2px 10px", borderRadius: 5, borderLeft: "3px solid #E53935" }}>
                            ⚠️ {item.note}
                          </span>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={styles.btnPrimary}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
// ─── UploadZone ───────────────────────────────────────────────────────────────
function UploadZone({ label, onUploadSuccess, triggerAlert }) { // <-- Nhận prop triggerAlert
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState(null);

  // Gán notifier an toàn: Nếu không có prop thì dùng alert gốc
  const notify = triggerAlert || alert;

  const uploadToBackend = async (file) => {
    const validTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!validTypes.includes(file.type)) { notify("Chỉ hỗ trợ PDF, JPG, PNG"); return; }
    if (file.size > 10 * 1024 * 1024) { notify("Dung lượng vượt 10MB"); return; }
    
    setIsUploading(true); 
    setUploadedFileName(file.name);
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch("http://127.0.0.1:8000/files/extract", { method: "POST", body: formData });
      if (res.ok) { 
        const data = await res.json(); 
        console.log(data);
        if (onUploadSuccess) onUploadSuccess(data); 
      }
      else { 
        notify("Upload thất bại!"); 
        setUploadedFileName(null); 
      }
    } catch (e) { 
      notify("Lỗi mạng!"); 
      setUploadedFileName(null); 
    } finally { 
      setIsUploading(false); 
    }
  };

  const handleContainerClick = () => fileInputRef.current.click();
  
  const handleFileChange = (e) => { 
    const f = e.target.files[0]; 
    if (f) uploadToBackend(f); 
    e.target.value = null; 
  };

  const handleDragEnter = (e) => { 
    e.preventDefault(); 
    e.stopPropagation(); 
    setIsDragging(true); 
  };
  const handleDragOver = (e) => { 
    e.preventDefault(); 
    e.stopPropagation(); 
    setIsDragging(true); 
  };
  const handleDragLeave = (e) => { 
    e.preventDefault(); 
    e.stopPropagation(); 
    setIsDragging(false); 
  };
  const handleDrop = (e) => { 
    e.preventDefault(); 
    e.stopPropagation(); 
    setIsDragging(false); 
    const f = e.dataTransfer.files[0]; 
    if (f) uploadToBackend(f); 
  };

  return (
    <div 
      style={{ 
        ...styles.uploadZone, 
        border: isDragging ? "2px dashed #e91e8c" : uploadedFileName ? "2px dashed #4CAF50" : "2px dashed #FFB3C6", 
        background: isDragging ? "#FFF0F8" : uploadedFileName ? "#F0FFF4" : "#FFF8FA", 
        opacity: isUploading ? 0.6 : 1, 
        pointerEvents: isUploading ? "none" : "auto", 
        cursor: "pointer", 
        transition: "border 0.2s, background 0.2s" 
      }}
      onClick={handleContainerClick} 
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver} 
      onDragLeave={handleDragLeave} 
      onDrop={handleDrop}
    >
      <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: "none" }} accept=".pdf,.jpg,.jpeg,.png" />
      <span style={{ color: "#e91e8c", fontWeight: 600, fontSize: 14 }}>{label}</span>
      <p style={{ fontSize: 12, color: "#aaa", margin: "4px 0 12px", pointerEvents: "none" }}>
        {isUploading ? "⏳ Đang tải lên..." : isDragging ? "📂 Thả vào đây!" : "Kéo thả hoặc click chọn file"}
      </p>
      {uploadedFileName
        ? <div style={{ background: "#E8F5E9", borderRadius: 8, padding: "6px 14px", pointerEvents: "none" }}><span style={{ fontSize: 12, color: "#388E3C", fontWeight: 600 }}>✅ {uploadedFileName}</span></div>
        : <div style={{ pointerEvents: "none" }}><UploadIcon /></div>}
      <div style={{ display: "flex", gap: 8, marginTop: 8, pointerEvents: "none" }}>
        <span style={styles.pdfBadge}>PDF</span>
        <span style={styles.imgBadge}>JPG</span>
        <span style={styles.imgBadge}>PNG</span>
      </div>
      <p style={{ fontSize: 11, color: "#bbb", marginTop: 8, pointerEvents: "none" }}>Hỗ trợ: PDF, JPG, PNG (Tối đa 10MB)</p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Chip({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: "6px 14px" }}>
      <div style={{ fontSize: 10, color: "#999", marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      <label style={{ fontSize: 13, color: "#555", fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function InvoiceApp() {
  const [isSaving, setIsSaving] = useState(false);
  const [activeNav, setActiveNav] = useState("input");
  const [inputMode, setInputMode] = useState("ocr");
  const [records, setRecords] = useState(initialData);
  const [editId, setEditId] = useState(null);
  const [detailRecord, setDetailRecord] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [notification, setNotification] = useState(null);
  const [localPage, setLocalPage] = useState(1);
  const [localLimit, setLocalLimit] = useState(10); // Mặc định giới hạn 10 dòng mỗi bảng

  // Tách biệt danh sách hóa đơn theo loại
  const customerRecords = records.filter(r => r.invoiceSource === "customer");
  const supplierRecords = records.filter(r => r.invoiceSource !== "customer");

  // ĐIỀU CHỈNH TRANG TỰ ĐỘNG: Đưa trang hiện tại về trang tối đa khả dụng khi xóa dòng
  useEffect(() => {
    const totalPagesClient = Math.ceil(customerRecords.length / localLimit);
    const totalPagesSupplier = Math.ceil(supplierRecords.length / localLimit);
    const maxPages = Math.max(1, Math.max(totalPagesClient, totalPagesSupplier));
    if (localPage > maxPages) {
      setLocalPage(maxPages);
    }
  }, [records, localLimit, localPage]);
  const triggerAlert = (message, title = "Thông báo 🌸") => {
    setNotification({ title, message, showCancel: false, onConfirm: () => setNotification(null) });
  };
  const triggerConfirm = (message, onConfirm, onCancel, title = "Xác nhận ❓") => {
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


  const handleOcrSuccess = (data) => {
    if (data.status !== "success") { triggerAlert("Trích xuất thất bại!"); return; }
    const d = data.extracted_data;

    const isCustomer = d.invoice_type === "client";

    let rawDate = "";
    if (isCustomer) {
      rawDate = d.date_quotation ? new Date(d.date_quotation).toLocaleDateString("vi-VN") : "";
    } else {
      rawDate = d.date ? new Date(d.date).toLocaleDateString("vi-VN") : "";
    }

    const mappedItems = (d.items || []).map((item) => ({
      product_code: item.product_code || "",
      base_price: item.base_price ?? "",
      quantity: item.quantity ?? "",
      note: item.note || null,
      extra_data: item.extra_data || {}, 
      customFields: [],
    }));

    if (isCustomer){
      setForm({
        ...defaultForm(),
        date: rawDate,
        code:  d.quotation_id || "" ,
        client_id:  String(d.client_id || "") ,
        supplier_name: String(d.supplier_name || "").toUpperCase(),
        customer:  d.client_name || "" ,
        totalCIF: String(d.total_amount_CIF || ""),
        currency: d.currency || "USD",
        paymentMethod: d.payment_method || "ADVANCE",
        invoiceSource: "customer",
        client_pdf_file_path : d.client_pdf_file_path || null,
        invoice_type : "client",
        status: d.status || "pending",
        note: "",
        _ocrFilename: data.filename || "",
        _items: mappedItems,
        customFields: [],
      });
      setInputMode("manual");
    }
    else{
      setForm({
        ...defaultForm(),
        date: rawDate,
        code: d.invoice_code || "",
        supplier_id:  String(d.supplier_id || ""),
        supplier_name: String(d.supplier_name || "").toUpperCase(),
        customer: d.client || "",
        totalCIF: String(d.total_amount_CIF || ""),
        currency: d.currency || "USD",
        supplier_pdf_file_path: d.suppliers_pdf_file_path || null,
        invoice_type : "supplier",
        paymentMethod: d.payment_method || "ADVANCE",
        invoiceSource: "supplier",
        status: d.status || "pending",
        note: "",
        _ocrFilename: data.filename || "",
        _items: mappedItems,
        customFields: [],
      });
      setInputMode("manual");
    }
  };

  const handleInput = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  
  const handleSaveToDB = async () => {
    if (records.length === 0) {
      triggerAlert("Bảng dữ liệu đang trống, không có gì để lưu!");
      return;
    }

    setIsSaving(true);
    try {
      const payloadArray = records.map((r) => {
        let formattedDate = r.date;
        if (r.date && r.date.includes("/")) {
          const [d, m, y] = r.date.split("/");
          if (d && m && y) formattedDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        }
        if (r.invoiceSource === "customer") {
          return {
            date_quotation: formattedDate,
            client_name: r.customer,
            quotation_id: r.code,
            client_id: Number(r.client_id) || null,
            supplier_name : r.supplier_name || null,
            client_pdf_file_path: r.client_pdf_file_path || null,
            status: r.status,
            payment_method: r.paymentMethod,
            total_amount_CIF: Number(r.totalCIF) || 0,
            currency: r.currency || "USD",
            customFields: r.customFields || [],
            items: (r.items || []).map((it) => ({
              product_code: it.product_code,
              customFields : it.customFields,
              base_price: Number(it.base_price) || 0,
              quantity: Number(it.quantity) || 0,
              note: it.note || null,
              extra_data: it.extra_data || {}
            }))
          };
        } else {
          return {
            invoice_type: "supplier",
            invoice_code: r.code,
            supplier_id: Number(r.supplier_id) || null,
            supplier_name : r.supplier_name || "",
            client: r.customer,
            date: formattedDate,
            suppliers_pdf_file_path: r.suppliers_pdf_file_path || null,
            status: r.status,
            total_amount_CIF: Number(r.totalCIF) || 0,
            payment_method: r.paymentMethod,
            currency: r.currency || "USD",
            customFields: r.customFields || [],
            items: (r.items || []).map((it) => ({
              product_code: it.product_code,
              customFields : it.customFields,
              base_price: Number(it.base_price) || 0,
              quantity: Number(it.quantity) || 0,
              note: it.note || null,
              extra_data: it.extra_data || {}
            }))
          };
        }
      });
      

      const response = await fetch("http://127.0.0.1:8000/invoices/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadArray), 
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Lưu thất bại");
      }

      triggerAlert("🎉 " + result.message);
      setRecords([]); 

    } catch (error) {
      console.error(error);
      triggerAlert("❌ Quá trình lưu bị hủy do có lỗi:\n" + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = () => {
    const hasPartner = form.invoiceSource === "customer" 
      ? (form.customer || form.client_id) 
      : (form.supplier_name || form.supplier_id);
    if (!form.code || !hasPartner || !form.totalCIF) return;

    if (editId === null) {
        const isDuplicate = records.some(
          (r) => r.code === form.code && r.invoiceSource === form.invoiceSource
        );
        if (isDuplicate) {
          triggerAlert("Hóa đơn/Báo giá này đã được thêm vào bảng!");
          return; 
        }
      }

    const newRecord = {
      id: editId ?? Date.now(),
      date: form.date || "", 
      code: form.code || "", 
      supplier_name: form.supplier_name || "", 
      customer: form.customer || "",
      totalCIF: Number(form.totalCIF) || "",
      currency: form.currency || "",
      paymentMethod: form.paymentMethod || "",
      invoiceSource: form.invoiceSource || "",
      status: form.status || "",
      note: form.note || "",
      items: form._items || [],
      customFields: form.customFields || [],
      client_id : form.client_id || "",
      supplier_id : form.supplier_id || "",
      client_pdf_file_path: form.client_pdf_file_path || "",
      suppliers_pdf_file_path: form.supplier_pdf_file_path || "",
      _ocrFilename: form._ocrFilename || "",
    };

    if (editId !== null) {
      setRecords(records.map((r) => r.id === editId ? newRecord : r));
      setEditId(null);
    } else {
      setRecords([...records, newRecord]);
    }
    setForm(defaultForm());
    setInputMode("ocr");
  };

  const handleEdit = (r) => {
    setEditId(r.id); setActiveNav("input"); setInputMode("manual");
    setForm({
      ...defaultForm(),
      date: r.date, code: r.code, supplier_name: r.supplier_name, customer: r.customer,
      totalCIF: String(r.totalCIF || ""),
      currency: r.currency || "USD",
      paymentMethod: r.paymentMethod || "ADVANCE",
      invoiceSource: r.invoiceSource || "supplier",
      status: r.status || "pending",
      note: r.note || "",
      client_pdf_file_path: r.client_pdf_file_path || null,
      supplier_pdf_file_path: r.suppliers_pdf_file_path || null,
      _items: r.items || [],
      customFields: r.customFields || [],
      _ocrFilename: r._ocrFilename || "",
    });
  };

  const handleSaveModalItems = (newItems) => {
    setRecords(records.map((r) => r.id === detailRecord.id ? { ...r, items: newItems } : r));
    setDetailRecord((prev) => ({ ...prev, items: newItems }));
  };

  const handleDelete = (id) => setRecords(records.filter((r) => r.id !== id));
  const handleClear = () => { setForm(defaultForm()); setEditId(null); };


  const totalPagesClient = Math.ceil(customerRecords.length / localLimit);
  const totalPagesSupplier = Math.ceil(supplierRecords.length / localLimit);
  const maxPages = Math.max(1, Math.max(totalPagesClient, totalPagesSupplier));

  // Cắt lát dữ liệu hiển thị cho trang hiện tại
  const displayedCustomers = customerRecords.slice((localPage - 1) * localLimit, localPage * localLimit);
  const displayedSuppliers = supplierRecords.slice((localPage - 1) * localLimit, localPage * localLimit);

  // Tạo mảng số trang để render nút bấm
  const pagesList = Array.from({ length: maxPages }, (_, i) => i + 1);

  const sc = statusColor(form.status);

  return (
    <div style={styles.root}>
      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Nhập dữ liệu báo giá <HeartIcon /></h1>
            <p style={styles.subtitle}>Nhập thông tin thủ công hoặc trích xuất từ file báo giá</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button style={styles.btnOutline}>📄 Hướng dẫn ▾</button>
            <div style={styles.avatarSm}><BunnyIcon size={32} /></div>
          </div>
        </div>

        {activeNav === "input" && (
          <>
            <div style={styles.toggleBar}>
              <button style={inputMode === "ocr" ? styles.toggleActive : styles.toggleInactive} onClick={() => setInputMode("ocr")}>✨ OCR tự động</button>
              <button style={inputMode === "manual" ? styles.toggleActive : styles.toggleInactive} onClick={() => setInputMode("manual")}>🖊 Nhập thủ công</button>
            </div>

            {inputMode === "ocr" && (
              <section style={styles.card}>
                <h2 style={styles.sectionTitle}>Trích xuất dữ liệu bằng máy (OCR) ✨</h2>
                <div style={styles.uploadRow}>
                  <UploadZone 
                    label="Tải lên Invoice / Quotation" 
                    onUploadSuccess={handleOcrSuccess} 
                    triggerAlert={triggerAlert} // <-- THÊM DÒNG NÀY
                  />
                </div>
                <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "#bbb" }}>
                  💡 Sau khi upload, dữ liệu sẽ tự động điền vào form để bạn kiểm tra trước khi lưu
                </p>
              </section>
            )}

            {inputMode === "manual" && (
              <section style={styles.card}>
                <h2 style={styles.sectionTitle}>
                  {editId ? "✏️ Chỉnh sửa" : "Nhập dữ liệu thủ công"} <HeartIcon />
                </h2>

                {/* Chọn loại hóa đơn nhập thủ công */}
                <div style={{ ...styles.toggleBar, marginBottom: 20 }}>
                  <button 
                    type="button"
                    style={form.invoiceSource !== "customer" ? styles.toggleActive : styles.toggleInactive}
                    onClick={() => {
                      if (!editId) {
                        setForm(prev => ({ ...prev, invoiceSource: "supplier", invoice_type: "supplier", supplier_name: "", customer: "" }));
                      }
                    }}
                    disabled={!!editId}
                  >
                    🏭 Báo giá từ Nhà cung cấp (Supplier)
                  </button>
                  <button 
                    type="button"
                    style={form.invoiceSource === "customer" ? styles.toggleActive : styles.toggleInactive}
                    onClick={() => {
                      if (!editId) {
                        setForm(prev => ({ ...prev, invoiceSource: "customer", invoice_type: "client", supplier_name: "", customer: "" }));
                      }
                    }}
                    disabled={!!editId}
                  >
                    👤 Báo giá cho Khách (Client)
                  </button>
                </div>

                {(form._ocrFilename || form.client_pdf_file_path || form.supplier_pdf_file_path) && (
                  <div style={{ ...styles.ocrBanner, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <span>
                      {form._ocrFilename ? (
                        <>✨ Dữ liệu trích xuất từ: <strong>{form._ocrFilename}</strong> — vui lòng kiểm tra trước khi lưu</>
                      ) : (
                        <>📄 File PDF / Hình ảnh đi kèm tài liệu</>
                      )}
                    </span>
                    {(form.client_pdf_file_path || form.supplier_pdf_file_path) && (
                      <a 
                        href={`http://127.0.0.1:8000${form.client_pdf_file_path || form.supplier_pdf_file_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: "#F57C00",
                          color: "white",
                          padding: "3px 10px",
                          borderRadius: 6,
                          textDecoration: "none",
                          fontSize: 11,
                          fontWeight: 700,
                          display: "inline-block"
                        }}
                      >
                        📄 Mở File Gốc
                      </a>
                    )}
                  </div>
                )}

                <div style={styles.sectionSubtitle}>📋 Thông tin cơ bản</div>
                <div style={styles.formGrid}>
                  <Field label={form.invoiceSource === "customer" ? "Ngày Quotation *" : "Ngày PI *"}>
                    <div style={styles.dateInput}>
                      <input name="date" value={form.date} onChange={handleInput} placeholder="DD/MM/YYYY"
                        style={{ ...styles.input, border: "none", background: "transparent", flex: 1 }} />
                      <span style={{ color: "#FF8FA3" }}>📅</span>
                    </div>
                  </Field>
                  <Field label={form.invoiceSource === "customer" ? "Mã Quotation *" : "Mã báo giá *"}>
                    <input name="code" value={form.code} onChange={handleInput} placeholder="Nhập mã số" style={styles.input} />
                  </Field>
                  {form.invoiceSource !== "customer" && (
                    <Field label={"Nhà cung cấp *"}>
                      <input name="supplier_name" value={form.supplier_name || ""} onChange={handleInput} placeholder="Tên nhà cung cấp" style={styles.input} />
                    </Field>
                  )}
                  {form.invoiceSource === "customer" && (
                    <Field label={"Bên nhận báo giá *"}>
                      <input name="customer" value={form.customer} onChange={handleInput} placeholder="Nhập tên đối tác" style={styles.input} />
                    </Field>
                  )}
                </div>

                <div style={styles.formGrid}>
                  <Field label="Tổng tiền CIF *">
                    <div style={styles.suffixInput}>
                      <input name="totalCIF" value={form.totalCIF} onChange={handleInput} placeholder="Nhập tổng CIF"
                        style={{ ...styles.input, flex: 1, border: "none", background: "transparent" }} type="number" />
                      <span style={styles.suffix}>{CURRENCY_CONFIG[form.currency]?.symbol || "$"}</span>
                    </div>
                  </Field>
                  <Field label="Loại tiền tệ">
                    <select name="currency" value={form.currency} onChange={handleInput} style={styles.input}>
                      <option>USD</option><option>VND</option><option>EUR</option><option>JPY</option><option>CNY</option>
                    </select>
                  </Field>
                  <Field label="Phương thức thanh toán" style={{ gridColumn: "span 2" }}>
                    <input 
                      name="paymentMethod" 
                      value={form.paymentMethod} 
                      onChange={handleInput} 
                      style={styles.input}
                    />
                  </Field>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "14px 18px" }}>
                  <Field label="Trạng thái">
                    <select name="status" value={form.status} onChange={handleInput}
                      style={{ ...styles.input, color: sc.color, background: sc.bg, border: `1.5px solid ${sc.color}40`, fontWeight: 600 }}>
                      {INVOICE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Ghi chú">
                    <input name="note" value={form.note} onChange={handleInput} placeholder="Nhập ghi chú" style={styles.input} />
                  </Field>
                </div>

                <CustomFieldsBlock
                  fields={form.customFields || []}
                  context={form} // Truyền toàn bộ form làm dữ liệu tính toán
                  onChange={(fields) => setForm({ ...form, customFields: fields })}
                />

                <div style={{ height: 1, background: "#FFE0EB", margin: "24px 0" }} />
                
                <ItemsEditor
                  items={form._items || []}
                  onChange={(newItems) => setForm({ ...form, _items: newItems })}
                  triggerConfirm={triggerConfirm} 
                />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
                  <button onClick={handleClear} style={styles.btnGhost}>🗑 Xóa trắng</button>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <BunnyIcon size={52} />
                    <button onClick={handleAdd} style={styles.btnPrimary}>
                      {editId ? "✅ Cập nhật" : "+ Thêm vào bảng"}
                    </button>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {(activeNav === "input" || activeNav === "table") && (
          <section style={styles.card}>
            {/* Header chung chứa nút thao tác đồng bộ cho cả 2 bảng */}
            <div style={styles.tableHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ ...styles.sectionTitle, margin: 0 }}>Bảng dữ liệu tổng hợp</h2>
                <span style={styles.badge}>{records.length} bản ghi</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => handleSaveToDB()} style={styles.btnSave}>📥 Lưu xuống Database</button>
                <button style={styles.btnExcel}>📊 Xuất Excel</button>
                <button onClick={() => setRecords([])} style={styles.btnDanger}>🗑 Xóa tất cả</button>
              </div>
            </div>

            {/* BẢNG 1: QUOTATION CHO CLIENT/CUSTOMER */}
            <div style={{ marginBottom: 32, background: "#FFF9FA", padding: 18, borderRadius: 12, border: "1px solid #FFD6E0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: "#e91e8c", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  📑 1. Báo giá gửi cho Khách hàng (Client / Quotation)
                </h3>
                <span style={{ ...styles.badge, background: "#FFE4EE", color: "#e91e8c" }}>{customerRecords.length} bản ghi</span>
              </div>
              {customerRecords.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#999", fontSize: 13, background: "white", borderRadius: 8, border: "1px dashed #FFD6E0" }}>
                  Chưa có báo giá khách hàng nào trong hàng chờ
                </div>
              ) : (
                <div style={{ overflowX: "auto", background: "white", borderRadius: 8, border: "1px solid #FFE0EB" }}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.thead}>
                        {["STT", "Ngày Quotation", "Mã Quotation", "Tên Khách Hàng", "Tổng CIF", "Tổng tiền SP", "Thanh toán", "Trạng thái", "Chi tiết", "Thao tác"].map((h) => (
                          <th key={h} style={styles.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                    {displayedCustomers.map((r, i) => {
                      const sc2 = statusColor(r.status);
                      const stt = (localPage - 1) * localLimit + i + 1; // Tính STT thực tế dựa theo trang
                      return (
                          <tr key={r.id} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                            <td style={styles.td}>{i + 1}</td>
                            <td style={styles.td}>{r.date}</td>
                            <td style={{ ...styles.td, color: "#e91e8c", fontWeight: 600 }}>{r.code}</td>
                            <td style={{ ...styles.td, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.customer}>{r.customer}</td>
                            <td style={{ ...styles.td, fontWeight: 600 }}>{fmtCurrency(r.totalCIF, r.currency)}</td>
                            <td style={{ ...styles.td, fontWeight: 600, color: "#1565C0" }}>
                              {fmtCurrency(calcTotalItemsAmount(r.items), r.currency)}
                            </td>
                            <td style={styles.td}>
                              <span style={{ background: "#E3F2FD", color: "#1565C0", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>
                                {r.paymentMethod}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <span style={{ background: sc2.bg, color: sc2.color, padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>
                                {r.status}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <button onClick={() => setDetailRecord(r)} style={styles.btnDetail} title="Xem & sửa sản phẩm">
                                🔍 {r.items?.length > 0 ? `${r.items.length} SP` : "Xem"}
                              </button>
                            </td>
                            <td style={styles.td}>
                              <button onClick={() => handleEdit(r)} style={styles.iconBtn} title="Sửa">✏️</button>
                              <button onClick={() => handleDelete(r.id)} style={styles.iconBtn} title="Xóa">🗑</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* BẢNG 2: PI TỪ SUPPLIER */}
            <div style={{ background: "#F5FBFD", padding: 18, borderRadius: 12, border: "1px solid #BEE3F8" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: "#2B6CB0", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  🏭 2. Báo giá từ Nhà cung cấp (Supplier / PI)
                </h3>
                <span style={{ ...styles.badge, background: "#EBF8FF", color: "#2B6CB0" }}>{supplierRecords.length} bản ghi</span>
              </div>
              {supplierRecords.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#999", fontSize: 13, background: "white", borderRadius: 8, border: "1px dashed #BEE3F8" }}>
                  Chưa có báo giá nhà cung cấp nào trong hàng chờ
                </div>
              ) : (
                <div style={{ overflowX: "auto", background: "white", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={{ ...styles.thead, background: "#EDF2F7" }}>
                        {["STT", "Ngày PI", "Mã báo giá", "Nhà cung cấp (ID)", "Tổng CIF", "Tổng tiền SP", "Thanh toán", "Trạng thái", "Chi tiết", "Thao tác"].map((h) => (
                          <th key={h} style={{ ...styles.th, color: "#2B6CB0", borderBottom: "2px solid #CBD5E0" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                    {displayedSuppliers.map((r, i) => {
                      const sc2 = statusColor(r.status);
                      const stt = (localPage - 1) * localLimit + i + 1; // Tính STT thực tế dựa theo trang
                      return (
                          <tr key={r.id} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                            <td style={styles.td}>{i + 1}</td>
                            <td style={styles.td}>{r.date}</td>
                            <td style={{ ...styles.td, color: "#2B6CB0", fontWeight: 600 }}>{r.code}</td>
                            <td style={styles.td}>{r.supplier_name}</td>
                            <td style={{ ...styles.td, fontWeight: 600 }}>{fmtCurrency(r.totalCIF, r.currency)}</td>
                            <td style={{ ...styles.td, fontWeight: 600, color: "#1565C0" }}>
                              {fmtCurrency(calcTotalItemsAmount(r.items), r.currency)}
                            </td>
                            <td style={styles.td}>
                              <span style={{ background: "#E3F2FD", color: "#1565C0", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>
                                {r.paymentMethod}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <span style={{ background: sc2.bg, color: sc2.color, padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>
                                {r.status}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <button onClick={() => setDetailRecord(r)} style={styles.btnDetail} title="Xem & sửa sản phẩm">
                                🔍 {r.items?.length > 0 ? `${r.items.length} SP` : "Xem"}
                              </button>
                            </td>
                            <td style={styles.td}>
                              <button onClick={() => handleEdit(r)} style={styles.iconBtn} title="Sửa">✏️</button>
                              <button onClick={() => handleDelete(r.id)} style={styles.iconBtn} title="Xóa">🗑</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* THAY THẾ TOÀN BỘ KHỐI PHÂN TRANG CŨ BẰNG ĐOẠN DƯỚI ĐÂY */}
            <div style={styles.pagination}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#888" }}>
                Hiển thị{" "}
                <select 
                  value={localLimit}
                  onChange={(e) => {
                    setLocalLimit(Number(e.target.value));
                    setLocalPage(1); // Trở về trang 1 khi đổi giới hạn dòng
                  }}
                  style={{ padding: "2px 6px", borderRadius: 6, border: "1px solid #ffd6e0", outline: "none", cursor: "pointer", background: "white" }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>{" "}
                bản ghi mỗi bảng
              </div>

              {/* Chỉ hiện thị bộ nút chuyển trang khi có ít nhất 1 bảng vượt quá giới hạn */}
              {maxPages > 1 && (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <button 
                    onClick={() => setLocalPage(p => Math.max(1, p - 1))}
                    disabled={localPage === 1}
                    style={{ ...styles.pageBtn, cursor: localPage === 1 ? "not-allowed" : "pointer", opacity: localPage === 1 ? 0.5 : 1 }}
                  >
                    ‹
                  </button>
                  
                  {pagesList.map((p) => (
                    <button 
                      key={p} 
                      onClick={() => setLocalPage(p)}
                      style={{ 
                        ...styles.pageBtn, 
                        ...(p === localPage ? styles.pageBtnActive : {}),
                        cursor: "pointer"
                      }}
                    >
                      {p}
                    </button>
                  ))}
                  
                  <button 
                    onClick={() => setLocalPage(p => Math.min(maxPages, p + 1))}
                    disabled={localPage === maxPages}
                    style={{ ...styles.pageBtn, cursor: localPage === maxPages ? "not-allowed" : "pointer", opacity: localPage === maxPages ? 0.5 : 1 }}
                  >
                    ›
                  </button>
                </div>
              )}

              <span style={{ fontSize: 13, color: "#888" }}>
                Tổng cộng: {records.length} bản ghi trên cả 2 bảng
              </span>
            </div>
          </section>
        )}

        {["history", "stats", "settings"].includes(activeNav) && (
          <div style={styles.emptyState}>
            <BunnyIcon size={80} />
            <p style={{ color: "#FF8FA3", fontSize: 16, marginTop: 16 }}>Tính năng đang phát triển... 🌸</p>
          </div>
        )}

        <p style={styles.footer}>💗 Dễ thương – Nhanh chóng – Chính xác 💗</p>
      </main>

      {detailRecord && (
        <ItemsModal 
          record={detailRecord} 
          onClose={() => setDetailRecord(null)} 
        />
      )}
      <LoadingOverlay isSaving={isSaving} />
      <CustomNotificationModal config={notification} onClose={() => setNotification(null)} />

    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  root: { display: "flex", minHeight: "100vh", background: "#FFF0F5", fontFamily: "'Segoe UI', 'Be Vietnam Pro', sans-serif" },
  sidebar: { width: 200, background: "white", borderRight: "1px solid #FFE0EB", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "20px 0", position: "sticky", top: 0, height: "100vh" },
  sidebarTop: { display: "flex", flexDirection: "column", alignItems: "center" },
  avatarBox: { width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, #FFE4EE 0%, #FFC0D4 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(255,143,163,0.25)" },
  sidebarBottom: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10 },
  dateBox: { background: "#FFF5F8", borderRadius: 10, padding: "6px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, border: "1px solid #FFD6E0" },
  navItem: { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 20px", background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 13, textAlign: "left", borderLeft: "3px solid transparent", transition: "all 0.15s" },
  navItemActive: { background: "#FFF0F5", color: "#e91e8c", borderLeft: "3px solid #FF6B9D" },
  main: { flex: 1, padding: "28px 32px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 22, fontWeight: 700, color: "#1a1a2e", margin: 0, display: "flex", alignItems: "center", gap: 8 },
  subtitle: { fontSize: 13, color: "#888", margin: "4px 0 0" },
  card: { background: "white", borderRadius: 16, padding: "24px 28px", border: "1px solid #FFE0EB", boxShadow: "0 2px 12px rgba(255,107,157,0.06)" },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: "#1a1a2e", marginBottom: 16, marginTop: 0 },
  sectionSubtitle: { fontSize: 13, fontWeight: 700, color: "#e91e8c", marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid #FFE0EB" },

  toggleBar: { display: "flex", gap: 6, background: "white", padding: "5px", borderRadius: 12, border: "1px solid #FFE0EB", width: "fit-content" },
  toggleActive: { background: "linear-gradient(135deg, #FF6B9D, #FF8FA3)", color: "white", border: "none", borderRadius: 9, padding: "8px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 3px 10px rgba(255,107,157,0.35)" },
  toggleInactive: { background: "none", color: "#888", border: "none", borderRadius: 9, padding: "8px 20px", fontWeight: 500, fontSize: 13, cursor: "pointer" },

  uploadRow: { display: "flex", alignItems: "stretch", gap: 0 },
  uploadZone: { flex: 1, borderRadius: 14, padding: "22px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" },
  plusCircle: { width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #FF6B9D, #FF8FA3)", color: "white", fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 16px", flexShrink: 0, boxShadow: "0 4px 10px rgba(255,107,157,0.4)", alignSelf: "center" },
  pdfBadge: { background: "#FFE4EE", color: "#e91e8c", fontSize: 11, fontWeight: 700, padding: "3px 7px", borderRadius: 6 },
  imgBadge: { background: "#EDE7FF", color: "#7B61FF", fontSize: 11, fontWeight: 700, padding: "3px 7px", borderRadius: 6 },

  ocrBanner: { background: "#FFF8E1", border: "1px solid #FFE082", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#F57C00", marginBottom: 16 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px 18px" },
  customFieldsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px 18px" },
  input: { width: "100%", padding: "9px 12px", fontSize: 13, border: "1.5px solid #FFD6E0", borderRadius: 8, outline: "none", background: "#FFFAFC", color: "#333", boxSizing: "border-box" },
  labelSm: { fontSize: 12, color: "#555", fontWeight: 600 },
  dateInput: { display: "flex", alignItems: "center", gap: 8, border: "1.5px solid #FFD6E0", borderRadius: 8, padding: "0 10px", background: "#FFFAFC" },
  suffixInput: { display: "flex", alignItems: "center", border: "1.5px solid #FFD6E0", borderRadius: 8, overflow: "hidden", background: "#FFFAFC" },
  suffix: { padding: "0 10px", color: "#FF8FA3", fontWeight: 600, fontSize: 13, borderLeft: "1px solid #FFD6E0", background: "#FFF0F5", whiteSpace: "nowrap" },

  btnPrimary: { background: "linear-gradient(135deg, #FF6B9D, #FF8FA3)", color: "white", border: "none", borderRadius: 10, padding: "11px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 12px rgba(255,107,157,0.35)" },
  btnGhost: { background: "none", color: "#FF8FA3", border: "1.5px solid #FFD6E0", borderRadius: 10, padding: "10px 18px", fontSize: 13, cursor: "pointer", fontWeight: 500 },
  btnOutline: { background: "white", border: "1px solid #FFD6E0", color: "#555", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" },
  btnDetail: { background: "#EDE7FF", color: "#7B61FF", border: "1px solid #D1C4E9", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" },
  btnAddRow: { background: "linear-gradient(135deg, #FF6B9D, #FF8FA3)", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontWeight: 600, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" },
  btnAddCustom: { background: "#EDE7FF", color: "#7B61FF", border: "1px solid #D1C4E9", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 },
  avatarSm: { width: 40, height: 40, borderRadius: 10, background: "#FFF0F5", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #FFD6E0" },

  tableHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  badge: { background: "#FFE4EE", color: "#e91e8c", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20 },
  btnSave: { background: "#bdebff", color: "#2f84a8", border: "1px solid #C8E6C9", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer", fontWeight: 500 },
  btnExcel: { background: "#E8F5E9", color: "#388E3C", border: "1px solid #C8E6C9", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer", fontWeight: 500 },
  btnDanger: { background: "#FFF0F0", color: "#E53935", border: "1px solid #FFCDD2", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer", fontWeight: 500 },

  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  thead: { background: "#FFF0F5" },
  th: { padding: "10px 10px", textAlign: "left", color: "#e91e8c", fontWeight: 600, fontSize: 12, borderBottom: "2px solid #FFE0EB", whiteSpace: "nowrap" },
  td: { padding: "10px 10px", color: "#444", borderBottom: "1px solid #FFF0F5", fontSize: 12 },
  tdSm: { padding: "7px 8px", color: "#444", borderBottom: "1px solid #FFF0F5", fontSize: 12, whiteSpace: "nowrap" },
  trEven: { background: "white" },
  trOdd: { background: "#FFFAFC" },
  tfoot: { background: "#FFF5F8", borderTop: "2px solid #FFD6E0" },
  iconBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px", borderRadius: 6, marginRight: 2 },
  cellInput: { padding: "4px 6px", fontSize: 12, border: "1px solid #FFD6E0", borderRadius: 6, background: "#FFFAFC", color: "#333", outline: "none", width: "100%", boxSizing: "border-box" },

  pagination: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 12, borderTop: "1px solid #FFE0EB" },
  pageBtn: { width: 30, height: 30, borderRadius: 8, border: "1px solid #FFD6E0", background: "white", fontSize: 13, cursor: "pointer", color: "#888" },
  pageBtnActive: { background: "linear-gradient(135deg, #FF6B9D, #FF8FA3)", color: "white", border: "none", fontWeight: 700 },

  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60 },
  footer: { textAlign: "center", color: "#FFB3C6", fontSize: 13, marginTop: 8 },

  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalBox: { background: "white", borderRadius: 18, padding: "24px 28px", width: "min(92vw, 940px)", maxHeight: "90vh", overflowY: "auto", border: "1px solid #FFE0EB", boxShadow: "0 20px 60px rgba(255,107,157,0.2)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  modalClose: { background: "#FFF0F5", border: "1px solid #FFD6E0", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 14, color: "#e91e8c", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  loadingOverlay: { position: "fixed", inset: 0, background: "rgba(255, 255, 255, 0.75)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 },
  loadingBox: { background: "white", padding: "30px 60px 40px", borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, boxShadow: "0 20px 60px rgba(255,107,157,0.25)", border: "2px solid #FFE0EB" },
  spinner: { width: 22, height: 22, borderRadius: "50%", border: "3px solid #FFE0EB", borderTopColor: "#e91e8c", animation: "spin 0.8s linear infinite" },
  fxinputspace: {flex: 1, 
    display: "flex", 
    alignItems: "center", 
    gap: 8, 
    background: "#FFF0F5", 
    borderRadius: 8, 
    padding: "5px 12px", 
    margin: "0px 20px",
    border: "1.5px solid #FFD6E0",
    boxShadow:   "none",
    transition: "all 0.15s",
    position: "relative"}
};