import dynamic from "next/dynamic";
const App = dynamic(() => import("@/components/App"), { ssr: false, loading: () => <div className="splash"><div className="splash-logo" /><span>RedCanvas Studio</span></div> });
export default function Page() { return <App />; }
