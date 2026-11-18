import React, { useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { Dashboard } from './pages/Dashboard';
import { ServicesView } from './pages/ServicesView';
import { DockerApps } from './pages/DockerApps';
import { AppLibrary } from './pages/AppLibrary';
import { GitDeploy } from './pages/GitDeploy';
import { DatabaseManager } from './pages/DatabaseManager';
import { Tunnels } from './pages/Tunnels';
import { Automation } from './pages/Automation';
import { FirewallView } from './pages/FirewallView';
import { FileManagerView } from './pages/FileManagerView';
import { TerminalView } from './pages/TerminalView';
import { useSystemStats } from './hooks/useSystemStats';
import { PageId } from './store/useAppStore';
import { Modal } from './components/common/Modal';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [targetOS, setTargetOS] = useState<string>('auto');
  const [isTerminalModalOpen, setIsTerminalModalOpen] = useState<boolean>(false);

  const { stats, history } = useSystemStats(3000);

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            stats={stats}
            history={history}
            onNavigate={(page) => setCurrentPage(page)}
            openTerminal={() => setIsTerminalModalOpen(true)}
          />
        );
      case 'services':
        return <ServicesView />;
      case 'docker':
        return <DockerApps />;
      case 'library':
        return <AppLibrary onNavigate={(page) => setCurrentPage(page)} />;
      case 'git':
        return <GitDeploy />;
      case 'database':
        return <DatabaseManager />;
      case 'tunnels':
        return <Tunnels />;
      case 'automation':
        return <Automation />;
      case 'firewall':
        return <FirewallView />;
      case 'files':
        return <FileManagerView />;
      case 'terminal':
        return <TerminalView />;
      default:
        return (
          <Dashboard
            stats={stats}
            history={history}
            onNavigate={(page) => setCurrentPage(page)}
            openTerminal={() => setIsTerminalModalOpen(true)}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-[#090D16] text-[#E2E8F0] overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onSelectPage={(page) => setCurrentPage(page)}
        openTerminal={() => setIsTerminalModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar with Target OS & Health status */}
        <Topbar
          stats={stats}
          targetOS={targetOS}
          onTargetOSChange={(os) => setTargetOS(os)}
          openTerminal={() => setIsTerminalModalOpen(true)}
        />

        {/* Dynamic Page Views */}
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="max-w-7xl mx-auto pb-12">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Global Terminal Quick Popup */}
      <Modal
        isOpen={isTerminalModalOpen}
        onClose={() => setIsTerminalModalOpen(false)}
        title="Web Terminal Console"
        maxWidth="max-w-5xl"
      >
        <div className="h-[70vh]">
          <TerminalView />
        </div>
      </Modal>
    </div>
  );
};

export default App;
