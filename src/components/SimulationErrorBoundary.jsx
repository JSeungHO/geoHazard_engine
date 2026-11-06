import { Component } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import './SimulationErrorBoundary.css'

export default class SimulationErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[SimulationErrorBoundary]', error, info)
  }

  handleRetry = () => {
    this.props.onRetry?.()
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="simulation-error overlay-surface" role="alert">
          <AlertTriangle size={18} strokeWidth={2} className="simulation-error__icon" aria-hidden="true" />
          <div>
            <p className="simulation-error__title">렌더링 오류</p>
            <p className="simulation-error__message">
              3D 시뮬레이션 레이어를 그리는 중 문제가 발생했습니다. 다시 시도하거나 페이지를 새로고침해 주세요.
            </p>
            <button type="button" className="btn" onClick={this.handleRetry}>
              <RotateCcw size={13} strokeWidth={2} aria-hidden="true" />
              다시 시도
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
