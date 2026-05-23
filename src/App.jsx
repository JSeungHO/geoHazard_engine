import { useState } from 'react'
import ModuleShell from './components/ModuleShell'
import { DEFAULT_MODULE_ID, getModuleById, MODULE_REGISTRY } from './modules/registry'

function App() {
  const [moduleId, setModuleId] = useState(DEFAULT_MODULE_ID)
  const activeModule = getModuleById(moduleId)
  const ModuleComponent = activeModule.component

  return (
    <ModuleShell
      modules={MODULE_REGISTRY}
      activeId={moduleId}
      onModuleChange={setModuleId}
    >
      {ModuleComponent ? <ModuleComponent /> : null}
    </ModuleShell>
  )
}

export default App
