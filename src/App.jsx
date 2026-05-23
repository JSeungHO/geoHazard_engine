import { useState } from 'react'
import ModuleShell from './components/ModuleShell'
import MobileWarning from './components/MobileWarning'
import { DEFAULT_MODULE_ID, getModuleById, MODULE_REGISTRY } from './modules/registry'

function App() {
  const [moduleId, setModuleId] = useState(DEFAULT_MODULE_ID)
  const activeModule = getModuleById(moduleId)
  const ModuleComponent = activeModule.component

  return (
    <>
      <MobileWarning />
      <ModuleShell
        modules={MODULE_REGISTRY}
        activeId={moduleId}
        onModuleChange={setModuleId}
      >
        {ModuleComponent ? <ModuleComponent /> : null}
      </ModuleShell>
    </>
  )
}

export default App
