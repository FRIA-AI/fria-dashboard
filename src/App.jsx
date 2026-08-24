import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { SiteProvider } from './SiteContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import QueEs from './pages/QueEs';
import ComoFunciona from './pages/ComoFunciona';
import Metricas from './pages/Metricas';
import InteligenciaDeMercado from './pages/InteligenciaDeMercado';
import Demo from './pages/Demo';
import AvisoDePrivacidad from './pages/AvisoDePrivacidad';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <SiteProvider>
        <ScrollToTop />
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/que-es" element={<QueEs />} />
            <Route path="/como-funciona" element={<ComoFunciona />} />
            <Route path="/metricas" element={<Metricas />} />
            <Route path="/inteligencia-de-mercado" element={<InteligenciaDeMercado />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/aviso-de-privacidad" element={<AvisoDePrivacidad />} />
          </Routes>
        </Layout>
      </SiteProvider>
    </BrowserRouter>
  );
}
