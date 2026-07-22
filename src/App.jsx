import { useState } from 'react'
import Sidebar from './components/Sidebar'
import AgentWorkspace from './components/AgentWorkspace'
import Settings from './components/Settings'

export default function App() {
  const [page, setPageState] = useState('workspace')
  const [workspacePage, setWorkspacePage] = useState('workspace')
  const [refreshKey, setRefreshKey] = useState(0)
  const activePage = ['settings', 'assets', 'canvas'].includes(page) ? page : 'workspace'

  const refreshHistory = () => setRefreshKey(k => k + 1)
  const setPage = (nextPage) => {
    const normalizedPage = ['settings', 'assets', 'canvas'].includes(nextPage) ? nextPage : 'workspace'
    setPageState(normalizedPage)
    if (normalizedPage !== 'settings') {
      setWorkspacePage(normalizedPage)
    }
  }

  const workspaceView = workspacePage === 'assets'
    ? 'assets'
    : workspacePage === 'canvas'
    ? 'canvas'
    : 'creator'

  return (
    <div className="flex h-screen bg-[#eef3f2] text-slate-900">
      <Sidebar page={activePage} setPage={setPage} refreshKey={refreshKey} />
      <main className={`flex-1 min-w-0 overflow-y-auto ${activePage === 'settings' ? 'bg-gray-950 p-6 text-white' : ''}`}>
        {activePage === 'settings' && (
          <Settings />
        )}
        <div className={activePage === 'settings' ? 'hidden' : ''}>
          <AgentWorkspace view={workspaceView} onGenerated={refreshHistory} onNavigate={setPage} />
        </div>
      </main>
    </div>
  )
}
