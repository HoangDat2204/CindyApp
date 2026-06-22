# 🌸 Pink Dashboard — Tauri + React

Giao diện dashboard thống kê doanh thu theo phong cách pastel/cute, xây dựng với Tauri v1 + React + Recharts.

---

## Cấu trúc thư mục

```
tauri-dashboard/
├── src/                  # React frontend
│   ├── main.jsx
│   └── App.jsx           # Toàn bộ UI dashboard
├── src-tauri/            # Tauri backend (Rust)
│   ├── src/main.rs
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
├── index.html
├── vite.config.js
└── package.json
```

---

## Yêu cầu hệ thống

- **Node.js** >= 18
- **Rust** (cài qua https://rustup.rs)
- **Tauri CLI** prerequisites:
  - Windows: Microsoft C++ Build Tools + WebView2
  - macOS: Xcode Command Line Tools
  - Linux: `libwebkit2gtk-4.0-dev build-essential libssl-dev`

---

## Cài đặt & chạy

```bash
# 1. Cài Node dependencies
npm install

# 2. Cài Tauri CLI
npm install -D @tauri-apps/cli@^1.6

# 3. Chạy development (mở cửa sổ desktop)
npm run tauri dev

# 4. Build production
npm run tauri build
```

> **Chỉ chạy React (không cần Rust/Tauri):**
> ```bash
> npm run dev
> # Mở http://localhost:1420
> ```

---

## Tính năng giao diện

- **Sidebar** với navigation active state
- **4 Stat Cards**: Tổng doanh thu, Đơn hàng, Khách hàng, Lượt xem
- **Pie Chart**: Tỷ lệ kênh bán hàng (Website / Shopee / Lazada / TikTok Shop)
- **Area Chart**: Doanh thu theo ngày với tooltip tùy chỉnh
- **Bảng chi tiết**: Dữ liệu theo kênh với hover effect và hàng tổng cộng
- Responsive layout, màu sắc pastel pink nhất quán
