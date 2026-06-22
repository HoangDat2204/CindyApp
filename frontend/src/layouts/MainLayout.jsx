
import { useState } from "react";
import {
    Home, BarChart2, FileText, Search, Settings, ChevronDown
  } from "lucide-react";
import { Outlet, Link, useNavigate } from 'react-router-dom';



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
  


export default function MainLayout(){
    const navigate = useNavigate();
    const [activeNav, setActiveNav] = useState("Tổng quan");

    const navItems = [
      { label: "Tổng quan", icon: Home, link: '/' },
      { label: "Thêm dữ liệu",  icon: BarChart2, link: '/input' },
      { label: "Bảng dữ liệu",   icon: FileText, link: '/datatable' },
      { label: "Tìm Sản phẩm",   icon: Search, link: '/products' },
      { label: "Cài đặt",   icon: Settings, link:'/setting' },
    ];
    return(
        <div style={{ 
            display: "flex", 
            flexDirection: "row", // Xếp ngang
            height: "100vh", 
            width: "100vw", 
            overflow: "hidden" 
          }}>
            <aside style={{
                width: 200,
                background: "rgba(255,255,255,0.7)",
                backdropFilter: "blur(20px)",
                borderRight: "1.5px solid #fce7f3",
                display: "flex",
                flexDirection: "column",
                padding: "28px 16px",
                gap: 8,
                flexShrink: 0,
                alignItems: "center",
                justifyContent: "center"
            }}>
                {/* Logo */}
                <div style={{
                width: 56, height: 56,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28
                }}>
                <BunnyIcon size={50} />
                </div>
            
                {navItems.map(({ label, icon: Icon, link }) => (
                    <button
                        key={label}
                        onClick={() => {
                            setActiveNav(label); // Giữ lại logic active style của bạn
                            navigate(link);      // Điều hướng tới trang tương ứng
                          }}
                        style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "12px 16px", borderRadius: 14,
                        border: "none", cursor: "pointer", width: "100%", textAlign: "left",
                        fontFamily: "inherit", fontSize: 14, fontWeight: 600,
                        transition: "all 0.2s ease",
                        background: activeNav === label
                            ? "linear-gradient(135deg, #F472B6, #ec4899)"
                            : "transparent",
                        color: activeNav === label ? "#fff" : "#9ca3af",
                        boxShadow: activeNav === label ? "0 4px 14px rgba(244,114,182,0.4)" : "none",
                        }}
                    >
                    <Icon size={18} />
                    {label}
                </button>
                ))}
            
                {/* Bottom user */}
                <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10, padding: "8px 4px" }}>
                <div style={{
                    width: 36, height: 36, borderRadius: 12,
                    background: "linear-gradient(135deg, #fbcfe8, #f9a8d4)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                }}>🐰</div>
                <div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>Xin chào,</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>User</div>
                </div>
                <ChevronDown size={14} color="#9ca3af" style={{ marginLeft: "auto" }} />
                </div>
            </aside>


            <main style={{ 
                flex: 1,           // QUAN TRỌNG: Chiếm toàn bộ phần còn lại
                position: "relative",
                backgroundColor: "#FFF0F5", // Để phân biệt với sidebar
                overflowY: "auto"  // Cho phép cuộn nội dung bên trong nếu quá dài
            }}>
                <Outlet />
            </main>
        </div>
    )
}
    

