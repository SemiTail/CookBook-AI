import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="container"><div className="error" role="alert">
      Не вдалося відобразити сторінку. <button onClick={() => window.location.reload()}>Оновити сторінку</button>
    </div></main>;
    return this.props.children;
  }
}
