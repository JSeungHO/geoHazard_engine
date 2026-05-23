import { Component } from 'react'
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
        <div className="simulation-error">
          <p className="simulation-error__title">시뮬레이션 오류</p>
          <p className="simulation-error__message">
            3D 침수·강수 렌더링 중 문제가 발생했습니다. 새로고침하거나 다시 시도해 주세요.
          </p>
          <button type="button" className="simulation-error__retry" onClick={this.handleRetry}>
            다시 시도
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
