// src/App.jsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

// Import các Layout và Pages
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/DashBoardPage';
import InputPage from './pages/InputDataPage';
import DataTable from './pages/DataTablePage';
import ProductSearchPage from './pages/ProductSearchPage';

function App() {

  return (
    // Dùng HashRouter thay vì BrowserRouter cho app Tauri
    <HashRouter>
      <Routes>
        {/* Route cha bọc MainLayout. 
            Tất cả các route con bên trong sẽ giữ nguyên được Header/Sidebar của Layout */}
        <Route path="/" element={<MainLayout />}>
          
          <Route index element={<Dashboard />} />
          
          <Route path="input" element={<InputPage />} />
          <Route path="datatable" element={<DataTable />} />
          <Route path="products" element={<ProductSearchPage />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />          
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;