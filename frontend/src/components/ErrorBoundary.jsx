import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
                    <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-xl max-w-lg text-center">
                        <div className="text-6xl mb-6">⚠️</div>
                        <h2 className="text-2xl font-black text-slate-900 mb-4">Terjadi Kesalahan</h2>
                        <p className="text-slate-500 mb-6">Halaman mengalami error. Silakan refresh halaman.</p>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null });
                                window.location.reload();
                            }}
                            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors"
                        >
                            Refresh Halaman
                        </button>
                        <details className="mt-6 text-left text-xs text-slate-400">
                            <summary className="cursor-pointer font-bold">Detail Error</summary>
                            <pre className="mt-2 p-4 bg-slate-50 rounded-xl overflow-auto">{this.state.error?.toString()}</pre>
                        </details>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
