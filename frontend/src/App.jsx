import React, { useState, useEffect, useCallback } from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import HisaabAPI from './services/api';
import Navbar from './components/Navbar';
import OverviewDashboard from './components/OverviewDashboard';
import InteractiveMartMap from './components/InteractiveMartMap';
import AisleCarousel from './components/AisleCarousel';
import HeroReorderBar from './components/HeroReorderBar';
import ProductCatalog from './components/ProductCatalog';
import ProductDrawer from './components/ProductDrawer';
import KhataWasooliView from './components/KhataWasooliView';
import WasooliModal from './components/WasooliModal';
import ComboBuilderModal from './components/ComboBuilderModal';
import CashOutlookView from './components/CashOutlookView';
import CopilotDrawer from './components/CopilotDrawer';
import CsvUploaderModal from './components/CsvUploaderModal';

function MainApp() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');

  // Live Store Telemetry State
  const [dashboardData, setDashboardData] = useState({});
  const [todayActions, setTodayActions] = useState([]);
  const [criticalStockouts, setCriticalStockouts] = useState(0);
  const [overdueCustomers, setOverdueCustomers] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modals & Drawers State
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [comboModalOpen, setComboModalOpen] = useState(false);
  const [selectedWasooliCustomer, setSelectedWasooliCustomer] = useState(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const refreshAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [actionsRes, dashRes, creditRes] = await Promise.all([
        HisaabAPI.getTodayActions(),
        HisaabAPI.getDashboard('30d'),
        HisaabAPI.getCreditSummary(),
      ]);

      setTodayActions(actionsRes.actions || []);
      setDashboardData(dashRes);
      setOverdueCustomers(creditRes.total_overdue_customers || 0);

      // Count critical stockouts
      const stockouts = (actionsRes.actions || []).filter(a => a.action_type === 'reorder').length;
      setCriticalStockouts(stockouts);
    } catch (err) {
      console.error('Failed to load live store data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  const handleResetDemo = async () => {
    await HisaabAPI.resetDemo(42);
    await refreshAllData();
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Top Fixed Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'csv') {
            setCsvModalOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        onResetDemo={handleResetDemo}
        onOpenCopilot={() => setCopilotOpen(true)}
        stats={{
          criticalStockouts,
          overdueCustomers,
        }}
      />

      {/* Main Page Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <OverviewDashboard
              dashboardData={dashboardData}
              todayActions={todayActions}
              onOpenReorderFlow={() => setActiveTab('reorder')}
              onOpenComboModal={() => setComboModalOpen(true)}
              onOpenWasooliModal={(action) => {
                setSelectedWasooliCustomer({
                  name: 'Tariq Grocers',
                  phone: '+92 300 8594012',
                  total_balance_pkr: 38400,
                  overdue_amount_pkr: 38400,
                  days_overdue: 45,
                  safe_mark_score: 38,
                });
              }}
              onOpenProductDrawer={(id) => setSelectedProductId(id)}
              onOpenMartWalk={() => setActiveTab('mart_walk')}
              onOpenCopilot={() => setCopilotOpen(true)}
            />

            <AisleCarousel
              onSelectAisle={(aisleId) => setActiveTab('mart_walk')}
              onOpenProductDrawer={(id) => setSelectedProductId(id)}
              onOpenComboModal={() => setComboModalOpen(true)}
              onOpenWasooliModal={() => {
                setSelectedWasooliCustomer({
                  name: 'Tariq Grocers',
                  phone: '+92 300 8594012',
                  total_balance_pkr: 38400,
                  overdue_amount_pkr: 38400,
                  days_overdue: 45,
                  safe_mark_score: 38,
                });
              }}
              onOpenReorderFlow={() => setActiveTab('reorder')}
            />
          </div>
        )}

        {/* TAB 2: INTERACTIVE 3D MART WALKTHROUGH */}
        {activeTab === 'mart_walk' && (
          <div className="space-y-8">
            <InteractiveMartMap
              stats={{ criticalStockouts }}
              onOpenProductDrawer={(id) => setSelectedProductId(id)}
              onOpenComboModal={() => setComboModalOpen(true)}
              onOpenWasooliModal={(hotspot) => {
                setSelectedWasooliCustomer({
                  name: 'Tariq Grocers',
                  phone: '+92 300 8594012',
                  total_balance_pkr: 38400,
                  overdue_amount_pkr: 38400,
                  days_overdue: 45,
                  safe_mark_score: 38,
                });
              }}
              onOpenReorderFlow={() => setActiveTab('reorder')}
            />

            <AisleCarousel
              onSelectAisle={() => {}}
              onOpenProductDrawer={(id) => setSelectedProductId(id)}
              onOpenComboModal={() => setComboModalOpen(true)}
              onOpenWasooliModal={() => {
                setSelectedWasooliCustomer({
                  name: 'Tariq Grocers',
                  phone: '+92 300 8594012',
                  total_balance_pkr: 38400,
                  overdue_amount_pkr: 38400,
                  days_overdue: 45,
                  safe_mark_score: 38,
                });
              }}
              onOpenReorderFlow={() => setActiveTab('reorder')}
            />
          </div>
        )}

        {/* TAB 3: HERO REORDER BUDGET PLANNER */}
        {activeTab === 'reorder' && (
          <HeroReorderBar
            initialBudget={50000}
            onSelectProduct={(id) => setSelectedProductId(id)}
          />
        )}

        {/* TAB 4: COMPLETE PRODUCT CATALOG */}
        {activeTab === 'products' && (
          <ProductCatalog
            onSelectProduct={(id) => setSelectedProductId(id)}
          />
        )}

        {/* TAB 5: KHATA & SAFE MARK RECOVERY */}
        {activeTab === 'khata' && (
          <KhataWasooliView
            onOpenWasooliModal={(customer) => setSelectedWasooliCustomer(customer)}
          />
        )}

        {/* TAB 6: 7-DAY CASH FLOW OUTLOOK */}
        {activeTab === 'cashflow' && (
          <CashOutlookView />
        )}
      </main>

      {/* Global Modals & Slide-out Drawers */}
      {selectedProductId && (
        <ProductDrawer
          productId={selectedProductId}
          onClose={() => setSelectedProductId(null)}
          onDataUpdated={refreshAllData}
        />
      )}

      {comboModalOpen && (
        <ComboBuilderModal
          onClose={() => setComboModalOpen(false)}
        />
      )}

      {selectedWasooliCustomer && (
        <WasooliModal
          customer={selectedWasooliCustomer}
          onClose={() => setSelectedWasooliCustomer(null)}
          onPaymentRecorded={refreshAllData}
        />
      )}

      <CopilotDrawer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
      />

      <CsvUploaderModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onDataCommitted={refreshAllData}
      />

      {/* Modern Footer with Disclosures */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-6 px-4 sm:px-6 mt-12 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <span className="font-extrabold text-white">HisaabAI</span>
            <span>• Pakistani Retail Decision Intelligence Platform</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Demo Data Mode
            </span>
          </div>

          <div className="text-slate-400 text-[11px]">
            CYE 2026 Hackathon • Track 3: FinTech & Financial Inclusion
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <MainApp />
    </LanguageProvider>
  );
}
