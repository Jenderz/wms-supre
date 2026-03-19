import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { CatalogPage } from './features/catalog/pages/CatalogPage';
import { CategoriesPage } from './features/catalog/pages/CategoriesPage';
import Infrastructure from './pages/Infrastructure';
import Purchasing from './pages/Purchasing';
import Warehouse from './pages/Warehouse';
import Disincorporation from './pages/Disincorporation';
import Settings from './pages/Settings';
import Statistics from './pages/Statistics';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="infrastructure" element={<Infrastructure />} />
            <Route path="purchasing" element={<Purchasing />} />
            <Route path="warehouse" element={<Warehouse />} />
            <Route path="disincorporation" element={<Disincorporation />} />
            <Route path="statistics" element={<Statistics />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}